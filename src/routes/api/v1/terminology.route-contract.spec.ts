import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeFiles = {
	search: 'src/routes/api/v1/terminology/search/+server.ts',
	lookup: 'src/routes/api/v1/terminology/lookup/+server.ts',
	health: 'src/routes/api/v1/terminology/health/+server.ts'
} as const;

function readRoute(name: keyof typeof routeFiles) {
	return readFileSync(routeFiles[name], 'utf8');
}

describe('terminology route contracts', () => {
	it('keeps terminology routes behind the terminology view privilege', () => {
		for (const name of Object.keys(routeFiles) as Array<keyof typeof routeFiles>) {
			expect(readRoute(name), `${name} route`).toContain("privilege: 'terminology.view'");
		}
	});

	it('uses read rate limits for terminology reads', () => {
		for (const name of Object.keys(routeFiles) as Array<keyof typeof routeFiles>) {
			expect(readRoute(name), `${name} route`).toContain('rateLimit: rateLimitPolicies.read');
		}
	});

	it('validates search and lookup query parameters explicitly', () => {
		const search = readRoute('search');
		const lookup = readRoute('lookup');

		expect(search).toContain('terminologySearchQuerySchema.safeParse');
		expect(search).toContain('validationFailed');
		expect(lookup).toContain('terminologyLookupQuerySchema.safeParse');
		expect(lookup).toContain('validationFailed');
	});
});
