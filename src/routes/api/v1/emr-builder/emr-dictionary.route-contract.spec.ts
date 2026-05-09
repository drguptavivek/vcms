import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routeFiles = {
	dictionarySave: 'src/routes/api/v1/emr-builder/dictionary/+server.ts',
	dictionaryList: 'src/routes/api/v1/emr-builder/dictionary/list/+server.ts',
	dictionaryItem: 'src/routes/api/v1/emr-builder/dictionary/item/+server.ts',
	dictionaryPublish: 'src/routes/api/v1/emr-builder/dictionary/publish/+server.ts',
	dictionaryRetire: 'src/routes/api/v1/emr-builder/dictionary/retire/+server.ts',
	dictionaryVersions: 'src/routes/api/v1/emr-builder/dictionary/versions/+server.ts'
} as const;

function readRoute(name: keyof typeof routeFiles) {
	return readFileSync(routeFiles[name], 'utf8');
}

describe('EMR dictionary route contracts', () => {
	it('keeps dictionary routes behind dictionary manage privilege', () => {
		for (const name of Object.keys(routeFiles) as Array<keyof typeof routeFiles>) {
			expect(readRoute(name), `${name} route`).toContain("privilege: 'emr.dictionary.manage'");
		}
	});

	it('uses read rate limits and query validation for list and item reads', () => {
		const list = readRoute('dictionaryList');
		const item = readRoute('dictionaryItem');
		const versions = readRoute('dictionaryVersions');

		expect(list).toContain('rateLimit: rateLimitPolicies.read');
		expect(list).toContain('emrDictionaryListQuerySchema.safeParse');
		expect(list).toContain('validationFailed');

		expect(item).toContain('rateLimit: rateLimitPolicies.read');
		expect(item).toContain('emrDictionaryAssetIdentitySchema.safeParse');
		expect(item).toContain('validationFailed');

		expect(versions).toContain('rateLimit: rateLimitPolicies.read');
		expect(versions).toContain('emrDictionaryAssetIdentitySchema.safeParse');
		expect(versions).toContain('validationFailed');
	});

	it('uses mutation schemas, mutation limits, resource binding, and audit logs for dictionary writes', () => {
		const save = readRoute('dictionarySave');
		const publish = readRoute('dictionaryPublish');
		const retire = readRoute('dictionaryRetire');

		expect(save).toContain('schema: emrDictionarySaveDraftSchema');
		expect(save).toContain('resource: (body) => ({');
		expect(save).toContain('rateLimit: rateLimitPolicies.mutation');
		expect(save).toContain('writeAudit');
		expect(save).toContain("reason: 'save_draft'");

		expect(publish).toContain('schema: emrDictionaryPublishDraftSchema');
		expect(publish).toContain('resource: (body) => ({');
		expect(publish).toContain('rateLimit: rateLimitPolicies.mutation');
		expect(publish).toContain('writeAudit');
		expect(publish).toContain("reason: body.reason ?? 'publish_draft'");

		expect(retire).toContain('schema: emrDictionaryRetireSchema');
		expect(retire).toContain('resource: (body) => ({');
		expect(retire).toContain('rateLimit: rateLimitPolicies.mutation');
		expect(retire).toContain('writeAudit');
		expect(retire).toContain("reason: body.reason ?? 'retire'");
	});
});
