import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
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

export default defineConfig({
  plugins: [
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