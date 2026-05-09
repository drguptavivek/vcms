<script lang="ts">
	import { browser } from '$app/environment';
	import { base, resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import {
		moveFieldInDefinition,
		moveSectionInDefinition,
		type EmrBuilderDefinition,
		type EmrBuilderField,
		type EmrBuilderSection,
		type EmrBuilderSelection
	} from '$lib/components/emr-builder/emr-builder-reorder-model';
	import EmrBuilderCanvas from '$lib/components/emr-builder/EmrBuilderCanvas.svelte';
	import EmrBuilderInspector from '$lib/components/emr-builder/EmrBuilderInspector.svelte';

	type ApiEnvelopeSuccess<T> = {
		ok: true;
		data: T;
		requestId: string;
	};
	type ApiEnvelopeFailure = {
		ok: false;
		error: { message: string };
		requestId: string;
	};
	type ApiEnvelope<T> = ApiEnvelopeSuccess<T> | ApiEnvelopeFailure;
	type DictionaryTab = 'fields' | 'option-sets' | 'fragments';
	type OpenEhrMapping = {
		archetypeId?: string;
		archetypePath?: string;
		templateId?: string;
		templatePath?: string;
		webTemplatePath?: string;
		archetypeStructure?: 'ENTRY' | 'CLUSTER';
		terminologyCode?: string;
		rmType?: string;
		dataValueType?: string;
	};
	type DictionaryKind = 'field' | 'option_set' | 'fragment';
	type DictionarySource = 'local' | 'api' | string;
	type DictionaryTemplateMetadata = {
		source?: DictionarySource;
		version?: string;
		hash?: string;
		dictionaryId?: string;
		key?: string;
		kind?: DictionaryKind;
		status?: string;
		title?: string;
		id?: string;
	};
	type DictionaryChoice = {
		value: string;
		label: string;
		disabled?: boolean;
		code?: string;
		codeSystem?: string;
		openEhrMapping?: OpenEhrMapping;
	};
	type DictionaryChoiceSetPayload = {
		choices: DictionaryChoice[];
	};
	type DictionaryFieldTemplate = {
		id: string;
		label: string;
		type: string;
		fieldName: string;
		key?: string;
		choiceSet?: DictionaryChoiceSetPayload;
		openEhrMapping?: OpenEhrMapping;
		metadata?: DictionaryTemplateMetadata;
	};
	type DictionaryOptionSetTemplate = {
		id: string;
		label: string;
		choices: DictionaryChoice[];
		openEhrMapping?: OpenEhrMapping;
		metadata?: DictionaryTemplateMetadata;
	};
	type DictionaryFragmentTemplate = {
		id: string;
		label: string;
		fields: Array<string | DictionaryFieldTemplate>;
		openEhrMapping?: OpenEhrMapping;
		metadata?: DictionaryTemplateMetadata;
	};
	type DictionaryPayload = {
		fields: DictionaryFieldTemplate[];
		optionSets: DictionaryOptionSetTemplate[];
		fragments: DictionaryFragmentTemplate[];
		source?: DictionarySource;
		hash?: string;
		version?: string;
	};
	type DictionaryDictionaryRef = {
		kind: DictionaryKind;
		id: string;
		dictionaryId?: string;
		version?: string;
		hash?: string;
		source?: DictionarySource;
		snapshot?: Record<string, unknown>;
	};
	type EmrDictionaryAssetRecord = {
		dictionaryId?: unknown;
		key?: unknown;
		kind?: unknown;
		title?: unknown;
		status?: unknown;
		tags?: unknown;
		payload?: unknown;
		payloadJson?: unknown;
		version?: unknown;
		versionHash?: unknown;
		source?: unknown;
		fieldCount?: unknown;
		optionSetCount?: unknown;
		fragmentCount?: unknown;
		description?: unknown;
		specialty?: unknown;
		id?: unknown;
		createdAt?: unknown;
		updatedAt?: unknown;
	};
	type DictionaryVersionRecord = {
		version?: unknown;
		versionHash?: unknown;
		payloadJson?: unknown;
		payload?: unknown;
	};
	type EmrBuilderDefinitionRecord = {
		id: string;
		definitionId: string;
		slug: string;
		title: string;
		noteType: string;
		specialty?: string | null;
		status: string;
		version: number;
		locale?: string | null;
		tags?: unknown;
		ownerTeam?: string | null;
	};

	type Props = {
		initialDefinitionId?: string;
		initialDefinition?: EmrBuilderDefinition | null;
		initialDefinitionRecord?: EmrBuilderDefinitionRecord | null;
		initialDraftPayload?: unknown;
		initialMessage?: string;
		dictionaryData?: Partial<DictionaryPayload>;
		dictionaryEndpoints?: string[];
	};

	const props: Props = $props();

	const storageKey = 'vcms.emr-builder.recent-definition-ids.v1';
	const maxRecentDefinitions = 24;
	const fieldPalette = [
		{ type: 'text', label: 'Text', group: 'Survey' },
		{ type: 'integer', label: 'Integer', group: 'Survey' },
		{ type: 'decimal', label: 'Decimal', group: 'Survey' },
		{ type: 'range', label: 'Range', group: 'Survey' },
		{ type: 'date', label: 'Date', group: 'Survey' },
		{ type: 'single_choice', label: 'Select one', group: 'Choices' },
		{ type: 'multi_choice', label: 'Select many', group: 'Choices' },
		{ type: 'geopoint', label: 'GPS point', group: 'Location' },
		{ type: 'geotrace', label: 'GPS line', group: 'Location' },
		{ type: 'geoshape', label: 'GPS shape', group: 'Location' },
		{ type: 'instructions', label: 'Note', group: 'Display' },
		{ type: 'calculate', label: 'Calculate', group: 'Logic' },
		{ type: 'barcode', label: 'Barcode', group: 'Clinical' },
		{ type: 'image', label: 'Image', group: 'Clinical' }
	] as const;
	const sectionColorPalette = [
		'#2563eb',
		'#0f766e',
		'#7c3aed',
		'#be123c',
		'#b45309',
		'#047857',
		'#0369a1',
		'#a21caf'
	] as const;
	const localDictionaryAssets: DictionaryPayload = normalizeDictionaryPayload({
		source: 'local-fallback',
		version: '1',
		fields: [
			{
				id: 'opd_number',
				label: 'OPD Number',
				type: 'text',
				fieldName: 'opd',
				key: 'opd',
				openEhrMapping: {
					templateId: 'vcms_pec_opd_register',
					webTemplatePath: 'pec_opd_register/context/opd_number',
					rmType: 'ELEMENT',
					dataValueType: 'DV_TEXT'
				}
			},
			{
				id: 'patient_name',
				label: 'Patient Name',
				type: 'text',
				fieldName: 'patient_name',
				openEhrMapping: {
					templateId: 'vcms_pec_opd_register',
					webTemplatePath: 'pec_opd_register/patient/name',
					rmType: 'ELEMENT',
					dataValueType: 'DV_TEXT'
				}
			},
			{
				id: 'age_years',
				label: 'Age in years',
				type: 'integer',
				fieldName: 'age_years',
				openEhrMapping: {
					templateId: 'vcms_pec_opd_register',
					webTemplatePath: 'pec_opd_register/patient/age_years',
					rmType: 'ELEMENT',
					dataValueType: 'DV_COUNT'
				}
			},
			{
				id: 'phone_number',
				label: 'Phone Number',
				type: 'text',
				fieldName: 'phone_number',
				openEhrMapping: {
					templateId: 'vcms_pec_opd_register',
					webTemplatePath: 'pec_opd_register/patient/phone_number',
					rmType: 'ELEMENT',
					dataValueType: 'DV_TEXT'
				}
			},
			{
				id: 'vision_centre',
				label: 'Vision Centre',
				type: 'single_choice',
				fieldName: 'vision_centre',
				openEhrMapping: {
					templateId: 'vcms_pec_opd_register',
					webTemplatePath: 'pec_opd_register/context/vision_centre',
					rmType: 'ELEMENT',
					dataValueType: 'DV_CODED_TEXT'
				},
				choiceSet: {
					choices: [
						{ value: 'centre_01', label: 'Vision Centre 1', disabled: false },
						{ value: 'centre_02', label: 'Vision Centre 2', disabled: false }
					]
				}
			}
		],
		optionSets: [
			{
				id: 'yes_no',
				label: 'Yes / No',
				choices: [
					{ value: 'yes', label: 'Yes', disabled: false },
					{ value: 'no', label: 'No', disabled: false }
				]
			},
			{
				id: 'sex',
				label: 'Sex',
				choices: [
					{ value: 'male', label: 'Male', disabled: false },
					{ value: 'female', label: 'Female', disabled: false },
					{ value: 'other', label: 'Other', disabled: false }
				]
			},
			{
				id: 'eye',
				label: 'Eye',
				choices: [
					{ value: 'right', label: 'Right eye', disabled: false },
					{ value: 'left', label: 'Left eye', disabled: false },
					{ value: 'both', label: 'Both eyes', disabled: false }
				]
			},
			{
				id: 'new_old',
				label: 'New / Old',
				choices: [
					{ value: 'new', label: 'New', disabled: false },
					{ value: 'old', label: 'Old', disabled: false }
				]
			}
		],
		fragments: [
			{
				id: 'patient_identity',
				label: 'Patient identity',
				fields: ['opd_number', 'patient_name', 'age_years', 'phone_number']
			},
			{
				id: 'visit_context',
				label: 'Visit context',
				fields: ['vision_centre']
			}
		]
	});

	const defaultDictionaryEndpoints = ['/api/v1/emr-builder/dictionary/list'];
	const dictionaryVersionsEndpoint = '/api/v1/emr-builder/dictionary/versions';
	const maxDictionaryAssets = 80;
	const dictionaryPayloadRequestHeaders = { accept: 'application/json' };

	function isDictionaryEndpointList(values: unknown): values is string[] {
		return Array.isArray(values) && values.every((value) => typeof value === 'string');
	}

	function isDictionaryAssetKind(value: unknown): value is DictionaryKind {
		return value === 'field' || value === 'option_set' || value === 'fragment';
	}

	function toRecord(input: unknown): Record<string, unknown> {
		return isObject(input) ? input : {};
	}

	function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
		if (!isObject(value)) return false;
		return typeof (value as { ok?: unknown }).ok === 'boolean';
	}

	function parseApiEnvelopePayload<T>(value: unknown): T | null {
		if (!isApiEnvelope(value)) {
			return null;
		}

		if (value.ok) {
			return value.data as T;
		}

		return null;
	}

	function normalizeOpenEhrMapping(value: unknown): OpenEhrMapping | undefined {
		if (!isObject(value)) return undefined;
		const source = value as Record<string, unknown>;
		const next: OpenEhrMapping = {
			archetypeId: normalizeString(source.archetypeId, ''),
			archetypePath: normalizeString(source.archetypePath, ''),
			templateId: normalizeString(source.templateId, ''),
			templatePath: normalizeString(source.templatePath, ''),
			webTemplatePath: normalizeString(source.webTemplatePath, ''),
			terminologyCode: normalizeString(source.terminologyCode, ''),
			rmType: normalizeString(source.rmType, ''),
			dataValueType: normalizeString(source.dataValueType, ''),
			archetypeStructure:
				source.archetypeStructure === 'ENTRY' || source.archetypeStructure === 'CLUSTER'
					? source.archetypeStructure
					: undefined
		};
		const hasAny = Object.values(next).some((value) => typeof value === 'string' || value === true);
		return hasAny ? next : undefined;
	}

	function clonePayload<T>(value: T) {
		try {
			return structuredClone(value) as T;
		} catch {
			return JSON.parse(JSON.stringify(value)) as T;
		}
	}

	function normalizeChoice(value: unknown): DictionaryChoice | null {
		if (!isObject(value)) return null;
		const choice = value as Record<string, unknown>;
		const choiceValue = normalizeString(choice.value, '');
		const choiceLabel = normalizeString(choice.label, '');
		if (!choiceValue || !choiceLabel) return null;
		const normalized: DictionaryChoice = {
			value: choiceValue,
			label: choiceLabel,
			disabled: typeof choice.disabled === 'boolean' ? choice.disabled : false
		};
		const openEhrMapping = normalizeOpenEhrMapping(choice.openEhrMapping);
		if (openEhrMapping) normalized.openEhrMapping = openEhrMapping;
		if (typeof choice.code === 'string') normalized.code = choice.code;
		if (typeof choice.codeSystem === 'string') normalized.codeSystem = choice.codeSystem;
		return normalized;
	}

	function normalizeChoiceSet(value: unknown): DictionaryChoiceSetPayload | undefined {
		const rawChoices = Array.isArray(value)
			? value
			: isObject(value) && Array.isArray((value as { choices?: unknown }).choices)
				? ((value as { choices?: unknown[] }).choices ?? [])
				: null;
		if (!rawChoices) return undefined;
		const normalized = rawChoices
			.map((entry) => normalizeChoice(entry))
			.filter((entry): entry is DictionaryChoice => entry !== null);
		if (normalized.length === 0) {
			return { choices: [] };
		}
		return { choices: normalized };
	}

	function normalizeFieldTemplate(
		input: unknown,
		index: number,
		fallbackId: string,
		metadata: DictionaryTemplateMetadata
	): DictionaryFieldTemplate | null {
		if (!isObject(input)) return null;
		const source = input as Record<string, unknown>;
		const id = normalizeString(source.id, fallbackId);
		const label = normalizeString(source.label, id);
		const type = normalizeString(source.type, 'text');
		const fieldName = normalizeString(
			source.fieldName,
			normalizeString(source.name, normalizeString(source.key, id))
		);
		if (!fieldName) return null;
		const rawChoiceSet = normalizeChoiceSet(source.choiceSet) ?? normalizeChoiceSet(source.choices);

		return {
			id,
			label,
			type,
			fieldName,
			key: normalizeString(source.key, id),
			choiceSet: rawChoiceSet,
			openEhrMapping: normalizeOpenEhrMapping(source.openEhrMapping),
			metadata: {
				...metadata,
				source: normalizeString(metadata.source, 'local')
			}
		};
	}

	function normalizeOptionSetTemplate(
		input: unknown,
		index: number,
		metadata: DictionaryTemplateMetadata
	): DictionaryOptionSetTemplate | null {
		if (!isObject(input)) return null;
		const source = input as Record<string, unknown>;
		const id = normalizeString(source.id, `option_set_${index + 1}`);
		const label = normalizeString(source.label, id);
		const choices = normalizeChoiceSet(source.choices) ?? normalizeChoiceSet(source.choiceSet);
		return {
			id,
			label,
			choices: choices?.choices ?? [],
			openEhrMapping: normalizeOpenEhrMapping(source.openEhrMapping),
			metadata: {
				...metadata,
				source: normalizeString(metadata.source, 'local')
			}
		};
	}

	function normalizeFragmentTemplate(
		input: unknown,
		index: number,
		metadata: DictionaryTemplateMetadata
	): DictionaryFragmentTemplate | null {
		if (!isObject(input)) return null;
		const source = input as Record<string, unknown>;
		const id = normalizeString(source.id, `fragment_${index + 1}`);
		const label = normalizeString(source.label, id);
		const rawFields = Array.isArray(source.fields) ? source.fields : [];
		const rawSections = Array.isArray(source.sections) ? source.sections : [];
		const fields: Array<string | DictionaryFieldTemplate> = rawFields
			.map((entry, fieldIndex) => {
				if (typeof entry === 'string') return normalizeString(entry, `field_${fieldIndex + 1}`);
				const normalized = normalizeFieldTemplate(
					entry,
					fieldIndex,
					`${id}-field-${fieldIndex + 1}`,
					metadata
				);
				return (
					normalized ??
					normalizeString((entry as Record<string, unknown>).id, `field_${fieldIndex + 1}`)
				);
			})
			.filter(
				(entry): entry is string | DictionaryFieldTemplate =>
					typeof entry === 'string' || entry !== null
			);
		const nestedFields = rawSections.flatMap((entry, sectionIndex) => {
			if (!isObject(entry)) return [];
			const nestedSectionFields = (entry as { fields?: unknown }).fields;
			if (!Array.isArray(nestedSectionFields)) return [];
			return normalizeFragmentFields(
				{ fields: nestedSectionFields },
				metadata,
				`${id}-section-${sectionIndex + 1}`
			);
		});

		return {
			id,
			label,
			fields: [...fields, ...nestedFields],
			openEhrMapping: normalizeOpenEhrMapping(source.openEhrMapping),
			metadata: {
				...metadata,
				source: normalizeString(metadata.source, 'local')
			}
		};
	}

	function normalizeDictionaryPayload(input: unknown): DictionaryPayload {
		const normalized = toRecord(input);
		const source = normalizeString(normalized.source, 'local');
		const baseMetadata: DictionaryTemplateMetadata = {
			source,
			version: normalizeString(normalized.version, ''),
			hash: normalizeString(normalized.hash, ''),
			kind: undefined
		};

		const fields = Array.isArray(normalized.fields)
			? normalized.fields
					.map((entry, index) =>
						normalizeFieldTemplate(entry, index, `field_${index + 1}`, {
							...baseMetadata,
							source: 'local'
						})
					)
					.filter((entry): entry is DictionaryFieldTemplate => entry !== null)
			: [];

		const optionSets = Array.isArray(normalized.optionSets)
			? normalized.optionSets
					.map((entry, index) => normalizeOptionSetTemplate(entry, index, baseMetadata))
					.filter((entry): entry is DictionaryOptionSetTemplate => entry !== null)
			: [];

		const fragments = Array.isArray(normalized.fragments)
			? normalized.fragments
					.map((entry, index) => normalizeFragmentTemplate(entry, index, baseMetadata))
					.filter((entry): entry is DictionaryFragmentTemplate => entry !== null)
			: [];

		return {
			source,
			fields,
			optionSets,
			fragments,
			version: baseMetadata.version,
			hash: baseMetadata.hash
		};
	}

	function parsePayloadJson(input: unknown) {
		if (typeof input === 'string') {
			try {
				return JSON.parse(input);
			} catch {
				return undefined;
			}
		}
		if (isObject(input)) return input;
		return undefined;
	}

	function normalizeApiAsset(asset: EmrDictionaryAssetRecord, index: number): DictionaryPayload {
		const kind = isDictionaryAssetKind(asset.kind) ? asset.kind : undefined;
		const dictionaryId = normalizeString(asset.dictionaryId, '');
		const key = normalizeString(asset.key, `asset_${index + 1}`);
		const payload = parsePayloadJson(asset.payload ?? asset.payloadJson);
		const metadata: DictionaryTemplateMetadata = {
			source: normalizeString(asset.source, 'api'),
			kind,
			key,
			dictionaryId,
			version: normalizeString(asset.version, ''),
			hash: normalizeString(asset.versionHash, '')
		};

		if (!kind) {
			return { fields: [], optionSets: [], fragments: [] };
		}

		const title = normalizeString(asset.title, key);
		const fallback = {
			id: key,
			label: title,
			type: kind === 'field' ? 'text' : undefined,
			fieldName: key,
			choices: [],
			fields: []
		} satisfies Record<string, unknown>;

		switch (kind) {
			case 'field': {
				const field = normalizeFieldTemplate(payload ?? fallback, 0, `${key}-field`, metadata);
				if (!field) return { fields: [], optionSets: [], fragments: [] };
				return {
					fields: [
						{
							...field,
							id: normalizeString(field.id, key),
							label: normalizeString(field.label, normalizeString(asset.title, key)),
							fieldName: normalizeString(field.fieldName, key)
						}
					],
					optionSets: [],
					fragments: []
				};
			}
			case 'option_set': {
				const optionSet = normalizeOptionSetTemplate(
					{
						id: key,
						label: title,
						choices: normalizeChoiceSet(payload)?.choices ?? []
					},
					0,
					metadata
				);
				if (!optionSet) return { fields: [], optionSets: [], fragments: [] };
				return {
					fields: [],
					optionSets: [
						{
							...optionSet,
							id: normalizeString(optionSet.id, key),
							label: normalizeString(optionSet.label, normalizeString(asset.title, key))
						}
					],
					fragments: []
				};
			}
			case 'fragment': {
				const fragment = normalizeFragmentTemplate(
					{
						id: key,
						label: title,
						fields: normalizeFragmentFields(payload)
					},
					0,
					metadata
				);
				if (!fragment) {
					return { fields: [], optionSets: [], fragments: [] };
				}
				return {
					fields: [],
					optionSets: [],
					fragments: [fragment]
				};
			}
			default:
				return { fields: [], optionSets: [], fragments: [] };
		}
	}

	function normalizeDictionaryApiResponse(input: unknown): DictionaryPayload | null {
		if (Array.isArray(input)) {
			return input.reduce<DictionaryPayload>(
				(acc, entry, index) =>
					mergeDictionaryPayloads(acc, normalizeApiAsset(toRecord(entry), index)),
				{ fields: [], optionSets: [], fragments: [] }
			);
		}

		const normalized = toRecord(input);
		if (Array.isArray(normalized.data) || normalized.ok !== undefined) {
			const payload = parseApiEnvelopePayload<unknown>(
				normalized as ApiEnvelope<unknown>
			) as unknown;
			if (payload !== null) {
				return normalizeDictionaryApiResponse(payload) ?? normalizeDictionaryPayload(payload);
			}
		}

		if (isObject(normalized)) {
			if (Array.isArray((normalized as { fields?: unknown }).fields)) {
				return normalizeDictionaryPayload(normalized);
			}
			if (Array.isArray((normalized as { data?: unknown }).data)) {
				const payload = (normalized as { data?: unknown }).data;
				return normalizeDictionaryApiResponse(payload);
			}
		}

		return null;
	}

	function normalizeFragmentFields(
		payload: unknown,
		parentMetadata: DictionaryTemplateMetadata = {},
		fallbackPrefix = 'field'
	): Array<string | DictionaryFieldTemplate> {
		const rawFields =
			isObject(payload) && Array.isArray((payload as { fields?: unknown }).fields)
				? ((payload as { fields?: unknown }).fields as unknown[])
				: [];
		return rawFields
			.map((entry, index) => {
				if (typeof entry === 'string')
					return normalizeString(entry, `${fallbackPrefix}_${index + 1}`);
				const normalized = normalizeFieldTemplate(
					entry,
					index,
					`${fallbackPrefix}_${index + 1}`,
					parentMetadata
				);
				if (normalized) return normalized;
				return normalizeString((entry as Record<string, unknown>).id, `field_${index + 1}`);
			})
			.filter((entry): entry is string | DictionaryFieldTemplate => Boolean(entry));
	}

	function mergeDictionaryPayloads(
		base: DictionaryPayload,
		patch: DictionaryPayload
	): DictionaryPayload {
		function mergeById(
			left: Array<
				DictionaryFieldTemplate | DictionaryOptionSetTemplate | DictionaryFragmentTemplate
			>,
			right: Array<
				DictionaryFieldTemplate | DictionaryOptionSetTemplate | DictionaryFragmentTemplate
			>,
			prefix: string
		) {
			const seen = new SvelteMap<
				string,
				DictionaryFieldTemplate | DictionaryOptionSetTemplate | DictionaryFragmentTemplate
			>();
			for (const entry of [...left, ...right]) {
				if (!isObject(entry)) continue;
				if (typeof entry.id !== 'string') continue;
				seen.set(`${prefix}:${entry.id}`, entry);
			}
			return Array.from(seen.values()).map((entry) => entry);
		}

		const next: DictionaryPayload = {
			source: patch.source ?? base.source,
			version: patch.version ?? base.version,
			hash: patch.hash ?? base.hash,
			fields: [],
			optionSets: [],
			fragments: []
		};

		next.fields = mergeById(base.fields, patch.fields, 'field') as DictionaryFieldTemplate[];
		next.optionSets = mergeById(
			base.optionSets,
			patch.optionSets,
			'optionSet'
		) as DictionaryOptionSetTemplate[];
		next.fragments = mergeById(
			base.fragments,
			patch.fragments,
			'fragment'
		) as DictionaryFragmentTemplate[];

		return next;
	}

	let definitionId = $state('');
	let workingDefinition = $state<EmrBuilderDefinition | null>(null);
	let workingDefinitionJson = $state('');
	let selected = $state<EmrBuilderSelection | null>(null);
	let parseError = $state('');
	let draftMessage = $state('');
	let selectedDefinition = $state<EmrBuilderDefinitionRecord | null>(null);
	let recentDefinitionIds = $state<string[]>([]);
	let publishReason = $state('');
	let isLoading = $state(false);
	let isSaving = $state(false);
	let isPublishing = $state(false);
	let isLoaded = $state(false);
	let languageDraft = $state('');
	let activeLanguage = $state('en-IN');
	let dictionaryData = $state<DictionaryPayload | null>(null);
	let dictionarySearch = $state('');
	let dictionaryTab = $state<DictionaryTab>('fields');
	let dictionaryLoadError = $state('');

	onMount(() => {
		const initialDefinitionId = props.initialDefinitionId ?? '';
		const initialDefinition = props.initialDefinition ?? null;
		const initialDefinitionRecord = props.initialDefinitionRecord ?? null;
		const initialDraftPayload = props.initialDraftPayload;
		const initialMessage = props.initialMessage ?? '';

		definitionId = initialDefinitionId;
		dictionaryData = normalizeDictionaryPayload(props.dictionaryData);
		workingDefinition = initialDefinition;
		workingDefinitionJson = initialDefinition ? JSON.stringify(initialDefinition, null, 2) : '';
		draftMessage = initialMessage;
		selectedDefinition = initialDefinitionRecord;
		isLoaded = Boolean(initialDefinition);

		if (initialDraftPayload !== undefined && !initialDefinition) {
			const normalized = toBuilderDefinition(initialDraftPayload);
			if (normalized) {
				workingDefinition = normalized;
				workingDefinitionJson = JSON.stringify(normalized, null, 2);
				isLoaded = true;
			}
		}

		if (!browser) return;
		const raw = localStorage.getItem(storageKey);
		if (raw) {
			try {
				const parsed = JSON.parse(raw);
				if (Array.isArray(parsed)) {
					recentDefinitionIds = parsed
						.filter((value): value is string => typeof value === 'string')
						.slice(0, maxRecentDefinitions);
				}
			} catch {
				localStorage.removeItem(storageKey);
			}
		}

		if (definitionId) {
			recordRecentDefinitionId(definitionId);
		}

		void loadDictionaryAssets();
	});

	let canLoadDefinition = $derived(definitionId.trim().length > 0);
	let canSaveDraft = $derived(Boolean(workingDefinition) && !isSaving && !isLoading);
	let canPublish = $derived(
		Boolean(selectedDefinition?.definitionId) && !isPublishing && !isLoading
	);
	let formLanguages = $derived.by(() => {
		const metadata = workingDefinition?.metadata as
			| { locale?: unknown; languages?: unknown }
			| undefined;
		const locale = typeof metadata?.locale === 'string' ? metadata.locale : 'en-IN';
		const languages = Array.isArray(metadata?.languages)
			? metadata.languages.filter((value): value is string => typeof value === 'string')
			: [];
		return Array.from(new Set([locale, ...languages]));
	});
	let effectiveDictionary = $derived.by(() =>
		mergeDictionaryPayloads(
			localDictionaryAssets,
			dictionaryData ?? { fields: [], optionSets: [], fragments: [] }
		)
	);
	let dictionarySearchTerm = $derived(dictionarySearch.trim().toLowerCase());
	let dictionaryFields = $derived.by(() =>
		effectiveDictionary.fields.filter((item) => dictionaryMatches(item, dictionarySearchTerm))
	);
	let dictionaryOptionSets = $derived.by(() =>
		effectiveDictionary.optionSets.filter((item) => dictionaryMatches(item, dictionarySearchTerm))
	);
	let dictionaryFragments = $derived.by(() =>
		effectiveDictionary.fragments.filter((item) => dictionaryMatches(item, dictionarySearchTerm))
	);

	function persistRecentDefinitionIds(next: string[]) {
		if (!browser) return;
		localStorage.setItem(storageKey, JSON.stringify(next));
		recentDefinitionIds = next;
	}

	function recordRecentDefinitionId(raw: string) {
		const normalized = raw.trim().toLowerCase();
		if (!normalized) return;
		const next = [normalized, ...recentDefinitionIds.filter((entry) => entry !== normalized)].slice(
			0,
			maxRecentDefinitions
		);
		persistRecentDefinitionIds(next);
	}

	function isObject(value: unknown): value is Record<string, unknown> {
		return value !== null && typeof value === 'object';
	}

	function isDefinitionLike(value: unknown): value is Record<string, unknown> {
		return isObject(value) && isObject((value as { metadata: unknown }).metadata);
	}

	function normalizeString(value: unknown, fallback: string) {
		return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
	}

	function dictionaryMatches(
		item: DictionaryFieldTemplate | DictionaryOptionSetTemplate | DictionaryFragmentTemplate,
		term: string
	) {
		if (!term) return true;
		const searchable = [
			item.id,
			item.label,
			'fieldName' in item ? item.fieldName : '',
			item.openEhrMapping?.webTemplatePath,
			item.openEhrMapping?.archetypeId,
			item.openEhrMapping?.templateId
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();
		return searchable.includes(term);
	}

	function dictionaryRefFrom(
		kind: DictionaryKind,
		template: DictionaryFieldTemplate | DictionaryOptionSetTemplate | DictionaryFragmentTemplate
	): DictionaryDictionaryRef {
		const metadata = template.metadata ?? {};
		return {
			kind,
			id: template.id,
			dictionaryId: metadata.dictionaryId,
			version: metadata.version,
			hash: metadata.hash,
			source: metadata.source,
			snapshot: clonePayload(template) as Record<string, unknown>
		};
	}

	function cloneChoices(choices: DictionaryChoice[]) {
		return choices.map((choice) => clonePayload(choice) as Record<string, unknown>);
	}

	function dictionaryMappingSummary(item: {
		openEhrMapping?: OpenEhrMapping;
		fieldName?: string;
		choices?: DictionaryChoice[];
		fields?: Array<string | DictionaryFieldTemplate>;
	}) {
		const mapping = item.openEhrMapping;
		if (mapping?.webTemplatePath) return mapping.webTemplatePath;
		if (mapping?.archetypeId) return mapping.archetypeId;
		if ('fieldName' in item && item.fieldName) return item.fieldName;
		if ('choices' in item && Array.isArray(item.choices)) return `${item.choices.length} options`;
		if ('fields' in item && Array.isArray(item.fields)) return `${item.fields.length} fields`;
		return '';
	}

	function normalizePositiveInt(value: unknown, fallback: number) {
		if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
		if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
		return fallback;
	}

	function normalizeNumberOrder(value: unknown, fallback: number) {
		return Math.max(0, normalizePositiveInt(value, fallback));
	}

	function normalizeOdkMetadata(value: unknown) {
		return isObject(value) ? value : undefined;
	}

	function normalizeSnomedMetadata(value: unknown) {
		return isObject(value) ? value : undefined;
	}

	function normalizeField(input: unknown, fallbackIndex: number): EmrBuilderField {
		const source = isObject(input) ? input : {};
		const fieldId = normalizeString(source.id, `field-${fallbackIndex + 1}`);
		return {
			...source,
			id: fieldId,
			key: normalizeString(source.key, fieldId),
			label: normalizeString(source.label, `Field ${fallbackIndex + 1}`),
			type: normalizeString(source.type, 'text'),
			order: normalizeNumberOrder(source.order, fallbackIndex),
			odkBind: normalizeOdkMetadata(source.odkBind),
			snomed: normalizeSnomedMetadata(source.snomed)
		} as EmrBuilderField;
	}

	function normalizeSection(input: unknown, fallbackIndex: number): EmrBuilderSection {
		const source = isObject(input) ? input : {};
		const fields = Array.isArray(source.fields) ? source.fields : [];
		const sections = Array.isArray(source.sections) ? source.sections : [];
		const rules = Array.isArray(source.rules) ? source.rules : [];
		const sectionId = normalizeString(source.id, `section-${fallbackIndex + 1}`);
		return {
			...source,
			id: sectionId,
			title: normalizeString(source.title, `Section ${fallbackIndex + 1}`),
			kind: normalizeString(source.kind, 'section'),
			fields: fields.map((field, index) => normalizeField(field, index)),
			sections: sections.map((child, index) => normalizeSection(child, index)),
			rules,
			order: normalizeNumberOrder(source.order, fallbackIndex),
			odk: normalizeOdkMetadata(source.odk),
			collapsible: source.collapsible ?? false,
			defaultCollapsed: source.defaultCollapsed ?? false
		} as EmrBuilderSection;
	}

	function toBuilderDefinition(input: unknown): EmrBuilderDefinition | null {
		if (!isDefinitionLike(input)) return null;

		const layout = isObject(input.layout) ? input.layout : {};
		const metadata = isObject((input as { metadata: unknown }).metadata)
			? (input as { metadata: Record<string, unknown> }).metadata
			: {};
		return {
			...(input as Record<string, unknown>),
			metadata: {
				...(metadata as Record<string, unknown>),
				definitionId: normalizeString(metadata.definitionId, definitionId.trim()),
				slug: normalizeString(
					metadata.slug,
					normalizeString(metadata.definitionId, definitionId.trim())
				),
				title: normalizeString(metadata.title, definitionId.trim() || 'Untitled definition'),
				status: normalizeString(metadata.status, selectedDefinition?.status ?? 'draft'),
				noteType: normalizeString(metadata.noteType, 'opd'),
				version: Math.max(1, normalizePositiveInt(metadata.version, 1)),
				locale: normalizeString(metadata.locale, selectedDefinition?.locale ?? 'en-IN'),
				tags: Array.isArray(metadata.tags) ? metadata.tags : (selectedDefinition?.tags ?? []),
				ownerTeam:
					typeof metadata.ownerTeam === 'string'
						? normalizeString(metadata.ownerTeam, '') || undefined
						: undefined,
				specialty:
					typeof metadata.specialty === 'string'
						? normalizeString(metadata.specialty, '')
						: selectedDefinition?.specialty
			},
			layout: {
				sections: Array.isArray(layout.sections)
					? layout.sections.map((section, index) => normalizeSection(section, index))
					: []
			} as EmrBuilderDefinition['layout'],
			rules: Array.isArray(input.rules) ? input.rules : [],
			actions: Array.isArray(input.actions) ? input.actions : [],
			analytics: isObject(input.analytics)
				? input.analytics
				: { dimensions: [], measures: [], events: [] }
		} as EmrBuilderDefinition;
	}

	async function parseApiEnvelope<T>(response: Response): Promise<T> {
		const payload = (await response.json()) as ApiEnvelope<T>;
		if (!response.ok) {
			throw new Error('Failed to reach EMR Builder API.');
		}
		if (payload.ok === false) {
			throw new Error(payload.error?.message ?? 'Failed to reach EMR Builder API.');
		}
		return payload.data;
	}

	async function fetchDictionaryJson(endpoint: string): Promise<unknown> {
		const response = await fetch(endpoint, { headers: dictionaryPayloadRequestHeaders });
		const payload = (await response.json()) as unknown;
		if (!response.ok) {
			throw new Error('Failed to load the data dictionary.');
		}
		if (isApiEnvelope(payload) && !payload.ok) {
			throw new Error(payload.error?.message ?? 'Failed to load the data dictionary.');
		}
		return parseApiEnvelopePayload<unknown>(payload) ?? payload;
	}

	async function fetchDictionaryAssetPayload(asset: EmrDictionaryAssetRecord) {
		const dictionaryId = normalizeString(asset.dictionaryId, '');
		const key = normalizeString(asset.key, '');
		const kind = normalizeString(asset.kind, '');
		if (!dictionaryId || !key || !kind) return asset;

		const params = new URLSearchParams({ dictionaryId, key, kind });
		const versionsPayload = await fetchDictionaryJson(`${dictionaryVersionsEndpoint}?${params}`);
		const versions = Array.isArray(versionsPayload)
			? (versionsPayload as DictionaryVersionRecord[])
			: [];
		const latest = [...versions].sort(
			(left, right) =>
				normalizePositiveInt(right.version, 0) - normalizePositiveInt(left.version, 0)
		)[0];
		if (!latest) return asset;

		return {
			...asset,
			version: latest.version,
			versionHash: latest.versionHash,
			payloadJson: latest.payloadJson ?? latest.payload
		};
	}

	async function loadDictionaryAssets() {
		if (!browser) return;
		dictionaryLoadError = '';
		const endpoints = isDictionaryEndpointList(props.dictionaryEndpoints)
			? props.dictionaryEndpoints
			: defaultDictionaryEndpoints;

		try {
			let next: DictionaryPayload = { fields: [], optionSets: [], fragments: [] };
			for (const endpoint of endpoints) {
				const payload = await fetchDictionaryJson(endpoint);
				const rows = Array.isArray(payload)
					? (payload as EmrDictionaryAssetRecord[]).slice(0, maxDictionaryAssets)
					: [];

				if (rows.length > 0) {
					for (const [index, row] of rows.entries()) {
						let assetWithPayload = row;
						try {
							assetWithPayload = await fetchDictionaryAssetPayload(row);
						} catch {
							assetWithPayload = row;
						}
						next = mergeDictionaryPayloads(next, normalizeApiAsset(assetWithPayload, index));
					}
					continue;
				}

				const normalized = normalizeDictionaryApiResponse(payload);
				if (normalized) next = mergeDictionaryPayloads(next, normalized);
			}

			dictionaryData = next;
		} catch (error) {
			dictionaryLoadError =
				error instanceof Error ? error.message : 'Failed to load the data dictionary.';
		}
	}

	async function loadDefinition(event?: SubmitEvent) {
		event?.preventDefault();
		parseError = '';
		draftMessage = '';

		const normalizedId = definitionId.trim().toLowerCase();
		if (!normalizedId) {
			parseError = 'Enter a definition id.';
			return;
		}

		recordRecentDefinitionId(normalizedId);
		if (browser) {
			window.location.href = `${base}/emr-builder/${normalizedId}/edit`;
		}
	}

	function applyDraftJson() {
		parseError = '';
		try {
			const parsed = JSON.parse(workingDefinitionJson);
			const normalized = toBuilderDefinition(parsed);
			if (!normalized) {
				parseError = 'Invalid JSON shape. Add metadata and layout.sections.';
				return;
			}
			workingDefinition = normalized;
			workingDefinitionJson = JSON.stringify(workingDefinition, null, 2);
			draftMessage = `JSON applied at ${new Date().toLocaleTimeString()}.`;
		} catch {
			parseError = 'Invalid JSON format.';
		}
	}

	function syncWorkingDefinition(next: EmrBuilderDefinition) {
		workingDefinition = next;
		workingDefinitionJson = JSON.stringify(next, null, 2);
		draftMessage = `Updated order at ${new Date().toLocaleTimeString()}.`;
	}

	function syncEditedDefinition(next: EmrBuilderDefinition) {
		workingDefinition = next;
		workingDefinitionJson = JSON.stringify(next, null, 2);
		draftMessage = `Updated builder fields at ${new Date().toLocaleTimeString()}.`;
	}

	function updateMetadata(patch: Record<string, unknown>) {
		if (!workingDefinition) return;
		syncEditedDefinition({
			...workingDefinition,
			metadata: {
				...((workingDefinition.metadata ?? {}) as Record<string, unknown>),
				...patch
			}
		});
	}

	function normalizeFieldType(type: string) {
		if (type === 'number') return 'integer';
		if (type === 'note') return 'instructions';
		if (type === 'barcode') return 'text';
		return type;
	}

	function slugifyFieldName(value: string) {
		const normalized = value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '');
		return /^[a-z]/.test(normalized) ? normalized : `field_${normalized || 'new'}`;
	}

	function uniqueFieldId(base: string) {
		if (!workingDefinition) return base;
		const ids = new SvelteSet<string>();
		const collect = (sections: EmrBuilderSection[]) => {
			for (const section of sections) {
				for (const field of section.fields) ids.add(field.id);
				collect(section.sections);
			}
		};
		collect(workingDefinition.layout.sections);
		let candidate = base;
		let index = 2;
		while (ids.has(candidate)) {
			candidate = `${base}_${index}`;
			index += 1;
		}
		return candidate;
	}

	function makeField(type: string, order: number): EmrBuilderField {
		const id = uniqueFieldId(slugifyFieldName(type));
		const label = type
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
		return {
			id,
			key: id,
			label,
			type: normalizeFieldType(type),
			order,
			required: false,
			readOnly: type === 'note' || type === 'instructions' || type === 'calculate',
			readonly: type === 'note' || type === 'instructions' || type === 'calculate',
			hidden: false,
			width: 'full',
			analytics: [],
			fieldName: id,
			input: {
				barcodeInput: type === 'barcode' || undefined
			},
			logic: {
				calculation: type === 'calculate' ? { value: '' } : undefined
			},
			odkBind: {
				xlsformName: id,
				calculation: type === 'calculate' ? { value: '' } : undefined,
				barcodeInput: type === 'barcode' || undefined
			},
			...(type === 'single_choice' || type === 'multi_choice'
				? { choiceSet: { choices: [{ value: '1', label: 'Option 1', disabled: false }] } }
				: {})
		} as EmrBuilderField;
	}

	function makeDictionaryField(templateId: string, order: number): EmrBuilderField | null {
		const template = dictionaryFields.find((item) => item.id === templateId);
		if (!template) return null;
		return makeDictionaryFieldFromTemplate(template, order);
	}

	function makeDictionaryFieldFromTemplate(
		template: DictionaryFieldTemplate,
		order: number
	): EmrBuilderField {
		const id = uniqueFieldId(slugifyFieldName(template.fieldName));
		const choiceSet = template.choiceSet
			? { choices: cloneChoices(template.choiceSet.choices) }
			: undefined;
		return {
			...makeField(template.type, order),
			id,
			key: 'key' in template ? template.key : id,
			label: template.label,
			type: normalizeFieldType(template.type),
			fieldName: template.fieldName,
			choiceSet,
			openEhrMapping: template.openEhrMapping ? clonePayload(template.openEhrMapping) : undefined,
			dictionaryRef: dictionaryRefFrom('field', template)
		} as EmrBuilderField;
	}

	function mapSections(
		sections: EmrBuilderSection[],
		path: string[],
		sectionId: string,
		mapper: (section: EmrBuilderSection) => EmrBuilderSection
	): EmrBuilderSection[] {
		if (path.length === 0) {
			return sections.map((section) => (section.id === sectionId ? mapper(section) : section));
		}

		const [nextSectionId, ...remainder] = path;
		return sections.map((section) =>
			section.id === nextSectionId
				? {
						...section,
						sections: mapSections(section.sections, remainder, sectionId, mapper)
					}
				: section
		);
	}

	function updateSection(selection: EmrBuilderSelection, patch: Record<string, unknown>) {
		if (!workingDefinition || selection.type !== 'section') return;
		syncEditedDefinition({
			...workingDefinition,
			layout: {
				...workingDefinition.layout,
				sections: mapSections(
					workingDefinition.layout.sections,
					selection.path,
					selection.sectionId,
					(section) => ({
						...section,
						...patch
					})
				)
			}
		});
	}

	function updateField(selection: EmrBuilderSelection, patch: Record<string, unknown>) {
		if (!workingDefinition || selection.type !== 'field') return;
		syncEditedDefinition({
			...workingDefinition,
			layout: {
				...workingDefinition.layout,
				sections: mapSections(
					workingDefinition.layout.sections,
					selection.path,
					selection.sectionId,
					(section) => ({
						...section,
						fields: section.fields.map((field) =>
							field.id === selection.fieldId
								? {
										...field,
										...patch,
										...(patch.type === 'single_choice' || patch.type === 'multi_choice'
											? {
													choiceSet: field.choiceSet ?? {
														choices: [{ value: '1', label: 'Option 1', disabled: false }]
													}
												}
											: {})
									}
								: field
						)
					})
				)
			}
		});
	}

	function addField(sectionId: string, path: string[], type = 'text') {
		if (!workingDefinition) return;
		syncEditedDefinition({
			...workingDefinition,
			layout: {
				...workingDefinition.layout,
				sections: mapSections(workingDefinition.layout.sections, path, sectionId, (section) => ({
					...section,
					fields: [...section.fields, makeField(type, section.fields.length)]
				}))
			}
		});
	}

	function addDictionaryField(sectionId: string, path: string[], templateId: string) {
		if (!workingDefinition) return;
		syncEditedDefinition({
			...workingDefinition,
			layout: {
				...workingDefinition.layout,
				sections: mapSections(workingDefinition.layout.sections, path, sectionId, (section) => {
					const nextField = makeDictionaryField(templateId, section.fields.length);
					if (!nextField) return section;
					return {
						...section,
						fields: [...section.fields, nextField]
					};
				})
			}
		});
	}

	function addDictionaryFieldToSelection(templateId: string) {
		if (!workingDefinition) return;
		if (selected?.type === 'section' || selected?.type === 'field') {
			addDictionaryField(selected.sectionId, selected.path, templateId);
			return;
		}
		const firstSection = workingDefinition.layout.sections[0];
		if (firstSection) addDictionaryField(firstSection.id, [], templateId);
	}

	function addDictionaryFragment(fragmentId: string) {
		if (!workingDefinition) return;
		const fragment = dictionaryFragments.find((item) => item.id === fragmentId);
		if (!fragment) return;
		const targetSection =
			selected?.type === 'section' || selected?.type === 'field'
				? { sectionId: selected.sectionId, path: selected.path }
				: workingDefinition.layout.sections[0]
					? { sectionId: workingDefinition.layout.sections[0].id, path: [] }
					: null;
		if (!targetSection) return;
		syncEditedDefinition({
			...workingDefinition,
			layout: {
				...workingDefinition.layout,
				sections: mapSections(
					workingDefinition.layout.sections,
					targetSection.path,
					targetSection.sectionId,
					(section) => {
						const fields = [...section.fields];
						for (const templateRef of fragment.fields) {
							const nextField =
								typeof templateRef === 'string'
									? makeDictionaryField(templateRef, fields.length)
									: makeDictionaryFieldFromTemplate(templateRef, fields.length);
							if (nextField) fields.push(nextField);
						}
						return {
							...section,
							fields
						};
					}
				)
			}
		});
	}

	function applyDictionaryOptionSet(optionSetId: string) {
		if (!selected || selected.type !== 'field') return;
		const optionSet = dictionaryOptionSets.find((item) => item.id === optionSetId);
		if (!optionSet) return;
		const currentField = getSelectedField(selected);
		updateField(selected, {
			type: currentField?.type === 'multi_choice' ? 'multi_choice' : 'single_choice',
			choiceSet: {
				choices: cloneChoices(optionSet.choices)
			},
			openEhrMapping: optionSet.openEhrMapping ? clonePayload(optionSet.openEhrMapping) : undefined,
			dictionaryRef: dictionaryRefFrom('option_set', optionSet)
		});
	}

	function addFieldFromPalette(type: string) {
		if (!workingDefinition) return;
		if (selected?.type === 'section') {
			addField(selected.sectionId, selected.path, type);
			return;
		}
		if (selected?.type === 'field') {
			addField(selected.sectionId, selected.path, type);
			return;
		}
		const firstSection = workingDefinition.layout.sections[0];
		if (firstSection) addField(firstSection.id, [], type);
	}

	function addSection() {
		if (!workingDefinition) return;
		const id = `section_${workingDefinition.layout.sections.length + 1}`;
		const color =
			sectionColorPalette[workingDefinition.layout.sections.length % sectionColorPalette.length];
		const nextSection = {
			id,
			title: `Section ${workingDefinition.layout.sections.length + 1}`,
			kind: 'section',
			order: workingDefinition.layout.sections.length,
			color,
			fields: [],
			sections: [],
			rules: [],
			collapsible: false,
			defaultCollapsed: false
		} as EmrBuilderSection;
		syncEditedDefinition({
			...workingDefinition,
			layout: {
				...workingDefinition.layout,
				sections: [...workingDefinition.layout.sections, nextSection]
			}
		});
		selected = { type: 'section', path: [], sectionId: id };
	}

	function updateOption(
		selection: EmrBuilderSelection,
		optionIndex: number,
		patch: Record<string, unknown>
	) {
		if (selection.type !== 'field') return;
		const currentField = getSelectedField(selection);
		const choices = getChoices(currentField);
		const nextChoices = choices.map((choice, index) =>
			index === optionIndex ? { ...choice, ...patch } : choice
		);
		updateField(selection, { choiceSet: { choices: nextChoices } });
	}

	function addOption(selection: EmrBuilderSelection) {
		if (selection.type !== 'field') return;
		const currentField = getSelectedField(selection);
		const choices = getChoices(currentField);
		updateField(selection, {
			choiceSet: {
				choices: [
					...choices,
					{
						value: String(choices.length + 1),
						label: `Option ${choices.length + 1}`,
						disabled: false
					}
				]
			}
		});
	}

	function removeOption(selection: EmrBuilderSelection, optionIndex: number) {
		if (selection.type !== 'field') return;
		const currentField = getSelectedField(selection);
		updateField(selection, {
			choiceSet: { choices: getChoices(currentField).filter((_, index) => index !== optionIndex) }
		});
	}

	function getSelectedField(selection: EmrBuilderSelection): EmrBuilderField | null {
		if (!workingDefinition || selection.type !== 'field') return null;
		let sections = workingDefinition.layout.sections;
		for (const sectionId of selection.path) {
			const section = sections.find((item) => item.id === sectionId);
			if (!section) return null;
			sections = section.sections;
		}
		const section = sections.find((item) => item.id === selection.sectionId);
		return section?.fields.find((field) => field.id === selection.fieldId) ?? null;
	}

	function getChoices(field: EmrBuilderField | null) {
		const choiceSet = field?.choiceSet as { choices?: Record<string, unknown>[] } | undefined;
		return Array.isArray(choiceSet?.choices) ? choiceSet.choices : [];
	}

	function addLanguage() {
		if (!workingDefinition) return;
		const normalized = languageDraft.trim();
		if (!normalized) return;
		const metadata = (workingDefinition.metadata ?? {}) as Record<string, unknown>;
		const languages = Array.isArray(metadata.languages)
			? metadata.languages.filter((value): value is string => typeof value === 'string')
			: [];
		const nextLanguages = Array.from(new Set([...languages, normalized]));
		syncEditedDefinition({
			...workingDefinition,
			metadata: {
				...metadata,
				languages: nextLanguages
			}
		});
		activeLanguage = normalized;
		languageDraft = '';
	}

	function moveSection(path: string[], sectionId: string, targetIndex: number) {
		if (!workingDefinition) return;
		syncWorkingDefinition(moveSectionInDefinition(workingDefinition, path, sectionId, targetIndex));
	}

	function moveField(path: string[], sectionId: string, fieldId: string, targetIndex: number) {
		if (!workingDefinition) return;
		syncWorkingDefinition(
			moveFieldInDefinition(workingDefinition, path, sectionId, fieldId, targetIndex)
		);
	}

	function deleteField(path: string[], sectionId: string, fieldId: string) {
		if (!workingDefinition) return;
		syncEditedDefinition({
			...workingDefinition,
			layout: {
				...workingDefinition.layout,
				sections: mapSections(workingDefinition.layout.sections, path, sectionId, (section) => ({
					...section,
					fields: section.fields
						.filter((field) => field.id !== fieldId)
						.map((field, index) => ({ ...field, order: index }))
				}))
			}
		});
		if (
			selected?.type === 'field' &&
			selected.sectionId === sectionId &&
			selected.fieldId === fieldId &&
			selected.path.length === path.length &&
			selected.path.every((value, index) => value === path[index])
		) {
			selected = { type: 'section', path, sectionId };
		}
	}

	async function saveDraft(event?: SubmitEvent) {
		event?.preventDefault();
		if (!workingDefinition) return;

		parseError = '';
		isSaving = true;
		try {
			const response = await fetch('/api/v1/emr-builder/draft', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ definition: workingDefinition })
			});
			await parseApiEnvelope(response);
			draftMessage = 'Draft saved.';
		} catch (error) {
			parseError = error instanceof Error ? error.message : 'Failed to save draft.';
		} finally {
			isSaving = false;
		}
	}

	async function publishDraft(event?: SubmitEvent) {
		event?.preventDefault();
		if (!selectedDefinition?.definitionId) return;

		parseError = '';
		isPublishing = true;
		try {
			const response = await fetch('/api/v1/emr-builder/publish', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					definitionId: selectedDefinition.definitionId,
					reason: publishReason.trim() || undefined
				})
			});
			await parseApiEnvelope(response);
			draftMessage = 'Definition published.';
		} catch (error) {
			parseError = error instanceof Error ? error.message : 'Failed to publish draft.';
		} finally {
			isPublishing = false;
		}
	}

	function countFieldsInSections(sections: EmrBuilderDefinition['layout']['sections']): number {
		return sections.reduce((sum, section) => {
			const nestedFields = section.sections
				? countFieldsInSections(section.sections as EmrBuilderDefinition['layout']['sections'])
				: 0;
			return sum + section.fields.length + nestedFields;
		}, 0);
	}

	let definitionSummary = $derived.by(() => {
		if (!workingDefinition) return '';
		const sectionCount = workingDefinition.layout.sections.length;
		const totalFields = countFieldsInSections(workingDefinition.layout.sections);
		return `${sectionCount} section(s), ${totalFields} field(s)`;
	});
</script>

<svelte:head>
	<title>EMR Builder | VCMS</title>
</svelte:head>

<div class="page-title">
	<div>
		<a class="back-link" href={resolve('/emr-builder')}>← Forms</a>
		<h1>EMR Builder Editor</h1>
	</div>
	{#if selectedDefinition}
		<span class="status-pill">{selectedDefinition.status}</span>
	{/if}
</div>

<section class="card">
	<h2>Form Setup</h2>
	<form class="grid" onsubmit={loadDefinition}>
		<label>
			Form ID
			<input
				type="text"
				list="recent-definitions"
				bind:value={definitionId}
				placeholder="e.g. opd-eye-note"
				required
			/>
		</label>
		<div class="definition-toolbar">
			<button type="submit" disabled={!canLoadDefinition || isLoading}>
				{isLoading ? 'Opening…' : 'Open Form'}
			</button>
			<button
				type="button"
				disabled={isLoading}
				onclick={() => {
					definitionId = '';
					workingDefinition = null;
					workingDefinitionJson = '';
					draftMessage = '';
					parseError = '';
					selectedDefinition = null;
					selected = null;
				}}
			>
				Clear
			</button>
		</div>
	</form>

	<datalist id="recent-definitions">
		{#each recentDefinitionIds as recentId (recentId)}
			<option value={recentId}></option>
		{/each}
	</datalist>

	{#if recentDefinitionIds.length > 0}
		<div class="recent">
			<h3>Recent IDs</h3>
			<div class="chips">
				{#each recentDefinitionIds as recentId (recentId)}
					<button
						type="button"
						onclick={() => {
							definitionId = recentId;
							void loadDefinition();
						}}
					>
						{recentId}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if selectedDefinition}
		<p>
			<strong>{selectedDefinition.definitionId}</strong> · {selectedDefinition.title} · v
			{selectedDefinition.version} · {selectedDefinition.status}
		</p>
		<p class="muted">Preview summary: {definitionSummary}</p>
	{/if}
	{#if workingDefinition}
		<div class="metadata-grid">
			<label>
				Title
				<input
					value={normalizeString((workingDefinition.metadata as Record<string, unknown>).title, '')}
					oninput={(event) =>
						updateMetadata({ title: (event.currentTarget as HTMLInputElement).value })}
				/>
			</label>
			<label>
				Form type
				<input
					value={normalizeString(
						(workingDefinition.metadata as Record<string, unknown>).noteType,
						''
					)}
					oninput={(event) =>
						updateMetadata({ noteType: (event.currentTarget as HTMLInputElement).value })}
				/>
			</label>
			<label>
				Specialty
				<input
					value={normalizeString(
						(workingDefinition.metadata as Record<string, unknown>).specialty,
						''
					)}
					oninput={(event) =>
						updateMetadata({
							specialty: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
		</div>
	{/if}
	<div class="language-row">
		<label>
			Language
			<select
				value={activeLanguage}
				onchange={(event) => {
					activeLanguage = (event.currentTarget as HTMLSelectElement).value;
				}}
			>
				{#each formLanguages as language (language)}
					<option value={language}>{language}</option>
				{/each}
			</select>
		</label>
		<label>
			Add language code
			<input
				placeholder="hi-IN"
				value={languageDraft}
				oninput={(event) => {
					languageDraft = (event.currentTarget as HTMLInputElement).value;
				}}
			/>
		</label>
		<button type="button" onclick={addLanguage} disabled={!languageDraft.trim()}
			>Add Language</button
		>
	</div>
	{#if draftMessage}
		<p class="info">{draftMessage}</p>
	{/if}
	{#if parseError}
		<p class="error">{parseError}</p>
	{/if}
</section>

{#if isLoaded}
	<section class="builder-shell">
		<aside class="palette card" aria-label="Field palette">
			<div class="actions">
				<h2>Fields</h2>
				<button type="button" onclick={addSection}>Add Section</button>
			</div>
			<p class="muted">Add fields to the selected section.</p>
			<div class="palette-grid">
				{#each fieldPalette as item (item.type)}
					<button type="button" onclick={() => addFieldFromPalette(item.type)}>
						<span>{item.label}</span>
						<small>{item.group}</small>
					</button>
				{/each}
			</div>

			<details class="dictionary-panel" open>
				<summary>Data Dictionary</summary>
				<input
					class="dictionary-search"
					placeholder="Search reusable assets"
					value={dictionarySearch}
					oninput={(event) => {
						dictionarySearch = (event.currentTarget as HTMLInputElement).value;
					}}
				/>
				<div class="dictionary-tabs" aria-label="Data dictionary asset type">
					<button
						type="button"
						class:active={dictionaryTab === 'fields'}
						onclick={() => (dictionaryTab = 'fields')}>Fields</button
					>
					<button
						type="button"
						class:active={dictionaryTab === 'fragments'}
						onclick={() => (dictionaryTab = 'fragments')}>Fragments</button
					>
					<button
						type="button"
						class:active={dictionaryTab === 'option-sets'}
						onclick={() => (dictionaryTab = 'option-sets')}>Option sets</button
					>
				</div>
				{#if dictionaryLoadError}
					<p class="dictionary-warning">{dictionaryLoadError} Using local starter assets.</p>
				{/if}
				{#if dictionaryTab === 'fields'}
					<div class="dictionary-group">
						{#each dictionaryFields as item (item.id)}
							<button type="button" onclick={() => addDictionaryFieldToSelection(item.id)}>
								<span>{item.label}</span>
								<small>{dictionaryMappingSummary(item)}</small>
							</button>
						{:else}
							<p class="muted">No reusable fields match this search.</p>
						{/each}
					</div>
				{:else if dictionaryTab === 'fragments'}
					<div class="dictionary-group">
						{#each dictionaryFragments as item (item.id)}
							<button type="button" onclick={() => addDictionaryFragment(item.id)}>
								<span>{item.label}</span>
								<small>{dictionaryMappingSummary(item)}</small>
							</button>
						{:else}
							<p class="muted">No reusable fragments match this search.</p>
						{/each}
					</div>
				{:else}
					<div class="dictionary-group">
						{#each dictionaryOptionSets as item (item.id)}
							<button
								type="button"
								disabled={selected?.type !== 'field'}
								onclick={() => applyDictionaryOptionSet(item.id)}
							>
								<span>{item.label}</span>
								<small>{dictionaryMappingSummary(item)}</small>
							</button>
						{:else}
							<p class="muted">No reusable option sets match this search.</p>
						{/each}
					</div>
				{/if}
			</details>
		</aside>

		<div class="builder-center">
			<EmrBuilderCanvas
				definition={workingDefinition}
				{selected}
				onSelectSection={(selection) => (selected = selection)}
				onMoveSection={moveSection}
				onMoveField={moveField}
				onDeleteField={deleteField}
			/>

			<details class="card json-panel">
				<summary>Advanced JSON</summary>
				<div class="actions">
					<h2>Draft JSON</h2>
					<button
						type="button"
						onclick={applyDraftJson}
						disabled={workingDefinitionJson.trim().length === 0}
					>
						Apply JSON
					</button>
				</div>
				<textarea
					rows="18"
					spellcheck="false"
					value={workingDefinitionJson}
					oninput={(event) => {
						workingDefinitionJson = (event.currentTarget as HTMLTextAreaElement).value;
					}}
				></textarea>
			</details>
		</div>

		<div class="builder-right">
			<EmrBuilderInspector
				definition={workingDefinition}
				selection={selected}
				onAddField={addField}
				onUpdateSection={updateSection}
				onUpdateField={updateField}
				onAddOption={addOption}
				onUpdateOption={updateOption}
				onRemoveOption={removeOption}
				languages={formLanguages}
				{activeLanguage}
			/>

			<section class="card">
				<h2>Actions</h2>
				<form class="grid" onsubmit={saveDraft}>
					<button type="submit" disabled={!canSaveDraft}>
						{isSaving ? 'Saving…' : 'Save Draft'}
					</button>
				</form>
				<form class="grid" onsubmit={publishDraft}>
					<label>
						Publish Reason
						<input
							value={publishReason}
							oninput={(event) => {
								publishReason = (event.currentTarget as HTMLInputElement).value;
							}}
						/>
					</label>
					<button type="submit" disabled={!canPublish}>
						{isPublishing ? 'Publishing…' : 'Publish'}
					</button>
				</form>
			</section>
		</div>
	</section>
{:else}
	<section class="card">
		<p class="muted">Load a definition id to show draft JSON and section/field preview canvas.</p>
	</section>
{/if}

<style>
	.definition-toolbar {
		display: flex;
		gap: 0.5rem;
	}
	.recent h3 {
		margin-top: 0.6rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.chips button {
		padding: 0.35rem 0.55rem;
		border-radius: 999px;
	}
	.language-row {
		display: grid;
		grid-template-columns: minmax(8rem, 12rem) minmax(10rem, 14rem) auto;
		gap: 0.7rem;
		align-items: end;
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--color-border);
	}
	.metadata-grid {
		display: grid;
		grid-template-columns: minmax(12rem, 1fr) minmax(10rem, 0.6fr) minmax(10rem, 0.6fr);
		gap: 0.7rem;
		margin-top: 0.9rem;
		padding-top: 0.9rem;
		border-top: 1px solid var(--color-border);
	}
	.metadata-grid label {
		display: grid;
		gap: 0.3rem;
		font-weight: 700;
		color: var(--color-rpc-navy);
	}
	.builder-shell {
		display: grid;
		grid-template-columns: minmax(12rem, 16rem) minmax(24rem, 1fr) minmax(22rem, 28rem);
		gap: 1rem;
		margin-top: 1rem;
		align-items: start;
	}
	.palette,
	.builder-right {
		position: sticky;
		top: 8rem;
	}
	.palette-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.35rem;
	}
	.palette-grid button {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.35rem;
		padding: 0.45rem 0.55rem;
		background: var(--color-surface-card);
		color: var(--color-rpc-navy);
		border-color: var(--color-border-strong);
		text-align: left;
	}
	.palette-grid span {
		line-height: 1.1;
	}
	.palette-grid small {
		color: var(--color-text-muted);
		font-weight: 700;
		font-size: 0.72rem;
		white-space: nowrap;
	}
	.dictionary-panel {
		margin-top: 1rem;
		padding-top: 0.85rem;
		border-top: 1px solid var(--color-border);
	}
	.dictionary-panel summary {
		cursor: pointer;
		font-weight: 800;
		color: var(--color-rpc-navy);
	}
	.dictionary-search {
		width: 100%;
		margin-top: 0.65rem;
	}
	.dictionary-tabs {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.25rem;
		margin-top: 0.55rem;
	}
	.dictionary-tabs button {
		min-height: 2rem;
		padding: 0.25rem 0.35rem;
		border-color: var(--color-border-strong);
		background: var(--color-surface-muted, #f6f7f9);
		color: var(--color-text-muted);
		font-size: 0.75rem;
	}
	.dictionary-tabs button.active {
		background: var(--color-rpc-navy);
		color: #fff;
	}
	.dictionary-warning {
		margin: 0.55rem 0 0;
		color: #9f580a;
		font-size: 0.8rem;
		font-weight: 700;
	}
	.dictionary-group {
		display: grid;
		gap: 0.35rem;
		margin-top: 0.75rem;
	}
	.dictionary-group button {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.2rem;
		padding: 0.4rem 0.55rem;
		border-color: var(--color-border-strong);
		background: var(--color-surface-card);
		color: var(--color-rpc-navy);
		text-align: left;
	}
	.dictionary-group button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.dictionary-group small {
		color: var(--color-text-muted);
		font-size: 0.72rem;
		font-weight: 700;
		white-space: nowrap;
	}
	.builder-center {
		display: grid;
		gap: 1rem;
	}
	.json-panel summary {
		cursor: pointer;
		font-weight: 800;
		color: var(--color-rpc-navy);
	}
	.actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	textarea {
		width: 100%;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	}
	.info {
		color: var(--color-success, #2f855a);
	}
	.page-title {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.back-link {
		display: inline-flex;
		margin-bottom: 0.35rem;
		color: var(--color-text-muted);
		font-size: 0.9rem;
		font-weight: 700;
		text-decoration: none;
	}
	.back-link:hover {
		color: var(--color-rpc-navy);
	}
	.status-pill {
		padding: 0.3rem 0.55rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface-muted, #f6f7f9);
		font-size: 0.8rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	@media (max-width: 1180px) {
		.builder-shell {
			grid-template-columns: 1fr;
		}
		.palette,
		.builder-right {
			position: static;
		}
	}
	@media (max-width: 720px) {
		.language-row,
		.metadata-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
