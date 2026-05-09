import { describe, expect, it, vi } from 'vitest';
import {
	computeEmrDictionaryAssetVersionHash,
	emrDictionaryFieldAssetSchema
} from './emr-dictionary.schemas';
import { EmrDictionaryService } from './emr-dictionary.service';

function baseFieldAsset() {
	return emrDictionaryFieldAssetSchema.parse({
		dictionaryId: 'opd',
		key: 'vision-ucva',
		kind: 'field',
		title: 'Vision UCVA',
		tags: ['vision'],
		payload: {
			id: 'vision-ucva',
			key: 'vision-ucva',
			label: 'Vision UCVA',
			type: 'single_choice',
			order: 0,
			required: true,
			choiceSet: {
				choices: [
					{ value: '6/6', label: '6/6' },
					{ value: '6/9', label: '6/9' }
				]
			}
		}
	});
}

describe('EmrDictionaryService', () => {
	it('saves a new dictionary asset and creates a new draft version', async () => {
		const assetPayload = baseFieldAsset();
		const versionHash = computeEmrDictionaryAssetVersionHash(assetPayload);

		const repository = {
			findAssetByIdentity: vi.fn(async () => undefined),
			findDraftByAssetId: vi.fn(async () => undefined),
			upsertAsset: vi.fn(async (input: Record<string, unknown>) => ({
				id: 'asset-1',
				...input
			})),
			upsertDraft: vi.fn(async () => ({
				id: 'draft-1',
				assetId: 'asset-1',
				versionHash,
				payloadJson: assetPayload
			}))
		};

		const service = new EmrDictionaryService(repository as never);
		const result = await service.saveDraft({ asset: assetPayload, userId: 'user-1' });

		expect(result.versionHash).toBe(versionHash);
		expect(result.createdDraftVersion).toBe(true);
		expect(repository.upsertAsset).toHaveBeenCalled();
		expect(repository.upsertDraft).toHaveBeenCalledWith(
			'asset-1',
			expect.objectContaining({
				versionHash,
				payloadJson: assetPayload.payload
			})
		);
	});

	it('persists openEHR mapping in dictionary draft payload and hash inputs', async () => {
		const assetPayload = baseFieldAsset();
		assetPayload.payload.openEhrMapping = {
			archetypeId: 'openEHR-EHR-EVALUATION.visual_acuity.v1',
			archetypePath: '/data[at0001]'
		};
		const choiceSet = assetPayload.payload.choiceSet;
		expect(choiceSet?.choices?.length).toBeGreaterThanOrEqual(2);
		assetPayload.payload.choiceSet = {
			...choiceSet,
			choices: [
				{
					...choiceSet!.choices![0],
					openEhrMapping: {
						terminologyCode: 'SNOMED-CT::428201005'
					}
				},
				choiceSet!.choices![1]
			]
		};

		const versionHash = computeEmrDictionaryAssetVersionHash(assetPayload);
		const repository = {
			findAssetByIdentity: vi.fn(async () => undefined),
			findDraftByAssetId: vi.fn(async () => undefined),
			upsertAsset: vi.fn(async (input: Record<string, unknown>) => ({
				id: 'asset-1',
				...input
			})),
			upsertDraft: vi.fn(async () => ({
				id: 'draft-1',
				assetId: 'asset-1',
				versionHash,
				payloadJson: assetPayload.payload
			}))
		};

		const service = new EmrDictionaryService(repository as never);
		const result = await service.saveDraft({ asset: assetPayload, userId: 'user-1' });

		expect(result.versionHash).toBe(versionHash);
		expect(repository.upsertDraft).toHaveBeenCalledWith(
			'asset-1',
			expect.objectContaining({
				payloadJson: expect.objectContaining({
					openEhrMapping: {
						archetypeId: 'openEHR-EHR-EVALUATION.visual_acuity.v1',
						archetypePath: '/data[at0001]'
					},
					choiceSet: expect.objectContaining({
						choices: expect.arrayContaining([
							expect.objectContaining({
								openEhrMapping: {
									terminologyCode: 'SNOMED-CT::428201005'
								}
							})
						])
					})
				})
			})
		);
	});

	it('preserves existing status during saves', async () => {
		const assetPayload = baseFieldAsset();
		const versionHash = computeEmrDictionaryAssetVersionHash(assetPayload);
		const repository = {
			findAssetByIdentity: vi.fn(async () => ({
				id: 'asset-1',
				status: 'active',
				version: 4
			})),
			findDraftByAssetId: vi.fn(async () => undefined),
			upsertAsset: vi.fn(async (input: Record<string, unknown>) => ({
				id: 'asset-1',
				...input,
				status: 'active',
				version: 4
			})),
			upsertDraft: vi.fn(async () => ({
				id: 'draft-1',
				assetId: 'asset-1',
				versionHash,
				payloadJson: assetPayload
			}))
		};

		const service = new EmrDictionaryService(repository as never);
		const result = await service.saveDraft({ asset: assetPayload, userId: 'user-1' });

		expect(result.asset.status).toBe('active');
		expect(result.asset.version).toBe(4);
	});

	it('publishes a dictionary draft as immutable next version', async () => {
		const draft = {
			id: 'draft-1',
			assetId: 'asset-1',
			payloadJson: { source: 'draft' },
			versionHash: 'sha256:' + 'a'.repeat(64)
		};
		const existingAsset = {
			id: 'asset-1',
			dictionaryId: 'opd',
			key: 'vision-ucva',
			kind: 'field',
			status: 'draft' as const,
			version: 2,
			versionHash: 'sha256:' + 'b'.repeat(64)
		};
		const createdVersion = {
			id: 'version-1',
			assetId: 'asset-1',
			version: 3,
			versionHash: draft.versionHash
		};

		const repository = {
			findAssetByIdentity: vi.fn(async () => existingAsset),
			findDraftByAssetId: vi.fn(async () => draft),
			findVersionByAssetIdAndVersion: vi.fn(async () => undefined),
			createVersion: vi.fn(async () => createdVersion),
			applyAssetVersionUpdate: vi.fn(async () => ({
				...existingAsset,
				version: 3,
				status: 'active',
				versionHash: draft.versionHash
			})),
			deleteDraft: vi.fn(async () => draft)
		};

		const service = new EmrDictionaryService(repository as never);
		const result = await service.publishDraft({
			dictionaryId: 'opd',
			key: 'vision-ucva',
			kind: 'field',
			userId: 'user-1',
			reason: 'publish'
		});

		expect(repository.createVersion).toHaveBeenCalledWith(
			expect.objectContaining({
				assetId: 'asset-1',
				version: 3,
				versionHash: draft.versionHash
			})
		);
		expect(repository.applyAssetVersionUpdate).toHaveBeenCalledWith('asset-1', {
			version: 3,
			versionHash: draft.versionHash,
			status: 'active',
			publishedBy: 'user-1',
			updatedBy: 'user-1'
		});
		expect(repository.deleteDraft).toHaveBeenCalledWith('asset-1');
		expect(result.version).toMatchObject(createdVersion);
		expect(result.asset.version).toBe(3);
	});

	it('rejects publish when no draft exists', async () => {
		const repository = {
			findAssetByIdentity: vi.fn(async () => ({
				id: 'asset-1',
				version: 1,
				versionHash: 'sha256:' + 'a'.repeat(64)
			})),
			findDraftByAssetId: vi.fn(async () => undefined)
		};

		const service = new EmrDictionaryService(repository as never);
		await expect(
			service.publishDraft({
				dictionaryId: 'opd',
				key: 'vision-ucva',
				kind: 'field',
				userId: 'user-1'
			})
		).rejects.toMatchObject({ code: 'CONFLICT' });
	});

	it('rejects publish when draft is unchanged from latest version', async () => {
		const repository = {
			findAssetByIdentity: vi.fn(async () => ({
				id: 'asset-1',
				version: 2,
				versionHash: 'sha256:' + 'a'.repeat(64)
			})),
			findDraftByAssetId: vi.fn(async () => ({
				id: 'draft-1',
				assetId: 'asset-1',
				versionHash: 'sha256:' + 'a'.repeat(64),
				payloadJson: baseFieldAsset()
			}))
		};

		const service = new EmrDictionaryService(repository as never);
		await expect(
			service.publishDraft({
				dictionaryId: 'opd',
				key: 'vision-ucva',
				kind: 'field',
				userId: 'user-1'
			})
		).rejects.toMatchObject({ code: 'CONFLICT' });
	});

	it('retire returns asset and keeps idempotence for already retired records', async () => {
		const retiredAsset = {
			id: 'asset-1',
			dictionaryId: 'opd',
			key: 'vision-ucva',
			kind: 'field',
			status: 'retired'
		};
		const repository = {
			findAssetByIdentity: vi.fn(async () => retiredAsset),
			setAssetStatus: vi.fn()
		};

		const service = new EmrDictionaryService(repository as never);
		const result = await service.retire({
			dictionaryId: 'opd',
			key: 'vision-ucva',
			kind: 'field',
			userId: 'user-1'
		});

		expect(repository.setAssetStatus).not.toHaveBeenCalled();
		expect(result).toMatchObject(retiredAsset);
	});
});
