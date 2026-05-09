import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { authorize } from '$lib/server/authz/authorize';
import { enforceRateLimit, rateLimitPolicies } from '$lib/server/api/rate-limit';
import { emrBuilderService } from '$lib/server/modules/emr-builder/emr-builder.service';
import { emrBuilderDefinitionQuerySchema } from '$lib/server/modules/emr-builder/emr-builder.schemas';
import { convertXlsformToEmrDefinition } from '$lib/server/modules/xlsform-import/xlsform-import';
import { PEC_XLSFORMS } from '$lib/server/modules/xlsform-import/fixtures';
import { isAppError } from '$lib/server/observability/errors';
import type {
	EmrNoteDefinition,
	EmrNoteDefinitionRecord
} from '$lib/server/modules/emr-builder/emr-builder.types';

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

function titleFromDefinitionId(definitionId: string): string {
	return definitionId
		.split(/[-_]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

function makeStarterDefinition(
	definitionId: string,
	input?: { title?: string; noteType?: string }
): EmrNoteDefinition {
	const title = input?.title?.trim() || titleFromDefinitionId(definitionId) || 'New Form';
	return {
		metadata: {
			definitionId,
			slug: `${definitionId}-definition`,
			title,
			noteType: input?.noteType?.trim() || 'opd',
			specialty: 'ophthalmology',
			status: 'draft',
			version: 1,
			locale: 'en-IN',
			languages: [],
			tags: ['builder-native']
		},
		layout: {
			sections: [
				{
					id: 'section_1',
					title: 'Section 1',
					kind: 'section',
					fields: [],
					sections: [],
					rules: [],
					order: 0,
					collapsible: false,
					defaultCollapsed: false
				}
			]
		},
		rules: [],
		actions: [],
		analytics: {
			dimensions: [],
			measures: [],
			events: []
		}
	};
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
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

		if (!fixture) {
			const starter = makeStarterDefinition(definitionId, {
				title: url.searchParams.get('title') ?? undefined,
				noteType: url.searchParams.get('noteType') ?? undefined
			});
			return {
				definitionId,
				definitionRecord: {
					id: `new-${definitionId}`,
					definitionId,
					slug: starter.metadata.slug,
					title: starter.metadata.title,
					noteType: starter.metadata.noteType,
					specialty: starter.metadata.specialty ?? null,
					status: 'draft',
					version: starter.metadata.version,
					versionHash: '',
					locale: starter.metadata.locale,
					tags: starter.metadata.tags,
					ownerTeam: starter.metadata.ownerTeam ?? null,
					effectiveFrom: null,
					effectiveUntil: null,
					createdBy: null,
					updatedBy: null,
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString()
				},
				draftPayload: starter,
				fixtureDefinition: null,
				message: 'Started a new Builder form. Save Draft will create it.'
			};
		}

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
			message: 'Loaded imported fixture. Save Draft will persist it in the Builder.'
		};
	}
};
