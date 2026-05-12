import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { validationFailed } from '$lib/server/observability/errors';
import { terminologyLookupQuerySchema } from '$lib/server/modules/terminology/terminology.schemas';
import { terminologyService } from '$lib/server/modules/terminology/terminology.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'terminology.view',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = terminologyLookupQuerySchema.safeParse({
				conceptId: event.url.searchParams.get('conceptId')?.trim() ?? undefined
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			return terminologyService.lookupSnomedConcept(parsed.data);
		}
	});
