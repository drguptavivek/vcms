import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { createPecSchema } from '$lib/server/modules/master-data/master-data.schemas';
import { masterDataService } from '$lib/server/modules/master-data/master-data.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'pec.view',
		rateLimit: rateLimitPolicies.read,
		handler: ({ userId }) => masterDataService.listPecs(userId)
	});

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: createPecSchema,
		privilege: 'pec.manage',
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId }) =>
			masterDataService.createPec({ ...body, userId, requestId })
	});
