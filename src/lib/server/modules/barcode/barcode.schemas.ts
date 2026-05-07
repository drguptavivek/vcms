import { z } from 'zod';

export const yearSchema = z.number().int().min(0).max(99);
export const serialSchema = z.number().int().min(1).max(999999);

export const createBatchSchema = z.object({
	pecId: z.number().int().positive(),
	year: yearSchema,
	quantity: z.number().int().min(1).max(1000),
	templateId: z.number().int().positive().optional(),
	output: z.enum(['html_pdf', 'zpl', 'epl']).default('html_pdf')
});

export const resetSeriesSchema = z.object({
	pecId: z.number().int().positive(),
	year: yearSchema,
	nextSerial: serialSchema,
	reason: z.string().trim().min(3).max(500)
});

export const reserveOfflineSchema = z
	.object({
		pecId: z.number().int().positive(),
		year: yearSchema,
		startSerial: serialSchema,
		endSerial: serialSchema,
		reason: z.string().trim().min(3).max(500)
	})
	.refine((value) => value.startSerial <= value.endSerial, {
		message: 'Start serial must be less than or equal to end serial.',
		path: ['endSerial']
	});

export const reprintBatchSchema = z.object({
	templateId: z.number().int().positive().optional(),
	output: z.enum(['html_pdf', 'zpl', 'epl']).default('html_pdf'),
	reason: z.string().trim().min(3).max(500)
});

export const reprintSingleBarcodeSchema = reprintBatchSchema.extend({
	serial: serialSchema
});

export const reprintPecRangeSchema = z
	.object({
		pecId: z.number().int().positive(),
		year: yearSchema,
		startSerial: serialSchema,
		endSerial: serialSchema,
		templateId: z.number().int().positive().optional(),
		output: z.enum(['html_pdf', 'zpl', 'epl']).default('html_pdf'),
		reason: z.string().trim().min(3).max(500)
	})
	.refine((value) => value.startSerial <= value.endSerial, {
		message: 'Start serial must be less than or equal to end serial.',
		path: ['endSerial']
	});
