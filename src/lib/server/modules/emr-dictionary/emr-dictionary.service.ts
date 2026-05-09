import { conflict, notFound } from '$lib/server/observability/errors';
import {
	computeEmrDictionaryAssetVersionHash,
	parseEmrDictionaryAsset,
	parseEmrDictionaryAssetIdentity,
	type EmrDictionaryAssetSaveInput,
	type EmrDictionaryAssetIdentity,
	type EmrDictionaryListQuery,
	type EmrDictionaryStatus
} from './emr-dictionary.schemas';
import { EmrDictionaryRepository } from './emr-dictionary.repository';
import type {
	EmrDictionaryAssetDraftRecord,
	EmrDictionaryAssetRecord,
	EmrDictionaryAssetVersionRecord
} from './emr-dictionary.types';

type SaveDraftInput = {
	asset: unknown;
	userId?: string;
};

type PublishInput = EmrDictionaryAssetIdentity & {
	userId: string;
	reason?: string;
};

type RetireInput = EmrDictionaryAssetIdentity & {
	userId: string;
	reason?: string;
};

export type EmrDictionarySaveDraftResult = {
	asset: EmrDictionaryAssetRecord;
	draft: EmrDictionaryAssetDraftRecord;
	versionHash: string;
	createdDraftVersion: boolean;
};

export type EmrDictionaryPublishResult = {
	asset: EmrDictionaryAssetRecord;
	version: EmrDictionaryAssetVersionRecord;
};

export type EmrDictionaryListResult = EmrDictionaryAssetRecord[];

export class EmrDictionaryService {
	constructor(
		private readonly repository: EmrDictionaryRepository = new EmrDictionaryRepository()
	) {}

	async saveDraft(input: SaveDraftInput): Promise<EmrDictionarySaveDraftResult> {
		const parsed = parseEmrDictionaryAsset(input.asset);
		const versionHash = computeEmrDictionaryAssetVersionHash(parsed);

		const existingAsset = await this.repository.findAssetByIdentity(
			parsed.dictionaryId,
			parsed.key,
			parsed.kind
		);
		const asset = await this.repository.upsertAsset(
			this.buildAssetRecord(parsed, versionHash, input.userId, existingAsset)
		);

		const existingDraft = await this.repository.findDraftByAssetId(asset.id);
		const draft = await this.repository.upsertDraft(asset.id, {
			payloadJson: parsed.payload,
			versionHash,
			createdBy: input.userId,
			updatedBy: input.userId
		});

		return {
			asset,
			draft,
			versionHash,
			createdDraftVersion: !existingDraft
		};
	}

	async publishDraft(input: PublishInput): Promise<EmrDictionaryPublishResult> {
		const asset = await this.repository.findAssetByIdentity(
			input.dictionaryId,
			input.key,
			input.kind
		);

		if (!asset) throw notFound('Dictionary asset not found.');

		const draft = await this.repository.findDraftByAssetId(asset.id);
		if (!draft) throw conflict('No draft exists for this dictionary asset.');

		if (asset.versionHash === draft.versionHash && asset.version > 0) {
			throw conflict('No changes detected for publish.', {
				dictionaryId: input.dictionaryId,
				key: input.key,
				kind: input.kind
			});
		}

		const nextVersion = asset.version + 1;
		if (await this.repository.findVersionByAssetIdAndVersion(asset.id, nextVersion)) {
			throw conflict('Version already exists for this dictionary asset.', {
				dictionaryId: input.dictionaryId,
				key: input.key,
				kind: input.kind,
				version: nextVersion
			});
		}

		const version = await this.repository.createVersion({
			assetId: asset.id,
			version: nextVersion,
			versionHash: draft.versionHash,
			changeType: 'publish',
			payloadJson: draft.payloadJson,
			publishedBy: input.userId,
			reason: input.reason ?? ''
		});

		const updatedAsset = await this.repository.applyAssetVersionUpdate(asset.id, {
			version: nextVersion,
			versionHash: draft.versionHash,
			status: 'active',
			publishedBy: input.userId,
			updatedBy: input.userId
		});

		if (!updatedAsset) {
			throw notFound('Dictionary asset not found during publish update.');
		}

		await this.repository.deleteDraft(asset.id);

		return {
			asset: updatedAsset,
			version
		};
	}

	getAsset(input: EmrDictionaryAssetIdentity) {
		const parsed = parseEmrDictionaryAssetIdentity(input);

		return this.repository
			.findAssetByIdentity(parsed.dictionaryId, parsed.key, parsed.kind)
			.then((asset) => {
				if (!asset) {
					throw notFound('Dictionary asset not found.');
				}

				return asset;
			});
	}

	listAssets(query: EmrDictionaryListQuery) {
		return this.repository.listAssets(query);
	}

	async retire(input: RetireInput): Promise<EmrDictionaryAssetRecord> {
		const parsed = parseEmrDictionaryAssetIdentity(input);

		const asset = await this.repository.findAssetByIdentity(
			parsed.dictionaryId,
			input.key,
			input.kind
		);
		if (!asset) throw notFound('Dictionary asset not found.');

		if (asset.status === 'retired') {
			return asset;
		}

		const retired = await this.repository.setAssetStatus(asset.id, 'retired', input.userId);
		if (!retired) throw notFound('Dictionary asset not found during retire update.');

		return retired;
	}

	getVersions(input: EmrDictionaryAssetIdentity) {
		const parsed = parseEmrDictionaryAssetIdentity(input);

		return this.repository
			.findAssetByIdentity(parsed.dictionaryId, parsed.key, parsed.kind)
			.then((asset) => {
				if (!asset) {
					throw notFound('Dictionary asset not found.');
				}
				return this.repository.listVersions(asset.id);
			});
	}

	private buildAssetRecord(
		parsed: EmrDictionaryAssetSaveInput,
		versionHash: string,
		userId: string | undefined,
		existingAsset: EmrDictionaryAssetRecord | undefined
	) {
		return {
			dictionaryId: parsed.dictionaryId,
			key: parsed.key,
			kind: parsed.kind,
			title: parsed.title,
			description: parsed.description ?? null,
			specialty: parsed.specialty,
			tags: parsed.tags,
			status: (existingAsset?.status ?? 'draft') as EmrDictionaryStatus,
			version: existingAsset?.version ?? 0,
			versionHash,
			createdBy: existingAsset?.createdBy ?? userId,
			updatedBy: userId
		};
	}
}

export const emrDictionaryService = new EmrDictionaryService();
