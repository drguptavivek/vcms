import type { EhrbaseAqlResult } from './ehrbase.types';

export type OpenEhrAqlParameterType = 'ehr_id' | 'template_id' | 'composition_uid' | 'string';

export type OpenEhrAqlParameterDefinition = {
	type: OpenEhrAqlParameterType;
	required: boolean;
	description: string;
};

export type OpenEhrAqlQueryDefinition = {
	id: string;
	title: string;
	description: string;
	purpose: string;
	parameters: Record<string, OpenEhrAqlParameterDefinition>;
	defaultFetch: number;
	maxFetch: number;
	aql: string;
};

export type OpenEhrAqlQuerySummary = Omit<OpenEhrAqlQueryDefinition, 'aql'>;

export type OpenEhrAqlExecuteInput = {
	queryId: string;
	parameters?: Record<string, unknown>;
	offset?: number;
	fetch?: number;
};

export type OpenEhrAqlExecuteResult = {
	query: OpenEhrAqlQuerySummary;
	offset: number;
	fetch: number;
	result: EhrbaseAqlResult;
};
