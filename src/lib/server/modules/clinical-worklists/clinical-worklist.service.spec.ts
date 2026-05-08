import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicalWorklistService } from './clinical-worklist.service';

const repository = vi.hoisted(() => ({
	upsert: vi.fn()
}));

describe('ClinicalWorklistService', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('creates an emergency referral projection from PEC OPD pathway signals', async () => {
		const service = new ClinicalWorklistService(repository as never);
		repository.upsert.mockResolvedValue([{ id: 'worklist-1' } as never]);

		const occurenceAt = new Date('2026-05-09T09:00:00.000Z');
		await service.createFromPecSubmission({
			patientId: 'patient-1',
			carePathwayId: 'pathway-1',
			sourceEncounterId: 'encounter-1',
			sourceClinicalNoteId: 'note-1',
			pathwayType: 'emergent-referral',
			pathwayAnswers: {
				referralNeeded: 'yes',
				followUpDays: 3,
				riskLevel: 'high'
			},
			encounterOccurredAt: occurenceAt,
			chiefComplaint: 'loss of vision',
			diagnosis: 'retina',
			plan: 'refer urgently',
			createdBy: 'user-1'
		});

		expect(repository.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId: 'patient-1',
				carePathwayId: 'pathway-1',
				sourceEncounterId: 'encounter-1',
				sourceClinicalNoteId: 'note-1',
				worklistType: 'emergency-referral',
				status: 'open',
				createdBy: 'user-1',
				dueDate: new Date('2026-05-12T09:00:00.000Z'),
				summary: expect.objectContaining({
					source: 'pec_opd',
					pathwayType: 'emergent-referral',
					flags: expect.objectContaining({
						referralNeeded: true,
						riskLevel: 'high'
					}),
					extras: expect.objectContaining({
						referralNeeded: 'yes',
						followUpDays: 3,
						riskLevel: 'high'
					})
				})
			})
		);
	});

	it('derives routine follow-up rows with default pathway timing when no override exists', async () => {
		const service = new ClinicalWorklistService(repository as never);
		repository.upsert.mockResolvedValue([{ id: 'worklist-2' } as never]);

		const occurenceAt = new Date('2026-05-09T09:00:00.000Z');
		await service.createFromPecSubmission({
			patientId: 'patient-1',
			carePathwayId: 'pathway-1',
			sourceEncounterId: 'encounter-1',
			sourceClinicalNoteId: 'note-1',
			pathwayType: 'routine-follow-up',
			pathwayAnswers: {},
			encounterOccurredAt: occurenceAt
		});

		expect(repository.upsert).toHaveBeenCalledWith(
			expect.objectContaining({
				worklistType: 'routine-follow-up',
				dueDate: new Date('2026-05-16T09:00:00.000Z')
			})
		);
	});

	it('returns null without persisting when pathway data cannot produce a known projection', async () => {
		const service = new ClinicalWorklistService(repository as never);
		repository.upsert.mockResolvedValue([{ id: 'worklist-3' } as never]);

		const result = await service.createFromPecSubmission({
			patientId: 'patient-1',
			carePathwayId: 'pathway-1',
			sourceEncounterId: 'encounter-1',
			sourceClinicalNoteId: 'note-1',
			pathwayType: 'pec_opd',
			pathwayAnswers: {},
			encounterOccurredAt: new Date('2026-05-09T09:00:00.000Z')
		});

		expect(result).toBeNull();
		expect(repository.upsert).not.toHaveBeenCalled();
	});
});
