import { describe, expect, it } from 'vitest';
import { getPrivilege } from './privilege-registry';

describe('privilege registry', () => {
	it('loads barcode manager privileges from TOML', () => {
		expect(getPrivilege('barcode.batch.print')).toMatchObject({
			resource: 'pec',
			relationship: 'allocated_pec'
		});
	});

	it('keeps sequence reset auditable', () => {
		expect(getPrivilege('barcode.sequence.reset')?.audit).toBe(true);
	});
});
