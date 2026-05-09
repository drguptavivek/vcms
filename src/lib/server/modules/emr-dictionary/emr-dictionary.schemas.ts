import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
	emrChoiceSetSchema,
	emrFieldSchema,
	emrExpressionSchema,
	emrOpenEhrMappingSchema,
	emrOpenEhrSectionMappingSchema,
	emrRuleSchema,
	emrSectionKindSchema
} from '$lib/server/modules/emr-builder/emr-builder.schemas';

const identifierSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/);
const labelSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().trim().min(1).max(2000);
export const emrDictionaryOpenEhrMappingSchema = emrOpenEhrMappingSchema;
export const emrDictionaryOpenEhrSectionMappingSchema = emrOpenEhrSectionMappingSchema;

const canonicalJsonify = (value: unknown): unknown => {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => canonicalJsonify(entry));
	}

	if (typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, canonicalJsonify(entry)])
		);
	}

	throw new Error('Unsupported value in dictionary payload hash input.');
};

export type EmrDictionaryFieldTemplate = z.infer<typeof emrDictionaryFieldTemplateSchema>;
export type EmrDictionaryOptionSetTemplate = z.infer<typeof emrDictionaryOptionSetPayloadSchema>;
export type EmrDictionaryFragmentSection = z.infer<typeof emrDictionaryFragmentSectionSchema>;
export type EmrDictionaryFragmentTemplate = z.infer<typeof emrDictionaryFragmentPayloadSchema>;

export const emrDictionaryKindSchema = z.enum(['field', 'option_set', 'fragment']);
export const emrDictionaryStatusSchema = z.enum(['draft', 'active', 'retired']);

export const emrDictionaryFieldTemplateSchema = z.preprocess((value) => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return value;
	}

	const candidate = value as Record<string, unknown>;
	if (candidate.order === undefined) {
		return { ...candidate, order: 0 };
	}

	return value;
}, emrFieldSchema);

export const emrDictionaryOptionSetPayloadSchema = emrChoiceSetSchema;
export const emrDictionaryFragmentSectionSchema: z.ZodType<{
	id: string;
	title: string;
	kind: z.infer<typeof emrSectionKindSchema>;
	description?: string;
	fields: z.infer<typeof emrDictionaryFieldTemplateSchema>[];
	sections: typeof emrDictionaryFragmentSectionSchema extends z.ZodType<infer T> ? T[] : unknown[];
	rules: z.infer<typeof emrRuleSchema>[];
	openEhrMapping?: z.infer<typeof emrDictionaryOpenEhrSectionMappingSchema>;
	odk?: {
		xlsformName?: string;
		appearance?: string;
		displayNote?: string;
		relevant?: string;
		repeat?: {
			count?: unknown;
			min?: number;
			max?: number;
		};
	};
	order: number;
	collapsible: boolean;
	defaultCollapsed: boolean;
}> = z.lazy(() =>
	z
		.object({
			id: identifierSchema,
			title: labelSchema,
			kind: emrSectionKindSchema.default('section'),
			description: descriptionSchema.optional(),
			fields: z.array(emrDictionaryFieldTemplateSchema).max(200).default([]),
			sections: z.array(emrDictionaryFragmentSectionSchema).max(50).default([]),
			rules: z.array(emrRuleSchema).max(100).default([]),
			openEhrMapping: emrDictionaryOpenEhrSectionMappingSchema.optional(),
			odk: z
				.object({
					xlsformName: z.string().trim().min(1).max(120).optional(),
					appearance: z.string().trim().min(1).max(200).optional(),
					displayNote: z.string().trim().min(1).max(1000).optional(),
					relevant: z.string().trim().min(1).max(500).optional(),
					repeat: z
						.object({
							count: emrExpressionSchema.optional(),
							min: z.number().int().min(0).optional(),
							max: z.number().int().min(1).optional()
						})
						.refine(
							(value) =>
								value.min === undefined || value.max === undefined || value.min <= value.max,
							{
								message: 'repeat min must be less than or equal to max.',
								path: ['max']
							}
						)
						.optional()
				})
				.optional(),
			order: z.number().int().min(0).default(0),
			collapsible: z.boolean().default(false),
			defaultCollapsed: z.boolean().default(false)
		})
		.refine((value) => value.kind === 'repeatable_group' || !value.odk?.repeat, {
			message: 'repeat metadata is only allowed for repeatable_group sections.',
			path: ['odk', 'repeat']
		})
);

export const emrDictionaryFragmentPayloadSchema = z
	.object({
		sections: z.array(emrDictionaryFragmentSectionSchema).max(100).default([]),
		fields: z.array(emrDictionaryFieldTemplateSchema).max(500).default([])
	})
	.refine((value) => value.sections.length + value.fields.length > 0, {
		message: 'field or sections is required.',
		path: ['sections']
	});

const emrDictionaryPayloadByKindSchema = z.object({
	kind: emrDictionaryKindSchema,
	payload: z.union([
		emrDictionaryFieldTemplateSchema,
		emrDictionaryOptionSetPayloadSchema,
		emrDictionaryFragmentPayloadSchema
	])
});

const emrDictionaryAssetMetadataSchema = z.object({
	dictionaryId: identifierSchema,
	key: identifierSchema,
	kind: emrDictionaryKindSchema,
	title: labelSchema,
	description: descriptionSchema.optional(),
	specialty: identifierSchema.optional(),
	tags: z.array(identifierSchema).max(30).default([])
});

export const emrDictionaryFieldAssetSchema = emrDictionaryAssetMetadataSchema.extend({
	kind: z.literal('field'),
	payload: emrDictionaryFieldTemplateSchema
});

export const emrDictionaryOptionSetAssetSchema = emrDictionaryAssetMetadataSchema.extend({
	kind: z.literal('option_set'),
	payload: emrDictionaryOptionSetPayloadSchema
});

export const emrDictionaryFragmentAssetSchema = emrDictionaryAssetMetadataSchema.extend({
	kind: z.literal('fragment'),
	payload: emrDictionaryFragmentPayloadSchema
});

export const emrDictionarySaveDraftSchema = z.discriminatedUnion('kind', [
	emrDictionaryFieldAssetSchema,
	emrDictionaryOptionSetAssetSchema,
	emrDictionaryFragmentAssetSchema
]);

export const emrDictionaryAssetIdentitySchema = z.object({
	dictionaryId: identifierSchema,
	key: identifierSchema,
	kind: emrDictionaryKindSchema
});
export const emrDictionaryListQuerySchema = z.object({
	dictionaryId: identifierSchema.optional(),
	kind: emrDictionaryKindSchema.optional(),
	status: emrDictionaryStatusSchema.optional(),
	specialty: identifierSchema.optional()
});
export const emrDictionaryPublishDraftSchema = emrDictionaryAssetIdentitySchema.extend({
	reason: z.string().trim().min(1).max(1000).optional()
});
export const emrDictionaryRetireSchema = emrDictionaryAssetIdentitySchema.extend({
	reason: z.string().trim().min(1).max(1000).optional()
});

export type EmrDictionaryKind = z.infer<typeof emrDictionaryKindSchema>;
export type EmrDictionaryStatus = z.infer<typeof emrDictionaryStatusSchema>;
export type EmrDictionaryPayload =
	| EmrDictionaryFieldTemplate
	| EmrDictionaryOptionSetTemplate
	| EmrDictionaryFragmentTemplate;
export type EmrDictionaryAssetSaveInput = z.infer<typeof emrDictionarySaveDraftSchema>;
export type EmrDictionaryAssetIdentity = z.infer<typeof emrDictionaryAssetIdentitySchema>;
export type EmrDictionaryListQuery = z.infer<typeof emrDictionaryListQuerySchema>;

export function parseEmrDictionaryAsset(input: unknown): EmrDictionaryAssetSaveInput {
	return emrDictionarySaveDraftSchema.parse(input);
}

export function parseEmrDictionaryPayload(input: {
	kind: EmrDictionaryKind;
	payload: unknown;
}): EmrDictionaryPayload {
	const payloadByKind = emrDictionaryPayloadByKindSchema.parse({
		kind: input.kind,
		payload: input.payload
	});

	return payloadByKind.payload;
}

export function parseEmrDictionaryAssetIdentity(input: unknown): EmrDictionaryAssetIdentity {
	return emrDictionaryAssetIdentitySchema.parse(input);
}

export function parseEmrDictionaryListQuery(input: unknown): EmrDictionaryListQuery {
	return emrDictionaryListQuerySchema.parse(input);
}

export function computeEmrDictionaryAssetVersionHash(input: EmrDictionaryAssetSaveInput): string {
	const hashableAsset = {
		metadata: {
			dictionaryId: input.dictionaryId,
			key: input.key,
			kind: input.kind,
			title: input.title,
			description: input.description,
			specialty: input.specialty,
			tags: input.tags
		},
		payload: input.payload
	};

	return `sha256:${createHash('sha256')
		.update(JSON.stringify(canonicalJsonify(hashableAsset)))
		.digest('hex')}`;
}

export function isFieldAsset(input: EmrDictionaryAssetSaveInput): input is EmrDictionaryFieldAsset {
	return input.kind === 'field';
}

export function isOptionSetAsset(
	input: EmrDictionaryAssetSaveInput
): input is EmrDictionaryOptionSetAsset {
	return input.kind === 'option_set';
}

export function isFragmentAsset(
	input: EmrDictionaryAssetSaveInput
): input is EmrDictionaryFragmentAsset {
	return input.kind === 'fragment';
}

export type EmrDictionaryFieldAsset = z.infer<typeof emrDictionaryFieldAssetSchema>;
export type EmrDictionaryOptionSetAsset = z.infer<typeof emrDictionaryOptionSetAssetSchema>;
export type EmrDictionaryFragmentAsset = z.infer<typeof emrDictionaryFragmentAssetSchema>;
