import { describe, it, expect } from 'vitest';
import {
  parseDatabase,
  parseS2T,
  isArchiveItem,
  parseSession,
  isSubId,
  parseSubIdFromSearch,
  sanitizeQueryParam,
  parseWorkerUpload,
  parseUploadToken,
  parseDownloadStats,
  parseHealthExtra,
  parseFavoriteIds,
  sanitizeGithubUrl,
  toJsonLd,
} from '../src/lib/schema.ts';

const good = {
  id: 'a1',
  name: 'n',
  author: 'x',
  tags: [],
  description: '',
  category: '',
  preview: '',
  filename: '',
  sub_id: 'sub-1',
};

describe('isArchiveItem / parseDatabase', () => {
  it('accepts a well-formed item and rejects malformed ones', () => {
    expect(isArchiveItem(good)).toBe(true);
    expect(isArchiveItem({ ...good, tags: [1] })).toBe(false);
    expect(isArchiveItem(null)).toBe(false);
    expect(parseDatabase([good, { id: 1 }, null, 'x'])).toEqual([good]);
  });

  it('returns [] for non-array input instead of throwing', () => {
    expect(parseDatabase('nope')).toEqual([]);
    expect(parseDatabase(undefined)).toEqual([]);
  });

  it('accepts optional thumb/display strings and rejects wrong types', () => {
    expect(isArchiveItem(good)).toBe(true);
    expect(isArchiveItem({ ...good, display: '/content/x/display.webp', thumb: '/content/x/thumb.webp' })).toBe(true);
    expect(isArchiveItem({ ...good, display: 42 })).toBe(false);
    expect(isArchiveItem({ ...good, thumb: null })).toBe(false);
  });
});

describe('parseS2T', () => {
  it('expands each line into parallel s/t arrays and skips comments', () => {
    const d = parseS2T('繁 简1 简2\n# comment\n简X X\n');
    expect(d.s).toEqual(['繁', '繁', '简X']);
    expect(d.t).toEqual(['简1', '简2', 'X']);
  });
});

describe('parseSession', () => {
  it('accepts a null/empty (logged-out) session', () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession({})).toEqual({ user: undefined, expires: undefined });
  });

  it('keeps only well-typed fields and normalizes isAdmin to boolean', () => {
    expect(
      parseSession({
        user: { name: 'n', image: 42, isAdmin: 'yes', extra: 'dropped' },
        expires: '2099-01-01',
        ignored: true,
      }),
    ).toEqual({
      user: { name: 'n', email: null, image: null, isAdmin: false },
      expires: '2099-01-01',
    });
  });

  it('rejects malformed shapes instead of trusting them', () => {
    expect(parseSession('nope')).toBeNull();
    expect(parseSession({ user: 'nope' })).toBeNull();
    expect(parseSession({ user: { isAdmin: true } })).toEqual({
      user: { name: null, email: null, image: null, isAdmin: true },
      expires: undefined,
    });
  });
});

describe('URL parameter validation', () => {
  it('accepts only canonical sub-ids', () => {
    expect(isSubId('sub-1')).toBe(true);
    expect(isSubId('sub-12-34')).toBe(true);
    expect(isSubId('sub-abc')).toBe(false);
    expect(isSubId('../x')).toBe(false);
    expect(isSubId(123)).toBe(false);
  });

  it('extracts a sub-id from location.search (with or without ?)', () => {
    expect(parseSubIdFromSearch('?sub-1')).toBe('sub-1');
    expect(parseSubIdFromSearch('sub-99-1')).toBe('sub-99-1');
    expect(parseSubIdFromSearch('?sub-1&x=1')).toBeNull();
    expect(parseSubIdFromSearch('?evil')).toBeNull();
    expect(parseSubIdFromSearch('')).toBeNull();
  });

  it('sanitizes query params against control chars and length', () => {
    expect(sanitizeQueryParam('20bps 水平 by：Nvertd')).toBe('20bps 水平 by：Nvertd');
    expect(sanitizeQueryParam('a\u0000b')).toBeNull();
    expect(sanitizeQueryParam('a\nb')).toBeNull();
    expect(sanitizeQueryParam('x'.repeat(129))).toBeNull();
    expect(sanitizeQueryParam('x'.repeat(128))).toBe('x'.repeat(128));
    expect(sanitizeQueryParam('')).toBeNull();
    expect(sanitizeQueryParam(null)).toBeNull();
  });
});

describe('parseWorkerUpload / parseDownloadStats', () => {
  it('keeps valid https downloadUrl and plain filePath', () => {
    expect(parseWorkerUpload({ downloadUrl: 'https://api.openstmc.com/dl/a.zip', filePath: 'a.zip' })).toEqual({
      downloadUrl: 'https://api.openstmc.com/dl/a.zip',
      filePath: 'a.zip',
    });
  });

  it('drops non-https or malformed targets', () => {
    expect(parseWorkerUpload({ downloadUrl: 'javascript:alert(1)', filePath: 'a.zip' })).toEqual({ filePath: 'a.zip' });
    expect(parseWorkerUpload({ downloadUrl: 'https://x/a\nb' })).toBeNull();
    expect(parseWorkerUpload({ downloadUrl: 'http://insecure/a' })).toEqual({});
    expect(parseWorkerUpload('nope')).toBeNull();
    expect(parseWorkerUpload(null)).toBeNull();
  });

  it('accepts only finite non-negative counts', () => {
    expect(parseDownloadStats({ count: 12 })).toBe(12);
    expect(parseDownloadStats({ count: 0 })).toBe(0);
    expect(parseDownloadStats({ count: -1 })).toBeNull();
    expect(parseDownloadStats({ count: '12' })).toBeNull();
    expect(parseDownloadStats(null)).toBeNull();
  });
});

describe('parseUploadToken', () => {
  it('accepts a well-formed token response', () => {
    expect(parseUploadToken({ token: '1700000600.abcd', login: 'octocat' })).toEqual({
      token: '1700000600.abcd',
      login: 'octocat',
    });
  });

  it('rejects malformed responses instead of trusting them', () => {
    expect(parseUploadToken({ token: 'x' })).toBeNull();
    expect(parseUploadToken({ login: 'octocat' })).toBeNull();
    expect(parseUploadToken({ token: '', login: 'octocat' })).toBeNull();
    expect(parseUploadToken({ token: 42, login: 'octocat' })).toBeNull();
    expect(parseUploadToken('nope')).toBeNull();
    expect(parseUploadToken(null)).toBeNull();
    expect(parseUploadToken(['x'])).toBeNull();
  });
});

describe('parseHealthExtra', () => {
  it('keeps only string fields and tolerates malformed input', () => {
    expect(parseHealthExtra({ region: 'fra1', upstream: 'ok', extra: 1 })).toEqual({ region: 'fra1', upstream: 'ok' });
    expect(parseHealthExtra({ region: 42 })).toEqual({ region: undefined, upstream: undefined });
    expect(parseHealthExtra('nope')).toEqual({});
  });
});

describe('parseFavoriteIds', () => {
  it('keeps only strings and falls back to [] for malformed storage', () => {
    expect(parseFavoriteIds(['a', 'b'])).toEqual(['a', 'b']);
    expect(parseFavoriteIds(['a', 1, null, { x: 1 }])).toEqual(['a']);
    expect(parseFavoriteIds('not-an-array')).toEqual([]);
    expect(parseFavoriteIds(null)).toEqual([]);
  });
});

describe('sanitizeGithubUrl / toJsonLd', () => {
  it('allows only https github.com links', () => {
    expect(sanitizeGithubUrl('https://github.com/OpenST-mc/Submissions/issues/1')).toBe(
      'https://github.com/OpenST-mc/Submissions/issues/1',
    );
    expect(sanitizeGithubUrl('https://evil.com/github.com')).toBe('');
    expect(sanitizeGithubUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeGithubUrl('http://github.com/a')).toBe('');
    expect(sanitizeGithubUrl(undefined)).toBe('');
  });

  it('escapes < so JSON-LD cannot break out of its script tag', () => {
    const out = toJsonLd({ name: '</script><img src=x onerror=alert(1)>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c');
  });
});
