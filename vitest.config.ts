import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 单元/组件测试（与 Vite/Vike 构建配置分离，避免 Vike 插件介入测试）。
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
});
