import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { encryptSecret } from './qz-crypto';
import { qzCredentialKeys } from './qz-integration.repository';
import { QzIntegrationService } from './qz-integration.service';

const certificatePem = ['-----BEGIN CERTIFICATE-----', 'fixture', '-----END CERTIFICATE-----'].join(
	'\n'
);

function repositoryFor(values: Record<string, string>) {
	return {
		get: vi.fn((key: string) =>
			Promise.resolve(
				values[key]
					? [
							{
								key,
								value: values[key],
								updatedAt: new Date('2026-05-08T00:00:00Z')
							}
						]
					: []
			)
		),
		upsert: vi.fn((input) => Promise.resolve([input]))
	};
}

describe('QzIntegrationService', () => {
	it('returns configured certificate text from encrypted DB storage', async () => {
		const repository = repositoryFor({
			[qzCredentialKeys.certificate]: JSON.stringify(encryptSecret(certificatePem, 'master-key'))
		});
		const service = new QzIntegrationService(repository, {
			QZ_CREDENTIAL_ENCRYPTION_KEY: 'master-key'
		});

		await expect(service.getCertificate()).resolves.toEqual({ certificate: certificatePem });
	});

	it('returns configured root CA certificate text from encrypted DB storage', async () => {
		const repository = repositoryFor({
			[qzCredentialKeys.rootCaCertificate]: JSON.stringify(
				encryptSecret(certificatePem, 'master-key')
			)
		});
		const service = new QzIntegrationService(repository, {
			QZ_CREDENTIAL_ENCRYPTION_KEY: 'master-key'
		});

		await expect(service.getRootCaCertificate()).resolves.toEqual({ certificate: certificatePem });
	});

	it('returns only public certificate material for the QZ Integration page', async () => {
		const repository = repositoryFor({
			[qzCredentialKeys.rootCaCertificate]: JSON.stringify(
				encryptSecret(certificatePem, 'master-key')
			),
			[qzCredentialKeys.certificate]: JSON.stringify(encryptSecret(certificatePem, 'master-key')),
			[qzCredentialKeys.rootCaPrivateKey]: JSON.stringify(
				encryptSecret('-----BEGIN PRIVATE KEY-----\nroot\n-----END PRIVATE KEY-----', 'master-key')
			),
			[qzCredentialKeys.privateKey]: JSON.stringify(
				encryptSecret('-----BEGIN PRIVATE KEY-----\nleaf\n-----END PRIVATE KEY-----', 'master-key')
			)
		});
		const service = new QzIntegrationService(repository, {
			QZ_CREDENTIAL_ENCRYPTION_KEY: 'master-key'
		});

		await expect(service.getCurrentPublicCertificates()).resolves.toEqual({
			rootCaCertificatePem: certificatePem,
			rootCaFingerprint: '',
			certificatePem
		});
	});

	it('reports DB credential status without exposing secret contents', async () => {
		const repository = repositoryFor({
			[qzCredentialKeys.certificate]: JSON.stringify(encryptSecret(certificatePem, 'master-key')),
			[qzCredentialKeys.privateKey]: JSON.stringify(
				encryptSecret(
					['-----BEGIN PRIVATE KEY-----', 'fixture', '-----END PRIVATE KEY-----'].join('\n'),
					'master-key'
				)
			)
		});
		const service = new QzIntegrationService(repository, {
			QZ_CREDENTIAL_ENCRYPTION_KEY: 'master-key'
		});

		const status = await service.getStatus();
		expect(status).toMatchObject({
			certificate: { configured: true, source: 'database', readable: true },
			privateKey: { configured: true, source: 'database', readable: true },
			encryptionKey: { configured: true, keyId: expect.any(String) },
			signingAlgorithm: 'SHA512'
		});
		expect(JSON.stringify(status)).not.toContain('fixture');
	});

	it('signs QZ payloads with encrypted DB private key', async () => {
		const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
		const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
		const repository = repositoryFor({
			[qzCredentialKeys.privateKey]: JSON.stringify(encryptSecret(privateKeyPem, 'master-key'))
		});
		const service = new QzIntegrationService(repository, {
			QZ_CREDENTIAL_ENCRYPTION_KEY: 'master-key'
		});
		const toSign = 'qz-payload-hash';

		const { signature } = await service.sign({ toSign });
		const verifier = createVerify('SHA512');
		verifier.update(toSign, 'utf8');
		verifier.end();

		expect(verifier.verify(publicKey, signature, 'base64')).toBe(true);
	});
});
