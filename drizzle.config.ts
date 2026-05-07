import { defineConfig } from 'drizzle-kit';
import { databaseUrlFromEnv } from './src/lib/server/db/connection';

try {
	process.loadEnvFile?.();
} catch (error) {
	if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	dialect: 'postgresql',
	dbCredentials: { url: databaseUrlFromEnv(process.env) },
	verbose: true,
	strict: true
});
