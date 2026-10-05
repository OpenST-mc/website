import { describe, it, expect, beforeEach, vi } from 'vitest';
import { encode, type JWT } from '@auth/core/jwt';
import handler from '../api/admin/[...action].ts';
import { verifyProxyRequest, PROXY_SIG_HEADER, PROXY_TOKEN_HEADER, PROXY_TS_HEADER } from '../src/lib/proxy-sign.ts';

const AUTH_SECRET = 'test-auth-secret';
const WORKER_SECRET = 'test-worker-secret';
const SALT = 'authjs.session-token';

async function adminRequest(token: Partial<JWT>): Promise<Request> {
  const jwt = await encode({ token, secret: AUTH_SECRET, salt: SALT });
  return new Request('https://openstmc.com/api/admin/update-info', {
    method: 'POST',
    headers: { cookie: `${SALT}=${jwt}`, 'content-type': 'application/json' },
    body: JSON.stringify({ folder: 'abc', newInfo: { name: 'x' } }),
  });
}

beforeEach(() => {
  process.env.AUTH_SECRET = AUTH_SECRET;
  process.env.WORKER_PROXY_SECRET = WORKER_SECRET;
  vi.unstubAllGlobals();
});

describe('api/admin proxy (方案 B)', () => {
  it('forwards an admin request to the Worker with a verifiable signature', async () => {
    let captured: { url: string; init: RequestInit } | null = null;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        captured = { url: String(url), init: init ?? {} };
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }),
    );

    const res = await handler(await adminRequest({ ghToken: 'gho_user_token', isAdmin: true }));
    expect(res.status).toBe(200);
    expect(captured).not.toBeNull();
    expect(captured!.url).toBe('https://api.openstmc.com/api/admin/update-info');

    const headers = captured!.init.headers as Record<string, string>;
    expect(headers[PROXY_TOKEN_HEADER]).toBe('gho_user_token');
    const valid = await verifyProxyRequest(
      WORKER_SECRET,
      headers[PROXY_TS_HEADER]!,
      captured!.init.body as ArrayBuffer,
      'gho_user_token',
      headers[PROXY_SIG_HEADER]!,
    );
    expect(valid).toBe(true);
  });

  it('rejects unauthenticated and non-admin requests without calling the Worker', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const res = await handler(await adminRequest({ ghToken: 'gho_user_token', isAdmin: false }));
    expect(res.status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid actions and non-POST methods', async () => {
    const getRes = await handler(new Request('https://openstmc.com/api/admin/update-info', { method: 'GET' }));
    expect(getRes.status).toBe(405);

    const badAction = new Request('https://openstmc.com/api/admin/../evil', { method: 'POST' });
    expect((await handler(badAction)).status).toBe(400);
  });
});
