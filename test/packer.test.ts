import { describe, it, expect } from 'vitest';
import { buildInfoJson, flattenTagConfig, previewFileName, sanitizeZipName } from '../src/lib/packer.ts';
import { TAG_CONFIG } from '../src/lib/config.ts';

describe('flattenTagConfig', () => {
  it('keeps flat-array categories as-is', () => {
    const flat = flattenTagConfig({ 版本: ['1.21.x', '1.20.x'] });
    expect(flat['版本']).toEqual(['1.21.x', '1.20.x']);
  });

  it('flattens object categories to leaves only (no parent keys)', () => {
    const flat = flattenTagConfig({ cat: { parent: ['leaf1', 'leaf2'], 空: [] } });
    expect(flat['cat']).toEqual(['leaf1', 'leaf2']);
  });

  it('covers the real TAG_CONFIG without throwing', () => {
    const flat = flattenTagConfig();
    expect(Object.keys(flat).sort()).toEqual(Object.keys(TAG_CONFIG).sort());
    for (const tags of Object.values(flat)) expect(Array.isArray(tags)).toBe(true);
  });
});

describe('previewFileName', () => {
  it('normalizes extension to lowercase', () => {
    expect(previewFileName('shot.PNG')).toBe('preview.png');
    expect(previewFileName('a.b.jpeg')).toBe('preview.jpeg');
  });
});

describe('sanitizeZipName', () => {
  it('replaces illegal filename characters', () => {
    expect(sanitizeZipName('a/b:c*d?e"f<g>h|i\\j')).toBe('a_b_c_d_e_f_g_h_i_j');
    expect(sanitizeZipName('正常名称')).toBe('正常名称');
  });
});

describe('buildInfoJson', () => {
  it('produces the exact info.json semantics', () => {
    const now = new Date('2026-10-05T12:34:56.000Z');
    const info = buildInfoJson(
      {
        name: '测试机器',
        author: '',
        tags: ['合成站'],
        desc: 'hello',
        previewFileName: 'Shot.PNG',
        litematicFileName: '机器.litematic',
      },
      now,
    );
    expect(info).toEqual({
      id: `sub-${now.getTime()}`,
      name: '测试机器',
      author: '未知',
      tags: ['合成站'],
      description: 'hello',
      folder: '测试机器',
      preview: 'preview.png',
      filename: '机器.litematic',
      submitDate: '2026-10-05T12:34:56.000Z',
    });
    // 字段顺序与 4 空格缩进序列化一致
    expect(JSON.stringify(info, null, 4).split('\n')[1]).toBe(`    "id": "sub-${now.getTime()}",`);
  });
});
