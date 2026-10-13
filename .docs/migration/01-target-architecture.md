# 01 · 目标架构

> 目标：统一 React + TypeScript（`.tsx/.ts`）+ SSG（Vike），认证改为 Auth.js（Vercel API），部署改为 Vercel 构建输出。公开 URL 与数据流尽量不变。决策动机见 `05-decisions.md`。

## 1. 选型总表

| 项 | 选型 | 说明 |
| --- | --- | --- |
| 语言 | **TypeScript（strict）** | 应用代码全部 `.ts/.tsx`；`tsc --noEmit` 纳入门 |
| 框架 | **React** | 全部视图 `.tsx` |
| SSG | **Vike + `vike-react`** | Vite 原生；`prerender: true` 生成静态 HTML；页面即 `.tsx` |
| 路由 | **Vike 文件式路由** | 路由目录与现有公开 URL 一一对应；**不引入 React Router** |
| 构建 | **Vite 7**（保留） | `vite build` 由 Vike 接管，产出 client/server bundle + prerender HTML |
| 开发 | `vite dev`（Vike） | 页面级 HMR；保留公开 URL 解析 |
| 样式 | Tailwind v4（保留） | 调整 `@source` 覆盖 `src/` |
| 认证 | **Auth.js `@auth/core`** | Vercel Functions `api/auth/*`；GitHub Provider；JWT 会话 Cookie |
| 数据校验 | 轻量 runtime schema（如 `zod`/`valibot`，二选一，需论证） | 校验 `database.json`、会话、Worker/Cookie 响应 |
| 测试 | Vitest + Testing Library + Playwright | 见 `06-build-and-testing.md` |
| 静态资产 | 构建期拷贝到输出 | `content/`、`vendor/`、`assets/`、`webfonts/`、extra 资源 |

## 2. 目录布局（目标）

```
src/
  renderer/
    +config.ts              # 全局：prerender、标题模板、passToClient
    +Layout.tsx             # 根布局（含 <html> 之外的应用外壳）
    +Head.tsx               # 默认 head；各页可覆盖
    +onRenderHtml.tsx       # <html lang="zh-CN">、CSP/referrer meta、注入
    +onRenderClient.tsx     # createRoot + hydrateRoot
  pages/
    index/+Page.tsx               # /
    archive/+Page.tsx             # /archive
    upload/+Page.tsx              # /upload
    admin_tools/+Page.tsx         # /admin_tools
    admin_tools/admin_edit/+Page.tsx
    health/+Page.tsx              # /health
    credits/+Page.tsx             # /profile/april/december（route.ts 指定）
    litematic-converter/+Page.tsx # /Extra-Function/litematic-converter
    litematic-preview/+Page.tsx   # /Extra-Function/litematic-preview
    _error/+Page.tsx / 404 处理
  components/                 # 共享 React 组件（NavBar/SideBar/Card/Modal/…）
  hooks/                      # useSession/useLazyImage/useDownloadStats/…
  lib/
    config.ts                 # TAG_CONFIG / CATEGORIES（自 scripts/config.js 迁移）
    logic.ts                  # 过滤/动态标签/路径转义（自 scripts/logic.js 迁移）
    api.ts                    # 客户端 API 封装（Worker/Vercel）
    auth.ts                   # Auth.js 前端薄客户端（signIn/signOut/getSession）
    types.ts                  # 领域类型（ArchiveItem/Session/…）
    schema.ts                 # runtime 校验
public/                       # 构建输出静态资产（images/fonts/s2t/extra 资源…）
vendor/                       # 自托管第三方运行时（保留）
content/                      # 存档子模块；构建期拷贝到输出（见风险）
api/
  auth/[...auth].ts           # Auth.js @auth/core 处理器（GitHub Provider）
  share.ts download.ts stats.ts
data/build.ts                 # 生成 archive/data/database.json（SSG 构建期读取）
scripts/                      # 构建/守卫脚本（可保留 JS 或迁移 TS）
tsconfig.json  vite.config.ts  vercel.json
```

> 具体是否把 `data/build.js`、`scripts/*.js` 也迁移为 TS 由 M1 决定（推荐共享逻辑必迁，纯 Node 脚本可保留 JS）。

## 3. SSG 渲染模型

- **`prerender: true`**：构建期为每个路由生成静态 HTML，包含 SEO head 与首屏内容。
- **数据在构建期注入**：`/archive` 的稿件列表、`/` 的静态内容等，通过 `+data.ts`/`+Page` 的 `data()` 在构建期读取 `archive/data/database.json`（及 `content/` 元数据），随 HTML 内联或由 Vike 序列化传客户端；运行时不再首次 `fetch` 列表（交互筛选仍在客户端）。
- **客户端水合**：`+onRenderClient.tsx` 用 `hydrateRoot`；交互（筛选/分页/弹层/轮询/上传）在客户端运行。
- **SSR 安全**：任何组件渲染期不得直接访问 `window`/`document`/`localStorage`；这些放到 `useEffect` 或 `onBeforeMount` 之外。见 `08-robustness-checklist.md`。
- **动态深链**：`/archive?sub-xxx` 在客户端 `useEffect` 读取并打开详情；构建期无法枚举所有 `?sub-*`，属正常。

## 4. 路由与公开 URL（必须一一对应）

| 公开 URL | Vike 页面 / 处理 |
| --- | --- |
| `/` | `pages/index` |
| `/archive` | `pages/archive` |
| `/upload` | `pages/upload` |
| `/auth`、`/auth/callback` | 由 `api/auth/*`（Auth.js）处理；旧页面删除 |
| `/admin_tools` | `pages/admin_tools` |
| `/admin_tools/admin_edit` | `pages/admin_tools/admin_edit` |
| `/health` | `pages/health` |
| `/profile/april/december` | `pages/credits` + `+route.ts` 指定该路径 |
| `/Extra-Function/litematic-converter` | `pages/litematic-converter` |
| `/Extra-Function/litematic-preview` | `pages/litematic-preview` |
| `/content/**` | 静态拷贝 |
| `/js/**` | 并入构建产物或静态拷贝（不再有 `packages/js` 公开映射的必要） |
| `/images/**`、`/fonts/**`、`/Traditional-Simplefild/**` | `public/` 静态拷贝 |
| `/vendor/**` | 静态拷贝（`vendor/`） |
| `/share/:subid` | Vercel rewrite → `/api/share?id=:subid`（保留） |
| `/api/**` | Vercel Functions |

- `cleanUrls: true`、`trailingSlash: false` 保留。
- 如为兼容历史链接需额外 rewrite，集中在 `vercel.json` 并纳入 `check-paths` 守卫。

## 5. 认证（Auth.js @ Vercel API）

- **处理器**：`api/auth/[...auth].ts` 调用 `@auth/core` 的 `Auth(request, config)`；`config` 定义 GitHub Provider、`session: { strategy: 'jwt' }`、`AUTH_SECRET`、`trustHost`。
- **管理员判定**：在 `signIn`/`jwt`/`session` 回调中，用 GitHub access token 查询组织/团队成员关系（或允许名单），把 `isAdmin` 写入会话。
- **前端客户端**：`lib/auth.ts` 提供 `getSession()`（`fetch('/api/auth/session', {credentials:'include'})`）、`signIn('github')`（跳转 `/api/auth/signin/github?callbackUrl=…`）、`signOut()`；`hooks/useSession.ts` 返回 `{ user, isAdmin, status }`。
- **环境变量**：`AUTH_SECRET`、`AUTH_GITHUB_ID`、`AUTH_GITHUB_SECRET`（写入 Vercel 项目 env）。
- **与 CF Worker 的信任模型**（关键，见 ADR-005）：
  - 方案 A（推荐先做）：Worker 侧用 `jose` 校验 Auth.js 会话 JWT（共享 `AUTH_SECRET`），替换现 `check-admin`。
  - 方案 B：Vercel 侧新增已认证的 admin 代理端点，转发到 Worker 并附服务签名。
  - 选择在 M3 前定稿；无论哪种，**用户可见的信任根唯一在 Auth.js**。

> 现有 `apps/portal/scripts` 中 `PortalAuth` 的 localStorage 缓存与 OAuth state 逻辑**删除**，由 Auth.js 会话模型取代。

## 6. 部署（Vercel 构建输出）

`vercel.json`（示意，最终字段以实现为准）：

```jsonc
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "git submodule update --init --recursive && npm install",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [ /* 保留安全头；CSP 最终移除 unsafe-eval */ ],
  "rewrites": [ { "source": "/share/:subid", "destination": "/api/share?id=:subid" } ]
}
```

- `api/**` 由 Vercel 自动识别为 Functions（含 `api/auth/*`）。
- **`404.html`**：构建输出根需有 404（Vike 的 error 页或专门生成），确保平台兜底。
- **静态资产**：构建脚本把 `content/`、`vendor/`、`webfonts/`、`apps/extra/**/resource` 等拷贝进 `dist/`，保持公开 URL 不变。
- **缓存头**：`/content/**`、`/vendor/**`、`/Extra-Function/**/*.js` 的 `immutable` 保留。

## 7. TypeScript 与健壮性基线

- `tsconfig.json`：`strict: true`、`noUncheckedIndexedAccess`、`noImplicitOverride`、`jsx: react-jsx`。
- 外部输入（`database.json`、Worker 响应、Auth 会话、URL 参数、文件上传）一律经 runtime schema 校验后再使用。
- 统一错误边界与网络封装（超时/取消/重试策略见 `08-robustness-checklist.md`）。
- 禁止在渲染期触碰浏览器全局（SSG 前提）。

## 8. Tailwind

- 扩展三入口 `@source` 覆盖 `src/**`（含 `pages/`、`components/`）；确认 `tsx` 中的类名被扫描。
- 移除 `[v-cloak]` 相关规则。
- 保持现有品牌色/主题变量不变。

## 9. 映射表（Vue/HTML → 目标）

| 现状 | 目标 |
| --- | --- |
| 手写 `<html>`/`<head>` | `renderer/+onRenderHtml.tsx` + `+Head.tsx` |
| 手写页面 HTML | `pages/**/+Page.tsx` |
| 选项式 API | 函数组件 + Hooks |
| `$emit/$root/$parent/$refs` | 显式 props / context / `useRef` |
| `v-lazy` | `useLazyImage` |
| `v-html` | `dangerouslySetInnerHTML`（先 sanitize） |
| 全局 `Vue/marked/DOMPurify/JSZip` | TS `import` |
| 运行时 `fetch(database.json)` 首屏 | SSG 构建期注入 + 客户端交互 |
| `PortalAuth` | Auth.js `useSession` |
| `apps/auth/auth-callback.html` | `api/auth/*`（Auth.js） |
| `data/build.js` 复制 home→根 index | 删除；由 `/` 路由产出 |
