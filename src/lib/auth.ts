// Auth.js 前端薄客户端。会话 Cookie 为 HttpOnly，此处只读非敏感资料。
import { fetchJson } from './http.ts';
import { parseSession } from './schema.ts';
import type { Session } from './types.ts';

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

function submitForm(action: string, fields: Record<string, string>): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export async function signIn(provider = 'github', callbackUrl = '/'): Promise<void> {
  const csrfToken = await getCsrfToken();
  submitForm(`/api/auth/signin/${provider}`, { csrfToken, callbackUrl: sanitizeCallbackUrl(callbackUrl) });
}

export async function signOut(callbackUrl = '/'): Promise<void> {
  const csrfToken = await getCsrfToken();
  submitForm('/api/auth/signout', { csrfToken, callbackUrl: sanitizeCallbackUrl(callbackUrl) });
}
