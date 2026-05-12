import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { openEhrQueryService } from '$lib/server/modules/ehrbase/open-ehr-query.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.aql.query',
		rateLimit: rateLimitPolicies.read,
		handler: async () => openEhrQueryService.listQueries()
	});
