import { asc, eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	pecs,
	roles,
	user,
	userPecAllocations,
	userProfiles,
	userRoles
} from '$lib/server/db/schema';
import { writeAudit } from '$lib/server/observability/audit';
import { notFound } from '$lib/server/observability/errors';
import {
	userPrintPreferencesSchema,
	type UserPrintPreferences
} from './user.schemas';

const defaultPrintPreferences: UserPrintPreferences = {
	defaultOutput: 'html_pdf',
	zpl: { printer: '', templateId: '' },
	epl: { printer: '', templateId: '' },
	browserPrint: { profile: 'a4' }
};

export class UserService {
	async listUsers() {
		return db
			.select({ id: user.id, name: user.name, email: user.email })
			.from(user)
			.orderBy(asc(user.email));
	}

	async listRoles() {
		return db.select().from(roles).orderBy(asc(roles.name));
	}

	async getPrintPreferences(userId: string): Promise<UserPrintPreferences> {
		const [profile] = await db
			.select({ printPreferences: userProfiles.printPreferences })
			.from(userProfiles)
			.where(eq(userProfiles.userId, userId))
			.limit(1);
		if (!profile) return defaultPrintPreferences;

		const parsed = userPrintPreferencesSchema.safeParse(profile.printPreferences);
		if (!parsed.success) return defaultPrintPreferences;
		return parsed.data;
	}

	async updatePrintPreferences(input: {
		userId: string;
		printPreferences: UserPrintPreferences;
		requestId: string;
	}) {
		const normalized = userPrintPreferencesSchema.parse(input.printPreferences);
		const before = await this.getPrintPreferences(input.userId);
		const [profile] = await db
			.insert(userProfiles)
			.values({
				userId: input.userId,
				printPreferences: normalized
			})
			.onConflictDoUpdate({
				target: userProfiles.userId,
				set: {
					printPreferences: normalized,
					updatedAt: sql`now()`
				}
			})
			.returning({
				userId: userProfiles.userId,
				printPreferences: userProfiles.printPreferences
			});
		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.userId,
			action: 'user.profile.update',
			resourceType: 'user',
			resourceId: input.userId,
			before,
			after: normalized
		});
		return {
			userId: profile.userId,
			printPreferences: normalized
		};
	}

	async assignRole(input: {
		userId: string;
		roleName: string;
		actorUserId: string;
		requestId: string;
	}) {
		const [role] = await db.select().from(roles).where(eq(roles.name, input.roleName)).limit(1);
		if (!role) throw notFound('Role not found.');
		const [assignment] = await db
			.insert(userRoles)
			.values({ userId: input.userId, roleId: role.id })
			.onConflictDoNothing()
			.returning();
		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.actorUserId,
			action: 'user.manage',
			resourceType: 'user',
			resourceId: input.userId,
			after: { role: input.roleName }
		});
		return assignment ?? { userId: input.userId, roleId: role.id };
	}

	async allocatePec(input: {
		userId: string;
		pecId: number;
		actorUserId: string;
		requestId: string;
	}) {
		const [pec] = await db.select().from(pecs).where(eq(pecs.id, input.pecId)).limit(1);
		if (!pec) throw notFound('PEC not found.');
		const [allocation] = await db
			.insert(userPecAllocations)
			.values({ userId: input.userId, pecId: input.pecId })
			.onConflictDoUpdate({
				target: [userPecAllocations.userId, userPecAllocations.pecId],
				set: { active: true }
			})
			.returning();
		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.actorUserId,
			action: 'user.manage',
			resourceType: 'user',
			resourceId: input.userId,
			after: { pecId: input.pecId }
		});
		return allocation;
	}
}

export const userService = new UserService();
