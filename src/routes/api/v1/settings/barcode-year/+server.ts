import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { updateBarcodeYearSchema } from '$lib/server/modules/settings/settings.schemas';
import { settingsService } from '$lib/server/modules/settings/settings.service';

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: updateBarcodeYearSchema,
		privilege: 'settings.barcode_year.update',
		resource: () => ({ type: 'system', id: 'barcode.current_year' }),
		rateLimit: rateLimitPolicies.sensitive,
		handler: ({ body, userId, requestId, event }) =>
			settingsService.updateBarcodeYear({
				...body,
				userId,
				requestId,
				ipAddress: event.locals.clientIp,
				userAgent: event.request.headers.get('user-agent') ?? undefined
			})
	});
