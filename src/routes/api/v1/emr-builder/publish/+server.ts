import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { db } from '$lib/server/db';
import { logger } from '$lib/server/observability/logger';
import { writeAudit } from '$lib/server/observability/audit';
import { emrBuilderPublishDraftSchema } from '$lib/server/modules/emr-builder/emr-builder.schemas';
import { emrBuilderService } from '$lib/server/modules/emr-builder/emr-builder.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: emrBuilderPublishDraftSchema,
		privilege: 'emr.builder.manage',
		resource: (body) => ({ type: 'emr_definition', id: body.definitionId }),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			emrBuilderService
				.publishDraft({
					definitionId: body.definitionId,
					userId,
					reason: body.reason
				})
				.then(async (result) => {
					await writeAudit(db, {
						requestId,
						actorUserId: userId,
						action: 'emr.builder.manage',
						resourceType: 'emr_definition',
						resourceId: result.definition.id,
						reason: body.reason ?? 'publish_draft',
						before: {
							definitionId: body.definitionId,
							previousVersion: result.version.version - 1,
							publishedVersion: result.version.version
						},
						after: {
							definitionId: result.definition.definitionId,
							version: result.definition.version,
							status: result.definition.status
						},
						ipAddress: event.locals.clientIp,
						userAgent: event.request.headers.get('user-agent') ?? undefined
					}).catch((error) => {
						logger.error({ requestId, err: error }, 'failed to write emr publish audit log');
					});

					return result;
				})
	});
