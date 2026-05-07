import type { PageServerLoad } from './$types';
import { printerTemplateService } from '$lib/server/modules/printer-templates/printer-template.service';

export const load: PageServerLoad = async () => ({
	templates: await printerTemplateService.list()
});
