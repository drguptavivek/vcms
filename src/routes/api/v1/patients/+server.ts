import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { notFound, validationFailed } from '$lib/server/observability/errors';
import {
	patientCreateSchema,
	patientLookupSchema
} from '$lib/server/modules/patients/patient.schemas';
import { patientService } from '$lib/server/modules/patients/patient.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.patient.view',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = patientLookupSchema.safeParse({
				barcode: event.url.searchParams.get('barcode')?.trim() ?? undefined
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			return patientService.findByBarcode(parsed.data.barcode).then((patient) => {
				if (!patient) throw notFound('Patient not found.');
				return patient;
			});
		}
	});

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: patientCreateSchema,
		privilege: 'emr.patient.create',
		resource: (body) => ({ type: 'pec', id: body.primaryPecId }),
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId, event }) =>
			patientService.createForBarcodeWithAudit({
				...body,
				createdBy: userId,
				requestId,
				ipAddress: event.locals.clientIp,
				userAgent: event.request.headers.get('user-agent') ?? undefined
			})
	});
