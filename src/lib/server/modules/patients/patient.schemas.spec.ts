import { describe, expect, it } from 'vitest';
import { patientBarcodeSchema, patientDemographicsSchema } from './patient.schemas';

describe('patient runtime schemas', () => {
	it('accepts printed VCMS barcode values after trimming scanner input', () => {
		expect(patientBarcodeSchema.parse(' 01-26-000001 ')).toBe('01-26-000001');
		expect(patientBarcodeSchema.parse('99/26/123456')).toBe('99/26/123456');
	});

	it('normalizes common scanner control characters before uniqueness checks', () => {
		expect(patientBarcodeSchema.parse('\n\t01-26-000001\r')).toBe('01-26-000001');
	});

	it('rejects blank or unsupported barcode values before uniqueness lookup', () => {
		expect(() => patientBarcodeSchema.parse('   ')).toThrow();
		expect(() => patientBarcodeSchema.parse('01 26 000001')).toThrow();
		expect(() => patientBarcodeSchema.parse('#01-26-000001')).toThrow();
	});

	it('rejects barcode strings that cannot be persisted as stable scanner keys', () => {
		expect(() => patientBarcodeSchema.parse('  01  26  000001 ')).toThrow();
		expect(() => patientBarcodeSchema.parse('01!26/000001')).toThrow();
	});

	it('normalizes demographics while preserving optional runtime fields', () => {
		expect(
			patientDemographicsSchema.parse({
				fullName: '  Asha Devi  ',
				ageYears: 52,
				phone: '  9876543210  ',
				address: '  Block A  '
			})
		).toEqual({
			fullName: 'Asha Devi',
			sex: 'unknown',
			ageYears: 52,
			phone: '9876543210',
			address: 'Block A'
		});
	});

	it('rejects impossible patient ages', () => {
		expect(() =>
			patientDemographicsSchema.parse({ fullName: 'Asha Devi', ageYears: 131 })
		).toThrow();
	});
});
