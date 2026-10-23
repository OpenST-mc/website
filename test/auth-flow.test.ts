// @vitest-environment node
import { describe, it, expect } from 'vitest';

// Handler 级验证 Auth.js JSON 重定向模式
// （src/lib/auth.ts 依赖 X-Auth-Return-Redirect 返回 { url }）。
// 必须 node 环境：jsdom 的 Headers 按 Fetch 规范屏蔽 Set-Cookie 读取。
const BASE = 'https://openstmc.com';

async function loadHandler() {
  process.env.AUTH_SECRET = 'test-auth-secret';
  process.env.AUTH_GITHUB_ID = 'test-client-id';
  process.env.AUTH_GITHUB_SECRET = 'test-client-secret';
  const { authHandler } = await import('../src/lib/auth-server.ts');
  return authHandler;
}

function cookieHeader(res: Response): string {
  const setCookies = res.headers.getSetCookie();
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

describe('Auth.js JSON 重定向流程', () => {
  it('csrf 下发 cookie；signin 携带 cookie 与 token 时返回 GitHub 授权 URL', async () => {
    const authHandler = await loadHandler();

    const csrfRes = await authHandler(new Request(`${BASE}/api/auth/csrf`));
    expect(csrfRes.status).toBe(200);
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
    expect(csrfToken).toBeTruthy();
    const cookie = cookieHeader(csrfRes);
    expect(cookie).toContain('csrf-token');

    const signinRes = await authHandler(
      new Request(`${BASE}/api/auth/signin/github`, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'x-auth-return-redirect': '1',
          cookie,
        },
        body: new URLSearchParams({ csrfToken, callbackUrl: '/archive' }).toString(),
      }),
    );
    expect(signinRes.status).toBe(200);
    const data = (await signinRes.json()) as { url?: string };
    expect(data.url?.startsWith('https://github.com/login/oauth/authorize')).toBe(true);
  });

  it('缺少 CSRF token 时返回指向错误页的 JSON（而非静默成功）', async () => {
    const authHandler = await loadHandler();

    const res = await authHandler(
      new Request(`${BASE}/api/auth/signin/github`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-auth-return-redirect': '1' },
        body: new URLSearchParams({ callbackUrl: '/archive' }).toString(),
      }),
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { url?: string };
    expect(data.url).toContain('/api/auth/signin');
    expect(data.url).toContain('MissingCSRF');
  });
});
