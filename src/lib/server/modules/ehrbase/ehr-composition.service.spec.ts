import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppError } from '$lib/server/observability/errors';
import { EhrCompositionService } from './ehr-composition.service';

const patientRepository = {
	updateOpenEhrIdentity: vi.fn()
};

const client = {
	createEhr: vi.fn(),
	submitFlatComposition: vi.fn()
};

const patient = {
	id: 'patient-1',
	barcode: '01-26-000001',
	fullName: 'Asha Devi',
	sex: 'female',
	openEhrId: null,
	openEhrSubjectId: null,
	openEhrSubjectNamespace: null
};

describe('EhrCompositionService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubEnv('EHRBASE_DEFAULT_TEMPLATE_ID', '');
		vi.stubEnv('EHRBASE_DEFAULT_COMPOSITION_PREFIX', '');
		vi.stubEnv('EHRBASE_SUBJECT_NAMESPACE', 'vcms-patient');
		client.createEhr.mockResolvedValue({ ehrId: 'ehr-1' });
		client.submitFlatComposition.mockResolvedValue({
			ehrId: 'ehr-1',
			compositionUid: 'composition-1::vcms.local.ehrbase::1',
			templateId: 'vcms-pec-opd.v1',
			format: 'FLAT'
		});
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('creates an EHR for a local patient and submits a FLAT Web Template payload', async () => {
		const service = new EhrCompositionService(client as never);

		const result = await service.submitRuntimeComposition({
			patient: patient as never,
			occurredAt: new Date('2026-05-11T08:30:00.000Z'),
			note: {
				chiefComplaint: 'Blurred vision',
				payload: {
					openEhr: {
						templateId: 'vcms-pec-opd.v1',
						compositionPrefix: 'pec_opd',
						flat: {
							'pec_opd/chief_complaint': 'Blurred vision'
						}
					}
				}
			},
			userId: 'user-1',
			patientRepository: patientRepository as never
		});

		expect(client.createEhr).toHaveBeenCalledWith({
			subjectId: 'patient-1',
			subjectNamespace: 'vcms-patient'
		});
		expect(patientRepository.updateOpenEhrIdentity).toHaveBeenCalledWith('patient-1', {
			openEhrId: 'ehr-1',
			openEhrSubjectId: 'patient-1',
			openEhrSubjectNamespace: 'vcms-patient'
		});
		expect(client.submitFlatComposition).toHaveBeenCalledWith({
			ehrId: 'ehr-1',
			templateId: 'vcms-pec-opd.v1',
			committerName: 'user-1',
			committerId: 'user-1',
			payload: expect.objectContaining({
				'pec_opd/chief_complaint': 'Blurred vision',
				'pec_opd/context/start_time': '2026-05-11T08:30:00.000Z',
				'pec_opd/category|code': '433',
				'pec_opd/category|value': 'event',
				'pec_opd/category|terminology': 'openehr'
			})
		});
		expect(result.reference.compositionUid).toBe('composition-1::vcms.local.ehrbase::1');
		expect(result.flatPayloadHash).toMatch(/^[a-f0-9]{64}$/);
		expect(result.localPayloadHash).toMatch(/^[a-f0-9]{64}$/);
	});

	it('reuses an existing ehr_id and does not create another EHR', async () => {
		const service = new EhrCompositionService(client as never);

		await service.submitRuntimeComposition({
			patient: {
				...patient,
				openEhrId: 'ehr-existing',
				openEhrSubjectId: 'subject-existing',
				openEhrSubjectNamespace: 'vcms-patient'
			} as never,
			occurredAt: new Date('2026-05-11T08:30:00.000Z'),
			note: {
				payload: {
					openEhr: {
						templateId: 'vcms-pec-opd.v1',
						flat: { 'vcms-pec-opd.v1/chief_complaint': 'Blurred vision' }
					}
				}
			},
			userId: 'user-1',
			patientRepository: patientRepository as never
		});

		expect(client.createEhr).not.toHaveBeenCalled();
		expect(patientRepository.updateOpenEhrIdentity).not.toHaveBeenCalled();
		expect(client.submitFlatComposition).toHaveBeenCalledWith(
			expect.objectContaining({ ehrId: 'ehr-existing' })
		);
	});

	it('rejects submissions that do not identify a published template', async () => {
		const service = new EhrCompositionService(client as never);

		await expect(
			service.submitRuntimeComposition({
				patient: patient as never,
				occurredAt: new Date('2026-05-11T08:30:00.000Z'),
				note: {
					payload: {
						'pec_opd/chief_complaint': 'Blurred vision'
					}
				},
				userId: 'user-1',
				patientRepository: patientRepository as never
			})
		).rejects.toMatchObject({
			code: 'OPENEHR_TEMPLATE_REQUIRED',
			status: 409
		} satisfies Partial<AppError>);

		expect(client.createEhr).not.toHaveBeenCalled();
		expect(client.submitFlatComposition).not.toHaveBeenCalled();
	});
});
