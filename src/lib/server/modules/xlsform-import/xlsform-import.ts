import {
	parseEmrNoteDefinition,
	type EmrChoiceSet
} from '$lib/server/modules/emr-builder/emr-builder.schemas';
import { type EmrLayoutSection } from '$lib/server/modules/emr-builder/emr-builder.types';
import {
	type XlsformChoiceRow,
	type XlsformEntityRow,
	type XlsformFixture,
	type XlsformIssueKind,
	type XlsformUnsupportedItem,
	type XlsformImportResult
} from './xlsform-import.types';

type XlsformTypeKind =
	| 'text'
	| 'integer'
	| 'decimal'
	| 'range'
	| 'date'
	| 'datetime'
	| 'boolean'
	| 'note'
	| 'select_one'
	| 'select_multiple'
	| 'select_one_from_file'
	| 'geopoint'
	| 'geotrace'
	| 'geoshape'
	| 'image'
	| 'barcode'
	| 'begin_group'
	| 'end_group'
	| 'begin_repeat'
	| 'end_repeat'
	| 'start'
	| 'end'
	| 'today'
	| 'deviceid'
	| 'phonenumber'
	| 'username'
	| 'email'
	| 'audit'
	| 'calculate'
	| 'default'
	| 'instance'
	| 'unknown';

type ParsedXlsFieldType = {
	kind: XlsformTypeKind;
	listName?: string;
};

type SectionState = {
	section: EmrLayoutSection;
	order: number;
	fieldIds: Set<string>;
};

type FieldMapContext = {
	section: SectionState;
	issues: XlsformUnsupportedItem[];
	choiceGroups: Map<string, XlsformChoiceRow[]>;
	entityRows: Map<string, XlsformEntityRow>;
	formSlug: string;
	usedFieldKeys: Set<string>;
};

const SKIP_FIELD_TYPES = new Set<XlsformTypeKind>([
	'start',
	'end',
	'today',
	'deviceid',
	'phonenumber',
	'username',
	'email'
]);
const SYSTEM_NAME_PREFIXES = ['_'];
const CALCULATION_TYPES = new Set<XlsformTypeKind>(['default', 'instance']);
const GROUP_TYPES = new Set<XlsformTypeKind>([
	'begin_group',
	'end_group',
	'begin_repeat',
	'end_repeat'
]);

function normalizeName(value: string): string {
	return safeTrim(value).toLowerCase().replace(/\s+/g, '');
}

function normalizeChoiceListName(value: string): string {
	return normalizeName(value).replace(/\.csv$/i, '');
}

function slugifyId(input: string): string {
	const base = input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/(^-|-$)/g, '')
		.replace(/-{2,}/g, '-');
	if (!base) {
		return 'value';
	}
	if (!/^[a-z]/.test(base)) {
		return `x-${base}`;
	}
	return base;
}

function toFieldId(rawName: string, used: Set<string>): string {
	const base = slugifyId(rawName) || 'field';
	let candidate = base;
	let suffix = 2;
	while (used.has(candidate)) {
		candidate = `${base}-${suffix++}`;
	}
	used.add(candidate);
	return candidate;
}

function safeTrim(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function truncate(value: string, maxLength: number): string {
	if (value.length <= maxLength) {
		return value;
	}
	return `${value.slice(0, maxLength - 3)}...`;
}

function normalizeLabel(value: string): string {
	return truncate(safeTrim(value), 200);
}

function normalizeHelpText(value: string): string {
	return truncate(safeTrim(value), 500);
}

function languageCodeFromHeader(header: string): string {
	const match = header.match(/\(([^)]+)\)\s*$/);
	return safeTrim(match?.[1]) || safeTrim(header);
}

function localizedColumns(
	row: XlsformFixture['survey'][number],
	prefix: string,
	maxLength: number
): Record<string, string> | undefined {
	const localized = Object.fromEntries(
		Object.entries(row)
			.filter(([key, value]) => key.startsWith(`${prefix}::`) && safeTrim(value))
			.map(([key, value]) => [
				languageCodeFromHeader(key.substring(prefix.length + 2)),
				truncate(safeTrim(value), maxLength)
			])
	);
	return Object.keys(localized).length > 0 ? localized : undefined;
}

function collectLanguages(form: XlsformFixture): string[] {
	const languages = new Set<string>();
	for (const row of form.survey || []) {
		for (const key of Object.keys(row)) {
			if (!key.includes('::')) continue;
			languages.add(languageCodeFromHeader(key.split('::')[1]));
		}
	}
	const defaultLanguage = safeTrim(form.form_settings?.default_language);
	if (defaultLanguage) languages.add(languageCodeFromHeader(defaultLanguage));
	return Array.from(languages);
}

function fieldMedia(row: XlsformFixture['survey'][number]) {
	const media = {
		image: safeTrim(row.image) || undefined,
		video: safeTrim(row.video) || undefined,
		audio: safeTrim(row.audio) || undefined,
		localizedImage: localizedColumns(row, 'image', 300),
		localizedVideo: localizedColumns(row, 'video', 300),
		localizedAudio: localizedColumns(row, 'audio', 300)
	};
	return Object.values(media).some(Boolean) ? media : undefined;
}

function parseXlsformParameters(value: unknown) {
	const raw = safeTrim(value);
	if (!raw) return {};

	const output: {
		parameters?: string;
		captureAccuracy?: number;
		warningAccuracy?: number;
		rangeStart?: number;
		rangeEnd?: number;
		rangeStep?: number;
		maxPixels?: number;
		locationPriority?: 'high-accuracy' | 'balanced' | 'low-power' | 'no-power';
		locationMinInterval?: number;
		locationMaxAge?: number;
		randomizeChoices?: boolean;
		randomizeSeed?: string;
	} = {
		parameters: truncate(raw, 500)
	};

	for (const part of raw.split(/[\s,]+/)) {
		const [key, rawValue] = part.split('=');
		if (key === 'randomize') {
			output.randomizeChoices = rawValue === 'true';
			continue;
		}
		if (key === 'seed' && safeTrim(rawValue)) {
			output.randomizeSeed = truncate(safeTrim(rawValue), 200);
			continue;
		}
		if (
			key === 'location-priority' &&
			(rawValue === 'high-accuracy' ||
				rawValue === 'balanced' ||
				rawValue === 'low-power' ||
				rawValue === 'no-power')
		) {
			output.locationPriority = rawValue;
			continue;
		}

		const numericValue = Number(rawValue);
		if (!Number.isFinite(numericValue) || numericValue <= 0) continue;
		if (key === 'capture-accuracy') output.captureAccuracy = numericValue;
		if (key === 'warning-accuracy') output.warningAccuracy = numericValue;
		if (key === 'start') output.rangeStart = numericValue;
		if (key === 'end') output.rangeEnd = numericValue;
		if (key === 'step') output.rangeStep = numericValue;
		if (key === 'max-pixels' && Number.isInteger(numericValue)) output.maxPixels = numericValue;
		if (key === 'location-min-interval' && Number.isInteger(numericValue)) {
			output.locationMinInterval = numericValue;
		}
		if (key === 'location-max-age' && Number.isInteger(numericValue)) {
			output.locationMaxAge = numericValue;
		}
	}

	return output;
}

function parseXlsFieldType(rawType: string): ParsedXlsFieldType {
	const normalized = safeTrim(rawType).toLowerCase();
	if (!normalized) {
		return { kind: 'text' };
	}

	const value = normalized.trim();
	const original = safeTrim(rawType);
	if (value === 'text') {
		return { kind: 'text' };
	}
	if (value === 'integer') {
		return { kind: 'integer' };
	}
	if (value === 'decimal' || value === 'decimal ') {
		return { kind: 'decimal' };
	}
	if (value === 'range') {
		return { kind: 'range' };
	}
	if (value === 'date') {
		return { kind: 'date' };
	}
	if (value === 'datetime') {
		return { kind: 'datetime' };
	}
	if (value === 'boolean') {
		return { kind: 'boolean' };
	}
	if (value === 'note') {
		return { kind: 'note' };
	}
	if (value === 'geopoint' || value === 'geotrace' || value === 'geoshape') {
		return { kind: value };
	}
	if (value === 'image') {
		return { kind: 'image' };
	}
	if (value === 'barcode') {
		return { kind: 'barcode' };
	}
	if (value.startsWith('select_one_from_file')) {
		const listName = safeTrim(original.substring('select_one_from_file'.length));
		return { kind: 'select_one_from_file', listName };
	}
	if (value.startsWith('select_one')) {
		const listName = safeTrim(original.substring('select_one'.length));
		return { kind: 'select_one', listName };
	}
	if (value.startsWith('select_multiple')) {
		const listName = safeTrim(original.substring('select_multiple'.length));
		return { kind: 'select_multiple', listName };
	}
	if (value === 'begin_group') {
		return { kind: 'begin_group' };
	}
	if (value === 'end_group') {
		return { kind: 'end_group' };
	}
	if (value === 'begin_repeat') {
		return { kind: 'begin_repeat' };
	}
	if (value === 'end_repeat') {
		return { kind: 'end_repeat' };
	}
	if (value === 'begin group') {
		return { kind: 'begin_group' };
	}
	if (value === 'end group') {
		return { kind: 'end_group' };
	}
	if (value === 'begin repeat') {
		return { kind: 'begin_repeat' };
	}
	if (value === 'end repeat') {
		return { kind: 'end_repeat' };
	}
	if (
		value === 'start' ||
		value === 'end' ||
		value === 'today' ||
		value === 'deviceid' ||
		value === 'phonenumber' ||
		value === 'username' ||
		value === 'email'
	) {
		return { kind: value as XlsformTypeKind };
	}
	if (value === 'audit') {
		return { kind: 'audit' };
	}
	if (value === 'calculate' || value === 'default' || value === 'instance') {
		return { kind: value as XlsformTypeKind };
	}

	return { kind: 'unknown' };
}

function collectChoiceGroups(rows: XlsformChoiceRow[]): Map<string, XlsformChoiceRow[]> {
	const map = new Map<string, XlsformChoiceRow[]>();
	for (const row of rows) {
		const listName = safeTrim(row.list_name);
		if (!listName || !row.name) {
			continue;
		}
		const key = normalizeChoiceListName(listName);
		const current = map.get(key) ?? [];
		current.push(row);
		map.set(key, current);
	}
	return map;
}

function collectEntityRows(rows: XlsformEntityRow[]): Map<string, XlsformEntityRow> {
	const map = new Map<string, XlsformEntityRow>();
	for (const row of rows) {
		const listName = safeTrim(row.list_name);
		if (!listName) {
			continue;
		}
		map.set(normalizeEntityListName(listName), row);
	}
	return map;
}

function normalizeEntityListName(value: string): string {
	return safeTrim(value)
		.replace(/\.csv$/i, '')
		.replace(/[\s_]+/g, '')
		.replace(/[0-9]+$/g, '')
		.toLowerCase();
}

function findEntityConfig(
	entities: Map<string, XlsformEntityRow>,
	listName: string
): XlsformEntityRow | undefined {
	const normalized = normalizeEntityListName(listName);
	if (!entities.size) {
		return undefined;
	}
	return entities.get(normalized) ?? entities.values().next().value;
}

function addIssue(
	issues: XlsformUnsupportedItem[],
	kind: XlsformIssueKind,
	code: string,
	fieldName: string | undefined,
	detail: string
): void {
	issues.push({
		kind,
		code,
		field: fieldName,
		detail
	});
}

function parseChoiceBound(
	fieldName: string,
	value: number,
	operator: string
): {
	min?: number;
	max?: number;
} {
	const trimmed = safeTrim(operator);
	if (!trimmed) {
		return {};
	}

	switch (trimmed) {
		case '>':
			return { min: value + Number.EPSILON };
		case '>=':
			return { min: value };
		case '<':
			return { max: value - Number.EPSILON };
		case '<=':
			return { max: value };
		default:
			return {};
	}
}

function parseNumericConstraint(
	rawConstraint: string,
	fieldName: string
): {
	min?: number;
	max?: number;
} {
	const normalized = safeTrim(rawConstraint).replace(/\$\{([^}]+)\}/g, '$1');
	if (!normalized) {
		return {};
	}

	const clausePatterns = [
		new RegExp(`^\\(?\\s*${fieldName}\\s*(>=|>|<=|<)\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)?$`),
		new RegExp(`^\\(?\\s*(-?\\d+(?:\\.\\d+)?)\\s*(>=|>|<=|<)\\s*${fieldName}\\s*\\)?$`)
	];

	const bounds: Array<{ min?: number; max?: number }> = [];
	const parts = normalized.split(/\s+and\s+/i);
	for (const part of parts) {
		const trimmed = part.trim();
		if (!trimmed) {
			continue;
		}
		let parsed = false;
		for (const pattern of clausePatterns) {
			const match = trimmed.match(pattern);
			if (!match) {
				continue;
			}
			const operator = match[1]!;
			const value = Number(match[2]);
			if (!Number.isFinite(value)) {
				break;
			}
			bounds.push(parseChoiceBound(fieldName, value, operator));
			parsed = true;
			break;
		}
		if (!parsed) {
			return {};
		}
	}

	if (!bounds.length) {
		return {};
	}

	let min: number | undefined;
	let max: number | undefined;
	for (const bound of bounds) {
		if (bound.min !== undefined) {
			min = min === undefined ? bound.min : Math.max(min, bound.min);
		}
		if (bound.max !== undefined) {
			max = max === undefined ? bound.max : Math.min(max, bound.max);
		}
	}

	return { min, max };
}

function mapChoiceSetForField(
	fieldName: string,
	parsedType: ParsedXlsFieldType,
	choiceGroups: Map<string, XlsformChoiceRow[]>,
	entities: Map<string, XlsformEntityRow>,
	issues: XlsformUnsupportedItem[],
	formSlug: string
): EmrChoiceSet | undefined {
	if (!parsedType.listName) {
		addIssue(
			issues,
			'unsupported-type',
			'missing-choice-list',
			fieldName,
			'Choice list name is missing.'
		);
		return undefined;
	}

	if (parsedType.kind === 'select_one_from_file' || parsedType.kind === 'unknown') {
		const listName = parsedType.listName;
		const sourceName = normalizeEntityListName(listName).replace(/[^a-z0-9]+/g, '-');
		const entityConfig = findEntityConfig(entities, listName);

		if (!entityConfig) {
			addIssue(
				issues,
				'unsupported-handoff',
				'entity-csv-metadata-missing',
				fieldName,
				`No entities sheet metadata for "${listName}".`
			);
		}

		return {
			source: {
				kind: 'clinical_worklist',
				name: `${formSlug}-${sourceName}`,
				valueField: 'name',
				labelField: 'label',
				filter: {
					source_file: listName,
					create_if: entityConfig?.create_if ?? '',
					label_template: entityConfig?.label ?? '',
					handoff: 'entity-csv'
				}
			}
		};
	}

	const listRows = parsedType.listName
		? choiceGroups.get(normalizeChoiceListName(parsedType.listName))
		: undefined;
	if (!listRows || listRows.length === 0) {
		addIssue(
			issues,
			'missing-choice-list',
			'choice-source-missing',
			fieldName,
			`Missing static choice list "${parsedType.listName}".`
		);
		return undefined;
	}

	return {
		choices: listRows
			.map((row) => ({
				value: safeTrim(row.name),
				label: safeTrim(row.label) || safeTrim(row.name),
				disabled: false
			}))
			.filter((choice) => Boolean(choice.value))
	};
}

function mapField(row: XlsformFixture['survey'][number], context: FieldMapContext): void {
	const name = safeTrim(row.name);
	const label = safeTrim(row.label);
	const rawType = parseXlsFieldType(safeTrim(row.type));
	const isSystemField = SYSTEM_NAME_PREFIXES.some((prefix) => name.startsWith(prefix));

	if (!name) {
		addIssue(
			context.issues,
			'unsupported-type',
			'missing-name',
			undefined,
			`Survey row missing name (type: ${safeTrim(row.type)})`
		);
		return;
	}

	if (isSystemField || SKIP_FIELD_TYPES.has(rawType.kind)) {
		if (isSystemField) {
			addIssue(
				context.issues,
				'system-field',
				'system-prefix',
				name,
				`Skipping system field ${name}`
			);
		}
		return;
	}

	if (GROUP_TYPES.has(rawType.kind)) {
		return;
	}

	if (CALCULATION_TYPES.has(rawType.kind)) {
		addIssue(
			context.issues,
			'unsupported-type',
			'calculation',
			name,
			`Unsupported calculated field: ${name}`
		);
		return;
	}

	const mappedType = (() => {
		switch (rawType.kind) {
			case 'select_one':
			case 'select_one_from_file':
				return 'single_choice';
			case 'select_multiple':
				return 'multi_choice';
			case 'geopoint':
			case 'geotrace':
			case 'geoshape':
			case 'range':
			case 'image':
			case 'audit':
			case 'calculate':
				return rawType.kind;
			case 'barcode':
				return 'text';
			case 'note':
				return 'instructions';
			case 'datetime':
				return 'datetime';
			case 'integer':
			case 'decimal':
			case 'date':
			case 'text':
			case 'boolean':
				return rawType.kind;
			default:
				addIssue(
					context.issues,
					'unsupported-type',
					'unknown-type',
					name,
					`Unknown XLSForm type "${safeTrim(row.type)}"; mapped to text.`
				);
				return 'text';
		}
	})();

	const fieldId = toFieldId(name, context.usedFieldKeys);
	const isRequired = safeTrim(row.required).toLowerCase() === 'yes';
	if (safeTrim(row.required) && !isRequired) {
		addIssue(
			context.issues,
			'unsupported-expression',
			'required-expression',
			name,
			`Required expression "${safeTrim(row.required)}" preserved in issue list.`
		);
	}

	const choiceSet =
		mappedType === 'single_choice' || mappedType === 'multi_choice'
			? mapChoiceSetForField(
					name,
					rawType,
					context.choiceGroups,
					context.entityRows,
					context.issues,
					context.formSlug
				)
			: undefined;

	let validation;
	if (row.constraint) {
		const parsed = parseNumericConstraint(row.constraint, name);
		if (Object.keys(parsed).length > 0) {
			validation = parsed;
		} else {
			addIssue(
				context.issues,
				'unsupported-expression',
				'constraint-expression',
				name,
				`Constraint not mapped: ${safeTrim(row.constraint)}`
			);
		}
	}

	const readOnlyValue = safeTrim(row.read_only) || safeTrim(row.readonly);
	const isReadOnly = ['true', 'yes'].includes(readOnlyValue.toLowerCase());
	const isHiddenCalculation =
		Boolean(safeTrim(row.calculation)) && !safeTrim(row.label) && !safeTrim(row.hint);
	const requiredExpression =
		safeTrim(row.required) && !isRequired ? { value: safeTrim(row.required) } : undefined;
	const parameterMetadata = parseXlsformParameters(row.parameters);
	const fieldLogic = {
		required: requiredExpression,
		relevance: safeTrim(row.relevant) ? { value: safeTrim(row.relevant) } : undefined,
		constraint: safeTrim(row.constraint) ? { value: safeTrim(row.constraint) } : undefined,
		constraintMessage: safeTrim(row.constraint_message) || undefined,
		calculation: safeTrim(row.calculation) ? { value: safeTrim(row.calculation) } : undefined,
		trigger: safeTrim(row.trigger) || undefined,
		choiceFilter: safeTrim(row.choice_filter) || undefined,
		randomizeChoices: parameterMetadata.randomizeChoices,
		randomizeSeed: parameterMetadata.randomizeSeed
	};
	const fieldInput = {
		barcodeInput: rawType.kind === 'barcode' || undefined,
		captureAccuracy: parameterMetadata.captureAccuracy,
		warningAccuracy: parameterMetadata.warningAccuracy,
		rangeStart: parameterMetadata.rangeStart,
		rangeEnd: parameterMetadata.rangeEnd,
		rangeStep: parameterMetadata.rangeStep,
		maxPixels: parameterMetadata.maxPixels,
		locationPriority: parameterMetadata.locationPriority,
		locationMinInterval: parameterMetadata.locationMinInterval,
		locationMaxAge: parameterMetadata.locationMaxAge
	};

	context.section.section.fields.push({
		id: fieldId,
		key: fieldId,
		label: normalizeLabel(label || name),
		...(localizedColumns(row, 'label', 200)
			? { localizedLabel: localizedColumns(row, 'label', 200) }
			: {}),
		type: mappedType,
		order: context.section.order++,
		required: isRequired,
		fieldName: name,
		xlsv1Name: name,
		...(safeTrim(row.hint) ? { helpText: normalizeHelpText(safeTrim(row.hint)) } : {}),
		...(localizedColumns(row, 'hint', 500)
			? { localizedHint: localizedColumns(row, 'hint', 500) }
			: {}),
		...(safeTrim(row.guidance_hint)
			? { guidanceHint: truncate(safeTrim(row.guidance_hint), 1000) }
			: {}),
		...(localizedColumns(row, 'guidance_hint', 1000)
			? { localizedGuidanceHint: localizedColumns(row, 'guidance_hint', 1000) }
			: {}),
		...(fieldMedia(row) ? { media: fieldMedia(row) } : {}),
		hidden: isHiddenCalculation,
		analytics: [],
		width: 'full',
		readOnly: isReadOnly,
		defaultValue: safeTrim(row.default) || undefined,
		appearance: safeTrim(row.appearance) || undefined,
		logic: Object.values(fieldLogic).some((value) => value !== undefined) ? fieldLogic : undefined,
		input: Object.values(fieldInput).some((value) => value !== undefined) ? fieldInput : undefined,
		odkBind: {
			xlsformName: name,
			required: requiredExpression,
			appearance: safeTrim(row.appearance) || undefined,
			choiceSource: rawType.kind === 'select_one_from_file' ? rawType.listName : undefined,
			choiceFilter: safeTrim(row.choice_filter) || undefined,
			relevant: safeTrim(row.relevant) ? { value: safeTrim(row.relevant) } : undefined,
			constraint: safeTrim(row.constraint) ? { value: safeTrim(row.constraint) } : undefined,
			constraintMessage: safeTrim(row.constraint_message) || undefined,
			calculation: safeTrim(row.calculation) ? { value: safeTrim(row.calculation) } : undefined,
			trigger: safeTrim(row.trigger) || undefined,
			barcodeInput: rawType.kind === 'barcode' || undefined,
			...parameterMetadata
		},
		...(validation || safeTrim(row.required_message)
			? {
					validation: {
						...(validation ?? {}),
						requiredMessage: safeTrim(row.required_message) || undefined
					}
				}
			: {}),
		...(choiceSet ? { choiceSet } : {}),
		...(rawType.kind === 'note' ? { readOnly: true, readonly: true } : {}),
		...(isReadOnly ? { readonly: true } : {})
	});

	if (choiceSet?.choices?.length === 0) {
		addIssue(
			context.issues,
			'missing-choice-list',
			'choice-source-empty',
			name,
			`Choice list "${safeTrim(row.type)}" has no entries.`
		);
	}

	context.usedFieldKeys.add(fieldId);
}

function createSection(
	offlineName: string,
	kind: EmrLayoutSection['kind'],
	order: number,
	relevant?: string,
	repeatCount?: string,
	appearance?: string
): EmrLayoutSection {
	const id = slugifyId(offlineName || `section-${order}`);
	const title = safeTrim(offlineName) || 'Section';
	return {
		id: id || `section-${order}`,
		title,
		kind,
		order,
		fields: [],
		sections: [],
		rules: [],
		odk: {
			xlsformName: offlineName,
			appearance: safeTrim(appearance) || undefined,
			relevant: safeTrim(relevant) || undefined,
			repeat: safeTrim(repeatCount) ? { count: { value: safeTrim(repeatCount) } } : undefined
		},
		collapsible: false,
		defaultCollapsed: false
	};
}

function mapSectionName(typeName: string, typeLabel: string): string {
	return safeTrim(typeLabel) || safeTrim(typeName) || 'Section';
}

function parseNumericVersion(formVersion: string | undefined): number {
	if (!formVersion) {
		return 1;
	}
	const first = safeTrim(formVersion)
		.split('.')
		.find((token) => token.trim().length > 0);
	const parsed = first ? Number(first) : Number.NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function convertXlsformToEmrDefinition(form: XlsformFixture): XlsformImportResult {
	const issues: XlsformUnsupportedItem[] = [];
	const choiceGroups = collectChoiceGroups(form.choices || []);
	const entityRows = collectEntityRows(form.entities || []);
	const usedFieldKeys = new Set<string>();
	const languages = collectLanguages(form);
	const defaultLanguage = safeTrim(form.form_settings?.default_language);
	const formStyle = safeTrim(form.form_settings?.style);

	const rootSection: EmrLayoutSection = createSection(
		form.form_settings?.form_title || form.form,
		'section',
		0
	);
	const stack: SectionState[] = [
		{
			section: rootSection,
			order: 0,
			fieldIds: new Set()
		}
	];

	let nextSectionOrder = 1;

	for (const row of form.survey || []) {
		const parsed = parseXlsFieldType(safeTrim(row.type));

		if (parsed.kind === 'begin_group' || parsed.kind === 'begin_repeat') {
			const groupTitle = mapSectionName(safeTrim(row.name), safeTrim(row.label));
			const groupSection = createSection(
				groupTitle,
				parsed.kind === 'begin_repeat' ? 'repeatable_group' : 'group',
				nextSectionOrder++,
				safeTrim(row.relevant),
				safeTrim(row.repeat_count),
				safeTrim(row.appearance)
			);
			const parent = stack[stack.length - 1];
			parent.section.sections.push(groupSection);
			parent.order = Math.max(
				parent.order,
				parent.section.fields.length + parent.section.sections.length
			);
			stack.push({
				section: groupSection,
				order: 0,
				fieldIds: new Set()
			});
			continue;
		}

		if (parsed.kind === 'end_group' || parsed.kind === 'end_repeat') {
			if (stack.length > 1) {
				stack.pop();
			}
			continue;
		}

		mapField(row, {
			section: stack[stack.length - 1],
			issues,
			choiceGroups,
			entityRows,
			formSlug: form.slug,
			usedFieldKeys
		});
	}

	const noteType = (() => {
		const lower = safeTrim(form.form).toLowerCase();
		if (lower.includes('followup')) {
			return 'pec-cataract-followup';
		}
		if (lower.includes('surgery')) {
			return 'pec-cataract-surgery';
		}
		if (lower.includes('reported')) {
			return 'pec-reported-patient';
		}
		if (lower.includes('opd')) {
			return 'pec-opd';
		}
		return 'pec';
	})();

	const definition = parseEmrNoteDefinition({
		metadata: {
			definitionId: slugifyId(form.slug),
			slug: `${slugifyId(form.slug)}-definition`,
			title: safeTrim(form.form_settings?.form_title || form.form).replace(/\.xlsx$/i, ''),
			noteType,
			specialty: 'ophthalmology',
			version: parseNumericVersion(form.form_settings?.version),
			defaultLanguage: defaultLanguage || undefined,
			languages,
			formStyle: formStyle || undefined,
			tags: ['xlsform-import', 'pec-forms', `source-${slugifyId(form.form).slice(0, 90)}`],
			description: safeTrim(
				`Source XLSForm ${safeTrim(form.form)}${form.form_settings?.form_id ? ` (${form.form_settings.form_id})` : ''}`
			)
		},
		layout: {
			sections: [rootSection]
		},
		rules: [],
		actions: [],
		analytics: {}
	});

	return {
		definitionId: slugifyId(form.slug),
		definition,
		issues
	};
}
