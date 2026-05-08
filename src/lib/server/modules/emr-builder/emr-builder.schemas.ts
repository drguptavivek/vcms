import { createHash } from 'node:crypto';
import { z } from 'zod';

const identifierSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/);

const labelSchema = z.string().trim().min(1).max(200);
const descriptionSchema = z.string().trim().min(1).max(2000);
const isoDateTimeSchema = z.string().datetime({ offset: true });
const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const emrSnomedMetadataSchema = z.object({
	conceptId: z.string().trim().min(1).regex(/^\d+$/),
	preferredTerm: z.string().trim().min(1).max(300).optional(),
	displayTerm: z.string().trim().min(1).max(300).optional()
});

export const emrDefinitionStatusSchema = z.enum(['draft', 'active', 'retired']);
export const emrFieldTypeSchema = z.enum([
	'text',
	'textarea',
	'integer',
	'decimal',
	'date',
	'datetime',
	'boolean',
	'single_choice',
	'multi_choice',
	'measurement',
	'diagnosis',
	'medication',
	'instructions',
	'file_reference'
]);
export const emrSectionKindSchema = z.enum(['section', 'group', 'table', 'repeatable_group']);
export const emrRuleOperatorSchema = z.enum([
	'equals',
	'not_equals',
	'in',
	'not_in',
	'contains',
	'greater_than',
	'greater_than_or_equal',
	'less_than',
	'less_than_or_equal',
	'is_empty',
	'is_not_empty'
]);
export const emrActionTypeSchema = z.enum([
	'set_value',
	'clear_value',
	'show_field',
	'hide_field',
	'enable_field',
	'disable_field',
	'require_field',
	'make_optional',
	'show_message',
	'emit_analytics_event',
	'flag_for_review'
]);

export const emrDefinitionMetadataSchema = z
	.object({
		definitionId: identifierSchema,
		slug: identifierSchema,
		title: labelSchema,
		description: descriptionSchema.optional(),
		noteType: identifierSchema,
		specialty: identifierSchema.optional(),
		status: emrDefinitionStatusSchema.default('draft'),
		version: z.number().int().positive(),
		locale: z.string().trim().min(2).max(20).default('en-IN'),
		tags: z.array(identifierSchema).max(30).default([]),
		ownerTeam: identifierSchema.optional(),
		effectiveFrom: isoDateTimeSchema.optional(),
		effectiveUntil: isoDateTimeSchema.optional()
	})
	.refine(
		(value) =>
			!value.effectiveFrom ||
			!value.effectiveUntil ||
			Date.parse(value.effectiveFrom) < Date.parse(value.effectiveUntil),
		{
			message: 'effectiveFrom must be before effectiveUntil.',
			path: ['effectiveUntil']
		}
	);

export const emrChoiceSchema = z
	.object({
		value: z.string().trim().min(1).max(120),
		label: labelSchema,
		codeSystem: identifierSchema.optional(),
		code: z.string().trim().min(1).max(120).optional(),
		analyticsValue: z.string().trim().min(1).max(120).optional(),
		disabled: z.boolean().default(false)
	})
	.refine((value) => !value.codeSystem || Boolean(value.code), {
		message: 'code is required when codeSystem is set.',
		path: ['code']
	});

export const emrChoiceSetSchema = z
	.object({
		choices: z.array(emrChoiceSchema).min(1).max(500).optional(),
		source: z
			.object({
				kind: z.enum(['master_data', 'terminology', 'api']),
				name: identifierSchema,
				filter: z.record(z.string(), jsonPrimitiveSchema).optional()
			})
			.optional()
	})
	.refine((value) => Boolean(value.choices) !== Boolean(value.source), {
		message: 'Provide exactly one of choices or source.'
	});

export const emrFieldValidationSchema = z
	.object({
		minLength: z.number().int().min(0).optional(),
		maxLength: z.number().int().min(1).optional(),
		min: z.number().optional(),
		max: z.number().optional(),
		pattern: z.string().trim().min(1).max(500).optional(),
		precision: z.number().int().min(0).max(6).optional(),
		requiredMessage: z.string().trim().min(1).max(300).optional()
	})
	.refine(
		(value) =>
			value.minLength === undefined ||
			value.maxLength === undefined ||
			value.minLength <= value.maxLength,
		{
			message: 'minLength must be less than or equal to maxLength.',
			path: ['maxLength']
		}
	)
	.refine((value) => value.min === undefined || value.max === undefined || value.min <= value.max, {
		message: 'min must be less than or equal to max.',
		path: ['max']
	});

export const emrAnalyticsHintSchema = z.object({
	key: identifierSchema,
	label: labelSchema.optional(),
	kind: z.enum(['dimension', 'measure', 'event', 'cohort']),
	valuePath: z.string().trim().min(1).max(240).optional(),
	phi: z.boolean().default(false),
	includeInDefaultReports: z.boolean().default(false)
});

export const emrFieldSchema = z
	.object({
		id: identifierSchema,
		key: identifierSchema,
		label: labelSchema,
		type: emrFieldTypeSchema,
		helpText: z.string().trim().min(1).max(500).optional(),
		placeholder: z.string().trim().min(1).max(200).optional(),
		unit: z.string().trim().min(1).max(40).optional(),
		defaultValue: jsonPrimitiveSchema.or(z.array(jsonPrimitiveSchema)).optional(),
		choiceSet: emrChoiceSetSchema.optional(),
		validation: emrFieldValidationSchema.optional(),
		analytics: z.array(emrAnalyticsHintSchema).max(20).default([]),
		snomed: emrSnomedMetadataSchema.optional(),
		required: z.boolean().default(false),
		readOnly: z.boolean().default(false),
		hidden: z.boolean().default(false),
		width: z.enum(['full', 'half', 'third', 'quarter']).default('full'),
		order: z.number().int().min(0)
	})
	.refine(
		(value) =>
			['single_choice', 'multi_choice'].includes(value.type) ? Boolean(value.choiceSet) : true,
		{
			message: 'choiceSet is required for choice fields.',
			path: ['choiceSet']
		}
	)
	.refine((value) => !value.choiceSet || ['single_choice', 'multi_choice'].includes(value.type), {
		message: 'choiceSet is only allowed for choice fields.',
		path: ['choiceSet']
	});

type CanonicalJson =
	| string
	| number
	| boolean
	| null
	| CanonicalJson[]
	| { [key: string]: CanonicalJson };

export type EmrRuleCondition = z.infer<typeof emrRuleConditionSchema>;
export const emrRuleConditionSchema: z.ZodType<
	| {
			all: EmrRuleCondition[];
	  }
	| {
			any: EmrRuleCondition[];
	  }
	| {
			not: EmrRuleCondition;
	  }
	| {
			field: string;
			operator: z.infer<typeof emrRuleOperatorSchema>;
			value?: z.infer<typeof jsonPrimitiveSchema> | z.infer<typeof jsonPrimitiveSchema>[];
	  }
> = z.lazy(() =>
	z.union([
		z.object({ all: z.array(emrRuleConditionSchema).min(1).max(20) }),
		z.object({ any: z.array(emrRuleConditionSchema).min(1).max(20) }),
		z.object({ not: emrRuleConditionSchema }),
		z.object({
			field: identifierSchema,
			operator: emrRuleOperatorSchema,
			value: jsonPrimitiveSchema.or(z.array(jsonPrimitiveSchema)).optional()
		})
	])
);

export const emrRuleActionSchema = z.object({
	type: emrActionTypeSchema,
	target: identifierSchema.optional(),
	value: jsonPrimitiveSchema.or(z.array(jsonPrimitiveSchema)).optional(),
	message: z.string().trim().min(1).max(500).optional(),
	analyticsKey: identifierSchema.optional()
});

export const emrRuleSchema = z.object({
	id: identifierSchema,
	description: descriptionSchema.optional(),
	when: emrRuleConditionSchema,
	actions: z.array(emrRuleActionSchema).min(1).max(20),
	order: z.number().int().min(0)
});

export type EmrLayoutSection = z.infer<typeof emrLayoutSectionSchema>;
export const emrLayoutSectionSchema: z.ZodType<{
	id: string;
	title: string;
	kind: z.infer<typeof emrSectionKindSchema>;
	description?: string;
	fields: z.infer<typeof emrFieldSchema>[];
	sections: EmrLayoutSection[];
	rules: z.infer<typeof emrRuleSchema>[];
	order: number;
	collapsible: boolean;
	defaultCollapsed: boolean;
}> = z.lazy(() =>
	z.object({
		id: identifierSchema,
		title: labelSchema,
		kind: emrSectionKindSchema.default('section'),
		description: descriptionSchema.optional(),
		fields: z.array(emrFieldSchema).max(200).default([]),
		sections: z.array(emrLayoutSectionSchema).max(50).default([]),
		rules: z.array(emrRuleSchema).max(100).default([]),
		order: z.number().int().min(0),
		collapsible: z.boolean().default(false),
		defaultCollapsed: z.boolean().default(false)
	})
);

export const emrDefinitionActionSchema = z.object({
	id: identifierSchema,
	label: labelSchema,
	type: z.enum(['save_draft', 'sign_note', 'print_note', 'export_pdf', 'start_follow_up']),
	requiresPrivilege: identifierSchema.optional(),
	auditReasonRequired: z.boolean().default(false),
	order: z.number().int().min(0)
});

export const emrDefinitionAnalyticsSchema = z.object({
	noteEventName: identifierSchema.optional(),
	dimensions: z.array(emrAnalyticsHintSchema.extend({ kind: z.literal('dimension') })).default([]),
	measures: z.array(emrAnalyticsHintSchema.extend({ kind: z.literal('measure') })).default([]),
	events: z.array(emrAnalyticsHintSchema.extend({ kind: z.literal('event') })).default([])
});

export const emrNoteDefinitionSchema = z.object({
	metadata: emrDefinitionMetadataSchema,
	layout: z.object({
		sections: z.array(emrLayoutSectionSchema).min(1).max(100)
	}),
	rules: z.array(emrRuleSchema).max(300).default([]),
	actions: z.array(emrDefinitionActionSchema).max(30).default([]),
	analytics: emrDefinitionAnalyticsSchema.default({
		dimensions: [],
		measures: [],
		events: []
	}),
	versionHash: z
		.string()
		.regex(/^sha256:[a-f0-9]{64}$/)
		.optional()
});

export function parseEmrNoteDefinition(input: unknown): EmrNoteDefinition {
	return emrNoteDefinitionSchema.parse(input);
}

export function computeEmrNoteDefinitionVersionHash(input: unknown): string {
	const parsed = emrNoteDefinitionSchema.parse(input);
	const hashableDefinition = { ...parsed };
	delete hashableDefinition.versionHash;
	return `sha256:${createHash('sha256')
		.update(JSON.stringify(toCanonicalJson(hashableDefinition)))
		.digest('hex')}`;
}

function toCanonicalJson(value: unknown): CanonicalJson {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => toCanonicalJson(entry));
	}

	if (typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, toCanonicalJson(entry)])
		);
	}

	throw new Error('Unsupported value in EMR note definition hash input.');
}

export type EmrDefinitionStatus = z.infer<typeof emrDefinitionStatusSchema>;
export type EmrFieldType = z.infer<typeof emrFieldTypeSchema>;
export type EmrSectionKind = z.infer<typeof emrSectionKindSchema>;
export type EmrChoice = z.infer<typeof emrChoiceSchema>;
export type EmrChoiceSet = z.infer<typeof emrChoiceSetSchema>;
export type EmrFieldValidation = z.infer<typeof emrFieldValidationSchema>;
export type EmrAnalyticsHint = z.infer<typeof emrAnalyticsHintSchema>;
export type EmrField = z.infer<typeof emrFieldSchema>;
export type EmrRuleAction = z.infer<typeof emrRuleActionSchema>;
export type EmrRule = z.infer<typeof emrRuleSchema>;
export type EmrDefinitionAction = z.infer<typeof emrDefinitionActionSchema>;
export type EmrDefinitionAnalytics = z.infer<typeof emrDefinitionAnalyticsSchema>;
export type EmrNoteDefinition = z.infer<typeof emrNoteDefinitionSchema>;
