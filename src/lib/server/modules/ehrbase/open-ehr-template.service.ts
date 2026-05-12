import { AppError, notFound } from '$lib/server/observability/errors';
import { ehrbaseClient, type EhrbaseClient } from './ehrbase.client';
import { OpenEhrTemplateRepository } from './open-ehr-template.repository';
import {
	computeOpenEhrTemplateHash,
	computeOpenEhrWebTemplateHash,
	parseOpenEhrTemplateSync
} from './open-ehr-template.schemas';
import type { EhrbaseTemplateMetadata, EhrbaseWebTemplate } from './ehrbase.types';
import type {
	OpenEhrTemplateRecord,
	OpenEhrWebTemplateCacheRecord
} from './open-ehr-template.types';
import type { OpenEhrTemplateListQuery } from './open-ehr-template.schemas';

type SyncTemplateInput = {
	templateId: string;
	operationalTemplateXml?: string;
	userId?: string;
};

export type OpenEhrTemplateSyncResult = {
	template: OpenEhrTemplateRecord;
	webTemplateCache: OpenEhrWebTemplateCacheRecord;
	webTemplate: EhrbaseWebTemplate;
};

export type OpenEhrRuntimeManifestField = {
	id: string;
	label: string;
	rmType?: string;
	nodeId?: string;
	aqlPath?: string;
	baseFlatPath: string;
	inputs: Array<{
		suffix: string;
		type?: string;
		flatPath: string;
		terminology?: string;
		listOpen?: boolean;
		defaultValue?: string;
		validation?: unknown;
		options?: Array<{
			value?: string;
			label?: string;
			ordinal?: number;
			termBindings?: Record<string, { value?: string; terminologyId?: string }>;
		}>;
	}>;
	required: boolean;
	repeating: boolean;
	inContext: boolean;
	ancestorPath: string[];
	termBindings?: Record<string, { value?: string; terminologyId?: string }>;
};

export type OpenEhrRuntimeManifestSection = {
	id: string;
	label: string;
	rmType?: string;
	nodeId?: string;
	aqlPath?: string;
	baseFlatPath: string;
	required: boolean;
	repeating: boolean;
	ancestorPath: string[];
};

export type OpenEhrRuntimeManifest = {
	templateId: string;
	cdrTemplateId: string;
	webTemplateHash: string;
	rootId: string;
	defaultLanguage?: string;
	languages: string[];
	fields: OpenEhrRuntimeManifestField[];
	sections: OpenEhrRuntimeManifestSection[];
};

export class OpenEhrTemplateService {
	constructor(
		private readonly repository: OpenEhrTemplateRepository = new OpenEhrTemplateRepository(),
		private readonly client: EhrbaseClient = ehrbaseClient
	) {}

	listLocalTemplates(query: OpenEhrTemplateListQuery) {
		return this.repository.listTemplates(query);
	}

	async uploadAndCacheAdl14Template(input: {
		operationalTemplateXml: string;
		userId?: string;
	}): Promise<OpenEhrTemplateSyncResult> {
		const upload = await this.client.uploadOperationalTemplate(input.operationalTemplateXml);
		return this.syncTemplateFromCdr({
			templateId: upload.templateId,
			operationalTemplateXml: input.operationalTemplateXml,
			userId: input.userId
		});
	}

	async syncTemplateFromCdr(input: SyncTemplateInput): Promise<OpenEhrTemplateSyncResult> {
		const parsed = parseOpenEhrTemplateSync(input);
		const [templates, webTemplate] = await Promise.all([
			this.client.listTemplates(),
			this.client.getWebTemplate(parsed.templateId)
		]);
		const metadata = this.findTemplateMetadata(templates, parsed.templateId);
		if (!metadata) {
			throw notFound('openEHR template is not registered in the clinical data repository.');
		}

		const webTemplateHash = computeOpenEhrWebTemplateHash(webTemplate);
		const operationalTemplateHash = parsed.operationalTemplateXml
			? computeOpenEhrTemplateHash(parsed.operationalTemplateXml)
			: undefined;

		const template = await this.repository.upsertTemplate({
			templateId: parsed.templateId,
			cdrTemplateId: metadata.template_id,
			concept: metadata.concept,
			archetypeId: metadata.archetype_id,
			format: 'ADL1.4',
			status: 'uploaded',
			operationalTemplateHash,
			webTemplateHash,
			webTemplateRootId: webTemplate.tree.id,
			metadata,
			uploadedBy: parsed.userId
		});

		const webTemplateCache = await this.repository.upsertWebTemplateCache({
			templateId: template.id,
			cdrTemplateId: metadata.template_id,
			webTemplateHash,
			webTemplateJson: webTemplate,
			fetchedBy: parsed.userId
		});

		return {
			template,
			webTemplateCache,
			webTemplate
		};
	}

	async getRuntimeManifest(templateId: string): Promise<OpenEhrRuntimeManifest> {
		const template = await this.repository.findTemplateByTemplateId(templateId);
		if (!template) {
			throw notFound('openEHR template is not registered locally.');
		}

		const cache = await this.repository.findWebTemplateCacheByTemplateId(template.id);
		if (!cache) {
			throw notFound('Web Template is not cached locally for this openEHR template.');
		}

		const webTemplate = cache.webTemplateJson as EhrbaseWebTemplate;
		if (!webTemplate.tree?.id) {
			throw new AppError('OPEN_EHR_WEB_TEMPLATE_INVALID', 'Cached Web Template is invalid.', 500, {
				templateId
			});
		}

		return buildRuntimeManifest(template, cache, webTemplate);
	}

	private findTemplateMetadata(templates: EhrbaseTemplateMetadata[], templateId: string) {
		const metadata = templates.find((template) => template.template_id === templateId);
		if (metadata) return metadata;

		const byConcept = templates.find((template) => template.concept === templateId);
		if (byConcept) return byConcept;

		throw new AppError(
			'EHRBASE_TEMPLATE_NOT_FOUND',
			'Clinical data repository does not list the requested template.',
			404,
			{ templateId }
		);
	}
}

export const openEhrTemplateService = new OpenEhrTemplateService();

function buildRuntimeManifest(
	template: OpenEhrTemplateRecord,
	cache: OpenEhrWebTemplateCacheRecord,
	webTemplate: EhrbaseWebTemplate
): OpenEhrRuntimeManifest {
	const fields: OpenEhrRuntimeManifestField[] = [];
	const sections: OpenEhrRuntimeManifestSection[] = [];

	walkWebTemplateNode({
		node: webTemplate.tree,
		flatSegments: [],
		ancestorPath: [],
		hasRepeatingAncestor: false,
		fields,
		sections
	});

	return {
		templateId: template.templateId,
		cdrTemplateId: template.cdrTemplateId,
		webTemplateHash: cache.webTemplateHash,
		rootId: webTemplate.tree.id,
		defaultLanguage: webTemplate.defaultLanguage,
		languages: webTemplate.languages ?? [],
		fields,
		sections
	};
}

function walkWebTemplateNode(input: {
	node: EhrbaseWebTemplate['tree'];
	flatSegments: string[];
	ancestorPath: string[];
	hasRepeatingAncestor: boolean;
	fields: OpenEhrRuntimeManifestField[];
	sections: OpenEhrRuntimeManifestSection[];
}) {
	const repeating = input.node.max === -1;
	const segment = input.flatSegments.length === 0 ? input.node.id : flatSegment(input.node);
	const flatSegments = [...input.flatSegments, segment];
	const ancestorPath = [...input.ancestorPath, input.node.id];
	const baseFlatPath = flatSegments.join('/');
	const hasRepeating = input.hasRepeatingAncestor || repeating;
	const required = (input.node.min ?? 0) > 0;
	const label = input.node.localizedName || input.node.name || input.node.id;

	if (isSectionLike(input.node.rmType)) {
		input.sections.push({
			id: input.node.id,
			label,
			rmType: input.node.rmType,
			nodeId: input.node.nodeId,
			aqlPath: input.node.aqlPath,
			baseFlatPath,
			required,
			repeating: hasRepeating,
			ancestorPath
		});
	}

	if ((input.node.inputs?.length ?? 0) > 0) {
		input.fields.push({
			id: input.node.id,
			label,
			rmType: input.node.rmType,
			nodeId: input.node.nodeId,
			aqlPath: input.node.aqlPath,
			baseFlatPath,
			inputs: (input.node.inputs ?? []).map((entry) => ({
				suffix: entry.suffix ?? '',
				type: entry.type,
				flatPath: flatInputPath(baseFlatPath, entry.suffix ?? ''),
				terminology: entry.terminology,
				listOpen: entry.listOpen,
				defaultValue: entry.defaultValue,
				validation: entry.validation,
				options: entry.list
			})),
			required,
			repeating: hasRepeating,
			inContext: input.node.inContext ?? false,
			ancestorPath,
			termBindings: input.node.termBindings
		});
	}

	for (const child of input.node.children ?? []) {
		walkWebTemplateNode({
			node: child,
			flatSegments,
			ancestorPath,
			hasRepeatingAncestor: hasRepeating,
			fields: input.fields,
			sections: input.sections
		});
	}
}

function isSectionLike(rmType: string | undefined) {
	return (
		rmType === 'COMPOSITION' ||
		rmType === 'SECTION' ||
		rmType === 'OBSERVATION' ||
		rmType === 'EVALUATION' ||
		rmType === 'INSTRUCTION' ||
		rmType === 'ACTION' ||
		rmType === 'CLUSTER'
	);
}

function flatSegment(node: EhrbaseWebTemplate['tree']) {
	return node.max === -1 ? `${node.id}:0` : node.id;
}

function flatInputPath(baseFlatPath: string, suffix: string) {
	if (!suffix) return baseFlatPath;
	if (suffix.startsWith('|')) return `${baseFlatPath}${suffix}`;
	return `${baseFlatPath}|${suffix}`;
}
