import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { reserveOfflineSchema } from '$lib/server/modules/barcode/barcode.schemas';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: reserveOfflineSchema,
		privilege: 'barcode.range.reserve_offline',
		resource: (body) => ({ type: 'pec', id: body.pecId }),
		rateLimit: rateLimitPolicies.sensitive,
		handler: ({ body, userId, requestId }) =>
			barcodeService.reserveOffline({ ...body, userId, requestId })
	});
