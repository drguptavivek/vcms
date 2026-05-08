import { describe, expect, it, vi } from 'vitest';
import { CarePathwayService } from './care-pathway.service';
import type { NewCarePathway } from './care-pathway.types';

function resolvePecOpdBranch(answers: Record<string, string>) {
	if (answers.visualAcuity === 'count-fingers' || answers.traumaRedFlags === 'yes') {
		return 'emergent-referral';
	}

	return answers.glucomaRisk === 'high' ? 'urgent-review' : 'routine-follow-up';
}

function buildBranchContext(answers: Record<string, string>, pecId: number) {
	return {
		branchSource: 'pec_opd',
		pecId,
		pathwayBranch: resolvePecOpdBranch(answers),
		answers
	};
}

describe('CarePathwayService', () => {
	it('creates a pathway for an encounter and emits an audit trail', async () => {
		const patientQueryLimit = vi
			.fn()
			.mockResolvedValueOnce([{ id: 'patient-1' }])
			.mockResolvedValueOnce([{ id: 'enc-1', patientId: 'patient-1' }]);
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({ limit: patientQueryLimit }))
				}))
			})),
			insert: vi.fn(() => ({
				values: vi.fn(() => ({
					returning: vi.fn(async () => [
						{
							id: 'cp-1',
							patientId: 'patient-1',
							encounterId: 'enc-1',
							pathwayType: 'pec_opd',
							status: 'active'
						}
					])
				}))
			}))
		} as const;

		const database = {
			transaction: vi.fn((callback) => callback(tx as never))
		};
		const auditWriter = vi.fn();

		const service = new CarePathwayService(
			undefined,
			undefined,
			undefined,
			database as never,
			auditWriter
		);

		await expect(
			service.createForRequest({
				patientId: 'patient-1',
				encounterId: 'enc-1',
				pathwayType: 'pec_opd',
				status: 'active',
				userId: 'user-1',
				requestId: 'req-1'
			})
		).resolves.toMatchObject({
			id: 'cp-1',
			patientId: 'patient-1',
			encounterId: 'enc-1',
			pathwayType: 'pec_opd'
		});

		expect(auditWriter).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({
				requestId: 'req-1',
				actorUserId: 'user-1',
				action: 'emr.care_pathway.create'
			})
		);
		expect(database.transaction).toHaveBeenCalledTimes(1);
	});

	it('lists care pathways by barcode-backed patient lookup', async () => {
		const repository = {
			listByPatientId: vi.fn(() => Promise.resolve([{ id: 'cp-1' }]))
		};
		const patientRepository = {
			findByBarcode: vi.fn(async () => ({ id: 'patient-1', barcode: '01-26-000001' })),
			getById: vi.fn()
		};

		const service = new CarePathwayService(repository as never, patientRepository as never);

		await expect(
			service.listByPatientIdentifier({ patientBarcode: '01-26-000001' })
		).resolves.toEqual([{ id: 'cp-1' }]);

		expect(patientRepository.findByBarcode).toHaveBeenCalledWith('01-26-000001');
		expect(repository.listByPatientId).toHaveBeenCalledWith('patient-1');
	});

	it('persists deterministic pathway branches derived from PEC OPD answers', async () => {
		const repository = {
			create: (input: NewCarePathway) =>
				Promise.resolve({
					id: 'pathway-1',
					status: 'active',
					...input
				})
		};
		const service = new CarePathwayService(repository as never);
		const answers = {
			glaucomaRisk: 'routine',
			visualAcuity: 'count-fingers',
			traumaRedFlags: 'no'
		};
		const context = buildBranchContext(answers, 1);

		await expect(
			service.create({
				patientId: 'patient-1',
				encounterId: 'encounter-1',
				pathwayType: resolvePecOpdBranch(answers),
				context,
				createdBy: 'user-1'
			})
		).resolves.toMatchObject({
			patientId: 'patient-1',
			encounterId: 'encounter-1',
			pathwayType: 'emergent-referral',
			status: 'active',
			context
		});
	});

	it('persists a branch override snapshot for reproducible manual review', async () => {
		const repository = {
			create: (input: NewCarePathway) => Promise.resolve({ id: 'pathway-2', ...input })
		};
		const service = new CarePathwayService(repository as never);
		const context = {
			branchSource: 'manual_review',
			branchReason: 'clinic-override',
			approver: 'senior-clinician',
			sourceEncounter: 'encounter-1'
		};

		await expect(
			service.create({
				patientId: 'patient-1',
				encounterId: 'encounter-1',
				pathwayType: 'follow-up-needed',
				context,
				createdBy: 'user-1'
			})
		).resolves.toMatchObject({
			pathwayType: 'follow-up-needed',
			context
		});
	});
});
