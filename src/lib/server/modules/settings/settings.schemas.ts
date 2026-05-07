import { z } from 'zod';

const currentBarcodeYear = new Date().getFullYear() % 100;
const maxBarcodeYear = Math.min(99, currentBarcodeYear + 10);

export const updateBarcodeYearSchema = z.object({
	year: z.number().int().min(currentBarcodeYear).max(maxBarcodeYear),
	reason: z.string().trim().min(3).max(500)
});

export const barcodeYearBounds = {
	min: currentBarcodeYear,
	max: maxBarcodeYear
} as const;
