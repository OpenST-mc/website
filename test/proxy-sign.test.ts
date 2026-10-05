import { describe, it, expect } from 'vitest';
import {
  signProxyRequest,
  verifyProxyRequest,
  canonicalPayload,
  sha256Hex,
  hmacHex,
  timingSafeEqualHex,
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
