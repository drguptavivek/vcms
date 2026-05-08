import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { db } from '$lib/server/db';
import { logger } from '$lib/server/observability/logger';
import { writeAudit } from '$lib/server/observability/audit';
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
			emrBuilderService
				.saveDraft({
					definition: body.definition,
					userId
				})
				.then(async (result) => {
					await writeAudit(db, {
						requestId,
						actorUserId: userId,
						action: 'emr.builder.manage',
						resourceType: 'emr_definition',
						resourceId: result.definition.id,
						reason: 'save_draft',
						before: {
							definitionId: body.definition.metadata.definitionId,
							existingVersion: result.definition.version,
							existingDraftHash: result.draft.versionHash
						},
						after: {
							definitionId: result.definition.definitionId,
							definitionVersion: result.definition.version,
							draftVersionHash: result.versionHash,
							createdDraftVersion: result.createdDraftVersion
						},
						ipAddress: event.locals.clientIp,
						userAgent: event.request.headers.get('user-agent') ?? undefined
					}).catch((error) => {
						logger.error({ requestId, err: error }, 'failed to write emr draft audit log');
					});

					return result;
				})
	});
