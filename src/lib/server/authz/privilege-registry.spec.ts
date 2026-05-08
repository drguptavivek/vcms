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

	it('loads user profile self-service privileges', () => {
		expect(getPrivilege('user.profile.update')).toMatchObject({
			resource: 'user',
			audit: true
		});
	});

	it('loads EMR builder management privilege', () => {
		expect(getPrivilege('emr.builder.manage')).toMatchObject({
			resource: 'system',
			audit: true,
			roles: expect.arrayContaining(['admin'])
		});
	});
});
