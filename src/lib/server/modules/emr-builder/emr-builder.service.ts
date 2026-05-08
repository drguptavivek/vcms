import { computeEmrNoteDefinitionVersionHash, parseEmrNoteDefinition } from './emr-builder.schemas';
import { conflict, notFound } from '$lib/server/observability/errors';
import { EmrBuilderRepository } from './emr-builder.repository';
import type { EmrNoteDefinitionRecord, EmrNoteDefinitionVersionRecord } from './emr-builder.types';

type SaveDraftInput = {
	definition: unknown;
	userId?: string;
};

type PublishInput = {
	definitionId: string;
	userId: string;
	reason?: string;
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

export class EmrBuilderService {
	constructor(private readonly repository: EmrBuilderRepository = new EmrBuilderRepository()) {}

	async saveDraft(input: SaveDraftInput): Promise<EmrBuilderSaveDraftResult> {
		const parsed = parseEmrNoteDefinition(input.definition);
		const versionHash = computeEmrNoteDefinitionVersionHash(parsed);

		const existingDefinition = await this.repository.findDefinitionByDefinitionId(
			parsed.metadata.definitionId
		);
		const definition = await this.repository.upsertDefinition(
			this.buildDefinitionRecord(parsed, versionHash, input.userId, existingDefinition)
		);

		const existingDraft = await this.repository.findDraftByDefinitionId(definition.id);
		const draft = await this.repository.upsertDraft(definition.id, {
			payloadJson: parsed,
			versionHash,
			createdBy: input.userId,
			updatedBy: input.userId
		});

		return {
			definition,
			draft,
			versionHash,
			createdDraftVersion: !existingDraft
		};
	}

	async publishDraft(input: PublishInput): Promise<EmrBuilderPublishResult> {
		const definition = await this.repository.findDefinitionByDefinitionId(input.definitionId);
		if (!definition) {
			throw notFound('Definition not found.');
		}

		const draft = await this.repository.findDraftByDefinitionId(definition.id);
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

		if (await this.repository.findVersionByDefinitionIdAndVersion(definition.id, nextVersion)) {
			throw conflict('Version already exists for this definition.', {
				definitionId: input.definitionId,
				version: nextVersion
			});
		}

		const version = await this.repository.createVersion({
			definitionId: definition.id,
			version: nextVersion,
			versionHash: draft.versionHash,
			changeType: 'publish',
			payloadJson: parsed,
			publishedBy: input.userId,
			reason: input.reason ?? ''
		});

		const updatedDefinition = await this.repository.applyDefinitionVersionUpdate(definition.id, {
			version: nextVersion,
			versionHash: draft.versionHash,
			status: 'active',
			updatedBy: input.userId
		});

		if (!updatedDefinition) {
			throw notFound('Definition not found during publish update.');
		}

		await this.repository.deleteDraft(definition.id);

		return {
			definition: updatedDefinition,
			version
		};
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
}

export const emrBuilderService = new EmrBuilderService();
