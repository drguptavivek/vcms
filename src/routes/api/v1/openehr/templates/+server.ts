import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { db } from '$lib/server/db';
import { writeAudit } from '$lib/server/observability/audit';
import { validationFailed } from '$lib/server/observability/errors';
import { logger } from '$lib/server/observability/logger';
import {
	openEhrTemplateListQuerySchema,
	openEhrTemplateUploadSchema
} from '$lib/server/modules/ehrbase/open-ehr-template.schemas';
import { openEhrTemplateService } from '$lib/server/modules/ehrbase/open-ehr-template.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.template.manage',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = openEhrTemplateListQuerySchema.safeParse({
				status: event.url.searchParams.get('status')?.trim() || undefined
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			return openEhrTemplateService.listLocalTemplates(parsed.data);
		}
	});

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: openEhrTemplateUploadSchema,
		privilege: 'emr.template.manage',
		resource: () => ({ type: 'openehr_template', id: 'upload' }),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			openEhrTemplateService
				.uploadAndCacheAdl14Template({
					operationalTemplateXml: body.operationalTemplateXml,
					userId
				})
				.then(async (result) => {
					await writeAudit(db, {
						requestId,
						actorUserId: userId,
						action: 'emr.template.manage',
						resourceType: 'openehr_template',
						resourceId: result.template.templateId,
						reason: 'upload_adl14_template',
						after: {
							templateId: result.template.templateId,
							cdrTemplateId: result.template.cdrTemplateId,
							webTemplateRootId: result.template.webTemplateRootId,
							webTemplateHash: result.template.webTemplateHash,
							operationalTemplateHash: result.template.operationalTemplateHash
						},
						ipAddress: event.locals.clientIp,
						userAgent: event.request.headers.get('user-agent') ?? undefined
					}).catch((error) => {
						logger.error({ requestId, err: error }, 'failed to write openEHR template audit log');
					});

					return result;
				})
	});
