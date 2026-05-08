import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { clinicalNotes, clinicalNoteVersions } from '$lib/server/db/schema';
import type { NewClinicalNote, NewClinicalNoteVersion } from './clinical-note.types';

type Database = typeof db;

export class ClinicalNoteRepository {
	constructor(private readonly database: Database = db) {}

	async create(input: NewClinicalNote) {
		const [note] = await this.database.insert(clinicalNotes).values(input).returning();
		return note;
	}

	async createVersion(input: NewClinicalNoteVersion) {
		const [version] = await this.database.insert(clinicalNoteVersions).values(input).returning();
		return version;
	}

	async findLatestByEncounterAndType(encounterId: string, noteType: string) {
		const [note] = await this.database
			.select()
			.from(clinicalNotes)
			.where(and(eq(clinicalNotes.encounterId, encounterId), eq(clinicalNotes.noteType, noteType)))
			.orderBy(desc(clinicalNotes.createdAt))
			.limit(1);
		return note;
	}

	async updateCurrentVersion(
		noteId: string,
		input: { currentVersion: number; status: NewClinicalNote['status']; payloadHash: string }
	) {
		const [note] = await this.database
			.update(clinicalNotes)
			.set({
				currentVersion: input.currentVersion,
				payloadHash: input.payloadHash,
				status: input.status,
				updatedAt: new Date()
			})
			.where(eq(clinicalNotes.id, noteId))
			.returning();
		return note;
	}
}
