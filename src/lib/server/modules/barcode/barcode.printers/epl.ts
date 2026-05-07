import type { PrinterTemplateConfig } from '../barcode.types';

const mmToDots = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

export function renderEpl(barcodes: string[], template: PrinterTemplateConfig) {
	const widthDots = mmToDots(template.widthMm, template.dpi);
	const heightDots = mmToDots(template.heightMm, template.dpi);
	const x = template.layout.barcodeX ?? 40;
	const y = template.layout.barcodeY ?? 24;
	const textY = template.layout.textY ?? y + template.barcodeHeight + 12;

	return barcodes
		.map(
			(value) => `N
q${widthDots}
Q${heightDots},24
B${x},${y},0,1,2,2,${template.barcodeHeight},N,"${value}"
A${x},${textY},0,3,1,1,N,"${value}"
P1`
		)
		.join('\n');
}
