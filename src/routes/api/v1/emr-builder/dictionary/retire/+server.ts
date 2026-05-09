import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { db } from '$lib/server/db';
import { logger } from '$lib/server/observability/logger';
import { writeAudit } from '$lib/server/observability/audit';
import { emrDictionaryRetireSchema } from '$lib/server/modules/emr-dictionary/emr-dictionary.schemas';
import { emrDictionaryService } from '$lib/server/modules/emr-dictionary/emr-dictionary.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: emrDictionaryRetireSchema,
		privilege: 'emr.dictionary.manage',
		resource: (body) => ({
			type: 'emr_dictionary_asset',
			id: `${body.dictionaryId}:${body.key}:${body.kind}`
		}),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			emrDictionaryService
				.retire({
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
						resourceId: `${result.dictionaryId}:${result.key}:${result.kind}`,
						reason: body.reason ?? 'retire',
						before: {
							dictionaryId: body.dictionaryId,
							key: body.key,
							kind: body.kind,
							previousStatus: result.status
						},
						after: {
							dictionaryId: result.dictionaryId,
							key: result.key,
							kind: result.kind,
							status: 'retired'
						},
						ipAddress: event.locals.clientIp,
						userAgent: event.request.headers.get('user-agent') ?? undefined
					}).catch((error) => {
						logger.error(
							{ requestId, err: error },
							'failed to write emr dictionary retire audit log'
						);
					});

					return result;
				})
	});
