import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { masSettings } from '$lib/server/db/schema';

export const qzCredentialKeys = {
	rootCaCertificate: 'qz.credentials.root_ca_certificate',
	rootCaPrivateKey: 'qz.credentials.root_ca_private_key',
	certificate: 'qz.credentials.certificate',
	privateKey: 'qz.credentials.private_key',
	privateKeyPassphrase: 'qz.credentials.private_key_passphrase'
} as const;

export class QzIntegrationRepository {
	constructor(private readonly database = db) {}

	get(key: string) {
		return this.database.select().from(masSettings).where(eq(masSettings.key, key)).limit(1);
	}

	upsert(input: { key: string; value: string; description: string; updatedBy: string }) {
		return this.database
			.insert(masSettings)
			.values({
				key: input.key,
				value: input.value,
				description: input.description,
				updatedBy: input.updatedBy
			})
			.onConflictDoUpdate({
				target: masSettings.key,
				set: {
					value: input.value,
					description: input.description,
					updatedBy: input.updatedBy,
					updatedAt: new Date()
				}
			})
			.returning();
	}
}
