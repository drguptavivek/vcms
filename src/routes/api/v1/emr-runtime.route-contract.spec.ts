import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const runtimeRoutes = {
	patients: 'src/routes/api/v1/patients/+server.ts',
	encounters: 'src/routes/api/v1/encounters/+server.ts',
	carePathways: 'src/routes/api/v1/care-pathways/+server.ts',
	pecOpdNote: 'src/routes/api/v1/clinical-notes/pec-opd/+server.ts',
	mobileClinicalNotes: 'src/routes/api/v1/mobile/clinical-notes/+server.ts',
	mobileDefinitions: 'src/routes/api/v1/mobile/emr-definitions/+server.ts',
	mobileDefinitionModel: 'src/routes/api/v1/mobile/emr-definitions/[definitionId]/+server.ts'
} as const;

function readRoute(name: keyof typeof runtimeRoutes) {
	return readFileSync(runtimeRoutes[name], 'utf8');
}

describe('EMR runtime route contracts', () => {
	it('keeps read routes behind read privileges, read rate limits, and query/param validation', () => {
		const expectations = [
			{
				name: 'patients',
				privilege: "privilege: 'emr.patient.view'",
				validator: 'patientLookupSchema.safeParse'
			},
			{
				name: 'encounters',
				privilege: "privilege: 'emr.encounter.view'",
				validator: 'encounterListQuerySchema.safeParse'
			},
			{
				name: 'carePathways',
				privilege: "privilege: 'emr.care_pathway.view'",
				validator: 'carePathwayListQuerySchema.safeParse'
			},
			{
				name: 'mobileDefinitionModel',
				privilege: "privilege: 'emr.runtime.mobile_definition.view'",
				validator: 'emrBuilderDefinitionIdSchema.safeParse'
			}
		] as const;

		for (const { name, privilege, validator } of expectations) {
			const route = readRoute(name);

			expect(route).toContain(privilege);
			expect(route).toContain('rateLimit: rateLimitPolicies.read');
			expect(route).toContain(validator);
			expect(route).toContain('validationFailed');
		}

		const mobileDefinitions = readRoute('mobileDefinitions');
		expect(mobileDefinitions).toContain("privilege: 'emr.runtime.mobile_definition.view'");
		expect(mobileDefinitions).toContain('rateLimit: rateLimitPolicies.read');
	});

	it('keeps runtime mutations schema validated, rate limited, and audited through services', () => {
		const expectations = [
			{
				name: 'patients',
				schema: 'schema: patientCreateSchema',
				privilege: "privilege: 'emr.patient.create'",
				rateLimit: 'rateLimit: rateLimitPolicies.mutation',
				service: 'patientService.createForBarcodeWithAudit'
			},
			{
				name: 'encounters',
				schema: 'schema: encounterCreateSchema',
				privilege: "privilege: 'emr.encounter.create'",
				rateLimit: 'rateLimit: rateLimitPolicies.mutation',
				service: 'encounterService.createForRequest'
			},
			{
				name: 'carePathways',
				schema: 'schema: carePathwayCreateSchema',
				privilege: "privilege: 'emr.care_pathway.create'",
				rateLimit: 'rateLimit: rateLimitPolicies.mutation',
				service: 'carePathwayService.createForRequest'
			},
			{
				name: 'pecOpdNote',
				schema: 'schema: submitPecOpdNoteSchema',
				privilege: "privilege: 'emr.clinical_note.submit'",
				rateLimit: 'rateLimit: rateLimitPolicies.sensitive',
				service: 'clinicalNoteService.submitPecOpdNote'
			},
			{
				name: 'mobileClinicalNotes',
				schema: 'schema: submitPecOpdMobileNoteSchema',
				privilege: "privilege: 'emr.clinical_note.submit'",
				rateLimit: 'rateLimit: rateLimitPolicies.sensitive',
				service: 'clinicalNoteService.submitPecOpdNoteWithMobileIdempotency'
			}
		] as const;

		for (const { name, schema, privilege, rateLimit, service } of expectations) {
			const route = readRoute(name);

			expect(route).toContain(schema);
			expect(route).toContain(privilege);
			expect(route).toContain(rateLimit);
			expect(route).toContain(service);
			expect(route).toContain('requestId');
			expect(route).toContain('ipAddress');
			expect(route).toContain('userAgent');
		}
	});

	it('scopes PEC-specific mutations to PEC resources for allocated-PEC authorization', () => {
		for (const name of ['patients', 'encounters', 'pecOpdNote', 'mobileClinicalNotes'] as const) {
			expect(readRoute(name), `${name} route`).toContain("resource: (body) => ({ type: 'pec'");
		}
	});
});
