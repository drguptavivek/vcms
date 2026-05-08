import { assets } from '$app/paths';
import { configureQzSecurity } from './qz-security';

const qzScriptUrl = `${assets}/js/qz-tray.js`;

type QzApi = Parameters<typeof configureQzSecurity>[0] & {
	websocket: {
		isActive: () => boolean;
		connect: () => Promise<void>;
	};
	printers: {
		find: (query?: string) => Promise<string[] | string>;
		getDefault: () => Promise<string>;
	};
	configs: {
		create: (printer: string | null, options?: Record<string, unknown>) => unknown;
	};
	print: (
		config: unknown,
		data: Array<{
			type: 'raw';
			format: 'command';
			flavor: 'plain';
			data: string;
		}>
	) => Promise<void>;
};

type BarcodePrinterLanguage = 'zpl' | 'epl';

declare global {
	interface Window {
		qz?: QzApi;
	}
}

let scriptPromise: Promise<QzApi> | null = null;
let securityConfigured = false;

export async function listQzPrinters() {
	const qz = await getQz();
	const printers = await qz.printers.find();
	if (Array.isArray(printers)) return printers;
	return printers ? [printers] : [];
}

export async function getDefaultQzPrinter() {
	const qz = await getQz();
	return qz.printers.getDefault();
}

export async function printRawBarcode(input: {
	printerName: string;
	language: BarcodePrinterLanguage;
	data: string;
	jobName?: string;
}) {
	const qz = await getQz();
	const config = qz.configs.create(input.printerName, {
		jobName: input.jobName ?? `VCMS ${input.language.toUpperCase()} barcode print`,
		forceRaw: true,
		encoding: 'UTF-8'
	});

	await qz.print(config, [
		{
			type: 'raw',
			format: 'command',
			flavor: 'plain',
			data: input.data
		}
	]);
}

async function getQz() {
	const qz = await loadQzScript();
	if (!securityConfigured) {
		configureQzSecurity(qz);
		securityConfigured = true;
	}
	if (!qz.websocket.isActive()) await qz.websocket.connect();
	return qz;
}

async function loadQzScript() {
	if (window.qz) return window.qz;
	scriptPromise ??= new Promise<QzApi>((resolve, reject) => {
		const script = document.createElement('script');
		script.src = qzScriptUrl;
		script.async = true;
		script.onload = () => {
			if (window.qz) resolve(window.qz);
			else reject(new Error('QZ Tray JavaScript did not initialize.'));
		};
		script.onerror = () => reject(new Error('Unable to load QZ Tray JavaScript.'));
		document.head.append(script);
	});
	return scriptPromise;
}
