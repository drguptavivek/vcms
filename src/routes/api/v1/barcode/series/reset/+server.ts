import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { resetSeriesSchema } from '$lib/server/modules/barcode/barcode.schemas';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: resetSeriesSchema,
		privilege: 'barcode.sequence.reset',
		resource: (body) => ({ type: 'pec', id: body.pecId }),
		rateLimit: rateLimitPolicies.sensitive,
		handler: ({ body, userId, requestId }) =>
			barcodeService.resetSeries({ ...body, userId, requestId })
	});
