import { readFileSync } from 'node:fs';
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

export function getPrivilegeRegistry() {
	if (!cachedRegistry) {
		const raw = readFileSync(join(process.cwd(), 'src/lib/server/authz/privileges.toml'), 'utf8');
		cachedRegistry = parse(raw) as unknown as Registry;
	}
	return cachedRegistry;
}

export function getPrivilege(name: string) {
	return getPrivilegeRegistry().privileges[name];
}
