// 方案 B（ADR-005）：Vercel 已认证代理 → CF Worker 的服务签名。
// 签名覆盖「时间戳 + 请求体哈希 + GitHub token」，Worker 侧用共享密钥校验。
// 纯 WebCrypto 实现，Vercel Edge 与 CF Worker 通用。

const encoder = new TextEncoder();

export const PROXY_TS_HEADER = 'x-openst-proxy-ts';
export const PROXY_TOKEN_HEADER = 'x-openst-proxy-gh-token';
export const PROXY_SIG_HEADER = 'x-openst-proxy-sig';
export const PROXY_MAX_SKEW_SEC = 300;

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = data instanceof Uint8Array ? new Uint8Array(data) : new Uint8Array(data);
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return toHex(digest);
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return toHex(signature);
}

export function canonicalPayload(timestamp: string, bodyHashHex: string, ghToken: string): string {
  return `${timestamp}\n${bodyHashHex}\n${ghToken}`;
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 生成代理签名（时间戳 + 请求体 + GitHub token）。 */
export async function signProxyRequest(
  secret: string,
  timestamp: string,
  body: ArrayBuffer | Uint8Array,
  ghToken: string,
): Promise<string> {
  const bodyHash = await sha256Hex(body);
  return hmacHex(secret, canonicalPayload(timestamp, bodyHash, ghToken));
}

/** 校验代理签名并检查时间窗（供 Worker 复用，逻辑与 signProxyRequest 对称）。 */
export async function verifyProxyRequest(
  secret: string,
  timestamp: string,
  body: ArrayBuffer | Uint8Array,
  ghToken: string,
  signature: string,
  nowMs: number = Date.now(),
  maxSkewSec: number = PROXY_MAX_SKEW_SEC,
): Promise<boolean> {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Math.floor(nowMs / 1000) - ts) > maxSkewSec) return false;
  const expected = await signProxyRequest(secret, timestamp, body, ghToken);
  return timingSafeEqualHex(expected, signature);
}
