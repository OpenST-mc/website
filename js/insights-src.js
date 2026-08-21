// 分析脚本源码：由 scripts/build-vendor.js 打包为 IIFE 后随页面加载
import { inject } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

injectSpeedInsights({
  framework: 'vue'
});

inject({
  mode: 'production'
});
