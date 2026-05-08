import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	emrNoteDefinitions,
	emrNoteDefinitionDrafts,
	emrNoteDefinitionVersions
} from '$lib/server/db/schema';
import type {
	EmrNoteDefinitionDraftRecord,
	EmrNoteDefinitionRecord,
	EmrNoteDefinitionVersionRecord,
	NewEmrNoteDefinition,
	NewEmrNoteDefinitionDraft,
	NewEmrNoteDefinitionVersion
} from './emr-builder.types';

type Database = typeof db;

export class EmrBuilderRepository {
	constructor(private readonly database: Database = db) {}

	findDefinitionByDefinitionId(definitionId: string) {
		return this.database
			.select()
			.from(emrNoteDefinitions)
			.where(eq(emrNoteDefinitions.definitionId, definitionId))
			.limit(1)
			.then((rows) => rows[0] as EmrNoteDefinitionRecord | undefined);
	}

	findDefinitionById(id: string) {
		return this.database
			.select()
			.from(emrNoteDefinitions)
			.where(eq(emrNoteDefinitions.id, id))
			.limit(1)
			.then((rows) => rows[0] as EmrNoteDefinitionRecord | undefined);
	}

	listDefinitions() {
		return this.database
			.select()
			.from(emrNoteDefinitions)
			.orderBy(desc(emrNoteDefinitions.updatedAt))
			.then((rows) => rows as EmrNoteDefinitionRecord[]);
	}

	listActiveDefinitions() {
		return this.database
			.select()
			.from(emrNoteDefinitions)
			.where(eq(emrNoteDefinitions.status, 'active'))
			.orderBy(desc(emrNoteDefinitions.updatedAt))
			.then((rows) => rows as EmrNoteDefinitionRecord[]);
	}

	upsertDefinition(input: NewEmrNoteDefinition) {
		return this.database
			.insert(emrNoteDefinitions)
			.values(input)
			.onConflictDoUpdate({
				target: emrNoteDefinitions.definitionId,
				set: {
					slug: input.slug,
					title: input.title,
					noteType: input.noteType,
					specialty: input.specialty,
					status: input.status,
					version: input.version,
					versionHash: input.versionHash,
					locale: input.locale,
					tags: input.tags,
					ownerTeam: input.ownerTeam,
					effectiveFrom: input.effectiveFrom,
					effectiveUntil: input.effectiveUntil,
					updatedBy: input.updatedBy,
					updatedAt: new Date()
				}
			})
			.returning()
			.then((rows) => rows[0] as EmrNoteDefinitionRecord);
	}

	setDefinitionStatus(
		definitionId: string,
		status: EmrNoteDefinitionRecord['status'],
		updatedBy?: string
	) {
		return this.database
			.update(emrNoteDefinitions)
			.set({
				status,
				updatedBy,
				updatedAt: new Date()
			})
			.where(eq(emrNoteDefinitions.id, definitionId))
			.returning()
			.then((rows) => rows[0] as EmrNoteDefinitionRecord | undefined);
	}

	applyDefinitionVersionUpdate(
		definitionId: string,
		input: {
			version: NewEmrNoteDefinition['version'];
			versionHash: NewEmrNoteDefinition['versionHash'];
			status: NewEmrNoteDefinition['status'];
			updatedBy?: NewEmrNoteDefinition['updatedBy'];
		}
	) {
		return this.database
			.update(emrNoteDefinitions)
			.set({
				version: input.version,
				versionHash: input.versionHash,
				updatedBy: input.updatedBy,
				status: input.status,
				updatedAt: new Date()
			})
			.where(eq(emrNoteDefinitions.id, definitionId))
			.returning()
			.then((rows) => rows[0] as EmrNoteDefinitionRecord | undefined);
	}

	upsertDraft(definitionId: string, input: Omit<NewEmrNoteDefinitionDraft, 'definitionId'>) {
		return this.database
			.insert(emrNoteDefinitionDrafts)
			.values({
				definitionId,
				payloadJson: input.payloadJson,
				versionHash: input.versionHash,
				createdBy: input.createdBy,
				updatedBy: input.updatedBy
			})
			.onConflictDoUpdate({
				target: emrNoteDefinitionDrafts.definitionId,
				set: {
					payloadJson: input.payloadJson,
					versionHash: input.versionHash,
					updatedBy: input.updatedBy,
					updatedAt: new Date()
				}
			})
			.returning()
			.then((rows) => rows[0] as EmrNoteDefinitionDraftRecord);
	}

	findDraftByDefinitionId(definitionId: string) {
		return this.database
			.select()
			.from(emrNoteDefinitionDrafts)
			.where(eq(emrNoteDefinitionDrafts.definitionId, definitionId))
			.limit(1)
			.then((rows) => rows[0] as EmrNoteDefinitionDraftRecord | undefined);
	}

	deleteDraft(definitionId: string) {
		return this.database
			.delete(emrNoteDefinitionDrafts)
			.where(eq(emrNoteDefinitionDrafts.definitionId, definitionId))
			.returning()
			.then((rows) => rows[0] as EmrNoteDefinitionDraftRecord | undefined);
	}

	listVersions(definitionId: string, limit = 20) {
		return this.database
			.select()
			.from(emrNoteDefinitionVersions)
			.where(eq(emrNoteDefinitionVersions.definitionId, definitionId))
			.orderBy(desc(emrNoteDefinitionVersions.version))
			.limit(limit)
			.then((rows) => rows as EmrNoteDefinitionVersionRecord[]);
	}

	findVersionByDefinitionIdAndVersion(definitionId: string, version: number) {
		return this.database
			.select()
			.from(emrNoteDefinitionVersions)
			.where(
				and(
					eq(emrNoteDefinitionVersions.definitionId, definitionId),
					eq(emrNoteDefinitionVersions.version, version)
				)
			)
			.limit(1)
			.then((rows) => rows[0] as EmrNoteDefinitionVersionRecord | undefined);
	}

	findLatestVersion(definitionId: string) {
		return this.database
			.select()
			.from(emrNoteDefinitionVersions)
			.where(eq(emrNoteDefinitionVersions.definitionId, definitionId))
			.orderBy(desc(emrNoteDefinitionVersions.version))
			.limit(1)
			.then((rows) => rows[0] as EmrNoteDefinitionVersionRecord | undefined);
	}

	createVersion(input: NewEmrNoteDefinitionVersion) {
		return this.database
			.insert(emrNoteDefinitionVersions)
			.values(input)
			.returning()
			.then((rows) => rows[0] as EmrNoteDefinitionVersionRecord);
	}
}
