import { asc } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { printerTemplates } from '$lib/server/db/schema';
import { writeAudit } from '$lib/server/observability/audit';

export class PrinterTemplateService {
	list() {
		return db.select().from(printerTemplates).orderBy(asc(printerTemplates.name));
	}

	async create(input: {
		name: string;
		type: 'html_pdf' | 'zpl' | 'epl';
		widthMm: number;
		heightMm: number;
		dpi: number;
		barcodeHeight: number;
		layout: Record<string, unknown>;
		userId: string;
		requestId: string;
	}) {
		const [template] = await db
			.insert(printerTemplates)
			.values({
				name: input.name,
				type: input.type,
				widthMm: input.widthMm,
				heightMm: input.heightMm,
				dpi: input.dpi,
				barcodeHeight: input.barcodeHeight,
				layout: input.layout,
				createdBy: input.userId
			})
			.returning();
		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.userId,
			action: 'printer_template.manage',
			resourceType: 'printer_template',
			resourceId: template.id,
			after: template
		});
		return template;
	}
}

export const printerTemplateService = new PrinterTemplateService();
