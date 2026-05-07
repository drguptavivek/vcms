import { z } from 'zod';

export const createPrinterTemplateSchema = z.object({
	name: z.string().trim().min(2).max(120),
	type: z.enum(['html_pdf', 'zpl', 'epl']),
	widthMm: z.number().int().min(10).max(300),
	heightMm: z.number().int().min(10).max(300),
	dpi: z.number().int().min(100).max(600).default(203),
	barcodeHeight: z.number().int().min(20).max(400).default(80),
	layout: z
		.object({
			barcodeX: z.number().int().min(0).optional(),
			barcodeY: z.number().int().min(0).optional(),
			textX: z.number().int().min(0).optional(),
			textY: z.number().int().min(0).optional(),
			textSize: z.number().int().min(8).max(80).optional()
		})
		.default({})
});
