import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'smol-toml';

export type PrivilegeDefinition = {
	description: string;
	roles: string[];
	resource: string;
	relationship?: string;
	audit?: boolean;
};

type Registry = {
	privileges: Record<string, PrivilegeDefinition>;
};

let cachedRegistry: Registry | undefined;
let cachedRegistryMtimeMs = 0;

export function getPrivilegeRegistry() {
	const path = join(process.cwd(), 'src/lib/server/authz/privileges.toml');
	const mtimeMs = statSync(path).mtimeMs;
	if (!cachedRegistry || cachedRegistryMtimeMs !== mtimeMs) {
		const raw = readFileSync(path, 'utf8');
		cachedRegistry = parse(raw) as unknown as Registry;
		cachedRegistryMtimeMs = mtimeMs;
	}
	return cachedRegistry;
}

export function getPrivilege(name: string) {
	return getPrivilegeRegistry().privileges[name];
}
