import { test, expect } from '@playwright/test';

// M6 · 水合/运行时安全冒烟：无 hydration mismatch、无未捕获异常。
const PAGES = ['/', '/archive', '/health', '/profile/april/december', '/admin_tools'];

for (const path of PAGES) {
  test(`no hydration mismatch or uncaught errors on ${path}`, async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /hydrat|did not match|server rendered|mismatch/i.test(msg.text())) {
        problems.push(msg.text());
      }
    });
    page.on('pageerror', (err) => problems.push(String(err)));

    await page.goto(path);
    await page.waitForTimeout(1500);
    expect(problems).toEqual([]);
  });
}
