import type {
	EmrDefinitionAction,
	EmrField,
	EmrLayoutSection,
	EmrNoteDefinition,
	EmrRule
} from '../emr-builder/emr-builder.types';
import type { EmrExpression } from '../emr-builder/emr-builder.schemas';

export type EmrRenderContext = Record<string, unknown>;

export type EmrExpressionValue =
	| string
	| number
	| boolean
	| null
	| Array<string | number | boolean | null>;

export type EmrFieldRenderBinding<T> = {
	value: T;
	source?: EmrExpression;
};

export type EmrFieldConstraintBinding = {
	expression?: EmrExpression;
	passes: boolean;
	message?: string;
};

export type EmrRenderedField = Omit<EmrField, 'odkBind'> & {
	bind: {
		required: EmrFieldRenderBinding<boolean>;
		relevant: EmrFieldRenderBinding<boolean>;
		readOnly: EmrFieldRenderBinding<boolean>;
		constraint: EmrFieldConstraintBinding;
		calculation: EmrFieldRenderBinding<unknown>;
		defaultValue: EmrFieldRenderBinding<unknown>;
	};
	odkBind?: EmrField['odkBind'];
};

export type EmrRenderedSection = Omit<EmrLayoutSection, 'fields' | 'sections'> & {
	fields: EmrRenderedField[];
	sections: EmrRenderedSection[];
};

export type EmrRenderModel = {
	definitionId: string;
	slug: string;
	title: string;
	noteType: string;
	specialty?: string;
	version: number;
	locale: string;
	tags: string[];
	status: string;
	effectiveFrom: EmrNoteDefinition['metadata']['effectiveFrom'];
	effectiveUntil: EmrNoteDefinition['metadata']['effectiveUntil'];
	sections: EmrRenderedSection[];
	rules: EmrRule[];
	actions: EmrDefinitionAction[];
	analytics: EmrNoteDefinition['analytics'];
};

export type EmrDefinitionRenderInput = {
	definition: unknown;
	answers?: EmrRenderContext;
};

export type EmrPublishedRenderInput = {
	definitionId: string;
	answers?: EmrRenderContext;
};
