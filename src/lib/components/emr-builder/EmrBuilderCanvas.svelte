<script lang="ts">
	import type {
		EmrBuilderDefinition,
		EmrBuilderField,
		EmrBuilderSection,
		EmrBuilderSelection
	} from './emr-builder-reorder-model';
	import { getSectionChildren } from './emr-builder-reorder-model';

	const canMoveItem = (index: number, total: number, direction: -1 | 1) =>
		index + direction >= 0 && index + direction < total;

	type ReorderDirection = -1 | 1;

	type Props = {
		definition: EmrBuilderDefinition | null;
		selected: EmrBuilderSelection | null;
		onSelectSection: (selection: EmrBuilderSelection) => void;
		onMoveSection: (path: string[], sectionId: string, targetIndex: number) => void;
		onMoveField: (path: string[], sectionId: string, fieldId: string, targetIndex: number) => void;
	};

	let { definition, selected, onSelectSection, onMoveSection, onMoveField }: Props = $props();

	function moveSection(
		path: string[],
		section: EmrBuilderSection,
		index: number,
		direction: ReorderDirection
	) {
		const siblings = getSectionChildren(definition, path);
		if (!canMoveItem(index, siblings.length, direction)) {
			return;
		}

		const targetIndex = index + direction;
		onMoveSection(path, section.id, targetIndex);
	}

	function moveField(
		path: string[],
		sectionId: string,
		field: EmrBuilderField,
		index: number,
		direction: ReorderDirection
	) {
		const section = findSectionByPathAndId(sectionId, path);
		if (!section) return;
		if (!canMoveItem(index, section.fields.length, direction)) return;
		onMoveField(path, sectionId, field.id, index + direction);
	}

	function onSectionKeydown(
		event: KeyboardEvent,
		path: string[],
		section: EmrBuilderSection,
		index: number
	) {
		if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
			event.preventDefault();
			moveSection(path, section, index, -1);
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
			event.preventDefault();
			moveSection(path, section, index, +1);
		}
	}

	function onFieldKeydown(
		event: KeyboardEvent,
		path: string[],
		sectionId: string,
		field: EmrBuilderField,
		index: number
	) {
		if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
			event.preventDefault();
			moveField(path, sectionId, field, index, -1);
		}
		if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
			event.preventDefault();
			moveField(path, sectionId, field, index, +1);
		}
	}

	function handleSectionSelection(section: EmrBuilderSection, path: string[]) {
		onSelectSection({
			type: 'section',
			sectionId: section.id,
			path
		});
	}

	function handleFieldSelection(
		section: EmrBuilderSection,
		field: EmrBuilderField,
		path: string[]
	) {
		onSelectSection({
			type: 'field',
			path,
			sectionId: section.id,
			fieldId: field.id
		});
	}

	function isSectionSelected(sectionId: string, path: string[]) {
		return (
			selected?.type === 'section' &&
			selected.sectionId === sectionId &&
			equalPath(selected.path, path)
		);
	}

	function isFieldSelected(sectionId: string, path: string[], fieldId: string) {
		return (
			selected?.type === 'field' &&
			selected.sectionId === sectionId &&
			selected.fieldId === fieldId &&
			equalPath(selected.path, path)
		);
	}

	function equalPath(left: string[], right: string[]) {
		return left.length === right.length && left.every((value, index) => value === right[index]);
	}

	function findSectionByPathAndId(sectionId: string, path: string[]) {
		if (!definition) return null;

		let sections = definition.layout.sections;
		let nextSection: EmrBuilderSection | null = null;
		for (const id of path) {
			const section = sections.find((item) => item.id === id);
			if (!section) return null;
			nextSection = section;
			sections = section.sections;
		}

		if (!path.length)
			return definition.layout.sections.find((section) => section.id === sectionId) ?? null;
		if (nextSection?.id === sectionId) return nextSection;
		return sections.find((section) => section.id === sectionId) ?? null;
	}
</script>

{#if !definition}
	<p class="empty">Load a definition draft to start the canvas preview.</p>
{:else}
	<div class="canvas">
		<h2>Section Canvas</h2>
		<p class="canvas-hint">Use row buttons or arrow keys (← → ↑ ↓) while focused to reorder.</p>
		<div class="canvas-root">
			{#each definition.layout.sections as section, sectionIndex (section.id)}
				{@render sectionNode({ section, sectionIndex, path: [], isRoot: true })}
			{/each}
		</div>
	</div>
{/if}

{#snippet sectionNode({
	section,
	path,
	sectionIndex,
	isRoot
}: {
	section: EmrBuilderSection;
	path: string[];
	sectionIndex: number;
	isRoot: boolean;
})}
	<section class:section-node={true} class:root={isRoot}>
		<div
			aria-label={`Section ${section.title} (${section.id})`}
			class:selected={isSectionSelected(section.id, path)}
			class="canvas-row"
		>
			<div class="row-controls">
				<button
					type="button"
					onclick={() => moveSection(path, section, sectionIndex, -1)}
					onkeydown={(event) => {
						onSectionKeydown(event, path, section, sectionIndex);
					}}
					disabled={sectionIndex === 0}
					aria-label={`Move section ${section.title} up`}
				>
					↑
				</button>
				<button
					type="button"
					onclick={() => moveSection(path, section, sectionIndex, +1)}
					onkeydown={(event) => {
						onSectionKeydown(event, path, section, sectionIndex);
					}}
					disabled={sectionIndex === getSectionChildren(definition, path).length - 1}
					aria-label={`Move section ${section.title} down`}
				>
					↓
				</button>
				<button
					type="button"
					onclick={() => handleSectionSelection(section, path)}
					aria-label={`Select section ${section.title}`}
					class:selected-control={selected?.type === 'section' &&
						selected.sectionId === section.id &&
						equalPath(selected.path, path)}
				>
					{section.title}
				</button>
			</div>
			<div class="meta">
				<span class="muted">{section.kind ?? 'section'}</span>
				<span>order {section.order}</span>
			</div>
		</div>

		<div class="children">
			{#if section.fields.length > 0}
				{#each section.fields as field, fieldIndex (field.id)}
					<div
						aria-label={`Field ${field.label ?? field.id} (${field.id})`}
						class:selected={isFieldSelected(section.id, path, field.id)}
						class="canvas-row field-row"
					>
						<div class="row-controls">
							<button
								type="button"
								onclick={() => moveField(path, section.id, field, fieldIndex, -1)}
								onkeydown={(event) => {
									onFieldKeydown(event, path, section.id, field, fieldIndex);
								}}
								disabled={fieldIndex === 0}
								aria-label={`Move field ${field.id} up`}
							>
								↑
							</button>
							<button
								type="button"
								onclick={() => moveField(path, section.id, field, fieldIndex, +1)}
								onkeydown={(event) => {
									onFieldKeydown(event, path, section.id, field, fieldIndex);
								}}
								disabled={fieldIndex === section.fields.length - 1}
								aria-label={`Move field ${field.id} down`}
							>
								↓
							</button>
							<button
								type="button"
								onclick={() => handleFieldSelection(section, field, path)}
								aria-label={`Select field ${field.id}`}
								class:selected-control={selected?.type === 'field' &&
									selected.fieldId === field.id &&
									selected.sectionId === section.id &&
									equalPath(selected.path, path)}
							>
								{field.label ?? field.id}
							</button>
						</div>
						<div class="meta">
							<span class="muted">{field.type ?? 'field'}</span>
							<span>order {field.order}</span>
						</div>
					</div>
				{/each}
			{:else}
				<div class="empty">No fields in this section.</div>
			{/if}

			{#if section.sections.length > 0}
				<div class="nested-list">
					{#each section.sections as nestedSection, nestedIndex (nestedSection.id)}
						{@render sectionNode({
							section: nestedSection,
							sectionIndex: nestedIndex,
							path: [...path, section.id],
							isRoot: false
						})}
					{/each}
				</div>
			{/if}
		</div>
	</section>
{/snippet}

<style>
	.canvas h2 {
		margin-top: 0;
	}
	.canvas-root {
		display: grid;
		gap: 0.75rem;
	}
	.empty {
		color: var(--color-text-muted);
		padding: 0.45rem 0;
	}
	.canvas-hint {
		color: var(--color-text-muted);
		font-size: 0.9rem;
		margin: 0 0 0.75rem;
	}
	.canvas-row {
		display: grid;
		gap: 0.55rem;
		padding: 0.55rem;
		border: 1px solid var(--color-border-strong);
		border-radius: 0.6rem;
		margin-bottom: 0.45rem;
		background: var(--color-surface-card);
	}
	.canvas-row.selected,
	.canvas-row:focus-within {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 1px;
	}
	.row-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		align-items: center;
	}
	.row-controls button {
		margin: 0;
	}
	.row-controls button.selected-control {
		background: var(--color-rpc-sky);
		border-color: var(--color-rpc-sky-border);
		color: var(--color-rpc-sky-ink);
	}
	.meta {
		display: flex;
		gap: 0.7rem;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}
	.children {
		padding: 0.6rem 0.2rem 0.2rem 1rem;
		border-left: 2px solid var(--color-border);
		margin-left: 0.5rem;
	}
	.nested-list,
	.children .section-node {
		margin-top: 0.55rem;
	}
	.section-node.root {
		padding-right: 0.1rem;
	}
	.field-row .meta {
		padding-left: 0.2rem;
	}
</style>
