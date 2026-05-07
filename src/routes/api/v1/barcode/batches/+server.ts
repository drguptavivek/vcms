import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { createBatchSchema } from '$lib/server/modules/barcode/barcode.schemas';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'barcode.batch.view',
		rateLimit: rateLimitPolicies.read,
		handler: ({ userId }) => barcodeService.listBatches(userId)
	});

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: createBatchSchema,
		privilege: 'barcode.batch.print',
		resource: (body) => ({ type: 'pec', id: body.pecId }),
		rateLimit: rateLimitPolicies.barcodeMutation,
		handler: ({ body, userId, requestId, event }) =>
			barcodeService.createBatch({
				...body,
				userId,
				requestId,
				ipAddress: event.locals.clientIp,
				userAgent: event.request.headers.get('user-agent') ?? undefined
			})
	});
