import { describe, expect, it, vi } from 'vitest';
import { ClinicalWorklistRepository } from './clinical-worklist.repository';

function databaseForUpsert() {
	const valuesCalledWith = vi.fn();
	const values = vi.fn((input: unknown) => {
		valuesCalledWith(input);
		return { onConflictDoUpdate };
	});
	const onConflictDoUpdate = vi.fn(() => ({ returning }));
	const returning = vi.fn(() => Promise.resolve([{ id: 'worklist-1' }]));

	const insert = vi.fn(() => ({ values }));

	return {
		database: { insert },
		calls: {
			insert,
			values,
			onConflictDoUpdate,
			returning,
			valuesCalledWith
		}
	};
}

describe('ClinicalWorklistRepository', () => {
	it('upserts clinical worklist projections keyed by patient/pathway/encounter/type', async () => {
		const { database, calls } = databaseForUpsert();
		const repository = new ClinicalWorklistRepository(database as never);

		await repository.upsert({
			patientId: 'patient-1',
			carePathwayId: 'pathway-1',
			sourceEncounterId: 'encounter-1',
			sourceClinicalNoteId: 'note-1',
			worklistType: 'routine-follow-up',
			status: 'open',
			dueDate: new Date('2026-05-16T00:00:00.000Z'),
			summary: { source: 'pec_opd' },
			createdBy: 'user-1'
		} as never);

		expect(calls.insert).toHaveBeenCalledTimes(1);
		expect(calls.values).toHaveBeenCalledTimes(1);
		expect(calls.valuesCalledWith).toHaveBeenCalledWith(
			expect.objectContaining({
				patientId: 'patient-1',
				worklistType: 'routine-follow-up'
			})
		);
		expect(calls.onConflictDoUpdate).toHaveBeenCalledTimes(1);
	});
});
