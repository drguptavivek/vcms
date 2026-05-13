import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
import { checkPlaywrightChromium } from './check-playwright-browsers';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 4173;
const DEFAULT_TIMEOUT_MS = 5_000;

export type HostPortCheckInput = {
	host?: string;
	port?: number;
	timeoutMs?: number;
	bindProbe?: (host: string, port: number, timeoutMs: number) => Promise<void>;
};

export type HostPortCheckResult =
	| {
			ok: true;
			host: string;
			port: number;
	  }
	| {
			ok: false;
			host: string;
			port: number;
			message: string;
	  };

export async function checkPlaywrightHostPort(
	input: HostPortCheckInput = {}
): Promise<HostPortCheckResult> {
	const host = input.host ?? DEFAULT_HOST;
	const port = input.port ?? DEFAULT_PORT;
	const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const bindProbe = input.bindProbe ?? probeHostPort;

	try {
		await bindProbe(host, port, timeoutMs);
		return { ok: true, host, port };
	} catch (error) {
		return {
			ok: false,
			host,
			port,
			message: buildHostPortFailureMessage({ error, host, port, timeoutMs })
		};
	}
}

async function probeHostPort(host: string, port: number, timeoutMs: number) {
	await new Promise<void>((resolve, reject) => {
		const server = createServer();
		const timeout = setTimeout(() => {
			server.close();
			reject(new Error(`Timed out after ${timeoutMs}ms checking ${host}:${port}`));
		}, timeoutMs);

		server.once('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});
		server.listen({ host, port }, () => {
			clearTimeout(timeout);
			server.close((error) => {
				if (error) reject(error);
				else resolve();
			});
		});
	});
}

function buildHostPortFailureMessage(input: {
	error: unknown;
	host: string;
	port: number;
	timeoutMs: number;
}) {
	const reason = input.error instanceof Error ? input.error.message : String(input.error);

	return [
		'Playwright preview server cannot bind to the configured host/port.',
		`Configured address: ${input.host}:${input.port}`,
		`Check timeout: ${input.timeoutMs}ms`,
		`Reason: ${reason}`,
		'',
		'Make sure no other process is using the port and that this environment allows local',
		'listener sockets. To change the address, set PLAYWRIGHT_HOST and PLAYWRIGHT_PORT.',
		'In restricted sandboxes, run npm run test:e2e outside the sandbox or rely on',
		'npm run test:e2e:check to confirm the exact local blocker.'
	].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const browserResult = await checkPlaywrightChromium({
		timeoutMs: Number(process.env.PLAYWRIGHT_BROWSER_CHECK_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
		installCommand: process.env.PLAYWRIGHT_INSTALL_COMMAND ?? 'npm run test:e2e:install'
	});

	if (!browserResult.ok) {
		console.error(browserResult.message);
		process.exitCode = 1;
	} else {
		const hostPortResult = await checkPlaywrightHostPort({
			host: process.env.PLAYWRIGHT_HOST ?? DEFAULT_HOST,
			port: Number(process.env.PLAYWRIGHT_PORT ?? DEFAULT_PORT),
			timeoutMs: Number(process.env.PLAYWRIGHT_PORT_CHECK_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
		});

		if (!hostPortResult.ok) {
			console.error(hostPortResult.message);
			process.exitCode = 1;
		}
	}
}
