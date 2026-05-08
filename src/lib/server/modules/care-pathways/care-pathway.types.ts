import type { carePathways } from '$lib/server/db/schema';

export type CarePathway = typeof carePathways.$inferSelect;
export type NewCarePathway = typeof carePathways.$inferInsert;
