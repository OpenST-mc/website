import { authHandler } from '../../src/lib/auth-server';

// Auth.js 显式路由（对齐 /api/auth/providers）。
export const config = { runtime: 'edge' as const };

export default authHandler;
