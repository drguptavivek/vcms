<script lang="ts">
	import {
		getField,
		getSectionByPath,
		type EmrBuilderDefinition,
		type EmrBuilderField,
		type EmrBuilderSection,
		type EmrBuilderSelection
	} from './emr-builder-reorder-model';

	type Props = {
		definition: EmrBuilderDefinition | null;
		selection: EmrBuilderSelection | null;
		onAddField: (sectionId: string, path: string[]) => void;
		onUpdateSection: (selection: EmrBuilderSelection, patch: Record<string, unknown>) => void;
		onUpdateField: (selection: EmrBuilderSelection, patch: Record<string, unknown>) => void;
		onAddOption: (selection: EmrBuilderSelection) => void;
		onUpdateOption: (
			selection: EmrBuilderSelection,
			optionIndex: number,
			patch: Record<string, unknown>
		) => void;
		onRemoveOption: (selection: EmrBuilderSelection, optionIndex: number) => void;
		languages: string[];
		activeLanguage: string;
	};

	let {
		definition,
		selection,
		onAddField,
		onUpdateSection,
		onUpdateField,
		onAddOption,
		onUpdateOption,
		onRemoveOption,
		languages,
		activeLanguage
	}: Props = $props();

	const fieldTypes = [
		'text',
		'number',
		'decimal',
		'date',
		'time',
		'datetime',
		'single_choice',
		'multi_choice',
		'boolean',
		'note',
		'barcode',
		'image',
		'calculate'
	] as const;

	const widths = ['full', 'half', 'third', 'quarter'] as const;

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

	function asString(value: unknown): string {
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		if (value && typeof value === 'object' && 'value' in value) {
			const expressionValue = (value as { value?: unknown }).value;
			return asString(expressionValue);
		}
		return '';
	}

	function textExpression(value: string) {
		const trimmed = value.trim();
		return trimmed ? { value: trimmed } : undefined;
	}

	function updateSection(patch: Record<string, unknown>) {
		if (!selection || selection.type !== 'section') return;
		onUpdateSection(selection, patch);
	}

	function updateField(patch: Record<string, unknown>) {
		if (!selection || selection.type !== 'field') return;
		onUpdateField(selection, patch);
	}

	function updateFieldValidation(patch: Record<string, unknown>) {
		if (!field) return;
		updateField({ validation: { ...(field.validation as object | undefined), ...patch } });
	}

	function updateOdkBind(patch: Record<string, unknown>) {
		if (!field) return;
		updateField({ odkBind: { ...(field.odkBind as object | undefined), ...patch } });
	}

	function updateSnomed(patch: Record<string, unknown>) {
		if (!field) return;
		updateField({ snomed: { ...(field.snomed as object | undefined), ...patch } });
	}

	function choicesFor(field: EmrBuilderField) {
		const choiceSet = field.choiceSet as { choices?: Record<string, unknown>[] } | undefined;
		return Array.isArray(choiceSet?.choices) ? choiceSet.choices : [];
	}

	function localizedValue(source: unknown, language: string): string {
		if (!source || typeof source !== 'object') return '';
		const value = (source as Record<string, unknown>)[language];
		return asString(value);
	}

	function withLocalizedValue(source: unknown, language: string, value: string) {
		const current = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
		return {
			...current,
			[language]: value || undefined
		};
	}

	function sectionTitle(value: EmrBuilderSection) {
		return typeof value.title === 'string' ? value.title : value.id;
	}
</script>

<section class="card">
	<h2>Properties</h2>
	{#if !selection}
		<p class="muted">Select a section or field to edit its XLSForm and terminology mapping.</p>
	{:else if selection.type === 'section'}
		{#if section}
			<div class="property-grid">
				<label>
					Section title
					<input
						value={sectionTitle(section)}
						oninput={(event) =>
							updateSection({ title: (event.currentTarget as HTMLInputElement).value })}
					/>
				</label>
				<label>
					Section kind
					<select
						value={asString(section.kind) || 'section'}
						onchange={(event) =>
							updateSection({ kind: (event.currentTarget as HTMLSelectElement).value })}
					>
						<option value="section">Section</option>
						<option value="group">Group</option>
						<option value="repeat">Repeat</option>
					</select>
				</label>
			</div>
			<div class="check-row">
				<label>
					<input
						type="checkbox"
						checked={Boolean(section.collapsible)}
						onchange={(event) =>
							updateSection({ collapsible: (event.currentTarget as HTMLInputElement).checked })}
					/>
					Collapsible
				</label>
				<label>
					<input
						type="checkbox"
						checked={Boolean(section.defaultCollapsed)}
						onchange={(event) =>
							updateSection({
								defaultCollapsed: (event.currentTarget as HTMLInputElement).checked
							})}
					/>
					Default collapsed
				</label>
			</div>
			<div class="toolbar">
				<button type="button" onclick={() => onAddField(section.id, selection.path)}
					>Add Field</button
				>
			</div>
			<h3>Section JSON</h3>
			<pre>{sectionJson}</pre>
		{:else}
			<p class="error">The selected section could not be resolved from the current draft.</p>
		{/if}
	{:else if field}
		<div class="property-grid">
			<label>
				Label
				<input
					value={asString(field.label)}
					oninput={(event) =>
						updateField({ label: (event.currentTarget as HTMLInputElement).value })}
				/>
			</label>
			<label>
				Column name
				<input
					value={asString(field.key)}
					oninput={(event) => updateField({ key: (event.currentTarget as HTMLInputElement).value })}
				/>
			</label>
			<label>
				XLSForm name
				<input
					value={asString((field.odkBind as { xlsformName?: unknown } | undefined)?.xlsformName)}
					oninput={(event) =>
						updateOdkBind({ xlsformName: (event.currentTarget as HTMLInputElement).value })}
				/>
			</label>
			<label>
				Type
				<select
					value={asString(field.type)}
					onchange={(event) =>
						updateField({ type: (event.currentTarget as HTMLSelectElement).value })}
				>
					{#each fieldTypes as type (type)}
						<option value={type}>{type}</option>
					{/each}
				</select>
			</label>
			<label>
				Width
				<select
					value={asString(field.width) || 'full'}
					onchange={(event) =>
						updateField({ width: (event.currentTarget as HTMLSelectElement).value })}
				>
					{#each widths as width (width)}
						<option value={width}>{width}</option>
					{/each}
				</select>
			</label>
			<label>
				Help text
				<input
					value={asString(field.helpText)}
					oninput={(event) =>
						updateField({ helpText: (event.currentTarget as HTMLInputElement).value || undefined })}
				/>
			</label>
		</div>

		{#if languages.length > 1}
			<h3>Language: {activeLanguage}</h3>
			<div class="property-grid">
				<label>
					Label
					<input
						value={localizedValue(field.localizedLabel, activeLanguage)}
						oninput={(event) =>
							updateField({
								localizedLabel: withLocalizedValue(
									field.localizedLabel,
									activeLanguage,
									(event.currentTarget as HTMLInputElement).value
								)
							})}
					/>
				</label>
				<label>
					Hint
					<input
						value={localizedValue(field.localizedHint, activeLanguage)}
						oninput={(event) =>
							updateField({
								localizedHint: withLocalizedValue(
									field.localizedHint,
									activeLanguage,
									(event.currentTarget as HTMLInputElement).value
								)
							})}
					/>
				</label>
				<label>
					Required message
					<input
						value={localizedValue(field.localizedRequiredMessage, activeLanguage)}
						oninput={(event) =>
							updateField({
								localizedRequiredMessage: withLocalizedValue(
									field.localizedRequiredMessage,
									activeLanguage,
									(event.currentTarget as HTMLInputElement).value
								)
							})}
					/>
				</label>
				<label>
					Constraint message
					<input
						value={localizedValue(field.localizedConstraintMessage, activeLanguage)}
						oninput={(event) =>
							updateField({
								localizedConstraintMessage: withLocalizedValue(
									field.localizedConstraintMessage,
									activeLanguage,
									(event.currentTarget as HTMLInputElement).value
								)
							})}
					/>
				</label>
			</div>
		{/if}

		<div class="check-row">
			<label>
				<input
					type="checkbox"
					checked={Boolean(field.required)}
					onchange={(event) =>
						updateField({ required: (event.currentTarget as HTMLInputElement).checked })}
				/>
				Required
			</label>
			<label>
				<input
					type="checkbox"
					checked={Boolean(field.readOnly ?? field.readonly)}
					onchange={(event) =>
						updateField({
							readOnly: (event.currentTarget as HTMLInputElement).checked,
							readonly: (event.currentTarget as HTMLInputElement).checked
						})}
				/>
				Read-only / note
			</label>
			<label>
				<input
					type="checkbox"
					checked={Boolean(field.hidden)}
					onchange={(event) =>
						updateField({ hidden: (event.currentTarget as HTMLInputElement).checked })}
				/>
				Hidden
			</label>
		</div>

		<h3>XLSForm Logic</h3>
		<div class="property-grid">
			<label>
				Required expression
				<input
					value={asString((field.odkBind as { required?: unknown } | undefined)?.required)}
					oninput={(event) =>
						updateOdkBind({
							required: textExpression((event.currentTarget as HTMLInputElement).value)
						})}
				/>
			</label>
			<label>
				Relevance
				<input
					value={asString((field.odkBind as { relevant?: unknown } | undefined)?.relevant)}
					oninput={(event) =>
						updateOdkBind({
							relevant: textExpression((event.currentTarget as HTMLInputElement).value)
						})}
				/>
			</label>
			<label>
				Calculate
				<input
					value={asString((field.odkBind as { calculation?: unknown } | undefined)?.calculation)}
					oninput={(event) =>
						updateOdkBind({
							calculation: textExpression((event.currentTarget as HTMLInputElement).value)
						})}
				/>
			</label>
			<label>
				Constraint
				<input
					value={asString((field.odkBind as { constraint?: unknown } | undefined)?.constraint)}
					oninput={(event) =>
						updateOdkBind({
							constraint: textExpression((event.currentTarget as HTMLInputElement).value)
						})}
				/>
			</label>
			<label>
				Constraint message
				<input
					value={asString(
						(field.odkBind as { constraintMessage?: unknown } | undefined)?.constraintMessage
					)}
					oninput={(event) =>
						updateOdkBind({
							constraintMessage: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				Appearance
				<input
					value={asString((field.odkBind as { appearance?: unknown } | undefined)?.appearance)}
					oninput={(event) =>
						updateOdkBind({
							appearance: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
		</div>

		<h3>Validation</h3>
		<div class="property-grid compact">
			<label>
				Min
				<input
					type="number"
					value={asString((field.validation as { min?: unknown } | undefined)?.min)}
					oninput={(event) =>
						updateFieldValidation({
							min: (event.currentTarget as HTMLInputElement).value
								? Number((event.currentTarget as HTMLInputElement).value)
								: undefined
						})}
				/>
			</label>
			<label>
				Max
				<input
					type="number"
					value={asString((field.validation as { max?: unknown } | undefined)?.max)}
					oninput={(event) =>
						updateFieldValidation({
							max: (event.currentTarget as HTMLInputElement).value
								? Number((event.currentTarget as HTMLInputElement).value)
								: undefined
						})}
				/>
			</label>
			<label>
				Pattern
				<input
					value={asString((field.validation as { pattern?: unknown } | undefined)?.pattern)}
					oninput={(event) =>
						updateFieldValidation({
							pattern: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				Required message
				<input
					value={asString(
						(field.validation as { requiredMessage?: unknown } | undefined)?.requiredMessage
					)}
					oninput={(event) =>
						updateFieldValidation({
							requiredMessage: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
		</div>

		{#if field.type === 'single_choice' || field.type === 'multi_choice'}
			<h3>Options</h3>
			<div class="option-list">
				{#each choicesFor(field) as choice, index (`${choice.value ?? index}-${index}`)}
					<div class="option-row">
						<input
							aria-label="Option value"
							value={asString(choice.value)}
							oninput={(event) =>
								selection &&
								onUpdateOption(selection, index, {
									value: (event.currentTarget as HTMLInputElement).value
								})}
						/>
						<input
							aria-label="Option label"
							value={asString(choice.label)}
							oninput={(event) =>
								selection &&
								onUpdateOption(selection, index, {
									label: (event.currentTarget as HTMLInputElement).value
								})}
						/>
						<input
							aria-label="Option SNOMED code"
							value={asString(choice.code)}
							oninput={(event) =>
								selection &&
								onUpdateOption(selection, index, {
									codeSystem: (event.currentTarget as HTMLInputElement).value
										? 'snomed-ct'
										: undefined,
									code: (event.currentTarget as HTMLInputElement).value || undefined
								})}
						/>
						<button type="button" onclick={() => selection && onRemoveOption(selection, index)}>
							Remove
						</button>
						{#if languages.length > 1}
							<input
								class="localized-option"
								aria-label={`Option label in ${activeLanguage}`}
								value={localizedValue(choice.localizedLabel, activeLanguage)}
								oninput={(event) =>
									selection &&
									onUpdateOption(selection, index, {
										localizedLabel: withLocalizedValue(
											choice.localizedLabel,
											activeLanguage,
											(event.currentTarget as HTMLInputElement).value
										)
									})}
							/>
						{/if}
					</div>
				{/each}
				<button type="button" onclick={() => selection && onAddOption(selection)}>Add Option</button
				>
			</div>
		{/if}

		<h3>SNOMED CT</h3>
		<div class="property-grid">
			<label>
				Concept ID
				<input
					value={asString((field.snomed as { conceptId?: unknown } | undefined)?.conceptId)}
					oninput={(event) =>
						updateSnomed({
							conceptId: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				Preferred term
				<input
					value={asString((field.snomed as { preferredTerm?: unknown } | undefined)?.preferredTerm)}
					oninput={(event) =>
						updateSnomed({
							preferredTerm: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
		</div>

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
	.property-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
		gap: 0.65rem;
	}
	.property-grid.compact {
		grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
	}
	.check-row,
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem;
		align-items: center;
		margin-top: 0.7rem;
	}
	.check-row label {
		display: inline-flex;
		grid-template-columns: auto 1fr;
		gap: 0.35rem;
		align-items: center;
	}
	.option-list {
		display: grid;
		gap: 0.45rem;
	}
	.option-row {
		display: grid;
		grid-template-columns: minmax(6rem, 0.7fr) minmax(10rem, 1.2fr) minmax(7rem, 0.8fr) auto;
		gap: 0.4rem;
		align-items: center;
	}
	.localized-option {
		grid-column: 1 / -1;
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
	@media (max-width: 720px) {
		.option-row {
			grid-template-columns: 1fr;
		}
	}
</style>
