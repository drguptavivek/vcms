import type { PageServerLoad } from './$types';
import { getUserRoleNames } from '$lib/server/authz/authorize';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';
import { settingsService } from '$lib/server/modules/settings/settings.service';
import { printerTemplateService } from '$lib/server/modules/printer-templates/printer-template.service';
import { userService } from '$lib/server/modules/users/user.service';

export const load: PageServerLoad = async ({ locals }) => {
	const userId = locals.user!.id;
	const roles = await getUserRoleNames(userId);
	const isAdmin = roles.includes('admin');
	const year = await settingsService.getBarcodeYear();
	return {
		year,
		isAdmin,
		pecs: await barcodeService.listPrintDashboard({ userId, year }),
		recentPrintRuns: await barcodeService.listBatches(userId),
		templates: await printerTemplateService.list(),
		printPreferences: await userService.getPrintPreferences(userId)
	};
};
