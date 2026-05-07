import bwipjs from 'bwip-js';

export function renderSvgLabels(barcodes: string[]) {
	return barcodes.map((value) => ({
		value,
		svg: bwipjs.toSVG({
			bcid: 'code128',
			text: value,
			scale: 2,
			height: 14,
			includetext: true,
			textxalign: 'center'
		})
	}));
}
