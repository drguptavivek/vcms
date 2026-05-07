import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { barcodeBatches, barcodeRanges, barcodeSeries, pecs } from '$lib/server/db/schema';
import { getUserRoleNames } from '$lib/server/authz/authorize';
import { conflict, notFound } from '$lib/server/observability/errors';
import { writeAudit } from '$lib/server/observability/audit';
import { masterDataService } from '$lib/server/modules/master-data/master-data.service';
import { expandBarcodeRange, SERIAL_MAX } from './barcode.formatter';
import { BarcodeRepository } from './barcode.repository';
import { renderEpl } from './barcode.printers/epl';
import { renderSvgLabels } from './barcode.printers/svg';
import { renderZpl } from './barcode.printers/zpl';
import type { PrintPayload, PrinterTemplateConfig } from './barcode.types';

const defaultTemplate: PrinterTemplateConfig = {
	name: 'Default 50x25mm',
	type: 'html_pdf',
	widthMm: 50,
	heightMm: 25,
	dpi: 203,
	barcodeHeight: 80,
	layout: {}
};

export class BarcodeService {
	constructor(private readonly repository = new BarcodeRepository()) {}

	async listPrintDashboard(input: { userId: string; year: number }) {
		const [pecRows, seriesRows, batchRows] = await Promise.all([
			masterDataService.listPecs(input.userId),
			this.listSeries(input.userId),
			this.listBatches(input.userId)
		]);
		const seriesByPec = new Map(
			seriesRows
				.filter((series) => series.year === input.year)
				.map((series) => [series.pecId, series])
		);
		const batchesByPec = new Map<number, number>();
		const skipHistoryByPec = new Map<
			number,
			Array<{
				id: string;
				startSerial: number | null;
				endSerial: number | null;
				quantity: number;
				reason: string;
				createdAt: Date;
			}>
		>();
		for (const batch of batchRows) {
			if (batch.year !== input.year) continue;
			if (batch.type === 'print')
				batchesByPec.set(batch.pecId, (batchesByPec.get(batch.pecId) ?? 0) + 1);
			if (batch.type === 'offline_reserve') {
				const existing = skipHistoryByPec.get(batch.pecId) ?? [];
				existing.push({
					id: batch.id,
					startSerial: batch.startSerial,
					endSerial: batch.endSerial,
					quantity: batch.quantity,
					reason: batch.reason,
					createdAt: batch.createdAt
				});
				skipHistoryByPec.set(batch.pecId, existing);
			}
		}
		return pecRows.map((pec) => {
			const series = seriesByPec.get(pec.id);
			const nextSerial = series?.nextSerial ?? 1;
			return {
				...pec,
				year: input.year,
				nextSerial,
				lastGeneratedSerial: Math.max(0, nextSerial - 1),
				locked: series?.locked ?? false,
				printBatchCount: batchesByPec.get(pec.id) ?? 0,
				codeSkipHistory: skipHistoryByPec.get(pec.id) ?? []
			};
		});
	}

	async listSeries(userId: string) {
		const roles = await getUserRoleNames(userId);
		if (roles.includes('admin')) return this.repository.listSeries();
		const rows = await db.query.userPecAllocations.findMany({
			where: (allocation, { and, eq }) =>
				and(eq(allocation.userId, userId), eq(allocation.active, true)),
			columns: { pecId: true }
		});
		return this.repository.listSeries(rows.map((row) => row.pecId));
	}

	async listBatches(userId?: string) {
		const attachRanges = async (rows: Awaited<ReturnType<BarcodeRepository['listBatches']>>) =>
			Promise.all(
				rows.map(async (row) => {
					const rangeSourceBatchId =
						row.type === 'reprint' && row.sourceBatchId ? row.sourceBatchId : row.id;
					const ranges = await this.repository.getRangesForBatch(rangeSourceBatchId);
					return {
						...row,
						startSerial: ranges.length
							? Math.min(...ranges.map((range) => range.startSerial))
							: null,
						endSerial: ranges.length ? Math.max(...ranges.map((range) => range.endSerial)) : null
					};
				})
			);
		if (!userId) return attachRanges(await this.repository.listBatches());
		const roles = await getUserRoleNames(userId);
		if (roles.includes('admin')) return attachRanges(await this.repository.listBatches());
		const rows = await db.query.userPecAllocations.findMany({
			where: (allocation, { and, eq }) =>
				and(eq(allocation.userId, userId), eq(allocation.active, true)),
			columns: { pecId: true }
		});
		return attachRanges(
			await this.repository.listBatches(
				100,
				rows.map((row) => row.pecId)
			)
		);
	}

	async getBatchPecId(batchId: string) {
		const [batch] = await this.repository.getBatch(batchId);
		if (!batch) throw notFound('Barcode batch not found.');
		return batch.pecId;
	}

	async getBatchPecIdForAuthorization(batchId: string) {
		const [batch] = await this.repository.getBatch(batchId);
		return batch?.pecId ?? -1;
	}

	async createBatch(input: {
		pecId: number;
		year: number;
		quantity: number;
		templateId?: number;
		output: 'html_pdf' | 'zpl' | 'epl';
		userId: string;
		requestId: string;
		ipAddress?: string;
		userAgent?: string;
	}) {
		return db.transaction(async (tx) => {
			const [pec] = await tx.select().from(pecs).where(eq(pecs.id, input.pecId)).limit(1);
			if (!pec) throw notFound('PEC not found.');

			const [series] = await tx
				.select()
				.from(barcodeSeries)
				.where(
					sql`${barcodeSeries.pecId} = ${input.pecId} and ${barcodeSeries.year} = ${input.year}`
				)
				.for('update')
				.limit(1);

			const activeSeries =
				series ??
				(
					await tx
						.insert(barcodeSeries)
						.values({
							pecId: input.pecId,
							year: input.year,
							nextSerial: 1,
							createdBy: input.userId,
							updatedBy: input.userId
						})
						.returning()
				)[0];

			if (activeSeries.locked) throw conflict('Barcode series is locked.');

			const startSerial = activeSeries.nextSerial;
			const endSerial = startSerial + input.quantity - 1;
			if (endSerial > SERIAL_MAX) throw conflict('Barcode serial limit exceeded.');

			const overlap = await tx
				.select({ id: barcodeRanges.id })
				.from(barcodeRanges)
				.where(
					sql`${barcodeRanges.pecId} = ${input.pecId}
						and ${barcodeRanges.year} = ${input.year}
						and ${barcodeRanges.startSerial} <= ${endSerial}
						and ${barcodeRanges.endSerial} >= ${startSerial}`
				)
				.limit(1);
			if (overlap.length) throw conflict('Requested barcode range overlaps an existing range.');

			const [batch] = await tx
				.insert(barcodeBatches)
				.values({
					type: 'print',
					pecId: input.pecId,
					year: input.year,
					templateId: input.templateId,
					quantity: input.quantity,
					createdBy: input.userId
				})
				.returning();

			await tx.insert(barcodeRanges).values({
				batchId: batch.id,
				pecId: input.pecId,
				year: input.year,
				startSerial,
				endSerial,
				status: 'printed'
			});

			await tx
				.update(barcodeSeries)
				.set({ nextSerial: endSerial + 1, updatedBy: input.userId, updatedAt: new Date() })
				.where(eq(barcodeSeries.id, activeSeries.id));

			await writeAudit(tx as unknown as typeof db, {
				requestId: input.requestId,
				actorUserId: input.userId,
				action: 'barcode.batch.print',
				resourceType: 'pec',
				resourceId: input.pecId,
				before: { nextSerial: startSerial },
				after: { batchId: batch.id, startSerial, endSerial, nextSerial: endSerial + 1 },
				ipAddress: input.ipAddress,
				userAgent: input.userAgent
			});

			const values = expandBarcodeRange({
				pecCode: pec.code,
				year: input.year,
				startSerial,
				endSerial
			});

			return {
				batch,
				startSerial,
				endSerial,
				barcodes: values,
				print: await this.renderPrintPayload(values, input.output, input.templateId)
			};
		});
	}

	async resetSeries(input: {
		pecId: number;
		year: number;
		nextSerial: number;
		reason: string;
		userId: string;
		requestId: string;
	}) {
		return db.transaction(async (tx) => {
			const [series] = await tx
				.select()
				.from(barcodeSeries)
				.where(
					sql`${barcodeSeries.pecId} = ${input.pecId} and ${barcodeSeries.year} = ${input.year}`
				)
				.for('update')
				.limit(1);

			const before = series ? { nextSerial: series.nextSerial } : undefined;
			const [saved] = series
				? await tx
						.update(barcodeSeries)
						.set({ nextSerial: input.nextSerial, updatedBy: input.userId, updatedAt: new Date() })
						.where(eq(barcodeSeries.id, series.id))
						.returning()
				: await tx
						.insert(barcodeSeries)
						.values({
							pecId: input.pecId,
							year: input.year,
							nextSerial: input.nextSerial,
							createdBy: input.userId,
							updatedBy: input.userId
						})
						.returning();

			await writeAudit(tx as unknown as typeof db, {
				requestId: input.requestId,
				actorUserId: input.userId,
				action: 'barcode.sequence.reset',
				resourceType: 'pec',
				resourceId: input.pecId,
				reason: input.reason,
				before,
				after: { nextSerial: input.nextSerial }
			});

			return saved;
		});
	}

	async reserveOffline(input: {
		pecId: number;
		year: number;
		startSerial: number;
		endSerial: number;
		reason: string;
		userId: string;
		requestId: string;
	}) {
		return db.transaction(async (tx) => {
			const overlap = await tx
				.select({ id: barcodeRanges.id })
				.from(barcodeRanges)
				.where(
					sql`${barcodeRanges.pecId} = ${input.pecId}
						and ${barcodeRanges.year} = ${input.year}
						and ${barcodeRanges.startSerial} <= ${input.endSerial}
						and ${barcodeRanges.endSerial} >= ${input.startSerial}`
				)
				.limit(1);
			if (overlap.length)
				throw conflict('Offline range overlaps an existing printed/reserved range.');

			const [batch] = await tx
				.insert(barcodeBatches)
				.values({
					type: 'offline_reserve',
					pecId: input.pecId,
					year: input.year,
					quantity: input.endSerial - input.startSerial + 1,
					reason: input.reason,
					createdBy: input.userId
				})
				.returning();

			await tx.insert(barcodeRanges).values({
				batchId: batch.id,
				pecId: input.pecId,
				year: input.year,
				startSerial: input.startSerial,
				endSerial: input.endSerial,
				status: 'offline_reserved'
			});

			await tx
				.insert(barcodeSeries)
				.values({
					pecId: input.pecId,
					year: input.year,
					nextSerial: input.endSerial + 1,
					createdBy: input.userId,
					updatedBy: input.userId
				})
				.onConflictDoUpdate({
					target: [barcodeSeries.pecId, barcodeSeries.year],
					set: {
						nextSerial: sql`greatest(${barcodeSeries.nextSerial}, ${input.endSerial + 1})`,
						updatedBy: input.userId,
						updatedAt: new Date()
					}
				});

			await writeAudit(tx as unknown as typeof db, {
				requestId: input.requestId,
				actorUserId: input.userId,
				action: 'barcode.range.reserve_offline',
				resourceType: 'pec',
				resourceId: input.pecId,
				reason: input.reason,
				after: { batchId: batch.id, startSerial: input.startSerial, endSerial: input.endSerial }
			});

			return batch;
		});
	}

	async reprintBatch(input: {
		batchId: string;
		templateId?: number;
		output: 'html_pdf' | 'zpl' | 'epl';
		reason: string;
		userId: string;
		requestId: string;
	}) {
		const [batch] = await this.repository.getBatch(input.batchId);
		if (!batch) throw notFound('Barcode batch not found.');
		const [pec] = await this.repository.getPec(batch.pecId);
		if (!pec) throw notFound('PEC not found.');
		const ranges = await this.repository.getRangesForBatch(batch.id);
		const barcodes = ranges.flatMap((range) =>
			expandBarcodeRange({
				pecCode: pec.code,
				year: batch.year,
				startSerial: range.startSerial,
				endSerial: range.endSerial
			})
		);

		const [reprint] = await db
			.insert(barcodeBatches)
			.values({
				type: 'reprint',
				pecId: batch.pecId,
				year: batch.year,
				templateId: input.templateId,
				sourceBatchId: batch.id,
				quantity: barcodes.length,
				reason: input.reason,
				createdBy: input.userId
			})
			.returning();

		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.userId,
			action: 'barcode.batch.reprint',
			resourceType: 'pec',
			resourceId: batch.pecId,
			reason: input.reason,
			after: { sourceBatchId: batch.id, reprintBatchId: reprint.id }
		});

		return {
			batch: reprint,
			barcodes,
			print: await this.renderPrintPayload(barcodes, input.output, input.templateId)
		};
	}

	async reprintSingleBarcode(input: {
		batchId: string;
		serial: number;
		templateId?: number;
		output: 'html_pdf' | 'zpl' | 'epl';
		reason: string;
		userId: string;
		requestId: string;
	}) {
		const [batch] = await this.repository.getBatch(input.batchId);
		if (!batch) throw notFound('Barcode batch not found.');
		const sourceBatchId =
			batch.type === 'reprint' && batch.sourceBatchId ? batch.sourceBatchId : batch.id;
		const [pec] = await this.repository.getPec(batch.pecId);
		if (!pec) throw notFound('PEC not found.');
		const ranges = await this.repository.getRangesForBatch(sourceBatchId);
		const containsSerial = ranges.some(
			(range) => input.serial >= range.startSerial && input.serial <= range.endSerial
		);
		if (!containsSerial) throw notFound('Barcode not found in this batch.');
		const [reprint] = await db
			.insert(barcodeBatches)
			.values({
				type: 'reprint',
				pecId: batch.pecId,
				year: batch.year,
				templateId: input.templateId,
				sourceBatchId,
				quantity: 1,
				reason: input.reason,
				createdBy: input.userId
			})
			.returning();
		const [barcode] = expandBarcodeRange({
			pecCode: pec.code,
			year: batch.year,
			startSerial: input.serial,
			endSerial: input.serial
		});
		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.userId,
			action: 'barcode.batch.reprint',
			resourceType: 'pec',
			resourceId: batch.pecId,
			reason: input.reason,
			after: { sourceBatchId, reprintBatchId: reprint.id, serial: input.serial, barcode }
		});
		return {
			batch: reprint,
			barcodes: [barcode],
			print: await this.renderPrintPayload([barcode], input.output, input.templateId)
		};
	}

	async reprintPecRange(input: {
		pecId: number;
		year: number;
		startSerial: number;
		endSerial: number;
		templateId?: number;
		output: 'html_pdf' | 'zpl' | 'epl';
		reason: string;
		userId: string;
		requestId: string;
	}) {
		const quantity = input.endSerial - input.startSerial + 1;
		if (quantity > 1000) throw conflict('Reprint range cannot exceed 1000 barcodes.');
		const [pec] = await this.repository.getPec(input.pecId);
		if (!pec) throw notFound('PEC not found.');
		const ranges = await this.repository.listRangesCovering(
			input.pecId,
			input.year,
			input.startSerial,
			input.endSerial
		);
		let cursor = input.startSerial;
		for (const range of ranges) {
			if (range.startSerial > cursor) break;
			if (range.endSerial >= cursor) cursor = range.endSerial + 1;
			if (cursor > input.endSerial) break;
		}
		if (cursor <= input.endSerial) {
			throw notFound('Requested barcode range was not found in previous printed ranges.');
		}
		const [reprint] = await db
			.insert(barcodeBatches)
			.values({
				type: 'reprint',
				pecId: input.pecId,
				year: input.year,
				templateId: input.templateId,
				sourceBatchId: ranges[0]?.batchId,
				quantity,
				reason: input.reason,
				createdBy: input.userId
			})
			.returning();
		const barcodes = expandBarcodeRange({
			pecCode: pec.code,
			year: input.year,
			startSerial: input.startSerial,
			endSerial: input.endSerial
		});
		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.userId,
			action: 'barcode.batch.reprint',
			resourceType: 'pec',
			resourceId: input.pecId,
			reason: input.reason,
			after: {
				reprintBatchId: reprint.id,
				startSerial: input.startSerial,
				endSerial: input.endSerial,
				quantity
			}
		});
		return {
			batch: reprint,
			startSerial: input.startSerial,
			endSerial: input.endSerial,
			barcodes,
			print: await this.renderPrintPayload(barcodes, input.output, input.templateId)
		};
	}

	private async renderPrintPayload(
		barcodes: string[],
		output: 'html_pdf' | 'zpl' | 'epl',
		templateId?: number
	): Promise<PrintPayload> {
		const [templateRecord] = await this.repository.getTemplate(templateId);
		const template = {
			...defaultTemplate,
			...templateRecord,
			type: output,
			layout: (templateRecord?.layout as PrinterTemplateConfig['layout']) ?? defaultTemplate.layout
		};
		if (output === 'zpl') return { output, content: renderZpl(barcodes, template) };
		if (output === 'epl') return { output, content: renderEpl(barcodes, template) };
		return { output, content: renderSvgLabels(barcodes) };
	}
}

export const barcodeService = new BarcodeService();
