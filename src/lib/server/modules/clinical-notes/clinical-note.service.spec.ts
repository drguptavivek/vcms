import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notFound } from '$lib/server/observability/errors';
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
	updateCurrentVersion: vi.fn()
}));

const clinicalWorklistService = vi.hoisted(() => ({
	createFromPecSubmission: vi.fn()
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

describe('ClinicalNoteService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
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
			runInTransactionMock([{ id: 4, active: true }]) as never
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
				pathwayType: 'pec_opd'
			})
		);
		expect(clinicalWorklistService.createFromPecSubmission).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId: 'patient-1',
				carePathwayId: 'pathway-1',
				sourceEncounterId: 'encounter-1',
				sourceClinicalNoteId: 'note-1',
				pathwayType: 'pec_opd',
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
					acuity: '6/12',
					chiefComplaint: 'Blurred vision',
					diagnosis: 'myopia',
					plan: 'reassess',
					visualAcuity: undefined
				}
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
			runInTransactionMock([{ id: 4, active: true }] as never) as never
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
					chiefComplaint: 'Blur',
					acuity: '6/6',
					diagnosis: undefined,
					plan: undefined,
					visualAcuity: undefined
				}
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
					chiefComplaint: 'Blur better',
					acuity: '6/9',
					diagnosis: 'improved',
					plan: undefined,
					visualAcuity: undefined
				}
			})
		);
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
			runInTransactionMock([]) as never
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
});
