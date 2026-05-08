import type { encounters } from '$lib/server/db/schema';

export type Encounter = typeof encounters.$inferSelect;
export type NewEncounter = typeof encounters.$inferInsert;
