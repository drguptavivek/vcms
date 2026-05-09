<script lang="ts">
	import { base, resolve } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { data } = $props();
	let newTitle = $state('');
	let newDefinitionId = $state('');
	let newNoteType = $state('opd');

	function slugify(value: string): string {
		const normalized = value
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.replace(/-{2,}/g, '-');
		return /^[a-z]/.test(normalized) ? normalized : `form-${normalized || 'new'}`;
	}

	let effectiveNewDefinitionId = $derived(slugify(newDefinitionId || newTitle || 'new-form'));
	let canCreateForm = $derived(effectiveNewDefinitionId.length > 0);

	function openNewForm(event: SubmitEvent) {
		event.preventDefault();
		if (!canCreateForm) return;
		const params = new URLSearchParams();
		if (newTitle.trim()) params.set('title', newTitle.trim());
		if (newNoteType.trim()) params.set('noteType', newNoteType.trim());
		const query = params.toString();
		window.location.href = `${base}/emr-builder/${effectiveNewDefinitionId}/edit${query ? `?${query}` : ''}`;
	}
</script>

<svelte:head>
	<title>EMR Builder | VCMS</title>
</svelte:head>

<header class="page-head">
	<div>
		<h1>EMR Builder</h1>
		<p>Create and manage VCMS clinical form definitions for runtime and mobile use.</p>
	</div>
	<a class="primary-action" href="#new-form">
		<Icon name="forms" />
		New Form
	</a>
</header>

<section id="new-form" class="card create-panel">
	<div>
		<h2>Create Form</h2>
		<p class="muted">
			Start from the VCMS Builder schema and add sections, fields, rules, and input behavior.
		</p>
	</div>
	<form class="create-grid" onsubmit={openNewForm}>
		<label>
			Form title
			<input
				value={newTitle}
				placeholder="OPD Eye Exam"
				oninput={(event) => {
					newTitle = (event.currentTarget as HTMLInputElement).value;
				}}
			/>
		</label>
		<label>
			Form ID
			<input
				value={newDefinitionId}
				placeholder={effectiveNewDefinitionId}
				pattern="[a-z][a-z0-9._-]*"
				oninput={(event) => {
					newDefinitionId = (event.currentTarget as HTMLInputElement).value;
				}}
			/>
		</label>
		<label>
			Form type
			<select
				value={newNoteType}
				onchange={(event) => {
					newNoteType = (event.currentTarget as HTMLSelectElement).value;
				}}
			>
				<option value="opd">OPD</option>
				<option value="follow-up">Follow-up</option>
				<option value="procedure">Procedure</option>
				<option value="screening">Screening</option>
			</select>
		</label>
		<button type="submit" disabled={!canCreateForm}>
			<Icon name="edit" />
			Create
		</button>
	</form>
</section>

<section class="stats-grid" aria-label="EMR Builder summary">
	<div class="stat-card">
		<span>{data.summary.totalForms}</span>
		<p>Forms</p>
	</div>
	<div class="stat-card">
		<span>{data.summary.publishedForms}</span>
		<p>Published</p>
	</div>
	<div class="stat-card">
		<span>{data.summary.savedForms}</span>
		<p>Saved in Builder</p>
	</div>
	<div class="stat-card">
		<span>{data.summary.totalFields}</span>
		<p>Seeded Fields</p>
	</div>
</section>

<section class="card">
	<div class="section-title">
		<div>
			<h2>Forms</h2>
			<p class="muted">Saved forms and seeded examples are listed together.</p>
		</div>
	</div>

	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Form</th>
					<th>Type</th>
					<th>Status</th>
					<th>Structure</th>
					<th>Usage</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#each data.forms as form (form.definitionId)}
					<tr>
						<td>
							<strong>{form.title}</strong>
							<span>{form.definitionId}</span>
						</td>
						<td>
							{form.noteType}
							{#if form.specialty}
								<span>{form.specialty}</span>
							{/if}
						</td>
						<td>
							<span class="status-pill">{form.status}</span>
							<span>v{form.version}</span>
						</td>
						<td>
							{#if form.sectionCount !== null && form.fieldCount !== null}
								{form.sectionCount} sections · {form.fieldCount} fields
							{:else}
								Saved definition
							{/if}
							{#if form.issueCount !== null && form.issueCount > 0}
								<span>{form.issueCount} import notes</span>
							{/if}
						</td>
						<td>{form.usage}</td>
						<td>
							<div class="row-actions">
								<a
									href={resolve(`/emr-builder/${form.definitionId}/edit`)}
									aria-label={`Edit ${form.title}`}
								>
									<Icon name="edit" />
									<span>Edit</span>
								</a>
								<a
									href={resolve(`/emr-builder/${form.definitionId}/edit?preview=1`)}
									aria-label={`Preview ${form.title}`}
								>
									<Icon name="preview" />
									<span>Preview</span>
								</a>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</section>

<style>
	.page-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.page-head p,
	.section-title p,
	td span {
		color: var(--color-text-muted);
	}
	.primary-action,
	.row-actions a {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--color-rpc-teal);
		border-radius: 0.5rem;
		background: var(--color-rpc-teal);
		color: var(--color-surface-card);
		font-weight: 800;
		text-decoration: none;
		white-space: nowrap;
	}
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
		gap: 0.75rem;
		margin-bottom: 1rem;
	}
	.stat-card {
		padding: 1rem;
		border: 1px solid var(--color-border);
		border-radius: 0.6rem;
		background: var(--color-surface-card);
		box-shadow: var(--shadow-card);
	}
	.stat-card span {
		display: block;
		font-size: 1.8rem;
		font-weight: 900;
		color: var(--color-rpc-navy);
	}
	.stat-card p {
		margin: 0.2rem 0 0;
		color: var(--color-text-muted);
	}
	.section-title {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 0.8rem;
	}
	.create-panel {
		margin-bottom: 1rem;
	}
	.create-panel h2 {
		margin-top: 0;
	}
	.create-grid {
		display: grid;
		grid-template-columns: minmax(12rem, 1fr) minmax(10rem, 0.8fr) minmax(9rem, 0.55fr) auto;
		gap: 0.75rem;
		align-items: end;
	}
	.create-grid label {
		display: grid;
		gap: 0.3rem;
		font-weight: 700;
		color: var(--color-rpc-navy);
	}
	.create-grid input,
	.create-grid select {
		width: 100%;
		padding: 0.55rem 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-surface-card);
		color: var(--color-text);
	}
	.create-grid button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.35rem;
		padding: 0.6rem 0.8rem;
		border: 1px solid var(--color-rpc-teal);
		border-radius: 0.5rem;
		background: var(--color-rpc-teal);
		color: var(--color-surface-card);
		font-weight: 800;
	}
	@media (max-width: 900px) {
		.create-grid {
			grid-template-columns: 1fr;
		}
	}
	.table-wrap {
		overflow-x: auto;
	}
	td {
		vertical-align: top;
	}
	td strong,
	td span {
		display: block;
	}
	.status-pill {
		display: inline-flex;
		width: fit-content;
		padding: 0.2rem 0.45rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-surface-muted, #f6f7f9);
		color: var(--color-rpc-navy);
		font-size: 0.78rem;
		font-weight: 800;
		text-transform: uppercase;
	}
	.row-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.row-actions a:last-child {
		border-color: var(--color-border-strong);
		background: var(--color-surface-card);
		color: var(--color-rpc-navy);
	}
</style>
