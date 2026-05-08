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

const clientMetadataSchema = z.object({
	clientName: z.string().trim().max(120).optional(),
	clientVersion: z.string().trim().max(120).optional(),
	platform: z.string().trim().max(120).optional(),
	platformVersion: z.string().trim().max(120).optional(),
	deviceId: z.string().trim().max(120).optional(),
	deviceModel: z.string().trim().max(120).optional(),
	networkType: z.string().trim().max(120).optional(),
	batteryState: z.string().trim().max(120).optional(),
	sessionId: z.string().trim().max(120).optional()
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

export const submitPecOpdMobileNoteSchema = submitPecOpdNoteSchema.extend({
	idempotencyKey: z.string().trim().min(8).max(255),
	definitionVersion: z.string().trim().max(120).optional(),
	definitionHash: z.string().trim().max(255).optional(),
	clientMetadata: clientMetadataSchema.optional(),
	deviceMetadata: clientMetadataSchema.optional()
});

export type SubmitPecOpdNoteInput = z.infer<typeof submitPecOpdNoteSchema>;
export type SubmitPecOpdMobileNoteInput = z.infer<typeof submitPecOpdMobileNoteSchema>;
