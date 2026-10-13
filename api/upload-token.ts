import { readEdgeSession } from '../src/lib/edge-session';
import { signUploadToken } from '../src/lib/proxy-sign';

// 方案 B 扩展（ADR-005）：投稿上传授权。
// 浏览器 → Worker 直传（≤50MB，不经 Vercel Edge 体积限制），
// 因此本端点校验 Auth.js 会话后签发短时 HMAC 令牌，Worker 校验令牌后才中继 Telegram。
export const config = { runtime: 'edge' as const };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const secret = process.env.WORKER_PROXY_SECRET;
  if (!secret) return json(500, { error: 'Proxy not configured' });

  const session = await readEdgeSession(request);
  if (!session?.ghToken) return json(401, { error: 'Unauthorized' });

  const rawLogin = session.login;
  const login =
    typeof rawLogin === 'string' && rawLogin.length > 0 && rawLogin.length <= 100
      ? rawLogin
      : typeof session.sub === 'string'
        ? session.sub
        : '';
  if (!login) return json(401, { error: 'Unauthorized' });

  const { token } = await signUploadToken(secret, login);
  return json(200, { token, login });
}
