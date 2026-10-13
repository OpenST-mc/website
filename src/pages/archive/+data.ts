import fs from 'node:fs';
import path from 'node:path';
import { parseDatabase, parseS2T } from '../../lib/schema';
import type { ArchiveData } from '../../lib/types';

// 构建期注入：稿件列表（SSG 首屏含内容）+ 繁简字典。
export function data(): ArchiveData {
  const root = process.cwd();
  const dbRaw: unknown = JSON.parse(fs.readFileSync(path.join(root, 'archive/data/database.json'), 'utf-8'));
  const dictText = fs.readFileSync(path.join(root, 'assets/s2t/STCharacters.txt'), 'utf-8');
  return { items: parseDatabase(dbRaw), dict: parseS2T(dictText) };
}
