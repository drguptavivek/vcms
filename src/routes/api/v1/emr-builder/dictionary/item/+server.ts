import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { validationFailed } from '$lib/server/observability/errors';
import { emrDictionaryAssetIdentitySchema } from '$lib/server/modules/emr-dictionary/emr-dictionary.schemas';
import { emrDictionaryService } from '$lib/server/modules/emr-dictionary/emr-dictionary.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.dictionary.manage',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = emrDictionaryAssetIdentitySchema.safeParse({
				dictionaryId: event.url.searchParams.get('dictionaryId')?.trim() ?? undefined,
				key: event.url.searchParams.get('key')?.trim() ?? undefined,
				kind: event.url.searchParams.get('kind')?.trim() ?? undefined
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			return emrDictionaryService.getAsset(parsed.data);
		}
	});
