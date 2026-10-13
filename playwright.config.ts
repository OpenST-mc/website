import { defineConfig, devices } from '@playwright/test';

// E2E 基座：对 SSG 构建产物（dist/client）做冒烟/对等测试。
// 前置：先执行 `pnpm run build`（vike preview 需要已构建产物）。
const PORT = 3000;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'pnpm exec vike preview',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
