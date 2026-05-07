import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pecs, roles, user, userPecAllocations, userRoles } from '$lib/server/db/schema';
import { writeAudit } from '$lib/server/observability/audit';
import { notFound } from '$lib/server/observability/errors';

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
