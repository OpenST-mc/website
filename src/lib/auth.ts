// Auth.js 前端薄客户端。会话 Cookie 为 HttpOnly，此处只读非敏感资料。
import { fetchJson, HttpError } from './http.ts';
import { parseSession } from './schema.ts';
import type { Session } from './types.ts';
import { notify } from './notify.ts';

export async function getSession(): Promise<Session | null> {
  const { data, response } = await fetchJson<unknown>('/api/auth/session', {
    credentials: 'include',
    timeoutMs: 8000,
  });
  if (!response.ok) return null;
  return parseSession(data);
}

export async function getCsrfToken(): Promise<string> {
  const { data } = await fetchJson<{ csrfToken?: unknown }>('/api/auth/csrf', {
    credentials: 'include',
    timeoutMs: 8000,
  });
  return typeof data?.csrfToken === 'string' ? data.csrfToken : '';
}

// 开放重定向防护：callbackUrl 仅允许站内相对路径。
// 拒绝绝对 URL（`https://evil.com`）、协议相对（`//evil.com`）、
// 反斜杠绕过（`/\evil.com`）与控制字符。
export function sanitizeCallbackUrl(url: unknown): string {
  if (typeof url !== 'string' || url.length === 0) return '/';
  if (!url.startsWith('/')) return '/';
  if (url.startsWith('//') || url.startsWith('/\\')) return '/';
  if (/[\u0000-\u001f]/.test(url)) return '/';
  return url;
}

// Auth.js `X-Auth-Return-Redirect` 响应校验：仅接受 http(s) 跳转，
// 防止 javascript:/data: 注入。
export function parseAuthRedirect(raw: unknown, base: string): string | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const url = (raw as { url?: unknown }).url;
  if (typeof url !== 'string' || url.length === 0) return null;
  try {
    const parsed = new URL(url, base);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

// 不用表单 POST：OAuth 302 到 github.com 会被 CSP `form-action 'self'` 拦截；
// 改走 Auth.js JSON 模式（X-Auth-Return-Redirect）后由 JS 导航。
async function postAuthAction(action: string, fields: Record<string, string>): Promise<void> {
  const { data } = await fetchJson(action, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-auth-return-redirect': '1' },
    body: new URLSearchParams(fields).toString(),
    timeoutMs: 10_000,
  });
  const target = parseAuthRedirect(data, window.location.origin);
  if (!target) throw new HttpError('认证跳转响应异常', { code: 'invalid-json', url: action, status: 200 });
  window.location.assign(target);
}

export async function signIn(provider = 'github', callbackUrl = '/'): Promise<void> {
  try {
    const csrfToken = await getCsrfToken();
    await postAuthAction(`/api/auth/signin/${provider}`, { csrfToken, callbackUrl: sanitizeCallbackUrl(callbackUrl) });
  } catch (error) {
    console.error('登录失败:', error);
    notify('error', '登录失败，请检查网络后重试');
  }
}

export async function signOut(callbackUrl = '/'): Promise<void> {
  try {
    const csrfToken = await getCsrfToken();
    await postAuthAction('/api/auth/signout', { csrfToken, callbackUrl: sanitizeCallbackUrl(callbackUrl) });
  } catch (error) {
    console.error('登出失败:', error);
    notify('error', '登出失败，请检查网络后重试');
  }
}
