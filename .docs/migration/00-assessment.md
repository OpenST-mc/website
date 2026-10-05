# 00 · 现状评估

> 事实基础。所有后续任务以此为准。本轮需求已改变目标（SSG + TSX + 外部认证库 + Vercel 构建输出），因此评估同时列出**现状**与**目标差距**。

## 1. 技术栈现状

| 层 | 现状 |
| --- | --- |
| 开发/构建 | Vite 7（`@vitejs/plugin-vue` + `@tailwindcss/vite`），dev 端口 4000，内置公开 URL rewrite 中间件 |
| 前端框架 | Vue 3.5 **全局 UMD** + **选项式 API**；模板为 JS 字符串或**手写 HTML 文件** |
| 语言 | 纯 JavaScript（无 TypeScript） |
| 样式 | Tailwind CSS v4，三入口产物已提交 |
| 渲染 | **SPA + CSR**；每个页面一个 HTML，浏览器加载原生 ESM + Vue 全局 |
| 认证 | 项目内自研 `apps/auth/auth.js`；CF Worker 提供 `exchange-token/session/check-admin/logout`，token 存 HttpOnly Cookie |
| 后端 | CF Workers `https://api.openstmc.com`（内容增删改、上传中继、`/dl/*`、`/health`） |
| Vercel Functions | `api/share`、`api/download`、`api/stats`（Upstash Redis） |
| 部署 | **Vercel 仓库根静态服务**；`vercel.json` rewrites 映射公开路径；`dist` 不用于生产 |
| CI | GitHub Actions：子模块同步 → `data/build.js` + `data/sitemap.js` → 提交生成物 → Vercel 部署 |

## 2. 现状 vs 目标差距

| 维度 | 现状 | 目标 | 差距性质 |
| --- | --- | --- | --- |
| 渲染 | SPA + CSR | **SSG 预渲染** | 架构级（需求 5） |
| 页面载体 | 手写 `.html` + Vue 模板字符串 | **统一 `.tsx/.ts`**，HTML 由 SSG 生成 | 架构级（需求 1） |
| 语言 | JS | **TS（strict）** | 全量（需求 1/3/4） |
| 认证 | 自研 `auth.js` + Worker | **Auth.js `@auth/core` @ Vercel API** | 架构级（需求 2） |
| 部署 | 仓库根静态 | **Vercel 构建输出（buildCommand/outputDirectory）** | 架构级（需求 5） |
| 测试 | `node:test`（纯逻辑，2 文件） | **Vitest + Testing Library + Playwright + 构建断言** | 新增（需求 3） |
| 健壮性 | 无类型、少校验 | **类型+runtime 校验+错误边界+SSR 安全** | 新增（需求 4） |
| 流程 | 直接改 main | **独立分支 → 本地合并 → 推送分支与 main** | 流程（需求 6） |

## 3. 页面 / 应用清单（迁移主体）

| 路径 | 现状类型 | 目标形态 | 复杂度 | 备注 |
| --- | --- | --- | --- | --- |
| `/`（home） | Vanilla + 手写 HTML | SSG `tsx` | 低 | 彩蛋过渡、字体解锁；原 `data/build.js` 复制到根 `index.html`（SSG 后取消） |
| `/archive`（portal） | **Vue SPA** | SSG shell + CSG 水合 | 高 | 最大：4 组件、过滤/分页/收藏/懒加载/深链/Markdown |
| `/upload` | **Vue SPA** | SSG shell + 客户端交互 | 中 | OAuth、JSZip、上传、标签、预览 |
| `/auth`（回调） | Vanilla | Auth.js 路由接管 | 中 | 由 `api/auth/*` 处理；旧回调页废弃 |
| `/admin_tools`（打包器） | **Vue SPA** | SSG shell + 客户端 | 低 | 试点首选 |
| `/admin_tools/admin_edit` | **Vue SPA** | SSG shell + 客户端 | 中 | 依赖认证与 Worker admin API |
| `/health` | Vanilla | SSG shell + 客户端轮询 | 低 | 拨测逻辑可原样移植 |
| `/profile/april/december`（credits） | Vanilla + Canvas | SSG shell + 客户端 canvas | 中 | 星空动画、Markdown 加载 |
| `/Extra-Function/litematic-converter` | Vanilla + pako | TSX 外壳 + TS 核心 | 中 | 命令式核心保持 |
| `/Extra-Function/litematic-preview` | Vanilla + WebGL | TSX 外壳 + TS 核心 | 高 | 资源巨大、命令式渲染，**不 React 化核心** |
| `/content/**`、`/vendor/**`、`/images/**`、`/fonts/**`、`/Traditional-Simplefild/**` | 静态资产 | 构建输出静态拷贝 | 中 | SSG 后需进入 Vercel 输出 |
| `404` | 手写 `404.html` + JS | SSG 404 路由 | 低 | 需 Vercel 输出根有 `404.html` |

## 4. 现状耦合点（重构时必须处理）

- **Vue**：`createApp`、选项式 API、`v-if/v-for/v-model/v-html/v-cloak`、`$emit/$root/$parent/$refs`、`v-lazy` 指令、`<transition>`。
- **手写 HTML**：每个页面的 `<head>`（SEO/og/favicon/JSON-LD）、脚本标签、内联样式；SSG 后由 Head 组件/渲染器统一生成。
- **全局 UMD**：`Vue`、`marked`、`DOMPurify`、`JSZip`（`vendor/*.min.js`）→ 改为 TS `import`。
- **认证**：`PortalAuth` 的 localStorage 缓存、OAuth state、Worker 端点 → 由 Auth.js 会话 Hook 替换。
- **数据加载**：运行时 `fetch('/archive/data/database.json')`、`fetch('/Traditional-Simplefild/STCharacters.txt')` → SSG 构建期可内联/注入，客户端仅做交互。

## 5. 构建与部署演进

### 现状

```
npm run build
  → node data/build.js            # content 子模块 → archive/data/database.json
  → build:sitemap
  → build:ArchiveCSS / PortalCSS / AdminCSS
  → build:vendor
  → vite build                    # 产出 dist（仅本地参考）
# 生产：Vercel 仓库根静态服务（源码即产物）
```

### 目标

```
npm run build
  → node data/build.js            # 仍生成 database.json（供 SSG 构建期读取）
  → build:sitemap
  → build:CSS
  → vite build                    # Vike SSG：客户端+服务端 bundle + prerender 生成静态 HTML
  → copy 静态资产到输出（content/vendor/images/fonts/s2t/extra）
# 生产：Vercel 执行 buildCommand，服务 outputDirectory（dist）
```

- `vercel.json` 增加 `buildCommand`、`outputDirectory`；`api/**` 仍作为 Functions 被识别。
- **Vercel 构建必须能拿到 `content/` 子模块**（SSG 拷贝静态稿件），需在安装/构建阶段初始化子模块（风险见 `04-risks.md` R1）。
- 原 `data/build.js` 把 `pages/home/index.html` 复制到根 `index.html` 的行为**废弃**（改由 SSG 路由 `/`）。

## 6. 质量门与守卫（需整体重写）

| 门 | 现状 | 目标 |
| --- | --- | --- |
| 类型 | 无 | `tsc --noEmit` / `vue-tsc` 不适用 → `tsc`（`check:types`） |
| Lint | `eslint` 仅 `no-undef` + `Vue` 全局 | `typescript-eslint` + `eslint-plugin-react(-hooks)`，移除 `Vue` 全局 |
| 测试 | `node --test` | `vitest`（单元/组件）+ `playwright`（E2E）+ 构建断言 |
| 路径 | `check-paths.js`（rewrites↔aliases） | 适配 Vike 路由与 Vercel 输出，保留 URL 守卫 |
| 构建 | `vite build` 参考 | `vite build` = SSG 生产构建，必须成功且产物完整 |

## 7. 硬约束与本次变更

`AGENTS.md` 原有硬约束中，**与本轮需求冲突并需更新**的项：

| 原约束 | 本轮处理 |
| --- | --- |
| 生产为仓库根静态服务、`dist` 不参与 | **变更**：改为 Vercel 构建输出（需求 5） |
| 禁止使用 `public/` 目录 | **变更**：Vercel 构建输出下 `public/` 变为标准且可用 |
| 禁止外链 CDN | **保持**：静态库仍自托管 |
| 禁止发明新路由/目录映射 | **局部变更**：SSG 路由需与现有公开 URL 一一对应（不新增对外 URL） |
| 构建顺序固定不得跳段 | **保持精神**：新顺序必须确定且可重现，并写入文档 |

> `AGENTS.md` 需在 M7 随实现一并更新，避免文档与代码不一致。

## 8. 迁移范围（In / Out）

**In**：全部前端页面 TSX+SSG 化；认证迁 Auth.js；构建/测试/部署改造；健壮性修复；分支工作流。
**Out（除非明确要求）**：CF Worker 的**非认证**能力（上传中继、`/dl/*`、`/health` 拨测源）、`api/share|download|stats` 的业务逻辑、数据仓库结构、`content` 内容本身。

## 9. 对等基线（执行前必须记录）

- 每个公开 URL 的**可见行为**、**SEO head**、**网络请求形状**、**持久化键**。
- SSG 的额外验收：**首屏 HTML 即含内容**（无 JS 也能读到标题/正文），水合后交互一致。
