import { describe, expect, it } from 'vitest';
import {
  buildFolderMap,
  mapArchiveDatabase,
  parseArchiveIndex,
  parseMetaIndex,
  verifyMetaIndex,
  type ArchiveIndexEntry,
  type FolderLocation,
  type FolderRecord,
} from '../data/archive-import.ts';

const entry: ArchiveIndexEntry = {
  id: 'sub-1782403150143',
  name: '[1.19+]1wt自适应堆分整流',
  author: '慕斯丶白',
  tags: ['堆分整流器', '整流器', '1.19+'],
  description: '介绍',
  category: '其他杂物/整流器/堆分整流器',
  preview: '/content/其他杂物/整流器/堆分整流器/[1.19+]1wt自适应堆分整流/preview.webp',
  thumb: '/content/其他杂物/整流器/堆分整流器/[1.19+]1wt自适应堆分整流/thumb.webp',
  filename: '1wt自适应堆分整流V2.rar',
  sha256: 'abc',
};

const folderRecord: FolderRecord = {
  id: entry.id,
  category: entry.category,
  folder: '[1.19+]1wt自适应堆分整流',
};

const folderMap = (): Map<string, FolderLocation> => buildFolderMap([folderRecord]);

describe('parseArchiveIndex', () => {
  it('accepts the archive CI index shape', () => {
    expect(parseArchiveIndex([entry])).toEqual([entry]);
  });

  it('rejects non-array or malformed entries instead of importing garbage', () => {
    expect(() => parseArchiveIndex({})).toThrow('不是数组');
    expect(() => parseArchiveIndex([{ ...entry, id: 'sub-abc' }])).toThrow('稳定 id');
    expect(() => parseArchiveIndex([{ ...entry, tags: [1] }])).toThrow('tags');
    expect(() => parseArchiveIndex([{ ...entry, preview: 'https://x/preview.webp' }])).toThrow('/content/');
  });
});

describe('buildFolderMap', () => {
  it('maps stable sub-id to its physical folder', () => {
    expect(folderMap().get(entry.id)).toEqual({
      category: entry.category,
      folder: '[1.19+]1wt自适应堆分整流',
    });
  });

  it('rejects duplicate stable ids and duplicate folder ids', () => {
    expect(() => buildFolderMap([folderRecord, folderRecord])).toThrow('重复稳定 id');
    expect(() =>
      buildFolderMap([
        folderRecord,
        { ...folderRecord, id: 'sub-1', category: '其他杂物' },
      ]),
    ).toThrow('重复文件夹 id');
  });

  it('rejects invalid stable ids', () => {
    expect(() => buildFolderMap([{ ...folderRecord, id: 'nope' }])).toThrow('非法稳定 id');
  });
});

describe('mapArchiveDatabase', () => {
  it('keeps the site contract: folder id + archive CI sub-id + detail/thumb images', () => {
    expect(mapArchiveDatabase([entry], folderMap())).toEqual([
      {
        id: '[1.19+]1wt自适应堆分整流',
        name: entry.name,
        author: entry.author,
        tags: entry.tags,
        description: entry.description,
        category: entry.category,
        preview: entry.preview,
        display: entry.preview,
        thumb: entry.thumb,
        filename: entry.filename,
        sub_id: entry.id,
      },
    ]);
  });

  it('fails when a stable id has no folder, an extra folder, or a drifted category', () => {
    expect(() => mapArchiveDatabase([entry], new Map())).toThrow('缺少文件夹映射');
    expect(() =>
      mapArchiveDatabase([], buildFolderMap([folderRecord])),
    ).toThrow('未进入 data/index.json');
    expect(() =>
      mapArchiveDatabase([entry], buildFolderMap([{ ...folderRecord, category: '其他杂物' }])),
    ).toThrow('category 不一致');
  });

  it('fails when preview/thumb do not belong to the item folder', () => {
    expect(() =>
      mapArchiveDatabase([{ ...entry, thumb: '/content/其他杂物/别的稿件/thumb.webp' }], folderMap()),
    ).toThrow('thumb 路径与文件夹不一致');
  });
});

describe('parseMetaIndex / verifyMetaIndex', () => {
  const meta = {
    [entry.id]: {
      name: entry.name,
      category: entry.category,
      files: ['info.json', 'preview.webp', 'thumb.webp', entry.filename],
      sha256: entry.sha256,
    },
  };

  it('accepts a matching _meta/index-by-id.json', () => {
    const parsed = parseMetaIndex(meta);
    expect(parsed.get(entry.id)?.files).toContain(entry.filename);
    expect(() => verifyMetaIndex([entry], parsed)).not.toThrow();
  });

  it('rejects count, id, category, filename and hash drift', () => {
    expect(() => verifyMetaIndex([entry], parseMetaIndex({}))).toThrow('数量不一致');
    expect(() => verifyMetaIndex([entry], parseMetaIndex({ 'sub-999': meta[entry.id]! }))).toThrow('未收录');
    expect(() =>
      verifyMetaIndex([entry], parseMetaIndex({ ...meta, [entry.id]: { ...meta[entry.id], category: '其他杂物' } })),
    ).toThrow('category 不一致');
    expect(() =>
      verifyMetaIndex([entry], parseMetaIndex({ ...meta, [entry.id]: { ...meta[entry.id], files: ['info.json'] } })),
    ).toThrow('缺少存档文件');
    expect(() =>
      verifyMetaIndex([entry], parseMetaIndex({ ...meta, [entry.id]: { ...meta[entry.id], sha256: 'other' } })),
    ).toThrow('sha256 不一致');
    expect(() => verifyMetaIndex([], parseMetaIndex(meta))).toThrow('数量不一致');
  });
});
