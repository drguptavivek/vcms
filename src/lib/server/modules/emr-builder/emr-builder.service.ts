import { computeEmrNoteDefinitionVersionHash, parseEmrNoteDefinition } from './emr-builder.schemas';
import { conflict, notFound } from '$lib/server/observability/errors';
import type { AuditInput } from '$lib/server/observability/audit';
import { EmrBuilderRepository } from './emr-builder.repository';
import type { EmrRenderModel } from '../emr-renderer/emr-renderer.types';
import { EmrRendererService } from '../emr-renderer/emr-renderer.service';
import type { EmrNoteDefinitionRecord, EmrNoteDefinitionVersionRecord } from './emr-builder.types';

type SaveDraftInput = {
	definition: unknown;
	userId?: string;
	audit?: Pick<AuditInput, 'requestId' | 'ipAddress' | 'userAgent'>;
};

type PublishInput = {
	definitionId: string;
	userId: string;
	reason?: string;
	audit?: Pick<AuditInput, 'requestId' | 'ipAddress' | 'userAgent'>;
};

type MetadataSnapshot = ReturnType<typeof parseEmrNoteDefinition>;

export type EmrBuilderSaveDraftResult = {
	definition: EmrNoteDefinitionRecord;
	draft: Awaited<ReturnType<EmrBuilderRepository['upsertDraft']>>;
	versionHash: string;
	createdDraftVersion: boolean;
};

export type EmrBuilderPublishResult = {
	definition: EmrNoteDefinitionRecord;
	version: EmrNoteDefinitionVersionRecord;
};

export type EmrBuilderDraftResult = {
	definition: EmrNoteDefinitionRecord;
	draft: Awaited<ReturnType<EmrBuilderRepository['findDraftByDefinitionId']>>;
};

export type EmrMobileDefinitionCacheMetadata = {
	versionHash: string;
	cacheKey: string;
	etag: string;
	updatedAt: string;
	publishedAt: string;
	maxAgeSeconds: number;
};

export type EmrMobileDefinitionManifestItem = Pick<
	EmrNoteDefinitionRecord,
	| 'definitionId'
	| 'slug'
	| 'title'
	| 'noteType'
	| 'specialty'
	| 'version'
	| 'locale'
	| 'tags'
	| 'ownerTeam'
> & {
	updatedAt: string;
	cache: EmrMobileDefinitionCacheMetadata;
};

export type EmrMobileDefinitionModelResult = {
	definitionId: string;
	version: number;
	cache: EmrMobileDefinitionCacheMetadata;
	renderModel: EmrRenderModel;
};

export class EmrBuilderService {
	private readonly rendererService: EmrRendererService;

	constructor(
		private readonly repository: EmrBuilderRepository = new EmrBuilderRepository(),
		rendererService?: EmrRendererService
	) {
		this.rendererService = rendererService ?? new EmrRendererService(this.repository);
	}

	async saveDraft(input: SaveDraftInput): Promise<EmrBuilderSaveDraftResult> {
		const parsed = parseEmrNoteDefinition(input.definition);
		const versionHash = computeEmrNoteDefinitionVersionHash(parsed);

		return this.withTransaction(async (repository) => {
			const existingDefinition = await repository.findDefinitionByDefinitionId(
				parsed.metadata.definitionId
			);
			const definition = await repository.upsertDefinition(
				this.buildDefinitionRecord(parsed, versionHash, input.userId, existingDefinition)
			);

			const existingDraft = await repository.findDraftByDefinitionId(definition.id);
			const draft = await repository.upsertDraft(definition.id, {
				payloadJson: parsed,
				versionHash,
				createdBy: input.userId,
				updatedBy: input.userId
			});

			const result = {
				definition,
				draft,
				versionHash,
				createdDraftVersion: !existingDraft
			};

			if (input.audit) {
				await repository.writeAudit({
					requestId: input.audit.requestId,
					actorUserId: input.userId,
					action: 'emr.builder.manage',
					resourceType: 'emr_definition',
					resourceId: definition.id,
					reason: 'save_draft',
					before: {
						definitionId: parsed.metadata.definitionId,
						existingVersion: existingDefinition?.version ?? 0,
						existingDraftHash: existingDraft?.versionHash ?? null
					},
					after: {
						definitionId: definition.definitionId,
						definitionVersion: definition.version,
						draftVersionHash: versionHash,
						createdDraftVersion: result.createdDraftVersion
					},
					ipAddress: input.audit.ipAddress,
					userAgent: input.audit.userAgent
				});
			}

			return result;
		});
	}

	async publishDraft(input: PublishInput): Promise<EmrBuilderPublishResult> {
		return this.withTransaction(async (repository) => {
			const definition = await repository.findDefinitionByDefinitionId(input.definitionId);
			if (!definition) {
				throw notFound('Definition not found.');
			}

			const draft = await repository.findDraftByDefinitionId(definition.id);
			if (!draft) {
				throw conflict('No draft exists for this definition.');
			}

			if (definition.versionHash === draft.versionHash && definition.version > 0) {
				throw conflict('No changes detected for publish.', {
					definitionId: input.definitionId,
					version: definition.version
				});
			}

			const parsed = parseEmrNoteDefinition(draft.payloadJson);
			const nextVersion = definition.version + 1;

			if (await repository.findVersionByDefinitionIdAndVersion(definition.id, nextVersion)) {
				throw conflict('Version already exists for this definition.', {
					definitionId: input.definitionId,
					version: nextVersion
				});
			}

			const version = await repository.createVersion({
				definitionId: definition.id,
				version: nextVersion,
				versionHash: draft.versionHash,
				changeType: 'publish',
				payloadJson: parsed,
				publishedBy: input.userId,
				reason: input.reason ?? ''
			});

			const updatedDefinition = await repository.applyDefinitionVersionUpdate(definition.id, {
				version: nextVersion,
				versionHash: draft.versionHash,
				status: 'active',
				updatedBy: input.userId
			});

			if (!updatedDefinition) {
				throw notFound('Definition not found during publish update.');
			}

			await repository.deleteDraft(definition.id);

			const result = {
				definition: updatedDefinition,
				version
			};

			if (input.audit) {
				await repository.writeAudit({
					requestId: input.audit.requestId,
					actorUserId: input.userId,
					action: 'emr.builder.manage',
					resourceType: 'emr_definition',
					resourceId: updatedDefinition.id,
					reason: input.reason ?? 'publish_draft',
					before: {
						definitionId: input.definitionId,
						previousVersion: definition.version,
						publishedVersion: version.version
					},
					after: {
						definitionId: updatedDefinition.definitionId,
						version: updatedDefinition.version,
						status: updatedDefinition.status
					},
					ipAddress: input.audit.ipAddress,
					userAgent: input.audit.userAgent
				});
			}

			return result;
		});
	}

	listVersions(definitionId: string) {
		return this.repository.findDefinitionByDefinitionId(definitionId).then((definition) => {
			if (!definition) {
				throw notFound('Definition not found.');
			}
			return this.repository.listVersions(definition.id);
		});
	}

	getDefinition(definitionId: string) {
		return this.repository.findDefinitionByDefinitionId(definitionId).then((definition) => {
			if (!definition) {
				throw notFound('Definition not found.');
			}
			return definition;
		});
	}

	listActiveDefinitionsForMobile(): Promise<EmrMobileDefinitionManifestItem[]> {
		return this.repository.listActiveDefinitions().then((definitions) =>
			definitions.map((definition) => ({
				definitionId: definition.definitionId,
				slug: definition.slug,
				title: definition.title,
				noteType: definition.noteType,
				specialty: definition.specialty,
				version: definition.version,
				locale: definition.locale,
				tags: definition.tags as string[],
				ownerTeam: definition.ownerTeam,
				updatedAt: definition.updatedAt.toISOString(),
				cache: this.buildCacheMetadata({
					definitionId: definition.definitionId,
					versionHash: definition.versionHash,
					version: definition.version,
					updatedAt: definition.updatedAt
				})
			}))
		);
	}

	async getPublishedDefinitionModelForMobile(
		definitionId: string
	): Promise<EmrMobileDefinitionModelResult> {
		const definition = await this.repository.findDefinitionByDefinitionId(definitionId);
		if (!definition || definition.status !== 'active') {
			throw notFound('Published EMR definition not found.');
		}

		const version = await this.repository.findLatestVersion(definition.id);
		if (!version) {
			throw notFound('No published EMR definition version found.');
		}

		return {
			definitionId: definition.definitionId,
			version: version.version,
			cache: this.buildCacheMetadata({
				definitionId: definition.definitionId,
				versionHash: version.versionHash,
				version: version.version,
				updatedAt: definition.updatedAt,
				publishedAt: version.publishedAt
			}),
			renderModel: this.rendererService.renderDefinitionModel({
				definition: version.payloadJson
			})
		};
	}

	listDefinitionsForBuilder() {
		return this.repository.listDefinitions();
	}

	async getDraft(definitionId: string): Promise<EmrBuilderDraftResult> {
		const definition = await this.repository.findDefinitionByDefinitionId(definitionId);
		if (!definition) {
			throw notFound('Definition not found.');
		}
		const draft = await this.repository.findDraftByDefinitionId(definition.id);
		return { definition, draft };
	}

	private buildDefinitionRecord(
		parsed: MetadataSnapshot,
		versionHash: string,
		userId: string | undefined,
		existingDefinition: EmrNoteDefinitionRecord | undefined
	) {
		return {
			definitionId: parsed.metadata.definitionId,
			slug: parsed.metadata.slug,
			title: parsed.metadata.title,
			noteType: parsed.metadata.noteType,
			specialty: parsed.metadata.specialty,
			status: parsed.metadata.status,
			version: existingDefinition?.version ?? 0,
			versionHash,
			locale: parsed.metadata.locale,
			tags: parsed.metadata.tags,
			ownerTeam: parsed.metadata.ownerTeam,
			effectiveFrom: parsed.metadata.effectiveFrom
				? new Date(parsed.metadata.effectiveFrom)
				: (existingDefinition?.effectiveFrom ?? null),
			effectiveUntil: parsed.metadata.effectiveUntil
				? new Date(parsed.metadata.effectiveUntil)
				: (existingDefinition?.effectiveUntil ?? null),
			createdBy: existingDefinition?.createdBy ?? userId,
			updatedBy: userId
		};
	}

	private withTransaction<T>(operation: (repository: EmrBuilderRepository) => Promise<T>) {
		const repository = this.repository as EmrBuilderRepository & {
			transaction?: (callback: (repository: EmrBuilderRepository) => Promise<T>) => Promise<T>;
		};

		return repository.transaction ? repository.transaction(operation) : operation(this.repository);
	}

	private buildCacheMetadata(input: {
		definitionId: string;
		versionHash: string;
		version: number;
		updatedAt: Date;
		publishedAt?: Date;
	}): EmrMobileDefinitionCacheMetadata {
		return {
			versionHash: input.versionHash,
			cacheKey: `${input.definitionId}:v${input.version}:${input.versionHash.slice(0, 16)}`,
			etag: `W/"${input.definitionId}:${input.versionHash}"`,
			updatedAt: input.updatedAt.toISOString(),
			publishedAt: (input.publishedAt ?? input.updatedAt).toISOString(),
			maxAgeSeconds: 900
		};
	}
}

export const emrBuilderService = new EmrBuilderService();
