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
const expressionValueSchema = jsonPrimitiveSchema.or(z.array(jsonPrimitiveSchema));

const openEhrArchetypeIdSchema = z
	.string()
	.trim()
	.min(10)
	.max(220)
	.regex(/^open[Ee]HR-[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[Vv]\d+$/);
const openEhrNodePathSchema = z
	.string()
	.trim()
	.min(3)
	.max(420)
	.regex(
		/^(?:\/?[A-Za-z][A-Za-z0-9_-]*(?:\[[Aa][Tt][0-9]+\])?)(?:\/[A-Za-z][A-Za-z0-9_-]*(?:\[[Aa][Tt][0-9]+\])?)*(?:\[[Aa][Tt][0-9]+\])?$/
	)
	.refine((value) => /\[[Aa][Tt][0-9]+\]/.test(value), {
		message: 'archetype node/path must include an at-code segment.'
	});
const openEhrTemplateIdSchema = z
	.string()
	.trim()
	.min(3)
	.max(120)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const openEhrTemplatePathSchema = z
	.string()
	.trim()
	.min(1)
	.max(420)
	.regex(/^\/?[A-Za-z0-9._/[\]-]+$/);
const openEhrWebTemplatePathSchema = z
	.string()
	.trim()
	.min(1)
	.max(420)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._|/-]*(?:\[[0-9]+\])?$/);
const openEhrTerminologyCodeSchema = z
	.string()
	.trim()
	.min(1)
	.max(200)
	.regex(/^(?:[A-Za-z][A-Za-z0-9_.-]*::)?[A-Za-z0-9][A-Za-z0-9._-]*$/);
const openEhrRmTypeSchema = z
	.string()
	.trim()
	.min(2)
	.max(120)
	.regex(/^[A-Z][A-Za-z0-9_.]*(?:[A-Z_]+)?$/);
const openEhrDataValueTypeSchema = z
	.string()
	.trim()
	.min(2)
	.max(120)
	.regex(/^DV_[A-Z0-9_]+$/);

const hasOpenEhrMappingEntry = (value: Record<string, unknown>): boolean =>
	Object.values(value).some((entry) => entry !== undefined);

export const emrOpenEhrMappingSchema = z
	.object({
		archetypeId: openEhrArchetypeIdSchema.optional(),
		archetypePath: openEhrNodePathSchema.optional(),
		templateId: openEhrTemplateIdSchema.optional(),
		templatePath: openEhrTemplatePathSchema.optional(),
		webTemplatePath: openEhrWebTemplatePathSchema.optional(),
		terminologyCode: openEhrTerminologyCodeSchema.optional(),
		rmType: openEhrRmTypeSchema.optional(),
		dataValueType: openEhrDataValueTypeSchema.optional()
	})
	.refine((value) => hasOpenEhrMappingEntry(value), {
		message: 'openEHR mapping must define at least one mapping field.'
	});

export const emrOpenEhrSectionMappingSchema = emrOpenEhrMappingSchema.extend({
	archetypeStructure: z.enum(['ENTRY', 'CLUSTER']).optional()
});

export type EmrExpression =
	| { field: string }
	| { value: z.infer<typeof expressionValueSchema> }
	| { fn: 'selected' | 'count-selected' | 'coalesce'; args: EmrExpression[] }
	| {
			op:
				| 'equals'
				| 'not_equals'
				| 'in'
				| 'not_in'
				| 'contains'
				| 'greater_than'
				| 'greater_than_or_equal'
				| 'less_than'
				| 'less_than_or_equal'
				| 'and'
				| 'or'
				| 'not'
				| 'add'
				| 'subtract'
				| 'multiply'
				| 'divide';
			args: EmrExpression[];
	  };

export const emrExpressionSchema: z.ZodType<EmrExpression> = z.lazy(() =>
	z.union([
		z.object({ field: identifierSchema }),
		z.object({ value: expressionValueSchema }),
		z.object({
			fn: z.enum(['selected', 'count-selected', 'coalesce']),
			args: z.array(emrExpressionSchema).min(1).max(20)
		}),
		z.object({
			op: z.enum([
				'equals',
				'not_equals',
				'in',
				'not_in',
				'contains',
				'greater_than',
				'greater_than_or_equal',
				'less_than',
				'less_than_or_equal',
				'and',
				'or',
				'not',
				'add',
				'subtract',
				'multiply',
				'divide'
			]),
			args: z.array(emrExpressionSchema).min(1).max(20)
		})
	])
);

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
	'range',
	'date',
	'datetime',
	'boolean',
	'single_choice',
	'multi_choice',
	'geopoint',
	'geotrace',
	'geoshape',
	'measurement',
	'diagnosis',
	'medication',
	'calculate',
	'instructions',
	'image',
	'audit',
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
		defaultLanguage: z.string().trim().min(2).max(80).optional(),
		languages: z.array(z.string().trim().min(2).max(80)).max(30).default([]),
		formStyle: z.string().trim().min(1).max(120).optional(),
		tags: z.array(identifierSchema).max(30).default([]),
		ownerTeam: identifierSchema.optional(),
		compositionTemplateId: openEhrTemplateIdSchema.optional(),
		compositionArchetypeId: openEhrArchetypeIdSchema.optional(),
		compositionCategory: z.string().trim().min(1).max(160).optional(),
		compositionSetting: z.string().trim().min(1).max(160).optional(),
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
		localizedLabel: z.record(z.string(), labelSchema).optional(),
		codeSystem: identifierSchema.optional(),
		code: z.string().trim().min(1).max(120).optional(),
		analyticsValue: z.string().trim().min(1).max(120).optional(),
		disabled: z.boolean().default(false)
	})
	.extend({
		openEhrMapping: emrOpenEhrMappingSchema.optional()
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
				kind: z.enum(['master_data', 'terminology', 'clinical_worklist', 'api']),
				name: identifierSchema,
				filter: z.record(z.string(), jsonPrimitiveSchema).optional(),
				filterExpression: emrExpressionSchema.optional(),
				valueField: identifierSchema.optional(),
				labelField: identifierSchema.optional()
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
		inputMask: z.string().trim().min(1).max(200).optional(),
		textTransform: z.enum(['uppercase', 'lowercase', 'titlecase']).optional(),
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

export const emrFieldLogicSchema = z.object({
	required: emrExpressionSchema.optional(),
	relevance: emrExpressionSchema.optional(),
	calculation: emrExpressionSchema.optional(),
	trigger: z.string().trim().min(1).max(500).optional(),
	constraint: emrExpressionSchema.optional(),
	constraintMessage: z.string().trim().min(1).max(500).optional(),
	choiceFilter: z.string().trim().min(1).max(500).optional(),
	randomizeChoices: z.boolean().optional(),
	randomizeSeed: z.string().trim().min(1).max(200).optional()
});

export const emrFieldInputSchema = z.object({
	barcodeInput: z.boolean().optional(),
	mask: z.string().trim().min(1).max(200).optional(),
	textTransform: z.enum(['uppercase', 'lowercase', 'titlecase']).optional(),
	rangeStart: z.number().optional(),
	rangeEnd: z.number().optional(),
	rangeStep: z.number().positive().optional(),
	captureAccuracy: z.number().positive().max(1000).optional(),
	warningAccuracy: z.number().positive().max(1000).optional(),
	maxPixels: z.number().int().positive().max(100000).optional(),
	locationPriority: z.enum(['high-accuracy', 'balanced', 'low-power', 'no-power']).optional(),
	locationMinInterval: z.number().int().positive().optional(),
	locationMaxAge: z.number().int().positive().optional()
});

export const emrAnalyticsHintSchema = z.object({
	key: identifierSchema,
	label: labelSchema.optional(),
	kind: z.enum(['dimension', 'measure', 'event', 'cohort']),
	valuePath: z.string().trim().min(1).max(240).optional(),
	phi: z.boolean().default(false),
	includeInDefaultReports: z.boolean().default(false)
});

export const emrOdkBindSchema = z.object({
	xlsformName: z.string().trim().min(1).max(120).optional(),
	required: emrExpressionSchema.optional(),
	relevant: emrExpressionSchema.optional(),
	constraint: emrExpressionSchema.optional(),
	constraintMessage: z.string().trim().min(1).max(500).optional(),
	calculation: emrExpressionSchema.optional(),
	trigger: z.string().trim().min(1).max(500).optional(),
	readOnly: emrExpressionSchema.optional(),
	appearance: z.string().trim().min(1).max(200).optional(),
	choiceSource: z.string().trim().min(1).max(200).optional(),
	choiceFilter: z.string().trim().min(1).max(500).optional(),
	parameters: z.string().trim().min(1).max(500).optional(),
	captureAccuracy: z.number().positive().max(1000).optional(),
	warningAccuracy: z.number().positive().max(1000).optional(),
	rangeStart: z.number().optional(),
	rangeEnd: z.number().optional(),
	rangeStep: z.number().positive().optional(),
	maxPixels: z.number().int().positive().max(100000).optional(),
	locationPriority: z.enum(['high-accuracy', 'balanced', 'low-power', 'no-power']).optional(),
	locationMinInterval: z.number().int().positive().optional(),
	locationMaxAge: z.number().int().positive().optional(),
	randomizeChoices: z.boolean().optional(),
	randomizeSeed: z.string().trim().min(1).max(200).optional(),
	barcodeInput: z.boolean().optional()
});

export const emrFieldSchema = z
	.object({
		id: identifierSchema,
		key: identifierSchema,
		label: labelSchema,
		localizedLabel: z.record(z.string(), labelSchema).optional(),
		type: emrFieldTypeSchema,
		fieldName: z.string().trim().min(1).max(120).optional(),
		xlsv1Name: z.string().trim().min(1).max(120).optional(),
		helpText: z.string().trim().min(1).max(500).optional(),
		localizedHint: z.record(z.string(), z.string().trim().min(1).max(500)).optional(),
		guidanceHint: z.string().trim().min(1).max(1000).optional(),
		localizedGuidanceHint: z.record(z.string(), z.string().trim().min(1).max(1000)).optional(),
		media: z
			.object({
				image: z.string().trim().min(1).max(300).optional(),
				video: z.string().trim().min(1).max(300).optional(),
				audio: z.string().trim().min(1).max(300).optional(),
				localizedImage: z.record(z.string(), z.string().trim().min(1).max(300)).optional(),
				localizedVideo: z.record(z.string(), z.string().trim().min(1).max(300)).optional(),
				localizedAudio: z.record(z.string(), z.string().trim().min(1).max(300)).optional()
			})
			.optional(),
		placeholder: z.string().trim().min(1).max(200).optional(),
		unit: z.string().trim().min(1).max(40).optional(),
		defaultValue: expressionValueSchema.or(emrExpressionSchema).optional(),
		localizedRequiredMessage: z.record(z.string(), z.string().trim().min(1).max(300)).optional(),
		localizedConstraintMessage: z.record(z.string(), z.string().trim().min(1).max(500)).optional(),
		choiceSet: emrChoiceSetSchema.optional(),
		validation: emrFieldValidationSchema.optional(),
		logic: emrFieldLogicSchema.optional(),
		input: emrFieldInputSchema.optional(),
		appearance: z.string().trim().min(1).max(200).optional(),
		odkBind: emrOdkBindSchema.optional(),
		analytics: z.array(emrAnalyticsHintSchema).max(20).default([]),
		snomed: emrSnomedMetadataSchema.optional(),
		openEhrMapping: emrOpenEhrMappingSchema.optional(),
		required: z.boolean().default(false),
		readOnly: z.boolean().default(false),
		readonly: z.boolean().optional(),
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
	openEhrMapping?: z.infer<typeof emrOpenEhrSectionMappingSchema>;
	odk?: {
		xlsformName?: string;
		appearance?: string;
		displayNote?: string;
		relevant?: string;
		repeat?: {
			count?: EmrExpression;
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
			fields: z.array(emrFieldSchema).max(200).default([]),
			sections: z.array(emrLayoutSectionSchema).max(50).default([]),
			rules: z.array(emrRuleSchema).max(100).default([]),
			openEhrMapping: emrOpenEhrSectionMappingSchema.optional(),
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
			order: z.number().int().min(0),
			collapsible: z.boolean().default(false),
			defaultCollapsed: z.boolean().default(false)
		})
		.refine((value) => value.kind === 'repeatable_group' || !value.odk?.repeat, {
			message: 'repeat metadata is only allowed for repeatable_group sections.',
			path: ['odk', 'repeat']
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

export const emrBuilderDefinitionIdSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)*$/);

export const emrBuilderSaveDraftSchema = z.object({
	definition: emrNoteDefinitionSchema
});

export const emrBuilderPublishDraftSchema = z.object({
	definitionId: emrBuilderDefinitionIdSchema,
	reason: z.string().trim().min(1).max(1000).optional()
});

export const emrBuilderDefinitionQuerySchema = z.object({
	definitionId: emrBuilderDefinitionIdSchema
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
export type EmrOdkBind = z.infer<typeof emrOdkBindSchema>;
export type EmrField = z.infer<typeof emrFieldSchema>;
export type EmrRuleAction = z.infer<typeof emrRuleActionSchema>;
export type EmrRule = z.infer<typeof emrRuleSchema>;
export type EmrDefinitionAction = z.infer<typeof emrDefinitionActionSchema>;
export type EmrDefinitionAnalytics = z.infer<typeof emrDefinitionAnalyticsSchema>;
export type EmrNoteDefinition = z.infer<typeof emrNoteDefinitionSchema>;
