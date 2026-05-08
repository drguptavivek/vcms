import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeFiles = {
	draft: 'src/routes/api/v1/emr-builder/draft/+server.ts',
	publish: 'src/routes/api/v1/emr-builder/publish/+server.ts',
	definition: 'src/routes/api/v1/emr-builder/definition/+server.ts',
	versions: 'src/routes/api/v1/emr-builder/versions/+server.ts'
} as const;

function readRoute(name: keyof typeof routeFiles) {
	return readFileSync(routeFiles[name], 'utf8');
}

describe('EMR builder route contracts', () => {
	it('keeps all builder routes behind the builder manage privilege', () => {
		for (const name of Object.keys(routeFiles) as Array<keyof typeof routeFiles>) {
			expect(readRoute(name), `${name} route`).toContain("privilege: 'emr.builder.manage'");
		}
	});

	it('uses read rate limits and query validation for read routes', () => {
		for (const name of ['draft', 'definition', 'versions'] as const) {
			const route = readRoute(name);

			expect(route).toContain('rateLimit: rateLimitPolicies.read');
			expect(route).toContain('emrBuilderDefinitionQuerySchema.safeParse');
			expect(route).toContain('validationFailed');
		}
	});

	it('uses mutation schemas, mutation rate limits, resource binding, and audit logs for mutations', () => {
		const draft = readRoute('draft');
		const publish = readRoute('publish');

		expect(draft).toContain('schema: emrBuilderSaveDraftSchema');
		expect(draft).toContain('resource: (body) => ({ type:');
		expect(draft).toContain('rateLimit: rateLimitPolicies.mutation');
		expect(draft).toContain('writeAudit');
		expect(draft).toContain("reason: 'save_draft'");

		expect(publish).toContain('schema: emrBuilderPublishDraftSchema');
		expect(publish).toContain('resource: (body) => ({ type:');
		expect(publish).toContain('rateLimit: rateLimitPolicies.mutation');
		expect(publish).toContain('writeAudit');
		expect(publish).toContain("reason: body.reason ?? 'publish_draft'");
	});
});
