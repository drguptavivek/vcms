import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

export const batchType = pgEnum('barcode_batch_type', ['print', 'reprint', 'offline_reserve']);
export const rangeStatus = pgEnum('barcode_range_status', [
	'printed',
	'reprinted',
	'offline_reserved'
]);
export const printerType = pgEnum('printer_type', ['html_pdf', 'zpl', 'epl']);
export const auditOutcome = pgEnum('audit_outcome', ['success', 'failure']);
export const patientSex = pgEnum('patient_sex', ['female', 'male', 'other', 'unknown']);
export const encounterStatus = pgEnum('encounter_status', ['active', 'completed', 'cancelled']);
export const carePathwayStatus = pgEnum('care_pathway_status', [
	'active',
	'completed',
	'cancelled'
]);
export const clinicalNoteStatus = pgEnum('clinical_note_status', ['draft', 'signed', 'amended']);
export const emrDefinitionStatus = pgEnum('emr_definition_status', ['draft', 'active', 'retired']);
export const clinicalWorklistStatus = pgEnum('clinical_worklist_status', [
	'open',
	'in_progress',
	'completed',
	'cancelled'
]);

export const masSettings = pgTable('mas_settings', {
	key: text('key').primaryKey(),
	value: text('value').notNull(),
	description: text('description').notNull().default(''),
	updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const teams = pgTable('teams', {
	id: serial('id').primaryKey(),
	code: integer('code').notNull().unique(),
	name: text('name').notNull(),
	active: boolean('active').notNull().default(true),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const pecs = pgTable(
	'pecs',
	{
		id: serial('id').primaryKey(),
		code: integer('code').notNull(),
		name: text('name').notNull(),
		teamId: integer('team_id')
			.notNull()
			.references(() => teams.id, { onDelete: 'restrict' }),
		active: boolean('active').notNull().default(true),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('pecs_code_active_uidx')
			.on(table.code)
			.where(sql`${table.active} = true`),
		check('pecs_code_2_digit_check', sql`${table.code} between 0 and 99`)
	]
);

export const roles = pgTable('roles', {
	id: serial('id').primaryKey(),
	name: text('name').notNull().unique(),
	description: text('description').notNull().default('')
});

export const userRoles = pgTable(
	'user_roles',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		roleId: integer('role_id')
			.notNull()
			.references(() => roles.id, { onDelete: 'cascade' }),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(table) => [uniqueIndex('user_roles_user_role_uidx').on(table.userId, table.roleId)]
);

export const userPecAllocations = pgTable(
	'user_pec_allocations',
	{
		id: serial('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		pecId: integer('pec_id')
			.notNull()
			.references(() => pecs.id, { onDelete: 'cascade' }),
		active: boolean('active').notNull().default(true),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('user_pec_allocations_user_pec_uidx').on(table.userId, table.pecId),
		index('user_pec_allocations_user_idx').on(table.userId)
	]
);

export const userProfiles = pgTable('user_profiles', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	printPreferences: jsonb('print_preferences_json').notNull().default({}),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const barcodeSeries = pgTable(
	'barcode_series',
	{
		id: serial('id').primaryKey(),
		pecId: integer('pec_id')
			.notNull()
			.references(() => pecs.id, { onDelete: 'restrict' }),
		year: integer('year_yy').notNull(),
		nextSerial: integer('next_serial').notNull().default(1),
		locked: boolean('locked').notNull().default(false),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('barcode_series_pec_year_uidx').on(table.pecId, table.year),
		check('barcode_series_year_check', sql`${table.year} between 0 and 99`),
		check('barcode_series_next_serial_check', sql`${table.nextSerial} between 1 and 999999`)
	]
);

export const printerTemplates = pgTable('printer_templates', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	type: printerType('type').notNull(),
	widthMm: integer('width_mm').notNull(),
	heightMm: integer('height_mm').notNull(),
	dpi: integer('dpi').notNull().default(203),
	barcodeHeight: integer('barcode_height').notNull().default(80),
	layout: jsonb('layout_config_json').notNull().default({}),
	active: boolean('active').notNull().default(true),
	createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
	createdAt: timestamp('created_at').notNull().defaultNow(),
	updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const barcodeBatches = pgTable(
	'barcode_batches',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		type: batchType('type').notNull(),
		pecId: integer('pec_id')
			.notNull()
			.references(() => pecs.id, { onDelete: 'restrict' }),
		year: integer('year_yy').notNull(),
		templateId: integer('template_id').references(() => printerTemplates.id, {
			onDelete: 'set null'
		}),
		sourceBatchId: uuid('source_batch_id'),
		quantity: integer('quantity').notNull(),
		reason: text('reason').notNull().default(''),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(table) => [
		index('barcode_batches_pec_year_idx').on(table.pecId, table.year),
		check('barcode_batches_quantity_check', sql`${table.quantity} > 0`)
	]
);

export const barcodeRanges = pgTable(
	'barcode_ranges',
	{
		id: serial('id').primaryKey(),
		batchId: uuid('batch_id')
			.notNull()
			.references(() => barcodeBatches.id, { onDelete: 'cascade' }),
		pecId: integer('pec_id')
			.notNull()
			.references(() => pecs.id, { onDelete: 'restrict' }),
		year: integer('year_yy').notNull(),
		startSerial: integer('start_serial').notNull(),
		endSerial: integer('end_serial').notNull(),
		status: rangeStatus('status').notNull(),
		createdAt: timestamp('created_at').notNull().defaultNow()
	},
	(table) => [
		index('barcode_ranges_pec_year_idx').on(table.pecId, table.year),
		check('barcode_ranges_serial_order_check', sql`${table.startSerial} <= ${table.endSerial}`),
		check('barcode_ranges_start_check', sql`${table.startSerial} between 1 and 999999`),
		check('barcode_ranges_end_check', sql`${table.endSerial} between 1 and 999999`)
	]
);

export const patients = pgTable(
	'patients',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		barcode: text('barcode').notNull(),
		primaryPecId: integer('primary_pec_id').references(() => pecs.id, { onDelete: 'restrict' }),
		fullName: text('full_name').notNull(),
		sex: patientSex('sex').notNull().default('unknown'),
		dateOfBirth: date('date_of_birth'),
		ageYears: integer('age_years'),
		phone: text('phone'),
		address: text('address'),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('patients_barcode_uidx').on(table.barcode),
		index('patients_primary_pec_idx').on(table.primaryPecId),
		check('patients_barcode_not_blank_check', sql`length(trim(${table.barcode})) > 0`),
		check('patients_full_name_not_blank_check', sql`length(trim(${table.fullName})) > 0`),
		check(
			'patients_age_years_check',
			sql`${table.ageYears} is null or ${table.ageYears} between 0 and 130`
		)
	]
);

export const encounters = pgTable(
	'encounters',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		patientId: uuid('patient_id')
			.notNull()
			.references(() => patients.id, { onDelete: 'restrict' }),
		pecId: integer('pec_id')
			.notNull()
			.references(() => pecs.id, { onDelete: 'restrict' }),
		carePathwayId: uuid('care_pathway_id'),
		carePathwayType: text('care_pathway_type'),
		barcodeSnapshot: text('barcode_snapshot').notNull(),
		status: encounterStatus('status').notNull().default('active'),
		occurredAt: timestamp('occurred_at').notNull().defaultNow(),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		index('encounters_patient_idx').on(table.patientId),
		index('encounters_care_pathway_idx').on(table.carePathwayId),
		index('encounters_pec_occurred_at_idx').on(table.pecId, table.occurredAt)
	]
);

export const carePathways = pgTable(
	'care_pathways',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		patientId: uuid('patient_id')
			.notNull()
			.references(() => patients.id, { onDelete: 'restrict' }),
		encounterId: uuid('encounter_id')
			.notNull()
			.references(() => encounters.id, { onDelete: 'restrict' }),
		pathwayType: text('pathway_type').notNull(),
		parentCarePathwayId: uuid('parent_care_pathway_id'),
		startedFromEncounterId: uuid('started_from_encounter_id').references(() => encounters.id, {
			onDelete: 'set null'
		}),
		status: carePathwayStatus('status').notNull().default('active'),
		context: jsonb('context_json').notNull().default({}),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		index('care_pathways_patient_idx').on(table.patientId),
		index('care_pathways_encounter_idx').on(table.encounterId),
		check('care_pathways_type_not_blank_check', sql`length(trim(${table.pathwayType})) > 0`)
	]
);

export const clinicalNotes = pgTable(
	'clinical_notes',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		patientId: uuid('patient_id')
			.notNull()
			.references(() => patients.id, { onDelete: 'restrict' }),
		encounterId: uuid('encounter_id').references(() => encounters.id, { onDelete: 'set null' }),
		carePathwayId: uuid('care_pathway_id').references(() => carePathways.id, {
			onDelete: 'restrict'
		}),
		noteType: text('note_type').notNull(),
		status: clinicalNoteStatus('status').notNull().default('signed'),
		currentVersion: integer('current_version').notNull().default(1),
		payloadHash: text('payload_hash').notNull(),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		index('clinical_notes_patient_idx').on(table.patientId),
		index('clinical_notes_encounter_idx').on(table.encounterId),
		index('clinical_notes_care_pathway_idx').on(table.carePathwayId),
		check('clinical_notes_type_not_blank_check', sql`length(trim(${table.noteType})) > 0`),
		check('clinical_notes_version_check', sql`${table.currentVersion} > 0`)
	]
);

export const clinicalNoteVersions = pgTable(
	'clinical_note_versions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		noteId: uuid('note_id')
			.notNull()
			.references(() => clinicalNotes.id, { onDelete: 'cascade' }),
		version: integer('version').notNull(),
		changeType: text('change_type').notNull(),
		payloadHash: text('payload_hash').notNull(),
		reason: text('reason').notNull().default(''),
		payload: jsonb('payload_json').notNull(),
		submittedBy: text('submitted_by').references(() => user.id, { onDelete: 'set null' }),
		submittedAt: timestamp('submitted_at').notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('clinical_note_versions_note_version_uidx').on(table.noteId, table.version),
		check('clinical_note_versions_version_check', sql`${table.version} > 0`)
	]
);

export const mobileSubmissionResults = pgTable(
	'mobile_submission_results',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		idempotencyKey: text('idempotency_key').notNull(),
		pecId: integer('pec_id')
			.notNull()
			.references(() => pecs.id, { onDelete: 'restrict' }),
		requestHash: text('request_hash').notNull(),
		status: text('status').notNull().default('processing'),
		definitionVersion: text('definition_version'),
		definitionHash: text('definition_hash'),
		clientMetadata: jsonb('client_metadata_json').notNull().default({}),
		deviceMetadata: jsonb('device_metadata_json').notNull().default({}),
		responsePayload: jsonb('response_payload_json').notNull(),
		errorCode: text('error_code'),
		errorMessage: text('error_message'),
		requestId: text('request_id').notNull(),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('mobile_submission_results_user_key_uidx').on(table.userId, table.idempotencyKey),
		index('mobile_submission_results_user_idx').on(table.userId),
		index('mobile_submission_results_pec_idx').on(table.pecId)
	]
);

export const emrNoteDefinitions = pgTable(
	'emr_note_definitions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		definitionId: text('definition_id').notNull(),
		slug: text('slug').notNull(),
		title: text('title').notNull(),
		noteType: text('note_type').notNull(),
		specialty: text('specialty'),
		status: emrDefinitionStatus('status').notNull().default('draft'),
		version: integer('version').notNull().default(0),
		versionHash: text('version_hash').notNull(),
		locale: text('locale').notNull().default('en-IN'),
		tags: jsonb('tags_json').notNull().default([]),
		ownerTeam: text('owner_team'),
		effectiveFrom: timestamp('effective_from'),
		effectiveUntil: timestamp('effective_until'),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('emr_note_definitions_definition_id_uidx').on(table.definitionId),
		uniqueIndex('emr_note_definitions_slug_uidx').on(table.slug),
		index('emr_note_definitions_status_idx').on(table.status),
		check('emr_note_definitions_version_check', sql`${table.version} >= 0`)
	]
);

export const emrNoteDefinitionDrafts = pgTable(
	'emr_note_definition_drafts',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		definitionId: uuid('definition_id')
			.notNull()
			.references(() => emrNoteDefinitions.id, { onDelete: 'cascade' }),
		payloadJson: jsonb('payload_json').notNull(),
		versionHash: text('version_hash').notNull(),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		updatedBy: text('updated_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('emr_note_definition_drafts_definition_id_uidx').on(table.definitionId),
		index('emr_note_definition_drafts_updated_at_idx').on(table.updatedAt)
	]
);

export const emrNoteDefinitionVersions = pgTable(
	'emr_note_definition_versions',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		definitionId: uuid('definition_id')
			.notNull()
			.references(() => emrNoteDefinitions.id, { onDelete: 'cascade' }),
		version: integer('version').notNull(),
		versionHash: text('version_hash').notNull(),
		changeType: text('change_type').notNull().default('publish'),
		payloadJson: jsonb('payload_json').notNull(),
		publishedBy: text('published_by').references(() => user.id, { onDelete: 'set null' }),
		publishedAt: timestamp('published_at').notNull().defaultNow(),
		reason: text('reason').notNull().default('')
	},
	(table) => [
		uniqueIndex('emr_note_definition_versions_definition_version_uidx').on(
			table.definitionId,
			table.version
		),
		index('emr_note_definition_versions_definition_id_idx').on(table.definitionId),
		check('emr_note_definition_versions_version_check', sql`${table.version} > 0`)
	]
);

export const clinicalWorklists = pgTable(
	'clinical_worklists',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		patientId: uuid('patient_id')
			.notNull()
			.references(() => patients.id, { onDelete: 'restrict' }),
		carePathwayId: uuid('care_pathway_id')
			.notNull()
			.references(() => carePathways.id, { onDelete: 'restrict' }),
		sourceEncounterId: uuid('source_encounter_id')
			.notNull()
			.references(() => encounters.id, { onDelete: 'restrict' }),
		sourceClinicalNoteId: uuid('source_clinical_note_id')
			.notNull()
			.references(() => clinicalNotes.id, { onDelete: 'restrict' }),
		worklistType: text('worklist_type').notNull(),
		status: clinicalWorklistStatus('status').notNull().default('open'),
		dueDate: timestamp('due_date'),
		summary: jsonb('summary_json').notNull().default({}),
		createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
		createdAt: timestamp('created_at').notNull().defaultNow(),
		updatedAt: timestamp('updated_at').notNull().defaultNow()
	},
	(table) => [
		uniqueIndex('clinical_worklists_patient_encounter_type_uidx').on(
			table.patientId,
			table.carePathwayId,
			table.sourceEncounterId,
			table.worklistType
		),
		index('clinical_worklists_patient_idx').on(table.patientId),
		index('clinical_worklists_status_due_idx').on(table.status, table.dueDate),
		check('clinical_worklists_type_not_blank_check', sql`length(trim(${table.worklistType})) > 0`)
	]
);

export const auditLogs = pgTable('audit_logs', {
	id: uuid('id').defaultRandom().primaryKey(),
	requestId: text('request_id').notNull(),
	actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
	action: text('action').notNull(),
	resourceType: text('resource_type').notNull(),
	resourceId: text('resource_id').notNull(),
	outcome: auditOutcome('outcome').notNull(),
	reason: text('reason').notNull().default(''),
	before: jsonb('before_data'),
	after: jsonb('after_data'),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const appErrorLogs = pgTable('app_error_logs', {
	id: uuid('id').defaultRandom().primaryKey(),
	requestId: text('request_id').notNull(),
	userId: text('user_id').references(() => user.id, { onDelete: 'set null' }),
	route: text('route').notNull(),
	errorCode: text('error_code').notNull(),
	message: text('message').notNull(),
	details: jsonb('details'),
	createdAt: timestamp('created_at').notNull().defaultNow()
});

export const emrNoteDefinitionRelations = relations(emrNoteDefinitions, ({ many }) => ({
	drafts: many(emrNoteDefinitionDrafts),
	versions: many(emrNoteDefinitionVersions)
}));

export const emrNoteDefinitionDraftRelations = relations(emrNoteDefinitionDrafts, ({ one }) => ({
	definition: one(emrNoteDefinitions, {
		fields: [emrNoteDefinitionDrafts.definitionId],
		references: [emrNoteDefinitions.id]
	})
}));

export const emrNoteDefinitionVersionRelations = relations(
	emrNoteDefinitionVersions,
	({ one }) => ({
		definition: one(emrNoteDefinitions, {
			fields: [emrNoteDefinitionVersions.definitionId],
			references: [emrNoteDefinitions.id]
		})
	})
);

export const teamRelations = relations(teams, ({ many }) => ({ pecs: many(pecs) }));
export const pecRelations = relations(pecs, ({ one, many }) => ({
	team: one(teams, { fields: [pecs.teamId], references: [teams.id] }),
	series: many(barcodeSeries)
}));

export * from './auth.schema';
