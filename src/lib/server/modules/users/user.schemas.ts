import { z } from 'zod';

export const assignRoleSchema = z.object({
	userId: z.string().min(1),
	roleName: z.enum(['admin', 'barcode_print_manager'])
});

export const allocatePecSchema = z.object({
	userId: z.string().min(1),
	pecId: z.number().int().positive()
});
