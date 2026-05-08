import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { validationFailed } from '$lib/server/observability/errors';
import {
	carePathwayCreateSchema,
	carePathwayListQuerySchema
} from '$lib/server/modules/care-pathways/care-pathway.schemas';
import { carePathwayService } from '$lib/server/modules/care-pathways/care-pathway.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.care_pathway.view',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = carePathwayListQuerySchema.safeParse({
				patientId: event.url.searchParams.get('patientId')?.trim() || undefined,
				patientBarcode: event.url.searchParams.get('patientBarcode')?.trim() || undefined
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			if (parsed.data.patientId) {
				return carePathwayService.listByPatientId(parsed.data.patientId);
			}

			return carePathwayService.listByPatientIdentifier({
				patientBarcode: parsed.data.patientBarcode
			});
		}
	});

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: carePathwayCreateSchema,
		privilege: 'emr.care_pathway.create',
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			carePathwayService.createForRequest({
				...body,
				userId,
				requestId,
				ipAddress: event.locals.clientIp,
				userAgent: event.request.headers.get('user-agent') ?? undefined
			})
	});
