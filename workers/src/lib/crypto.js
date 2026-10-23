// 哈希、HMAC 与服务间签名校验（与 src/lib/proxy-sign.ts 对称）。
export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const PROXY_MAX_SKEW_SEC = 300;
const UPLOAD_TOKEN_TTL_SEC = 600;

async function sha256HexBytes(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 校验 Vercel 代理签名（时间戳 + 请求体哈希 + GitHub token）；有效返回 { token }。
export async function verifyWorkerProxy(request, env) {
  const secret = env.WORKER_PROXY_SECRET;
  if (!secret) return null;
  const sig = request.headers.get('x-openst-proxy-sig');
  const ts = request.headers.get('x-openst-proxy-ts');
  const ghToken = request.headers.get('x-openst-proxy-gh-token');
  if (!sig || !ts || !ghToken) return null;

  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum)) return null;
  if (Math.abs(Math.floor(Date.now() / 1000) - tsNum) > PROXY_MAX_SKEW_SEC) return null;

  const bodyHash = await sha256HexBytes(await request.clone().arrayBuffer());
  const expected = await hmacHex(secret, `${ts}\n${bodyHash}\n${ghToken}`);
  if (!timingSafeEqualHex(expected, sig)) return null;
  return { token: ghToken };
}

// 校验 x-openst-upload-token（`<exp>.<hmac>`）；有效返回 { login }。
export async function verifyUploadToken(request, env) {
  const secret = env.WORKER_PROXY_SECRET;
  if (!secret) return null;
  const token = request.headers.get('x-openst-upload-token');
  const login = request.headers.get('x-openst-upload-user');
  if (!token || !login || login.length > 100) return null;

  const dot = token.indexOf('.');
  if (dot <= 0) return null;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isInteger(exp)) return null;

  const now = Math.floor(Date.now() / 1000);
  if (exp < now || exp > now + UPLOAD_TOKEN_TTL_SEC) return null;

  const expected = await hmacHex(secret, `upload\n${expStr}\n${login}`);
  if (!timingSafeEqualHex(expected, sig)) return null;
  return { login };
}
