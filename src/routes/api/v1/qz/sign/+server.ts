import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { db } from '$lib/server/db';
import { qzSignRequestSchema } from '$lib/server/modules/qz-integration/qz-integration.schemas';
import { qzIntegrationService } from '$lib/server/modules/qz-integration/qz-integration.service';
import { writeAudit } from '$lib/server/observability/audit';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: qzSignRequestSchema,
		privilege: 'qz.message.sign',
		rateLimit: rateLimitPolicies.qzSigning,
		handler: async ({ body, userId, requestId, event }) => {
			const signed = await qzIntegrationService.sign(body);
			await writeAudit(db, {
				requestId,
				actorUserId: userId,
				action: 'qz.message.sign',
				resourceType: 'system',
				resourceId: 'qz-tray',
				reason: 'QZ Tray websocket message signing',
				after: { messageLength: body.toSign.length },
				ipAddress: event.locals.clientIp,
				userAgent: event.request.headers.get('user-agent') ?? undefined
			});
			return signed;
		}
	});
