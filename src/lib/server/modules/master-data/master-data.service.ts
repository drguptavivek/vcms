import { asc, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { pecs, teams, userPecAllocations } from '$lib/server/db/schema';
import { writeAudit } from '$lib/server/observability/audit';
import { getUserRoleNames } from '$lib/server/authz/authorize';

export class MasterDataService {
	async listTeams(userId?: string) {
		if (userId) {
			const roles = await getUserRoleNames(userId);
			if (!roles.includes('admin')) {
				return db
					.selectDistinct({
						id: teams.id,
						code: teams.code,
						name: teams.name,
						active: teams.active,
						createdAt: teams.createdAt,
						updatedAt: teams.updatedAt
					})
					.from(teams)
					.innerJoin(pecs, eq(pecs.teamId, teams.id))
					.innerJoin(userPecAllocations, eq(userPecAllocations.pecId, pecs.id))
					.where(eq(userPecAllocations.userId, userId))
					.orderBy(asc(teams.code));
			}
		}
		return db.select().from(teams).orderBy(asc(teams.code));
	}

	async listPecs(userId?: string) {
		if (userId) {
			const roles = await getUserRoleNames(userId);
			if (!roles.includes('admin')) {
				return db
					.select({
						id: pecs.id,
						code: pecs.code,
						name: pecs.name,
						teamId: pecs.teamId,
						active: pecs.active,
						teamName: teams.name
					})
					.from(pecs)
					.innerJoin(teams, eq(pecs.teamId, teams.id))
					.innerJoin(userPecAllocations, eq(userPecAllocations.pecId, pecs.id))
					.where(eq(userPecAllocations.userId, userId))
					.orderBy(asc(pecs.code));
			}
		}
		return db
			.select({
				id: pecs.id,
				code: pecs.code,
				name: pecs.name,
				teamId: pecs.teamId,
				active: pecs.active,
				teamName: teams.name
			})
			.from(pecs)
			.innerJoin(teams, eq(pecs.teamId, teams.id))
			.orderBy(asc(pecs.code));
	}

	async createTeam(input: { code: number; name: string; userId: string; requestId: string }) {
		const [team] = await db
			.insert(teams)
			.values({ code: input.code, name: input.name })
			.returning();
		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.userId,
			action: 'team.manage',
			resourceType: 'team',
			resourceId: team.id,
			after: team
		});
		return team;
	}

	async createPec(input: {
		code: number;
		name: string;
		teamId: number;
		userId: string;
		requestId: string;
	}) {
		const [pec] = await db
			.insert(pecs)
			.values({ code: input.code, name: input.name, teamId: input.teamId })
			.returning();
		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.userId,
			action: 'pec.manage',
			resourceType: 'pec',
			resourceId: pec.id,
			after: pec
		});
		return pec;
	}
}

export const masterDataService = new MasterDataService();
