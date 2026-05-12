import { describe, expect, it } from 'vitest';
import { terminologyLookupQuerySchema, terminologySearchQuerySchema } from './terminology.schemas';

describe('terminology schemas', () => {
	it('parses safe SNOMED CT search queries', () => {
		expect(
			terminologySearchQuerySchema.parse({
				q: 'cataract',
				limit: '8',
				active: 'true',
				semanticTag: 'disorder'
			})
		).toEqual({
			q: 'cataract',
			limit: 8,
			active: true,
			semanticTag: 'disorder'
		});
	});

	it('rejects one-character searches and invalid booleans', () => {
		expect(() => terminologySearchQuerySchema.parse({ q: 'c' })).toThrow();
		expect(() => terminologySearchQuerySchema.parse({ q: 'cataract', active: 'yes' })).toThrow();
	});

	it('requires numeric concept identifiers for lookup', () => {
		expect(terminologyLookupQuerySchema.parse({ conceptId: '193570009' })).toEqual({
			conceptId: '193570009'
		});
		expect(() => terminologyLookupQuerySchema.parse({ conceptId: 'SNOMED-193570009' })).toThrow();
	});
});
