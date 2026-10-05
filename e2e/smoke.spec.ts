import { test, expect } from '@playwright/test';

// M2 冒烟：SSG 首屏即含内容（无 JS 也应可读）。
test('home page is server-rendered with head + content', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('OpenST | Portal');
  await expect(page.getByRole('heading', { name: '进入档案馆' })).toBeVisible();
});

test('SSG HTML already contains the home heading before hydration', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('进入档案馆');
  expect(html).toContain('<title>OpenST | Portal</title>');
});

test('health page is pre-rendered with its title', async ({ page }) => {
  await page.goto('/health');
  await expect(page).toHaveTitle('系统状态 | OpenST Portal');
  await expect(page.getByRole('heading', { name: 'OpenST System Status' })).toBeVisible();
});

test('credits page is pre-rendered at its public route', async ({ page }) => {
  const res = await page.goto('/profile/april/december');
  expect(res?.status()).toBe(200);
  await expect(page).toHaveTitle('OpenST Credits');
  await expect(page.locator('#starfield')).toBeAttached();
});

test('unknown path falls back to the 404 page', async ({ request }) => {
  const res = await request.get('/definitely-missing-xyz');
  expect(res.status()).toBe(404);
  const html = await res.text();
  expect(html).toContain('LOST IN VOID');
});
