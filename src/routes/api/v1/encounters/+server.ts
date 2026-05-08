import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { validationFailed } from '$lib/server/observability/errors';
import {
	encounterCreateSchema,
	encounterListQuerySchema
} from '$lib/server/modules/encounters/encounter.schemas';
import { encounterService } from '$lib/server/modules/encounters/encounter.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.encounter.view',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = encounterListQuerySchema.safeParse({
				patientId: event.url.searchParams.get('patientId') ?? undefined,
				patientBarcode: event.url.searchParams.get('patientBarcode')?.trim() ?? undefined
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			if (parsed.data.patientId) {
				return encounterService.listByPatientId(parsed.data.patientId);
			}

			return encounterService.listByPatientIdentifier({
				patientBarcode: parsed.data.patientBarcode
			});
		}
	});

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: encounterCreateSchema,
		privilege: 'emr.encounter.create',
		resource: (body) => ({ type: 'pec', id: body.pecId }),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			encounterService.createForRequest({
				...body,
				userId,
				requestId,
				ipAddress: event.locals.clientIp,
				userAgent: event.request.headers.get('user-agent') ?? undefined
			})
	});
