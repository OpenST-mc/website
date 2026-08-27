import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 公开 URL 根 -> 物理目录（与 vercel.json rewrites 保持一致，供构建期解析）
const PUBLIC_ALIASES = {
  '/js/': 'packages/js/',
  '/fonts/': 'assets/fonts/',
  '/images/': 'assets/images/',
  '/Traditional-Simplefild/': 'assets/s2t/',
  '/archive/': 'apps/portal/',
  '/upload/': 'apps/upload/',
  '/auth/': 'apps/auth/',
  '/admin_tools/': 'apps/admin/',
  '/health/': 'apps/health/',
  '/profile/april/december/': 'apps/credits/',
  '/Extra-Function/': 'apps/extra/'
}

// dev 中间件：把公开 URL 重写到物理路径，行为对齐生产 vercel.json rewrites
// （仅 serve 模式生效；含 query 的路径同样命中）
function publicRewrites() {
  return {
    name: 'public-url-rewrites',
    apply: 'serve',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0];
        let hit = null;
        if (url === '/' || url === '/index.html') hit = '/pages/home/index.html';
        if (!hit) {
          for (const [pub, phys] of Object.entries(PUBLIC_ALIASES)) {
            if (url.startsWith(pub)) { hit = '/' + phys + url.slice(pub.length); break; }
          }
        }
        if (!hit && !path.extname(url)) {
          for (const cand of [url + '.html', url + '/index.html']) {
            try { fs.accessSync(path.join(__dirname, cand.replace(/^\//, ''))); hit = cand; break; } catch { }
          }
        }
        if (hit) {
          const qs = url.length < (req.url || '').length ? (req.url || '').slice(url.length) : '';
          console.log(`[rewrite] ${req.url} -> ${hit}${qs}`);
          req.url = hit + qs;
        }
        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [
    publicRewrites(),
    tailwindcss(),
    vue()
  ],
  resolve: {
    alias: Object.entries(PUBLIC_ALIASES).map(([pub, phys]) => ({
      find: new RegExp('^' + pub.replace(/\//g, '\\/')),
      replacement: path.resolve(__dirname, phys) + '/'
    }))
  },
  server: {
    host: '0.0.0.0',
    port: 4000,
    open: true,
    cors: true
  },
  build: {
    base: './',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'pages/home/index.html',
        upload: 'apps/upload/index.html',
        archive: 'apps/portal/index.html'
      }
    }
  }
})