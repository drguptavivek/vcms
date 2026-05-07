import type { PageServerLoad } from './$types';
import { userService } from '$lib/server/modules/users/user.service';
import { masterDataService } from '$lib/server/modules/master-data/master-data.service';

export const load: PageServerLoad = async () => ({
	users: await userService.listUsers(),
	roles: await userService.listRoles(),
	pecs: await masterDataService.listPecs()
});
