import type { PageServerLoad } from './$types';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';
import { masterDataService } from '$lib/server/modules/master-data/master-data.service';

export const load: PageServerLoad = async ({ locals }) => ({
	series: await barcodeService.listSeries(locals.user!.id),
	pecs: await masterDataService.listPecs()
});
