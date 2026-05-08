import type {
	emrNoteDefinitions,
	emrNoteDefinitionDrafts,
	emrNoteDefinitionVersions
} from '$lib/server/db/schema';

export type {
	EmrAnalyticsHint,
	EmrChoice,
	EmrChoiceSet,
	EmrDefinitionAction,
	EmrDefinitionAnalytics,
	EmrDefinitionStatus,
	EmrField,
	EmrFieldType,
	EmrFieldValidation,
	EmrLayoutSection,
	EmrNoteDefinition,
	EmrRule,
	EmrRuleAction,
	EmrRuleCondition,
	EmrSectionKind
} from './emr-builder.schemas';

export type EmrNoteDefinitionRecord = typeof emrNoteDefinitions.$inferSelect;
export type NewEmrNoteDefinition = typeof emrNoteDefinitions.$inferInsert;
export type EmrNoteDefinitionDraftRecord = typeof emrNoteDefinitionDrafts.$inferSelect;
export type NewEmrNoteDefinitionDraft = typeof emrNoteDefinitionDrafts.$inferInsert;
export type EmrNoteDefinitionVersionRecord = typeof emrNoteDefinitionVersions.$inferSelect;
export type NewEmrNoteDefinitionVersion = typeof emrNoteDefinitionVersions.$inferInsert;
