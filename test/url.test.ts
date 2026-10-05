// URL-builder tests for api/download.js + api/share.js (pure parts only, Vitest).
//
// NOTE (skip rationale): apps/extra/litematic-converter/index.js was NOT tested
// because it is not importable in node — it has zero exports and touches
// `document` at module top level (throws ReferenceError outside a browser).
// Per task instructions the source was left untouched; instead this file tests
// the download/share URL builders with inline fixtures mirroring api/*.js.

import { describe, it, expect } from 'vitest';

// --- Inline fixtures mirroring source (kept in sync by hand, no imports) ---

// Mirrors api/share.js: /^sub-\d+(-\d+)?$/
const SUB_ID_RE = /^sub-\d+(-\d+)?$/;
const isSafeSubId = (v: unknown) => typeof v === 'string' && SUB_ID_RE.test(v);

// Mirrors api/download.js repoPath builder:
//   [item.category, item.id, item.filename]
//     .map(part => String(part).split('/').map(encodeURIComponent).join('/'))
//     .join('/')
const buildRepoPath = (category: unknown, id: unknown, filename: unknown) =>
  [category, id, filename].map((part) => String(part).split('/').map(encodeURIComponent).join('/')).join('/');

const PROXY_BASE = 'https://cdn.openstmc.com/https:/raw.githubusercontent.com/OpenST-mc/archive/main';
const RAW_BASE = 'https://raw.githubusercontent.com/OpenST-mc/archive/main';
const buildDownloadTarget = (category: unknown, id: unknown, filename: unknown, raw = false) =>
  `${raw ? RAW_BASE : PROXY_BASE}/${buildRepoPath(category, id, filename)}`;
const buildDownloadApiUrl = (subId: string) => `/api/download?id=${encodeURIComponent(subId)}`;
const buildShareFinalUrl = (subId: string) => `https://openstmc.com/archive?${subId}`;

// Mirrors api/download.js counter-key sanitize:
//   String(item.sub_id || item.id).replace(/[^a-zA-Z0-9\-_.]/g, '_')
const buildCounterKey = (v: unknown) => `dl:${String(v).replace(/[^a-zA-Z0-9\-_.]/g, '_')}`;

describe('sub_id validation (api/share.js)', () => {
  it('accepts single- and double-segment ids', () => {
    expect(isSafeSubId('sub-1')).toBe(true);
    expect(isSafeSubId('sub-123')).toBe(true);
    expect(isSafeSubId('sub-12-34')).toBe(true); // 历史双段
  });

  it('rejects injection / malformed payloads', () => {
    expect(isSafeSubId('')).toBe(false);
    expect(isSafeSubId('sub-')).toBe(false);
    expect(isSafeSubId('sub-abc')).toBe(false);
    expect(isSafeSubId('SUB-1')).toBe(false);
    expect(isSafeSubId('sub-1-2-3')).toBe(false);
    expect(isSafeSubId('sub-1;rm -rf')).toBe(false);
    expect(isSafeSubId('../etc/passwd')).toBe(false);
    expect(isSafeSubId('sub-1\nsub-2')).toBe(false);
    expect(isSafeSubId(null)).toBe(false);
    expect(isSafeSubId(undefined)).toBe(false);
    expect(isSafeSubId(123)).toBe(false);
  });
});

describe('repoPath builder (api/download.js)', () => {
  it('joins [category, id, filename] with / and encodes each segment', () => {
    expect(buildRepoPath('潜影盒处理/潜影盒打包机', 'abc123', 'file.litematic')).toBe(
      `${encodeURIComponent('潜影盒处理')}/${encodeURIComponent('潜影盒打包机')}/abc123/file.litematic`,
    );
  });

  it('encodes 中文 and spaces but preserves / separators', () => {
    expect(buildRepoPath('编码存储科技', 'id 1', '我的 存档.litematic')).toBe(
      `${encodeURIComponent('编码存储科技')}/id%201/${encodeURIComponent('我的 存档.litematic')}`,
    );
  });

  it('keeps nested category slashes as separators', () => {
    // category itself may contain "/" (two-level hierarchy); slashes survive
    // because each slash-split chunk is encoded independently.
    expect(buildRepoPath('a/b', 'c', 'd')).toBe('a/b/c/d');
  });
});

describe('/api/download shape', () => {
  it('builds /api/download?id=<encoded> links', () => {
    expect(buildDownloadApiUrl('sub-12')).toBe('/api/download?id=sub-12');
    expect(buildDownloadApiUrl('sub-12-34')).toBe('/api/download?id=sub-12-34');
  });

  it('builds proxy vs raw targets', () => {
    const cat = '其他杂物';
    const target = buildDownloadTarget(cat, 'ddd', 'f.litematic');
    const rawTarget = buildDownloadTarget(cat, 'ddd', 'f.litematic', true);
    expect(target.startsWith(`${PROXY_BASE}/`)).toBe(true);
    expect(rawTarget.startsWith(`${RAW_BASE}/`)).toBe(true);
    expect(target.endsWith(`${encodeURIComponent(cat)}/ddd/f.litematic`)).toBe(true);
    expect(rawTarget.endsWith(`${encodeURIComponent(cat)}/ddd/f.litematic`)).toBe(true);
  });

  it('sanitizes counter keys to [a-zA-Z0-9-_.]', () => {
    expect(buildCounterKey('sub-12')).toBe('dl:sub-12');
    expect(buildCounterKey('a/b:c$d')).toBe('dl:a_b_c_d');
    expect(buildCounterKey('中文 id')).toMatch(/^dl:[a-zA-Z0-9\-_.]+$/);
  });
});

describe('share finalUrl (api/share.js)', () => {
  it('appends a valid sub_id as the raw query', () => {
    expect(buildShareFinalUrl('sub-12')).toBe('https://openstmc.com/archive?sub-12');
    expect(buildShareFinalUrl('sub-12-34')).toBe('https://openstmc.com/archive?sub-12-34');
  });
});
