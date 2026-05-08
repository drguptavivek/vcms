import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { authorize } from '$lib/server/authz/authorize';
import { enforceRateLimit, rateLimitPolicies } from '$lib/server/api/rate-limit';
import { emrBuilderService } from '$lib/server/modules/emr-builder/emr-builder.service';
import { convertXlsformToEmrDefinition } from '$lib/server/modules/xlsform-import/xlsform-import';
import { PEC_XLSFORMS } from '$lib/server/modules/xlsform-import/fixtures';
import { isAppError } from '$lib/server/observability/errors';
import type { EmrNoteDefinition } from '$lib/server/modules/emr-builder/emr-builder.types';

type BuilderLandingForm = {
	definitionId: string;
	title: string;
	noteType: string;
	specialty: string | null;
	status: 'draft' | 'active' | 'retired' | 'fixture';
	version: number;
	source: 'saved+xlsform' | 'xlsform-fixture' | 'saved';
	sectionCount: number | null;
	fieldCount: number | null;
	issueCount: number | null;
	updatedAt: string | null;
	usage: string;
};

function countFields(sections: EmrNoteDefinition['layout']['sections']): number {
	return sections.reduce(
		(total, section) => total + section.fields.length + countFields(section.sections),
		0
	);
}

function countSections(sections: EmrNoteDefinition['layout']['sections']): number {
	return sections.reduce((total, section) => total + 1 + countSections(section.sections), 0);
}

function throwPageAppError(value: unknown): never {
	if (isAppError(value)) error(value.status, value.message);
	throw value;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	try {
		enforceRateLimit(rateLimitPolicies.read, locals.user.id);
		await authorize(locals.user.id, 'emr.builder.manage', { type: 'system', id: 'global' });
	} catch (value) {
		throwPageAppError(value);
	}

	const [savedDefinitions, importedForms] = await Promise.all([
		emrBuilderService.listDefinitionsForBuilder(),
		Promise.resolve(PEC_XLSFORMS.map((fixture) => convertXlsformToEmrDefinition(fixture)))
	]);

	const savedByDefinitionId = new Map(
		savedDefinitions.map((definition) => [definition.definitionId, definition])
	);
	const fixtureDefinitionIds = new Set(importedForms.map((form) => form.definitionId));

	const forms: BuilderLandingForm[] = importedForms.map((form) => {
		const saved = savedByDefinitionId.get(form.definitionId);
		const metadata = form.definition.metadata;
		return {
			definitionId: form.definitionId,
			title: saved?.title ?? metadata.title,
			noteType: saved?.noteType ?? metadata.noteType,
			specialty: saved?.specialty ?? metadata.specialty ?? null,
			status: saved?.status ?? 'fixture',
			version: saved?.version ?? metadata.version,
			source: saved ? 'saved+xlsform' : 'xlsform-fixture',
			sectionCount: countSections(form.definition.layout.sections),
			fieldCount: countFields(form.definition.layout.sections),
			issueCount: form.issues.length,
			updatedAt: saved?.updatedAt.toISOString() ?? null,
			usage: saved?.status === 'active' ? 'Published for runtime/mobile' : 'Draft/import review'
		};
	});

	for (const definition of savedDefinitions) {
		if (fixtureDefinitionIds.has(definition.definitionId)) continue;
		forms.push({
			definitionId: definition.definitionId,
			title: definition.title,
			noteType: definition.noteType,
			specialty: definition.specialty,
			status: definition.status,
			version: definition.version,
			source: 'saved',
			sectionCount: null,
			fieldCount: null,
			issueCount: null,
			updatedAt: definition.updatedAt.toISOString(),
			usage: definition.status === 'active' ? 'Published for runtime/mobile' : 'Draft/import review'
		});
	}

	return {
		forms,
		summary: {
			totalForms: forms.length,
			savedForms: savedDefinitions.length,
			importedForms: importedForms.length,
			publishedForms: forms.filter((form) => form.status === 'active').length,
			totalFields: forms.reduce((total, form) => total + (form.fieldCount ?? 0), 0)
		}
	};
};
