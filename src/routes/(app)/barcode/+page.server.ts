import type { PageServerLoad } from './$types';
import { getUserRoleNames } from '$lib/server/authz/authorize';
import { barcodeService } from '$lib/server/modules/barcode/barcode.service';
import { printerTemplateService } from '$lib/server/modules/printer-templates/printer-template.service';

export const load: PageServerLoad = async ({ locals, url }) => {
	const userId = locals.user!.id;
	const roles = await getUserRoleNames(userId);
	const isAdmin = roles.includes('admin');
	const defaultYear = new Date().getFullYear() % 100;
	const requestedYear = Number(url.searchParams.get('year') ?? defaultYear);
	const year =
		isAdmin && Number.isInteger(requestedYear) && requestedYear >= 0 && requestedYear <= 99
			? requestedYear
			: defaultYear;
	return {
		year,
		isAdmin,
		pecs: await barcodeService.listPrintDashboard({ userId, year }),
		recentPrintRuns: await barcodeService.listBatches(userId),
		templates: await printerTemplateService.list()
	};
};
