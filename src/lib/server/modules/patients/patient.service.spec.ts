import { describe, expect, it, vi } from 'vitest';
import { PatientService } from './patient.service';

const patientRepository = vi.hoisted(() => ({
	createForBarcode: vi.fn()
}));

vi.mock('./patient.repository', () => ({
	PatientRepository: class {
		constructor() {
			return patientRepository;
		}
	}
}));

describe('PatientService', () => {
	it('creates a patient and writes an audit trail', async () => {
		const database = {
			transaction: vi.fn((callback) => callback({}))
		};
		const auditWriter = vi.fn();
		const service = new PatientService(undefined, database as never, auditWriter);
		const created = {
			id: 'patient-1',
			barcode: '01-26-000001',
			fullName: 'Asha Devi'
		} as const;

		patientRepository.createForBarcode.mockResolvedValue(created);

		await expect(
			service.createForBarcodeWithAudit({
				barcode: '01-26-000001',
				primaryPecId: 1,
				fullName: 'Asha Devi',
				createdBy: 'user-1',
				requestId: 'req-1',
				ipAddress: '127.0.0.1',
				userAgent: 'vitest'
			})
		).resolves.toEqual(created);

		expect(database.transaction).toHaveBeenCalledTimes(1);
		expect(patientRepository.createForBarcode).toHaveBeenCalledWith({
			barcode: '01-26-000001',
			primaryPecId: 1,
			fullName: 'Asha Devi',
			createdBy: 'user-1'
		});
		expect(auditWriter).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				requestId: 'req-1',
				actorUserId: 'user-1',
				action: 'emr.patient.create',
				resourceType: 'patient',
				resourceId: 'patient-1'
			})
		);
	});
});
