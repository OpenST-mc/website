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

test('upload page gates on GitHub login when unauthenticated', async ({ page }) => {
  await page.goto('/upload');
  await expect(page).toHaveTitle('投递新机器 - OpenST');
  await expect(page.getByText('身份验证')).toBeVisible();
});

test('archive page is server-rendered with cards', async ({ page, request }) => {
  const res = await request.get('/archive');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('贡献你的机器');
  expect(html).toContain('Archives Found');

  await page.goto('/archive');
  await expect(page).toHaveTitle('OpenST Archive');
  await expect(page.getByText('贡献你的机器')).toBeVisible();

  const thumb = page.locator('img[src*="thumb.webp"]').first();
  await expect(thumb).toBeVisible();
  await expect.poll(() => thumb.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
});
