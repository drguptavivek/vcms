import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { generateQzCredentialsSchema } from '$lib/server/modules/qz-integration/qz-integration.schemas';
import { qzIntegrationService } from '$lib/server/modules/qz-integration/qz-integration.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: generateQzCredentialsSchema,
		privilege: 'qz.credentials.update',
		rateLimit: rateLimitPolicies.sensitive,
		handler: ({ body, userId, requestId, event }) =>
			qzIntegrationService.generateAndSaveCredentials({
				...body,
				userId,
				requestId,
				ipAddress: event.locals.clientIp,
				userAgent: event.request.headers.get('user-agent') ?? undefined
			})
	});
