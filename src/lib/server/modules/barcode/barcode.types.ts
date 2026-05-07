export type PrinterTemplateConfig = {
	id?: number;
	name: string;
	type: 'html_pdf' | 'zpl' | 'epl';
	widthMm: number;
	heightMm: number;
	dpi: number;
	barcodeHeight: number;
	layout: {
		barcodeX?: number;
		barcodeY?: number;
		textX?: number;
		textY?: number;
		textSize?: number;
	};
};

export type PrintPayload = {
	output: 'html_pdf' | 'zpl' | 'epl';
	content: string | Array<{ value: string; svg: string }>;
};
