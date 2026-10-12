import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import vike from 'vike/plugin';
import path from 'node:path';
import fs from 'node:fs';
import type { ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 公开 URL 根 -> 物理目录（迁移期：尚未迁移的旧 Vue/HTML 页面由此在 dev 中可达）
const PUBLIC_ALIASES: Record<string, string> = {
  '/js/': 'packages/js/',
  '/fonts/': 'assets/fonts/',
  '/images/': 'assets/images/',
  '/Traditional-Simplefild/': 'assets/s2t/',
  '/Extra-Function/': 'apps/extra/',
};

function sendHtml(res: ServerResponse, file: string): boolean {
  if (path.extname(file) !== '.html' || !fs.existsSync(file)) return false;
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(fs.readFileSync(file));
  return true;
}

// 迁移期 dev 兼容层：把尚未被 Vike 接管的公开 URL 直接以旧 HTML 响应，
// 行为对齐生产 vercel.json rewrites。已由 Vike 接管的 URL（如 `/`）不在此处理。
function legacyPages(): Plugin {
  return {
    name: 'legacy-public-pages',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? '';
        const pathname = raw.split('?')[0] ?? '';
        const query = raw.slice(pathname.length);
        if (pathname === '/' || pathname === '/index.html') {
          next();
          return;
        }
        // Vercel 注入的分析端点（dev 无平台侧）：直接空响应，避免 Vike 误当路由。
        if (pathname.startsWith('/_vercel/')) {
          res.statusCode = 204;
          res.end();
          return;
        }

        for (const [pub, phys] of Object.entries(PUBLIC_ALIASES)) {
          const base = pub.replace(/\/$/, '');
          if (pathname !== base && !pathname.startsWith(base + '/')) continue;
          const rest = pathname.slice(base.length).replace(/^\//, '');

          if (path.extname(pathname)) {
            // 旧 HTML 直接响应（Vike 会把未知 .html 当路由并 500）
            if (path.extname(pathname) === '.html' && sendHtml(res, path.join(__dirname, phys, rest))) {
              console.log(`[legacy] page ${pathname} -> ${phys}${rest}`);
              return;
            }
            // 其余静态资源：重写到物理路径后交由 Vite 静态服务
            console.log(`[legacy] asset ${pathname} -> /${phys}${rest}`);
            req.url = '/' + phys + rest + query;
            next();
            return;
          }
          for (const cand of [path.join(__dirname, phys, rest + '.html'), path.join(__dirname, phys, rest, 'index.html')]) {
            if (sendHtml(res, cand)) {
              console.log(`[legacy] page ${pathname} -> ${path.relative(__dirname, cand)}`);
              return;
            }
          }
        }

        if (!path.extname(pathname)) {
          for (const cand of [pathname + '.html', pathname + '/index.html']) {
            const file = path.join(__dirname, cand.replace(/^\//, ''));
            if (sendHtml(res, file)) {
              console.log(`[legacy] page ${pathname} -> ${path.relative(__dirname, file)}`);
              return;
            }
          }
        }
        next();
      });
    },
  };
}

// 预览（vite preview）下镜像 vercel.json 的公开路径 rewrite：把 /Extra-Function、
// /images 等公开路径映射到输出内的物理目录，便于对构建产物做 E2E（生产由 Vercel 应用同一映射）。
// 与 Vercel 一致：静态文件优先，命中输出文件时不 rewrite（如 Vike 预渲染页面）。
function publicRewritesPreview(): Plugin {
  const outDir = path.join(__dirname, 'dist', 'client');
  const existsAsStatic = (pathname: string): boolean => {
    const abs = path.join(outDir, pathname.replace(/^\//, ''));
    return fs.existsSync(abs) || fs.existsSync(abs + '.html') || fs.existsSync(path.join(abs, 'index.html'));
  };

  const handle: Connect.NextHandleFunction = (req, _res, next) => {
    const raw = req.url ?? '';
    const pathname = raw.split('?')[0] ?? '';
    const query = raw.slice(pathname.length);
    for (const [pub, phys] of Object.entries(PUBLIC_ALIASES)) {
      const base = pub.replace(/\/$/, '');
      if (pathname !== base && !pathname.startsWith(base + '/')) continue;
      if (existsAsStatic(pathname)) break;
      const rest = pathname.slice(base.length).replace(/^\//, '');
      req.url = '/' + phys + rest + query;
      break;
    }
    next();
  };
  return {
    name: 'public-rewrites-preview',
    configurePreviewServer(server) {
      server.middlewares.use(handle);
    },
  };
}

export default defineConfig({
  plugins: [legacyPages(), publicRewritesPreview(), react(), tailwindcss(), vike()],
  resolve: {
    alias: Object.entries(PUBLIC_ALIASES).map(([pub, phys]) => ({
      find: new RegExp('^' + pub.replace(/\//g, '\\/')),
      replacement: path.resolve(__dirname, phys) + '/',
    })),
  },
  server: {
    host: '0.0.0.0',
    port: 4000,
    open: true,
    cors: true,
  },
});
