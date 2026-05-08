import { db } from '$lib/server/db';
import { desc, eq } from 'drizzle-orm';
import { encounters, patients } from '$lib/server/db/schema';
import type { NewEncounter } from './encounter.types';

type Database = typeof db;

export class EncounterRepository {
	constructor(private readonly database: Database = db) {}

	getById(encounterId: string) {
		return this.database
			.select()
			.from(encounters)
			.where(eq(encounters.id, encounterId))
			.limit(1)
			.then((rows) => rows[0]);
	}

	listByPatientId(patientId: string) {
		return this.database
			.select()
			.from(encounters)
			.where(eq(encounters.patientId, patientId))
			.orderBy(desc(encounters.occurredAt));
	}

	listByPatientBarcode(patientBarcode: string) {
		return this.database
			.select()
			.from(encounters)
			.innerJoin(patients, eq(encounters.patientId, patients.id))
			.where(eq(patients.barcode, patientBarcode))
			.orderBy(desc(encounters.occurredAt))
			.then((rows) => rows.map((row) => row.encounters));
	}

	async create(input: NewEncounter) {
		const [encounter] = await this.database.insert(encounters).values(input).returning();
		return encounter;
	}
}
