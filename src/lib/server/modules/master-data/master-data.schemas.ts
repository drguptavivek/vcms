import { z } from 'zod';

export const createTeamSchema = z.object({
	code: z.number().int().positive().max(999),
	name: z.string().trim().min(2).max(120)
});

export const createPecSchema = z.object({
	code: z.number().int().min(0).max(99),
	name: z.string().trim().min(2).max(160),
	teamId: z.number().int().positive()
});
