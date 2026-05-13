import { env } from '$env/dynamic/private';
import { createHash } from 'node:crypto';
import { AppError } from '$lib/server/observability/errors';
import type {
	EhrbaseAqlRequest,
	EhrbaseAqlResult,
	EhrbaseCreateEhrRequest,
	EhrbaseCreateEhrResult,
	EhrbaseSubmitCompositionResult,
	EhrbaseSubmitFlatCompositionRequest,
	EhrbaseTemplateMetadata,
	EhrbaseUploadTemplateResult,
	EhrbaseWebTemplate
} from './ehrbase.types';

type FetchLike = typeof fetch;

function trimTrailingSlash(value: string) {
	return value.replace(/\/+$/, '');
}

function privateEnv(name: string) {
	return env[name] ?? process.env[name];
}

function configuredOpenEhrBaseUrl() {
	return trimTrailingSlash(
		privateEnv('EHRBASE_BASE_URL')?.trim() || 'http://localhost:8080/ehrbase/rest/openehr/v1'
	);
}

function ehrbaseAuthorizationHeader() {
	const user = privateEnv('EHRBASE_AUTH_USER')?.trim();
	const password = privateEnv('EHRBASE_AUTH_PASSWORD') ?? '';
	if (!user) return undefined;
	return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

function safeResponseDetail(status: number, body: string) {
	const trimmed = body.trim();
	return trimmed
		? {
				status,
				responseBodyHash: createHash('sha256').update(trimmed).digest('hex')
			}
		: { status };
}

function extractEhrId(payload: unknown, location: string | null): string | undefined {
	if (payload && typeof payload === 'object') {
		const candidate = payload as Record<string, unknown>;
		const ehrId = candidate.ehr_id;
		if (ehrId && typeof ehrId === 'object' && 'value' in ehrId) {
			const value = (ehrId as { value?: unknown }).value;
			if (typeof value === 'string' && value.trim()) return value;
		}
		if (typeof candidate.ehrId === 'string' && candidate.ehrId.trim()) return candidate.ehrId;
	}

	if (!location) return undefined;
	const match = location.match(/\/ehr\/([^/?#]+)/);
	return match?.[1];
}

function extractCompositionUid(payload: unknown, etag: string | null, location: string | null) {
	if (payload && typeof payload === 'object') {
		const candidate = payload as Record<string, unknown>;
		if (typeof candidate.compositionUid === 'string' && candidate.compositionUid.trim()) {
			return candidate.compositionUid;
		}
		const uid = candidate.uid;
		if (uid && typeof uid === 'object' && 'value' in uid) {
			const value = (uid as { value?: unknown }).value;
			if (typeof value === 'string' && value.trim()) return value;
		}
	}

	const headerValue = etag?.replace(/^W\//, '').replaceAll('"', '').trim();
	if (headerValue) return headerValue;

	if (!location) return undefined;
	return location.split('/').filter(Boolean).at(-1);
}

function extractTemplateId(payload: unknown, etag: string | null, location: string | null) {
	if (payload && typeof payload === 'object') {
		const candidate = payload as Record<string, unknown>;
		if (typeof candidate.template_id === 'string' && candidate.template_id.trim()) {
			return candidate.template_id;
		}
		if (typeof candidate.templateId === 'string' && candidate.templateId.trim()) {
			return candidate.templateId;
		}
	}

	const headerValue = etag?.replace(/^W\//, '').replaceAll('"', '').trim();
	if (headerValue) return headerValue;

	if (!location) return undefined;
	return decodeURIComponent(location.split('/').filter(Boolean).at(-1) ?? '').trim() || undefined;
}

function parseJsonBody(text: string) {
	return text ? JSON.parse(text) : undefined;
}

export class EhrbaseClient {
	constructor(private readonly fetcher: FetchLike = fetch) {}

	async listTemplates(): Promise<EhrbaseTemplateMetadata[]> {
		const response = await this.safeFetch(
			`${configuredOpenEhrBaseUrl()}/definition/template/adl1.4`,
			{
				method: 'GET',
				headers: {
					accept: 'application/json',
					...this.authHeader()
				}
			}
		);

		const text = await response.text();
		if (!response.ok) {
			throw new AppError(
				'EHRBASE_TEMPLATE_LIST_FAILED',
				'Clinical data repository could not list templates.',
				502,
				safeResponseDetail(response.status, text)
			);
		}

		const payload = parseJsonBody(text);
		return Array.isArray(payload) ? (payload as EhrbaseTemplateMetadata[]) : [];
	}

	async uploadOperationalTemplate(templateXml: string): Promise<EhrbaseUploadTemplateResult> {
		const response = await this.safeFetch(
			`${configuredOpenEhrBaseUrl()}/definition/template/adl1.4`,
			{
				method: 'POST',
				headers: {
					'content-type': 'application/xml',
					accept: 'application/json',
					prefer: 'return=representation',
					...this.authHeader()
				},
				body: templateXml
			}
		);

		const text = await response.text();
		if (!response.ok) {
			throw new AppError(
				'EHRBASE_TEMPLATE_UPLOAD_FAILED',
				'Clinical data repository rejected the template.',
				502,
				safeResponseDetail(response.status, text)
			);
		}

		const payload = parseJsonBody(text);
		const templateId = extractTemplateId(
			payload,
			response.headers.get('etag'),
			response.headers.get('location')
		);
		if (!templateId) {
			throw new AppError(
				'EHRBASE_TEMPLATE_UPLOAD_FAILED',
				'Clinical data repository did not return a template identifier.',
				502,
				{ status: response.status }
			);
		}

		return { templateId };
	}

	async getWebTemplate(templateId: string): Promise<EhrbaseWebTemplate> {
		const response = await this.safeFetch(
			`${configuredOpenEhrBaseUrl()}/definition/template/adl1.4/${encodeURIComponent(
				templateId
			)}/webtemplate`,
			{
				method: 'GET',
				headers: {
					accept: 'application/json',
					...this.authHeader()
				}
			}
		);

		const text = await response.text();
		if (!response.ok) {
			throw new AppError(
				'EHRBASE_WEB_TEMPLATE_FETCH_FAILED',
				'Clinical data repository could not return the Web Template.',
				502,
				safeResponseDetail(response.status, text)
			);
		}

		const payload = parseJsonBody(text);
		if (!payload || typeof payload !== 'object') {
			throw new AppError(
				'EHRBASE_WEB_TEMPLATE_FETCH_FAILED',
				'Clinical data repository returned an invalid Web Template response.',
				502,
				{ status: response.status }
			);
		}

		return payload as EhrbaseWebTemplate;
	}

	async createEhr(request: EhrbaseCreateEhrRequest): Promise<EhrbaseCreateEhrResult> {
		const response = await this.safeFetch(`${configuredOpenEhrBaseUrl()}/ehr`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json',
				...this.authHeader()
			},
			body: JSON.stringify({
				_type: 'EHR_STATUS',
				archetype_node_id: 'openEHR-EHR-EHR_STATUS.generic.v1',
				name: { value: 'EHR status' },
				subject: {
					_type: 'PARTY_SELF',
					external_ref: {
						id: {
							_type: 'GENERIC_ID',
							value: request.subjectId,
							scheme: request.subjectNamespace
						},
						namespace: request.subjectNamespace,
						type: request.subjectType ?? 'PERSON'
					}
				},
				is_queryable: true,
				is_modifiable: true
			})
		});

		const text = await response.text();
		if (!response.ok) {
			throw new AppError(
				'EHRBASE_CREATE_EHR_FAILED',
				'Clinical data repository could not create an EHR.',
				502,
				safeResponseDetail(response.status, text)
			);
		}

		const payload = text ? JSON.parse(text) : undefined;
		const ehrId = extractEhrId(payload, response.headers.get('location'));
		if (!ehrId) {
			throw new AppError(
				'EHRBASE_CREATE_EHR_FAILED',
				'Clinical data repository did not return an EHR identifier.',
				502,
				{ status: response.status }
			);
		}

		return { ehrId };
	}

	async submitFlatComposition(
		request: EhrbaseSubmitFlatCompositionRequest
	): Promise<EhrbaseSubmitCompositionResult> {
		const url = new URL(
			`${configuredOpenEhrBaseUrl()}/ehr/${encodeURIComponent(request.ehrId)}/composition`
		);
		url.searchParams.set('templateId', request.templateId);
		url.searchParams.set('format', 'FLAT');

		const response = await this.safeFetch(url, {
			method: 'POST',
			headers: {
				'content-type': 'application/openehr.wt.flat.schema+json',
				accept: 'application/json',
				prefer: 'return=representation',
				...this.authHeader()
			},
			body: JSON.stringify(request.payload)
		});

		const text = await response.text();
		if (!response.ok) {
			throw new AppError(
				'EHRBASE_COMPOSITION_REJECTED',
				'Clinical data repository rejected the Composition.',
				502,
				safeResponseDetail(response.status, text)
			);
		}

		const payload = text ? JSON.parse(text) : undefined;
		const compositionUid = extractCompositionUid(
			payload,
			response.headers.get('etag'),
			response.headers.get('location')
		);
		if (!compositionUid) {
			throw new AppError(
				'EHRBASE_COMPOSITION_REJECTED',
				'Clinical data repository did not return a Composition identifier.',
				502,
				{ status: response.status }
			);
		}

		return {
			ehrId: request.ehrId,
			compositionUid,
			templateId: request.templateId,
			format: 'FLAT'
		};
	}

	async executeAql(request: EhrbaseAqlRequest): Promise<EhrbaseAqlResult> {
		const response = await this.safeFetch(`${configuredOpenEhrBaseUrl()}/query/aql`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				accept: 'application/json',
				...this.authHeader()
			},
			body: JSON.stringify(request)
		});

		const text = await response.text();
		if (!response.ok) {
			throw new AppError(
				'EHRBASE_AQL_QUERY_FAILED',
				'Clinical data repository rejected the AQL query.',
				502,
				safeResponseDetail(response.status, text)
			);
		}

		const payload = parseJsonBody(text);
		if (
			!payload ||
			typeof payload !== 'object' ||
			!Array.isArray((payload as { rows?: unknown }).rows)
		) {
			throw new AppError(
				'EHRBASE_AQL_QUERY_FAILED',
				'Clinical data repository returned an invalid AQL response.',
				502,
				{ status: response.status }
			);
		}

		return payload as EhrbaseAqlResult;
	}

	private authHeader(): Record<string, string> {
		const authorization = ehrbaseAuthorizationHeader();
		return authorization ? { authorization } : {};
	}

	private async safeFetch(input: string | URL, init: RequestInit) {
		try {
			return await this.fetcher(input, init);
		} catch {
			throw new AppError('EHRBASE_UNAVAILABLE', 'Clinical data repository is unavailable.', 502);
		}
	}
}

export const ehrbaseClient = new EhrbaseClient();
