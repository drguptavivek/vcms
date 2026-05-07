import { and, desc, eq, lte, gte, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	barcodeBatches,
	barcodeRanges,
	barcodeSeries,
	pecs,
	printerTemplates
} from '$lib/server/db/schema';

export class BarcodeRepository {
	constructor(private readonly database = db) {}

	listSeries(userPecIds?: number[]) {
		const query = this.database
			.select({
				id: barcodeSeries.id,
				pecId: barcodeSeries.pecId,
				pecCode: pecs.code,
				pecName: pecs.name,
				year: barcodeSeries.year,
				nextSerial: barcodeSeries.nextSerial,
				locked: barcodeSeries.locked
			})
			.from(barcodeSeries)
			.innerJoin(pecs, eq(barcodeSeries.pecId, pecs.id))
			.orderBy(pecs.code, barcodeSeries.year);

		if (userPecIds?.length) return query.where(sql`${barcodeSeries.pecId} = any(${userPecIds})`);
		return query;
	}

	getPec(pecId: number) {
		return this.database.select().from(pecs).where(eq(pecs.id, pecId)).limit(1);
	}

	getTemplate(templateId?: number) {
		if (!templateId) return Promise.resolve([]);
		return this.database
			.select()
			.from(printerTemplates)
			.where(and(eq(printerTemplates.id, templateId), eq(printerTemplates.active, true)))
			.limit(1);
	}

	listBatches(limit = 100, userPecIds?: number[]) {
		const query = this.database
			.select({
				id: barcodeBatches.id,
				type: barcodeBatches.type,
				pecId: barcodeBatches.pecId,
				pecCode: pecs.code,
				pecName: pecs.name,
				year: barcodeBatches.year,
				quantity: barcodeBatches.quantity,
				reason: barcodeBatches.reason,
				sourceBatchId: barcodeBatches.sourceBatchId,
				createdAt: barcodeBatches.createdAt,
				createdBy: barcodeBatches.createdBy
			})
			.from(barcodeBatches)
			.innerJoin(pecs, eq(barcodeBatches.pecId, pecs.id))
			.orderBy(desc(barcodeBatches.createdAt))
			.limit(limit);
		if (userPecIds?.length) return query.where(sql`${barcodeBatches.pecId} = any(${userPecIds})`);
		return query;
	}

	listManualCodeSkips(year: number, userPecIds?: number[]) {
		const filters = [eq(barcodeBatches.type, 'offline_reserve'), eq(barcodeBatches.year, year)];
		if (userPecIds?.length) filters.push(sql`${barcodeBatches.pecId} = any(${userPecIds})`);
		return this.database
			.select({
				id: barcodeBatches.id,
				pecId: barcodeBatches.pecId,
				pecCode: pecs.code,
				pecName: pecs.name,
				year: barcodeBatches.year,
				quantity: barcodeBatches.quantity,
				reason: barcodeBatches.reason,
				createdAt: barcodeBatches.createdAt,
				startSerial: barcodeRanges.startSerial,
				endSerial: barcodeRanges.endSerial
			})
			.from(barcodeBatches)
			.innerJoin(barcodeRanges, eq(barcodeRanges.batchId, barcodeBatches.id))
			.innerJoin(pecs, eq(barcodeBatches.pecId, pecs.id))
			.where(and(...filters))
			.orderBy(desc(barcodeBatches.createdAt));
	}

	getBatch(batchId: string) {
		return this.database
			.select()
			.from(barcodeBatches)
			.where(eq(barcodeBatches.id, batchId))
			.limit(1);
	}

	getRangesForBatch(batchId: string) {
		return this.database.select().from(barcodeRanges).where(eq(barcodeRanges.batchId, batchId));
	}

	hasOverlap(pecId: number, year: number, startSerial: number, endSerial: number) {
		return this.database
			.select({ id: barcodeRanges.id })
			.from(barcodeRanges)
			.where(
				and(
					eq(barcodeRanges.pecId, pecId),
					eq(barcodeRanges.year, year),
					lte(barcodeRanges.startSerial, endSerial),
					gte(barcodeRanges.endSerial, startSerial)
				)
			)
			.limit(1);
	}

	listRangesCovering(pecId: number, year: number, startSerial: number, endSerial: number) {
		return this.database
			.select({
				id: barcodeRanges.id,
				batchId: barcodeRanges.batchId,
				startSerial: barcodeRanges.startSerial,
				endSerial: barcodeRanges.endSerial,
				status: barcodeRanges.status
			})
			.from(barcodeRanges)
			.where(
				and(
					eq(barcodeRanges.pecId, pecId),
					eq(barcodeRanges.year, year),
					lte(barcodeRanges.startSerial, endSerial),
					gte(barcodeRanges.endSerial, startSerial),
					eq(barcodeRanges.status, 'printed')
				)
			)
			.orderBy(barcodeRanges.startSerial);
	}

	transaction<T>(callback: Parameters<typeof db.transaction<T>>[0]) {
		return this.database.transaction(callback);
	}
}
