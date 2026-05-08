import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { patients } from '$lib/server/db/schema';
import type { NewPatient } from './patient.types';

type Database = typeof db;

export class PatientRepository {
	constructor(private readonly database: Database = db) {}

	getById(id: string) {
		return this.database.select().from(patients).where(eq(patients.id, id)).limit(1).then((rows) => rows[0]);
	}

	async findByBarcode(barcode: string) {
		const rows = await this.database
			.select()
			.from(patients)
			.where(eq(patients.barcode, barcode))
			.limit(1);
		return rows[0];
	}

	getByBarcode(barcode: string) {
		return this.findByBarcode(barcode);
	}

	async createForBarcode(input: NewPatient) {
		const [created] = await this.database
			.insert(patients)
			.values(input)
			.onConflictDoNothing({ target: patients.barcode })
			.returning();
		if (created) return created;

		return this.getByBarcode(input.barcode);
	}
}
