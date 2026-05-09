import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { db } from '$lib/server/db';
import { logger } from '$lib/server/observability/logger';
import { writeAudit } from '$lib/server/observability/audit';
import { emrDictionarySaveDraftSchema } from '$lib/server/modules/emr-dictionary/emr-dictionary.schemas';
import { emrDictionaryService } from '$lib/server/modules/emr-dictionary/emr-dictionary.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: emrDictionarySaveDraftSchema,
		privilege: 'emr.dictionary.manage',
		resource: (body) => ({
			type: 'emr_dictionary_asset',
			id: `${body.dictionaryId}:${body.key}:${body.kind}`
		}),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			emrDictionaryService.saveDraft({ asset: body, userId }).then(async (result) => {
				await writeAudit(db, {
					requestId,
					actorUserId: userId,
					action: 'emr.dictionary.manage',
					resourceType: 'emr_dictionary_asset',
					resourceId: `${result.asset.dictionaryId}:${result.asset.key}:${result.asset.kind}`,
					reason: 'save_draft',
					before: {
						dictionaryId: body.dictionaryId,
						key: body.key,
						kind: body.kind,
						existingVersion: result.asset.version
					},
					after: {
						dictionaryId: result.asset.dictionaryId,
						key: result.asset.key,
						kind: result.asset.kind,
						draftVersionHash: result.versionHash,
						createdDraftVersion: result.createdDraftVersion
					},
					ipAddress: event.locals.clientIp,
					userAgent: event.request.headers.get('user-agent') ?? undefined
				}).catch((error) => {
					logger.error({ requestId, err: error }, 'failed to write emr dictionary save audit log');
				});

				return result;
			})
	});
