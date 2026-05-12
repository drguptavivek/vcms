import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeFiles = {
	templates: 'src/routes/api/v1/openehr/templates/+server.ts',
	sync: 'src/routes/api/v1/openehr/templates/sync/+server.ts',
	manifest: 'src/routes/api/v1/openehr/templates/manifest/+server.ts'
} as const;

function readRoute(name: keyof typeof routeFiles) {
	return readFileSync(routeFiles[name], 'utf8');
}

describe('openEHR template route contracts', () => {
	it('keeps template registry routes behind the template management privilege', () => {
		for (const name of Object.keys(routeFiles) as Array<keyof typeof routeFiles>) {
			expect(readRoute(name), `${name} route`).toContain("privilege: 'emr.template.manage'");
		}
	});

	it('uses read limits and explicit query validation for read endpoints', () => {
		const templates = readRoute('templates');
		const manifest = readRoute('manifest');

		expect(templates).toContain('rateLimit: rateLimitPolicies.read');
		expect(templates).toContain('openEhrTemplateListQuerySchema.safeParse');
		expect(templates).toContain('validationFailed');
		expect(templates).toContain('listLocalTemplates');

		expect(manifest).toContain('rateLimit: rateLimitPolicies.read');
		expect(manifest).toContain('openEhrTemplateIdentitySchema.safeParse');
		expect(manifest).toContain('validationFailed');
		expect(manifest).toContain('getRuntimeManifest');
	});

	it('uses schemas, mutation limits, resource binding, and audit logs for mutations', () => {
		const templates = readRoute('templates');
		const sync = readRoute('sync');

		expect(templates).toContain('schema: openEhrTemplateUploadSchema');
		expect(templates).toContain("resource: () => ({ type: 'openehr_template', id: 'upload' })");
		expect(templates).toContain('rateLimit: rateLimitPolicies.mutation');
		expect(templates).toContain('writeAudit');
		expect(templates).toContain("reason: 'upload_adl14_template'");

		expect(sync).toContain('schema: openEhrTemplateIdentitySchema');
		expect(sync).toContain('resource: (body) => ({ type:');
		expect(sync).toContain('rateLimit: rateLimitPolicies.mutation');
		expect(sync).toContain('writeAudit');
		expect(sync).toContain("reason: 'sync_from_cdr'");
	});
});
