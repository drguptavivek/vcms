import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { db } from '$lib/server/db';
import { writeAudit } from '$lib/server/observability/audit';
import { logger } from '$lib/server/observability/logger';
import { openEhrAqlExecuteSchema } from '$lib/server/modules/ehrbase/open-ehr-query.schemas';
import { openEhrQueryService } from '$lib/server/modules/ehrbase/open-ehr-query.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: openEhrAqlExecuteSchema,
		privilege: 'emr.aql.query',
		resource: (body) => ({ type: 'openehr_aql_query', id: body.queryId }),
		rateLimit: rateLimitPolicies.read,
		handler: ({ body, userId, requestId, event }) =>
			openEhrQueryService.execute(body).then(async (result) => {
				await writeAudit(db, {
					requestId,
					actorUserId: userId,
					action: 'emr.aql.query',
					resourceType: 'openehr_aql_query',
					resourceId: body.queryId,
					reason: 'execute_curated_aql_query',
					after: {
						queryId: body.queryId,
						parameterNames: Object.keys(body.parameters ?? {}).sort(),
						offset: result.offset,
						fetch: result.fetch,
						rowCount: result.result.rows.length
					},
					ipAddress: event.locals.clientIp,
					userAgent: event.request.headers.get('user-agent') ?? undefined
				}).catch((error) => {
					logger.error({ requestId, err: error }, 'failed to write openEHR AQL audit log');
				});

				return result;
			})
	});
