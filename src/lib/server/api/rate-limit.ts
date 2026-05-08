import { rateLimited } from '$lib/server/observability/errors';

export type RateLimitPolicy = {
	name: string;
	limit: number;
	windowSeconds: number;
};

const buckets = new Map<string, { count: number; resetAt: number }>();
let lastCleanupAt = 0;

export const rateLimitPolicies = {
	read: { name: 'read', limit: 120, windowSeconds: 60 },
	mutation: { name: 'mutation', limit: 30, windowSeconds: 60 },
	auth: { name: 'auth', limit: 10, windowSeconds: 60 },
	barcodeMutation: { name: 'barcode_mutation', limit: 15, windowSeconds: 60 },
	qzSigning: { name: 'qz_signing', limit: 60, windowSeconds: 60 },
	sensitive: { name: 'sensitive', limit: 8, windowSeconds: 60 }
} satisfies Record<string, RateLimitPolicy>;

export function enforceRateLimit(policy: RateLimitPolicy, identity: string) {
	const now = Date.now();
	if (now - lastCleanupAt > 60_000) {
		for (const [key, bucket] of buckets.entries()) {
			if (bucket.resetAt <= now) buckets.delete(key);
		}
		lastCleanupAt = now;
	}

	const key = `${policy.name}:${identity}`;
	const existing = buckets.get(key);

	if (!existing || existing.resetAt <= now) {
		buckets.set(key, { count: 1, resetAt: now + policy.windowSeconds * 1000 });
		return;
	}

	if (existing.count >= policy.limit) {
		const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
		throw rateLimited(retryAfterSeconds);
	}

	existing.count += 1;
}
