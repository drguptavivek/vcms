import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

try {
	process.loadEnvFile?.();
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const templateId = 'IDCR Medication List.v0';
const templatePath = join(process.cwd(), 'fixtures/openehr/templates/idcr-medication-list.v0.opt');
const payloadPath = join(process.cwd(), 'fixtures/openehr/payloads/idcr-medication-list.flat.json');

function trimTrailingSlash(value: string) {
	return value.replace(/\/+$/, '');
}

function ehrbaseBaseUrl() {
	return trimTrailingSlash(
		process.env.EHRBASE_BASE_URL || 'http://localhost:8080/ehrbase/rest/openehr/v1'
	);
}

function authHeader() {
	const user = process.env.EHRBASE_AUTH_USER || 'ehrbase-user';
	const password = process.env.EHRBASE_AUTH_PASSWORD || 'SuperSecretPassword';
	return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

function asJsonObject(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Expected a JSON object response.');
	}
	return value as Record<string, unknown>;
}

function extractEhrId(payload: unknown, location: string | null): string {
	const object = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
	const ehrId = object.ehr_id;
	if (ehrId && typeof ehrId === 'object' && 'value' in ehrId) {
		const value = (ehrId as { value?: unknown }).value;
		if (typeof value === 'string' && value) return value;
	}

	const match = location?.match(/\/ehr\/([^/?#]+)/);
	if (match?.[1]) return match[1];

	throw new Error('EHRbase did not return an ehr_id.');
}

function extractUid(payload: unknown, etag: string | null, location: string | null): string {
	const object = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
	const uid = object.uid;
	if (uid && typeof uid === 'object' && 'value' in uid) {
		const value = (uid as { value?: unknown }).value;
		if (typeof value === 'string' && value) return value;
	}

	const etagValue = etag?.replace(/^W\//, '').replaceAll('"', '').trim();
	if (etagValue) return etagValue;

	const locationValue = location?.split('/').filter(Boolean).at(-1);
	if (locationValue) return decodeURIComponent(locationValue);

	throw new Error('EHRbase did not return a Composition uid.');
}

async function request(path: string, init: RequestInit = {}) {
	const response = await fetch(`${ehrbaseBaseUrl()}${path}`, {
		...init,
		headers: {
			authorization: authHeader(),
			accept: 'application/json',
			...(init.headers ?? {})
		}
	});
	const text = await response.text();
	const payload = text ? JSON.parse(text) : undefined;

	if (!response.ok) {
		throw new Error(
			`EHRbase request failed: ${response.status} ${response.statusText} ${text.slice(0, 500)}`
		);
	}

	return { response, payload };
}

async function ensureTemplateUploaded() {
	const { payload } = await request('/definition/template/adl1.4');
	const templates = Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : [];
	if (templates.some((template) => template.template_id === templateId)) return;

	await request('/definition/template/adl1.4', {
		method: 'POST',
		headers: {
			'content-type': 'application/xml',
			prefer: 'return=representation'
		},
		body: await readFile(templatePath, 'utf8')
	});
}

async function createEhr() {
	const subjectId = `vcms-smoke-${Date.now()}`;
	const { response, payload } = await request('/ehr', {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			prefer: 'return=representation'
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
						value: subjectId,
						scheme: process.env.EHRBASE_SUBJECT_NAMESPACE || 'vcms-patient'
					},
					namespace: process.env.EHRBASE_SUBJECT_NAMESPACE || 'vcms-patient',
					type: 'PERSON'
				}
			},
			is_queryable: true,
			is_modifiable: true
		})
	});

	return {
		ehrId: extractEhrId(payload, response.headers.get('location')),
		subjectId
	};
}

async function submitComposition(ehrId: string) {
	const payload = asJsonObject(JSON.parse(await readFile(payloadPath, 'utf8')));
	const now = new Date().toISOString();

	payload['current_medication_list/context/start_time'] = now;
	payload['current_medication_list/context/_end_time'] = now;
	payload['current_medication_list/composer|name'] = 'Development Admin';

	const { response, payload: result } = await request(
		`/ehr/${encodeURIComponent(ehrId)}/composition?templateId=${encodeURIComponent(
			templateId
		)}&format=FLAT`,
		{
			method: 'POST',
			headers: {
				'content-type': 'application/openehr.wt.flat.schema+json',
				prefer: 'return=representation'
			},
			body: JSON.stringify(payload)
		}
	);

	return extractUid(result, response.headers.get('etag'), response.headers.get('location'));
}

async function queryComposition(ehrId: string) {
	const { payload } = await request('/query/aql', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			q: `SELECT c/uid/value FROM EHR e CONTAINS COMPOSITION c WHERE e/ehr_id/value='${ehrId}'`
		})
	});

	return asJsonObject(payload);
}

async function main() {
	await ensureTemplateUploaded();

	const { payload: webTemplate } = await request(
		`/definition/template/adl1.4/${encodeURIComponent(templateId)}/webtemplate`
	);
	const rootId = asJsonObject(asJsonObject(webTemplate).tree).id;
	if (rootId !== 'current_medication_list') {
		throw new Error(`Unexpected Web Template root id: ${String(rootId)}`);
	}

	const ehr = await createEhr();
	const compositionUid = await submitComposition(ehr.ehrId);
	const queryResult = await queryComposition(ehr.ehrId);

	console.log(
		JSON.stringify(
			{
				ok: true,
				templateId,
				webTemplateRoot: rootId,
				seededUser: 'dev-admin',
				ehr,
				compositionUid,
				queryRows: Array.isArray(queryResult.rows) ? queryResult.rows.length : 0
			},
			null,
			2
		)
	);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
