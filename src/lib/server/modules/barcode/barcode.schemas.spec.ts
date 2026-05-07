import { describe, expect, it } from 'vitest';
import {
	createBatchSchema,
	reprintPecRangeSchema,
	reprintSingleBarcodeSchema,
	reserveOfflineSchema,
	resetSeriesSchema
} from './barcode.schemas';

describe('barcode validation schemas', () => {
	it('accepts valid print batch requests', () => {
		expect(
			createBatchSchema.parse({ pecId: 1, year: 26, quantity: 100, output: 'zpl' })
		).toMatchObject({ pecId: 1, year: 26, quantity: 100, output: 'zpl' });
	});

	it('limits print quantity to 1000', () => {
		expect(() => createBatchSchema.parse({ pecId: 1, year: 26, quantity: 1001 })).toThrow();
	});

	it('requires reasons for manual reset and offline reserve', () => {
		expect(() =>
			resetSeriesSchema.parse({ pecId: 1, year: 26, nextSerial: 1, reason: 'ok' })
		).toThrow();
		expect(() =>
			reserveOfflineSchema.parse({
				pecId: 1,
				year: 26,
				startSerial: 10,
				endSerial: 9,
				reason: 'Offline issue'
			})
		).toThrow();
	});

	it('validates single barcode reprint requests', () => {
		expect(
			reprintSingleBarcodeSchema.parse({
				serial: 42,
				output: 'html_pdf',
				reason: 'damaged sticker'
			})
		).toMatchObject({ serial: 42 });
	});

	it('validates PEC range reprint requests', () => {
		expect(
			reprintPecRangeSchema.parse({
				pecId: 1,
				year: 26,
				startSerial: 10,
				endSerial: 12,
				output: 'zpl',
				reason: 'print three damaged stickers'
			})
		).toMatchObject({ startSerial: 10, endSerial: 12 });
	});
});
