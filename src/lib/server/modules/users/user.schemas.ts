import { z } from 'zod';

export const assignRoleSchema = z.object({
	userId: z.string().min(1),
	roleName: z.enum(['admin', 'barcode_print_manager'])
});

export const allocatePecSchema = z.object({
	userId: z.string().min(1),
	pecId: z.number().int().positive()
});

export const browserPrintProfileSchema = z.enum(['a4', 'a5']);
export const defaultBarcodeOutputSchema = z.enum(['html_pdf', 'zpl', 'epl']);

export const printPreferenceTargetSchema = z.object({
	printer: z.string().trim().max(200).default(''),
	templateId: z.string().trim().max(20).default('')
});

export const userPrintPreferencesSchema = z.object({
	defaultOutput: defaultBarcodeOutputSchema.default('html_pdf'),
	zpl: printPreferenceTargetSchema.default({ printer: '', templateId: '' }),
	epl: printPreferenceTargetSchema.default({ printer: '', templateId: '' }),
	browserPrint: z
		.object({
			profile: browserPrintProfileSchema.default('a4')
		})
		.default({ profile: 'a4' })
});

export const updateUserPrintPreferencesSchema = z.object({
	printPreferences: userPrintPreferencesSchema
});

export type UserPrintPreferences = z.infer<typeof userPrintPreferencesSchema>;
