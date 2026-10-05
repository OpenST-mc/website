import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SSG 输出为 dist/client（HTML + 哈希资源）。原「仓库根静态服务」下的公开目录
// 需拷贝进输出，保持公开 URL 不变（迁移期：未迁移旧页与静态资产仍可达）。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'client');

const DIRS = ['apps', 'archive', 'assets', 'content', 'css', 'packages', 'pages', 'vendor', 'webfonts'];
// 注意：根 index.html 由 Vike SSG 生成，绝不覆盖；旧首页保留在 pages/home/index.html，
// 由 vercel rewrite 在迁移期继续承接 `/`。
const FILES = ['404.html', 'robots.txt', 'sitemap.xml', '.nojekyll'];

const skipDotGit = (src: string) => !path.basename(src).startsWith('.git');

let dirCount = 0;
for (const rel of DIRS) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) {
    console.warn(`[build-static] 跳过缺失目录: ${rel}`);
    continue;
  }
  fs.cpSync(src, path.join(out, rel), { recursive: true, filter: skipDotGit });
  dirCount++;
}

let fileCount = 0;
for (const rel of FILES) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, path.join(out, rel));
  fileCount++;
}

const required = [path.join(out, 'index.html'), path.join(out, '404.html')];
for (const f of required) {
  if (!fs.existsSync(f)) {
    console.error(`[build-static] 缺少必需产物: ${path.relative(root, f)}`);
    process.exit(1);
  }
}

console.log(`[build-static] 已拷贝 ${dirCount} 个目录、${fileCount} 个根文件到 dist/client`);
