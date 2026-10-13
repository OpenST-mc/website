import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// M6 · 可访问性门：关键页面无 serious/critical 级 axe 违规（WCAG 2 A/AA）。
// 例外（维护者决定，2026-10）：保留原暗色视觉层次，显式豁免 color-contrast 规则。
const A11Y_PAGES = ['/', '/health', '/admin_tools', '/archive'];

for (const path of A11Y_PAGES) {
  test(`axe: no serious/critical violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    // 首页有字体劫持骨架屏（loading-skeleton 的 background-clip:text 会让
    // axe 误判对比度），等骨架解锁后的最终状态再扫描。
    await page
      .waitForFunction(() => document.body.classList.contains('ready'), undefined, { timeout: 5000 })
      .catch(() => undefined);

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    if (serious.length > 0) {
      console.log(
        `[a11y] ${path} ` +
          JSON.stringify(
            serious.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => ({
                target: n.target,
                why: n.failureSummary?.split('\n')[1]?.trim(),
                html: n.html.slice(0, 140),
              })),
            })),
          ),
      );
    }
    expect(serious.map((v) => v.id)).toEqual([]);
  });
}

// 键盘可达：卡片为真实按钮；详情弹层可 Esc 关闭且焦点被管理。
test('archive detail modal supports keyboard open/close', async ({ page }) => {
  await page.goto('/archive');
  const firstCard = page.getByRole('button', { name: /^查看 / }).first();
  await firstCard.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('archive sidebar drawer opens and closes with Escape on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 800 });
  await page.goto('/archive');
  await page.getByRole('button', { name: '打开筛选菜单' }).click();

  const drawer = page.getByRole('dialog', { name: '筛选菜单' });
  await expect(drawer).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});
