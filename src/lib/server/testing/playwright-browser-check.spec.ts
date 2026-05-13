import { describe, expect, it, vi } from 'vitest';
import { checkPlaywrightHostPort } from '../../../../scripts/check-playwright-e2e';
import { checkPlaywrightChromium } from '../../../../scripts/check-playwright-browsers';

describe('checkPlaywrightChromium', () => {
	it('returns ok when the configured Chromium executable is accessible', async () => {
		const accessExecutable = vi.fn(async () => undefined);

		const result = await checkPlaywrightChromium({
			executablePath: '/tmp/chromium',
			accessExecutable
		});

		expect(result).toMatchObject({
			ok: true,
			executablePath: '/tmp/chromium'
		});
		expect(accessExecutable).toHaveBeenCalledWith('/tmp/chromium');
	});

	it('fails quickly with actionable install guidance when Chromium is missing', async () => {
		const accessExecutable = vi.fn(async () => {
			throw new Error('ENOENT');
		});

		const result = await checkPlaywrightChromium({
			executablePath: '/missing/chromium',
			accessExecutable,
			installCommand: 'npm run test:e2e:install',
			timeoutMs: 100
		});

		expect(result).toMatchObject({
			ok: false,
			executablePath: '/missing/chromium'
		});
		if (!result.ok) {
			expect(result.message).toContain('Playwright Chromium is not installed');
			expect(result.message).toContain('npm run test:e2e:install');
			expect(result.message).toContain('PLAYWRIGHT_BROWSERS_PATH');
		}
	});

	it('returns ok when the configured Playwright host and port can bind', async () => {
		const bindProbe = vi.fn(async () => undefined);

		const result = await checkPlaywrightHostPort({
			host: '127.0.0.1',
			port: 4173,
			bindProbe
		});

		expect(result).toMatchObject({
			ok: true,
			host: '127.0.0.1',
			port: 4173
		});
		expect(bindProbe).toHaveBeenCalledWith('127.0.0.1', 4173, expect.any(Number));
	});

	it('fails quickly with actionable guidance when the preview server cannot bind', async () => {
		const bindProbe = vi.fn(async () => {
			throw new Error('listen EPERM 127.0.0.1:4173');
		});

		const result = await checkPlaywrightHostPort({
			host: '127.0.0.1',
			port: 4173,
			bindProbe,
			timeoutMs: 100
		});

		expect(result).toMatchObject({
			ok: false,
			host: '127.0.0.1',
			port: 4173
		});
		if (!result.ok) {
			expect(result.message).toContain('Playwright preview server cannot bind');
			expect(result.message).toContain('PLAYWRIGHT_HOST');
			expect(result.message).toContain('PLAYWRIGHT_PORT');
			expect(result.message).toContain('restricted sandboxes');
		}
	});
});
