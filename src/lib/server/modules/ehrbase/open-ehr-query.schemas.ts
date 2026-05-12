import { z } from 'zod';

const queryIdSchema = z
	.string()
	.trim()
	.min(1)
	.max(120)
	.regex(/^[a-z][a-z0-9_.-]*$/);

export const openEhrAqlExecuteSchema = z.object({
	queryId: queryIdSchema,
	parameters: z.record(z.string(), z.unknown()).optional().default({}),
	offset: z.number().int().min(0).max(100_000).optional(),
	fetch: z.number().int().min(1).max(500).optional()
});

export type OpenEhrAqlExecuteBody = z.infer<typeof openEhrAqlExecuteSchema>;
