import { AppError } from '$lib/server/observability/errors';

export const SERIAL_MAX = 999999;

export function normalizeYear(year: number) {
	if (!Number.isInteger(year) || year < 0 || year > 99) {
		throw new AppError('INVALID_BARCODE_YEAR', 'Barcode year must be between 0 and 99.');
	}
	return year;
}

export function formatPecCode(code: number) {
	if (!Number.isInteger(code) || code < 0 || code > 99) {
		throw new AppError('INVALID_PEC_CODE', 'PEC code must be between 0 and 99.');
	}
	return code.toString().padStart(2, '0');
}

export function formatSerial(serial: number) {
	if (!Number.isInteger(serial) || serial < 1 || serial > SERIAL_MAX) {
		throw new AppError('INVALID_SERIAL', 'Serial number must be between 1 and 999999.');
	}
	return serial.toString().padStart(6, '0');
}

export function formatBarcode(input: { pecCode: number; year: number; serial: number }) {
	return `${formatPecCode(input.pecCode)}-${normalizeYear(input.year).toString().padStart(2, '0')}-${formatSerial(input.serial)}`;
}

export function expandBarcodeRange(input: {
	pecCode: number;
	year: number;
	startSerial: number;
	endSerial: number;
}) {
	const values: string[] = [];
	for (let serial = input.startSerial; serial <= input.endSerial; serial += 1) {
		values.push(formatBarcode({ pecCode: input.pecCode, year: input.year, serial }));
	}
	return values;
}
