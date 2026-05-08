<script lang="ts">
	import { browser } from '$app/environment';
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
		status: 'draft' | 'active' | 'retired';
		version: number;
		locale?: string | null;
		tags?: string[] | null;
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

	const storageKey = 'vcms.emr-builder.recent-definition-ids.v1';
	const maxRecentDefinitions = 24;

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

	onMount(() => {
		if (!browser) return;
		const raw = localStorage.getItem(storageKey);
		if (!raw) return;

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
	});

	let canLoadDefinition = $derived(definitionId.trim().length > 0);
	let canSaveDraft = $derived(Boolean(workingDefinition) && !isSaving && !isLoading);
	let canPublish = $derived(
		Boolean(selectedDefinition?.definitionId) && !isPublishing && !isLoading
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

<h1>EMR Builder</h1>

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
	{#if draftMessage}
		<p class="info">{draftMessage}</p>
	{/if}
	{#if parseError}
		<p class="error">{parseError}</p>
	{/if}
</section>

{#if isLoaded}
	<section class="layout-grid">
		<section class="card">
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
				rows="22"
				spellcheck="false"
				value={workingDefinitionJson}
				oninput={(event) => {
					workingDefinitionJson = (event.currentTarget as HTMLTextAreaElement).value;
				}}
			></textarea>
		</section>

		<EmrBuilderInspector definition={workingDefinition} selection={selected} />
	</section>

	<section class="layout-grid">
		<EmrBuilderCanvas
			definition={workingDefinition}
			{selected}
			onSelectSection={(selection) => (selected = selection)}
			onMoveSection={moveSection}
			onMoveField={moveField}
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
	.layout-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin-top: 1rem;
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
</style>
