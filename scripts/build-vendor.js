// 构建本地 vendor 库：复制第三方 dist 文件 + esbuild 打包/压缩
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'vendor');

const copies = [
  { from: 'node_modules/vue/dist/vue.global.prod.js', to: 'vue.global.prod.js' },
  { from: 'node_modules/jszip/dist/jszip.min.js', to: 'jszip.min.js' },
  { from: 'node_modules/dompurify/dist/purify.min.js', to: 'purify.min.js' },
  { from: 'node_modules/pako/dist/browser/pako.umd.min.js', to: 'pako.min.js' },
  { from: 'node_modules/deepslate/dist/deepslate.umd.js', to: 'deepslate.umd.js' },
  { from: 'node_modules/gl-matrix/gl-matrix-min.js', to: 'gl-matrix-min.js' },
  { from: 'node_modules/@fortawesome/fontawesome-free/css/all.min.css', to: 'font-awesome.css' },
  { from: 'node_modules/material-icons/iconfont/material-icons.css', to: 'material-icons.css' },
  { from: 'node_modules/material-icons/iconfont/material-icons.woff2', to: 'material-icons.woff2' },
  { from: 'node_modules/material-icons/iconfont/material-icons.woff', to: 'material-icons.woff' }
];

const dirCopies = [
  // font-awesome css 内 url 为 ../webfonts/，需放在 /webfonts/ 根目录
  { from: 'node_modules/@fortawesome/fontawesome-free/webfonts', to: 'webfonts' }
];

async function build() {
  fs.mkdirSync(outDir, { recursive: true });

  for (const c of copies) {
    fs.copyFileSync(path.join(root, c.from), path.join(outDir, c.to));
    console.log(`已复制: ${c.to}`);
  }

  for (const d of dirCopies) {
    fs.cpSync(path.join(root, d.from), path.join(root, d.to), { recursive: true });
    console.log(`已复制目录: ${d.to}`);
  }

  await esbuild.build({
    entryPoints: [path.join(root, 'js/insights-src.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    outfile: path.join(outDir, 'insights.bundle.js')
  });
  console.log('已打包: insights.bundle.js');

  await esbuild.build({
    entryPoints: [path.join(root, 'node_modules/marked/lib/marked.umd.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    outfile: path.join(outDir, 'marked.min.js')
  });
  console.log('已压缩: marked.min.js');
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
