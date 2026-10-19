// archive CI 产物 -> 站点 database.json 的纯映射与校验（无文件系统副作用）。

export interface ArchiveIndexEntry {
  id: string;
  name: string;
  author: string;
  tags: string[];
  description: string;
  category: string;
  preview: string;
  thumb: string;
  filename: string;
  sha256?: string;
}

export interface FolderLocation {
  category: string;
  folder: string;
}

export interface FolderRecord extends FolderLocation {
  id: string;
}

export interface MetaIndexEntry {
  name: string;
  category: string;
  files: string[];
  sha256?: string;
}

/** 站点 ArchiveItem（字段顺序与 archive/data/database.json 现有契约一致）。 */
export interface ArchiveItem {
  id: string;
  name: string;
  author: string;
  tags: string[];
  description: string;
  category: string;
  preview: string;
  display: string;
  thumb: string;
  filename: string;
  sub_id: string;
}

/** archive CI/CD 生成的稳定 sub-id 规范（与 api/share.js 一致）。 */
export const SUB_ID_RE = /^sub-\d+(-\d+)?$/;

function fail(message: string): never {
  throw new Error(message);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isContentPath(value: string): boolean {
  return value === '' || (value.startsWith('/content/') && !value.includes('..') && !value.includes('\\'));
}

function assertSafeSegment(segment: string, label: string): void {
  if (!segment || /[\\/\u0000-\u001f]/.test(segment) || segment === '.' || segment === '..') {
    fail(`${label} 非法: ${JSON.stringify(segment)}`);
  }
}

function assertSafeCategory(category: string, label: string): void {
  if (category === '') return;
  for (const segment of category.split('/')) assertSafeSegment(segment, label);
}

export function isSubId(value: unknown): value is string {
  return typeof value === 'string' && SUB_ID_RE.test(value);
}

/** 校验 content/data/index.json；结构漂移直接构建失败，不静默降级。 */
export function parseArchiveIndex(raw: unknown): ArchiveIndexEntry[] {
  if (!Array.isArray(raw)) fail('content/data/index.json 不是数组');

  return raw.map((value, index) => {
    const label = `content/data/index.json 第 ${index + 1} 条`;
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${label} 不是对象`);
    const o = value as Record<string, unknown>;

    if (!isSubId(o.id)) fail(`${label} 稳定 id 非法: ${String(o.id)}`);
    if (typeof o.name !== 'string') fail(`${label} name 必须是字符串`);
    if (typeof o.author !== 'string') fail(`${label} author 必须是字符串`);
    if (!isStringArray(o.tags)) fail(`${label} tags 必须是字符串数组`);
    if (typeof o.description !== 'string') fail(`${label} description 必须是字符串`);
    if (typeof o.category !== 'string') fail(`${label} category 必须是字符串`);
    if (typeof o.preview !== 'string') fail(`${label} preview 必须是字符串`);
    if (typeof o.thumb !== 'string') fail(`${label} thumb 必须是字符串`);
    if (typeof o.filename !== 'string') fail(`${label} filename 必须是字符串`);
    if (o.sha256 !== undefined && typeof o.sha256 !== 'string') fail(`${label} sha256 必须是字符串`);

    assertSafeCategory(o.category, `${label} category`);
    if (o.filename && /[\\/\u0000-\u001f]/.test(o.filename)) fail(`${label} filename 非法: ${o.filename}`);
    if (!isContentPath(o.preview)) fail(`${label} preview 必须是 /content/ 下的路径: ${o.preview}`);
    if (!isContentPath(o.thumb)) fail(`${label} thumb 必须是 /content/ 下的路径: ${o.thumb}`);

    return {
      id: o.id,
      name: o.name,
      author: o.author,
      tags: o.tags,
      description: o.description,
      category: o.category,
      preview: o.preview,
      thumb: o.thumb,
      filename: o.filename,
      ...(typeof o.sha256 === 'string' ? { sha256: o.sha256 } : {}),
    };
  });
}

/** 校验 content/_meta/index-by-id.json（Worker 定位表）。 */
export function parseMetaIndex(raw: unknown): Map<string, MetaIndexEntry> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail('content/_meta/index-by-id.json 不是对象');
  }

  const out = new Map<string, MetaIndexEntry>();
  for (const [id, value] of Object.entries(raw)) {
    if (!isSubId(id)) fail(`content/_meta/index-by-id.json 稳定 id 非法: ${id}`);
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`_meta 条目不是对象: ${id}`);
    const o = value as Record<string, unknown>;
    if (typeof o.name !== 'string') fail(`_meta 条目 name 非法: ${id}`);
    if (typeof o.category !== 'string') fail(`_meta 条目 category 非法: ${id}`);
    if (!isStringArray(o.files)) fail(`_meta 条目 files 必须是字符串数组: ${id}`);
    if (o.sha256 !== undefined && typeof o.sha256 !== 'string') fail(`_meta 条目 sha256 非法: ${id}`);
    out.set(id, {
      name: o.name,
      category: o.category,
      files: o.files,
      ...(typeof o.sha256 === 'string' ? { sha256: o.sha256 } : {}),
    });
  }
  return out;
}

/** 稳定 id -> 稿件文件夹；同时守住网站 id（文件夹名）全局唯一。 */
export function buildFolderMap(records: FolderRecord[]): Map<string, FolderLocation> {
  const byId = new Map<string, FolderLocation>();
  const byFolder = new Map<string, string>();

  for (const record of records) {
    if (!isSubId(record.id)) fail(`非法稳定 id: ${record.id}`);
    assertSafeCategory(record.category, `稿件文件夹 category (${record.id})`);
    assertSafeSegment(record.folder, `稿件文件夹 (${record.id})`);
    if (byId.has(record.id)) fail(`重复稳定 id: ${record.id}`);
    const owner = byFolder.get(record.folder);
    if (owner !== undefined) fail(`重复文件夹 id: ${record.folder}（${owner} 与 ${record.category}）`);
    byId.set(record.id, { category: record.category, folder: record.folder });
    byFolder.set(record.folder, record.category);
  }

  return byId;
}

function contentBase(location: FolderLocation): string {
  return location.category
    ? `/content/${location.category}/${location.folder}`
    : `/content/${location.folder}`;
}

/**
 * 合并 archive 索引与文件夹映射，生成站点数据库。
 * id=文件夹名（供下载/编辑/收藏），sub_id=archive CI 稳定 id（供深链/分享）。
 */
export function mapArchiveDatabase(
  index: ArchiveIndexEntry[],
  folders: Map<string, FolderLocation>,
): ArchiveItem[] {
  if (folders.size > index.length) {
    const known = new Set(index.map((entry) => entry.id));
    const extra = [...folders.keys()].filter((id) => !known.has(id));
    fail(`content/_meta 中存在未进入 data/index.json 的稿件: ${extra.join(', ') || `${folders.size} vs ${index.length}`}`);
  }

  const seenFolders = new Set<string>();
  return index.map((entry) => {
    const location = folders.get(entry.id);
    if (!location) fail(`缺少文件夹映射: ${entry.id}`);
    if (location.category !== entry.category) {
      fail(`category 不一致: ${entry.id} index=${entry.category} meta=${location.category}`);
    }
    if (seenFolders.has(location.folder)) fail(`重复文件夹 id: ${location.folder}`);
    seenFolders.add(location.folder);

    const base = contentBase(location);
    if (entry.preview && !entry.preview.startsWith(`${base}/`)) {
      fail(`preview 路径与文件夹不一致: ${entry.id} -> ${entry.preview}`);
    }
    if (entry.thumb && !entry.thumb.startsWith(`${base}/`)) {
      fail(`thumb 路径与文件夹不一致: ${entry.id} -> ${entry.thumb}`);
    }

    return {
      id: location.folder,
      name: entry.name,
      author: entry.author || 'Unknown',
      tags: entry.tags,
      description: entry.description,
      category: entry.category,
      preview: entry.preview,
      display: entry.preview,
      thumb: entry.thumb,
      filename: entry.filename,
      sub_id: entry.id,
    };
  });
}

/** 交叉校验 data/index.json 与 _meta/index-by-id.json。 */
export function verifyMetaIndex(
  index: ArchiveIndexEntry[],
  meta: Map<string, MetaIndexEntry>,
): void {
  if (meta.size !== index.length) {
    fail(`content/_meta/index-by-id.json 与 data/index.json 数量不一致: ${meta.size} vs ${index.length}`);
  }

  const ids = new Set(index.map((entry) => entry.id));
  for (const id of meta.keys()) {
    if (!ids.has(id)) fail(`_meta 中存在 data/index.json 未收录的稿件: ${id}`);
  }

  for (const entry of index) {
    const item = meta.get(entry.id);
    if (!item) fail(`_meta 缺少稿件: ${entry.id}`);
    if (item.category !== entry.category) fail(`_meta category 不一致: ${entry.id}`);
    if (entry.filename && !item.files.includes(entry.filename)) {
      fail(`_meta 缺少存档文件: ${entry.id} -> ${entry.filename}`);
    }
    if (entry.sha256 && item.sha256 && entry.sha256 !== item.sha256) {
      fail(`_meta sha256 不一致: ${entry.id}`);
    }
  }
}
