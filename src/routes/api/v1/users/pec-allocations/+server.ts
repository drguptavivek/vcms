import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { allocatePecSchema } from '$lib/server/modules/users/user.schemas';
import { userService } from '$lib/server/modules/users/user.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: allocatePecSchema,
		privilege: 'user.manage',
		rateLimit: rateLimitPolicies.sensitive,
		handler: ({ body, userId, requestId }) =>
			userService.allocatePec({ ...body, actorUserId: userId, requestId })
	});
