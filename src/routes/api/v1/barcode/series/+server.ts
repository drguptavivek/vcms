import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		rateLimit: rateLimitPolicies.read,
		handler: ({ userId }) => barcodeService.listSeries(userId)
	});
