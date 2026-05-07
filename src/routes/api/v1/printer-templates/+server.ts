import type { RequestHandler } from './$types';
import { withApiHandler } from '$lib/server/api/handler';
import { rateLimitPolicies } from '$lib/server/api/rate-limit';
import { createPrinterTemplateSchema } from '$lib/server/modules/printer-templates/printer-template.schemas';
import { printerTemplateService } from '$lib/server/modules/printer-templates/printer-template.service';

export const GET: RequestHandler = (event) =>
	withApiHandler(event, {
		privilege: 'printer_template.manage',
		rateLimit: rateLimitPolicies.read,
		handler: () => printerTemplateService.list()
	});

export const POST: RequestHandler = (event) =>
	withApiHandler(event, {
		schema: createPrinterTemplateSchema,
		privilege: 'printer_template.manage',
		rateLimit: rateLimitPolicies.mutation,
		handler: ({ body, userId, requestId }) =>
			printerTemplateService.create({ ...body, userId, requestId })
	});
