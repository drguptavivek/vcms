import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUserRoleNames } from '$lib/server/authz/authorize';

export const load: LayoutServerLoad = async (event) => {
	if (!event.locals.user) redirect(302, '/login');
	const roles = await getUserRoleNames(event.locals.user.id);
	return {
		isAdmin: roles.includes('admin'),
		user: {
			id: event.locals.user.id,
			name: event.locals.user.name,
			email: event.locals.user.email
		}
	};
};
