import { PROXY_SIG_HEADER, PROXY_TOKEN_HEADER, PROXY_TS_HEADER, signProxyRequest } from '../src/lib/proxy-sign.ts';
import { readEdgeSession } from '../src/lib/edge-session.ts';

// 方案 B（ADR-005）：任意已登录用户的投稿 Issue 代理。
// 校验 Auth.js 会话 → 以服务签名 + 会话 ghToken 转发 Worker /api/submit-issue。
export const config = { runtime: 'edge' as const };

const WORKER_BASE = 'https://api.openstmc.com';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const secret = process.env.WORKER_PROXY_SECRET;
  if (!secret) return json(500, { error: 'Proxy not configured' });

  const session = await readEdgeSession(request);
  if (!session?.ghToken) return json(401, { error: 'Unauthorized' });

  const body = await request.arrayBuffer();
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await signProxyRequest(secret, timestamp, body, session.ghToken);

  const upstream = await fetch(`${WORKER_BASE}/api/submit-issue`, {
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
