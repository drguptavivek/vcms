import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';
import { enforceRateLimit, rateLimitPolicies } from '$lib/server/api/rate-limit';
import { isAppError } from '$lib/server/observability/errors';
import { logger } from '$lib/server/observability/logger';
import { qzIntegrationService } from '$lib/server/modules/qz-integration/qz-integration.service';

export const GET: RequestHandler = async (event) => {
	const requestId = event.locals.requestId;

	try {
		enforceRateLimit(
			rateLimitPolicies.read,
			event.locals.user?.id ?? event.locals.clientIp ?? 'anonymous'
		);

		const data = await qzIntegrationService.getCertificate();
		return json({ ok: true, data, requestId });
	} catch (error) {
		const appError = isAppError(error)
			? error
			: {
					code: 'INTERNAL_ERROR',
					message: 'Unexpected server error.',
					status: 500,
					details: undefined,
					headers: undefined
				};
		if (appError.status >= 500) {
			logger.error({ requestId, err: error }, 'QZ certificate request failed');
		} else {
			logger.warn(
				{ requestId, code: appError.code, status: appError.status },
				'QZ certificate request rejected'
			);
		}
		return json(
			{
				ok: false,
				error: {
					code: appError.code,
					message: appError.message,
					details: appError.details
				},
				requestId
			},
			{ status: appError.status, headers: appError.headers }
		);
	}
};
