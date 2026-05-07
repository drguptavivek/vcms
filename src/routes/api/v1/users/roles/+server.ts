import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { assignRoleSchema } from '$lib/server/modules/users/user.schemas';
import { userService } from '$lib/server/modules/users/user.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'user.manage',
		rateLimit: rateLimitPolicies.read,
		handler: () => userService.listRoles()
	});

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: assignRoleSchema,
		privilege: 'user.manage',
		rateLimit: rateLimitPolicies.sensitive,
		handler: ({ body, userId, requestId }) =>
			userService.assignRole({ ...body, actorUserId: userId, requestId })
	});
