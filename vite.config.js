import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    vue()
  ],
  server: {
    host: '0.0.0.0',
    port: 4000,
    open: true,
    cors: true
  },
  build: {
    base: '/',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        upload: 'upload/upload.html',
        archive: 'archive.html'
      }
    }
  }
})