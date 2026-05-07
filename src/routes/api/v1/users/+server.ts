import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { userService } from '$lib/server/modules/users/user.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'user.manage',
		rateLimit: rateLimitPolicies.read,
		handler: () => userService.listUsers()
	});
