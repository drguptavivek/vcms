import type { PageServerLoad } from './$types';
import { masterDataService } from '$lib/server/modules/master-data/master-data.service';

export const load: PageServerLoad = async () => ({ pecs: await masterDataService.listPecs() });
