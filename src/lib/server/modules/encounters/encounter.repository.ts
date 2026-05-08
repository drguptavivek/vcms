import { db } from '$lib/server/db';
import { encounters } from '$lib/server/db/schema';
import type { NewEncounter } from './encounter.types';

type Database = typeof db;

export class EncounterRepository {
	constructor(private readonly database: Database = db) {}

	async create(input: NewEncounter) {
		const [encounter] = await this.database.insert(encounters).values(input).returning();
		return encounter;
	}
}
