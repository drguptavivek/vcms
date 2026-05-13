import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EhrbaseClient } from './ehrbase.client';

function response(body: unknown, init: ResponseInit = {}) {
	return new Response(body === undefined ? undefined : JSON.stringify(body), {
		status: init.status ?? 200,
		headers: {
			'content-type': 'application/json',
			...(init.headers ?? {})
		}
	});
}

describe('EhrbaseClient', () => {
	beforeEach(() => {
		vi.stubEnv('EHRBASE_BASE_URL', 'http://ehrbase.test/ehrbase/rest/openehr/v1');
		vi.stubEnv('EHRBASE_AUTH_USER', 'ehrbase-user');
		vi.stubEnv('EHRBASE_AUTH_PASSWORD', 'secret');
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it('creates an openEHR EHR_STATUS with a local subject external reference', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			response({
				ehr_id: { value: 'ehr-1' }
			})
		);
		const client = new EhrbaseClient(fetcher as never);

		await expect(
			client.createEhr({ subjectId: 'patient-1', subjectNamespace: 'vcms-patient' })
		).resolves.toEqual({ ehrId: 'ehr-1' });

		expect(fetcher).toHaveBeenCalledWith(
			'http://ehrbase.test/ehrbase/rest/openehr/v1/ehr',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					authorization: expect.stringMatching(/^Basic /),
					'content-type': 'application/json'
				}),
				body: expect.stringContaining('"openEHR-EHR-EHR_STATUS.generic.v1"')
			})
		);
	});

	it('lists uploaded ADL 1.4 templates', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			response([
				{
					concept: 'Medication list',
					template_id: 'IDCR Medication List.v0',
					archetype_id: 'openEHR-EHR-COMPOSITION.care_summary.v0'
				}
			])
		);
		const client = new EhrbaseClient(fetcher as never);

		await expect(client.listTemplates()).resolves.toEqual([
			expect.objectContaining({ template_id: 'IDCR Medication List.v0' })
		]);

		expect(fetcher).toHaveBeenCalledWith(
			'http://ehrbase.test/ehrbase/rest/openehr/v1/definition/template/adl1.4',
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({ accept: 'application/json' })
			})
		);
	});

	it('uploads an ADL 1.4 operational template', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(response(undefined, { status: 201, headers: { etag: '"template-1"' } }));
		const client = new EhrbaseClient(fetcher as never);

		await expect(client.uploadOperationalTemplate('<template />')).resolves.toEqual({
			templateId: 'template-1'
		});

		expect(fetcher).toHaveBeenCalledWith(
			'http://ehrbase.test/ehrbase/rest/openehr/v1/definition/template/adl1.4',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'content-type': 'application/xml',
					prefer: 'return=representation'
				}),
				body: '<template />'
			})
		);
	});

	it('fetches a Web Template for runtime FLAT paths', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			response({
				templateId: 'IDCR Medication List.v0',
				tree: { id: 'current_medication_list', rmType: 'COMPOSITION' }
			})
		);
		const client = new EhrbaseClient(fetcher as never);

		await expect(client.getWebTemplate('IDCR Medication List.v0')).resolves.toMatchObject({
			templateId: 'IDCR Medication List.v0',
			tree: { id: 'current_medication_list' }
		});

		const [url, options] = fetcher.mock.calls[0];
		expect(String(url)).toContain(
			'/definition/template/adl1.4/IDCR%20Medication%20List.v0/webtemplate'
		);
		expect(options).toEqual(
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({ accept: 'application/json' })
			})
		);
	});

	it('submits a FLAT composition through the official openEHR endpoint', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				response(
					{ compositionUid: 'composition-1::vcms.local.ehrbase::1' },
					{ headers: { etag: '"composition-1::vcms.local.ehrbase::1"' } }
				)
			);
		const client = new EhrbaseClient(fetcher as never);

		await expect(
			client.submitFlatComposition({
				ehrId: 'ehr-1',
				templateId: 'vcms-pec-opd.v1',
				committerName: 'Doctor',
				committerId: 'user-1',
				payload: { 'pec_opd/chief_complaint': 'Blurred vision' }
			})
		).resolves.toEqual({
			ehrId: 'ehr-1',
			compositionUid: 'composition-1::vcms.local.ehrbase::1',
			templateId: 'vcms-pec-opd.v1',
			format: 'FLAT'
		});

		const [url, options] = fetcher.mock.calls[0];
		expect(String(url)).toContain('/ehrbase/rest/openehr/v1/ehr/ehr-1/composition?');
		expect(String(url)).toContain('templateId=vcms-pec-opd.v1');
		expect(String(url)).toContain('format=FLAT');
		expect(options).toEqual(
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({
					'content-type': 'application/openehr.wt.flat.schema+json',
					prefer: 'return=representation'
				}),
				body: JSON.stringify({ 'pec_opd/chief_complaint': 'Blurred vision' })
			})
		);
	});

	it('does not expose raw EHRbase response bodies when a Composition is rejected', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			response(
				{
					error: 'template path /secret/internal/path failed validation for patient 123'
				},
				{ status: 400 }
			)
		);
		const client = new EhrbaseClient(fetcher as never);

		await expect(
			client.submitFlatComposition({
				ehrId: 'ehr-1',
				templateId: 'vcms-pec-opd.v1',
				committerName: 'Doctor',
				committerId: 'user-1',
				payload: { 'pec_opd/chief_complaint': 'Blurred vision' }
			})
		).rejects.toMatchObject({
			code: 'EHRBASE_COMPOSITION_REJECTED',
			status: 502,
			message: 'Clinical data repository rejected the Composition.',
			details: {
				status: 400,
				responseBodyHash: expect.stringMatching(/^[a-f0-9]{64}$/)
			}
		});
	});

	it('executes AQL queries through the openEHR query endpoint', async () => {
		const fetcher = vi.fn().mockResolvedValue(
			response({
				q: 'SELECT c/uid/value FROM EHR e CONTAINS COMPOSITION c',
				columns: [{ name: '#0', path: 'c/uid/value' }],
				rows: [['composition-1::vcms.local.ehrbase::1']]
			})
		);
		const client = new EhrbaseClient(fetcher as never);

		await expect(
			client.executeAql({
				q: 'SELECT c/uid/value FROM EHR e CONTAINS COMPOSITION c'
			})
		).resolves.toMatchObject({
			rows: [['composition-1::vcms.local.ehrbase::1']]
		});

		expect(fetcher).toHaveBeenCalledWith(
			'http://ehrbase.test/ehrbase/rest/openehr/v1/query/aql',
			expect.objectContaining({
				method: 'POST',
				headers: expect.objectContaining({ 'content-type': 'application/json' }),
				body: JSON.stringify({
					q: 'SELECT c/uid/value FROM EHR e CONTAINS COMPOSITION c'
				})
			})
		);
	});

	it('maps network failures to a safe application error', async () => {
		const client = new EhrbaseClient(vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as never);

		await expect(
			client.createEhr({ subjectId: 'patient-1', subjectNamespace: 'vcms-patient' })
		).rejects.toMatchObject({
			code: 'EHRBASE_UNAVAILABLE',
			status: 502,
			message: 'Clinical data repository is unavailable.'
		});
	});
});
