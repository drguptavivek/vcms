import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { masSettings } from '$lib/server/db/schema';

export class SettingsRepository {
	constructor(private readonly database = db) {}

	get(key: string) {
		return this.database.select().from(masSettings).where(eq(masSettings.key, key)).limit(1);
	}

	upsert(input: { key: string; value: string; description: string; updatedBy: string }) {
		return this.database
			.insert(masSettings)
			.values({
				key: input.key,
				value: input.value,
				description: input.description,
				updatedBy: input.updatedBy
			})
			.onConflictDoUpdate({
				target: masSettings.key,
				set: {
					value: input.value,
					description: input.description,
					updatedBy: input.updatedBy,
					updatedAt: new Date()
				}
			})
			.returning();
	}
}
