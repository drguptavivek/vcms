import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	scryptSync,
	type BinaryLike
} from 'node:crypto';
import { AppError } from '$lib/server/observability/errors';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const AUTH_TAG_BYTES = 16;
const KEY_ID_BYTES = 8;
const SALT_BYTES = 16;

type EncryptedPayload = {
	version: 1;
	algorithm: 'aes-256-gcm';
	keyId: string;
	kdf: 'scrypt';
	salt: string;
	iv: string;
	authTag: string;
	ciphertext: string;
};

export function encryptSecret(plaintext: string, masterKey: string): EncryptedPayload {
	const salt = randomBytes(SALT_BYTES);
	const key = deriveKey(masterKey, salt);
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_BYTES });
	const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();

	return {
		version: 1,
		algorithm: ALGORITHM,
		keyId: keyId(masterKey),
		kdf: 'scrypt',
		salt: salt.toString('base64url'),
		iv: iv.toString('base64url'),
		authTag: authTag.toString('base64url'),
		ciphertext: ciphertext.toString('base64url')
	};
}

export function decryptSecret(payload: unknown, masterKey: string) {
	const parsed = parsePayload(payload);
	const key = deriveKey(masterKey, Buffer.from(parsed.salt, 'base64url'));
	if (parsed.keyId !== keyId(masterKey)) {
		throw new AppError('QZ_CREDENTIAL_KEY_MISMATCH', 'QZ credential encryption key mismatch.', 500);
	}

	try {
		const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(parsed.iv, 'base64url'), {
			authTagLength: AUTH_TAG_BYTES
		});
		decipher.setAuthTag(Buffer.from(parsed.authTag, 'base64url'));
		return Buffer.concat([
			decipher.update(Buffer.from(parsed.ciphertext, 'base64url')),
			decipher.final()
		]).toString('utf8');
	} catch {
		throw new AppError('QZ_CREDENTIAL_DECRYPT_FAILED', 'QZ credential decryption failed.', 500);
	}
}

export function encryptionKeyStatus(masterKey: string | undefined) {
	if (!masterKey?.trim()) {
		return { configured: false, keyId: null };
	}
	return { configured: true, keyId: keyId(masterKey) };
}

function deriveKey(masterKey: string, salt: Buffer) {
	if (!masterKey.trim()) {
		throw new AppError(
			'QZ_CREDENTIAL_KEY_MISSING',
			'QZ credential encryption key is not set.',
			500
		);
	}
	return scryptSync(masterKey, salt, KEY_BYTES, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
}

function keyId(masterKey: BinaryLike) {
	return createHash('sha256')
		.update(masterKey)
		.digest('hex')
		.slice(0, KEY_ID_BYTES * 2);
}

function parsePayload(payload: unknown): EncryptedPayload {
	if (
		!payload ||
		typeof payload !== 'object' ||
		(payload as EncryptedPayload).version !== 1 ||
		(payload as EncryptedPayload).algorithm !== ALGORITHM ||
		typeof (payload as EncryptedPayload).keyId !== 'string' ||
		(payload as EncryptedPayload).kdf !== 'scrypt' ||
		typeof (payload as EncryptedPayload).salt !== 'string' ||
		typeof (payload as EncryptedPayload).iv !== 'string' ||
		typeof (payload as EncryptedPayload).authTag !== 'string' ||
		typeof (payload as EncryptedPayload).ciphertext !== 'string'
	) {
		throw new AppError('QZ_CREDENTIAL_FORMAT_INVALID', 'QZ credential record is invalid.', 500);
	}
	return payload as EncryptedPayload;
}
