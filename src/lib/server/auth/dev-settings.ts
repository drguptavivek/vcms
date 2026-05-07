import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

export function assertDevLoginAllowed() {
	if (env.DEV_LOGIN_ENABLED !== 'true') return false;
	if (!dev || env.NODE_ENV === 'production') {
		throw new Error('DEV_LOGIN_ENABLED must be false outside local SvelteKit development.');
	}
	if (!env.DEV_ADMIN_EMAIL || !env.DEV_ADMIN_PASSWORD) {
		throw new Error(
			'DEV_ADMIN_EMAIL and DEV_ADMIN_PASSWORD are required when dev login is enabled.'
		);
	}
	if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
		throw new Error('BETTER_AUTH_SECRET must be at least 32 characters when dev login is enabled.');
	}
	return true;
}

export function devAuthSecret() {
	const allowed = assertDevLoginAllowed();
	if (!allowed) throw new Error('Development login is disabled.');
	return env.BETTER_AUTH_SECRET;
}

export function devAdminCredentials() {
	if (!assertDevLoginAllowed()) return undefined;
	return {
		email: env.DEV_ADMIN_EMAIL!,
		password: env.DEV_ADMIN_PASSWORD!
	};
}
