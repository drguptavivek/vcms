import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { saveQzCredentialsSchema } from '$lib/server/modules/qz-integration/qz-integration.schemas';
import { qzIntegrationService } from '$lib/server/modules/qz-integration/qz-integration.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: saveQzCredentialsSchema,
		privilege: 'qz.credentials.update',
		rateLimit: rateLimitPolicies.sensitive,
		handler: ({ body, userId, requestId, event }) =>
			qzIntegrationService.saveCredentials({
				...body,
				userId,
				requestId,
				ipAddress: event.locals.clientIp,
				userAgent: event.request.headers.get('user-agent') ?? undefined
			})
	});

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'qz.credentials.update',
		rateLimit: rateLimitPolicies.sensitive,
		handler: () => qzIntegrationService.getCurrentCredentials()
	});
