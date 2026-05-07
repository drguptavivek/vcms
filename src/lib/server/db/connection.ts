type DatabaseEnv = {
	DB_HOST?: string;
	DB_PORT?: string;
	DB_NAME?: string;
	DB_USER?: string;
	DB_PASSWORD?: string;
};

function requireEnv(env: DatabaseEnv, key: keyof DatabaseEnv): string {
	const value = env[key];
	if (!value) throw new Error(`${key} is not set`);
	return value;
}

export function databaseUrlFromEnv(env: DatabaseEnv): string {
	const host = requireEnv(env, 'DB_HOST');
	const port = requireEnv(env, 'DB_PORT');
	const name = requireEnv(env, 'DB_NAME');
	const user = requireEnv(env, 'DB_USER');
	const password = requireEnv(env, 'DB_PASSWORD');

	return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(name)}`;
}
