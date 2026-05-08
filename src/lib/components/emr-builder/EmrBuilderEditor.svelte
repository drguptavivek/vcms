<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
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

	type DraftRecord = {
		id: string;
		definitionId: string;
		versionHash: string;
		payloadJson?: unknown;
	};

	type DraftResponse = {
		definition: EmrBuilderDefinitionRecord;
		draft?: DraftRecord;
	};

	type Props = {
		initialDefinitionId?: string;
		initialDefinition?: EmrBuilderDefinition | null;
		initialDefinitionRecord?: EmrBuilderDefinitionRecord | null;
		initialDraftPayload?: unknown;
		initialMessage?: string;
	};

	const props: Props = $props();

	const storageKey = 'vcms.emr-builder.recent-definition-ids.v1';
	const maxRecentDefinitions = 24;
	const fieldPalette = [
		{ type: 'text', label: 'Text', group: 'Survey' },
		{ type: 'number', label: 'Number', group: 'Survey' },
		{ type: 'decimal', label: 'Decimal', group: 'Survey' },
		{ type: 'date', label: 'Date', group: 'Survey' },
		{ type: 'single_choice', label: 'Select one', group: 'Choices' },
		{ type: 'multi_choice', label: 'Select many', group: 'Choices' },
		{ type: 'note', label: 'Note', group: 'Display' },
		{ type: 'calculate', label: 'Calculate', group: 'Logic' },
		{ type: 'barcode', label: 'Barcode', group: 'Clinical' },
		{ type: 'image', label: 'Image', group: 'Clinical' }
	] as const;

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

	onMount(() => {
		const initialDefinitionId = props.initialDefinitionId ?? '';
		const initialDefinition = props.initialDefinition ?? null;
		const initialDefinitionRecord = props.initialDefinitionRecord ?? null;
		const initialDraftPayload = props.initialDraftPayload;
		const initialMessage = props.initialMessage ?? '';

		definitionId = initialDefinitionId;
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

	function makeStarterDefinition(record: EmrBuilderDefinitionRecord): EmrBuilderDefinition {
		return {
			metadata: {
				definitionId: record.definitionId,
				slug: record.slug,
				title: record.title,
				noteType: record.noteType,
				status: record.status,
				version: Math.max(1, record.version),
				locale: record.locale ?? 'en-IN',
				tags: record.tags ?? [],
				ownerTeam: record.ownerTeam ?? undefined,
				specialty: record.specialty ?? undefined
			},
			layout: { sections: [] },
			rules: [],
			actions: [],
			analytics: { dimensions: [], measures: [], events: [] }
		};
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
		isLoading = true;
		try {
			const response = await fetch(
				`/api/v1/emr-builder/draft?definitionId=${encodeURIComponent(normalizedId)}`
			);
			const payload = await parseApiEnvelope<DraftResponse>(response);
			selectedDefinition = payload.definition;
			definitionId = payload.definition.definitionId;
			selected = null;

			if (payload.draft?.payloadJson) {
				const normalized = toBuilderDefinition(payload.draft.payloadJson);
				if (!normalized) {
					parseError = 'Saved draft payload is invalid for this editor.';
					workingDefinition = null;
					workingDefinitionJson = '';
					return;
				}
				workingDefinition = normalized;
				workingDefinitionJson = JSON.stringify(workingDefinition, null, 2);
				draftMessage = 'Loaded draft payload.';
			} else {
				workingDefinition = makeStarterDefinition(payload.definition);
				workingDefinitionJson = JSON.stringify(workingDefinition, null, 2);
				draftMessage = 'No draft found. Loaded starter definition from metadata.';
			}

			isLoaded = true;
		} catch (error) {
			parseError = error instanceof Error ? error.message : 'Failed to load EMR draft.';
			selectedDefinition = null;
			workingDefinition = null;
			workingDefinitionJson = '';
			isLoaded = false;
		} finally {
			isLoading = false;
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

	function normalizeFieldType(type: string) {
		return type === 'note' ? 'text' : type === 'calculate' ? 'text' : type;
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
		const ids = new Set<string>();
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
			readOnly: type === 'note' || type === 'calculate',
			readonly: type === 'note' || type === 'calculate',
			hidden: false,
			width: 'full',
			analytics: [],
			odkBind: {
				xlsformName: id,
				calculation: type === 'calculate' ? { value: '' } : undefined
			},
			...(type === 'single_choice' || type === 'multi_choice'
				? { choiceSet: { choices: [{ value: '1', label: 'Option 1', disabled: false }] } }
				: {})
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
		const nextSection = {
			id,
			title: `Section ${workingDefinition.layout.sections.length + 1}`,
			kind: 'section',
			order: workingDefinition.layout.sections.length,
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
	<h2>Definition</h2>
	<form class="grid" onsubmit={loadDefinition}>
		<label>
			Definition ID
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
				{isLoading ? 'Loading…' : 'Load Draft'}
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
			<p class="muted">Add XLSForm-style fields to the selected section.</p>
			<div class="palette-grid">
				{#each fieldPalette as item (item.type)}
					<button type="button" onclick={() => addFieldFromPalette(item.type)}>
						<span>{item.label}</span>
						<small>{item.group}</small>
					</button>
				{/each}
			</div>
		</aside>

		<div class="builder-center">
			<EmrBuilderCanvas
				definition={workingDefinition}
				{selected}
				onSelectSection={(selection) => (selected = selection)}
				onMoveSection={moveSection}
				onMoveField={moveField}
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
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}
	.palette-grid button {
		display: grid;
		justify-items: start;
		gap: 0.15rem;
		min-height: 3.4rem;
		background: var(--color-surface-card);
		color: var(--color-rpc-navy);
		border-color: var(--color-border-strong);
	}
	.palette-grid small {
		color: var(--color-text-muted);
		font-weight: 700;
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
		.language-row {
			grid-template-columns: 1fr;
		}
	}
</style>
