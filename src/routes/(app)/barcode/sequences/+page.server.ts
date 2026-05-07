import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserRoleNames } from '$lib/server/authz/authorize';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';
import { barcodeYearBounds } from '$lib/server/modules/settings/settings.schemas';
import { settingsService } from '$lib/server/modules/settings/settings.service';
import { masterDataService } from '$lib/server/modules/master-data/master-data.service';

export const load: PageServerLoad = async ({ locals }) => {
	const roles = await getUserRoleNames(locals.user!.id);
	if (!roles.includes('admin')) error(403, 'Admin access required.');

	return {
		currentYear: await settingsService.getBarcodeYear(),
		yearBounds: barcodeYearBounds,
		series: await barcodeService.listSeries(locals.user!.id),
		pecs: await masterDataService.listPecs()
	};
};
