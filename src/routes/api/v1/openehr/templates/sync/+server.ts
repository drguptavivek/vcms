import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { db } from '$lib/server/db';
import { writeAudit } from '$lib/server/observability/audit';
import { logger } from '$lib/server/observability/logger';
import { openEhrTemplateIdentitySchema } from '$lib/server/modules/ehrbase/open-ehr-template.schemas';
import { openEhrTemplateService } from '$lib/server/modules/ehrbase/open-ehr-template.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: openEhrTemplateIdentitySchema,
		privilege: 'emr.template.manage',
		resource: (body) => ({ type: 'openehr_template', id: body.templateId }),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			openEhrTemplateService
				.syncTemplateFromCdr({
					templateId: body.templateId,
					userId
				})
				.then(async (result) => {
					await writeAudit(db, {
						requestId,
						actorUserId: userId,
						action: 'emr.template.manage',
						resourceType: 'openehr_template',
						resourceId: result.template.templateId,
						reason: 'sync_from_cdr',
						after: {
							templateId: result.template.templateId,
							cdrTemplateId: result.template.cdrTemplateId,
							webTemplateRootId: result.template.webTemplateRootId,
							webTemplateHash: result.template.webTemplateHash
						},
						ipAddress: event.locals.clientIp,
						userAgent: event.request.headers.get('user-agent') ?? undefined
					}).catch((error) => {
						logger.error(
							{ requestId, err: error },
							'failed to write openEHR template sync audit log'
						);
					});

					return result;
				})
	});
