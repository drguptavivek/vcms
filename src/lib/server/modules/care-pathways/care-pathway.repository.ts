import { db } from '$lib/server/db';
import { carePathways } from '$lib/server/db/schema';
import type { NewCarePathway } from './care-pathway.types';

type Database = typeof db;

export class CarePathwayRepository {
	constructor(private readonly database: Database = db) {}

	async create(input: NewCarePathway) {
		const [pathway] = await this.database.insert(carePathways).values(input).returning();
		return pathway;
	}
}
