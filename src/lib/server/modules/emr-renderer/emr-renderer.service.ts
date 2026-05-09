import { notFound, validationFailed } from '$lib/server/observability/errors';
import { parseEmrNoteDefinition, type EmrExpression } from '../emr-builder/emr-builder.schemas';
import { EmrBuilderRepository } from '../emr-builder/emr-builder.repository';
import type { EmrNoteDefinition } from '../emr-builder/emr-builder.types';
import type {
	EmrRenderContext,
	EmrRenderModel,
	EmrRenderedField,
	EmrRenderedSection
} from './emr-renderer.types';

type EmrPublishedDefinitionResolver = {
	findDefinitionByDefinitionId: (
		definitionId: string
	) => Promise<{ id: string; status: string; definitionId?: string } | undefined>;
	findLatestVersion: (definitionId: string) => Promise<{ payloadJson: unknown } | undefined>;
};

const valueKind = {
	boolean: 'boolean',
	number: 'number',
	string: 'string'
} as const;

type EmrExpressionValue =
	| string
	| number
	| boolean
	| null
	| Array<string | number | boolean | null>;

const hasOwn = (value: object, key: string): boolean => Object.hasOwn(value, key);

export function evaluateEmrExpression(
	expression: EmrExpression,
	context: EmrRenderContext
): unknown {
	return evaluateExpressionNode(expression, context);
}

export class EmrRendererService {
	constructor(
		private readonly repository: EmrPublishedDefinitionResolver = new EmrBuilderRepository() as EmrBuilderRepository
	) {}

	async renderPublishedDefinition({
		definitionId,
		answers = {}
	}: {
		definitionId: string;
		answers?: EmrRenderContext;
	}): Promise<EmrRenderModel> {
		const definitionRecord = await this.repository.findDefinitionByDefinitionId(definitionId);
		if (!definitionRecord || definitionRecord.status !== 'active') {
			throw notFound('Published EMR definition not found.');
		}

		const latestVersion = await this.repository.findLatestVersion(definitionRecord.id);
		if (!latestVersion) {
			throw notFound('No published EMR definition version found.');
		}

		return this.renderDefinitionModel({
			definition: latestVersion.payloadJson,
			answers
		});
	}

	renderDefinitionModel({
		definition,
		answers = {}
	}: {
		definition: unknown;
		answers?: EmrRenderContext;
	}): EmrRenderModel {
		const parsed = this.parseDefinitionPayload(definition);
		const sections = parsed.layout.sections.map((section) => this.renderSection(section, answers));

		return {
			definitionId: parsed.metadata.definitionId,
			slug: parsed.metadata.slug,
			title: parsed.metadata.title,
			noteType: parsed.metadata.noteType,
			specialty: parsed.metadata.specialty,
			version: parsed.metadata.version,
			locale: parsed.metadata.locale,
			tags: parsed.metadata.tags,
			status: parsed.metadata.status,
			effectiveFrom: parsed.metadata.effectiveFrom,
			effectiveUntil: parsed.metadata.effectiveUntil,
			sections,
			rules: parsed.rules,
			actions: parsed.actions,
			analytics: parsed.analytics
		};
	}

	private parseDefinitionPayload(input: unknown): EmrNoteDefinition {
		try {
			return parseEmrNoteDefinition(input);
		} catch (error) {
			throw validationFailed(error);
		}
	}

	private renderSection(
		section: EmrNoteDefinition['layout']['sections'][number],
		answers: EmrRenderContext
	): EmrRenderedSection {
		return {
			id: section.id,
			title: section.title,
			kind: section.kind,
			description: section.description,
			fields: section.fields.map((field) => this.renderField(field, answers)),
			sections: section.sections.map((childSection) => this.renderSection(childSection, answers)),
			rules: section.rules,
			odk: section.odk,
			order: section.order,
			collapsible: section.collapsible,
			defaultCollapsed: section.defaultCollapsed
		};
	}

	private renderField(
		field: EmrNoteDefinition['layout']['sections'][number]['fields'][number],
		answers: EmrRenderContext
	): EmrRenderedField {
		const required = this.resolveBooleanBinding(
			field.logic?.required ?? field.odkBind?.required,
			answers,
			field.required
		);
		const relevant = this.resolveBooleanBinding(
			field.logic?.relevance ?? field.odkBind?.relevant,
			answers,
			true
		);
		const readOnly = this.resolveBooleanBinding(
			field.odkBind?.readOnly,
			answers,
			field.readOnly || Boolean(field.readonly)
		);

		const constraint = this.resolveConstraintBinding(
			field.logic?.constraint ?? field.odkBind?.constraint,
			answers,
			field.logic?.constraintMessage ?? field.odkBind?.constraintMessage
		);
		const calculation = this.resolveValueBinding(
			field.logic?.calculation ?? field.odkBind?.calculation,
			answers
		);
		const defaultValue = this.resolveValueBinding(
			field.defaultValue as EmrExpressionValue | undefined,
			answers
		);

		return {
			id: field.id,
			key: field.key,
			label: field.label,
			type: field.type,
			xlsv1Name: field.xlsv1Name,
			helpText: field.helpText,
			placeholder: field.placeholder,
			unit: field.unit,
			defaultValue: field.defaultValue as EmrExpressionValue | EmrExpression | undefined,
			validation: field.validation,
			analytics: field.analytics,
			snomed: field.snomed,
			required: field.required,
			readonly: field.readonly,
			readOnly: field.readOnly,
			hidden: field.hidden,
			width: field.width,
			order: field.order,
			choiceSet: field.choiceSet,
			bind: {
				required,
				relevant,
				readOnly,
				constraint,
				calculation,
				defaultValue
			},
			odkBind: field.odkBind
		};
	}

	private resolveBooleanBinding(
		expression: EmrExpression | undefined,
		answers: EmrRenderContext,
		defaultValue: boolean
	): { value: boolean; source?: EmrExpression } {
		if (!expression) return { value: defaultValue };

		return {
			value: toBoolean(evaluateEmrExpression(expression, answers)),
			source: expression
		};
	}

	private resolveConstraintBinding(
		expression: EmrExpression | undefined,
		answers: EmrRenderContext,
		message?: string
	): {
		expression?: EmrExpression;
		passes: boolean;
		message?: string;
	} {
		if (!expression) {
			return {
				passes: true
			};
		}

		return {
			expression,
			passes: toBoolean(evaluateEmrExpression(expression, answers)),
			message
		};
	}

	private resolveValueBinding(
		expressionOrValue: EmrExpression | EmrExpressionValue | undefined,
		answers: EmrRenderContext
	): { value: unknown; source?: EmrExpression } {
		if (expressionOrValue === undefined) return { value: undefined };
		if (looksLikeExpression(expressionOrValue)) {
			return {
				value: evaluateEmrExpression(expressionOrValue, answers),
				source: expressionOrValue
			};
		}

		return {
			value: expressionOrValue
		};
	}
}

function evaluateExpressionNode(node: EmrExpression, context: EmrRenderContext): unknown {
	if (isFieldNode(node)) {
		return resolveFieldValue(node.field, context);
	}

	if (isValueNode(node)) {
		return node.value;
	}

	if (isFunctionNode(node)) {
		const args = node.args.map((argument) => evaluateExpressionNode(argument, context));
		switch (node.fn) {
			case 'selected': {
				if (args.length < 2) return false;
				return isSelected(args[0], args[1]);
			}
			case 'count-selected': {
				if (args.length < 1) return 0;
				return countSelected(args[0]);
			}
			case 'coalesce': {
				for (const value of args) {
					if (value !== null && value !== undefined) return value;
				}
				return null;
			}
		}
		return null;
	}

	if (isOperatorNode(node)) {
		const args = node.args.map((argument) => evaluateExpressionNode(argument, context));
		switch (node.op) {
			case 'equals':
				return areValuesEqual(args[0], args[1]);
			case 'not_equals':
				return !areValuesEqual(args[0], args[1]);
			case 'in':
				return isIn(args[0], args[1]);
			case 'not_in':
				return !isIn(args[0], args[1]);
			case 'contains':
				return contains(args[0], args[1]);
			case 'greater_than':
				return compareNumbers(args[0], args[1], (left, right) => left > right);
			case 'greater_than_or_equal':
				return compareNumbers(args[0], args[1], (left, right) => left >= right);
			case 'less_than':
				return compareNumbers(args[0], args[1], (left, right) => left < right);
			case 'less_than_or_equal':
				return compareNumbers(args[0], args[1], (left, right) => left <= right);
			case 'and':
				return args.every(toBoolean);
			case 'or':
				return args.some(toBoolean);
			case 'not':
				return !toBoolean(args[0]);
			case 'add': {
				const value = toNumber(args[0]) + toNumber(args[1]);
				return Number.isNaN(value) ? null : value;
			}
			case 'subtract': {
				const value = toNumber(args[0]) - toNumber(args[1]);
				return Number.isNaN(value) ? null : value;
			}
			case 'multiply': {
				const value = toNumber(args[0]) * toNumber(args[1]);
				return Number.isNaN(value) ? null : value;
			}
			case 'divide': {
				const divisor = toNumber(args[1]);
				if (divisor === 0 || Number.isNaN(divisor)) return null;
				const value = toNumber(args[0]) / divisor;
				return Number.isNaN(value) ? null : value;
			}
		}
		return null;
	}

	return null;
}

function resolveFieldValue(field: string, context: EmrRenderContext): unknown {
	if (hasOwn(context, field)) return context[field];

	const fieldByUnderscore = field.replace(/-/g, '_');
	if (hasOwn(context, fieldByUnderscore)) return context[fieldByUnderscore];

	const fieldByHyphen = fieldByUnderscore.replace(/_/g, '-');
	if (hasOwn(context, fieldByHyphen)) return context[fieldByHyphen];

	return undefined;
}

function looksLikeExpression(
	value: EmrExpression | EmrExpressionValue | undefined
): value is EmrExpression {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	return (
		typeof (value as { field?: unknown }).field === 'string' ||
		'value' in (value as Record<string, unknown>) ||
		typeof (value as { fn?: unknown }).fn === 'string' ||
		typeof (value as { op?: unknown }).op === 'string'
	);
}

function isFieldNode(expression: EmrExpression): expression is { field: string } {
	return typeof expression === 'object' && expression !== null && 'field' in expression;
}

function isValueNode(expression: EmrExpression): expression is { value: EmrExpressionValue } {
	return (
		typeof expression === 'object' &&
		expression !== null &&
		'value' in expression &&
		!('field' in expression) &&
		!('fn' in expression) &&
		!('op' in expression)
	);
}

function isFunctionNode(
	expression: EmrExpression
): expression is { fn: 'selected' | 'count-selected' | 'coalesce'; args: EmrExpression[] } {
	return (
		typeof expression === 'object' &&
		expression !== null &&
		'fn' in expression &&
		'args' in expression
	);
}

function isOperatorNode(expression: EmrExpression): expression is {
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
} {
	return (
		typeof expression === 'object' &&
		expression !== null &&
		'op' in expression &&
		'args' in expression
	);
}

function isSelected(base: unknown, expected: unknown): boolean {
	const selectedValues = normalizeSelected(base);
	return selectedValues.some((candidate) => areValuesEqual(candidate, expected));
}

function countSelected(base: unknown): number {
	return normalizeSelected(base).length;
}

function normalizeSelected(value: unknown): unknown[] {
	if (value === undefined || value === null || value === '') return [];
	if (Array.isArray(value)) return value;
	if (typeof value === 'string') {
		return value
			.trim()
			.split(/\s+/)
			.map((entry) => entry.trim())
			.filter((entry) => entry.length > 0);
	}
	return [value];
}

function contains(haystack: unknown, needle: unknown): boolean {
	if (haystack === undefined || haystack === null || needle === undefined) return false;
	if (Array.isArray(haystack)) return haystack.some((entry) => areValuesEqual(entry, needle));
	if (typeof haystack === 'string' && typeof needle === 'string') return haystack.includes(needle);
	return false;
}

function isIn(value: unknown, haystack: unknown): boolean {
	if (!Array.isArray(haystack)) return false;
	return haystack.some((entry) => areValuesEqual(entry, value));
}

function compareNumbers(
	left: unknown,
	right: unknown,
	predicate: (left: number, right: number) => boolean
): boolean {
	const leftNumber = toNumber(left);
	const rightNumber = toNumber(right);
	if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) return false;
	return predicate(leftNumber, rightNumber);
}

function toNumber(value: unknown): number {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim().length > 0) return Number(value);
	return Number.NaN;
}

function toBoolean(value: unknown): boolean {
	switch (typeof value) {
		case valueKind.boolean:
			return value as boolean;
		case valueKind.number:
			return (value as number) !== 0 && Number.isFinite(value as number);
		case valueKind.string:
			return (value as string).trim().length > 0;
		case 'undefined':
		case 'object':
			if (value === null) return false;
			if (Array.isArray(value)) return value.length > 0;
			return true;
		default:
			return Boolean(value);
	}
}

function areValuesEqual(left: unknown, right: unknown): boolean {
	if (left === right) return true;
	if (left === null || right === null) return false;
	if (typeof left !== typeof right) return false;
	if (Array.isArray(left) || Array.isArray(right)) {
		if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
		for (let i = 0; i < left.length; i += 1) {
			if (!areValuesEqual(left[i], right[i])) return false;
		}
		return true;
	}
	if (typeof left === 'object' && typeof right === 'object') {
		try {
			return JSON.stringify(left) === JSON.stringify(right);
		} catch {
			return false;
		}
	}
	return false;
}

export const emrRendererService = new EmrRendererService();
