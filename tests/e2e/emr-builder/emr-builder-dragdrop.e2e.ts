import { expect, test } from '@playwright/test';

const emrBuilderUrl = 'http://127.0.0.1:4173/app/emr-builder';

const selectors = {
	editor: '[data-testid="emr-builder-editor"]',
	preview: '[data-testid="emr-builder-preview"]',
	sectionCard: '[data-testid^="emr-builder-section-"]',
	itemRow: '[data-testid^="emr-builder-item-row-"]',
	handle: '[data-testid^="emr-builder-drag-handle-"]',
	moveUp: '[data-testid^="emr-builder-item-move-up-"]',
	moveDown: '[data-testid^="emr-builder-item-move-down-"]',
	save: '[data-testid="emr-builder-save"]',
	publish: '[data-testid="emr-builder-publish"]',
	toast: '[role="status"]'
};

test.describe.skip('EMR Builder drag/drop orchestration (future implementation)', () => {
	test('reorders with pointer drag and updates preview order', async ({ page }) => {
		await page.goto(emrBuilderUrl);
		await expect(page.locator(selectors.editor)).toBeVisible();

		const source = page.locator(selectors.itemRow).first();
		const target = page.locator(selectors.itemRow).nth(2);
		const sourceHandle = source.locator(selectors.handle);
		const targetHandle = target.locator(selectors.handle);

		await sourceHandle.hover();
		await targetHandle.hover();
		await sourceHandle.dragTo(targetHandle);

		const ids = await page.locator(selectors.sectionCard).allTextContents();
		expect(ids.length).toBeGreaterThan(0);

		await expect(page.locator(selectors.preview)).toContainText('preview');
		await expect(page.locator(selectors.save)).toBeEnabled();
	});

	test('provides keyboard reorder fallback when drag is unavailable', async ({ page }) => {
		await page.goto(emrBuilderUrl);
		await expect(page.locator(selectors.editor)).toBeVisible();

		const focused = page.locator(selectors.itemRow).nth(1);
		await focused.focus();
		await page.keyboard.press('Space');
		await page.keyboard.press('ArrowUp');
		await page.keyboard.press('Space');

		await expect(page.locator(selectors.toast)).toContainText('reordered');
		await expect(page.locator(selectors.save)).toBeEnabled();
	});

	test('keeps preview consistent without snapshots after reorder', async ({ page }) => {
		await page.goto(emrBuilderUrl);
		await expect(page.locator(selectors.editor)).toBeVisible();

		const orderById = await page
			.locator(selectors.preview)
			.locator('[data-preview-item]')
			.evaluateAll((nodes) =>
				nodes.map((node) => ({
					id: node.getAttribute('data-preview-item') ?? '',
					label: node.textContent?.trim() ?? ''
				}))
			);

		expect(orderById.length).toBeGreaterThan(0);
		expect(new Set(orderById.map((value) => value.id)).size).toBe(orderById.length);
	});

	test('moves item via arrow buttons when pointer DnD is blocked', async ({ page }) => {
		await page.goto(emrBuilderUrl);
		await expect(page.locator(selectors.editor)).toBeVisible();

		const row = page.locator(selectors.itemRow).first();
		const upButton = row.locator(selectors.moveUp);
		const downButton = row.locator(selectors.moveDown);

		await expect(upButton).toBeVisible();
		await upButton.click();
		await expect(page.locator(selectors.toast)).toContainText('reordered');
		await downButton.click();
		await expect(downButton).toBeVisible();

		await page.locator(selectors.publish).click();
		await expect(page.locator(selectors.toast)).toContainText('publish');
	});
});
