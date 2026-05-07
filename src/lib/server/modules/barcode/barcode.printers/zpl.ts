import type { PrinterTemplateConfig } from '../barcode.types';

const mmToDots = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

export function renderZpl(barcodes: string[], template: PrinterTemplateConfig) {
	const widthDots = mmToDots(template.widthMm, template.dpi);
	const heightDots = mmToDots(template.heightMm, template.dpi);
	const x = template.layout.barcodeX ?? 40;
	const y = template.layout.barcodeY ?? 24;
	const textY = template.layout.textY ?? y + template.barcodeHeight + 12;

	return barcodes
		.map(
			(value) => `^XA
^PW${widthDots}
^LL${heightDots}
^FO${x},${y}^BCN,${template.barcodeHeight},N,N,N
^FD${value}^FS
^FO${x},${textY}^A0N,28,28^FD${value}^FS
^XZ`
		)
		.join('\n');
}
