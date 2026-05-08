import { z } from 'zod';
import { patientBarcodeSchema } from '../patients/patient.schemas';

export const encounterStatusSchema = z.enum(['active', 'completed', 'cancelled']);

const datetimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/;

export const encounterCreateSchema = z
	.object({
		patientId: z.string().uuid().optional(),
		patientBarcode: patientBarcodeSchema.optional(),
		pecId: z.number().int().positive(),
		barcodeSnapshot: patientBarcodeSchema.optional(),
		status: encounterStatusSchema.default('active'),
		occurredAt: z.string().trim().regex(datetimePattern).optional()
	})
	.superRefine((value, context) => {
		if (!value.patientId && !value.patientBarcode) {
			context.addIssue({
				code: 'custom',
				path: ['patientId'],
				message: 'Either patientId or patientBarcode is required.'
			});
		}
		if (value.patientId && value.patientBarcode) {
			context.addIssue({
				code: 'custom',
				path: ['patientId'],
				message: 'Provide either patientId or patientBarcode, not both.'
			});
		}
	});

export const encounterListQuerySchema = z
	.object({
		patientId: z.string().uuid().optional(),
		patientBarcode: patientBarcodeSchema.optional()
	})
	.superRefine((value, context) => {
		if (!value.patientId && !value.patientBarcode) {
			context.addIssue({
				code: 'custom',
				path: ['patientId'],
				message: 'Either patientId or patientBarcode is required.'
			});
		}
		if (value.patientId && value.patientBarcode) {
			context.addIssue({
				code: 'custom',
				path: ['patientId'],
				message: 'Provide either patientId or patientBarcode, not both.'
			});
		}
	});

export type EncounterCreateInput = z.infer<typeof encounterCreateSchema>;
export type EncounterListQuery = z.infer<typeof encounterListQuerySchema>;
