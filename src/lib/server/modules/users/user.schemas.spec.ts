import { describe, expect, it } from 'vitest';
import { userPrintPreferencesSchema } from './user.schemas';

describe('user profile schemas', () => {
	it('normalizes missing print preferences to safe defaults', () => {
		expect(userPrintPreferencesSchema.parse({})).toEqual({
			defaultOutput: 'html_pdf',
			zpl: { printer: '', templateId: '' },
			epl: { printer: '', templateId: '' },
			browserPrint: { profile: 'a4' }
		});
	});

	it('keeps workstation printer and template favourites', () => {
		expect(
			userPrintPreferencesSchema.parse({
				defaultOutput: 'zpl',
				zpl: { printer: 'Barcode ZPL Queue', templateId: '12' },
				epl: { printer: 'Barcode EPL Queue', templateId: '13' },
				browserPrint: { profile: 'a5' }
			})
		).toEqual({
			defaultOutput: 'zpl',
			zpl: { printer: 'Barcode ZPL Queue', templateId: '12' },
			epl: { printer: 'Barcode EPL Queue', templateId: '13' },
			browserPrint: { profile: 'a5' }
		});
	});
});
