// Thin unit tests for apps/portal/scripts/logic.js + config.js.
// Run: node --test test/   (zero new deps: node:test + node:assert/strict only)
// No network, no DOM, small inline fixtures.
//
// NOTE: getExpandedTags is NOT exported from logic.js (internal helper).
// Parent-expansion behaviour is covered indirectly via getFilteredList tests below.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getFilteredList, calculateDynamicTags, getSafePath } from '../apps/portal/scripts/logic.js';
import { TAG_CONFIG, CATEGORIES } from '../apps/portal/scripts/config.js';

const emptySelected = () => ({});

// Real hierarchy from TAG_CONFIG:
//   "编码存储科技" (object): { "编码全物品单片": ["常规编码单片", ...], ... }
//   "生产/合成" (flat array): ["合成站", "合成器相关"]
//   "版本" (flat array): ["1.21.x", ...]
const itemA = {
  sub_id: 'sub-12',
  id: 'aaa',
  name: '高速编码单片',
  author: 'Alice',
  description: 'A fast encoder slice',
  tags: ['编码全物品单片', '常规编码单片'],
};
const itemB = {
  sub_id: 'sub-34',
  id: 'bbb',
  name: '矩阵编码单片',
  author: 'Bob',
  description: 'Matrix variant',
  tags: ['编码全物品单片', '矩阵编码单片'],
};
const itemLeafOnly = {
  sub_id: 'sub-56',
  id: 'ccc',
  name: '孤儿叶子',
  author: 'Cara',
  description: 'Has leaf tag without its parent',
  tags: ['常规编码单片'],
};
const itemC = {
  sub_id: 'sub-78',
  id: 'ddd',
  name: '合成站成品',
  author: 'Dave',
  description: 'Crafting station build',
  tags: ['合成站', '1.21.x'],
};
const DATA = [itemA, itemB, itemLeafOnly, itemC];

describe('getSafePath', () => {
  it('leaves plain segments untouched and preserves slashes', () => {
    assert.equal(getSafePath('a/b/c'), 'a/b/c');
    assert.equal(getSafePath('content/cat/id/file.litematic'), 'content/cat/id/file.litematic');
  });

  it('encodes spaces per segment', () => {
    assert.equal(getSafePath('a b/c d'), 'a%20b/c%20d');
  });

  it('encodes 中文 per segment but keeps / separators', () => {
    assert.equal(
      getSafePath('中文分类/空 格/文件.litematic'),
      `${encodeURIComponent('中文分类')}/${encodeURIComponent('空 格')}/${encodeURIComponent('文件.litematic')}`
    );
  });

  it('returns empty string for falsy input', () => {
    assert.equal(getSafePath(''), '');
    assert.equal(getSafePath(null), '');
    assert.equal(getSafePath(undefined), '');
  });
});

describe('getFilteredList', () => {
  it('returns original data when search is empty and nothing selected', () => {
    assert.equal(getFilteredList(DATA, '', emptySelected()), DATA);
    assert.equal(getFilteredList(DATA, '   ', {}), DATA);
  });

  it('returns [] for falsy data', () => {
    assert.deepEqual(getFilteredList(null, 'x', emptySelected()), []);
    assert.deepEqual(getFilteredList(undefined, '', { a: ['b'] }), []);
  });

  it('ANDs across categories (must match every selected category)', () => {
    const out = getFilteredList(DATA, '', { '生产/合成': ['合成站'], 版本: ['1.21.x'] });
    assert.deepEqual(out, [itemC]);

    const miss = getFilteredList(DATA, '', { '生产/合成': ['合成站'], 版本: ['1.20.x'] });
    assert.deepEqual(miss, []);
  });

  it('enforces parent+child for sub-category leaves (parent expansion)', () => {
    // Selecting leaf "常规编码单片" requires the item to carry BOTH
    // the leaf and its parent "编码全物品单片".
    const out = getFilteredList(DATA, '', { 编码存储科技: ['常规编码单片'] });
    assert.deepEqual(out, [itemA]); // itemLeafOnly (leaf without parent) excluded
  });

  it('matches parent-category keys directly', () => {
    const out = getFilteredList(DATA, '', { 编码存储科技: ['编码全物品单片'] });
    assert.deepEqual(out, [itemA, itemB]);
  });

  it('matches flat-array categories', () => {
    const out = getFilteredList(DATA, '', { '生产/合成': ['合成站'] });
    assert.deepEqual(out, [itemC]);
  });

  it('supports #tag prefix search (case-insensitive)', () => {
    const out = getFilteredList(DATA, '#合成', emptySelected());
    assert.deepEqual(out, [itemC]);

    const out2 = getFilteredList(DATA, '#常规编码', emptySelected());
    assert.deepEqual(out2, [itemA, itemLeafOnly]);

    // bare "#" matches everything that passed sidebar filters
    assert.deepEqual(getFilteredList(DATA, '#', emptySelected()), DATA);
  });

  it('uses sub- staff query against sub_id (case-insensitive)', () => {
    assert.deepEqual(getFilteredList(DATA, 'sub-12', emptySelected()), [itemA]);
    assert.deepEqual(getFilteredList(DATA, 'SUB-34', emptySelected()), [itemB]);
    // substring: "sub-" alone matches every item that has a sub_id
    assert.deepEqual(getFilteredList(DATA, 'sub-', emptySelected()), DATA);
  });

  it('fuzzy-matches name / author / description', () => {
    assert.deepEqual(getFilteredList(DATA, 'alice', emptySelected()), [itemA]);
    assert.deepEqual(getFilteredList(DATA, 'matrix', emptySelected()), [itemB]);
    assert.deepEqual(getFilteredList(DATA, 'crafting station', emptySelected()), [itemC]);
  });
});

describe('calculateDynamicTags', () => {
  const cats = ['编码存储科技', '生产/合成', '版本'];

  it('returns per-category Sets', () => {
    const groups = calculateDynamicTags(DATA, cats, emptySelected());
    assert.deepEqual(Object.keys(groups).sort(), [...cats].sort());
    for (const cat of cats) assert.ok(groups[cat] instanceof Set);
  });

  it('falls back to the full union when data is empty', () => {
    const groups = calculateDynamicTags([], cats, emptySelected());
    assert.ok(groups['生产/合成'].has('合成站'));
    assert.ok(groups['生产/合成'].has('合成器相关'));
    assert.ok(groups['版本'].has('1.21.x'));
    // object-category: contains both parent keys and leaves
    assert.ok(groups['编码存储科技'].has('编码全物品单片'));
    assert.ok(groups['编码存储科技'].has('常规编码单片'));
  });

  it('narrows to tags actually present in filtered data', () => {
    const groups = calculateDynamicTags([itemC], cats, emptySelected());
    assert.ok(groups['生产/合成'].has('合成站'));
    assert.ok(!groups['生产/合成'].has('合成器相关'));
    assert.ok(groups['版本'].has('1.21.x'));
    assert.ok(!groups['版本'].has('1.20.x'));
  });

  it('pins selected tags so they survive narrowing', () => {
    const groups = calculateDynamicTags([itemC], cats, { '生产/合成': ['合成器相关'] });
    assert.ok(groups['生产/合成'].has('合成器相关')); // absent from data, kept via selection
    assert.ok(groups['生产/合成'].has('合成站')); // present in data
  });
});

describe('TAG_CONFIG shape', () => {
  it('exposes CATEGORIES as its own keys', () => {
    assert.deepEqual([...CATEGORIES].sort(), Object.keys(TAG_CONFIG).sort());
  });

  it('values are either string arrays or { parent: string[] } objects', () => {
    for (const [cat, config] of Object.entries(TAG_CONFIG)) {
      if (Array.isArray(config)) {
        for (const t of config) assert.equal(typeof t, 'string', cat);
      } else {
        for (const [parent, leaves] of Object.entries(config)) {
          assert.equal(typeof parent, 'string', cat);
          assert.ok(Array.isArray(leaves), `${cat}/${parent} must be an array`);
          for (const t of leaves) assert.equal(typeof t, 'string', `${cat}/${parent}`);
        }
      }
    }
  });
});
