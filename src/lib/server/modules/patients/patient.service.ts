import { db } from '$lib/server/db';
import { writeAudit } from '$lib/server/observability/audit';
import type { NewPatient } from './patient.types';
import { PatientRepository } from './patient.repository';

export class PatientService {
	constructor(
		private readonly repository = new PatientRepository(),
		private readonly database = db,
		private readonly auditWriter = writeAudit
	) {}

	findByBarcode(barcode: string) {
		return this.repository.getByBarcode(barcode);
	}

	createForBarcode(input: NewPatient) {
		return this.repository.createForBarcode(input);
	}

	createForBarcodeWithAudit(
		input: NewPatient & { requestId: string; ipAddress?: string; userAgent?: string }
	) {
		return this.database.transaction(async (tx) => {
			const repository = new PatientRepository(tx as unknown as typeof db);
			const { requestId, ipAddress, userAgent, ...patientPayload } = input;
			const patient = await repository.createForBarcode(patientPayload);
			await this.auditWriter(tx as unknown as typeof db, {
				requestId,
				actorUserId: input.createdBy ?? undefined,
				action: 'emr.patient.create',
				resourceType: 'patient',
				resourceId: patient.id,
				after: { barcode: patient.barcode },
				ipAddress,
				userAgent
			});
			return patient;
		});
	}

	transaction<T>(callback: Parameters<typeof db.transaction<T>>[0]) {
		return this.database.transaction(callback);
	}
}

export const patientService = new PatientService();
