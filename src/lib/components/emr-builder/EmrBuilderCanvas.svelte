<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';

	import type {
		EmrBuilderDefinition,
		EmrBuilderField,
		EmrBuilderSection,
		EmrBuilderSelection
	} from './emr-builder-reorder-model';
	import { getSectionChildren } from './emr-builder-reorder-model';

	const canMoveItem = (index: number, total: number, direction: -1 | 1) =>
		index + direction >= 0 && index + direction < total;
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

	type ReorderDirection = -1 | 1;

	type Props = {
		definition: EmrBuilderDefinition | null;
		selected: EmrBuilderSelection | null;
		onSelectSection: (selection: EmrBuilderSelection) => void;
		onMoveSection: (path: string[], sectionId: string, targetIndex: number) => void;
		onMoveField: (path: string[], sectionId: string, fieldId: string, targetIndex: number) => void;
		onDeleteField: (path: string[], sectionId: string, fieldId: string) => void;
	};

	type DragState =
		| { type: 'section'; path: string[]; sectionId: string; index: number }
		| { type: 'field'; path: string[]; sectionId: string; fieldId: string; index: number }
		| null;

	let { definition, selected, onSelectSection, onMoveSection, onMoveField, onDeleteField }: Props =
		$props();

	let collapsedSectionKeys = new SvelteSet<string>();
	let dragState = $state<DragState>(null);

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

	function sectionKey(path: string[], sectionId: string) {
		return [...path, sectionId].join('/');
	}

	function isCollapsed(path: string[], sectionId: string) {
		return collapsedSectionKeys.has(sectionKey(path, sectionId));
	}

	function toggleSection(path: string[], sectionId: string) {
		const key = sectionKey(path, sectionId);
		if (collapsedSectionKeys.has(key)) {
			collapsedSectionKeys.delete(key);
		} else {
			collapsedSectionKeys.add(key);
		}
	}

	function equalDragPath(left: string[], right: string[]) {
		return left.length === right.length && left.every((value, index) => value === right[index]);
	}

	function handleSectionDrop(
		event: DragEvent,
		path: string[],
		section: EmrBuilderSection,
		index: number
	) {
		event.preventDefault();
		if (!dragState || dragState.type !== 'section') return;
		if (!equalDragPath(dragState.path, path) || dragState.sectionId === section.id) return;
		onMoveSection(path, dragState.sectionId, index);
		dragState = null;
	}

	function handleFieldDrop(
		event: DragEvent,
		path: string[],
		sectionId: string,
		field: EmrBuilderField,
		index: number
	) {
		event.preventDefault();
		if (!dragState || dragState.type !== 'field') return;
		if (
			!equalDragPath(dragState.path, path) ||
			dragState.sectionId !== sectionId ||
			dragState.fieldId === field.id
		) {
			return;
		}
		onMoveField(path, sectionId, dragState.fieldId, index);
		dragState = null;
	}

	function deleteField(path: string[], sectionId: string, field: EmrBuilderField) {
		if (!confirm(`Delete field "${field.label ?? field.id}"?`)) return;
		onDeleteField(path, sectionId, field.id);
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

	function fieldVariableName(field: EmrBuilderField) {
		const odkBind = field.odkBind as { xlsformName?: unknown } | undefined;
		return (
			(typeof field.fieldName === 'string' && field.fieldName) ||
			(typeof field.key === 'string' && field.key) ||
			(typeof odkBind?.xlsformName === 'string' && odkBind.xlsformName) ||
			field.id
		);
	}

	function sectionColor(section: EmrBuilderSection, sectionIndex: number, path: string[]) {
		if (typeof section.color === 'string' && section.color) return section.color;
		const seed = [...path, section.id].join('/').split('');
		const hash = seed.reduce((sum, char) => sum + char.charCodeAt(0), sectionIndex);
		return sectionColorPalette[hash % sectionColorPalette.length];
	}
</script>

{#if !definition}
	<p class="empty">Load a definition draft to start the canvas preview.</p>
{:else}
	<div class="canvas">
		<h2>Section Canvas</h2>
		<p class="canvas-hint">Use row buttons or arrow keys (← → ↑ ↓) while focused to reorder.</p>
		<div class="canvas-root" role="list" aria-label="Form sections">
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
			class="canvas-row section-row"
			style={`--section-accent: ${sectionColor(section, sectionIndex, path)}`}
			role="button"
			tabindex="0"
			draggable="true"
			ondragstart={(event) => {
				event.dataTransfer?.setData('text/plain', section.id);
				dragState = { type: 'section', path, sectionId: section.id, index: sectionIndex };
			}}
			ondragend={() => {
				dragState = null;
			}}
			ondragover={(event) => event.preventDefault()}
			ondrop={(event) => handleSectionDrop(event, path, section, sectionIndex)}
			onclick={(event) => {
				if ((event.target as HTMLElement).closest('button')) return;
				handleSectionSelection(section, path);
			}}
			onkeydown={(event) => {
				if ((event.target as HTMLElement).closest('button')) return;
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					handleSectionSelection(section, path);
					return;
				}
				onSectionKeydown(event, path, section, sectionIndex);
			}}
		>
			<div class="row-controls">
				<button
					type="button"
					class="icon-button drag-handle"
					aria-label={`Drag section ${section.title}`}
					title="Drag section"
				>
					⋮⋮
				</button>
				<button
					type="button"
					class="icon-button move-button"
					onclick={() => toggleSection(path, section.id)}
					aria-expanded={!isCollapsed(path, section.id)}
					aria-label={`${isCollapsed(path, section.id) ? 'Expand' : 'Collapse'} section ${section.title}`}
					title={isCollapsed(path, section.id) ? 'Expand section' : 'Collapse section'}
				>
					{isCollapsed(path, section.id) ? '▸' : '▾'}
				</button>
				<button
					type="button"
					class="icon-button move-button"
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
					class="icon-button move-button"
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
					class="title-button"
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
				<span class="variable-name">{section.id}</span>
				<span>order {section.order}</span>
			</div>
		</div>

		<div class="children" hidden={isCollapsed(path, section.id)}>
			{#if section.fields.length > 0}
				<div class="field-list" role="list" aria-label={`Fields in ${section.title}`}>
					{#each section.fields as field, fieldIndex (field.id)}
						<div
							aria-label={`Field ${field.label ?? field.id} (${field.id})`}
							class:selected={isFieldSelected(section.id, path, field.id)}
							class="canvas-row field-row"
							role="button"
							tabindex="0"
							draggable="true"
							ondragstart={(event) => {
								event.dataTransfer?.setData('text/plain', field.id);
								dragState = {
									type: 'field',
									path,
									sectionId: section.id,
									fieldId: field.id,
									index: fieldIndex
								};
							}}
							ondragend={() => {
								dragState = null;
							}}
							ondragover={(event) => event.preventDefault()}
							ondrop={(event) => handleFieldDrop(event, path, section.id, field, fieldIndex)}
							onclick={(event) => {
								if ((event.target as HTMLElement).closest('button')) return;
								handleFieldSelection(section, field, path);
							}}
							onkeydown={(event) => {
								if ((event.target as HTMLElement).closest('button')) return;
								if (event.key === 'Enter' || event.key === ' ') {
									event.preventDefault();
									handleFieldSelection(section, field, path);
									return;
								}
								onFieldKeydown(event, path, section.id, field, fieldIndex);
							}}
						>
							<div class="row-controls">
								<button
									type="button"
									class="icon-button drag-handle"
									aria-label={`Drag field ${field.id}`}
									title="Drag field"
								>
									⋮⋮
								</button>
								<button
									type="button"
									class="icon-button move-button"
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
									class="icon-button move-button"
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
									class="title-button"
									onclick={() => handleFieldSelection(section, field, path)}
									aria-label={`Select field ${field.id}`}
									class:selected-control={selected?.type === 'field' &&
										selected.fieldId === field.id &&
										selected.sectionId === section.id &&
										equalPath(selected.path, path)}
								>
									{field.label ?? field.id}
								</button>
								<button
									type="button"
									class="icon-button danger"
									onclick={() => deleteField(path, section.id, field)}
									aria-label={`Delete field ${field.id}`}
									title="Delete field"
								>
									×
								</button>
							</div>
							<div class="meta">
								<span class="muted">{field.type ?? 'field'}</span>
								<span class="variable-name">{fieldVariableName(field)}</span>
								<span>order {field.order}</span>
							</div>
						</div>
					{/each}
				</div>
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
		cursor: grab;
	}
	.canvas-row:active {
		cursor: grabbing;
	}
	.section-row {
		border-left: 0.45rem solid var(--section-accent);
		background:
			linear-gradient(
				90deg,
				color-mix(in srgb, var(--section-accent) 10%, transparent),
				transparent 55%
			),
			var(--color-surface-card);
	}
	.canvas-row.selected,
	.canvas-row:focus-within {
		outline: 2px solid var(--color-focus-ring);
		outline-offset: 1px;
	}
	.row-controls {
		display: flex;
		flex-wrap: nowrap;
		gap: 0.35rem;
		align-items: center;
		min-width: 0;
	}
	.row-controls button {
		margin: 0;
	}
	.icon-button {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		width: 2rem;
		height: 2rem;
		padding: 0;
		border-radius: 0.35rem;
		line-height: 1;
	}
	.drag-handle {
		cursor: grab;
		color: var(--color-text-muted);
		background: var(--color-surface-muted, #f6f7f9);
	}
	.drag-handle:active {
		cursor: grabbing;
	}
	.row-controls button.move-button {
		border-color: #cbd5e1;
		background: #f1f5f9;
		color: #334155;
		font-weight: 800;
	}
	.row-controls button.move-button:hover:not(:disabled) {
		background: #e2e8f0;
		border-color: #94a3b8;
		color: #1e293b;
	}
	.row-controls button.move-button:disabled {
		opacity: 0.45;
	}
	.title-button {
		max-width: min(32rem, 100%);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
	}
	.row-controls button.selected-control {
		background: var(--color-rpc-sky);
		border-color: var(--color-rpc-sky-border);
		color: var(--color-rpc-sky-ink);
	}
	.row-controls .danger {
		margin-left: auto;
		border-color: #f2b8b5;
		background: #fff8f7;
		color: #9f1d1d;
		font-size: 1.35rem;
		font-weight: 800;
	}
	.row-controls .danger:hover {
		background: #fdeceb;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		font-size: 0.8rem;
		color: var(--color-text-muted);
	}
	.variable-name {
		color: #94a3b8;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
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
