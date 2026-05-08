import type { clinicalWorklists } from '$lib/server/db/schema';

export type ClinicalWorklist = typeof clinicalWorklists.$inferSelect;
export type NewClinicalWorklist = typeof clinicalWorklists.$inferInsert;
