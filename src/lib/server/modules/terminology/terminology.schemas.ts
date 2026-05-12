import { z } from 'zod';

const optionalBooleanQuerySchema = z
	.enum(['true', 'false'])
	.optional()
	.transform((value) => (value === undefined ? undefined : value === 'true'));

export const snomedConceptIdSchema = z.string().trim().min(3).max(18).regex(/^\d+$/);

export const terminologySearchQuerySchema = z.object({
	q: z.string().trim().min(2).max(120),
	limit: z.coerce.number().int().min(1).max(25).default(10),
	semanticTag: z.string().trim().min(1).max(80).optional(),
	active: optionalBooleanQuerySchema
});

export const terminologyLookupQuerySchema = z.object({
	conceptId: snomedConceptIdSchema
});

export const snomedConceptSchema = z.object({
	terminologySystem: z.literal('SNOMED_CT'),
	conceptId: snomedConceptIdSchema,
	preferredTerm: z.string().trim().min(1).max(300),
	fullySpecifiedName: z.string().trim().min(1).max(500).optional(),
	semanticTag: z.string().trim().min(1).max(80).optional(),
	active: z.boolean(),
	moduleId: z.string().trim().min(1).max(40).optional(),
	effectiveTime: z.string().trim().min(4).max(20).optional(),
	edition: z.string().trim().min(1).max(120).optional(),
	version: z.string().trim().min(1).max(80).optional(),
	languageRefset: z.string().trim().min(1).max(40).optional(),
	sourceService: z.enum(['mock', 'snowstorm', 'csnoserv'])
});

export const terminologySearchResultSchema = z.object({
	provider: z.enum(['mock', 'snowstorm', 'csnoserv']),
	edition: z.string().trim().min(1).max(120).optional(),
	version: z.string().trim().min(1).max(80).optional(),
	browserUrl: z.string().url().optional(),
	results: z.array(snomedConceptSchema).max(25)
});

export const terminologyLookupResultSchema = z.object({
	provider: z.enum(['mock', 'snowstorm', 'csnoserv']),
	edition: z.string().trim().min(1).max(120).optional(),
	version: z.string().trim().min(1).max(80).optional(),
	browserUrl: z.string().url().optional(),
	concept: snomedConceptSchema
});

export const terminologyProviderHealthSchema = z.object({
	provider: z.enum(['mock', 'snowstorm', 'csnoserv']),
	available: z.boolean(),
	edition: z.string().trim().min(1).max(120).optional(),
	version: z.string().trim().min(1).max(80).optional(),
	browserUrl: z.string().url().optional(),
	message: z.string().trim().min(1).max(300).optional()
});
