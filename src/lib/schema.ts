import type { ArchiveItem, ArchiveDict } from './types.ts';

// 轻量 runtime 校验（不新增依赖；schema 库论证见 T6.1）。

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function isArchiveItem(v: unknown): v is ArchiveItem {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.author === 'string' &&
    isStringArray(o.tags) &&
    typeof o.description === 'string' &&
    typeof o.category === 'string' &&
    typeof o.preview === 'string' &&
    typeof o.filename === 'string' &&
    typeof o.sub_id === 'string'
  );
}

/** 校验并过滤数据库数组；畸形条目丢弃并告警，不使页面崩溃。 */
export function parseDatabase(raw: unknown): ArchiveItem[] {
  if (!Array.isArray(raw)) {
    console.warn('[schema] database.json 不是数组，已忽略');
    return [];
  }
  const out: ArchiveItem[] = [];
  for (const item of raw) {
    if (isArchiveItem(item)) out.push(item);
    else console.warn('[schema] 跳过畸形稿件条目');
  }
  return out;
}

/** 解析 STCharacters.txt：每行「繁体 简体...」，展开为扁平对应数组。 */
export function parseS2T(text: string): ArchiveDict {
  const s: string[] = [];
  const t: string[] = [];
  text.split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith('#')) return;
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      parts.slice(1).forEach((simple) => {
        s.push(parts[0]!);
        t.push(simple);
      });
    }
  });
  return { s, t };
}
