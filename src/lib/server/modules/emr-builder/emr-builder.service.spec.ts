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
});
