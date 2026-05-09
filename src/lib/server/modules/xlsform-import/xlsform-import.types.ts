import type { EmrNoteDefinition } from '$lib/server/modules/emr-builder/emr-builder.types';

export type XlsformIssueKind =
	| 'system-field'
	| 'unsupported-type'
	| 'unsupported-expression'
	| 'unsupported-filter'
	| 'unsupported-handoff'
	| 'missing-choice-list';

export type XlsformUnsupportedItem = {
	kind: XlsformIssueKind;
	code: string;
	field?: string;
	detail: string;
};

export type XlsformFieldRow = {
	type?: string;
	name?: string;
	label?: string;
	hint?: string;
	guidance_hint?: string;
	required?: string;
	required_message?: string;
	choice_filter?: string;
	repeat_count?: string;
	relevant?: string;
	constraint?: string;
	constraint_message?: string;
	calculation?: string;
	trigger?: string;
	parameters?: string;
	appearance?: string;
	default?: string;
	readonly?: string;
	read_only?: string;
	save_to?: string;
	not_a_choice?: string;
	image?: string;
	video?: string;
	audio?: string;
	[key: string]: string | undefined;
};

export type XlsformChoiceRow = {
	list_name?: string;
	name?: string;
	label?: string;
	provincefilter?: string;
};

export type XlsformEntityRow = {
	list_name?: string;
	label?: string;
	create_if?: string;
};

export type XlsformSettings = {
	form_title?: string;
	form_id?: string;
	version?: string;
	instance_name?: string;
	default_language?: string;
	style?: string;
};

export type XlsformFixture = {
	form: string;
	slug: string;
	survey: XlsformFieldRow[];
	choices: XlsformChoiceRow[];
	entities: XlsformEntityRow[];
	form_settings?: XlsformSettings;
};

export type XlsformImportResult = {
	definitionId: string;
	definition: EmrNoteDefinition;
	issues: XlsformUnsupportedItem[];
};
