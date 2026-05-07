import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { roles, userPecAllocations, userRoles } from '$lib/server/db/schema';
import { forbidden } from '$lib/server/observability/errors';
import { getPrivilege } from './privilege-registry';

export type ResourceRef = {
	type: string;
	id: string | number;
};

export async function getUserRoleNames(userId: string) {
	const rows = await db
		.select({ name: roles.name })
		.from(userRoles)
		.innerJoin(roles, eq(userRoles.roleId, roles.id))
		.where(eq(userRoles.userId, userId));
	return rows.map((row) => row.name);
}

export async function authorize(userId: string, privilegeName: string, resource: ResourceRef) {
	const privilege = getPrivilege(privilegeName);
	if (!privilege) throw forbidden();

	const roleNames = await getUserRoleNames(userId);
	const hasRole = privilege.roles.some((role) => roleNames.includes(role));
	if (!hasRole) throw forbidden();

	if (roleNames.includes('admin')) return;

	if (privilege.relationship === 'allocated_pec') {
		if (resource.type !== 'pec') throw forbidden();
		const [allocation] = await db
			.select({ id: userPecAllocations.id })
			.from(userPecAllocations)
			.where(
				and(
					eq(userPecAllocations.userId, userId),
					eq(userPecAllocations.pecId, Number(resource.id)),
					eq(userPecAllocations.active, true)
				)
			)
			.limit(1);
		if (!allocation) throw forbidden();
	}
}
