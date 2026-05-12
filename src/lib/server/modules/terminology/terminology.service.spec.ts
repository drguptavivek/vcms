import { describe, expect, it } from 'vitest';
import { terminologyService } from './terminology.service';

describe('terminology service', () => {
	it('searches the configured SNOMED CT provider through the service boundary', async () => {
		const result = await terminologyService.searchSnomedConcepts({
			q: 'cataract',
			limit: 5
		});

		expect(result.provider).toBe('mock');
		expect(result.results).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					terminologySystem: 'SNOMED_CT',
					conceptId: '193570009',
					preferredTerm: 'Cataract'
				})
			])
		);
	});

	it('looks up a SNOMED CT concept by numeric identifier', async () => {
		await expect(
			terminologyService.lookupSnomedConcept({ conceptId: '23986001' })
		).resolves.toMatchObject({
			concept: {
				conceptId: '23986001',
				preferredTerm: 'Glaucoma'
			}
		});
	});

	it('reports provider health without exposing provider internals', async () => {
		await expect(terminologyService.health()).resolves.toMatchObject({
			provider: 'mock',
			available: true
		});
	});
});
