import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildFolderMap,
  mapArchiveDatabase,
  parseArchiveIndex,
  parseMetaIndex,
  verifyMetaIndex,
  type FolderRecord,
} from './archive-import.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(root, 'content');
const INDEX_FILE = path.join(CONTENT_DIR, 'data/index.json');
const META_INDEX_FILE = path.join(CONTENT_DIR, '_meta/index-by-id.json');
const OUTPUT_FILE = path.join(root, 'archive/data/database.json');
const RESERVED = new Set(['scripts', 'data', '_meta', 'docs', 'node_modules']);

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf-8'));
  } catch (error) {
    throw new Error(`读取失败 ${path.relative(root, file)}: ${(error as Error).message}`);
  }
}

function parentOf(rel: string): string {
  const dir = path.posix.dirname(rel);
  return dir === '.' ? '' : dir;
}

/**
 * archive CI 把稳定 sub-id 写在每个稿件目录的 .meta.json 中；
 * 索引本身不携带文件夹名，因此这里建立 sub-id -> 文件夹 的映射。
 */
async function collectFolderRecords(rel = ''): Promise<FolderRecord[]> {
  const abs = rel ? path.join(CONTENT_DIR, rel) : CONTENT_DIR;
  const entries = await fs.readdir(abs, { withFileTypes: true }).catch(() => null);
  if (!entries) return [];

  if (entries.some((entry) => entry.isFile() && entry.name === '.meta.json')) {
    const raw = await readJson(path.join(abs, '.meta.json'));
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`.meta.json 不是对象: ${rel || '.'}`);
    }
    const id = (raw as Record<string, unknown>).id;
    if (typeof id !== 'string' || !id) throw new Error(`.meta.json 缺少稳定 id: ${rel || '.'}`);
    return [{ id, category: parentOf(rel), folder: path.posix.basename(rel) }];
  }

  const records: FolderRecord[] = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    if (rel === '' && RESERVED.has(entry.name)) continue;
    records.push(...(await collectFolderRecords(rel ? `${rel}/${entry.name}` : entry.name)));
  }
  return records;
}

async function build(): Promise<void> {
  console.log('正在导入 archive CI 数据库（content/data/index.json）...');
  console.time('导入耗时');

  const index = parseArchiveIndex(await readJson(INDEX_FILE));
  const metaIndex = parseMetaIndex(await readJson(META_INDEX_FILE));
  verifyMetaIndex(index, metaIndex);

  const folders = buildFolderMap(await collectFolderRecords());
  const database = mapArchiveDatabase(index, folders);

  await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(database, null, 4));

  console.log(`导入成功：${database.length} 个稿件（sub-id 由 archive CI/CD 维护）`);
  console.timeEnd('导入耗时');
}

build().catch((error: unknown) => {
  console.error('错误:', (error as Error).message);
  process.exit(1);
});
