import { z } from 'zod';
import { patientBarcodeSchema, patientDemographicsSchema } from '../patients/patient.schemas';

const optionalTextSchema = z.string().trim().max(2000).optional();
const notePayloadSchema = z.record(z.string(), z.unknown()).default({});
const pathwaySchema = z.object({
	pathwayType: z.string().trim().min(1).max(120).default('pec_opd'),
	branchSource: z.string().trim().min(1).max(120).default('pec_opd'),
	definitionVersion: z.string().trim().max(120).optional(),
	answers: z.record(z.string(), z.unknown()).default({})
});
const submissionSourceSchema = z.object({
	submitterRole: z.string().trim().max(120).optional(),
	clientVersion: z.string().trim().max(120).optional(),
	userAgentHint: z.string().trim().max(255).optional()
});

export const submitPecOpdNoteSchema = z.object({
	pecId: z.number().int().positive(),
	barcode: patientBarcodeSchema,
	patient: patientDemographicsSchema,
	encounter: z
		.object({
			occurredAt: z
				.string()
				.trim()
				.regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/)
				.optional()
		})
		.default({}),
	note: z
		.object({
			chiefComplaint: optionalTextSchema,
			visualAcuity: z.record(z.string(), z.unknown()).optional(),
			diagnosis: optionalTextSchema,
			plan: optionalTextSchema,
			payload: notePayloadSchema
		})
		.default({ payload: {} }),
	pathway: pathwaySchema,
	submissionSource: submissionSourceSchema.optional()
});

export type SubmitPecOpdNoteInput = z.infer<typeof submitPecOpdNoteSchema>;
