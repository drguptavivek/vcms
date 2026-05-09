import type {
	emrDictionaryAssets,
	emrDictionaryAssetDrafts,
	emrDictionaryAssetVersions
} from '$lib/server/db/schema';

export type EmrDictionaryAssetRecord = typeof emrDictionaryAssets.$inferSelect;
export type NewEmrDictionaryAsset = typeof emrDictionaryAssets.$inferInsert;
export type EmrDictionaryAssetDraftRecord = typeof emrDictionaryAssetDrafts.$inferSelect;
export type NewEmrDictionaryAssetDraft = typeof emrDictionaryAssetDrafts.$inferInsert;
export type EmrDictionaryAssetVersionRecord = typeof emrDictionaryAssetVersions.$inferSelect;
export type NewEmrDictionaryAssetVersion = typeof emrDictionaryAssetVersions.$inferInsert;
