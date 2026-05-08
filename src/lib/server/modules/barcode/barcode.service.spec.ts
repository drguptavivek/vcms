import { describe, expect, it } from 'vitest';
import { AppError } from '$lib/server/observability/errors';
import { getPrintableSourceBatchId } from './barcode.service';

describe('barcode service helpers', () => {
	it('uses the original source batch when reprinting a reprint batch', () => {
		expect(
			getPrintableSourceBatchId({
				id: 'reprint-batch',
				type: 'reprint',
				sourceBatchId: 'original-batch'
			})
		).toBe('original-batch');
	});

	it('rejects malformed reprint batches without raw printable source', () => {
		expect(() =>
			getPrintableSourceBatchId({
				id: 'reprint-batch',
				type: 'reprint',
				sourceBatchId: null
			})
		).toThrow(AppError);
	});
});
