import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { validationFailed } from '$lib/server/observability/errors';
import { emrDictionaryListQuerySchema } from '$lib/server/modules/emr-dictionary/emr-dictionary.schemas';
import { emrDictionaryService } from '$lib/server/modules/emr-dictionary/emr-dictionary.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.dictionary.manage',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = emrDictionaryListQuerySchema.safeParse({
				dictionaryId: event.url.searchParams.get('dictionaryId')?.trim() ?? undefined,
				kind: event.url.searchParams.get('kind')?.trim() ?? undefined,
				status: event.url.searchParams.get('status')?.trim() ?? undefined,
				specialty: event.url.searchParams.get('specialty')?.trim() ?? undefined
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			return emrDictionaryService.listAssets(parsed.data);
		}
	});
