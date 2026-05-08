import type {
	clinicalNotes,
	clinicalNoteVersions,
	mobileSubmissionResults
} from '$lib/server/db/schema';

export type ClinicalNote = typeof clinicalNotes.$inferSelect;
export type NewClinicalNote = typeof clinicalNotes.$inferInsert;
export type ClinicalNoteVersion = typeof clinicalNoteVersions.$inferSelect;
export type NewClinicalNoteVersion = typeof clinicalNoteVersions.$inferInsert;
export type MobileSubmissionResultRecord = typeof mobileSubmissionResults.$inferSelect;
export type NewMobileSubmissionResult = typeof mobileSubmissionResults.$inferInsert;
