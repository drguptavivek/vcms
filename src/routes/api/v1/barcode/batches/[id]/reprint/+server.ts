import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { reprintBatchSchema } from '$lib/server/modules/barcode/barcode.schemas';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: reprintBatchSchema,
		privilege: 'barcode.batch.reprint',
		resource: async (_body, event) => ({
			type: 'pec',
			id: await barcodeService.getBatchPecIdForAuthorization(event.params.id!)
		}),
		rateLimit: rateLimitPolicies.barcodeMutation,
		handler: ({ body, userId, requestId, event }) =>
			barcodeService.reprintBatch({
				batchId: event.params.id!,
				...body,
				userId,
				requestId
			})
	});
