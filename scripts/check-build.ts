import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 构建断言：SSG 产物必须完整。缺项即失败（CI/发布门）。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist', 'client');

// M 阶段推进时扩充：路由 -> 产物 HTML 文件。
const ROUTES: Array<{ route: string; file: string }> = [{ route: '/', file: 'index.html' }];

// 迁移期仍需存在的静态资产（M7 退役 Vue 后移除 vue 项）。
const REQUIRED_ASSETS = [
  '404.html',
  'content',
  'vendor/vue.global.prod.js',
  'assets/images',
  'assets/fonts',
  'webfonts',
  'css/output.css',
];

// M7（Vue 完全移除）后置为 true：断言 CSP 不含 'unsafe-eval'。
const ENFORCE_NO_UNSAFE_EVAL = process.env.ENFORCE_CSP === '1';

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);

for (const { route, file } of ROUTES) {
  const abs = path.join(out, file);
  if (!fs.existsSync(abs)) {
    fail(`缺少预渲染 HTML: ${route} -> ${path.relative(root, abs)}`);
    continue;
  }
  const html = fs.readFileSync(abs, 'utf-8');
  if (!/<title>[^<]+<\/title>/.test(html)) fail(`${route} 缺少非空 <title>`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) fail(`${route} 缺少非空 meta description`);
  if (!/property="og:title"\s+content="[^"]+"/.test(html) && !/content="[^"]+"\s+property="og:title"/.test(html))
    fail(`${route} 缺少 og:title`);
  if (/<div id="root"><\/div>/.test(html)) fail(`${route} 首屏 root 为空（SSG 未注入内容）`);
}

for (const rel of REQUIRED_ASSETS) {
  if (!fs.existsSync(path.join(out, rel))) fail(`缺少静态资产: ${rel}`);
}

// CSP 断言
const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf-8')) as {
  headers?: Array<{ headers?: Array<{ key: string; value: string }> }>;
};
const csp = vercel.headers
  ?.flatMap((h) => h.headers ?? [])
  .find((h) => h.key.toLowerCase() === 'content-security-policy')?.value;
if (!csp) fail('vercel.json 缺少 Content-Security-Policy');
else if (ENFORCE_NO_UNSAFE_EVAL && csp.includes("'unsafe-eval'")) fail('CSP 仍含 unsafe-eval');

if (failures.length > 0) {
  console.error('[check-build] 失败:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log(`[check-build] 通过：${ROUTES.length} 个路由、${REQUIRED_ASSETS.length} 项静态资产、CSP 已校验`);
