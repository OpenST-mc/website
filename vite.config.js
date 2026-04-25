import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    vue(),
    tailwindcss()
  ],
  server: {
    host: '0.0.0.0',
    port: 4000,
    open: true,
    cors: true
  },
  build: {
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