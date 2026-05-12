import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { account } from '../src/lib/server/db/auth.schema.ts';
import {
	roles,
	teams,
	pecs,
	user,
	userRoles,
	userPecAllocations,
	userProfiles,
	printerTemplates,
	masSettings
} from '../src/lib/server/db/schema.ts';
import { databaseUrlFromEnv } from '../src/lib/server/db/connection.ts';

try {
	process.loadEnvFile?.();
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

const client = postgres(databaseUrlFromEnv(process.env), { max: 1 });
const db = drizzle(client);

const seedPecs = [
	[17, 'Trilokpuri', 1],
	[44, 'Dharuhera', 2],
	[25, 'Mehrauli', 2],
	[13, 'Nangli', 2],
	[31, 'Jaunapur', 2],
	[32, 'Fatehpur Beri', 2],
	[54, 'Madipur', 4],
	[16, 'Jatkhor', 3],
	[50, 'Sohna', 3],
	[34, 'Tauru', 3],
	[46, 'Patel Garden', 3],
	[43, 'Janak puri', 3],
	[4, 'Sanjay Colony', 3],
	[36, 'Nangal Raya', 4],
	[45, 'Chirag Delhi', 4],
	[39, 'Basant Gaon', 4],
	[49, 'Sarai Kale Khan', 2],
	[52, 'Batla House', 4],
	[53, 'Garhi', 4],
	[47, 'Punjabi Bagh/SSMI', 5],
	[99, 'RIP/Camp', 5],
	[55, 'Majnu ka Tila', 5]
] as const;

async function upsertRole(name: string, description: string) {
	const [existing] = await db.select().from(roles).where(eq(roles.name, name)).limit(1);
	if (existing) return existing;
	const [created] = await db.insert(roles).values({ name, description }).returning();
	return created;
}

async function upsertUser(id: string, name: string, email: string) {
	await db
		.insert(user)
		.values({
			id,
			name,
			email,
			emailVerified: true
		})
		.onConflictDoUpdate({
			target: user.id,
			set: {
				name,
				email,
				emailVerified: true,
				updatedAt: new Date()
			}
		});

	await db.insert(userProfiles).values({ userId: id }).onConflictDoNothing();
}

async function upsertPasswordAccount(userId: string, password: string) {
	const hashedPassword = await hashPassword(password);
	await db
		.insert(account)
		.values({
			id: `${userId}:credential`,
			accountId: userId,
			providerId: 'credential',
			userId,
			password: hashedPassword
		})
		.onConflictDoUpdate({
			target: account.id,
			set: {
				accountId: userId,
				providerId: 'credential',
				userId,
				password: hashedPassword,
				updatedAt: new Date()
			}
		});
}

async function grantRole(userId: string, roleId: number) {
	await db.insert(userRoles).values({ userId, roleId }).onConflictDoNothing();
}

async function main() {
	const currentBarcodeYear = new Date().getFullYear() % 100;

	for (const code of [1, 2, 3, 4, 5]) {
		await db
			.insert(teams)
			.values({ code, name: `Team ${code}` })
			.onConflictDoNothing();
	}

	const teamRows = await db.select().from(teams);
	const teamByCode = new Map(teamRows.map((team) => [team.code, team]));

	for (const [code, name, teamCode] of seedPecs) {
		const team = teamByCode.get(teamCode);
		if (!team) throw new Error(`Missing team ${teamCode}`);
		await db.insert(pecs).values({ code, name, teamId: team.id }).onConflictDoNothing();
	}

	const adminRole = await upsertRole('admin', 'System administrator');
	const managerRole = await upsertRole('barcode_print_manager', 'Barcode print manager');

	const adminEmail = process.env.DEV_ADMIN_EMAIL ?? 'admin@example.test';
	const adminPassword = process.env.DEV_ADMIN_PASSWORD ?? 'ChangeMe123!';
	const emrTesterEmail = process.env.DEV_EMR_TESTER_EMAIL ?? 'emr.tester@example.test';
	const emrTesterPassword = process.env.DEV_EMR_TESTER_PASSWORD ?? 'ChangeMe123!';

	await upsertUser('dev-admin', 'Development Admin', adminEmail);
	await upsertPasswordAccount('dev-admin', adminPassword);
	await grantRole('dev-admin', adminRole.id);
	await grantRole('dev-admin', managerRole.id);

	await upsertUser('emr-runtime-tester', 'EMR Runtime Tester', emrTesterEmail);
	await upsertPasswordAccount('emr-runtime-tester', emrTesterPassword);
	await grantRole('emr-runtime-tester', managerRole.id);

	const allPecs = await db.select().from(pecs);
	for (const pec of allPecs) {
		await db
			.insert(userPecAllocations)
			.values({ userId: 'dev-admin', pecId: pec.id })
			.onConflictDoNothing();
		await db
			.insert(userPecAllocations)
			.values({ userId: 'emr-runtime-tester', pecId: pec.id })
			.onConflictDoNothing();
	}

	await db
		.insert(printerTemplates)
		.values([
			{
				name: 'Browser/PDF Default',
				type: 'html_pdf',
				widthMm: 50,
				heightMm: 25,
				dpi: 203,
				barcodeHeight: 80,
				layout: {},
				createdBy: 'dev-admin'
			},
			{
				name: 'ZPL 50x25 203dpi',
				type: 'zpl',
				widthMm: 50,
				heightMm: 25,
				dpi: 203,
				barcodeHeight: 80,
				layout: { barcodeX: 40, barcodeY: 24, textY: 120 },
				createdBy: 'dev-admin'
			},
			{
				name: 'EPL 50x25 203dpi',
				type: 'epl',
				widthMm: 50,
				heightMm: 25,
				dpi: 203,
				barcodeHeight: 80,
				layout: { barcodeX: 40, barcodeY: 24, textY: 120 },
				createdBy: 'dev-admin'
			}
		])
		.onConflictDoNothing();

	await db
		.insert(masSettings)
		.values({
			key: 'barcode.current_year',
			value: String(currentBarcodeYear),
			description: 'Current operational barcode year YY used by the print dashboard',
			updatedBy: 'dev-admin'
		})
		.onConflictDoNothing();

	console.log(`Seed complete. Local admin login: ${adminEmail} / ${adminPassword}`);
	console.log(`EMR test login: ${emrTesterEmail} / ${emrTesterPassword}`);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await client.end();
	});
