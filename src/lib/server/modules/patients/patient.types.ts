import type { patients } from '$lib/server/db/schema';

export type Patient = typeof patients.$inferSelect;
export type NewPatient = typeof patients.$inferInsert;
