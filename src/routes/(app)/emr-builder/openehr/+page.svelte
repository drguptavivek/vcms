<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Icon from '$lib/components/ui/Icon.svelte';
	import type { PageProps } from './$types';

	type ApiEnvelope<T> = {
		ok: boolean;
		data?: T;
		error?: {
			code: string;
			message: string;
			details?: unknown;
		};
		requestId: string;
	};

	type TemplateItem = PageProps['data']['templates'][number];

	type ManifestField = {
		id: string;
		label: string;
		rmType?: string;
		baseFlatPath: string;
		required: boolean;
		repeating: boolean;
		inContext: boolean;
		inputs: Array<{
			suffix: string;
			type?: string;
			flatPath: string;
			options?: Array<{ value?: string; label?: string; ordinal?: number }>;
		}>;
	};

	type ManifestSection = {
		id: string;
		label: string;
		rmType?: string;
		baseFlatPath: string;
		required: boolean;
		repeating: boolean;
	};

	type RuntimeManifest = {
		templateId: string;
		cdrTemplateId: string;
		webTemplateHash: string;
		rootId: string;
		defaultLanguage?: string;
		languages: string[];
		fields: ManifestField[];
		sections: ManifestSection[];
	};

	let { data }: PageProps = $props();
	function getInitialTemplates() {
		return data.templates;
	}

	const initialTemplates = getInitialTemplates();
	const initialTemplateId = initialTemplates[0]?.templateId ?? '';
	let templates = $state<TemplateItem[]>(initialTemplates);
	let selectedTemplateId = $state(initialTemplateId);
	let syncTemplateId = $state(initialTemplateId);
	let uploadFileName = $state('');
	let uploadXml = $state('');
	let manifest = $state<RuntimeManifest | null>(null);
	let loadingManifest = $state(false);
	let busyAction = $state<'upload' | 'sync' | null>(null);
	let message = $state('');
	let errorMessage = $state('');

	let selectedTemplate = $derived(
		templates.find((template) => template.templateId === selectedTemplateId) ?? null
	);
	let canUpload = $derived(uploadXml.trim().length > 0 && busyAction === null);
	let canSync = $derived(syncTemplateId.trim().length > 0 && busyAction === null);
	let manifestFields = $derived(manifest?.fields ?? []);
	let manifestSections = $derived(manifest?.sections ?? []);
	let requiredFieldCount = $derived(manifestFields.filter((field) => field.required).length);
	let repeatingFieldCount = $derived(manifestFields.filter((field) => field.repeating).length);

	function setFailure(fallback: string, payload?: ApiEnvelope<unknown>) {
		errorMessage = payload?.error?.message ?? fallback;
		message = '';
	}

	async function parseResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
		const payload = (await response.json()) as ApiEnvelope<T>;
		if (!response.ok || !payload.ok || !payload.data) {
			throw payload;
		}
		return payload;
	}

	async function refreshTemplates(preferredTemplateId?: string) {
		await invalidateAll();
		const response = await fetch('/api/v1/openehr/templates');
		const payload = await parseResponse<TemplateItem[]>(response);
		templates = payload.data ?? [];
		selectedTemplateId =
			preferredTemplateId ?? selectedTemplateId ?? templates[0]?.templateId ?? '';
		syncTemplateId = selectedTemplateId;
	}

	async function readUploadFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			uploadFileName = '';
			uploadXml = '';
			return;
		}

		uploadFileName = file.name;
		uploadXml = await file.text();
		errorMessage = '';
	}

	async function uploadTemplate() {
		if (!canUpload) return;
		busyAction = 'upload';
		errorMessage = '';
		message = '';
		try {
			const response = await fetch('/api/v1/openehr/templates', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ operationalTemplateXml: uploadXml })
			});
			const payload = await parseResponse<{
				template: TemplateItem;
				webTemplate: { tree?: { id?: string } };
			}>(response);
			const templateId = payload.data?.template.templateId ?? '';
			message = `Uploaded ${templateId}`;
			uploadXml = '';
			uploadFileName = '';
			await refreshTemplates(templateId);
			await loadManifest(templateId);
		} catch (value) {
			setFailure('Template upload failed.', value as ApiEnvelope<unknown>);
		} finally {
			busyAction = null;
		}
	}

	async function syncTemplate() {
		if (!canSync) return;
		busyAction = 'sync';
		errorMessage = '';
		message = '';
		try {
			const response = await fetch('/api/v1/openehr/templates/sync', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ templateId: syncTemplateId.trim() })
			});
			const payload = await parseResponse<{ template: TemplateItem }>(response);
			const templateId = payload.data?.template.templateId ?? syncTemplateId.trim();
			message = `Synced ${templateId}`;
			await refreshTemplates(templateId);
			await loadManifest(templateId);
		} catch (value) {
			setFailure('Template sync failed.', value as ApiEnvelope<unknown>);
		} finally {
			busyAction = null;
		}
	}

	async function loadManifest(templateId = selectedTemplateId) {
		if (!templateId.trim()) return;
		loadingManifest = true;
		errorMessage = '';
		try {
			const params = new URLSearchParams({ templateId: templateId.trim() });
			const response = await fetch(`/api/v1/openehr/templates/manifest?${params}`);
			const payload = await parseResponse<RuntimeManifest>(response);
			manifest = payload.data ?? null;
			selectedTemplateId = templateId.trim();
			syncTemplateId = templateId.trim();
		} catch (value) {
			manifest = null;
			setFailure('Manifest load failed.', value as ApiEnvelope<unknown>);
		} finally {
			loadingManifest = false;
		}
	}
</script>

<svelte:head>
	<title>openEHR Templates | VCMS</title>
</svelte:head>

<header class="page-head">
	<div>
		<h1>openEHR Templates</h1>
		<p>Template Registry, Web Template cache, and runtime manifest inspection.</p>
	</div>
</header>

{#if message}
	<p class="notice">{message}</p>
{/if}
{#if errorMessage}
	<p class="error notice">{errorMessage}</p>
{/if}

<section class="template-grid">
	<div class="card upload-panel">
		<div class="section-title">
			<h2>Upload OPT</h2>
		</div>
		<div class="upload-row">
			<label class="file-control">
				<span>{uploadFileName || 'Choose ADL 1.4 OPT XML'}</span>
				<input type="file" accept=".opt,.xml,text/xml,application/xml" onchange={readUploadFile} />
			</label>
			<button type="button" disabled={!canUpload} onclick={uploadTemplate}>
				<Icon name="upload" />
				Upload
			</button>
		</div>
	</div>

	<div class="card sync-panel">
		<div class="section-title">
			<h2>Sync Template</h2>
		</div>
		<div class="sync-row">
			<input
				value={syncTemplateId}
				placeholder="CDR template ID"
				oninput={(event) => {
					syncTemplateId = (event.currentTarget as HTMLInputElement).value;
				}}
			/>
			<button type="button" disabled={!canSync} onclick={syncTemplate}>
				<Icon name="refresh" />
				Sync
			</button>
		</div>
	</div>
</section>

<section class="card">
	<div class="section-title">
		<h2>Registered Templates</h2>
		<span class="count-pill">{templates.length}</span>
	</div>

	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Template</th>
					<th>Root</th>
					<th>Status</th>
					<th>Hash</th>
					<th>Updated</th>
					<th>Action</th>
				</tr>
			</thead>
			<tbody>
				{#each templates as template (template.id)}
					<tr class:selected={template.templateId === selectedTemplateId}>
						<td>
							<strong>{template.concept ?? template.templateId}</strong>
							<span>{template.templateId}</span>
							{#if template.archetypeId}
								<span>{template.archetypeId}</span>
							{/if}
						</td>
						<td>{template.webTemplateRootId ?? 'Not cached'}</td>
						<td><span class="status-pill">{template.status}</span></td>
						<td><code>{template.webTemplateHash?.slice(0, 12) ?? 'No hash'}</code></td>
						<td>{new Date(template.updatedAt).toLocaleString()}</td>
						<td>
							<button
								type="button"
								class="secondary-action"
								disabled={loadingManifest && template.templateId === selectedTemplateId}
								onclick={() => loadManifest(template.templateId)}
							>
								<Icon name="preview" />
								Inspect
							</button>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="6">No templates registered.</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<section class="manifest-shell">
	<div class="card manifest-summary">
		<div class="section-title">
			<h2>Runtime Manifest</h2>
			{#if selectedTemplate}
				<span class="count-pill"
					>{selectedTemplate.webTemplateRootId ?? selectedTemplate.templateId}</span
				>
			{/if}
		</div>

		{#if loadingManifest}
			<p class="muted">Loading manifest.</p>
		{:else if manifest}
			<div class="manifest-stats">
				<div>
					<strong>{manifestSections.length}</strong>
					<span>Sections</span>
				</div>
				<div>
					<strong>{manifestFields.length}</strong>
					<span>Fields</span>
				</div>
				<div>
					<strong>{requiredFieldCount}</strong>
					<span>Required</span>
				</div>
				<div>
					<strong>{repeatingFieldCount}</strong>
					<span>Repeating</span>
				</div>
			</div>
			<dl class="manifest-meta">
				<div>
					<dt>Template ID</dt>
					<dd>{manifest.templateId}</dd>
				</div>
				<div>
					<dt>Root</dt>
					<dd>{manifest.rootId}</dd>
				</div>
				<div>
					<dt>Language</dt>
					<dd>{manifest.defaultLanguage ?? 'Not set'}</dd>
				</div>
			</dl>
		{:else}
			<p class="muted">Select a template to inspect its runtime manifest.</p>
		{/if}
	</div>

	<div class="card manifest-list">
		<div class="section-title">
			<h2>Fields</h2>
			{#if manifest}
				<span class="count-pill">{manifestFields.length}</span>
			{/if}
		</div>

		{#if manifest}
			<div class="field-list">
				{#each manifestFields as field (field.baseFlatPath)}
					<details>
						<summary>
							<span>
								<strong>{field.label}</strong>
								<code>{field.baseFlatPath}</code>
							</span>
							<span class="field-badges">
								{#if field.required}<em>required</em>{/if}
								{#if field.repeating}<em>repeat</em>{/if}
								{#if field.inContext}<em>context</em>{/if}
							</span>
						</summary>
						<div class="input-list">
							{#each field.inputs as input (input.flatPath)}
								<div>
									<span>{input.type ?? 'INPUT'}</span>
									<code>{input.flatPath}</code>
									{#if input.options?.length}
										<small>{input.options.length} options</small>
									{/if}
								</div>
							{/each}
						</div>
					</details>
				{/each}
			</div>
		{:else}
			<p class="muted">No manifest loaded.</p>
		{/if}
	</div>
</section>

<style>
	.page-head,
	.section-title {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
	}
	.page-head {
		margin-bottom: 1rem;
	}
	.page-head p {
		color: var(--color-text-muted);
	}
	.template-grid,
	.manifest-shell {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 1rem;
	}
	.upload-row,
	.sync-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.7rem;
		align-items: center;
	}
	.file-control {
		position: relative;
		min-width: 0;
	}
	.file-control span {
		display: block;
		padding: 0.6rem;
		border: 1px solid var(--color-border-strong);
		border-radius: 0.5rem;
		background: var(--color-surface-card);
		color: var(--color-rpc-navy);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.file-control input {
		position: absolute;
		inset: 0;
		opacity: 0;
		cursor: pointer;
	}
	button {
		display: inline-flex;
		gap: 0.35rem;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
	}
	button:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.secondary-action {
		background: var(--color-surface-card);
		color: var(--color-rpc-navy);
		border-color: var(--color-border-strong);
	}
	.notice {
		width: fit-content;
		max-width: 100%;
		padding: 0.55rem 0.7rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-rpc-mint);
		color: var(--color-rpc-navy);
		font-weight: 800;
	}
	.notice.error {
		background: #fff5f5;
		border-color: #f0b8b8;
	}
	.table-wrap {
		overflow-x: auto;
	}
	tr.selected {
		background: color-mix(in srgb, var(--color-rpc-mint) 46%, white);
	}
	td {
		vertical-align: top;
	}
	td strong,
	td span {
		display: block;
	}
	td span,
	.muted {
		color: var(--color-text-muted);
	}
	code {
		font-size: 0.82rem;
		color: var(--color-rpc-navy);
		overflow-wrap: anywhere;
	}
	.status-pill,
	.count-pill,
	.field-badges em {
		display: inline-flex;
		width: fit-content;
		padding: 0.18rem 0.45rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface-muted, #f6f7f9);
		color: var(--color-rpc-navy);
		font-size: 0.76rem;
		font-style: normal;
		font-weight: 800;
		text-transform: uppercase;
	}
	.manifest-summary {
		align-self: start;
	}
	.manifest-stats {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.6rem;
		margin: 1rem 0;
	}
	.manifest-stats div {
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-surface-muted, #f6f7f9);
	}
	.manifest-stats strong,
	.manifest-stats span {
		display: block;
	}
	.manifest-stats strong {
		font-size: 1.35rem;
		color: var(--color-rpc-navy);
	}
	.manifest-stats span,
	.manifest-meta dt {
		color: var(--color-text-muted);
		font-size: 0.82rem;
	}
	.manifest-meta {
		display: grid;
		gap: 0.6rem;
		margin: 0;
	}
	.manifest-meta div {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr);
		gap: 0.7rem;
	}
	.manifest-meta dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.field-list {
		display: grid;
		gap: 0.55rem;
		max-height: 44rem;
		overflow: auto;
		padding-right: 0.25rem;
	}
	details {
		border: 1px solid var(--color-border);
		border-radius: 0.6rem;
		background: var(--color-surface-card);
	}
	summary {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
		justify-content: space-between;
		padding: 0.7rem;
		cursor: pointer;
	}
	summary strong,
	summary code {
		display: block;
	}
	.field-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		justify-content: flex-end;
	}
	.input-list {
		display: grid;
		gap: 0.45rem;
		padding: 0 0.7rem 0.7rem;
	}
	.input-list div {
		display: grid;
		gap: 0.2rem;
		padding: 0.55rem;
		border-radius: 0.45rem;
		background: var(--color-surface-muted, #f6f7f9);
	}
	.input-list span {
		font-size: 0.75rem;
		font-weight: 900;
		color: var(--color-text-muted);
	}
	.input-list small {
		color: var(--color-text-muted);
	}
	@media (max-width: 1050px) {
		.template-grid,
		.manifest-shell {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 700px) {
		.upload-row,
		.sync-row,
		.manifest-meta div,
		.manifest-stats {
			grid-template-columns: 1fr;
		}
		summary {
			display: grid;
		}
		.field-badges {
			justify-content: flex-start;
		}
	}
</style>
