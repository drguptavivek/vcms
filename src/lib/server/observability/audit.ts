import { auditLogs } from '$lib/server/db/schema';
import type { db } from '$lib/server/db';

type Database = typeof db;

export type AuditInput = {
	requestId: string;
	actorUserId?: string;
	action: string;
	resourceType: string;
	resourceId: string | number;
	outcome?: 'success' | 'failure';
	reason?: string;
	before?: unknown;
	after?: unknown;
	ipAddress?: string;
	userAgent?: string;
};

export async function writeAudit(database: Database, input: AuditInput) {
	await database.insert(auditLogs).values({
		requestId: input.requestId,
		actorUserId: input.actorUserId,
		action: input.action,
		resourceType: input.resourceType,
		resourceId: String(input.resourceId),
		outcome: input.outcome ?? 'success',
		reason: input.reason ?? '',
		before: input.before,
		after: input.after,
		ipAddress: input.ipAddress,
		userAgent: input.userAgent
	});
}
