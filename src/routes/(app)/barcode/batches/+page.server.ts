import type { PageServerLoad } from './$types';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';
import { printerTemplateService } from '$lib/server/modules/printer-templates/printer-template.service';

export const load: PageServerLoad = async () => ({
	batches: await barcodeService.listBatches(),
	templates: await printerTemplateService.list()
});
