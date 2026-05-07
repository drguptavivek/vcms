import type { Handle } from '@sveltejs/kit';
import { building } from '$app/environment';
import { auth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { randomUUID } from 'node:crypto';
import { logger } from '$lib/server/observability/logger';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { assertDevLoginAllowed } from '$lib/server/auth/dev-settings';
import { verifyDevUserCookie } from '$lib/server/auth/dev-session';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	event.locals.requestId = randomUUID();
	event.locals.clientIp = event.getClientAddress();

	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	if (!event.locals.user && assertDevLoginAllowed()) {
		const devUserId = verifyDevUserCookie(event.cookies.get('vcms_dev_user_id'));
		if (devUserId) {
			const [devUser] = await db.select().from(user).where(eq(user.id, devUserId)).limit(1);
			if (devUser) event.locals.user = devUser;
		}
	}

	const startedAt = Date.now();
	const response = await svelteKitHandler({ event, resolve, auth, building });
	response.headers.set('x-request-id', event.locals.requestId);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	response.headers.set('x-frame-options', 'DENY');
	logger.info(
		{
			requestId: event.locals.requestId,
			method: event.request.method,
			path: event.url.pathname,
			status: response.status,
			durationMs: Date.now() - startedAt,
			userId: event.locals.user?.id
		},
		'request completed'
	);
	return response;
};

export const handle: Handle = handleBetterAuth;
