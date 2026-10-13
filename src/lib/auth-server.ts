import GitHub from '@auth/core/providers/github';
import { Auth, type AuthConfig } from '@auth/core';

const GH_REPO = process.env.GH_REPO ?? 'OpenST-mc/website';

// 服务端判定：该 GitHub 用户对仓库是否具备 push 权限。
async function hasRepoPush(ghToken: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.github.com/repos/${GH_REPO}`, {
      headers: { Authorization: `token ${ghToken}`, 'User-Agent': 'OpenST-Portal', Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { permissions?: { push?: boolean } };
    return data.permissions?.push === true;
  } catch {
    return false;
  }
}

// Auth.js（@auth/core）服务端配置，运行于 Vercel Edge Function（api/auth/*）。
// 方案 B：管理员判定写入会话；GitHub token 仅存于加密 JWT（HttpOnly），
// 由 api/admin/* 代理在服务端解出后以服务签名转发 Worker，绝不回传前端。
export const authConfig: AuthConfig = {
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID ?? '',
      clientSecret: process.env.AUTH_GITHUB_SECRET ?? '',
      authorization: { params: { scope: 'read:user user:email public_repo' } },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  basePath: '/api/auth',
  trustHost: true,
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.ghToken = account.access_token;
        const login = (profile as { login?: string } | undefined)?.login;
        if (login) token.login = login;
        token.isAdmin = await hasRepoPush(account.access_token);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { isAdmin?: boolean }).isAdmin = Boolean(token.isAdmin);
        const login = token.login as string | undefined;
        if (login) session.user.name = session.user.name ?? login;
      }
      return session;
    },
  },
};

// api/auth/** 显式路由共用入口（Vercel 对裸 api/ 的 [...catchall] 仅匹配单段路径，须逐路由建文件）。
export function authHandler(request: Request): Promise<Response> {
  return Auth(request, authConfig);
}
