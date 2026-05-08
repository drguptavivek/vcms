<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '$lib/components/ui/Icon.svelte';

	let { data } = $props();
</script>

<svelte:head>
	<title>EMR Builder | VCMS</title>
</svelte:head>

<header class="page-head">
	<div>
		<h1>EMR Builder</h1>
		<p>Manage published clinical form definitions, XLSForm imports, and runtime/mobile usage.</p>
	</div>
	<a class="primary-action" href={resolve('/emr-builder/pec-opd-register/edit')}>
		<Icon name="forms" />
		Open OPD Form
	</a>
</header>

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
		<p>XLSForm Fields</p>
	</div>
</section>

<section class="card">
	<div class="section-title">
		<div>
			<h2>Forms</h2>
			<p class="muted">
				XLSForm-derived forms appear here even before they are saved as Builder drafts.
			</p>
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
