import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { db } from '$lib/server/db';
import { logger } from '$lib/server/observability/logger';
import { writeAudit } from '$lib/server/observability/audit';
import { emrDictionaryPublishDraftSchema } from '$lib/server/modules/emr-dictionary/emr-dictionary.schemas';
import { emrDictionaryService } from '$lib/server/modules/emr-dictionary/emr-dictionary.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: emrDictionaryPublishDraftSchema,
		privilege: 'emr.dictionary.manage',
		resource: (body) => ({
			type: 'emr_dictionary_asset',
			id: `${body.dictionaryId}:${body.key}:${body.kind}`
		}),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			emrDictionaryService
				.publishDraft({
					dictionaryId: body.dictionaryId,
					key: body.key,
					kind: body.kind,
					userId,
					reason: body.reason
				})
				.then(async (result) => {
					await writeAudit(db, {
						requestId,
						actorUserId: userId,
						action: 'emr.dictionary.manage',
						resourceType: 'emr_dictionary_asset',
						resourceId: `${result.asset.dictionaryId}:${result.asset.key}:${result.asset.kind}`,
						reason: body.reason ?? 'publish_draft',
						before: {
							dictionaryId: body.dictionaryId,
							key: body.key,
							kind: body.kind,
							previousVersion: result.version.version - 1
						},
						after: {
							dictionaryId: result.asset.dictionaryId,
							key: result.asset.key,
							kind: result.asset.kind,
							version: result.version.version,
							status: result.asset.status
						},
						ipAddress: event.locals.clientIp,
						userAgent: event.request.headers.get('user-agent') ?? undefined
					}).catch((error) => {
						logger.error(
							{ requestId, err: error },
							'failed to write emr dictionary publish audit log'
						);
					});

					return result;
				})
	});
