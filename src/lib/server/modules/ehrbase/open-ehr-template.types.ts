import type { openEhrTemplates, openEhrWebTemplateCaches } from '$lib/server/db/schema';

export type OpenEhrTemplateRecord = typeof openEhrTemplates.$inferSelect;
export type NewOpenEhrTemplate = typeof openEhrTemplates.$inferInsert;
export type OpenEhrWebTemplateCacheRecord = typeof openEhrWebTemplateCaches.$inferSelect;
export type NewOpenEhrWebTemplateCache = typeof openEhrWebTemplateCaches.$inferInsert;
