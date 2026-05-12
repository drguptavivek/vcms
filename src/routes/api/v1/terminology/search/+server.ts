import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { validationFailed } from '$lib/server/observability/errors';
import { terminologySearchQuerySchema } from '$lib/server/modules/terminology/terminology.schemas';
import { terminologyService } from '$lib/server/modules/terminology/terminology.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'terminology.view',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = terminologySearchQuerySchema.safeParse({
				q: event.url.searchParams.get('q')?.trim() ?? undefined,
				limit: event.url.searchParams.get('limit') ?? undefined,
				semanticTag: event.url.searchParams.get('semanticTag')?.trim() ?? undefined,
				active: event.url.searchParams.get('active')?.trim() ?? undefined
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			return terminologyService.searchSnomedConcepts(parsed.data);
		}
	});
