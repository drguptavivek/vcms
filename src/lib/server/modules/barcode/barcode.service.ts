import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { barcodeBatches, barcodeRanges, barcodeSeries, pecs } from '$lib/server/db/schema';
import { getUserRoleNames } from '$lib/server/authz/authorize';
import { conflict, notFound } from '$lib/server/observability/errors';
import { writeAudit } from '$lib/server/observability/audit';
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
		if (!userId) return this.repository.listBatches();
		const roles = await getUserRoleNames(userId);
		if (roles.includes('admin')) return this.repository.listBatches();
		const rows = await db.query.userPecAllocations.findMany({
			where: (allocation, { and, eq }) =>
				and(eq(allocation.userId, userId), eq(allocation.active, true)),
			columns: { pecId: true }
		});
		return this.repository.listBatches(
			100,
			rows.map((row) => row.pecId)
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
