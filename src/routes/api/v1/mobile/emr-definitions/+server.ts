import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { emrBuilderService } from '$lib/server/modules/emr-builder/emr-builder.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.runtime.mobile_definition.view',
		rateLimit: rateLimitPolicies.read,
		handler: () => emrBuilderService.listActiveDefinitionsForMobile()
	});
