import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserRoleNames } from '$lib/server/authz/authorize';
import { qzIntegrationService } from '$lib/server/modules/qz-integration/qz-integration.service';

export const load: PageServerLoad = async (event) => {
	const roles = await getUserRoleNames(event.locals.user!.id);
	if (!roles.includes('admin')) error(403, 'Admin access required.');

	return {
		status: await qzIntegrationService.getStatus(),
		credentials: await qzIntegrationService.getCurrentPublicCertificates()
	};
};
