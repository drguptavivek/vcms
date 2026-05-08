import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { validationFailed } from '$lib/server/observability/errors';
import { emrBuilderDefinitionIdSchema } from '$lib/server/modules/emr-builder/emr-builder.schemas';
import { emrBuilderService } from '$lib/server/modules/emr-builder/emr-builder.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.runtime.mobile_definition.view',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = emrBuilderDefinitionIdSchema.safeParse(event.params.definitionId?.trim());

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			return emrBuilderService.getPublishedDefinitionModelForMobile(parsed.data);
		}
	});
