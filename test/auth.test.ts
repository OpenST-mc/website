import { describe, it, expect } from 'vitest';
import { sanitizeCallbackUrl, parseAuthRedirect } from '../src/lib/auth.ts';

describe('sanitizeCallbackUrl', () => {
  it('allows same-origin relative paths', () => {
    expect(sanitizeCallbackUrl('/')).toBe('/');
    expect(sanitizeCallbackUrl('/upload')).toBe('/upload');
    expect(sanitizeCallbackUrl('/archive?sub-1')).toBe('/archive?sub-1');
  });

  it('rejects open redirects and malformed input', () => {
    expect(sanitizeCallbackUrl('//evil.com')).toBe('/');
    expect(sanitizeCallbackUrl('/\\evil.com')).toBe('/');
    expect(sanitizeCallbackUrl('https://evil.com')).toBe('/');
    expect(sanitizeCallbackUrl('http://evil.com')).toBe('/');
    expect(sanitizeCallbackUrl('javascript:alert(1)')).toBe('/');
    expect(sanitizeCallbackUrl('')).toBe('/');
    expect(sanitizeCallbackUrl(undefined)).toBe('/');
    expect(sanitizeCallbackUrl(null)).toBe('/');
    expect(sanitizeCallbackUrl('/a\u0000b')).toBe('/');
  });
});

describe('parseAuthRedirect', () => {
  const base = 'https://openstmc.com';

  it('accepts absolute and same-origin http(s) redirects', () => {
    expect(parseAuthRedirect({ url: 'https://github.com/login/oauth/authorize?x=1' }, base)).toBe(
      'https://github.com/login/oauth/authorize?x=1',
    );
    expect(parseAuthRedirect({ url: '/api/auth/error?error=Configuration' }, base)).toBe(
      'https://openstmc.com/api/auth/error?error=Configuration',
    );
    expect(parseAuthRedirect({ url: 'http://localhost:4000/x' }, base)).toBe('http://localhost:4000/x');
  });

  it('rejects malformed payloads and non-http(s) protocols', () => {
    expect(parseAuthRedirect(null, base)).toBeNull();
    expect(parseAuthRedirect({}, base)).toBeNull();
    expect(parseAuthRedirect({ url: '' }, base)).toBeNull();
    expect(parseAuthRedirect({ url: 42 }, base)).toBeNull();
    expect(parseAuthRedirect(['x'], base)).toBeNull();
    expect(parseAuthRedirect({ url: 'javascript:alert(1)' }, base)).toBeNull();
    expect(parseAuthRedirect({ url: 'data:text/html,x' }, base)).toBeNull();
  });
});
