import { describe, it, expect } from 'vitest';
import {
  signProxyRequest,
  verifyProxyRequest,
  canonicalPayload,
  sha256Hex,
  hmacHex,
  timingSafeEqualHex,
  signUploadToken,
  verifyUploadToken,
  uploadTokenPayload,
  UPLOAD_TOKEN_TTL_SEC,
} from '../src/lib/proxy-sign.ts';

const SECRET = 'test-proxy-secret';
const TS = '1700000000';
const TS_MS = 1700000000_000;
const GH = 'gho_dummy_token';
const BODY = new TextEncoder().encode('{"folder":"abc","name":"x"}');

// Mirror of workers/workers 2.js helper to prove cross-implementation parity.
async function workerExpected(secret: string, ts: string, body: Uint8Array, ghToken: string): Promise<string> {
  const bodyHash = await sha256Hex(body);
  return hmacHex(secret, `${ts}\n${bodyHash}\n${ghToken}`);
}

describe('proxy-sign (方案 B)', () => {
  it('canonical payload is ts\\nbodyHash\\ntoken', async () => {
    const hash = await sha256Hex(BODY);
    expect(canonicalPayload(TS, hash, GH)).toBe(`${TS}\n${hash}\n${GH}`);
  });

  it('signs and verifies a valid request', async () => {
    const sig = await signProxyRequest(SECRET, TS, BODY, GH);
    expect(await verifyProxyRequest(SECRET, TS, BODY, GH, sig, TS_MS)).toBe(true);
  });

  it('matches the Worker-side algorithm (cross-implementation)', async () => {
    const sig = await signProxyRequest(SECRET, TS, BODY, GH);
    expect(await workerExpected(SECRET, TS, BODY, GH)).toBe(sig);
  });

  it('rejects tampered body / token / timestamp', async () => {
    const sig = await signProxyRequest(SECRET, TS, BODY, GH);
    const otherBody = new TextEncoder().encode('{"folder":"evil"}');
    expect(await verifyProxyRequest(SECRET, TS, otherBody, GH, sig, TS_MS)).toBe(false);
    expect(await verifyProxyRequest(SECRET, TS, BODY, 'other-token', sig, TS_MS)).toBe(false);
    expect(await verifyProxyRequest(SECRET, '1700000001', BODY, GH, sig, TS_MS)).toBe(false);
    expect(await verifyProxyRequest('wrong-secret', TS, BODY, GH, sig, TS_MS)).toBe(false);
  });

  it('rejects stale timestamps outside the skew window', async () => {
    const sig = await signProxyRequest(SECRET, TS, BODY, GH);
    expect(await verifyProxyRequest(SECRET, TS, BODY, GH, sig, TS_MS + 301_000)).toBe(false);
    expect(await verifyProxyRequest(SECRET, TS, BODY, GH, sig, TS_MS + 299_000)).toBe(true);
  });

  it('timingSafeEqualHex compares correctly', () => {
    expect(timingSafeEqualHex('abcd', 'abcd')).toBe(true);
    expect(timingSafeEqualHex('abcd', 'abce')).toBe(false);
    expect(timingSafeEqualHex('abcd', 'abc')).toBe(false);
  });
});

describe('upload token (投稿上传授权)', () => {
  const LOGIN = 'octocat';

  // Mirror of workers/workers 2.js verifyUploadToken to prove cross-implementation parity.
  async function workerVerifyUpload(secret: string, token: string, login: string, nowMs: number): Promise<boolean> {
    const dot = token.indexOf('.');
    if (dot <= 0) return false;
    const expStr = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const exp = Number(expStr);
    if (!Number.isInteger(exp)) return false;
    const now = Math.floor(nowMs / 1000);
    if (exp < now || exp > now + 600) return false;
    const expected = await hmacHex(secret, `upload\n${expStr}\n${login}`);
    return timingSafeEqualHex(expected, sig);
  }

  it('payload is domain-separated from the proxy signature', () => {
    expect(uploadTokenPayload('1700000600', LOGIN)).toBe('upload\n1700000600\noctocat');
    expect(canonicalPayload('1700000600', 'hash', LOGIN)).not.toContain('upload\n');
  });

  it('signs a token embedded with exp and verifies it', async () => {
    const { token, exp } = await signUploadToken(SECRET, LOGIN, TS_MS);
    expect(exp).toBe(1700000000 + UPLOAD_TOKEN_TTL_SEC);
    expect(token.startsWith(`${exp}.`)).toBe(true);
    expect(await verifyUploadToken(SECRET, token, LOGIN, TS_MS)).toBe(true);
  });

  it('matches the Worker-side algorithm (cross-implementation)', async () => {
    const { token } = await signUploadToken(SECRET, LOGIN, TS_MS);
    expect(await workerVerifyUpload(SECRET, token, LOGIN, TS_MS)).toBe(true);
  });

  it('rejects wrong login / secret / tampered signature', async () => {
    const { token } = await signUploadToken(SECRET, LOGIN, TS_MS);
    expect(await verifyUploadToken(SECRET, token, 'evil', TS_MS)).toBe(false);
    expect(await verifyUploadToken('wrong-secret', token, LOGIN, TS_MS)).toBe(false);
    expect(await verifyUploadToken(SECRET, token.replace(/.$/, '0'), LOGIN, TS_MS)).toBe(false);
    expect(await verifyUploadToken(SECRET, 'no-dot-token', LOGIN, TS_MS)).toBe(false);
    expect(await verifyUploadToken(SECRET, '.deadbeef', LOGIN, TS_MS)).toBe(false);
  });

  it('rejects expired tokens and absurd future expiry', async () => {
    const { token } = await signUploadToken(SECRET, LOGIN, TS_MS);
    // exp 秒内仍有效，超出后失效
    expect(await verifyUploadToken(SECRET, token, LOGIN, TS_MS + (UPLOAD_TOKEN_TTL_SEC - 1) * 1000)).toBe(true);
    expect(await verifyUploadToken(SECRET, token, LOGIN, TS_MS + (UPLOAD_TOKEN_TTL_SEC + 1) * 1000)).toBe(false);
    const forged = await hmacHex(SECRET, uploadTokenPayload('9999999999', LOGIN));
    expect(await verifyUploadToken(SECRET, `9999999999.${forged}`, LOGIN, TS_MS)).toBe(false);
  });
});
