import type { clinicalNotes, clinicalNoteVersions } from '$lib/server/db/schema';

export type ClinicalNote = typeof clinicalNotes.$inferSelect;
export type NewClinicalNote = typeof clinicalNotes.$inferInsert;
export type ClinicalNoteVersion = typeof clinicalNoteVersions.$inferSelect;
export type NewClinicalNoteVersion = typeof clinicalNoteVersions.$inferInsert;
