import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { terminologyService } from '$lib/server/modules/terminology/terminology.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'terminology.view',
		rateLimit: rateLimitPolicies.read,
		handler: () => terminologyService.health()
	});
