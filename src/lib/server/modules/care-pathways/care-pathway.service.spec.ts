import { describe, expect, it } from 'vitest';
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
