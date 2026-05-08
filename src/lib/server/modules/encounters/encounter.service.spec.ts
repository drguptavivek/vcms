import { describe, expect, it, vi } from 'vitest';
import { EncounterService } from './encounter.service';

describe('EncounterService', () => {
	it('creates an active encounter with the patient barcode snapshot supplied by runtime intake', async () => {
		const encounter = {
			id: 'encounter-1',
			patientId: 'patient-1',
			pecId: 1,
			barcodeSnapshot: '01-26-000001',
			status: 'active'
		};
		const repository = {
			create: vi.fn((input) => Promise.resolve({ ...encounter, ...input }))
		};
		const service = new EncounterService(repository as never);

		await expect(
			service.create({
				patientId: 'patient-1',
				pecId: 1,
				barcodeSnapshot: '01-26-000001',
				createdBy: 'user-1'
			})
		).resolves.toMatchObject(encounter);

		expect(repository.create).toHaveBeenCalledWith({
			patientId: 'patient-1',
			pecId: 1,
			barcodeSnapshot: '01-26-000001',
			createdBy: 'user-1'
		});
	});

	it('passes explicit encounter metadata through to repository for auditing', async () => {
		const encounteredAt = new Date('2026-05-09T10:00:00.000Z');
		const created = {
			id: 'encounter-2',
			patientId: 'patient-1',
			pecId: 3,
			barcodeSnapshot: '02-26-000002',
			status: 'completed',
			occurredAt: encounteredAt,
			createdBy: 'user-2'
		};
		const repository = {
			create: vi.fn((input) => Promise.resolve({ ...created, ...input }))
		};
		const service = new EncounterService(repository as never);

		await expect(
			service.create({
				patientId: 'patient-1',
				pecId: 3,
				barcodeSnapshot: '02-26-000002',
				status: 'completed',
				occurredAt: encounteredAt,
				createdBy: 'user-2'
			})
		).resolves.toMatchObject(created);

		expect(repository.create).toHaveBeenCalledWith({
			patientId: 'patient-1',
			pecId: 3,
			barcodeSnapshot: '02-26-000002',
			status: 'completed',
			occurredAt: encounteredAt,
			createdBy: 'user-2'
		});
	});
});
