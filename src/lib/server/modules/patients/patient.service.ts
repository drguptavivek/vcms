import { db } from '$lib/server/db';
import type { NewPatient } from './patient.types';
import { PatientRepository } from './patient.repository';

export class PatientService {
	constructor(private readonly repository = new PatientRepository()) {}

	findByBarcode(barcode: string) {
		return this.repository.getByBarcode(barcode);
	}

	createForBarcode(input: NewPatient) {
		return this.repository.createForBarcode(input);
	}

	transaction<T>(callback: Parameters<typeof db.transaction<T>>[0]) {
		return db.transaction(callback);
	}
}

export const patientService = new PatientService();
