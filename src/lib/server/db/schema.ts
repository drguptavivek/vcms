import { relations, sql } from 'drizzle-orm';
import {
	boolean,
	check,
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

export const teamRelations = relations(teams, ({ many }) => ({ pecs: many(pecs) }));
export const pecRelations = relations(pecs, ({ one, many }) => ({
	team: one(teams, { fields: [pecs.teamId], references: [teams.id] }),
	series: many(barcodeSeries)
}));

export * from './auth.schema';
