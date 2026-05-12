import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { validationFailed } from '$lib/server/observability/errors';
import { openEhrTemplateIdentitySchema } from '$lib/server/modules/ehrbase/open-ehr-template.schemas';
import { openEhrTemplateService } from '$lib/server/modules/ehrbase/open-ehr-template.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.template.manage',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = openEhrTemplateIdentitySchema.safeParse({
				templateId: event.url.searchParams.get('templateId')?.trim() ?? ''
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			return openEhrTemplateService.getRuntimeManifest(parsed.data.templateId);
		}
	});
