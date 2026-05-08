import { db } from '$lib/server/db';
import { clinicalWorklists } from '$lib/server/db/schema';
import type { NewClinicalWorklist } from './clinical-worklist.types';

type Database = typeof db;

export class ClinicalWorklistRepository {
	constructor(private readonly database: Database = db) {}

	async upsert(input: NewClinicalWorklist) {
		return this.database
			.insert(clinicalWorklists)
			.values(input)
			.onConflictDoUpdate({
				target: [
					clinicalWorklists.patientId,
					clinicalWorklists.carePathwayId,
					clinicalWorklists.sourceEncounterId,
					clinicalWorklists.worklistType
				],
				set: {
					sourceClinicalNoteId: input.sourceClinicalNoteId,
					status: input.status,
					dueDate: input.dueDate,
					summary: input.summary,
					updatedAt: new Date()
				}
			})
			.returning();
	}
}
