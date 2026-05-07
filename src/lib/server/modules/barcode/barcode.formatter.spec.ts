import { describe, expect, it } from 'vitest';
import {
	expandBarcodeRange,
	formatBarcode,
	formatPecCode,
	formatSerial
} from './barcode.formatter';

describe('barcode formatter', () => {
	it('pads PEC code, year, and serial into PP-YY-SSSSSS', () => {
		expect(formatBarcode({ pecCode: 4, year: 6, serial: 1 })).toBe('04-06-000001');
		expect(formatBarcode({ pecCode: 17, year: 26, serial: 123 })).toBe('17-26-000123');
	});

	it('rejects out-of-range PEC and serial values', () => {
		expect(() => formatPecCode(100)).toThrow('PEC code');
		expect(() => formatSerial(0)).toThrow('Serial number');
	});

	it('expands a serial range inclusively', () => {
		expect(expandBarcodeRange({ pecCode: 17, year: 26, startSerial: 1, endSerial: 3 })).toEqual([
			'17-26-000001',
			'17-26-000002',
			'17-26-000003'
		]);
	});
});
