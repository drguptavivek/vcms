import type { PageServerLoad } from './$types';
import { masterDataService } from '$lib/server/modules/master-data/master-data.service';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';

export const load: PageServerLoad = async ({ locals }) => ({
	teams: await masterDataService.listTeams(),
	pecs: await masterDataService.listPecs(),
	series: await barcodeService.listSeries(locals.user!.id),
	batches: await barcodeService.listBatches()
});
