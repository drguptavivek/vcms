import { createHmac, timingSafeEqual } from 'node:crypto';
import { devAuthSecret } from './dev-settings';

export function signDevUserId(userId: string) {
	const signature = createHmac('sha256', devAuthSecret()).update(userId).digest('base64url');
	return `${userId}.${signature}`;
}

export function verifyDevUserCookie(value: string | undefined) {
	if (!value) return undefined;
	const separatorIndex = value.lastIndexOf('.');
	if (separatorIndex <= 0) return undefined;

	const userId = value.slice(0, separatorIndex);
	const signature = value.slice(separatorIndex + 1);
	const expected = createHmac('sha256', devAuthSecret()).update(userId).digest('base64url');

	const signatureBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expected);
	if (signatureBuffer.length !== expectedBuffer.length) return undefined;
	if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return undefined;
	return userId;
}
