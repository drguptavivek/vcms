import { describe, expect, it } from 'vitest';
import { barcodeYearBounds, updateBarcodeYearSchema } from './settings.schemas';

describe('settings schemas', () => {
	it('allows barcode year only from current year through current year plus 10', () => {
		expect(
			updateBarcodeYearSchema.parse({ year: barcodeYearBounds.min, reason: 'rollover' })
		).toMatchObject({
			year: barcodeYearBounds.min
		});
		expect(
			updateBarcodeYearSchema.parse({ year: barcodeYearBounds.max, reason: 'rollover' })
		).toMatchObject({
			year: barcodeYearBounds.max
		});
		expect(() =>
			updateBarcodeYearSchema.parse({ year: barcodeYearBounds.min - 1, reason: 'rollover' })
		).toThrow();
		expect(() =>
			updateBarcodeYearSchema.parse({ year: barcodeYearBounds.max + 1, reason: 'rollover' })
		).toThrow();
	});
});
