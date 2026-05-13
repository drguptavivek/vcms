import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { AppError, conflict, notFound } from '$lib/server/observability/errors';
import { ClinicalNoteService } from './clinical-note.service';

const audit = vi.hoisted(() => ({ writeAudit: vi.fn() }));

const patientRepository = vi.hoisted(() => ({
	findByBarcode: vi.fn(),
	createForBarcode: vi.fn()
}));

const encounterRepository = vi.hoisted(() => ({
	create: vi.fn()
}));

const carePathwayRepository = vi.hoisted(() => ({
	create: vi.fn()
}));

const clinicalNoteRepository = vi.hoisted(() => ({
	create: vi.fn(),
	createVersion: vi.fn(),
	findLatestByEncounterAndType: vi.fn(),
	updateCurrentVersion: vi.fn(),
	findMobileSubmissionResultByUserAndIdempotency: vi.fn(),
	createMobileSubmissionResult: vi.fn(),
	updateMobileSubmissionResult: vi.fn()
}));

const clinicalWorklistService = vi.hoisted(() => ({
	createFromPecSubmission: vi.fn()
}));

const runtimeCompositionService = vi.hoisted(() => ({
	submitRuntimeComposition: vi.fn()
}));

vi.mock('../patients/patient.repository', () => ({
	PatientRepository: class {
		constructor() {
			return patientRepository;
		}
	}
}));

vi.mock('../encounters/encounter.repository', () => ({
	EncounterRepository: class {
		constructor() {
			return encounterRepository;
		}
	}
}));

vi.mock('../care-pathways/care-pathway.repository', () => ({
	CarePathwayRepository: class {
		constructor() {
			return carePathwayRepository;
		}
	}
}));

vi.mock('./clinical-note.repository', () => ({
	ClinicalNoteRepository: class {
		constructor() {
			return clinicalNoteRepository;
		}
	}
}));

vi.mock('../clinical-worklists/clinical-worklist.service', () => ({
	ClinicalWorklistService: class {
		constructor() {
			return clinicalWorklistService;
		}
	}
}));

vi.mock('$lib/server/observability/audit', () => audit);

function createTx(pecRows: { id: number; active?: boolean }[]) {
	const where = vi.fn(() => Promise.resolve(pecRows));
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	return { select };
}

function runInTransactionMock(pecRows: { id: number; active?: boolean }[]) {
	return async (callback: (tx: unknown) => Promise<unknown>) =>
		callback(createTx(pecRows) as never);
}

const baseInput = {
	pecId: 4,
	barcode: '01-26-000001',
	patient: {
		fullName: 'Asha Devi',
		sex: 'female',
		ageYears: 35
	},
	pathway: {
		pathwayType: 'pec_opd',
		branchSource: 'pec_opd',
		answers: {}
	},
	encounter: {
		occurredAt: '2026-05-09T09:15:00'
	}
} as const;

const baseMobileInput = {
	...baseInput,
	idempotencyKey: 'mobile-req-123456',
	note: { chiefComplaint: 'Blurred vision', diagnosis: 'myopia', plan: 'reassess', payload: {} }
} as const;

function mobileCanonicalJson(value: unknown): unknown {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => mobileCanonicalJson(entry));
	}

	if (typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, mobileCanonicalJson(entry)])
		);
	}

	return value;
}

function buildMobileRequestHash(body: typeof baseMobileInput & Record<string, unknown>) {
	const hashable: Record<string, unknown> = { ...body };
	delete hashable.idempotencyKey;
	delete hashable.clientMetadata;
	delete hashable.deviceMetadata;

	return `sha256:${createHash('sha256')
		.update(JSON.stringify(mobileCanonicalJson(hashable)))
		.digest('hex')}`;
}

describe('ClinicalNoteService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		runtimeCompositionService.submitRuntimeComposition.mockResolvedValue({
			reference: {
				ehrId: 'ehr-1',
				compositionUid: 'composition-1::vcms.local.ehrbase::1',
				templateId: 'vcms-pec-opd.v1',
				format: 'FLAT'
			},
			localPayloadHash: 'local-payload-hash',
			flatPayloadHash: 'flat-payload-hash'
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('submits a PEC OPD payload through patient upsert, encounter creation, pathway branch, and note versioning', async () => {
		const service = new ClinicalNoteService(
			undefined,
			undefined,
			undefined,
			undefined,
			clinicalWorklistService as never,
			runInTransactionMock([{ id: 4, active: true }]) as never,
			runtimeCompositionService as never
		);

		patientRepository.findByBarcode.mockResolvedValue(undefined);
		patientRepository.createForBarcode.mockResolvedValue({
			id: 'patient-1',
			barcode: '01-26-000001',
			fullName: 'Asha Devi'
		} as never);
		encounterRepository.create.mockResolvedValue({
			id: 'encounter-1',
			patientId: 'patient-1',
			pecId: 4,
			barcodeSnapshot: '01-26-000001'
		} as never);
		carePathwayRepository.create.mockResolvedValue({
			id: 'pathway-1',
			patientId: 'patient-1',
			encounterId: 'encounter-1'
		} as never);
		clinicalNoteRepository.findLatestByEncounterAndType.mockResolvedValue(undefined);
		clinicalNoteRepository.create.mockResolvedValue({
			id: 'note-1',
			patientId: 'patient-1',
			encounterId: 'encounter-1',
			carePathwayId: 'pathway-1',
			currentVersion: 1,
			status: 'signed'
		} as never);
		clinicalNoteRepository.createVersion.mockResolvedValue({
			id: 'version-1',
			version: 1
		} as never);

		await expect(
			service.submitPecOpdNote({
				body: {
					...baseInput,
					pathway: {
						...baseInput.pathway,
						answers: {
							referralNeeded: 'yes',
							followUpDays: '7',
							visualAcuity: '6/12',
							diagnosis: 'myopia'
						}
					},
					note: {
						chiefComplaint: 'Blurred vision',
						diagnosis: 'myopia',
						plan: 'reassess',
						payload: { acuity: '6/12' }
					}
				},
				userId: 'user-1',
				requestId: 'req-1',
				ipAddress: '127.0.0.1',
				userAgent: 'vitest'
			})
		).resolves.toMatchObject({
			patientId: 'patient-1',
			encounterId: 'encounter-1',
			carePathwayId: 'pathway-1',
			version: 1,
			noteId: 'note-1',
			noteStatus: 'signed'
		});

		expect(patientRepository.findByBarcode).toHaveBeenCalledWith('01-26-000001');
		expect(patientRepository.createForBarcode).toHaveBeenCalledWith({
			barcode: '01-26-000001',
			primaryPecId: 4,
			fullName: 'Asha Devi',
			sex: 'female',
			ageYears: 35,
			createdBy: 'user-1'
		});
		expect(encounterRepository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId: 'patient-1',
				pecId: 4,
				barcodeSnapshot: '01-26-000001',
				createdBy: 'user-1',
				occurredAt: new Date('2026-05-09T09:15:00')
			})
		);
		expect(carePathwayRepository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId: 'patient-1',
				encounterId: 'encounter-1',
				pathwayType: 'pec_opd',
				context: expect.objectContaining({
					workflowAnswers: {
						referralNeeded: 'yes',
						followUpDays: '7'
					}
				})
			})
		);
		expect(clinicalWorklistService.createFromPecSubmission).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId: 'patient-1',
				carePathwayId: 'pathway-1',
				sourceEncounterId: 'encounter-1',
				sourceClinicalNoteId: 'note-1',
				pathwayType: 'pec_opd',
				pathwayAnswers: {
					referralNeeded: 'yes',
					followUpDays: '7'
				},
				encounterOccurredAt: new Date('2026-05-09T09:15:00')
			})
		);
		expect(clinicalNoteRepository.create).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId: 'patient-1',
				encounterId: 'encounter-1',
				carePathwayId: 'pathway-1',
				noteType: 'pec_opd',
				status: 'signed',
				currentVersion: 1,
				createdBy: 'user-1'
			})
		);
		expect(clinicalNoteRepository.createVersion).toHaveBeenCalledWith(
			expect.objectContaining({
				noteId: 'note-1',
				version: 1,
				changeType: 'create',
				reason: 'initial_submission',
				submittedBy: 'user-1',
				payload: {
					openEhr: {
						ehrId: 'ehr-1',
						compositionUid: 'composition-1::vcms.local.ehrbase::1',
						templateId: 'vcms-pec-opd.v1',
						format: 'FLAT'
					},
					hashes: {
						localPayloadHash: 'local-payload-hash',
						flatPayloadHash: 'flat-payload-hash'
					}
				},
				openEhrId: 'ehr-1',
				openEhrCompositionUid: 'composition-1::vcms.local.ehrbase::1',
				openEhrTemplateId: 'vcms-pec-opd.v1',
				openEhrCompositionFormat: 'FLAT'
			})
		);
		expect(runtimeCompositionService.submitRuntimeComposition).toHaveBeenCalledWith(
			expect.objectContaining({
				patient: expect.objectContaining({ id: 'patient-1' }),
				userId: 'user-1',
				note: expect.objectContaining({
					chiefComplaint: 'Blurred vision',
					diagnosis: 'myopia',
					plan: 'reassess',
					payload: { acuity: '6/12' }
				})
			})
		);
		expect(audit.writeAudit).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				requestId: 'req-1',
				action: 'emr.clinical_note.submit',
				resourceType: 'pec',
				resourceId: 4,
				reason: 'clinical_note_submit',
				after: {
					patientId: 'patient-1',
					encounterId: 'encounter-1',
					carePathwayId: 'pathway-1',
					noteId: 'note-1',
					version: 1,
					versionId: 'version-1',
					openEhrId: 'ehr-1',
					openEhrCompositionUid: 'composition-1::vcms.local.ehrbase::1',
					openEhrTemplateId: 'vcms-pec-opd.v1',
					barcode: '01-26-000001',
					isInitialSubmission: true
				}
			})
		);
	});

	it('stores corrected PEC OPD notes as additional immutable note versions', async () => {
		const service = new ClinicalNoteService(
			undefined,
			undefined,
			undefined,
			undefined,
			clinicalWorklistService as never,
			runInTransactionMock([{ id: 4, active: true }] as never) as never,
			runtimeCompositionService as never
		);

		patientRepository.findByBarcode.mockResolvedValue(undefined);
		patientRepository.createForBarcode.mockResolvedValue({
			id: 'patient-1',
			barcode: '01-26-000001'
		} as never);
		encounterRepository.create.mockResolvedValue({
			id: 'encounter-1',
			patientId: 'patient-1',
			pecId: 4
		} as never);
		carePathwayRepository.create.mockResolvedValue({
			id: 'pathway-1',
			patientId: 'patient-1',
			encounterId: 'encounter-1'
		} as never);
		clinicalNoteRepository.create.mockResolvedValue({
			id: 'note-1',
			patientId: 'patient-1',
			encounterId: 'encounter-1',
			carePathwayId: 'pathway-1',
			currentVersion: 1
		} as never);
		clinicalNoteRepository.findLatestByEncounterAndType
			.mockResolvedValueOnce(undefined)
			.mockResolvedValue({ id: 'note-1', currentVersion: 1, status: 'signed' } as never);
		clinicalNoteRepository.createVersion
			.mockResolvedValueOnce({ id: 'version-1', noteId: 'note-1', version: 1 } as never)
			.mockResolvedValueOnce({ id: 'version-2', noteId: 'note-1', version: 2 } as never);
		clinicalNoteRepository.updateCurrentVersion.mockResolvedValue({
			id: 'note-1',
			currentVersion: 2,
			status: 'amended'
		} as never);

		await service.submitPecOpdNote({
			body: {
				...baseInput,
				note: { chiefComplaint: 'Blur', payload: { acuity: '6/6' } }
			},
			userId: 'user-1',
			requestId: 'req-1'
		});
		await service.submitPecOpdNote({
			body: {
				...baseInput,
				note: {
					chiefComplaint: 'Blur better',
					payload: { acuity: '6/9' },
					diagnosis: 'improved'
				}
			},
			userId: 'user-1',
			requestId: 'req-2'
		});

		expect(clinicalNoteRepository.create).toHaveBeenCalledTimes(1);
		expect(clinicalNoteRepository.createVersion).toHaveBeenCalledTimes(2);
		expect(clinicalNoteRepository.createVersion).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				noteId: 'note-1',
				version: 1,
				changeType: 'create',
				reason: 'initial_submission',
				payload: {
					openEhr: expect.objectContaining({
						ehrId: 'ehr-1',
						compositionUid: 'composition-1::vcms.local.ehrbase::1',
						templateId: 'vcms-pec-opd.v1'
					}),
					hashes: {
						localPayloadHash: 'local-payload-hash',
						flatPayloadHash: 'flat-payload-hash'
					}
				},
				openEhrId: 'ehr-1',
				openEhrCompositionUid: 'composition-1::vcms.local.ehrbase::1',
				openEhrTemplateId: 'vcms-pec-opd.v1'
			})
		);
		expect(clinicalNoteRepository.createVersion).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				noteId: 'note-1',
				version: 2,
				changeType: 'amendment',
				reason: 'correction',
				payload: {
					openEhr: expect.objectContaining({
						ehrId: 'ehr-1',
						compositionUid: 'composition-1::vcms.local.ehrbase::1',
						templateId: 'vcms-pec-opd.v1'
					}),
					hashes: {
						localPayloadHash: 'local-payload-hash',
						flatPayloadHash: 'flat-payload-hash'
					}
				},
				openEhrId: 'ehr-1',
				openEhrCompositionUid: 'composition-1::vcms.local.ehrbase::1',
				openEhrTemplateId: 'vcms-pec-opd.v1'
			})
		);
		expect(runtimeCompositionService.submitRuntimeComposition).toHaveBeenCalledTimes(2);
		expect(clinicalNoteRepository.updateCurrentVersion).toHaveBeenCalledWith(
			'note-1',
			expect.objectContaining({
				currentVersion: 2,
				payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/),
				status: 'amended'
			})
		);
		expect(clinicalWorklistService.createFromPecSubmission).toHaveBeenCalledTimes(2);
		expect(clinicalWorklistService.createFromPecSubmission).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				pathwayType: 'pec_opd',
				sourceClinicalNoteId: 'note-1',
				sourceEncounterId: 'encounter-1'
			})
		);
		expect(clinicalWorklistService.createFromPecSubmission).toHaveBeenNthCalledWith(
			2,
			expect.objectContaining({
				pathwayType: 'pec_opd',
				sourceClinicalNoteId: 'note-1',
				sourceEncounterId: 'encounter-1'
			})
		);
	});

	it('rejects PEC OPD submissions when PEC lookup fails', async () => {
		const service = new ClinicalNoteService(
			undefined,
			undefined,
			undefined,
			undefined,
			clinicalWorklistService as never,
			runInTransactionMock([]) as never,
			runtimeCompositionService as never
		);

		await expect(
			service.submitPecOpdNote({
				body: {
					pecId: 999,
					barcode: '01-26-000001',
					patient: { fullName: 'Asha Devi', sex: 'female' },
					encounter: { occurredAt: '2026-05-09T09:30:00' },
					note: { payload: {} },
					pathway: { pathwayType: 'pec_opd', branchSource: 'pec_opd', answers: {} }
				},
				userId: 'user-1',
				requestId: 'req-404'
			})
		).rejects.toMatchObject({ code: notFound().code });

		expect(patientRepository.findByBarcode).not.toHaveBeenCalled();
		expect(patientRepository.createForBarcode).not.toHaveBeenCalled();
		expect(encounterRepository.create).not.toHaveBeenCalled();
	});

	it('returns a stored successful replay for repeated mobile idempotent submissions', async () => {
		const service = new ClinicalNoteService(
			undefined,
			undefined,
			undefined,
			undefined,
			clinicalWorklistService as never,
			runInTransactionMock([{ id: 4, active: true }] as never) as never,
			runtimeCompositionService as never
		);
		const replayPayload = {
			patientId: 'patient-1',
			encounterId: 'encounter-1',
			carePathwayId: 'pathway-1',
			noteId: 'note-1',
			noteStatus: 'signed',
			version: 1,
			barcode: '01-26-000001'
		};
		clinicalNoteRepository.findMobileSubmissionResultByUserAndIdempotency.mockResolvedValue({
			id: 'sub-1',
			status: 'success',
			requestHash: buildMobileRequestHash(baseMobileInput),
			responsePayload: replayPayload
		} as never);

		const output = await service.submitPecOpdNoteWithMobileIdempotency({
			body: {
				...baseMobileInput,
				note: {
					...baseMobileInput.note,
					payload: {}
				}
			},
			userId: 'user-1',
			requestId: 'req-1'
		});

		expect(output).toEqual(replayPayload);
		expect(clinicalNoteRepository.createMobileSubmissionResult).not.toHaveBeenCalled();
		expect(clinicalNoteRepository.create).not.toHaveBeenCalled();
		expect(clinicalNoteRepository.findLatestByEncounterAndType).not.toHaveBeenCalled();
		expect(clinicalWorklistService.createFromPecSubmission).not.toHaveBeenCalled();
	});

	it('returns conflict when mobile idempotent submissions reuse an idempotency key with different payload', async () => {
		const service = new ClinicalNoteService(
			undefined,
			undefined,
			undefined,
			undefined,
			clinicalWorklistService as never,
			runInTransactionMock([{ id: 4, active: true }] as never) as never,
			runtimeCompositionService as never
		);
		clinicalNoteRepository.findMobileSubmissionResultByUserAndIdempotency.mockResolvedValue({
			id: 'sub-1',
			status: 'success',
			requestHash: 'sha256:other',
			responsePayload: {}
		} as never);

		await expect(
			service.submitPecOpdNoteWithMobileIdempotency({
				body: {
					...baseMobileInput,
					note: {
						...baseMobileInput.note,
						payload: { source: 'mobile' }
					}
				},
				userId: 'user-1',
				requestId: 'req-1'
			})
		).rejects.toMatchObject({ code: conflict('idempotency key was reused').code });

		expect(clinicalNoteRepository.createMobileSubmissionResult).not.toHaveBeenCalled();
		expect(clinicalNoteRepository.updateMobileSubmissionResult).not.toHaveBeenCalled();
		expect(clinicalNoteRepository.create).not.toHaveBeenCalled();
	});

	it('creates idempotent mobile submission state and returns first submission result', async () => {
		const service = new ClinicalNoteService(
			undefined,
			undefined,
			undefined,
			undefined,
			clinicalWorklistService as never,
			runInTransactionMock([{ id: 4, active: true }] as never) as never,
			runtimeCompositionService as never
		);
		patientRepository.findByBarcode.mockResolvedValue(undefined);
		patientRepository.createForBarcode.mockResolvedValue({
			id: 'patient-1',
			barcode: '01-26-000001',
			fullName: 'Asha Devi'
		} as never);
		encounterRepository.create.mockResolvedValue({
			id: 'encounter-1',
			patientId: 'patient-1',
			pecId: 4,
			barcodeSnapshot: '01-26-000001'
		} as never);
		carePathwayRepository.create.mockResolvedValue({
			id: 'pathway-1',
			patientId: 'patient-1',
			encounterId: 'encounter-1'
		} as never);
		clinicalNoteRepository.findLatestByEncounterAndType.mockResolvedValue(undefined);
		clinicalNoteRepository.create.mockResolvedValue({
			id: 'note-1',
			patientId: 'patient-1',
			encounterId: 'encounter-1',
			carePathwayId: 'pathway-1',
			currentVersion: 1,
			status: 'signed'
		} as never);
		clinicalNoteRepository.createVersion.mockResolvedValue({
			id: 'version-1',
			version: 1
		} as never);
		clinicalNoteRepository.createMobileSubmissionResult.mockResolvedValue({
			id: 'sub-1'
		} as never);
		clinicalNoteRepository.updateMobileSubmissionResult.mockResolvedValue({
			id: 'sub-1'
		} as never);
		clinicalNoteRepository.findMobileSubmissionResultByUserAndIdempotency.mockResolvedValue(
			undefined
		);

		const output = await service.submitPecOpdNoteWithMobileIdempotency({
			body: {
				...baseMobileInput,
				clientMetadata: {
					clientName: 'VCMS Mobile',
					clientVersion: '1.0.0'
				},
				note: {
					...baseMobileInput.note,
					payload: { source: 'mobile' }
				}
			},
			userId: 'user-1',
			requestId: 'req-1'
		});

		expect(output).toEqual({
			patientId: 'patient-1',
			encounterId: 'encounter-1',
			carePathwayId: 'pathway-1',
			noteId: 'note-1',
			noteStatus: 'signed',
			version: 1,
			barcode: '01-26-000001'
		});
		expect(clinicalNoteRepository.createMobileSubmissionResult).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: 'user-1',
				idempotencyKey: 'mobile-req-123456',
				pecId: 4,
				status: 'processing',
				clientMetadata: expect.objectContaining({
					clientName: 'VCMS Mobile',
					clientVersion: '1.0.0'
				})
			})
		);
		expect(clinicalNoteRepository.updateMobileSubmissionResult).toHaveBeenCalledWith(
			'sub-1',
			expect.objectContaining({
				status: 'success',
				responsePayload: expect.objectContaining({
					patientId: 'patient-1',
					noteId: 'note-1'
				})
			})
		);
	});

	it('does not create local note versions when EHRbase rejects the runtime Composition', async () => {
		const service = new ClinicalNoteService(
			undefined,
			undefined,
			undefined,
			undefined,
			clinicalWorklistService as never,
			runInTransactionMock([{ id: 4, active: true }] as never) as never,
			runtimeCompositionService as never
		);
		runtimeCompositionService.submitRuntimeComposition.mockRejectedValue(
			new AppError(
				'EHRBASE_COMPOSITION_REJECTED',
				'Clinical data repository rejected the Composition.',
				502,
				{ status: 400, responseBodyHash: 'a'.repeat(64) }
			)
		);
		patientRepository.findByBarcode.mockResolvedValue(undefined);
		patientRepository.createForBarcode.mockResolvedValue({
			id: 'patient-1',
			barcode: '01-26-000001',
			fullName: 'Asha Devi'
		} as never);
		encounterRepository.create.mockResolvedValue({
			id: 'encounter-1',
			patientId: 'patient-1',
			pecId: 4,
			barcodeSnapshot: '01-26-000001'
		} as never);
		carePathwayRepository.create.mockResolvedValue({
			id: 'pathway-1',
			patientId: 'patient-1',
			encounterId: 'encounter-1'
		} as never);

		await expect(
			service.submitPecOpdNote({
				body: {
					...baseInput,
					note: {
						chiefComplaint: 'Blurred vision',
						payload: {
							openEhr: {
								templateId: 'vcms-pec-opd.v1',
								flat: { 'pec_opd/chief_complaint': 'Blurred vision' }
							}
						}
					}
				},
				userId: 'user-1',
				requestId: 'req-ehrbase-fail'
			})
		).rejects.toMatchObject({
			code: 'EHRBASE_COMPOSITION_REJECTED',
			message: 'Clinical data repository rejected the Composition.',
			details: {
				status: 400,
				responseBodyHash: 'a'.repeat(64)
			}
		});

		expect(runtimeCompositionService.submitRuntimeComposition).toHaveBeenCalledWith(
			expect.objectContaining({
				patient: expect.objectContaining({ id: 'patient-1' }),
				patientRepository,
				note: expect.objectContaining({
					payload: {
						openEhr: {
							templateId: 'vcms-pec-opd.v1',
							flat: { 'pec_opd/chief_complaint': 'Blurred vision' }
						}
					}
				})
			})
		);
		expect(clinicalNoteRepository.findLatestByEncounterAndType).not.toHaveBeenCalled();
		expect(clinicalNoteRepository.create).not.toHaveBeenCalled();
		expect(clinicalNoteRepository.createVersion).not.toHaveBeenCalled();
		expect(clinicalWorklistService.createFromPecSubmission).not.toHaveBeenCalled();
		expect(audit.writeAudit).not.toHaveBeenCalled();
	});
});
