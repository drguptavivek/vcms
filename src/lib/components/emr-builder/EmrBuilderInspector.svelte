<script lang="ts">
	import {
		getField,
		getSectionByPath,
		type EmrBuilderDefinition,
		type EmrBuilderField,
		type EmrBuilderSection,
		type EmrBuilderSelection
	} from './emr-builder-reorder-model';
	import { resolve } from '$app/paths';

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

	type SnomedConceptResult = {
		terminologySystem: 'SNOMED_CT';
		conceptId: string;
		preferredTerm: string;
		fullySpecifiedName?: string;
		semanticTag?: string;
		active: boolean;
		moduleId?: string;
		effectiveTime?: string;
		edition?: string;
		version?: string;
		languageRefset?: string;
		sourceService?: string;
	};

	type TerminologySearchPayload = {
		ok: boolean;
		data?: {
			provider: string;
			edition?: string;
			version?: string;
			browserUrl?: string;
			results: SnomedConceptResult[];
		};
		error?: { message?: string };
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
		'integer',
		'decimal',
		'range',
		'date',
		'time',
		'datetime',
		'single_choice',
		'multi_choice',
		'geopoint',
		'geotrace',
		'geoshape',
		'boolean',
		'instructions',
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
	let snomedQuery = $state('');
	let snomedResults = $state<SnomedConceptResult[]>([]);
	let snomedStatus = $state<'idle' | 'loading' | 'error'>('idle');
	let snomedError = $state('');
	let snomedBrowserUrl = $state<string | undefined>(undefined);

	function asString(value: unknown): string {
		if (typeof value === 'string') return value;
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		if (value && typeof value === 'object' && 'value' in value) {
			const expressionValue = (value as { value?: unknown }).value;
			return asString(expressionValue);
		}
		return '';
	}

	function recordFrom(value: unknown): Record<string, unknown> {
		return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	}

	function nestedRecordFrom(value: unknown, key: string): Record<string, unknown> {
		return recordFrom(recordFrom(value)[key]);
	}

	function fieldGroup(group: string): Record<string, unknown> {
		return field ? recordFrom(field[group]) : {};
	}

	function sectionGroup(group: string): Record<string, unknown> {
		return section ? recordFrom(section[group]) : {};
	}

	function fieldGroupValue(group: string, key: string): unknown {
		return fieldGroup(group)[key];
	}

	function sectionGroupValue(group: string, key: string): unknown {
		return sectionGroup(group)[key];
	}

	function firstString(...values: unknown[]): string {
		for (const value of values) {
			const stringValue = asString(value);
			if (stringValue) return stringValue;
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

	function updateFieldLogic(patch: Record<string, unknown>) {
		if (!field) return;
		updateField({ logic: { ...(field.logic as object | undefined), ...patch } });
	}

	function updateFieldInput(patch: Record<string, unknown>) {
		if (!field) return;
		updateField({ input: { ...(field.input as object | undefined), ...patch } });
	}

	function updateSnomed(patch: Record<string, unknown>) {
		if (!field) return;
		const current = field.snomed && typeof field.snomed === 'object' ? field.snomed : {};
		const next = compactRecord({ ...(current as Record<string, unknown>), ...patch });
		updateField({ snomed: Object.keys(next).length ? next : undefined });
	}

	function compactRecord(source: Record<string, unknown>) {
		return Object.fromEntries(
			Object.entries(source).filter(
				([, value]) => value !== undefined && value !== null && value !== ''
			)
		);
	}

	function currentSnomedConceptId() {
		return asString((field?.snomed as { conceptId?: unknown } | undefined)?.conceptId);
	}

	function clearSnomed() {
		updateSnomed({
			conceptId: undefined,
			preferredTerm: undefined,
			displayTerm: undefined,
			fullySpecifiedName: undefined,
			semanticTag: undefined,
			terminologySystem: undefined,
			edition: undefined,
			version: undefined,
			moduleId: undefined,
			effectiveTime: undefined,
			languageRefset: undefined,
			active: undefined,
			bindingStrength: undefined,
			sourceService: undefined
		});
		snomedResults = [];
		snomedError = '';
		snomedStatus = 'idle';
	}

	async function searchSnomed() {
		const query = snomedQuery.trim() || currentSnomedConceptId();
		if (query.length < 2) {
			snomedError = 'Enter at least two characters or a concept ID.';
			snomedStatus = 'error';
			return;
		}

		snomedStatus = 'loading';
		snomedError = '';

		try {
			const response = await fetch(
				`/api/v1/terminology/search?q=${encodeURIComponent(query)}&limit=8`,
				{
					headers: { accept: 'application/json' }
				}
			);
			const payload = (await response.json()) as TerminologySearchPayload;
			if (!response.ok || !payload.ok || !payload.data) {
				throw new Error(payload.error?.message ?? 'SNOMED CT search failed.');
			}

			snomedResults = payload.data.results;
			snomedBrowserUrl = payload.data.browserUrl;
			snomedStatus = 'idle';
			if (!payload.data.results.length) {
				snomedError = 'No matching concepts found.';
			}
		} catch (error) {
			snomedResults = [];
			snomedStatus = 'error';
			snomedError =
				error instanceof Error ? error.message : 'SNOMED CT terminology service is unavailable.';
		}
	}

	function selectSnomed(concept: SnomedConceptResult) {
		updateSnomed({
			terminologySystem: concept.terminologySystem,
			conceptId: concept.conceptId,
			preferredTerm: concept.preferredTerm,
			displayTerm: concept.preferredTerm,
			fullySpecifiedName: concept.fullySpecifiedName,
			semanticTag: concept.semanticTag,
			active: concept.active,
			moduleId: concept.moduleId,
			effectiveTime: concept.effectiveTime,
			edition: concept.edition,
			version: concept.version,
			languageRefset: concept.languageRefset,
			sourceService: concept.sourceService,
			bindingStrength: 'unreviewed'
		});
		snomedQuery = concept.preferredTerm;
		snomedResults = [];
		snomedError = '';
		snomedStatus = 'idle';
	}

	function updateSectionOpenEhrMapping(patch: Record<string, unknown>) {
		if (!section) return;
		updateSection({
			openEhrMapping: {
				...(section.openEhrMapping as object | undefined),
				...patch
			}
		});
	}

	function updateFieldOpenEhrMapping(patch: Record<string, unknown>) {
		if (!field) return;
		updateField({
			openEhrMapping: {
				...(field.openEhrMapping as object | undefined),
				...patch
			}
		});
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

	const propertyHelp: Record<string, string> = {
		'Section title': 'Name shown for this section in the form builder and clinical form.',
		'Section kind': 'Choose a normal section, grouped questions, or a repeatable block.',
		'Section relevance': 'Condition that controls whether this section is shown.',
		'Section appearance': 'Display style for this section.',
		'Section color': 'Accent color used to visually distinguish this section in the builder.',
		'Repeat count': 'Fixed number or expression that controls how many repeats are created.',
		Collapsible: 'Allow users to collapse or expand this section.',
		'Default collapsed': 'Start this section collapsed when the form opens.',
		Label: 'Text shown to the user for this field.',
		Hint: 'Localized help text shown with this field.',
		'Column name': 'Storage/export column key for this field.',
		'Field name': 'Variable name used in expressions and form logic.',
		Type: 'Answer/input type for this field.',
		Width: 'How much horizontal space this field should occupy.',
		'Help text': 'Short hint shown with the field during data entry.',
		'Guidance hint': 'Training or print guidance that is not normally shown during entry.',
		Required: 'Always require a response before completing the form.',
		'Read-only / note':
			'Show the value without allowing edits, or treat the field as display-only.',
		Hidden: 'Store this field without showing it in the form UI.',
		'Barcode input': 'Allow a barcode scanner to populate this text field.',
		'Required expression': 'Condition that makes the field required only when true.',
		Relevance: 'Condition that controls whether this field is shown.',
		Calculate: 'Expression used to calculate this field value.',
		Trigger: 'Field change that causes a calculation to run.',
		Constraint: 'Validation expression that the response must satisfy.',
		'Constraint message': 'Message shown when the constraint fails.',
		Appearance: 'Display style or widget hint for this field.',
		'Choice filter': 'Expression that filters available options based on earlier answers.',
		'Randomize choices': 'Show options in random order.',
		'Randomization seed': 'Expression used to keep randomized options reproducible.',
		'Capture accuracy': 'Target GPS accuracy before automatically accepting a point.',
		'Warning accuracy': 'GPS accuracy threshold that should warn the user.',
		'Range start': 'First value in the range control.',
		'Range end': 'Last value in the range control.',
		'Range step': 'Increment between range values.',
		'Max pixels': 'Largest image side after automatic resize.',
		'Min length': 'Minimum number of characters allowed.',
		'Max length': 'Maximum number of characters allowed.',
		Min: 'Minimum numeric value allowed.',
		Max: 'Maximum numeric value allowed.',
		Pattern: 'Regular expression pattern the response must match.',
		'Entry mask':
			'Input mask such as ##-##-###### where # is number, $ is letter, X is any character.',
		'Text case': 'Automatically transform text as it is entered.',
		'Required message': 'Message shown when a required answer is missing.',
		Value: 'Stored value for this option.',
		'SNOMED CT code': 'Clinical code attached to this option or field.',
		'Search SNOMED CT': 'Search the configured terminology service through the application API.',
		'Concept ID': 'SNOMED CT concept identifier for this field.',
		'Preferred term': 'Human-readable clinical term for the selected concept.',
		'Fully specified name': 'Complete SNOMED CT term including semantic tag.',
		'Semantic tag': 'SNOMED CT category such as disorder, finding, or procedure.',
		Edition: 'SNOMED CT edition used when the concept was selected.',
		'Terminology version': 'SNOMED CT release version used for this binding.',
		'Binding strength': 'Review status or semantic strength of this code binding.',
		'Web Template path':
			'Flat path used when saving this value in an EHRbase Web Template composition.',
		'Archetype ID': 'Clinical archetype that defines this reusable clinical concept.',
		'Archetype path': 'Path inside the archetype for this section, field, or option.',
		'Template ID': 'openEHR template that localizes the archetype for this form.',
		'Template path': 'Canonical path inside the openEHR template.',
		'RM type': 'openEHR Reference Model node type, such as ELEMENT or CLUSTER.',
		'Data value type': 'openEHR data value type, such as DV_TEXT or DV_CODED_TEXT.',
		'Structure type': 'Whether this section maps to an ENTRY or CLUSTER structure.'
	};

	function help(property: string) {
		return propertyHelp[property] ?? `${property} setting.`;
	}
</script>

{#snippet labelText(text: string)}
	<span class="label-head">
		<span>{text}</span>
		<span class="help-dot" data-tip={help(text)} aria-label={help(text)}>(i)</span>
	</span>
{/snippet}

<section class="card inspector-panel">
	<h2>Properties</h2>
	{#if !selection}
		<p class="muted">Select a section or field to edit its field mapping and terminology.</p>
	{:else if selection.type === 'section'}
		{#if section}
			<h3>Section Setup</h3>
			<div class="property-grid">
				<label>
					{@render labelText('Section title')}
					<input
						value={sectionTitle(section)}
						oninput={(event) =>
							updateSection({ title: (event.currentTarget as HTMLInputElement).value })}
					/>
				</label>
				<label>
					{@render labelText('Section kind')}
					<select
						value={asString(section.kind) || 'section'}
						onchange={(event) =>
							updateSection({ kind: (event.currentTarget as HTMLSelectElement).value })}
					>
						<option value="section">Section</option>
						<option value="group">Group</option>
						<option value="repeatable_group">Repeat</option>
					</select>
				</label>
				<label>
					{@render labelText('Section relevance')}
					<input
						value={asString(sectionGroupValue('odk', 'relevant'))}
						oninput={(event) =>
							updateSection({
								odk: {
									...(section.odk as object | undefined),
									relevant: (event.currentTarget as HTMLInputElement).value || undefined
								}
							})}
					/>
				</label>
				<label>
					{@render labelText('Section appearance')}
					<input
						value={asString(sectionGroupValue('odk', 'appearance'))}
						oninput={(event) =>
							updateSection({
								odk: {
									...(section.odk as object | undefined),
									appearance: (event.currentTarget as HTMLInputElement).value || undefined
								}
							})}
					/>
				</label>
				<label>
					{@render labelText('Section color')}
					<input
						type="color"
						value={asString(section.color) || '#2563eb'}
						oninput={(event) =>
							updateSection({
								color: (event.currentTarget as HTMLInputElement).value || undefined
							})}
					/>
				</label>
				{#if section.kind === 'repeatable_group'}
					<label>
						{@render labelText('Repeat count')}
						<input
							value={asString(nestedRecordFrom(section.odk, 'repeat').count)}
							oninput={(event) =>
								updateSection({
									odk: {
										...(section.odk as object | undefined),
										repeat: {
											...((section.odk as { repeat?: object } | undefined)?.repeat ?? {}),
											count: (event.currentTarget as HTMLInputElement).value
												? { value: (event.currentTarget as HTMLInputElement).value }
												: undefined
										}
									}
								})}
						/>
					</label>
				{/if}
			</div>
			<h3>openEHR Structure Mapping</h3>
			<div class="property-grid">
				<label>
					{@render labelText('Web Template path')}
					<input
						value={asString(sectionGroupValue('openEhrMapping', 'webTemplatePath'))}
						oninput={(event) =>
							updateSectionOpenEhrMapping({
								webTemplatePath: (event.currentTarget as HTMLInputElement).value || undefined
							})}
					/>
				</label>
				<label>
					{@render labelText('Archetype ID')}
					<input
						value={asString(sectionGroupValue('openEhrMapping', 'archetypeId'))}
						oninput={(event) =>
							updateSectionOpenEhrMapping({
								archetypeId: (event.currentTarget as HTMLInputElement).value || undefined
							})}
					/>
				</label>
				<label>
					{@render labelText('Archetype path')}
					<input
						value={asString(sectionGroupValue('openEhrMapping', 'archetypePath'))}
						oninput={(event) =>
							updateSectionOpenEhrMapping({
								archetypePath: (event.currentTarget as HTMLInputElement).value || undefined
							})}
					/>
				</label>
				<label>
					{@render labelText('Template ID')}
					<input
						value={asString(sectionGroupValue('openEhrMapping', 'templateId'))}
						oninput={(event) =>
							updateSectionOpenEhrMapping({
								templateId: (event.currentTarget as HTMLInputElement).value || undefined
							})}
					/>
				</label>
				<label>
					{@render labelText('Template path')}
					<input
						value={asString(sectionGroupValue('openEhrMapping', 'templatePath'))}
						oninput={(event) =>
							updateSectionOpenEhrMapping({
								templatePath: (event.currentTarget as HTMLInputElement).value || undefined
							})}
					/>
				</label>
				<label>
					{@render labelText('Structure type')}
					<select
						value={asString(sectionGroupValue('openEhrMapping', 'archetypeStructure'))}
						onchange={(event) =>
							updateSectionOpenEhrMapping({
								archetypeStructure: (event.currentTarget as HTMLSelectElement).value || undefined
							})}
					>
						<option value="">Not mapped</option>
						<option value="ENTRY">ENTRY</option>
						<option value="CLUSTER">CLUSTER</option>
					</select>
				</label>
			</div>
			<h3>Section Behavior</h3>
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
			<details class="advanced-group">
				<summary>Advanced JSON</summary>
				<pre>{sectionJson}</pre>
			</details>
		{:else}
			<p class="error">The selected section could not be resolved from the current draft.</p>
		{/if}
	{:else if field}
		<h3>Field Setup</h3>
		<div class="property-grid">
			<label>
				{@render labelText('Label')}
				<input
					value={asString(field.label)}
					oninput={(event) =>
						updateField({ label: (event.currentTarget as HTMLInputElement).value })}
				/>
			</label>
			<label>
				{@render labelText('Column name')}
				<input
					value={asString(field.key)}
					oninput={(event) => updateField({ key: (event.currentTarget as HTMLInputElement).value })}
				/>
			</label>
			<label>
				{@render labelText('Field name')}
				<input
					value={firstString(field.fieldName, fieldGroupValue('odkBind', 'xlsformName'))}
					oninput={(event) =>
						updateField({
							fieldName: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Type')}
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
				{@render labelText('Width')}
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
				{@render labelText('Help text')}
				<input
					value={asString(field.helpText)}
					oninput={(event) =>
						updateField({ helpText: (event.currentTarget as HTMLInputElement).value || undefined })}
				/>
			</label>
			<label>
				{@render labelText('Guidance hint')}
				<input
					value={asString(field.guidanceHint)}
					oninput={(event) =>
						updateField({
							guidanceHint: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
		</div>

		{#if languages.length > 1}
			<h3>Translations: {activeLanguage}</h3>
			<div class="property-grid">
				<label>
					{@render labelText('Label')}
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
					{@render labelText('Hint')}
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
					{@render labelText('Required message')}
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
					{@render labelText('Constraint message')}
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

		<h3>State And Input</h3>
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
			{#if field.type === 'text' || field.type === 'textarea'}
				<label>
					<input
						type="checkbox"
						checked={Boolean(
							fieldGroupValue('input', 'barcodeInput') ?? fieldGroupValue('odkBind', 'barcodeInput')
						)}
						onchange={(event) =>
							updateFieldInput({
								barcodeInput: (event.currentTarget as HTMLInputElement).checked
							})}
					/>
					Barcode input
				</label>
			{/if}
		</div>

		<h3>Logic</h3>
		<div class="property-grid">
			<label>
				{@render labelText('Required expression')}
				<input
					value={asString(fieldGroupValue('odkBind', 'required'))}
					oninput={(event) =>
						updateFieldLogic({
							required: textExpression((event.currentTarget as HTMLInputElement).value)
						})}
				/>
			</label>
			<label>
				{@render labelText('Required message')}
				<input
					value={asString(fieldGroupValue('validation', 'requiredMessage'))}
					oninput={(event) =>
						updateFieldValidation({
							requiredMessage: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Relevance')}
				<input
					value={firstString(
						fieldGroupValue('logic', 'relevance'),
						fieldGroupValue('odkBind', 'relevant')
					)}
					oninput={(event) =>
						updateFieldLogic({
							relevance: textExpression((event.currentTarget as HTMLInputElement).value)
						})}
				/>
			</label>
			<label>
				{@render labelText('Calculate')}
				<input
					value={firstString(
						fieldGroupValue('logic', 'calculation'),
						fieldGroupValue('odkBind', 'calculation')
					)}
					oninput={(event) =>
						updateFieldLogic({
							calculation: textExpression((event.currentTarget as HTMLInputElement).value)
						})}
				/>
			</label>
			<label>
				{@render labelText('Trigger')}
				<input
					value={firstString(
						fieldGroupValue('logic', 'trigger'),
						fieldGroupValue('odkBind', 'trigger')
					)}
					oninput={(event) =>
						updateFieldLogic({
							trigger: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Constraint')}
				<input
					value={firstString(
						fieldGroupValue('logic', 'constraint'),
						fieldGroupValue('odkBind', 'constraint')
					)}
					oninput={(event) =>
						updateFieldLogic({
							constraint: textExpression((event.currentTarget as HTMLInputElement).value)
						})}
				/>
			</label>
			<label>
				{@render labelText('Constraint message')}
				<input
					value={firstString(
						fieldGroupValue('logic', 'constraintMessage'),
						fieldGroupValue('odkBind', 'constraintMessage')
					)}
					oninput={(event) =>
						updateFieldLogic({
							constraintMessage: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Appearance')}
				<input
					value={firstString(field.appearance, fieldGroupValue('odkBind', 'appearance'))}
					oninput={(event) =>
						updateField({
							appearance: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			{#if field.type === 'single_choice' || field.type === 'multi_choice'}
				<label>
					{@render labelText('Choice filter')}
					<input
						value={firstString(
							fieldGroupValue('logic', 'choiceFilter'),
							fieldGroupValue('odkBind', 'choiceFilter')
						)}
						oninput={(event) =>
							updateFieldLogic({
								choiceFilter: (event.currentTarget as HTMLInputElement).value || undefined
							})}
					/>
				</label>
				<label>
					<input
						type="checkbox"
						checked={Boolean(fieldGroupValue('odkBind', 'randomizeChoices'))}
						onchange={(event) =>
							updateFieldLogic({
								randomizeChoices: (event.currentTarget as HTMLInputElement).checked
							})}
					/>
					Randomize choices
				</label>
				<label>
					{@render labelText('Randomization seed')}
					<input
						value={asString(fieldGroupValue('odkBind', 'randomizeSeed'))}
						oninput={(event) =>
							updateFieldLogic({
								randomizeSeed: (event.currentTarget as HTMLInputElement).value || undefined
							})}
					/>
				</label>
			{/if}
			{#if field.type === 'geopoint'}
				<label>
					{@render labelText('Capture accuracy')}
					<input
						type="number"
						min="1"
						value={firstString(
							fieldGroupValue('odkBind', 'captureAccuracy'),
							fieldGroupValue('input', 'captureAccuracy')
						)}
						oninput={(event) =>
							updateFieldInput({
								captureAccuracy: (event.currentTarget as HTMLInputElement).value
									? Number((event.currentTarget as HTMLInputElement).value)
									: undefined
							})}
					/>
				</label>
				<label>
					{@render labelText('Warning accuracy')}
					<input
						type="number"
						min="1"
						value={firstString(
							fieldGroupValue('odkBind', 'warningAccuracy'),
							fieldGroupValue('input', 'warningAccuracy')
						)}
						oninput={(event) =>
							updateFieldInput({
								warningAccuracy: (event.currentTarget as HTMLInputElement).value
									? Number((event.currentTarget as HTMLInputElement).value)
									: undefined
							})}
					/>
				</label>
			{/if}
			{#if field.type === 'range'}
				<label>
					{@render labelText('Range start')}
					<input
						type="number"
						value={firstString(
							fieldGroupValue('input', 'rangeStart'),
							fieldGroupValue('odkBind', 'rangeStart')
						)}
						oninput={(event) =>
							updateFieldInput({
								rangeStart: (event.currentTarget as HTMLInputElement).value
									? Number((event.currentTarget as HTMLInputElement).value)
									: undefined
							})}
					/>
				</label>
				<label>
					{@render labelText('Range end')}
					<input
						type="number"
						value={firstString(
							fieldGroupValue('input', 'rangeEnd'),
							fieldGroupValue('odkBind', 'rangeEnd')
						)}
						oninput={(event) =>
							updateFieldInput({
								rangeEnd: (event.currentTarget as HTMLInputElement).value
									? Number((event.currentTarget as HTMLInputElement).value)
									: undefined
							})}
					/>
				</label>
				<label>
					{@render labelText('Range step')}
					<input
						type="number"
						min="0"
						step="any"
						value={firstString(
							fieldGroupValue('input', 'rangeStep'),
							fieldGroupValue('odkBind', 'rangeStep')
						)}
						oninput={(event) =>
							updateFieldInput({
								rangeStep: (event.currentTarget as HTMLInputElement).value
									? Number((event.currentTarget as HTMLInputElement).value)
									: undefined
							})}
					/>
				</label>
			{/if}
			{#if field.type === 'image'}
				<label>
					{@render labelText('Max pixels')}
					<input
						type="number"
						min="1"
						value={firstString(
							fieldGroupValue('input', 'maxPixels'),
							fieldGroupValue('odkBind', 'maxPixels')
						)}
						oninput={(event) =>
							updateFieldInput({
								maxPixels: (event.currentTarget as HTMLInputElement).value
									? Number((event.currentTarget as HTMLInputElement).value)
									: undefined
							})}
					/>
				</label>
			{/if}
		</div>

		<h3>Validation</h3>
		<div class="property-grid compact">
			{#if field.type === 'text' || field.type === 'textarea'}
				<label>
					{@render labelText('Min length')}
					<input
						type="number"
						min="0"
						value={asString(fieldGroupValue('validation', 'minLength'))}
						oninput={(event) =>
							updateFieldValidation({
								minLength: (event.currentTarget as HTMLInputElement).value
									? Number((event.currentTarget as HTMLInputElement).value)
									: undefined
							})}
					/>
				</label>
				<label>
					{@render labelText('Max length')}
					<input
						type="number"
						min="1"
						value={asString(fieldGroupValue('validation', 'maxLength'))}
						oninput={(event) =>
							updateFieldValidation({
								maxLength: (event.currentTarget as HTMLInputElement).value
									? Number((event.currentTarget as HTMLInputElement).value)
									: undefined
							})}
					/>
				</label>
			{/if}
			<label>
				{@render labelText('Min')}
				<input
					type="number"
					value={asString(fieldGroupValue('validation', 'min'))}
					oninput={(event) =>
						updateFieldValidation({
							min: (event.currentTarget as HTMLInputElement).value
								? Number((event.currentTarget as HTMLInputElement).value)
								: undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Max')}
				<input
					type="number"
					value={asString(fieldGroupValue('validation', 'max'))}
					oninput={(event) =>
						updateFieldValidation({
							max: (event.currentTarget as HTMLInputElement).value
								? Number((event.currentTarget as HTMLInputElement).value)
								: undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Pattern')}
				<input
					value={asString(fieldGroupValue('validation', 'pattern'))}
					oninput={(event) =>
						updateFieldValidation({
							pattern: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			{#if field.type === 'text' || field.type === 'textarea'}
				<label>
					{@render labelText('Entry mask')}
					<input
						placeholder="##-##-######"
						value={firstString(
							fieldGroupValue('input', 'mask'),
							fieldGroupValue('validation', 'inputMask')
						)}
						oninput={(event) =>
							updateFieldInput({
								mask: (event.currentTarget as HTMLInputElement).value || undefined
							})}
					/>
				</label>
				<label>
					{@render labelText('Text case')}
					<select
						value={firstString(
							fieldGroupValue('validation', 'textTransform'),
							fieldGroupValue('input', 'textTransform')
						)}
						onchange={(event) =>
							updateFieldInput({
								textTransform: (event.currentTarget as HTMLSelectElement).value || undefined
							})}
					>
						<option value="">As typed</option>
						<option value="uppercase">Uppercase</option>
						<option value="lowercase">Lowercase</option>
						<option value="titlecase">Title case</option>
					</select>
				</label>
			{/if}
		</div>

		{#if field.type === 'single_choice' || field.type === 'multi_choice'}
			<h3>Options</h3>
			<div class="option-list">
				{#each choicesFor(field) as choice, index (`${choice.value ?? index}-${index}`)}
					<div class="option-card">
						<div class="option-header">
							<strong>Option {index + 1}</strong>
							<button
								type="button"
								class="remove-option"
								onclick={() => selection && onRemoveOption(selection, index)}
							>
								Remove
							</button>
						</div>
						<div class="option-row">
							<label>
								{@render labelText('Value')}
								<input
									value={asString(choice.value)}
									oninput={(event) =>
										selection &&
										onUpdateOption(selection, index, {
											value: (event.currentTarget as HTMLInputElement).value
										})}
								/>
							</label>
							<label>
								{@render labelText('Label')}
								<input
									value={asString(choice.label)}
									oninput={(event) =>
										selection &&
										onUpdateOption(selection, index, {
											label: (event.currentTarget as HTMLInputElement).value
										})}
								/>
							</label>
						</div>
						{#if languages.length > 1}
							<label>
								Label in {activeLanguage}
								<input
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
							</label>
						{/if}
						<details class="option-coding">
							<summary>Coding</summary>
							<label>
								{@render labelText('SNOMED CT code')}
								<input
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
							</label>
						</details>
					</div>
				{/each}
				<button type="button" onclick={() => selection && onAddOption(selection)}>Add Option</button
				>
			</div>
		{/if}

		<h3>SNOMED CT Coding</h3>
		<div class="snomed-picker">
			<div class="snomed-search-row">
				<label class="snomed-search-label">
					{@render labelText('Search SNOMED CT')}
					<input
						value={snomedQuery}
						placeholder="Search by term or concept ID"
						oninput={(event) => (snomedQuery = (event.currentTarget as HTMLInputElement).value)}
						onkeydown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault();
								void searchSnomed();
							}
						}}
					/>
				</label>
				<button
					type="button"
					class="secondary-action"
					disabled={snomedStatus === 'loading'}
					onclick={() => void searchSnomed()}
				>
					{snomedStatus === 'loading' ? 'Searching...' : 'Search'}
				</button>
				{#if currentSnomedConceptId()}
					<button type="button" class="secondary-action" onclick={clearSnomed}>Clear</button>
				{/if}
			</div>
			<div class="snomed-actions">
				{#if snomedBrowserUrl}
					<a href={resolve(snomedBrowserUrl as any)} target="_blank" rel="noreferrer">
						Open SNOMED browser
					</a>
				{/if}
			</div>
			{#if snomedError}
				<p class:error={snomedStatus === 'error'} class:muted={snomedStatus !== 'error'}>
					{snomedError}
				</p>
			{/if}
			{#if snomedResults.length}
				<div class="snomed-results" aria-live="polite">
					{#each snomedResults as concept (concept.conceptId)}
						<button type="button" class="snomed-result" onclick={() => selectSnomed(concept)}>
							<span>
								<strong>{concept.preferredTerm}</strong>
								{#if concept.semanticTag}
									<small>{concept.semanticTag}</small>
								{/if}
							</span>
							<span class="snomed-code">{concept.conceptId}</span>
							{#if concept.fullySpecifiedName}
								<small>{concept.fullySpecifiedName}</small>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
		<div class="property-grid">
			<label>
				{@render labelText('Concept ID')}
				<input
					value={asString(fieldGroupValue('snomed', 'conceptId'))}
					oninput={(event) =>
						updateSnomed({
							conceptId: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Preferred term')}
				<input
					value={asString(fieldGroupValue('snomed', 'preferredTerm'))}
					oninput={(event) =>
						updateSnomed({
							preferredTerm: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Fully specified name')}
				<input
					value={asString(fieldGroupValue('snomed', 'fullySpecifiedName'))}
					oninput={(event) =>
						updateSnomed({
							fullySpecifiedName: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Semantic tag')}
				<input
					value={asString(fieldGroupValue('snomed', 'semanticTag'))}
					oninput={(event) =>
						updateSnomed({
							semanticTag: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Edition')}
				<input
					value={asString(fieldGroupValue('snomed', 'edition'))}
					oninput={(event) =>
						updateSnomed({
							edition: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Terminology version')}
				<input
					value={asString(fieldGroupValue('snomed', 'version'))}
					oninput={(event) =>
						updateSnomed({
							version: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Binding strength')}
				<select
					value={asString(fieldGroupValue('snomed', 'bindingStrength'))}
					onchange={(event) =>
						updateSnomed({
							bindingStrength: (event.currentTarget as HTMLSelectElement).value || undefined
						})}
				>
					<option value="">Unspecified</option>
					<option value="unreviewed">Unreviewed</option>
					<option value="exact">Exact</option>
					<option value="narrower">Narrower</option>
					<option value="broader">Broader</option>
					<option value="related">Related</option>
				</select>
			</label>
		</div>

		<h3>openEHR Mapping</h3>
		<div class="property-grid">
			<label>
				{@render labelText('Web Template path')}
				<input
					value={asString(fieldGroupValue('openEhrMapping', 'webTemplatePath'))}
					oninput={(event) =>
						updateFieldOpenEhrMapping({
							webTemplatePath: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Archetype ID')}
				<input
					value={asString(fieldGroupValue('openEhrMapping', 'archetypeId'))}
					oninput={(event) =>
						updateFieldOpenEhrMapping({
							archetypeId: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Archetype path')}
				<input
					value={asString(fieldGroupValue('openEhrMapping', 'archetypePath'))}
					oninput={(event) =>
						updateFieldOpenEhrMapping({
							archetypePath: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Template ID')}
				<input
					value={asString(fieldGroupValue('openEhrMapping', 'templateId'))}
					oninput={(event) =>
						updateFieldOpenEhrMapping({
							templateId: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Template path')}
				<input
					value={asString(fieldGroupValue('openEhrMapping', 'templatePath'))}
					oninput={(event) =>
						updateFieldOpenEhrMapping({
							templatePath: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('RM type')}
				<input
					value={asString(fieldGroupValue('openEhrMapping', 'rmType'))}
					oninput={(event) =>
						updateFieldOpenEhrMapping({
							rmType: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
			<label>
				{@render labelText('Data value type')}
				<input
					value={asString(fieldGroupValue('openEhrMapping', 'dataValueType'))}
					oninput={(event) =>
						updateFieldOpenEhrMapping({
							dataValueType: (event.currentTarget as HTMLInputElement).value || undefined
						})}
				/>
			</label>
		</div>

		<details class="advanced-group">
			<summary>Advanced JSON</summary>
			<pre>{fieldJson}</pre>
		</details>
	{:else}
		<p class="error">The selected field could not be resolved from the current draft.</p>
	{/if}
</section>

<style>
	.inspector-panel {
		max-height: calc(100vh - 9rem);
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-gutter: stable;
	}
	.inspector-panel h2 {
		position: sticky;
		top: -1rem;
		z-index: 1;
		margin: -1rem -1rem 0.75rem;
		padding: 1rem 1rem 0.75rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface-card);
	}
	h3 {
		margin: 1rem 0 0.5rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--color-border);
		font-size: 0.9rem;
		color: var(--color-rpc-navy);
		letter-spacing: 0;
	}
	h2 + h3 {
		margin-top: 0;
		padding-top: 0;
		border-top: 0;
	}
	.property-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
		gap: 0.65rem;
	}
	.property-grid.compact {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	label {
		min-width: 0;
	}
	.label-head {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		width: fit-content;
	}
	.help-dot {
		position: relative;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		width: 1.15rem;
		height: 1.05rem;
		border: 1px solid var(--color-border-strong);
		border-radius: 999px;
		background: var(--color-surface-muted, #f6f7f9);
		color: var(--color-text-muted);
		font-size: 0.65rem;
		font-weight: 800;
		line-height: 1;
		cursor: help;
	}
	.help-dot::after {
		content: attr(data-tip);
		position: absolute;
		z-index: 20;
		left: 50%;
		top: calc(100% + 0.35rem);
		transform: translateX(-50%);
		display: none;
		width: min(17rem, calc(100vw - 3rem));
		padding: 0.4rem 0.55rem;
		border: 1px solid var(--color-border-strong);
		border-radius: 0.35rem;
		background: #111827;
		color: #fff;
		box-shadow: 0 0.4rem 1rem rgb(15 23 42 / 18%);
		font-size: 0.78rem;
		font-weight: 700;
		line-height: 1.3;
		white-space: normal;
	}
	.help-dot:hover::after,
	.help-dot:focus::after {
		display: block;
	}
	input:not([type='checkbox']),
	select {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		min-width: 1rem;
		box-sizing: border-box;
		flex: none;
	}
	input[type='color'] {
		height: 2.5rem;
		padding: 0.2rem;
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
		gap: 0.65rem;
	}
	.option-card {
		display: grid;
		gap: 0.5rem;
		padding: 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: 0.45rem;
		background: var(--color-surface-muted, #f6f7f9);
	}
	.option-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
	}
	.remove-option {
		padding: 0.35rem 0.55rem;
		border-color: #f2b8b5;
		background: #fff8f7;
		color: #9f1d1d;
	}
	.option-row {
		display: grid;
		grid-template-columns: minmax(6rem, 0.7fr) minmax(10rem, 1.3fr);
		gap: 0.55rem;
	}
	.option-coding summary {
		cursor: pointer;
		font-weight: 800;
		color: var(--color-text-muted);
	}
	.option-coding label {
		margin-top: 0.45rem;
	}
	.snomed-picker {
		display: grid;
		gap: 0.5rem;
		margin-bottom: 0.75rem;
		padding: 0.65rem;
		border: 1px solid var(--color-border);
		border-radius: 0.45rem;
		background: var(--color-surface-muted, #f6f7f9);
	}
	.snomed-search-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: 0.5rem;
		align-items: end;
	}
	.snomed-search-label {
		min-width: 0;
	}
	.snomed-actions {
		min-height: 1rem;
		font-size: 0.82rem;
		font-weight: 800;
	}
	.snomed-actions a {
		color: var(--color-rpc-teal);
		text-decoration: none;
	}
	.secondary-action {
		border-color: var(--color-border-strong);
		background: #eef2f7;
		color: var(--color-rpc-navy);
	}
	.snomed-results {
		display: grid;
		gap: 0.4rem;
	}
	.snomed-result {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.2rem 0.6rem;
		width: 100%;
		padding: 0.55rem;
		border-color: var(--color-border-strong);
		background: #fff;
		color: var(--color-text);
		text-align: left;
	}
	.snomed-result strong,
	.snomed-result small {
		display: block;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.snomed-result small {
		color: var(--color-text-muted);
		font-size: 0.78rem;
	}
	.snomed-code {
		color: var(--color-text-muted);
		font-size: 0.82rem;
		font-weight: 800;
	}
	.advanced-group {
		margin-top: 1rem;
		padding-top: 0.8rem;
		border-top: 1px solid var(--color-border);
	}
	.advanced-group summary {
		cursor: pointer;
		font-weight: 800;
		color: var(--color-rpc-navy);
	}
	pre {
		margin-top: 0.65rem;
		max-height: 16rem;
		overflow: auto;
		background: var(--color-surface-muted, #f6f7f9);
		padding: 0.65rem;
		border: 1px solid var(--color-border-strong);
		border-radius: 0.45rem;
		font-size: 0.8rem;
	}
	@media (max-width: 720px) {
		.property-grid.compact {
			grid-template-columns: 1fr;
		}
		.option-row {
			grid-template-columns: 1fr;
		}
		.snomed-search-row {
			grid-template-columns: 1fr;
		}
	}
</style>
