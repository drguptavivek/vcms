import { writeAudit } from '$lib/server/observability/audit';
import { db } from '$lib/server/db';
import { SettingsRepository } from './settings.repository';

const BARCODE_CURRENT_YEAR_KEY = 'barcode.current_year';

export class SettingsService {
	constructor(private readonly repository = new SettingsRepository()) {}

	async getBarcodeYear() {
		const [setting] = await this.repository.get(BARCODE_CURRENT_YEAR_KEY);
		const year = Number(setting?.value);
		if (Number.isInteger(year) && year >= 0 && year <= 99) return year;
		return new Date().getFullYear() % 100;
	}

	async updateBarcodeYear(input: {
		year: number;
		reason: string;
		userId: string;
		requestId: string;
		ipAddress?: string;
		userAgent?: string;
	}) {
		const beforeYear = await this.getBarcodeYear();
		const [setting] = await this.repository.upsert({
			key: BARCODE_CURRENT_YEAR_KEY,
			value: String(input.year),
			description: 'Current operational barcode year YY used by the print dashboard',
			updatedBy: input.userId
		});

		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.userId,
			action: 'settings.barcode_year.update',
			resourceType: 'system',
			resourceId: BARCODE_CURRENT_YEAR_KEY,
			reason: input.reason,
			before: { year: beforeYear },
			after: { year: input.year },
			ipAddress: input.ipAddress,
			userAgent: input.userAgent
		});

		return setting;
	}
}

export const settingsService = new SettingsService();
