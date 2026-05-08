import { z } from 'zod';
import { patientBarcodeSchema } from '../patients/patient.schemas';

const jsonRecordSchema = z.record(z.string(), z.unknown()).default({});

export const carePathwayStatusSchema = z.enum(['active', 'completed', 'cancelled']);

export const carePathwayCreateSchema = z.object({
	patientId: z.string().uuid(),
	encounterId: z.string().uuid(),
	pathwayType: z.string().trim().min(1).max(120),
	parentCarePathwayId: z.string().uuid().optional(),
	startedFromEncounterId: z.string().uuid().optional(),
	status: carePathwayStatusSchema.default('active'),
	context: jsonRecordSchema
});

export const carePathwayListQuerySchema = z.object({
	patientId: z.string().uuid().optional(),
	patientBarcode: patientBarcodeSchema.optional()
}).superRefine((value, context) => {
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

export type CarePathwayCreateInput = z.infer<typeof carePathwayCreateSchema>;
export type CarePathwayListQuery = z.infer<typeof carePathwayListQuerySchema>;
