import { desc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { openEhrTemplates, openEhrWebTemplateCaches } from '$lib/server/db/schema';
import type {
	NewOpenEhrTemplate,
	NewOpenEhrWebTemplateCache,
	OpenEhrTemplateRecord,
	OpenEhrWebTemplateCacheRecord
} from './open-ehr-template.types';

type Database = typeof db;

export class OpenEhrTemplateRepository {
	constructor(private readonly database: Database = db) {}

	listTemplates(filters: { status?: 'uploaded' | 'active' | 'retired' }) {
		const query = this.database.select().from(openEhrTemplates);
		const filtered = filters.status
			? query.where(eq(openEhrTemplates.status, filters.status))
			: query;

		return filtered
			.orderBy(desc(openEhrTemplates.updatedAt))
			.then((rows) => rows as OpenEhrTemplateRecord[]);
	}

	findTemplateByTemplateId(templateId: string) {
		return this.database
			.select()
			.from(openEhrTemplates)
			.where(eq(openEhrTemplates.templateId, templateId))
			.limit(1)
			.then((rows) => rows[0] as OpenEhrTemplateRecord | undefined);
	}

	findTemplateByCdrTemplateId(cdrTemplateId: string) {
		return this.database
			.select()
			.from(openEhrTemplates)
			.where(eq(openEhrTemplates.cdrTemplateId, cdrTemplateId))
			.limit(1)
			.then((rows) => rows[0] as OpenEhrTemplateRecord | undefined);
	}

	findWebTemplateCacheByTemplateId(templateId: string) {
		return this.database
			.select()
			.from(openEhrWebTemplateCaches)
			.where(eq(openEhrWebTemplateCaches.templateId, templateId))
			.limit(1)
			.then((rows) => rows[0] as OpenEhrWebTemplateCacheRecord | undefined);
	}

	upsertTemplate(input: NewOpenEhrTemplate) {
		return this.database
			.insert(openEhrTemplates)
			.values(input)
			.onConflictDoUpdate({
				target: openEhrTemplates.templateId,
				set: {
					cdrTemplateId: input.cdrTemplateId,
					concept: input.concept,
					archetypeId: input.archetypeId,
					format: input.format,
					status: input.status,
					operationalTemplateHash: input.operationalTemplateHash,
					webTemplateHash: input.webTemplateHash,
					webTemplateRootId: input.webTemplateRootId,
					metadata: input.metadata,
					uploadedBy: input.uploadedBy,
					uploadedAt: input.uploadedAt ?? new Date(),
					updatedAt: new Date()
				}
			})
			.returning()
			.then((rows) => rows[0] as OpenEhrTemplateRecord);
	}

	upsertWebTemplateCache(input: NewOpenEhrWebTemplateCache) {
		return this.database
			.insert(openEhrWebTemplateCaches)
			.values(input)
			.onConflictDoUpdate({
				target: openEhrWebTemplateCaches.templateId,
				set: {
					cdrTemplateId: input.cdrTemplateId,
					webTemplateHash: input.webTemplateHash,
					webTemplateJson: input.webTemplateJson,
					fetchedBy: input.fetchedBy,
					fetchedAt: input.fetchedAt ?? new Date(),
					updatedAt: new Date()
				}
			})
			.returning()
			.then((rows) => rows[0] as OpenEhrWebTemplateCacheRecord);
	}
}
