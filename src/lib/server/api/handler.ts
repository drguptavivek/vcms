import { json, type RequestEvent } from '@sveltejs/kit';
import type { z } from 'zod';
import { authorize, type ResourceRef } from '$lib/server/authz/authorize';
import { enforceRateLimit, type RateLimitPolicy } from './rate-limit';
import { isAppError, unauthorized, validationFailed } from '$lib/server/observability/errors';
import { logger } from '$lib/server/observability/logger';
import { db } from '$lib/server/db';
import { appErrorLogs } from '$lib/server/db/schema';
import { writeAudit } from '$lib/server/observability/audit';

type ApiHandlerOptions<TSchema extends z.ZodTypeAny, TResult> = {
	schema?: TSchema;
	privilege?: string;
	resource?: (body: z.infer<TSchema>, event: RequestEvent) => ResourceRef | Promise<ResourceRef>;
	rateLimit: RateLimitPolicy;
	handler: (input: {
		body: z.infer<TSchema>;
		event: RequestEvent;
		userId: string;
		requestId: string;
	}) => Promise<TResult>;
};

export async function withApiHandler<TSchema extends z.ZodTypeAny, TResult>(
	event: RequestEvent,
	options: ApiHandlerOptions<TSchema, TResult>
) {
	const requestId = event.locals.requestId;
	let auditResource: ResourceRef = { type: 'system', id: 'global' };
	try {
		const identity = event.locals.user?.id ?? event.locals.clientIp;
		enforceRateLimit(options.rateLimit, identity);

		if (!event.locals.user) throw unauthorized();

		const rawBody =
			event.request.method === 'GET' ? {} : await event.request.json().catch(() => ({}));
		if (options.schema) {
			const parsed = options.schema.safeParse(rawBody);
			if (!parsed.success) throw validationFailed(parsed.error.flatten());

			if (options.privilege) {
				const resource = options.resource
					? await options.resource(parsed.data as z.infer<TSchema>, event)
					: { type: 'system', id: 'global' };
				auditResource = resource;
				await authorize(event.locals.user.id, options.privilege, resource);
			}

			const data = await options.handler({
				body: parsed.data as z.infer<TSchema>,
				event,
				userId: event.locals.user.id,
				requestId
			});
			return json({ ok: true, data, requestId });
		}

		if (options.privilege) {
			await authorize(event.locals.user.id, options.privilege, auditResource);
		}

		const data = await options.handler({
			body: {} as z.infer<TSchema>,
			event,
			userId: event.locals.user.id,
			requestId
		});
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
		logger.error(
			{
				requestId,
				code: appError.code,
				status: appError.status,
				details: appError.details,
				err: error instanceof Error ? { name: error.name, message: error.message } : undefined
			},
			'API request failed'
		);
		if (options.privilege && event.locals.user) {
			await writeAudit(db, {
				requestId,
				actorUserId: event.locals.user.id,
				action: options.privilege,
				resourceType: auditResource.type,
				resourceId: auditResource.id,
				outcome: 'failure',
				reason: appError.code,
				ipAddress: event.locals.clientIp,
				userAgent: event.request.headers.get('user-agent') ?? undefined
			}).catch((auditError) => {
				logger.error({ requestId, err: auditError }, 'failed to write failure audit log');
			});
		}
		await db
			.insert(appErrorLogs)
			.values({
				requestId,
				userId: event.locals.user?.id,
				route: event.url.pathname,
				errorCode: appError.code,
				message: appError.message,
				details: {
					status: appError.status,
					privilege: options.privilege,
					resource: auditResource
				}
			})
			.catch((logError) => {
				logger.error({ requestId, err: logError }, 'failed to write app error log');
			});
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
}
