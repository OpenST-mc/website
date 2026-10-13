import { describe, it, expect, beforeEach } from 'vitest';
import { encode, type JWT } from '@auth/core/jwt';
import handler from '../api/upload-token.ts';
import { verifyUploadToken } from '../src/lib/proxy-sign.ts';

const AUTH_SECRET = 'test-auth-secret';
const WORKER_SECRET = 'test-worker-secret';
const SALT = 'authjs.session-token';

async function tokenRequest(token: Partial<JWT> | null): Promise<Request> {
  const headers: Record<string, string> = {};
  if (token) {
    const jwt = await encode({ token, secret: AUTH_SECRET, salt: SALT });
    headers.cookie = `${SALT}=${jwt}`;
  }
  return new Request('https://openstmc.com/api/upload-token', { method: 'POST', headers });
}

beforeEach(() => {
  process.env.AUTH_SECRET = AUTH_SECRET;
  process.env.WORKER_PROXY_SECRET = WORKER_SECRET;
});

describe('api/upload-token (投稿上传授权)', () => {
  it('issues a verifiable token for a logged-in session only', async () => {
    const res = await handler(await tokenRequest({ sub: '123', ghToken: 'gho_user_token', login: 'octocat' }));
    expect(res.status).toBe(200);

    const data = (await res.json()) as { token: string; login: string };
    expect(data.login).toBe('octocat');
    expect(await verifyUploadToken(WORKER_SECRET, data.token, 'octocat')).toBe(true);
    expect(await verifyUploadToken(WORKER_SECRET, data.token, 'evil')).toBe(false);
    expect(await verifyUploadToken('wrong-secret', data.token, 'octocat')).toBe(false);
  });

  it('falls back to sub when login is absent', async () => {
    const res = await handler(await tokenRequest({ sub: 'user-42', ghToken: 'gho_user_token' }));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { token: string; login: string };
    expect(data.login).toBe('user-42');
    expect(await verifyUploadToken(WORKER_SECRET, data.token, 'user-42')).toBe(true);
  });

  it('rejects anonymous / token-less sessions and non-POST methods', async () => {
    expect((await handler(await tokenRequest(null))).status).toBe(401);
    expect((await handler(await tokenRequest({ sub: '1' }))).status).toBe(401);
    const getRes = await handler(new Request('https://openstmc.com/api/upload-token', { method: 'GET' }));
    expect(getRes.status).toBe(405);
  });
});
