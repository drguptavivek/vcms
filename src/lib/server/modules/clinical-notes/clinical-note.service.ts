import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pecs } from '$lib/server/db/schema';
import { writeAudit } from '$lib/server/observability/audit';
import { conflict, isAppError, notFound } from '$lib/server/observability/errors';
import { CarePathwayRepository } from '../care-pathways/care-pathway.repository';
import { EncounterRepository } from '../encounters/encounter.repository';
import { PatientRepository } from '../patients/patient.repository';
import { ClinicalNoteRepository } from './clinical-note.repository';
import { ClinicalWorklistService } from '../clinical-worklists/clinical-worklist.service';
import type { SubmitPecOpdMobileNoteInput, SubmitPecOpdNoteInput } from './clinical-note.schemas';

type ClinicalNoteSubmitInput = {
	body: SubmitPecOpdNoteInput;
	userId: string;
	requestId: string;
	ipAddress?: string;
	userAgent?: string;
};

type ClinicalNoteMobileSubmitInput = {
	body: SubmitPecOpdMobileNoteInput;
	userId: string;
	requestId: string;
	ipAddress?: string;
	userAgent?: string;
};

type NoteVersionInput = Parameters<typeof ClinicalNoteRepository.prototype.createVersion>[0];
type NotePayload = { chiefComplaint?: string; diagnosis?: string; plan?: string };

type MobileSubmissionRecord = Awaited<
	ReturnType<ClinicalNoteRepository['findMobileSubmissionResultByUserAndIdempotency']>
>;

type ClinicalNoteSubmitResult = {
	patientId: string;
	encounterId: string;
	carePathwayId: string;
	noteId: string;
	noteStatus: string | null;
	version: number;
	barcode: string;
};

type MobileSubmissionResult = ClinicalNoteSubmitResult;

const pecOpdNoteType = 'pec_opd';

function normalizeName(value: string) {
	return value.trim().toLowerCase();
}

function buildPayloadHash(payload: NoteVersionInput['payload']) {
	return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function toCanonicalJson(value: unknown): unknown {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => toCanonicalJson(entry));
	}

	if (typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, toCanonicalJson(entry)])
		);
	}

	return value;
}

function buildMobileSubmissionRequestHash(body: SubmitPecOpdMobileNoteInput) {
	const hashable: Partial<SubmitPecOpdMobileNoteInput> = { ...body };
	delete hashable.idempotencyKey;
	delete hashable.clientMetadata;
	delete hashable.deviceMetadata;

	return `sha256:${createHash('sha256')
		.update(JSON.stringify(toCanonicalJson(hashable)))
		.digest('hex')}`;
}

function toMobileClinicalNoteSubmitInput(body: SubmitPecOpdMobileNoteInput): SubmitPecOpdNoteInput {
	const submitBody: Partial<SubmitPecOpdMobileNoteInput> = { ...body };
	delete submitBody.idempotencyKey;
	delete submitBody.definitionVersion;
	delete submitBody.definitionHash;
	delete submitBody.clientMetadata;
	delete submitBody.deviceMetadata;

	return submitBody as SubmitPecOpdNoteInput;
}

function normalizeMetadata(value: SubmitPecOpdMobileNoteInput['clientMetadata']) {
	return value ?? {};
}

function isMobileSubmissionResult(value: unknown): value is MobileSubmissionResult {
	if (typeof value !== 'object' || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.patientId === 'string' &&
		typeof candidate.encounterId === 'string' &&
		typeof candidate.carePathwayId === 'string' &&
		typeof candidate.noteId === 'string' &&
		(typeof candidate.noteStatus === 'string' || candidate.noteStatus === null) &&
		typeof candidate.version === 'number' &&
		typeof candidate.barcode === 'string'
	);
}

export class ClinicalNoteService {
	constructor(
		private readonly patientRepository = new PatientRepository(),
		private readonly encounterRepository = new EncounterRepository(),
		private readonly carePathwayRepository = new CarePathwayRepository(),
		private readonly clinicalNoteRepository = new ClinicalNoteRepository(),
		private readonly clinicalWorklistService = new ClinicalWorklistService(),
		private readonly runInTransaction = db.transaction.bind(db)
	) {}

	async submitPecOpdNote(input: ClinicalNoteSubmitInput): Promise<ClinicalNoteSubmitResult> {
		return this.runInTransaction(async (tx) => {
			const transaction = tx as unknown as typeof db;
			const patientRepository = new PatientRepository(transaction);
			const encounterRepository = new EncounterRepository(transaction);
			const carePathwayRepository = new CarePathwayRepository(transaction);
			const clinicalNoteRepository = new ClinicalNoteRepository(transaction);

			return this.submitPecOpdNoteInTransaction(input, {
				patientRepository,
				encounterRepository,
				carePathwayRepository,
				clinicalNoteRepository,
				transaction
			});
		});
	}

	async submitPecOpdNoteWithMobileIdempotency(
		input: ClinicalNoteMobileSubmitInput
	): Promise<ClinicalNoteSubmitResult> {
		const requestHash = buildMobileSubmissionRequestHash(input.body);

		return this.runInTransaction(async (tx) => {
			const transaction = tx as unknown as typeof db;
			const patientRepository = new PatientRepository(transaction);
			const encounterRepository = new EncounterRepository(transaction);
			const carePathwayRepository = new CarePathwayRepository(transaction);
			const clinicalNoteRepository = new ClinicalNoteRepository(transaction);

			const existingRecord: MobileSubmissionRecord =
				await clinicalNoteRepository.findMobileSubmissionResultByUserAndIdempotency(
					input.userId,
					input.body.idempotencyKey
				);

			if (existingRecord) {
				if (existingRecord.requestHash !== requestHash) {
					throw conflict('Idempotency key was reused with a different payload.', {
						idempotencyKey: input.body.idempotencyKey
					});
				}

				if (existingRecord.status === 'processing') {
					throw conflict('Submission is already being processed for this idempotency key.', {
						idempotencyKey: input.body.idempotencyKey
					});
				}

				if (existingRecord.status === 'success') {
					const replay = existingRecord.responsePayload as unknown;
					if (!isMobileSubmissionResult(replay)) {
						throw conflict('Stored idempotency replay payload is invalid.', {
							idempotencyKey: input.body.idempotencyKey
						});
					}

					await writeAudit(transaction, {
						requestId: input.requestId,
						actorUserId: input.userId,
						action: 'emr.clinical_note.submit',
						resourceType: 'pec',
						resourceId: input.body.pecId,
						reason: 'clinical_note_submit_replay',
						after: replay,
						ipAddress: input.ipAddress,
						userAgent: input.userAgent
					});

					return replay;
				}
			}

			const mobileSubmission = existingRecord
				? await clinicalNoteRepository.updateMobileSubmissionResult(existingRecord.id, {
						status: 'processing',
						requestHash,
						definitionVersion: input.body.definitionVersion,
						definitionHash: input.body.definitionHash,
						clientMetadata: normalizeMetadata(input.body.clientMetadata),
						deviceMetadata: normalizeMetadata(input.body.deviceMetadata),
						responsePayload: {},
						errorCode: null,
						errorMessage: null,
						requestId: input.requestId
					})
				: await clinicalNoteRepository.createMobileSubmissionResult({
						userId: input.userId,
						idempotencyKey: input.body.idempotencyKey,
						pecId: input.body.pecId,
						requestHash,
						status: 'processing',
						definitionVersion: input.body.definitionVersion,
						definitionHash: input.body.definitionHash,
						clientMetadata: normalizeMetadata(input.body.clientMetadata),
						deviceMetadata: normalizeMetadata(input.body.deviceMetadata),
						responsePayload: {},
						requestId: input.requestId
					});

			try {
				const result = await this.submitPecOpdNoteInTransaction(
					{
						body: toMobileClinicalNoteSubmitInput(input.body),
						userId: input.userId,
						requestId: input.requestId,
						ipAddress: input.ipAddress,
						userAgent: input.userAgent
					},
					{
						patientRepository,
						encounterRepository,
						carePathwayRepository,
						clinicalNoteRepository,
						transaction
					}
				);

				await clinicalNoteRepository.updateMobileSubmissionResult(mobileSubmission.id, {
					status: 'success',
					responsePayload: result,
					requestHash,
					errorCode: null,
					errorMessage: null,
					requestId: input.requestId
				});

				return result;
			} catch (error) {
				await clinicalNoteRepository.updateMobileSubmissionResult(mobileSubmission.id, {
					status: 'failed',
					errorCode: isAppError(error) ? error.code : 'INTERNAL_ERROR',
					errorMessage: error instanceof Error ? error.message : 'Unexpected server error.'
				});
				throw error;
			}
		});
	}

	private async submitPecOpdNoteInTransaction(
		input: ClinicalNoteSubmitInput,
		repositories: {
			patientRepository: PatientRepository;
			encounterRepository: EncounterRepository;
			carePathwayRepository: CarePathwayRepository;
			clinicalNoteRepository: ClinicalNoteRepository;
			transaction: typeof db;
		}
	): Promise<ClinicalNoteSubmitResult> {
		const {
			patientRepository,
			encounterRepository,
			carePathwayRepository,
			clinicalNoteRepository,
			transaction
		} = repositories;

		const [pec] = await transaction
			.select({ id: pecs.id, active: pecs.active })
			.from(pecs)
			.where(eq(pecs.id, input.body.pecId));
		if (!pec) throw notFound('PEC not found.');
		if (!pec.active) {
			throw conflict('Cannot submit clinical notes for an inactive PEC.', {
				pecId: input.body.pecId
			});
		}

		const incomingPatient = {
			barcode: input.body.barcode,
			primaryPecId: input.body.pecId,
			fullName: input.body.patient.fullName,
			sex: input.body.patient.sex,
			dateOfBirth: input.body.patient.dateOfBirth,
			ageYears: input.body.patient.ageYears,
			phone: input.body.patient.phone,
			address: input.body.patient.address,
			createdBy: input.userId
		};

		const existingPatient = await patientRepository.findByBarcode(input.body.barcode);
		if (existingPatient) {
			if (normalizeName(existingPatient.fullName) !== normalizeName(incomingPatient.fullName)) {
				throw conflict('Barcode already belongs to another patient name.', {
					field: 'patient.fullName',
					expected: existingPatient.fullName,
					received: incomingPatient.fullName
				});
			}
			if (existingPatient.sex !== incomingPatient.sex) {
				throw conflict('Barcode already belongs to another patient sex.', {
					field: 'patient.sex',
					expected: existingPatient.sex,
					received: incomingPatient.sex
				});
			}
		}

		const patient = existingPatient
			? existingPatient
			: await patientRepository.createForBarcode(incomingPatient);

		const encounterOccurredAt = input.body.encounter.occurredAt
			? new Date(input.body.encounter.occurredAt)
			: new Date();

		const encounter = await encounterRepository.create({
			patientId: patient.id,
			pecId: input.body.pecId,
			barcodeSnapshot: patient.barcode,
			occurredAt: encounterOccurredAt,
			createdBy: input.userId
		});

		const carePathway = await carePathwayRepository.create({
			patientId: patient.id,
			encounterId: encounter.id,
			pathwayType: input.body.pathway.pathwayType,
			context: {
				barcode: patient.barcode,
				pecId: input.body.pecId,
				branchSource: input.body.pathway.branchSource,
				definitionVersion: input.body.pathway.definitionVersion,
				answers: input.body.pathway.answers
			},
			createdBy: input.userId
		});

		const notePayload: NoteVersionInput['payload'] = {
			...input.body.note.payload,
			chiefComplaint: input.body.note.chiefComplaint,
			visualAcuity: input.body.note.visualAcuity,
			diagnosis: input.body.note.diagnosis,
			plan: input.body.note.plan,
			pathwayType: carePathway.pathwayType,
			submissionSource: input.body.submissionSource
		};

		const latestNote = await clinicalNoteRepository.findLatestByEncounterAndType(
			encounter.id,
			pecOpdNoteType
		);
		if (latestNote?.status === 'draft') {
			throw conflict('Encounter has an unresolved draft PEC OPD note.', {
				noteId: latestNote.id,
				encounterId: encounter.id
			});
		}

		const { pathwayType: payloadPathwayType, ...worklistInputPayload } =
			notePayload as NotePayload & {
				pathwayType?: string;
			};
		const pathwayType =
			carePathway.pathwayType ?? input.body.pathway.pathwayType ?? payloadPathwayType;

		let noteVersion;
		let note;
		const notePayloadHash = buildPayloadHash(notePayload);

		if (!latestNote) {
			note = await clinicalNoteRepository.create({
				patientId: patient.id,
				encounterId: encounter.id,
				carePathwayId: carePathway.id,
				noteType: pecOpdNoteType,
				payloadHash: notePayloadHash,
				status: 'signed',
				currentVersion: 1,
				createdBy: input.userId
			});

			noteVersion = await clinicalNoteRepository.createVersion({
				noteId: note.id,
				version: 1,
				payloadHash: notePayloadHash,
				changeType: 'create',
				reason: 'initial_submission',
				payload: notePayload,
				submittedBy: input.userId
			});

			await writeAudit(transaction, {
				requestId: input.requestId,
				actorUserId: input.userId,
				action: 'emr.clinical_note.submit',
				resourceType: 'pec',
				resourceId: input.body.pecId,
				reason: 'clinical_note_submit',
				after: {
					patientId: patient.id,
					encounterId: encounter.id,
					carePathwayId: carePathway.id,
					noteId: note.id,
					version: noteVersion.version,
					versionId: noteVersion.id,
					barcode: patient.barcode,
					isInitialSubmission: true
				},
				ipAddress: input.ipAddress,
				userAgent: input.userAgent
			});

			await this.clinicalWorklistService.createFromPecSubmission({
				patientId: patient.id,
				carePathwayId: carePathway.id,
				sourceEncounterId: encounter.id,
				sourceClinicalNoteId: note.id,
				pathwayType,
				pathwayAnswers: input.body.pathway.answers,
				encounterOccurredAt,
				...worklistInputPayload,
				createdBy: input.userId
			});

			return {
				patientId: patient.id,
				encounterId: encounter.id,
				carePathwayId: carePathway.id,
				noteId: note.id,
				noteStatus: note.status,
				version: noteVersion.version,
				barcode: patient.barcode
			};
		}

		const nextVersion = latestNote.currentVersion + 1;
		const nextPayloadHash = buildPayloadHash(notePayload);
		noteVersion = await clinicalNoteRepository.createVersion({
			noteId: latestNote.id,
			version: nextVersion,
			payloadHash: nextPayloadHash,
			changeType: 'amendment',
			reason: 'correction',
			payload: notePayload,
			submittedBy: input.userId
		});

		if (noteVersion.version !== nextVersion) {
			throw conflict('Clinical note version conflict detected.', {
				noteId: latestNote.id,
				expectedNextVersion: nextVersion,
				recordedVersion: noteVersion.version
			});
		}

		note = await clinicalNoteRepository.updateCurrentVersion(latestNote.id, {
			currentVersion: nextVersion,
			payloadHash: nextPayloadHash,
			status: 'amended'
		});

		await this.clinicalWorklistService.createFromPecSubmission({
			patientId: patient.id,
			carePathwayId: carePathway.id,
			sourceEncounterId: encounter.id,
			sourceClinicalNoteId: latestNote.id,
			pathwayType,
			pathwayAnswers: input.body.pathway.answers,
			encounterOccurredAt,
			...worklistInputPayload,
			createdBy: input.userId
		});

		await writeAudit(transaction, {
			requestId: input.requestId,
			actorUserId: input.userId,
			action: 'emr.clinical_note.submit',
			resourceType: 'pec',
			resourceId: input.body.pecId,
			reason: 'clinical_note_amend',
			before: {
				noteId: latestNote.id,
				currentVersion: latestNote.currentVersion,
				status: latestNote.status
			},
			after: {
				patientId: patient.id,
				encounterId: encounter.id,
				carePathwayId: carePathway.id,
				noteId: latestNote.id,
				version: noteVersion.version,
				versionId: noteVersion.id,
				barcode: patient.barcode,
				isInitialSubmission: false
			},
			ipAddress: input.ipAddress,
			userAgent: input.userAgent
		});

		return {
			patientId: patient.id,
			encounterId: encounter.id,
			carePathwayId: carePathway.id,
			noteId: latestNote.id,
			noteStatus: note?.status,
			version: noteVersion.version,
			barcode: patient.barcode
		};
	}
}

export const clinicalNoteService = new ClinicalNoteService();
