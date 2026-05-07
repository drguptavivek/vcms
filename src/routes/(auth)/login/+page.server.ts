import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { APIError } from 'better-auth/api';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { devAdminCredentials } from '$lib/server/auth/dev-settings';
import { signDevUserId } from '$lib/server/auth/dev-session';
import { enforceRateLimit, rateLimitPolicies } from '$lib/server/api/rate-limit';
import { isAppError } from '$lib/server/observability/errors';

export const load: PageServerLoad = (event) => {
	if (event.locals.user) redirect(302, '/dashboard');
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const devCredentials = devAdminCredentials();
		try {
			enforceRateLimit(
				rateLimitPolicies.auth,
				`${event.getClientAddress()}:${email.toLowerCase()}`
			);

			if (
				devCredentials &&
				email === devCredentials.email &&
				password === devCredentials.password
			) {
				const [devUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);
				if (devUser) {
					event.cookies.set('vcms_dev_user_id', signDevUserId(devUser.id), {
						path: '/',
						httpOnly: true,
						sameSite: 'lax',
						secure: false,
						maxAge: 60 * 60 * 8
					});
					redirect(302, '/dashboard');
				}
			}

			await auth.api.signInEmail({
				body: { email, password, callbackURL: '/dashboard' },
				headers: event.request.headers
			});
		} catch (error) {
			if (isAppError(error)) return fail(error.status, { message: error.message });
			if (error instanceof APIError) return fail(400, { message: error.message });
			return fail(500, { message: 'Unexpected login error.' });
		}

		redirect(302, '/dashboard');
	}
};
