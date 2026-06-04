import { injectSpeedInsights } from '@vercel/speed-insights';
import { inject } from '@vercel/analytics';

injectSpeedInsights({
  framework: 'vue'
});

inject({
  mode: import.meta.env.MODE === 'development' ? 'development' : 'production'
});