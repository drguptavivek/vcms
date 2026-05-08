import { describe, expect, it, vi } from 'vitest';
import { EncounterService } from './encounter.service';

describe('EncounterService', () => {
	it('creates an encounter when patient id is known and records an audit trail', async () => {
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						limit: vi.fn(() => Promise.resolve([{ id: 'patient-1', barcode: '01-26-000001' }]))
					}))
				}))
			})),
			insert: vi.fn(() => ({
				values: vi.fn(() => ({
					returning: vi.fn(async () => [
						{
							id: 'enc-1',
							patientId: 'patient-1',
							pecId: 2,
							barcodeSnapshot: '01-26-000001',
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

		const service = new EncounterService(undefined, undefined, database as never, auditWriter);

		await expect(
			service.createForRequest({
				patientId: 'patient-1',
				pecId: 2,
				status: 'active',
				userId: 'user-1',
				requestId: 'req-1'
			})
		).resolves.toMatchObject({
			id: 'enc-1',
			patientId: 'patient-1',
			pecId: 2,
			status: 'active'
		});

		expect(auditWriter).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({
				requestId: 'req-1',
				actorUserId: 'user-1',
				action: 'emr.encounter.create'
			})
		);
		expect(database.transaction).toHaveBeenCalledTimes(1);
	});

	it('lists encounters using barcode lookup as patient identity', async () => {
		const repository = {
			listByPatientId: vi.fn(() => Promise.resolve([{ id: 'enc-1' }]))
		};
		const patientRepository = {
			findByBarcode: vi.fn(async () => ({ id: 'patient-1', barcode: '01-26-000001' })),
			getById: vi.fn()
		};

		const service = new EncounterService(repository as never, patientRepository as never);

		await expect(
			service.listByPatientIdentifier({ patientBarcode: '01-26-000001' })
		).resolves.toEqual([{ id: 'enc-1' }]);

		expect(patientRepository.findByBarcode).toHaveBeenCalledWith('01-26-000001');
		expect(repository.listByPatientId).toHaveBeenCalledWith('patient-1');
	});

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
