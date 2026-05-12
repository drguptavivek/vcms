export type EhrbaseCreateEhrRequest = {
	subjectId: string;
	subjectNamespace: string;
	subjectType?: string;
};

export type EhrbaseCreateEhrResult = {
	ehrId: string;
};

export type EhrbaseSubmitFlatCompositionRequest = {
	ehrId: string;
	templateId: string;
	committerName: string;
	committerId: string;
	payload: Record<string, unknown>;
};

export type EhrbaseSubmitCompositionResult = {
	ehrId: string;
	compositionUid: string;
	templateId: string;
	format: 'FLAT';
};

export type EhrbaseTemplateMetadata = {
	concept?: string;
	template_id: string;
	archetype_id?: string;
	created_timestamp?: string;
};

export type EhrbaseUploadTemplateResult = {
	templateId: string;
};

export type EhrbaseWebTemplate = {
	templateId: string;
	version?: string;
	defaultLanguage?: string;
	languages?: string[];
	tree: EhrbaseWebTemplateNode;
};

export type EhrbaseWebTemplateInput = {
	suffix?: string;
	type?: string;
	list?: Array<{
		value?: string;
		label?: string;
		ordinal?: number;
		termBindings?: Record<string, { value?: string; terminologyId?: string }>;
	}>;
	listOpen?: boolean;
	terminology?: string;
	defaultValue?: string;
	validation?: unknown;
};

export type EhrbaseWebTemplateNode = {
	id: string;
	name?: string;
	localizedName?: string;
	rmType?: string;
	nodeId?: string;
	min?: number;
	max?: number;
	aqlPath?: string;
	inContext?: boolean;
	inputs?: EhrbaseWebTemplateInput[];
	children?: EhrbaseWebTemplateNode[];
	termBindings?: Record<string, { value?: string; terminologyId?: string }>;
	localizedNames?: Record<string, string>;
	localizedDescriptions?: Record<string, string>;
};

export type EhrbaseAqlRequest = {
	q: string;
	query_parameters?: Record<string, unknown>;
	offset?: number;
	fetch?: number;
};

export type EhrbaseAqlResult = {
	meta?: unknown;
	q?: string;
	name?: string;
	columns?: Array<Record<string, string>>;
	rows: unknown[][];
};

export type OpenEhrCompositionReference = {
	ehrId: string;
	compositionUid: string;
	templateId: string;
	format: 'FLAT';
};
