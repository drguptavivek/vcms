declare module 'bwip-js' {
	type SvgOptions = {
		bcid: string;
		text: string;
		scale?: number;
		height?: number;
		includetext?: boolean;
		textxalign?: string;
	};

	const bwipjs: {
		toSVG(options: SvgOptions): string;
	};

	export default bwipjs;
}
