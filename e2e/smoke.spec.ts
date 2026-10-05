import { test, expect } from '@playwright/test';

// M2 冒烟：SSG 首屏即含内容（无 JS 也应可读）。
test('home page is server-rendered with head + content', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('OpenST | Portal');
  await expect(page.getByRole('heading', { name: '进入档案馆' })).toBeVisible();
});

test('SSG HTML already contains the heading before hydration', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status()).toBe(200);
  const html = await res.text();
  expect(html).toContain('进入档案馆');
  expect(html).toContain('<title>OpenST | Portal</title>');
});
