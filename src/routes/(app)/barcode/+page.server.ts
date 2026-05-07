import type { PageServerLoad } from './$types';
import { masterDataService } from '$lib/server/modules/master-data/master-data.service';
import { printerTemplateService } from '$lib/server/modules/printer-templates/printer-template.service';

export const load: PageServerLoad = async () => ({
	pecs: await masterDataService.listPecs(),
	templates: await printerTemplateService.list()
});
