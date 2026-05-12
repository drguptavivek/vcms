import { AppError, validationFailed } from '$lib/server/observability/errors';
import { ehrbaseClient, type EhrbaseClient } from './ehrbase.client';
import type {
	OpenEhrAqlExecuteInput,
	OpenEhrAqlExecuteResult,
	OpenEhrAqlParameterDefinition,
	OpenEhrAqlQueryDefinition,
	OpenEhrAqlQuerySummary
} from './open-ehr-query.types';

const ehrIdPattern =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const templateIdPattern = /^[A-Za-z0-9][A-Za-z0-9 .:_-]{0,299}$/;
const compositionUidPattern = /^[A-Za-z0-9][A-Za-z0-9 .:_-]{0,499}$/;

const curatedQueries: OpenEhrAqlQueryDefinition[] = [
	{
		id: 'composition.list_by_ehr',
		title: 'List Compositions By EHR',
		description: 'Lists Composition identifiers and context metadata for one EHR.',
		purpose: 'clinical_record_navigation',
		parameters: {
			ehrId: {
				type: 'ehr_id',
				required: true,
				description: 'openEHR EHR identifier.'
			}
		},
		defaultFetch: 50,
		maxFetch: 100,
		aql: [
			'SELECT',
			'  c/uid/value AS composition_uid,',
			'  c/name/value AS composition_name,',
			'  c/archetype_details/template_id/value AS template_id,',
			'  c/context/start_time/value AS start_time',
			'FROM EHR e',
			'CONTAINS COMPOSITION c',
			'WHERE e/ehr_id/value = $ehrId',
			'ORDER BY c/context/start_time/value DESC'
		].join('\n')
	},
	{
		id: 'composition.list_by_template',
		title: 'List Compositions By Template',
		description: 'Lists Composition identifiers for one EHR and one template ID.',
		purpose: 'template_scoped_record_navigation',
		parameters: {
			ehrId: {
				type: 'ehr_id',
				required: true,
				description: 'openEHR EHR identifier.'
			},
			templateId: {
				type: 'template_id',
				required: true,
				description: 'Operational Template identifier.'
			}
		},
		defaultFetch: 50,
		maxFetch: 100,
		aql: [
			'SELECT',
			'  c/uid/value AS composition_uid,',
			'  c/name/value AS composition_name,',
			'  c/context/start_time/value AS start_time',
			'FROM EHR e',
			'CONTAINS COMPOSITION c',
			'WHERE e/ehr_id/value = $ehrId',
			'  AND c/archetype_details/template_id/value = $templateId',
			'ORDER BY c/context/start_time/value DESC'
		].join('\n')
	},
	{
		id: 'composition.get_by_uid',
		title: 'Get Composition By UID',
		description: 'Returns the Composition object for one exact Composition UID.',
		purpose: 'composition_detail_lookup',
		parameters: {
			ehrId: {
				type: 'ehr_id',
				required: true,
				description: 'openEHR EHR identifier.'
			},
			compositionUid: {
				type: 'composition_uid',
				required: true,
				description: 'Versioned Composition UID returned by EHRbase.'
			}
		},
		defaultFetch: 1,
		maxFetch: 1,
		aql: [
			'SELECT c',
			'FROM EHR e',
			'CONTAINS COMPOSITION c',
			'WHERE e/ehr_id/value = $ehrId',
			'  AND c/uid/value = $compositionUid'
		].join('\n')
	}
];

function summarizeQuery(query: OpenEhrAqlQueryDefinition): OpenEhrAqlQuerySummary {
	const { aql: _aql, ...summary } = query;
	return summary;
}

function normalizeStringParameter(name: string, value: unknown) {
	if (typeof value !== 'string') {
		throw validationFailed({ fieldErrors: { [name]: ['Expected a string value.'] } });
	}
	const trimmed = value.trim();
	if (!trimmed) {
		throw validationFailed({ fieldErrors: { [name]: ['Expected a non-empty value.'] } });
	}
	return trimmed;
}

function validateParameter(
	name: string,
	definition: OpenEhrAqlParameterDefinition,
	value: unknown
) {
	const normalized = normalizeStringParameter(name, value);

	if (definition.type === 'ehr_id' && !ehrIdPattern.test(normalized)) {
		throw validationFailed({ fieldErrors: { [name]: ['Expected an openEHR EHR UUID.'] } });
	}

	if (definition.type === 'template_id' && !templateIdPattern.test(normalized)) {
		throw validationFailed({ fieldErrors: { [name]: ['Expected a valid template identifier.'] } });
	}

	if (definition.type === 'composition_uid' && !compositionUidPattern.test(normalized)) {
		throw validationFailed({ fieldErrors: { [name]: ['Expected a valid Composition UID.'] } });
	}

	return normalized;
}

export class OpenEhrQueryService {
	constructor(private readonly client: EhrbaseClient = ehrbaseClient) {}

	listQueries(): OpenEhrAqlQuerySummary[] {
		return curatedQueries.map(summarizeQuery);
	}

	getQuery(queryId: string): OpenEhrAqlQueryDefinition {
		const query = curatedQueries.find((candidate) => candidate.id === queryId.trim());
		if (!query) {
			throw new AppError('OPENEHR_AQL_QUERY_NOT_FOUND', 'AQL query is not registered.', 404, {
				queryId
			});
		}
		return query;
	}

	async execute(input: OpenEhrAqlExecuteInput): Promise<OpenEhrAqlExecuteResult> {
		const query = this.getQuery(input.queryId);
		const suppliedParameters = input.parameters ?? {};
		const queryParameters: Record<string, string> = {};

		for (const [name, definition] of Object.entries(query.parameters)) {
			const value = suppliedParameters[name];
			if (value === undefined || value === null) {
				if (definition.required) {
					throw validationFailed({ fieldErrors: { [name]: ['Required.'] } });
				}
				continue;
			}
			queryParameters[name] = validateParameter(name, definition, value);
		}

		const allowedParameterNames = new Set(Object.keys(query.parameters));
		const unknownParameterNames = Object.keys(suppliedParameters).filter(
			(name) => !allowedParameterNames.has(name)
		);
		if (unknownParameterNames.length) {
			throw validationFailed({
				fieldErrors: Object.fromEntries(
					unknownParameterNames.map((name) => [name, ['Unknown query parameter.']])
				)
			});
		}

		const offset = input.offset ?? 0;
		const fetch = Math.min(input.fetch ?? query.defaultFetch, query.maxFetch);
		const result = await this.client.executeAql({
			q: query.aql,
			query_parameters: queryParameters,
			offset,
			fetch
		});

		return {
			query: summarizeQuery(query),
			offset,
			fetch,
			result
		};
	}
}

export const openEhrQueryService = new OpenEhrQueryService();
