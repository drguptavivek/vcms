import { z } from 'zod';

export const patientSexSchema = z.enum(['female', 'male', 'other', 'unknown']).default('unknown');

export const patientBarcodeSchema = z
	.string()
	.trim()
	.min(1)
	.max(64)
	.regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, 'Barcode contains unsupported characters.');

export const patientDemographicsSchema = z.object({
	fullName: z.string().trim().min(1).max(200),
	sex: patientSexSchema,
	dateOfBirth: z
		.string()
		.trim()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	ageYears: z.number().int().min(0).max(130).optional(),
	phone: z.string().trim().max(40).optional(),
	address: z.string().trim().max(500).optional()
});

export const patientCreateSchema = z.object({
	barcode: patientBarcodeSchema,
	primaryPecId: z.number().int().positive(),
	fullName: z.string().trim().min(1).max(200),
	sex: patientSexSchema,
	dateOfBirth: z
		.string()
		.trim()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	ageYears: z.number().int().min(0).max(130).optional(),
	phone: z.string().trim().max(40).optional(),
	address: z.string().trim().max(500).optional()
});

export const patientLookupSchema = z.object({
	barcode: patientBarcodeSchema
});
