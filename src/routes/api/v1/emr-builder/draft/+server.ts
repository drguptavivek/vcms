import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { validationFailed } from '$lib/server/observability/errors';
import {
	emrBuilderDefinitionQuerySchema,
	emrBuilderSaveDraftSchema
} from '$lib/server/modules/emr-builder/emr-builder.schemas';
import { emrBuilderService } from '$lib/server/modules/emr-builder/emr-builder.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.builder.manage',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = emrBuilderDefinitionQuerySchema.safeParse({
				definitionId: event.url.searchParams.get('definitionId')?.trim() ?? undefined
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			return emrBuilderService.getDraft(parsed.data.definitionId);
		}
	});

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: emrBuilderSaveDraftSchema,
		privilege: 'emr.builder.manage',
		resource: (body) => ({ type: 'emr_definition', id: body.definition.metadata.definitionId }),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			emrBuilderService.saveDraft({
				definition: body.definition,
				userId,
				audit: {
					requestId,
					ipAddress: event.locals.clientIp,
					userAgent: event.request.headers.get('user-agent') ?? undefined
				}
			})
	});
