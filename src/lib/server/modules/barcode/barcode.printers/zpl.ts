import type { PrinterTemplateConfig } from '../barcode.types';

const mmToDots = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);
const code128Modules = (value: string) => 35 + value.length * 11;

function barcodeGeometry(value: string, widthDots: number, preferredX?: number) {
	const modules = code128Modules(value);
	const moduleWidth = modules * 2 <= widthDots ? 2 : 1;
	const barcodeWidth = modules * moduleWidth;
	const centeredX = Math.max(0, Math.floor((widthDots - barcodeWidth) / 2));
	return {
		x: preferredX ?? centeredX,
		moduleWidth
	};
}

export function renderZpl(barcodes: string[], template: PrinterTemplateConfig) {
	const widthDots = mmToDots(template.widthMm, template.dpi);
	const heightDots = mmToDots(template.heightMm, template.dpi);
	const y = template.layout.barcodeY ?? 24;
	const textY = template.layout.textY ?? y + template.barcodeHeight + 12;

	return barcodes
		.map(
			(value) => {
				const { x, moduleWidth } = barcodeGeometry(value, widthDots, template.layout.barcodeX);
				return [
					'^XA',
					'^CI28',
					`^PW${widthDots}`,
					`^LL${heightDots}`,
					`^BY${moduleWidth},2,80`,
					`^FO${x},${y}^BCN,${template.barcodeHeight},N,N,N`,
					`^FD${value}^FS`,
					`^FO${x},${textY}^A0N,28,28^FD${value}^FS`,
					'^XZ'
				].join('\r\n');
			}
		)
		.join('\r\n');
}
