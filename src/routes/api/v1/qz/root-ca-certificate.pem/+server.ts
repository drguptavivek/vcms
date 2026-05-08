import { json, type RequestHandler } from '@sveltejs/kit';
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

		const { certificate } = await qzIntegrationService.getRootCaCertificate();
		return new Response(certificate.endsWith('\n') ? certificate : `${certificate}\n`, {
			headers: {
				'content-type': 'application/x-pem-file; charset=utf-8',
				'content-disposition': 'attachment; filename="vcms-qz-root-ca.pem"',
				'x-request-id': requestId
			}
		});
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
			logger.error({ requestId, err: error }, 'QZ root CA export failed');
		} else {
			logger.warn(
				{ requestId, code: appError.code, status: appError.status },
				'QZ root CA export rejected'
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
