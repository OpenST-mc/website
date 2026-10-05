import GitHub from '@auth/core/providers/github';
import type { AuthConfig } from '@auth/core';

// Auth.js（@auth/core）服务端配置，运行于 Vercel Edge Function（api/auth/*）。
// 管理员判定（isAdmin）在 T3.1 与 CF Worker 信任模型定稿后写入会话。
export const authConfig: AuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID ?? '',
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
    }),
  ],
  secret: process.env.AUTH_SECRET,
  basePath: '/api/auth',
  trustHost: true,
  session: { strategy: 'jwt' },
  callbacks: {},
};
