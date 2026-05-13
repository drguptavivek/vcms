import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_INSTALL_COMMAND = 'npm run test:e2e:install';

export type BrowserCheckInput = {
	executablePath?: string;
	timeoutMs?: number;
	installCommand?: string;
	accessExecutable?: (path: string) => Promise<void>;
};

export type BrowserCheckResult =
	| {
			ok: true;
			executablePath: string;
	  }
	| {
			ok: false;
			executablePath: string;
			message: string;
	  };

export async function checkPlaywrightChromium(input: BrowserCheckInput = {}) {
	const executablePath = input.executablePath ?? chromium.executablePath();
	const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const installCommand = input.installCommand ?? DEFAULT_INSTALL_COMMAND;
	const accessExecutable =
		input.accessExecutable ?? ((path: string) => access(path, constants.X_OK));

	try {
		await withTimeout(accessExecutable(executablePath), timeoutMs, executablePath);
		return { ok: true, executablePath } satisfies BrowserCheckResult;
	} catch (error) {
		return {
			ok: false,
			executablePath,
			message: buildFailureMessage({
				error,
				executablePath,
				installCommand,
				timeoutMs
			})
		} satisfies BrowserCheckResult;
	}
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, executablePath: string) {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<T>((_, reject) => {
		timeout = setTimeout(() => {
			reject(new Error(`Timed out after ${timeoutMs}ms checking ${executablePath}`));
		}, timeoutMs);
	});

	return Promise.race([promise, timeoutPromise]).finally(() => {
		if (timeout) clearTimeout(timeout);
	});
}

function buildFailureMessage(input: {
	error: unknown;
	executablePath: string;
	installCommand: string;
	timeoutMs: number;
}) {
	const reason = input.error instanceof Error ? input.error.message : String(input.error);

	return [
		'Playwright Chromium is not installed or is not executable.',
		`Expected browser executable: ${input.executablePath}`,
		`Check timeout: ${input.timeoutMs}ms`,
		`Reason: ${reason}`,
		'',
		'Run this one-time setup command before local E2E tests:',
		`  ${input.installCommand}`,
		'',
		'If network access is restricted, pre-populate the Playwright browser cache and set',
		'PLAYWRIGHT_BROWSERS_PATH to that cache before running npm run test:e2e.'
	].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const result = await checkPlaywrightChromium({
		timeoutMs: Number(process.env.PLAYWRIGHT_BROWSER_CHECK_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
		installCommand: process.env.PLAYWRIGHT_INSTALL_COMMAND ?? DEFAULT_INSTALL_COMMAND
	});

	if (!result.ok) {
		console.error(result.message);
		process.exitCode = 1;
	}
}
