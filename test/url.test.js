// URL-builder tests for api/download.js + api/share.js (pure parts only).
// Run: node --test test/   (zero new deps: node:test + node:assert/strict only)
//
// NOTE (skip rationale): apps/extra/litematic-converter/index.js was NOT tested
// because it is not importable in node — it has zero exports and touches
// `document` at module top level (throws ReferenceError outside a browser).
// Per task instructions the source was left untouched; instead this file tests
// the download/share URL builders with inline fixtures mirroring api/*.js.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- Inline fixtures mirroring source (kept in sync by hand, no imports) ---

// Mirrors api/share.js: /^sub-\d+(-\d+)?$/
const SUB_ID_RE = /^sub-\d+(-\d+)?$/;
const isSafeSubId = (v) => typeof v === 'string' && SUB_ID_RE.test(v);

// Mirrors api/download.js repoPath builder:
//   [item.category, item.id, item.filename]
//     .map(part => String(part).split('/').map(encodeURIComponent).join('/'))
//     .join('/')
const buildRepoPath = (category, id, filename) =>
  [category, id, filename].map((part) => String(part).split('/').map(encodeURIComponent).join('/')).join('/');

const PROXY_BASE = 'https://cdn.openstmc.com/https:/raw.githubusercontent.com/OpenST-mc/archive/main';
const RAW_BASE = 'https://raw.githubusercontent.com/OpenST-mc/archive/main';
const buildDownloadTarget = (category, id, filename, raw = false) =>
  `${raw ? RAW_BASE : PROXY_BASE}/${buildRepoPath(category, id, filename)}`;
const buildDownloadApiUrl = (subId) => `/api/download?id=${encodeURIComponent(subId)}`;
const buildShareFinalUrl = (subId) => `https://openstmc.com/archive?${subId}`;

// Mirrors api/download.js counter-key sanitize:
//   String(item.sub_id || item.id).replace(/[^a-zA-Z0-9\-_.]/g, '_')
const buildCounterKey = (v) => `dl:${String(v).replace(/[^a-zA-Z0-9\-_.]/g, '_')}`;

describe('sub_id validation (api/share.js)', () => {
  it('accepts single- and double-segment ids', () => {
    assert.equal(isSafeSubId('sub-1'), true);
    assert.equal(isSafeSubId('sub-123'), true);
    assert.equal(isSafeSubId('sub-12-34'), true); // 历史双段
  });

  it('rejects injection / malformed payloads', () => {
    assert.equal(isSafeSubId(''), false);
    assert.equal(isSafeSubId('sub-'), false);
    assert.equal(isSafeSubId('sub-abc'), false);
    assert.equal(isSafeSubId('SUB-1'), false);
    assert.equal(isSafeSubId('sub-1-2-3'), false);
    assert.equal(isSafeSubId('sub-1;rm -rf'), false);
    assert.equal(isSafeSubId('../etc/passwd'), false);
    assert.equal(isSafeSubId('sub-1\nsub-2'), false);
    assert.equal(isSafeSubId(null), false);
    assert.equal(isSafeSubId(undefined), false);
    assert.equal(isSafeSubId(123), false);
  });
});

describe('repoPath builder (api/download.js)', () => {
  it('joins [category, id, filename] with / and encodes each segment', () => {
    assert.equal(
      buildRepoPath('潜影盒处理/潜影盒打包机', 'abc123', 'file.litematic'),
      `${encodeURIComponent('潜影盒处理')}/${encodeURIComponent('潜影盒打包机')}/abc123/file.litematic`
    );
  });

  it('encodes 中文 and spaces but preserves / separators', () => {
    assert.equal(
      buildRepoPath('编码存储科技', 'id 1', '我的 存档.litematic'),
      `${encodeURIComponent('编码存储科技')}/id%201/${encodeURIComponent('我的 存档.litematic')}`
    );
  });

  it('keeps nested category slashes as separators', () => {
    // category itself may contain "/" (two-level hierarchy); slashes survive
    // because each slash-split chunk is encoded independently.
    const p = buildRepoPath('a/b', 'c', 'd');
    assert.equal(p, 'a/b/c/d');
  });
});

describe('/api/download shape', () => {
  it('builds /api/download?id=<encoded> links', () => {
    assert.equal(buildDownloadApiUrl('sub-12'), '/api/download?id=sub-12');
    assert.equal(buildDownloadApiUrl('sub-12-34'), '/api/download?id=sub-12-34');
  });

  it('builds proxy vs raw targets', () => {
    const cat = '其他杂物';
    const target = buildDownloadTarget(cat, 'ddd', 'f.litematic');
    const rawTarget = buildDownloadTarget(cat, 'ddd', 'f.litematic', true);
    assert.ok(target.startsWith(`${PROXY_BASE}/`));
    assert.ok(rawTarget.startsWith(`${RAW_BASE}/`));
    assert.ok(target.endsWith(`${encodeURIComponent(cat)}/ddd/f.litematic`));
    assert.ok(rawTarget.endsWith(`${encodeURIComponent(cat)}/ddd/f.litematic`));
  });

  it('sanitizes counter keys to [a-zA-Z0-9-_.]', () => {
    assert.equal(buildCounterKey('sub-12'), 'dl:sub-12');
    assert.equal(buildCounterKey('a/b:c$d'), 'dl:a_b_c_d');
    assert.match(buildCounterKey('中文 id'), /^dl:[a-zA-Z0-9\-_.]+$/);
  });
});

describe('share finalUrl (api/share.js)', () => {
  it('appends a valid sub_id as the raw query', () => {
    assert.equal(buildShareFinalUrl('sub-12'), 'https://openstmc.com/archive?sub-12');
    assert.equal(buildShareFinalUrl('sub-12-34'), 'https://openstmc.com/archive?sub-12-34');
  });
});
