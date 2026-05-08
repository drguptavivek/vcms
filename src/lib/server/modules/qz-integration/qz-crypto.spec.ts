import { describe, expect, it } from 'vitest';
import { AppError } from '$lib/server/observability/errors';
import { decryptSecret, encryptSecret, encryptionKeyStatus } from './qz-crypto';

describe('QZ credential encryption', () => {
	it('round-trips secrets with AES-256-GCM payload metadata', () => {
		const payload = encryptSecret('secret-value', 'master-key');

		expect(payload).toMatchObject({
			version: 1,
			algorithm: 'aes-256-gcm',
			keyId: expect.any(String),
			kdf: 'scrypt',
			salt: expect.any(String)
		});
		expect(payload.ciphertext).not.toContain('secret-value');
		expect(decryptSecret(payload, 'master-key')).toBe('secret-value');
	});

	it('rejects decryption with the wrong key', () => {
		const payload = encryptSecret('secret-value', 'master-key');

		expect(() => decryptSecret(payload, 'wrong-key')).toThrow(AppError);
	});

	it('reports external encryption-key status without exposing the key', () => {
		expect(encryptionKeyStatus('master-key')).toEqual({
			configured: true,
			keyId: expect.any(String)
		});
		expect(encryptionKeyStatus(undefined)).toEqual({ configured: false, keyId: null });
	});
});
