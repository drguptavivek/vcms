import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { authorize } from '$lib/server/authz/authorize';
import { enforceRateLimit, rateLimitPolicies } from '$lib/server/api/rate-limit';
import { isAppError } from '$lib/server/observability/errors';
import { openEhrTemplateService } from '$lib/server/modules/ehrbase/open-ehr-template.service';

function throwPageAppError(value: unknown): never {
	if (isAppError(value)) error(value.status, value.message);
	throw value;
}

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) redirect(302, '/login');
	try {
		enforceRateLimit(rateLimitPolicies.read, locals.user.id);
		await authorize(locals.user.id, 'emr.template.manage', { type: 'system', id: 'global' });
	} catch (value) {
		throwPageAppError(value);
	}

	const templates = await openEhrTemplateService.listLocalTemplates({});

	return {
		templates: templates.map((template) => ({
			id: template.id,
			templateId: template.templateId,
			cdrTemplateId: template.cdrTemplateId,
			concept: template.concept,
			archetypeId: template.archetypeId,
			format: template.format,
			status: template.status,
			operationalTemplateHash: template.operationalTemplateHash,
			webTemplateHash: template.webTemplateHash,
			webTemplateRootId: template.webTemplateRootId,
			uploadedAt: template.uploadedAt?.toISOString() ?? null,
			updatedAt: template.updatedAt.toISOString()
		}))
	};
};
