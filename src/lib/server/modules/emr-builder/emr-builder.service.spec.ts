import { describe, expect, it, vi } from 'vitest';
import { computeEmrNoteDefinitionVersionHash } from './emr-builder.schemas';
import { EmrBuilderService } from './emr-builder.service';

function baseDefinition() {
	return {
		metadata: {
			definitionId: 'opd-eye-note',
			slug: 'opd-eye-note',
			title: 'OPD Eye Note',
			noteType: 'opd',
			specialty: 'ophthalmology',
			version: 1,
			tags: ['opd', 'eye']
		},
		layout: {
			sections: [
				{
					id: 'vision',
					title: 'Vision',
					order: 0,
					fields: [
						{
							id: 'right-eye-acuity',
							key: 'right-eye-acuity',
							label: 'Right eye acuity',
							type: 'single_choice',
							order: 0,
							required: true,
							choiceSet: {
								choices: [{ value: '6/6', label: '6/6' }]
							},
							analytics: []
						}
					]
				}
			]
		},
		rules: [],
		actions: [],
		analytics: { dimensions: [], measures: [], events: [] }
	};
}

describe('EmrBuilderService', () => {
	it('upserts a definition and creates a new draft when input is first saved', async () => {
		const definitionPayload = baseDefinition();
		const versionHash = computeEmrNoteDefinitionVersionHash(definitionPayload);

		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => undefined),
			findDraftByDefinitionId: vi.fn(async () => undefined),
			upsertDefinition: vi.fn(async (input) => ({
				id: 'definition-1',
				createdBy: 'user-1',
				updatedBy: 'user-1',
				...input
			})),
			upsertDraft: vi.fn(async () => ({
				id: 'draft-1',
				definitionId: 'definition-1',
				versionHash,
				payloadJson: definitionPayload
			}))
		};

		const service = new EmrBuilderService(repository as never);
		const result = await service.saveDraft({ definition: definitionPayload, userId: 'user-1' });

		expect(result.versionHash).toBe(versionHash);
		expect(result.createdDraftVersion).toBe(true);
		expect(repository.findDefinitionByDefinitionId).toHaveBeenCalledWith('opd-eye-note');
		expect(repository.upsertDefinition).toHaveBeenCalledWith(
			expect.objectContaining({
				definitionId: 'opd-eye-note',
				slug: 'opd-eye-note',
				status: 'draft'
			})
		);
		expect(repository.upsertDraft).toHaveBeenCalledWith(
			'definition-1',
			expect.objectContaining({ versionHash, createdBy: 'user-1' })
		);
		expect(result.draft.payloadJson).toMatchObject({
			metadata: { definitionId: 'opd-eye-note' }
		});
	});

	it('fails draft save when the transactional audit record cannot be written', async () => {
		const definitionPayload = baseDefinition();
		const versionHash = computeEmrNoteDefinitionVersionHash(definitionPayload);
		const txRepository = {
			findDefinitionByDefinitionId: vi.fn(async () => undefined),
			findDraftByDefinitionId: vi.fn(async () => undefined),
			upsertDefinition: vi.fn(async (input) => ({
				id: 'definition-1',
				createdBy: 'user-1',
				updatedBy: 'user-1',
				...input
			})),
			upsertDraft: vi.fn(async () => ({
				id: 'draft-1',
				definitionId: 'definition-1',
				versionHash,
				payloadJson: definitionPayload
			})),
			writeAudit: vi.fn(async () => {
				throw new Error('audit store unavailable');
			})
		};
		const repository = {
			transaction: vi.fn(async (operation: (repository: typeof txRepository) => Promise<unknown>) =>
				operation(txRepository)
			)
		};

		const service = new EmrBuilderService(repository as never);

		await expect(
			service.saveDraft({
				definition: definitionPayload,
				userId: 'user-1',
				audit: {
					requestId: 'request-1',
					ipAddress: '127.0.0.1',
					userAgent: 'vitest'
				}
			})
		).rejects.toThrow('audit store unavailable');

		expect(repository.transaction).toHaveBeenCalled();
		expect(txRepository.writeAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: 'request-1',
				actorUserId: 'user-1',
				action: 'emr.builder.manage',
				resourceType: 'emr_definition',
				resourceId: 'definition-1',
				reason: 'save_draft',
				ipAddress: '127.0.0.1',
				userAgent: 'vitest'
			})
		);
	});

	it('reuses an existing draft when hashes are unchanged', async () => {
		const definitionPayload = baseDefinition();
		const versionHash = computeEmrNoteDefinitionVersionHash(definitionPayload);
		const existingDefinition = {
			id: 'definition-1',
			definitionId: 'opd-eye-note',
			slug: 'opd-eye-note',
			title: 'OPD Eye Note',
			noteType: 'opd',
			version: 3,
			versionHash,
			status: 'draft'
		} as const;
		const existingDraft = {
			id: 'draft-1',
			definitionId: 'definition-1',
			versionHash,
			payloadJson: definitionPayload
		} as const;

		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => existingDefinition),
			findDraftByDefinitionId: vi.fn(async () => existingDraft),
			upsertDefinition: vi.fn(async () => ({ ...existingDefinition, updatedBy: 'user-1' })),
			upsertDraft: vi.fn(async () => ({
				...existingDraft,
				updatedBy: 'user-1'
			}))
		};

		const service = new EmrBuilderService(repository as never);
		const result = await service.saveDraft({ definition: definitionPayload, userId: 'user-1' });

		expect(result.createdDraftVersion).toBe(false);
		expect(repository.findDraftByDefinitionId).toHaveBeenCalledWith('definition-1');
	});

	it('publishes a draft into the next immutable version and activates the definition', async () => {
		const definitionPayload = baseDefinition();
		const draftHash = computeEmrNoteDefinitionVersionHash(definitionPayload);
		const definition = {
			id: 'definition-1',
			definitionId: 'opd-eye-note',
			status: 'draft',
			version: 2,
			versionHash: 'sha256:' + 'a'.repeat(64)
		} as const;
		const draft = {
			id: 'draft-1',
			definitionId: 'definition-1',
			payloadJson: definitionPayload,
			versionHash: draftHash
		} as const;
		const createdVersion = {
			id: 'version-1',
			definitionId: 'definition-1',
			version: 3,
			versionHash: draftHash,
			payloadJson: definitionPayload
		} as const;

		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => definition),
			findDraftByDefinitionId: vi.fn(async () => draft),
			findVersionByDefinitionIdAndVersion: vi.fn(async () => undefined),
			createVersion: vi.fn(async () => createdVersion),
			applyDefinitionVersionUpdate: vi.fn(async () => ({
				...definition,
				version: 3,
				status: 'active',
				versionHash: draftHash
			})),
			deleteDraft: vi.fn(async () => draft)
		};

		const service = new EmrBuilderService(repository as never);
		const result = await service.publishDraft({
			definitionId: 'opd-eye-note',
			userId: 'user-1',
			reason: 'initial publish'
		});

		expect(repository.createVersion).toHaveBeenCalledWith(
			expect.objectContaining({
				definitionId: 'definition-1',
				version: 3,
				versionHash: draftHash
			})
		);
		expect(repository.applyDefinitionVersionUpdate).toHaveBeenCalledWith('definition-1', {
			version: 3,
			versionHash: draftHash,
			status: 'active',
			updatedBy: 'user-1'
		});
		expect(repository.deleteDraft).toHaveBeenCalledWith('definition-1');
		expect(result.version).toMatchObject(createdVersion);
		expect(result.definition.version).toBe(3);
		expect(result.definition.status).toBe('active');
	});

	it('fails publish when the transactional audit record cannot be written', async () => {
		const definitionPayload = baseDefinition();
		const draftHash = computeEmrNoteDefinitionVersionHash(definitionPayload);
		const definition = {
			id: 'definition-1',
			definitionId: 'opd-eye-note',
			status: 'draft',
			version: 2,
			versionHash: 'sha256:' + 'a'.repeat(64)
		} as const;
		const draft = {
			id: 'draft-1',
			definitionId: 'definition-1',
			payloadJson: definitionPayload,
			versionHash: draftHash
		} as const;
		const createdVersion = {
			id: 'version-1',
			definitionId: 'definition-1',
			version: 3,
			versionHash: draftHash,
			payloadJson: definitionPayload
		} as const;
		const txRepository = {
			findDefinitionByDefinitionId: vi.fn(async () => definition),
			findDraftByDefinitionId: vi.fn(async () => draft),
			findVersionByDefinitionIdAndVersion: vi.fn(async () => undefined),
			createVersion: vi.fn(async () => createdVersion),
			applyDefinitionVersionUpdate: vi.fn(async () => ({
				...definition,
				version: 3,
				status: 'active',
				versionHash: draftHash
			})),
			deleteDraft: vi.fn(async () => draft),
			writeAudit: vi.fn(async () => {
				throw new Error('audit store unavailable');
			})
		};
		const repository = {
			transaction: vi.fn(async (operation: (repository: typeof txRepository) => Promise<unknown>) =>
				operation(txRepository)
			)
		};

		const service = new EmrBuilderService(repository as never);

		await expect(
			service.publishDraft({
				definitionId: 'opd-eye-note',
				userId: 'user-1',
				reason: 'initial publish',
				audit: {
					requestId: 'request-1',
					ipAddress: '127.0.0.1',
					userAgent: 'vitest'
				}
			})
		).rejects.toThrow('audit store unavailable');

		expect(repository.transaction).toHaveBeenCalled();
		expect(txRepository.writeAudit).toHaveBeenCalledWith(
			expect.objectContaining({
				requestId: 'request-1',
				actorUserId: 'user-1',
				action: 'emr.builder.manage',
				resourceType: 'emr_definition',
				resourceId: 'definition-1',
				reason: 'initial publish',
				ipAddress: '127.0.0.1',
				userAgent: 'vitest'
			})
		);
	});

	it('rejects publish when the draft is unchanged from the latest active version', async () => {
		const existingDefinition = {
			id: 'definition-1',
			definitionId: 'opd-eye-note',
			status: 'active',
			version: 2,
			versionHash: 'sha256:' + 'b'.repeat(64)
		} as const;
		const draft = {
			id: 'draft-1',
			definitionId: 'definition-1',
			versionHash: 'sha256:' + 'b'.repeat(64),
			payloadJson: baseDefinition()
		} as const;

		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => existingDefinition),
			findDraftByDefinitionId: vi.fn(async () => draft)
		};

		const service = new EmrBuilderService(repository as never);
		await expect(
			service.publishDraft({ definitionId: 'opd-eye-note', userId: 'user-1' })
		).rejects.toMatchObject({ code: 'CONFLICT' });
	});

	it('throws not found when listing versions for an unknown definition', async () => {
		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => undefined)
		};

		const service = new EmrBuilderService(repository as never);
		await expect(service.listVersions('missing-definition')).rejects.toMatchObject({
			code: 'NOT_FOUND'
		});
	});

	it('returns a definition when it exists', async () => {
		const definition = {
			id: 'definition-1',
			definitionId: 'opd-eye-note',
			version: 1,
			title: 'OPD Eye Note',
			slug: 'opd-eye-note'
		} as const;

		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => definition)
		};

		const service = new EmrBuilderService(repository as never);
		const result = await service.getDefinition('opd-eye-note');

		expect(repository.findDefinitionByDefinitionId).toHaveBeenCalledWith('opd-eye-note');
		expect(result).toMatchObject(definition);
	});

	it('throws not found when getting a missing definition', async () => {
		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => undefined)
		};

		const service = new EmrBuilderService(repository as never);
		await expect(service.getDefinition('missing-definition')).rejects.toMatchObject({
			code: 'NOT_FOUND'
		});
	});

	it('returns definition and latest draft record when requesting draft', async () => {
		const definition = {
			id: 'definition-1',
			definitionId: 'opd-eye-note',
			version: 1,
			title: 'OPD Eye Note',
			slug: 'opd-eye-note'
		} as const;
		const draft = {
			id: 'draft-1',
			definitionId: 'definition-1',
			versionHash: 'sha256:' + 'a'.repeat(64),
			payloadJson: baseDefinition()
		} as const;

		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => definition),
			findDraftByDefinitionId: vi.fn(async () => draft)
		};

		const service = new EmrBuilderService(repository as never);
		const result = await service.getDraft('opd-eye-note');

		expect(result).toMatchObject({
			definition,
			draft
		});
	});

	it('returns an empty draft when definition has no draft saved', async () => {
		const definition = {
			id: 'definition-1',
			definitionId: 'opd-eye-note',
			version: 1,
			title: 'OPD Eye Note',
			slug: 'opd-eye-note'
		} as const;

		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => definition),
			findDraftByDefinitionId: vi.fn(async () => undefined)
		};

		const service = new EmrBuilderService(repository as never);
		const result = await service.getDraft('opd-eye-note');

		expect(result.definition).toMatchObject(definition);
		expect(result.draft).toBeUndefined();
	});

	it('lists active definitions for mobile sync with cache metadata', async () => {
		const updatedAt = new Date('2026-05-09T10:00:00.000Z');
		const repository = {
			listActiveDefinitions: vi.fn(
				async () =>
					[
						{
							id: 'definition-1',
							definitionId: 'opd-eye-note',
							slug: 'opd-eye-note',
							title: 'OPD Eye Note',
							noteType: 'opd',
							specialty: 'ophthalmology',
							status: 'active',
							version: 3,
							versionHash: 'sha256:' + '1'.repeat(64),
							locale: 'en-IN',
							tags: ['opd', 'eye'],
							ownerTeam: 'ophthalmology',
							updatedAt
						}
					] as never
			)
		};

		const service = new EmrBuilderService(
			repository as never,
			{
				renderDefinitionModel: vi.fn()
			} as never
		);
		const result = await service.listActiveDefinitionsForMobile();

		expect(repository.listActiveDefinitions).toHaveBeenCalled();
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			definitionId: 'opd-eye-note',
			version: 3,
			updatedAt: updatedAt.toISOString(),
			cache: {
				etag: 'W/"opd-eye-note:sha256:' + '1'.repeat(64) + '"',
				cacheKey: expect.stringContaining('opd-eye-note:v3:sha256:'),
				maxAgeSeconds: 900
			}
		});
	});

	it('returns a rendered definition model and cache metadata for active mobile consumers', async () => {
		const publishedAt = new Date('2026-05-09T10:00:00.000Z');
		const rendererService = {
			renderDefinitionModel: vi.fn(() => ({
				definitionId: 'opd-eye-note',
				slug: 'opd-eye-note',
				title: 'OPD Eye Note',
				noteType: 'opd',
				version: 3,
				locale: 'en-IN',
				tags: ['opd'],
				status: 'active',
				effectiveFrom: undefined,
				effectiveUntil: undefined,
				sections: [],
				rules: [],
				actions: [],
				analytics: {}
			}))
		};

		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => ({
				id: 'definition-1',
				definitionId: 'opd-eye-note',
				slug: 'opd-eye-note',
				title: 'OPD Eye Note',
				noteType: 'opd',
				specialty: 'ophthalmology',
				status: 'active',
				version: 3,
				versionHash: 'sha256:' + '2'.repeat(64),
				locale: 'en-IN',
				ownerTeam: 'ophthalmology',
				updatedAt: new Date('2026-05-09T11:00:00.000Z'),
				tags: ['opd']
			})),
			findLatestVersion: vi.fn(async () => ({
				id: 'version-1',
				version: 3,
				versionHash: 'sha256:' + '2'.repeat(64),
				payloadJson: {
					metadata: {
						definitionId: 'opd-eye-note',
						slug: 'opd-eye-note',
						title: 'OPD Eye Note',
						noteType: 'opd',
						version: 3,
						status: 'active',
						locale: 'en-IN',
						tags: ['opd']
					},
					layout: { sections: [] },
					rules: [],
					actions: [],
					analytics: {}
				},
				publishedAt
			}))
		} as never;

		const service = new EmrBuilderService(repository as never, rendererService as never);
		const result = await service.getPublishedDefinitionModelForMobile('opd-eye-note');

		expect(result.version).toBe(3);
		expect(result.cache.versionHash).toBe('sha256:' + '2'.repeat(64));
		expect(result.cache.etag).toBe('W/"opd-eye-note:sha256:' + '2'.repeat(64) + '"');
		expect(result.renderModel).toMatchObject({
			definitionId: 'opd-eye-note'
		});
		expect(rendererService.renderDefinitionModel).toHaveBeenCalled();
	});

	it('rejects mobile definition sync for non-active definitions', async () => {
		const repository = {
			findDefinitionByDefinitionId: vi.fn(async () => ({
				id: 'definition-1',
				definitionId: 'opd-eye-note',
				status: 'draft'
			}))
		} as never;

		const service = new EmrBuilderService(repository, {
			renderDefinitionModel: vi.fn()
		} as never);

		await expect(
			service.getPublishedDefinitionModelForMobile('opd-eye-note')
		).rejects.toMatchObject({
			code: 'NOT_FOUND'
		});
	});
});
