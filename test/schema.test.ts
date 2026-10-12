import { describe, it, expect } from 'vitest';
import { parseDatabase, parseS2T, isArchiveItem } from '../src/lib/schema.ts';

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
});

describe('parseS2T', () => {
  it('expands each line into parallel s/t arrays and skips comments', () => {
    const d = parseS2T('繁 简1 简2\n# comment\n简X X\n');
    expect(d.s).toEqual(['繁', '繁', '简X']);
    expect(d.t).toEqual(['简1', '简2', 'X']);
  });
});
