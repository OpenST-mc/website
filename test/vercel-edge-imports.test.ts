import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Vercel Edge 打包（api/*.ts）会把 TS 编译产物重命名 .ts → .js，但不重写 import 说明符，
// 带 .ts/.tsx 扩展名的相对导入在部署期会被判定为 unsupported modules 并致部署失败。
const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'api');
const TS_EXT_IMPORT = /(?:from|import\s*\()\s*['"](\.[^'"]*\.tsx?)['"]/g;

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('api/** 导入约束（Vercel Edge）', () => {
  it('相对导入不得带 .ts/.tsx 扩展名', () => {
    const offenders: string[] = [];
    for (const file of collectTsFiles(apiDir)) {
      const source = fs.readFileSync(file, 'utf-8');
      for (const match of source.matchAll(TS_EXT_IMPORT)) {
        offenders.push(`${path.relative(apiDir, file)}: ${match[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
