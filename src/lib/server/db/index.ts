import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { databaseUrlFromEnv } from './connection';
import { env } from '$env/dynamic/private';

const client = postgres(databaseUrlFromEnv(env));

export const db = drizzle(client, { schema });
