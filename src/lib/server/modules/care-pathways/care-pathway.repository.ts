import { db } from '$lib/server/db';
import { desc, eq } from 'drizzle-orm';
import { carePathways } from '$lib/server/db/schema';
import type { NewCarePathway } from './care-pathway.types';

type Database = typeof db;

export class CarePathwayRepository {
	constructor(private readonly database: Database = db) {}

	listByPatientId(patientId: string) {
		return this.database
			.select()
			.from(carePathways)
			.where(eq(carePathways.patientId, patientId))
			.orderBy(desc(carePathways.createdAt));
	}

	async create(input: NewCarePathway) {
		const [pathway] = await this.database.insert(carePathways).values(input).returning();
		return pathway;
	}
}
