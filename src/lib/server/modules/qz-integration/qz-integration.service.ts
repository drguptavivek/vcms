import { X509Certificate, createHash, createSign } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { env } from '$env/dynamic/private';
import { db } from '$lib/server/db';
import { AppError } from '$lib/server/observability/errors';
import { logger } from '$lib/server/observability/logger';
import { writeAudit } from '$lib/server/observability/audit';
import { decryptSecret, encryptSecret, encryptionKeyStatus } from './qz-crypto';
import { qzCredentialKeys, QzIntegrationRepository } from './qz-integration.repository';

type QzIntegrationConfig = Record<string, string | undefined> & {
	QZ_CREDENTIAL_ENCRYPTION_KEY?: string;
};

type QzSettingRecord = {
	value: string;
	updatedAt: Date | null;
};

type QzCredentialRepository = {
	get(key: string): PromiseLike<QzSettingRecord[]>;
	upsert(input: {
		key: string;
		value: string;
		description: string;
		updatedBy: string;
	}): PromiseLike<unknown>;
};

const CERTIFICATE_BEGIN = '-----BEGIN CERTIFICATE-----';
const PRIVATE_KEY_BEGIN = '-----BEGIN';
const execFileAsync = promisify(execFile);

type SecretStatus = {
	configured: boolean;
	source: 'database';
	readable: boolean;
	keyId?: string;
	updatedAt?: Date;
	error?: string;
};

type QzIntegrationStatus = {
	rootCaCertificate: SecretStatus;
	rootCaPrivateKey: SecretStatus;
	certificate: SecretStatus;
	privateKey: SecretStatus;
	privateKeyPassphraseConfigured: boolean;
	encryptionKey: { configured: boolean; keyId: string | null };
	signingAlgorithm: 'SHA512';
	certificateEndpoint: string;
	signingEndpoint: string;
};

export class QzIntegrationService {
	constructor(
		private readonly repository: QzCredentialRepository = new QzIntegrationRepository(),
		private readonly config: QzIntegrationConfig = env
	) {}

	async getStatus(): Promise<QzIntegrationStatus> {
		const [
			rootCaCertificateStatus,
			rootCaPrivateKeyStatus,
			certificateStatus,
			privateKeyStatus,
			privateKeyPassphraseStatus
		] = await Promise.all([
			this.getDbSecretStatus(qzCredentialKeys.rootCaCertificate, CERTIFICATE_BEGIN),
			this.getDbSecretStatus(qzCredentialKeys.rootCaPrivateKey, PRIVATE_KEY_BEGIN),
			this.getDbSecretStatus(qzCredentialKeys.certificate, CERTIFICATE_BEGIN),
			this.getDbSecretStatus(qzCredentialKeys.privateKey, PRIVATE_KEY_BEGIN),
			this.getDbSecretStatus(qzCredentialKeys.privateKeyPassphrase, '')
		]);

		return {
			rootCaCertificate: rootCaCertificateStatus,
			rootCaPrivateKey: rootCaPrivateKeyStatus,
			certificate: certificateStatus,
			privateKey: privateKeyStatus,
			privateKeyPassphraseConfigured: privateKeyPassphraseStatus.configured,
			encryptionKey: encryptionKeyStatus(this.config.QZ_CREDENTIAL_ENCRYPTION_KEY),
			signingAlgorithm: 'SHA512',
			certificateEndpoint: '/api/v1/qz/certificate',
			signingEndpoint: '/api/v1/qz/sign'
		};
	}

	async saveCredentials(input: {
		rootCaCertificatePem?: string;
		rootCaPrivateKeyPem?: string;
		certificatePem: string;
		privateKeyPem: string;
		privateKeyPassphrase?: string;
		reason: string;
		userId: string;
		requestId: string;
		ipAddress?: string;
		userAgent?: string;
	}) {
		const rootCaCertificate = input.rootCaCertificatePem?.trim() ?? '';
		const rootCaPrivateKey = input.rootCaPrivateKeyPem?.trim() ?? '';
		const certificate = input.certificatePem.trim();
		const privateKey = input.privateKeyPem.trim();
		const passphrase = input.privateKeyPassphrase?.trim() ?? '';

		if (!certificate.includes(CERTIFICATE_BEGIN)) {
			throw new AppError('QZ_CERTIFICATE_INVALID', 'QZ Tray certificate is invalid.', 400);
		}
		if (!privateKey.includes(PRIVATE_KEY_BEGIN)) {
			throw new AppError('QZ_PRIVATE_KEY_INVALID', 'QZ Tray private key is invalid.', 400);
		}
		if (rootCaCertificate && !rootCaCertificate.includes(CERTIFICATE_BEGIN)) {
			throw new AppError('QZ_ROOT_CA_INVALID', 'QZ Tray root CA certificate is invalid.', 400);
		}
		if (rootCaPrivateKey && !rootCaPrivateKey.includes(PRIVATE_KEY_BEGIN)) {
			throw new AppError('QZ_ROOT_CA_KEY_INVALID', 'QZ Tray root CA private key is invalid.', 400);
		}

		const before = await this.getStatus();
		const masterKey = this.requireMasterKey();
		const encryptedRootCaCertificate = rootCaCertificate
			? encryptSecret(rootCaCertificate, masterKey)
			: null;
		const encryptedRootCaPrivateKey = rootCaPrivateKey
			? encryptSecret(rootCaPrivateKey, masterKey)
			: null;
		const encryptedCertificate = encryptSecret(certificate, masterKey);
		const encryptedPrivateKey = encryptSecret(privateKey, masterKey);
		const encryptedPassphrase = passphrase ? encryptSecret(passphrase, masterKey) : null;

		if (encryptedRootCaCertificate) {
			await this.repository.upsert({
				key: qzCredentialKeys.rootCaCertificate,
				value: JSON.stringify(encryptedRootCaCertificate),
				description: 'Encrypted QZ Tray VCMS root CA certificate',
				updatedBy: input.userId
			});
		}
		if (encryptedRootCaPrivateKey) {
			await this.repository.upsert({
				key: qzCredentialKeys.rootCaPrivateKey,
				value: JSON.stringify(encryptedRootCaPrivateKey),
				description: 'Encrypted QZ Tray VCMS root CA private key',
				updatedBy: input.userId
			});
		}
		await this.repository.upsert({
			key: qzCredentialKeys.certificate,
			value: JSON.stringify(encryptedCertificate),
			description: 'Encrypted QZ Tray browser signing certificate',
			updatedBy: input.userId
		});
		await this.repository.upsert({
			key: qzCredentialKeys.privateKey,
			value: JSON.stringify(encryptedPrivateKey),
			description: 'Encrypted QZ Tray private signing key',
			updatedBy: input.userId
		});
		if (encryptedPassphrase) {
			await this.repository.upsert({
				key: qzCredentialKeys.privateKeyPassphrase,
				value: JSON.stringify(encryptedPassphrase),
				description: 'Encrypted QZ Tray private key passphrase',
				updatedBy: input.userId
			});
		}

		await writeAudit(db, {
			requestId: input.requestId,
			actorUserId: input.userId,
			action: 'qz.credentials.update',
			resourceType: 'system',
			resourceId: 'qz-tray',
			reason: input.reason,
			before,
			after: await this.getStatus(),
			ipAddress: input.ipAddress,
			userAgent: input.userAgent
		});

		return this.getStatus();
	}

	async generateAndSaveCredentials(input: {
		reason: string;
		userId: string;
		requestId: string;
		ipAddress?: string;
		userAgent?: string;
	}) {
		const generated = await this.generateCredentials();
		await this.saveCredentials({
			...generated,
			reason: input.reason,
			userId: input.userId,
			requestId: input.requestId,
			ipAddress: input.ipAddress,
			userAgent: input.userAgent
		});
		return this.getCurrentCredentials();
	}

	async getCurrentCredentials() {
		return {
			rootCaCertificatePem: await this.readOptionalDbSecretForDisplay(
				qzCredentialKeys.rootCaCertificate
			),
			rootCaPrivateKeyPem: await this.readOptionalDbSecretForDisplay(
				qzCredentialKeys.rootCaPrivateKey
			),
			certificatePem: await this.readOptionalDbSecretForDisplay(qzCredentialKeys.certificate),
			privateKeyPem: await this.readOptionalDbSecretForDisplay(qzCredentialKeys.privateKey),
			privateKeyPassphrase: await this.readOptionalDbSecretForDisplay(
				qzCredentialKeys.privateKeyPassphrase
			)
		};
	}

	async getCurrentPublicCertificates() {
		const rootCaCertificatePem = await this.readOptionalDbSecretForDisplay(
			qzCredentialKeys.rootCaCertificate
		);
		return {
			rootCaCertificatePem,
			rootCaFingerprint: rootCaCertificatePem ? certificateFingerprint(rootCaCertificatePem) : '',
			certificatePem: await this.readOptionalDbSecretForDisplay(qzCredentialKeys.certificate)
		};
	}

	async getCertificate() {
		const certificate = await this.readDbSecret(
			qzCredentialKeys.certificate,
			CERTIFICATE_BEGIN,
			'QZ certificate'
		);
		return { certificate };
	}

	async getRootCaCertificate() {
		const certificate = await this.readDbSecret(
			qzCredentialKeys.rootCaCertificate,
			CERTIFICATE_BEGIN,
			'QZ root CA certificate'
		);
		return { certificate };
	}

	async sign(input: { toSign: string }) {
		const [privateKey, passphrase] = await Promise.all([
			this.readDbSecret(qzCredentialKeys.privateKey, PRIVATE_KEY_BEGIN, 'QZ private key'),
			this.readOptionalDbSecret(qzCredentialKeys.privateKeyPassphrase)
		]);

		try {
			const signer = createSign('SHA512');
			signer.update(input.toSign, 'utf8');
			signer.end();
			const signature = signer.sign(
				{
					key: privateKey,
					passphrase: passphrase || undefined
				},
				'base64'
			);
			return { signature };
		} catch (error) {
			logger.error({ err: error instanceof Error ? error.message : error }, 'QZ signing failed');
			throw new AppError('QZ_SIGNING_FAILED', 'QZ Tray signing failed.', 500);
		}
	}

	private async getDbSecretStatus(key: string, requiredMarker: string): Promise<SecretStatus> {
		const [setting] = await this.repository.get(key);
		if (!setting) return { configured: false, source: 'database', readable: false };

		try {
			const payload = JSON.parse(setting.value) as unknown;
			const decrypted = decryptSecret(payload, this.requireMasterKey());
			const markerOk = requiredMarker ? decrypted.includes(requiredMarker) : true;
			return {
				configured: true,
				source: 'database',
				readable: markerOk,
				keyId:
					typeof payload === 'object' && payload
						? String((payload as { keyId?: string }).keyId)
						: undefined,
				updatedAt: setting.updatedAt ?? undefined,
				error: markerOk ? undefined : 'Stored credential is malformed.'
			};
		} catch (error) {
			return {
				configured: true,
				source: 'database',
				readable: false,
				updatedAt: setting.updatedAt ?? undefined,
				error: error instanceof Error ? error.message : 'Stored credential is not readable.'
			};
		}
	}

	private async readDbSecret(key: string, requiredMarker: string, label: string) {
		const [setting] = await this.repository.get(key);
		if (!setting)
			throw new AppError('QZ_CREDENTIAL_NOT_CONFIGURED', `${label} is not configured.`, 500);
		const value = decryptSecret(JSON.parse(setting.value) as unknown, this.requireMasterKey());
		if (!value.includes(requiredMarker)) {
			throw new AppError('QZ_CREDENTIAL_INVALID', `${label} is invalid.`, 500);
		}
		return value;
	}

	private async readOptionalDbSecret(key: string) {
		const [setting] = await this.repository.get(key);
		if (!setting) return '';
		return decryptSecret(JSON.parse(setting.value) as unknown, this.requireMasterKey());
	}

	private async readOptionalDbSecretForDisplay(key: string) {
		try {
			return await this.readOptionalDbSecret(key);
		} catch {
			return '';
		}
	}

	private async generateCredentials() {
		const dir = await mkdtemp(join(tmpdir(), 'vcms-qz-'));
		try {
			const rootKey = join(dir, 'vcms-root-ca-key.pem');
			const rootCert = join(dir, 'vcms-root-ca.crt');
			const leafKey = join(dir, 'private-key.pem');
			const leafCsr = join(dir, 'vcms-qz.csr');
			const leafCert = join(dir, 'digital-certificate.txt');
			const rootConfig = join(dir, 'root-ca.cnf');
			const leafExt = join(dir, 'leaf.ext');

			await writeFile(
				rootConfig,
				[
					'[req]',
					'distinguished_name = dn',
					'x509_extensions = v3_ca',
					'prompt = no',
					'',
					'[dn]',
					'C = IN',
					'ST = Delhi',
					'L = Delhi',
					'O = VCMS',
					'OU = QZ Tray',
					'CN = VCMS QZ Tray Local Root CA',
					'',
					'[v3_ca]',
					'basicConstraints = critical, CA:true',
					'keyUsage = critical, keyCertSign, cRLSign',
					'subjectKeyIdentifier = hash',
					'authorityKeyIdentifier = keyid:always,issuer'
				].join('\n')
			);
			await writeFile(
				leafExt,
				[
					'basicConstraints = critical, CA:false',
					'keyUsage = critical, digitalSignature',
					'extendedKeyUsage = codeSigning',
					'subjectKeyIdentifier = hash',
					'authorityKeyIdentifier = keyid,issuer'
				].join('\n')
			);

			await execFileAsync('openssl', ['genrsa', '-out', rootKey, '2048']);
			await execFileAsync('openssl', [
				'req',
				'-x509',
				'-new',
				'-nodes',
				'-key',
				rootKey,
				'-sha512',
				'-days',
				'3650',
				'-out',
				rootCert,
				'-config',
				rootConfig
			]);
			await execFileAsync('openssl', ['genrsa', '-out', leafKey, '2048']);
			await execFileAsync('openssl', [
				'req',
				'-new',
				'-key',
				leafKey,
				'-out',
				leafCsr,
				'-subj',
				'/C=IN/ST=Delhi/L=Delhi/O=VCMS/OU=QZ Tray/CN=VCMS QZ Browser Signing'
			]);
			await execFileAsync('openssl', [
				'x509',
				'-req',
				'-in',
				leafCsr,
				'-CA',
				rootCert,
				'-CAkey',
				rootKey,
				'-CAcreateserial',
				'-out',
				leafCert,
				'-days',
				'825',
				'-sha512',
				'-extfile',
				leafExt
			]);

			return {
				rootCaCertificatePem: await readFile(rootCert, 'utf8'),
				rootCaPrivateKeyPem: await readFile(rootKey, 'utf8'),
				certificatePem: await readFile(leafCert, 'utf8'),
				privateKeyPem: await readFile(leafKey, 'utf8'),
				privateKeyPassphrase: ''
			};
		} catch (error) {
			logger.error(
				{ err: error instanceof Error ? error.message : error },
				'QZ autogenerate failed'
			);
			throw new AppError('QZ_CREDENTIAL_GENERATE_FAILED', 'QZ credential generation failed.', 500);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}

	private requireMasterKey() {
		const masterKey = this.config.QZ_CREDENTIAL_ENCRYPTION_KEY;
		if (!masterKey?.trim()) {
			throw new AppError(
				'QZ_CREDENTIAL_KEY_MISSING',
				'QZ credential encryption key is not configured.',
				500
			);
		}
		return masterKey;
	}
}

export const qzIntegrationService = new QzIntegrationService();

function certificateFingerprint(pem: string) {
	try {
		const certificate = new X509Certificate(pem);
		return createHash('sha1').update(certificate.raw).digest('hex');
	} catch {
		return '';
	}
}
