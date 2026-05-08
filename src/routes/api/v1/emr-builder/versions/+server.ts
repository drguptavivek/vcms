import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { validationFailed } from '$lib/server/observability/errors';
import { emrBuilderDefinitionQuerySchema } from '$lib/server/modules/emr-builder/emr-builder.schemas';
import { emrBuilderService } from '$lib/server/modules/emr-builder/emr-builder.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'emr.builder.manage',
		rateLimit: rateLimitPolicies.read,
		handler: ({ event }) => {
			const parsed = emrBuilderDefinitionQuerySchema.safeParse({
				definitionId: event.url.searchParams.get('definitionId')?.trim() ?? undefined
			});

			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			return emrBuilderService.listVersions(parsed.data.definitionId);
		}
	});
