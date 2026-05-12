import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeFiles = {
	list: 'src/routes/api/v1/openehr/aql/queries/+server.ts',
	execute: 'src/routes/api/v1/openehr/aql/queries/execute/+server.ts'
} as const;

function readRoute(name: keyof typeof routeFiles) {
	return readFileSync(routeFiles[name], 'utf8');
}

describe('openEHR AQL route contracts', () => {
	it('keeps curated AQL routes behind the AQL query privilege', () => {
		for (const name of Object.keys(routeFiles) as Array<keyof typeof routeFiles>) {
			expect(readRoute(name), `${name} route`).toContain("privilege: 'emr.aql.query'");
		}
	});

	it('lists only curated query definitions with read rate limits', () => {
		const list = readRoute('list');

		expect(list).toContain('rateLimit: rateLimitPolicies.read');
		expect(list).toContain('listQueries');
	});

	it('executes curated queries through schema validation, resource binding, and audit logs', () => {
		const execute = readRoute('execute');

		expect(execute).toContain('schema: openEhrAqlExecuteSchema');
		expect(execute).toContain("resource: (body) => ({ type: 'openehr_aql_query'");
		expect(execute).toContain('rateLimit: rateLimitPolicies.read');
		expect(execute).toContain('writeAudit');
		expect(execute).toContain("reason: 'execute_curated_aql_query'");
		expect(execute).toContain('openEhrQueryService.execute');
	});
});
