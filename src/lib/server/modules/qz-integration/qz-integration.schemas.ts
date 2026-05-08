import { z } from 'zod';

export const qzSignRequestSchema = z.object({
	toSign: z.string().min(1).max(20_000)
});

export const saveQzCredentialsSchema = z.object({
	rootCaCertificatePem: z.string().trim().max(50_000).optional().default(''),
	rootCaPrivateKeyPem: z.string().trim().max(50_000).optional().default(''),
	certificatePem: z.string().trim().min(1).max(50_000),
	privateKeyPem: z.string().trim().min(1).max(50_000),
	privateKeyPassphrase: z.string().max(500).optional().default(''),
	reason: z.string().trim().min(3).max(500)
});

export const generateQzCredentialsSchema = z.object({
	reason: z.string().trim().min(3).max(500).default('Generate QZ Tray signing credentials')
});
