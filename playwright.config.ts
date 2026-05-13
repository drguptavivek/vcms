import { defineConfig } from '@playwright/test';

const host = process.env.PLAYWRIGHT_HOST ?? '127.0.0.1';
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);

export default defineConfig({
	webServer: {
		command: `npm run build && npm run preview -- --host ${host} --port ${port}`,
		url: `http://${host}:${port}`
	},
	testMatch: '**/*.e2e.{ts,js}'
});
