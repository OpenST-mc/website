import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import vike from 'vike/plugin';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// 公开 URL 根 -> 物理目录（与 vercel.json rewrites 一一对应，
// check-paths 守卫；页面路由由 Vike 接管）
const PUBLIC_ALIASES: Record<string, string> = {
  '/fonts/': 'assets/fonts/',
  '/images/': 'assets/images/',
  '/Traditional-Simplefild/': 'assets/s2t/',
  '/Extra-Function/': 'apps/extra/',
};

// dev 兼容层：把公开别名路径下的静态资源重写到物理目录，行为对齐生产 vercel.json rewrites。
// 无扩展名的请求是 Vike 页面路由（如 /Extra-Function/litematic-preview），不在此处理。
function devPublicRewrites(): Plugin {
  return {
    name: 'dev-public-rewrites',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const raw = req.url ?? '';
        const pathname = raw.split('?')[0] ?? '';
        const query = raw.slice(pathname.length);
        // Vercel 注入的分析端点（dev 无平台侧）：直接空响应，避免 Vike 误当路由。
        if (pathname.startsWith('/_vercel/')) {
          res.statusCode = 204;
          res.end();
          return;
        }

        for (const [pub, phys] of Object.entries(PUBLIC_ALIASES)) {
          const base = pub.replace(/\/$/, '');
          if (pathname !== base && !pathname.startsWith(base + '/')) continue;
          if (!path.extname(pathname)) break;
          const rest = pathname.slice(base.length).replace(/^\//, '');
          req.url = '/' + phys + rest + query;
          break;
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
  const outDir = path.join(rootDir, 'dist', 'client');
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
  plugins: [devPublicRewrites(), publicRewritesPreview(), react(), tailwindcss(), vike()],
  resolve: {
    alias: Object.entries(PUBLIC_ALIASES).map(([pub, phys]) => ({
      find: new RegExp('^' + pub.replace(/\//g, '\\/')),
      replacement: path.resolve(rootDir, phys) + '/',
    })),
  },
  server: {
    host: '0.0.0.0',
    port: 4000,
    open: true,
    cors: true,
  },
});
