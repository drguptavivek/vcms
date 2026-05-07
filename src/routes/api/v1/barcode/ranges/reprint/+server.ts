import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { reprintPecRangeSchema } from '$lib/server/modules/barcode/barcode.schemas';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: reprintPecRangeSchema,
		privilege: 'barcode.batch.reprint',
		resource: (body) => ({ type: 'pec', id: body.pecId }),
		rateLimit: rateLimitPolicies.barcodeMutation,
		handler: ({ body, userId, requestId }) =>
			barcodeService.reprintPecRange({
				...body,
				userId,
				requestId
			})
	});
