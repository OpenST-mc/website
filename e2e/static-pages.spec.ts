import { test, expect } from '@playwright/test';

// M2 静态页对等：health / credits / 404。

test('health page renders with its SEO title', async ({ page }) => {
  await page.goto('/health');
  await expect(page).toHaveTitle('系统状态 | OpenST Portal');
  await expect(page.getByText('OpenST System Status')).toBeVisible();
});

test('credits page renders the entry portal', async ({ page }) => {
  await page.goto('/profile/april/december');
  await expect(page).toHaveTitle('OpenST Credits');
  await expect(page.getByText('INIT OPENST')).toBeVisible();
});

test('unknown route serves the 404 error page', async ({ page }) => {
  const res = await page.goto('/definitely-not-a-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('LOST IN VOID')).toBeVisible();
});
