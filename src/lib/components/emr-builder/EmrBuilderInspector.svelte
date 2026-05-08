<script lang="ts">
	import {
		getField,
		getSectionByPath,
		type EmrBuilderDefinition,
		type EmrBuilderField,
		type EmrBuilderSelection
	} from './emr-builder-reorder-model';

	type Props = {
		definition: EmrBuilderDefinition | null;
		selection: EmrBuilderSelection | null;
	};

	let { definition, selection }: Props = $props();

	let section = $derived.by(() => {
		if (!selection || selection.type !== 'section') return null;
		return getSectionByPath(definition, selection.path, selection.sectionId);
	});

	let field = $derived.by(() => {
		if (!selection || selection.type !== 'field') return null;
		return getField(
			definition,
			selection.path,
			selection.sectionId,
			selection.fieldId
		) as EmrBuilderField | null;
	});

	let sectionJson = $derived.by(() => JSON.stringify(section, null, 2));
	let fieldJson = $derived.by(() => JSON.stringify(field, null, 2));
</script>

<section class="card">
	<h2>Inspector</h2>
	{#if !selection}
		<p class="muted">Select a section or field to inspect ODK and SNOMED metadata.</p>
	{:else if selection.type === 'section'}
		{#if section}
			<div class="inspector-list">
				<div><strong>Type:</strong> section</div>
				<div><strong>ID:</strong> {section.id}</div>
				{#if section.title}<div><strong>Title:</strong> {section.title}</div>{/if}
				<div><strong>Order:</strong> {section.order}</div>
				{#if section.kind}<div><strong>Kind:</strong> {section.kind}</div>{/if}
			</div>
			{#if section.odk}
				<h3>ODK Section Metadata</h3>
				<pre>{JSON.stringify(section.odk, null, 2)}</pre>
			{:else}
				<p class="muted">No ODK metadata on this section.</p>
			{/if}
			<h3>Section JSON</h3>
			<pre>{sectionJson}</pre>
		{:else}
			<p class="error">The selected section could not be resolved from the current draft.</p>
		{/if}
	{:else if field}
		<div class="inspector-list">
			<div><strong>Type:</strong> field</div>
			<div><strong>ID:</strong> {field.id}</div>
			<div><strong>Key:</strong> {field.key}</div>
			<div><strong>Label:</strong> {field.label}</div>
			<div><strong>Type:</strong> {field.type}</div>
			<div><strong>Order:</strong> {field.order}</div>
		</div>
		<h3>ODK Field Bind</h3>
		{#if field.odkBind}
			<pre>{JSON.stringify(field.odkBind, null, 2)}</pre>
		{:else}
			<p class="muted">No odkBind metadata.</p>
		{/if}
		<h3>SNOMED Metadata</h3>
		{#if field.snomed}
			<pre>{JSON.stringify(field.snomed, null, 2)}</pre>
		{:else}
			<p class="muted">No SNOMED metadata.</p>
		{/if}
		<h3>Field JSON</h3>
		<pre>{fieldJson}</pre>
	{:else}
		<p class="error">The selected field could not be resolved from the current draft.</p>
	{/if}
</section>

<style>
	h3 {
		margin: 0.95rem 0 0.4rem;
		font-size: 0.9rem;
		color: var(--color-rpc-navy);
	}
	.inspector-list {
		display: grid;
		gap: 0.35rem;
	}
	pre {
		max-height: 16rem;
		overflow: auto;
		background: var(--color-surface-muted, #f6f7f9);
		padding: 0.65rem;
		border: 1px solid var(--color-border-strong);
		border-radius: 0.45rem;
		font-size: 0.8rem;
	}
</style>
