import { decode, type JWT } from '@auth/core/jwt';

// Auth.js 会话 JWT 的 Edge 侧只读解析（api/admin/* 与 api/submit-issue 共用）。
export interface SessionToken extends JWT {
  ghToken?: string;
  isAdmin?: boolean;
}

const SESSION_COOKIES = ['__Secure-authjs.session-token', 'authjs.session-token'];

function readCookie(header: string, name: string): string | null {
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

export async function readEdgeSession(request: Request): Promise<SessionToken | null> {
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
