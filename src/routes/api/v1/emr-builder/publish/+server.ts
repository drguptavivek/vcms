import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { emrBuilderPublishDraftSchema } from '$lib/server/modules/emr-builder/emr-builder.schemas';
import { emrBuilderService } from '$lib/server/modules/emr-builder/emr-builder.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: emrBuilderPublishDraftSchema,
		privilege: 'emr.builder.manage',
		resource: (body) => ({ type: 'emr_definition', id: body.definitionId }),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			emrBuilderService.publishDraft({
				definitionId: body.definitionId,
				userId,
				reason: body.reason,
				audit: {
					requestId,
					ipAddress: event.locals.clientIp,
					userAgent: event.request.headers.get('user-agent') ?? undefined
				}
			})
	});
