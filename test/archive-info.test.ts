import { describe, expect, it } from 'vitest';
import { PREVIEW_EXTENSIONS, archivePreviewUrl, toInfoPatch } from '../src/lib/archive-info.ts';

describe('toInfoPatch', () => {
  it('emits only the fields maintained by editors', () => {
    const patch = toInfoPatch({
      name: '  测试机器  ',
      author: '   ',
      tags: [' 合成站 ', '合成站', '', '1.20+'],
      description: '## 说明',
    });

    expect(patch).toEqual({
      name: '测试机器',
      author: '匿名',
      tags: ['合成站', '1.20+'],
      description: '## 说明',
    });
    // 回归：不得再提交 id / folder / preview / filename / submitDate 等派生字段。
    expect(Object.keys(patch).sort()).toEqual(['author', 'description', 'name', 'tags']);
  });

  it('keeps an explicit author untouched', () => {
    expect(toInfoPatch({ name: 'x', author: ' ZeroTwo ', tags: [], description: '' }).author).toBe('ZeroTwo');
  });
});

describe('PREVIEW_EXTENSIONS', () => {
  it('matches the archive CI image source whitelist', () => {
    expect(PREVIEW_EXTENSIONS).toEqual(['.png', '.jpg', '.jpeg', '.webp']);
  });
});

describe('archivePreviewUrl', () => {
  it('serves /content previews from the site origin and encodes path segments', () => {
    expect(archivePreviewUrl('/content/其他杂物/整流器/预览 图.webp')).toBe(
      '/content/%E5%85%B6%E4%BB%96%E6%9D%82%E7%89%A9/%E6%95%B4%E6%B5%81%E5%99%A8/%E9%A2%84%E8%A7%88%20%E5%9B%BE.webp',
    );
  });

  it('falls back to the archive CDN for legacy relative preview names', () => {
    expect(archivePreviewUrl('preview.png')).toBe('https://cdn.jsdelivr.net/gh/OpenST-mc/archive@main/preview.png');
  });

  it('passes through data and https URLs', () => {
    expect(archivePreviewUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');
    expect(archivePreviewUrl('https://example.com/preview.webp')).toBe('https://example.com/preview.webp');
  });

  it('returns an empty string when no preview is available', () => {
    expect(archivePreviewUrl('')).toBe('');
  });
});
