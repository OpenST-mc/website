// Thin unit tests for src/lib/logic.ts + config.ts (Vitest).
import { describe, it, expect } from 'vitest';
import {
  getFilteredList,
  calculateDynamicTags,
  getSafePath,
  getArchiveFileUrl,
  type FilterableItem,
  type SelectedTags,
} from '../src/lib/logic.ts';
import { TAG_CONFIG, CATEGORIES } from '../src/lib/config.ts';

const emptySelected = (): SelectedTags => ({});

// Real hierarchy from TAG_CONFIG:
//   "编码存储科技" (object): { "编码全物品单片": ["常规编码单片", ...], ... }
//   "生产/合成" (flat array): ["合成站", "合成器相关"]
//   "版本" (flat array): ["1.21.x", ...]
const itemA: FilterableItem = {
  sub_id: 'sub-12',
  id: 'aaa',
  name: '高速编码单片',
  author: 'Alice',
  description: 'A fast encoder slice',
  tags: ['编码全物品单片', '常规编码单片'],
};
const itemB: FilterableItem = {
  sub_id: 'sub-34',
  id: 'bbb',
  name: '矩阵编码单片',
  author: 'Bob',
  description: 'Matrix variant',
  tags: ['编码全物品单片', '矩阵编码单片'],
};
const itemLeafOnly: FilterableItem = {
  sub_id: 'sub-56',
  id: 'ccc',
  name: '孤儿叶子',
  author: 'Cara',
  description: 'Has leaf tag without its parent',
  tags: ['常规编码单片'],
};
const itemC: FilterableItem = {
  sub_id: 'sub-78',
  id: 'ddd',
  name: '合成站成品',
  author: 'Dave',
  description: 'Crafting station build',
  tags: ['合成站', '1.21.x'],
};
const DATA: FilterableItem[] = [itemA, itemB, itemLeafOnly, itemC];

describe('getSafePath', () => {
  it('leaves plain segments untouched and preserves slashes', () => {
    expect(getSafePath('a/b/c')).toBe('a/b/c');
    expect(getSafePath('content/cat/id/file.litematic')).toBe('content/cat/id/file.litematic');
  });

  it('encodes spaces per segment', () => {
    expect(getSafePath('a b/c d')).toBe('a%20b/c%20d');
  });

  it('encodes 中文 per segment but keeps / separators', () => {
    expect(getSafePath('中文分类/空 格/文件.litematic')).toBe(
      `${encodeURIComponent('中文分类')}/${encodeURIComponent('空 格')}/${encodeURIComponent('文件.litematic')}`,
    );
  });

  it('returns empty string for falsy input', () => {
    expect(getSafePath('')).toBe('');
    expect(getSafePath(null)).toBe('');
    expect(getSafePath(undefined)).toBe('');
  });
});

describe('getFilteredList', () => {
  it('returns original data when search is empty and nothing selected', () => {
    expect(getFilteredList(DATA, '', emptySelected())).toBe(DATA);
    expect(getFilteredList(DATA, '   ', {})).toBe(DATA);
  });

  it('returns [] for falsy data', () => {
    expect(getFilteredList(null, 'x', emptySelected())).toEqual([]);
    expect(getFilteredList(undefined, '', { a: ['b'] })).toEqual([]);
  });

  it('ANDs across categories (must match every selected category)', () => {
    const out = getFilteredList(DATA, '', { '生产/合成': ['合成站'], 版本: ['1.21.x'] });
    expect(out).toEqual([itemC]);

    const miss = getFilteredList(DATA, '', { '生产/合成': ['合成站'], 版本: ['1.20.x'] });
    expect(miss).toEqual([]);
  });

  it('enforces parent+child for sub-category leaves (parent expansion)', () => {
    // Selecting leaf "常规编码单片" requires the item to carry BOTH
    // the leaf and its parent "编码全物品单片".
    const out = getFilteredList(DATA, '', { 编码存储科技: ['常规编码单片'] });
    expect(out).toEqual([itemA]); // itemLeafOnly (leaf without parent) excluded
  });

  it('matches parent-category keys directly', () => {
    const out = getFilteredList(DATA, '', { 编码存储科技: ['编码全物品单片'] });
    expect(out).toEqual([itemA, itemB]);
  });

  it('matches flat-array categories', () => {
    const out = getFilteredList(DATA, '', { '生产/合成': ['合成站'] });
    expect(out).toEqual([itemC]);
  });

  it('supports #tag prefix search (case-insensitive)', () => {
    const out = getFilteredList(DATA, '#合成', emptySelected());
    expect(out).toEqual([itemC]);

    const out2 = getFilteredList(DATA, '#常规编码', emptySelected());
    expect(out2).toEqual([itemA, itemLeafOnly]);

    // bare "#" matches everything that passed sidebar filters
    expect(getFilteredList(DATA, '#', emptySelected())).toEqual(DATA);
  });

  it('uses sub- staff query against sub_id (case-insensitive)', () => {
    expect(getFilteredList(DATA, 'sub-12', emptySelected())).toEqual([itemA]);
    expect(getFilteredList(DATA, 'SUB-34', emptySelected())).toEqual([itemB]);
    // substring: "sub-" alone matches every item that has a sub_id
    expect(getFilteredList(DATA, 'sub-', emptySelected())).toEqual(DATA);
  });

  it('fuzzy-matches name / author / description', () => {
    expect(getFilteredList(DATA, 'alice', emptySelected())).toEqual([itemA]);
    expect(getFilteredList(DATA, 'matrix', emptySelected())).toEqual([itemB]);
    expect(getFilteredList(DATA, 'crafting station', emptySelected())).toEqual([itemC]);
  });
});

describe('calculateDynamicTags', () => {
  const cats = ['编码存储科技', '生产/合成', '版本'];

  it('returns per-category Sets', () => {
    const groups = calculateDynamicTags(DATA, cats, emptySelected());
    expect(Object.keys(groups).sort()).toEqual([...cats].sort());
    for (const cat of cats) expect(groups[cat]).toBeInstanceOf(Set);
  });

  it('falls back to the full union when data is empty', () => {
    const groups = calculateDynamicTags([], cats, emptySelected());
    expect(groups['生产/合成']?.has('合成站')).toBe(true);
    expect(groups['生产/合成']?.has('合成器相关')).toBe(true);
    expect(groups['版本']?.has('1.21.x')).toBe(true);
    // object-category: contains both parent keys and leaves
    expect(groups['编码存储科技']?.has('编码全物品单片')).toBe(true);
    expect(groups['编码存储科技']?.has('常规编码单片')).toBe(true);
  });

  it('narrows to tags actually present in filtered data', () => {
    const groups = calculateDynamicTags([itemC], cats, emptySelected());
    expect(groups['生产/合成']?.has('合成站')).toBe(true);
    expect(groups['生产/合成']?.has('合成器相关')).toBe(false);
    expect(groups['版本']?.has('1.21.x')).toBe(true);
    expect(groups['版本']?.has('1.20.x')).toBe(false);
  });

  it('pins selected tags so they survive narrowing', () => {
    const groups = calculateDynamicTags([itemC], cats, { '生产/合成': ['合成器相关'] });
    expect(groups['生产/合成']?.has('合成器相关')).toBe(true); // absent from data, kept via selection
    expect(groups['生产/合成']?.has('合成站')).toBe(true); // present in data
  });
});

describe('getArchiveFileUrl', () => {
  it('builds an encoded same-origin content URL next to the preview', () => {
    const url = getArchiveFileUrl('/content/其他杂物/仓库成品/CMIS-V5/preview.webp', 'CMIS-V5.0.litematic');
    expect(decodeURIComponent(url)).toBe('/content/其他杂物/仓库成品/CMIS-V5/CMIS-V5.0.litematic');
    expect(url.startsWith('/content/')).toBe(true);
  });

  it('encodes spaces and special characters per path segment', () => {
    expect(getArchiveFileUrl('/content/A B/preview.webp', 'x y#1.litematic')).toBe(
      '/content/A%20B/x%20y%231.litematic',
    );
  });

  it('returns empty for missing parts or non-content previews', () => {
    expect(getArchiveFileUrl('', 'a.litematic')).toBe('');
    expect(getArchiveFileUrl('/content/x/preview.webp', '')).toBe('');
    expect(getArchiveFileUrl('https://cdn.example.com/preview.webp', 'a.litematic')).toBe('');
    expect(getArchiveFileUrl('preview.webp', 'a.litematic')).toBe('');
  });
});

describe('TAG_CONFIG shape', () => {
  it('exposes CATEGORIES as its own keys', () => {
    expect([...CATEGORIES].sort()).toEqual(Object.keys(TAG_CONFIG).sort());
  });

  it('values are either string arrays or { parent: string[] } objects', () => {
    for (const config of Object.values(TAG_CONFIG)) {
      if (Array.isArray(config)) {
        for (const t of config) expect(typeof t).toBe('string');
      } else {
        for (const [parent, leaves] of Object.entries(config)) {
          expect(typeof parent).toBe('string');
          expect(Array.isArray(leaves)).toBe(true);
          for (const t of leaves) expect(typeof t).toBe('string');
        }
      }
    }
  });
});
