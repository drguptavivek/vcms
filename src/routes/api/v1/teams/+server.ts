import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { createTeamSchema } from '$lib/server/modules/master-data/master-data.schemas';
import { masterDataService } from '$lib/server/modules/master-data/master-data.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'team.view',
		rateLimit: rateLimitPolicies.read,
		handler: ({ userId }) => masterDataService.listTeams(userId)
	});

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: createTeamSchema,
		privilege: 'team.manage',
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId }) =>
			masterDataService.createTeam({ ...body, userId, requestId })
	});
