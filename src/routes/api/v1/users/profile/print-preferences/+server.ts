import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { updateUserPrintPreferencesSchema } from '$lib/server/modules/users/user.schemas';
import { userService } from '$lib/server/modules/users/user.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'user.profile.view',
		resource: (_body, event) => ({ type: 'user', id: event.locals.user!.id }),
		rateLimit: rateLimitPolicies.read,
		handler: ({ userId }) => userService.getPrintPreferences(userId)
	});

export const PUT: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: updateUserPrintPreferencesSchema,
		privilege: 'user.profile.update',
		resource: (_body, event) => ({ type: 'user', id: event.locals.user!.id }),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId }) =>
			userService.updatePrintPreferences({
				userId,
				printPreferences: body.printPreferences,
				requestId
			})
	});
