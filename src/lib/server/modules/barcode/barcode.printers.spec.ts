import { describe, expect, it } from 'vitest';
import { renderEpl } from './barcode.printers/epl';
import { renderZpl } from './barcode.printers/zpl';
import type { PrinterTemplateConfig } from './barcode.types';

const template: PrinterTemplateConfig = {
	name: 'Test',
	type: 'zpl',
	widthMm: 50,
	heightMm: 25,
	dpi: 203,
	barcodeHeight: 80,
	layout: { barcodeX: 40, barcodeY: 24, textY: 120 }
};

describe('printer language renderers', () => {
	it('renders ZPL with barcode and human-readable text', () => {
		const zpl = renderZpl(['17-26-000001'], template);
		expect(zpl).toContain('^BCN,80');
		expect(zpl).toContain('^FD17-26-000001^FS');
		expect(zpl).toContain('^A0N');
	});

	it('renders EPL with barcode and human-readable text', () => {
		const epl = renderEpl(['17-26-000001'], template);
		expect(epl).toContain('B40,24');
		expect(epl).toContain('"17-26-000001"');
		expect(epl).toContain('A40,120');
	});
});
