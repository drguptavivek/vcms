import { and, desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	emrDictionaryAssets,
	emrDictionaryAssetDrafts,
	emrDictionaryAssetVersions
} from '$lib/server/db/schema';
import type {
	EmrDictionaryAssetDraftRecord,
	EmrDictionaryAssetRecord,
	EmrDictionaryAssetVersionRecord,
	NewEmrDictionaryAsset,
	NewEmrDictionaryAssetDraft,
	NewEmrDictionaryAssetVersion
} from './emr-dictionary.types';
import type { EmrDictionaryKind, EmrDictionaryStatus } from './emr-dictionary.schemas';

type Database = typeof db;

export class EmrDictionaryRepository {
	constructor(private readonly database: Database = db) {}

	findAssetByIdentity(dictionaryId: string, key: string, kind: EmrDictionaryKind) {
		return this.database
			.select()
			.from(emrDictionaryAssets)
			.where(
				and(
					eq(emrDictionaryAssets.dictionaryId, dictionaryId),
					eq(emrDictionaryAssets.key, key),
					eq(emrDictionaryAssets.kind, kind)
				)
			)
			.limit(1)
			.then((rows) => rows[0] as EmrDictionaryAssetRecord | undefined);
	}

	listAssets(filters: {
		dictionaryId?: string;
		kind?: EmrDictionaryKind;
		status?: EmrDictionaryStatus;
		specialty?: string;
	}) {
		const query = this.database.select().from(emrDictionaryAssets);
		const predicates = [];

		if (filters.dictionaryId) {
			predicates.push(eq(emrDictionaryAssets.dictionaryId, filters.dictionaryId));
		}

		if (filters.kind) {
			predicates.push(eq(emrDictionaryAssets.kind, filters.kind));
		}

		if (filters.status) {
			predicates.push(eq(emrDictionaryAssets.status, filters.status));
		}

		if (filters.specialty) {
			predicates.push(eq(emrDictionaryAssets.specialty, filters.specialty));
		}

		const filteredQuery = predicates.length > 0 ? query.where(and(...predicates)) : query;

		return filteredQuery
			.orderBy(desc(emrDictionaryAssets.updatedAt))
			.then((rows) => rows as EmrDictionaryAssetRecord[]);
	}

	upsertAsset(input: NewEmrDictionaryAsset) {
		return this.database
			.insert(emrDictionaryAssets)
			.values(input)
			.onConflictDoUpdate({
				target: [
					emrDictionaryAssets.dictionaryId,
					emrDictionaryAssets.key,
					emrDictionaryAssets.kind
				],
				set: {
					title: input.title,
					description: input.description,
					specialty: input.specialty,
					tags: input.tags,
					status: input.status,
					version: input.version,
					versionHash: input.versionHash,
					updatedBy: input.updatedBy,
					updatedAt: new Date()
				}
			})
			.returning()
			.then((rows) => rows[0] as EmrDictionaryAssetRecord);
	}

	setAssetStatus(assetId: string, status: EmrDictionaryStatus, updatedBy?: string) {
		return this.database
			.update(emrDictionaryAssets)
			.set({
				status,
				updatedBy,
				updatedAt: new Date()
			})
			.where(eq(emrDictionaryAssets.id, assetId))
			.returning()
			.then((rows) => rows[0] as EmrDictionaryAssetRecord | undefined);
	}

	applyAssetVersionUpdate(
		assetId: string,
		input: {
			version: NewEmrDictionaryAsset['version'];
			versionHash: NewEmrDictionaryAsset['versionHash'];
			status: NewEmrDictionaryAsset['status'];
			publishedBy?: string;
			updatedBy?: string;
		}
	) {
		return this.database
			.update(emrDictionaryAssets)
			.set({
				version: input.version,
				versionHash: input.versionHash,
				status: input.status,
				updatedBy: input.updatedBy,
				publishedBy: input.publishedBy,
				publishedAt: new Date(),
				updatedAt: new Date()
			})
			.where(eq(emrDictionaryAssets.id, assetId))
			.returning()
			.then((rows) => rows[0] as EmrDictionaryAssetRecord | undefined);
	}

	upsertDraft(assetId: string, input: Omit<NewEmrDictionaryAssetDraft, 'assetId'>) {
		return this.database
			.insert(emrDictionaryAssetDrafts)
			.values({
				assetId,
				payloadJson: input.payloadJson,
				versionHash: input.versionHash,
				createdBy: input.createdBy,
				updatedBy: input.updatedBy
			})
			.onConflictDoUpdate({
				target: emrDictionaryAssetDrafts.assetId,
				set: {
					payloadJson: input.payloadJson,
					versionHash: input.versionHash,
					updatedBy: input.updatedBy,
					updatedAt: new Date()
				}
			})
			.returning()
			.then((rows) => rows[0] as EmrDictionaryAssetDraftRecord);
	}

	findDraftByAssetId(assetId: string) {
		return this.database
			.select()
			.from(emrDictionaryAssetDrafts)
			.where(eq(emrDictionaryAssetDrafts.assetId, assetId))
			.limit(1)
			.then((rows) => rows[0] as EmrDictionaryAssetDraftRecord | undefined);
	}

	deleteDraft(assetId: string) {
		return this.database
			.delete(emrDictionaryAssetDrafts)
			.where(eq(emrDictionaryAssetDrafts.assetId, assetId))
			.returning()
			.then((rows) => rows[0] as EmrDictionaryAssetDraftRecord | undefined);
	}

	listVersions(assetId: string, limit = 20) {
		return this.database
			.select()
			.from(emrDictionaryAssetVersions)
			.where(eq(emrDictionaryAssetVersions.assetId, assetId))
			.orderBy(desc(emrDictionaryAssetVersions.version))
			.limit(limit)
			.then((rows) => rows as EmrDictionaryAssetVersionRecord[]);
	}

	findVersionByAssetIdAndVersion(assetId: string, version: number) {
		return this.database
			.select()
			.from(emrDictionaryAssetVersions)
			.where(
				and(
					eq(emrDictionaryAssetVersions.assetId, assetId),
					eq(emrDictionaryAssetVersions.version, version)
				)
			)
			.limit(1)
			.then((rows) => rows[0] as EmrDictionaryAssetVersionRecord | undefined);
	}

	findLatestVersion(assetId: string) {
		return this.database
			.select()
			.from(emrDictionaryAssetVersions)
			.where(eq(emrDictionaryAssetVersions.assetId, assetId))
			.orderBy(desc(emrDictionaryAssetVersions.version))
			.limit(1)
			.then((rows) => rows[0] as EmrDictionaryAssetVersionRecord | undefined);
	}

	createVersion(input: NewEmrDictionaryAssetVersion) {
		return this.database
			.insert(emrDictionaryAssetVersions)
			.values(input)
			.returning()
			.then((rows) => rows[0] as EmrDictionaryAssetVersionRecord);
	}
}
