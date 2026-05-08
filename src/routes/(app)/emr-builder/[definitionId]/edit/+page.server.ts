import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { authorize } from '$lib/server/authz/authorize';
import { enforceRateLimit, rateLimitPolicies } from '$lib/server/api/rate-limit';
import { emrBuilderService } from '$lib/server/modules/emr-builder/emr-builder.service';
import { emrBuilderDefinitionQuerySchema } from '$lib/server/modules/emr-builder/emr-builder.schemas';
import { convertXlsformToEmrDefinition } from '$lib/server/modules/xlsform-import/xlsform-import';
import { PEC_XLSFORMS } from '$lib/server/modules/xlsform-import/fixtures';
import { isAppError } from '$lib/server/observability/errors';
import type { EmrNoteDefinitionRecord } from '$lib/server/modules/emr-builder/emr-builder.types';

type SerializableDefinitionRecord = Omit<
	EmrNoteDefinitionRecord,
	'createdAt' | 'updatedAt' | 'effectiveFrom' | 'effectiveUntil'
> & {
	createdAt: string;
	updatedAt: string;
	effectiveFrom: string | null;
	effectiveUntil: string | null;
	tags: string[] | null;
};

function normalizeTags(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : [];
}

function toSerializableDefinitionRecord(
	record: EmrNoteDefinitionRecord
): SerializableDefinitionRecord {
	return {
		...record,
		tags: normalizeTags(record.tags),
		createdAt: record.createdAt.toISOString(),
		updatedAt: record.updatedAt.toISOString(),
		effectiveFrom: record.effectiveFrom?.toISOString() ?? null,
		effectiveUntil: record.effectiveUntil?.toISOString() ?? null
	};
}

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) redirect(302, '/login');

	const parsed = emrBuilderDefinitionQuerySchema.safeParse({
		definitionId: params.definitionId.trim().toLowerCase()
	});
	if (!parsed.success) {
		error(400, 'Invalid EMR definition id.');
	}

	const definitionId = parsed.data.definitionId;
	const fixture = PEC_XLSFORMS.find((form) => form.slug === definitionId);

	try {
		enforceRateLimit(rateLimitPolicies.read, locals.user.id);
		await authorize(locals.user.id, 'emr.builder.manage', {
			type: 'emr_definition',
			id: definitionId
		});
		const draft = await emrBuilderService.getDraft(definitionId);
		return {
			definitionId,
			definitionRecord: toSerializableDefinitionRecord(draft.definition),
			draftPayload: draft.draft?.payloadJson,
			fixtureDefinition: fixture ? convertXlsformToEmrDefinition(fixture).definition : null,
			message: draft.draft
				? 'Loaded saved Builder draft.'
				: fixture
					? 'Loaded saved metadata. Use Apply JSON or Save Draft to persist fixture changes.'
					: 'Loaded saved definition metadata.'
		};
	} catch (value) {
		if (!isAppError(value) || value.code !== 'NOT_FOUND') {
			if (isAppError(value)) error(value.status, value.message);
			throw value;
		}

		if (!fixture) error(404, 'EMR definition not found.');

		const imported = convertXlsformToEmrDefinition(fixture);
		return {
			definitionId,
			definitionRecord: {
				id: `fixture-${definitionId}`,
				definitionId,
				slug: imported.definition.metadata.slug,
				title: imported.definition.metadata.title,
				noteType: imported.definition.metadata.noteType,
				specialty: imported.definition.metadata.specialty ?? null,
				status: 'draft',
				version: imported.definition.metadata.version,
				versionHash: '',
				locale: imported.definition.metadata.locale,
				tags: normalizeTags(imported.definition.metadata.tags),
				ownerTeam: imported.definition.metadata.ownerTeam ?? null,
				effectiveFrom: null,
				effectiveUntil: null,
				createdBy: null,
				updatedBy: null,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			},
			draftPayload: imported.definition,
			fixtureDefinition: imported.definition,
			message: 'Loaded XLSForm-derived fixture. Save Draft will persist it in the Builder.'
		};
	}
};
