import { decode, type JWT } from '@auth/core/jwt';
import { PROXY_SIG_HEADER, PROXY_TOKEN_HEADER, PROXY_TS_HEADER, signProxyRequest } from '../../src/lib/proxy-sign.ts';

// 方案 B（ADR-005）：已认证管理员代理。
// 校验 Auth.js 会话 → 以服务签名转发到 CF Worker；GitHub token 仅在服务端流转。
export const config = { runtime: 'edge' as const };

const WORKER_BASE = 'https://api.openstmc.com';
const SESSION_COOKIES = ['__Secure-authjs.session-token', 'authjs.session-token'];

interface SessionToken extends JWT {
  ghToken?: string;
  isAdmin?: boolean;
}

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

async function readSession(request: Request): Promise<SessionToken | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const header = request.headers.get('cookie') ?? '';
  for (const name of SESSION_COOKIES) {
    const raw = readCookie(header, name);
    if (!raw) continue;
    const token = (await decode({ token: raw, secret, salt: name })) as SessionToken | null;
    if (token) return token;
  }
  return null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const secret = process.env.WORKER_PROXY_SECRET;
  if (!secret) return json(500, { error: 'Proxy not configured' });

  const action = new URL(request.url).pathname.replace(/^\/api\/admin\//, '');
  if (!/^[a-z0-9-]+$/.test(action)) return json(400, { error: 'Invalid action' });

  const session = await readSession(request);
  if (!session?.isAdmin || !session.ghToken) return json(403, { error: 'Forbidden' });

  const body = await request.arrayBuffer();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await signProxyRequest(secret, timestamp, body, session.ghToken);

  const upstream = await fetch(`${WORKER_BASE}/api/admin/${action}`, {
    method: 'POST',
    headers: {
      'content-type': request.headers.get('content-type') ?? 'application/json',
      [PROXY_TS_HEADER]: timestamp,
      [PROXY_TOKEN_HEADER]: session.ghToken,
      [PROXY_SIG_HEADER]: signature,
    },
    body,
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}
