import type { Config } from 'vike/types';
import vikeReact from 'vike-react/config';

// Global Vike config (site-wide defaults). Page-level `+config.ts` files can
// override these. SSG: every page is pre-rendered at build time.
export default {
  extends: [vikeReact],
  prerender: true,
  title: 'OpenST',
  description: 'OpenST —— Minecraft 储电社区的门户与存档库。',
} satisfies Config;
