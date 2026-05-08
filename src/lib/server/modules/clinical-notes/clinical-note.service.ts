import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pecs } from '$lib/server/db/schema';
import { writeAudit } from '$lib/server/observability/audit';
import { conflict, notFound } from '$lib/server/observability/errors';
import { CarePathwayRepository } from '../care-pathways/care-pathway.repository';
import { EncounterRepository } from '../encounters/encounter.repository';
import { PatientRepository } from '../patients/patient.repository';
import { ClinicalNoteRepository } from './clinical-note.repository';
import type { SubmitPecOpdNoteInput } from './clinical-note.schemas';

type ClinicalNoteSubmitInput = {
	body: SubmitPecOpdNoteInput;
	userId: string;
	requestId: string;
	ipAddress?: string;
	userAgent?: string;
};

type NoteVersionInput = Parameters<typeof ClinicalNoteRepository.prototype.createVersion>[0];

const pecOpdNoteType = 'pec_opd';

function normalizeName(value: string) {
	return value.trim().toLowerCase();
}

function buildPayloadHash(payload: NoteVersionInput['payload']) {
	return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export class ClinicalNoteService {
	constructor(
		private readonly patientRepository = new PatientRepository(),
		private readonly encounterRepository = new EncounterRepository(),
		private readonly carePathwayRepository = new CarePathwayRepository(),
		private readonly clinicalNoteRepository = new ClinicalNoteRepository(),
		private readonly runInTransaction = db.transaction.bind(db)
	) {}

	async submitPecOpdNote(input: ClinicalNoteSubmitInput) {
		return this.runInTransaction(async (tx) => {
			const transaction = tx as unknown as typeof db;
			const patientRepository = new PatientRepository(transaction);
			const encounterRepository = new EncounterRepository(transaction);
			const carePathwayRepository = new CarePathwayRepository(transaction);
			const clinicalNoteRepository = new ClinicalNoteRepository(transaction);

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

			const encounter = await encounterRepository.create({
				patientId: patient.id,
				pecId: input.body.pecId,
				barcodeSnapshot: patient.barcode,
				occurredAt: input.body.encounter.occurredAt
					? new Date(input.body.encounter.occurredAt)
					: new Date(),
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
					action: 'clinical_note.submit',
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

			await writeAudit(transaction, {
				requestId: input.requestId,
				actorUserId: input.userId,
				action: 'clinical_note.submit',
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
		});
	}
}

export const clinicalNoteService = new ClinicalNoteService();
