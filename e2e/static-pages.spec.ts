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

test('admin packer renders the form', async ({ page }) => {
  await page.goto('/admin_tools');
  await expect(page).toHaveTitle('OpenST Admin Packer (Responsive)');
  await expect(page.getByText('ADMIN PACKER PRO')).toBeVisible();
  await expect(page.getByText('Pack & Download')).toBeVisible();
});

test('admin editor gates on session when unauthenticated', async ({ page }) => {
  await page.goto('/admin_tools/admin_edit');
  await expect(page).toHaveTitle('OpenST 稿件编辑器 (for staff)');
  await expect(page.getByText('需要管理员权限')).toBeVisible();
});
