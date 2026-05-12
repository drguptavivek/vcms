import { createHash } from 'node:crypto';
import { z } from 'zod';

const templateIdSchema = z.string().trim().min(1).max(300);

export const openEhrTemplateListQuerySchema = z.object({
	status: z.enum(['uploaded', 'active', 'retired']).optional()
});

export const openEhrTemplateIdentitySchema = z.object({
	templateId: templateIdSchema
});

export const openEhrTemplateUploadSchema = z.object({
	operationalTemplateXml: z.string().trim().min(1)
});

export const openEhrTemplateSyncSchema = z.object({
	templateId: templateIdSchema,
	operationalTemplateXml: z.string().trim().min(1).optional(),
	userId: z.string().trim().min(1).optional()
});

export type OpenEhrTemplateListQuery = z.infer<typeof openEhrTemplateListQuerySchema>;
export type OpenEhrTemplateIdentity = z.infer<typeof openEhrTemplateIdentitySchema>;
export type OpenEhrTemplateUploadInput = z.infer<typeof openEhrTemplateUploadSchema>;
export type OpenEhrTemplateSyncInput = z.infer<typeof openEhrTemplateSyncSchema>;

const canonicalJsonify = (value: unknown): unknown => {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((entry) => canonicalJsonify(entry));
	}

	if (typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.filter(([, entry]) => entry !== undefined)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, canonicalJsonify(entry)])
		);
	}

	throw new Error('Unsupported value in openEHR template hash input.');
};

export function computeOpenEhrTemplateHash(input: string) {
	return createHash('sha256').update(input).digest('hex');
}

export function computeOpenEhrWebTemplateHash(input: unknown) {
	return createHash('sha256')
		.update(JSON.stringify(canonicalJsonify(input)))
		.digest('hex');
}

export function parseOpenEhrTemplateSync(input: unknown): OpenEhrTemplateSyncInput {
	return openEhrTemplateSyncSchema.parse(input);
}
