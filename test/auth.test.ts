import { describe, it, expect } from 'vitest';
import { sanitizeCallbackUrl } from '../src/lib/auth.ts';

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
