# 05 · 架构决策记录（ADR）

> 约束基线。变更任一 ADR 需显式记录并评估影响，执行中不得静默偏离。

---

## ADR-001 · React + 统一 TypeScript，不使用 Next.js
- **状态**：Accepted
- **背景**：需求要求统一 `tsx/ts`、不使用 Next.js。
- **决策**：全部视图用 React 函数组件 + Hooks，代码为 `.ts/.tsx`；`strict` 类型检查入门禁。不引入 Next.js。
- **影响**：无 Next 专属 API（Server Components、`next/*`）；路由/数据由 Vike 与自研 lib 承担。

## ADR-002 · 采用 Vike + `vike-react` 做 SSG
- **状态**：Accepted
- **背景**：需求从 SPA+CSR 迁到 SSG；要求在不用 Next 的前提下保持纯 TSX。
- **决策**：用 **Vike（Vite 原生）+ `vike-react`**，`prerender: true` 生成静态 HTML；页面即 `pages/**/+Page.tsx`；**不引入 React Router**。
- **理由**：与现有 Vite 生态一致；纯 TSX；文件式路由可精确映射公开 URL；SSG 能力成熟。
- **备选（未采纳）**：`vite-react-ssg`（可控性弱）、Astro（页面为 `.astro`，与“统一 tsx”冲突）、自研 SSG（维护成本高）。
- **影响**：新增 `renderer/` 与路由目录；构建由 Vike 接管 `vite build`。

## ADR-003 · 部署改为 Vercel 构建输出
- **状态**：Accepted
- **背景**：SSG 需构建期生成产物；原「仓库根静态服务」不再适配。
- **决策**：`vercel.json` 设置 `buildCommand`/`outputDirectory`/`installCommand`；`dist` 成为生产产物；静态资产构建期拷贝进输出；`api/**` 仍为 Functions。
- **影响**：偏离 `AGENTS.md` 原「仓库根服务/Dist 不参与」约束，需在 M7 更新 `AGENTS.md`；Vercel 构建需子模块（R1）。
- **回滚**：该配置单独提交，便于回退旧部署模型。

## ADR-004 · 公开 URL 与数据流保持不变（部署形态除外）
- **状态**：Accepted
- **背景**：`AGENTS.md` 要求公开 URL 全部不变；本次仅部署形态变更。
- **决策**：对外 URL（`/`、`/archive`、`/upload`、`/admin_tools`、`/health`、`/profile/april/december`、`/Extra-Function/*`、`/content/**`、`/share/:subid`、`/api/**`）**逐一保留**，用 Vike 路由 + `vercel.json` 兼容层实现；`check-paths` 守卫。
- **影响**：任何新路由不得新增对外 URL；`profile/april/december` 等特殊路径用 `+route.ts` 显式声明。

## ADR-005 · 认证改用 Auth.js `@auth/core`（Vercel API）
- **状态**：Accepted（信任模型已定稿：**方案 B**）
- **背景**：需求要求认证改用外部库（Auth.js），承载在 Vercel API；现有为自研 `apps/auth/auth.js` + CF Worker。
- **决策**：
  1. `api/auth/[...auth].ts` 使用 `@auth/core` 的 `Auth()`，GitHub Provider + JWT 会话 Cookie。
  2. 前端用薄客户端 `getSession/signIn/signOut` 与 `useSession`。
  3. 管理员判定（GitHub 组织/团队或允许名单）写入会话。
  4. **信任模型（T3.1 定稿：方案 B）**：**Vercel 新增已认证 admin 代理端点**，在 Vercel 侧用 Auth.js 会话判定管理员后，以服务签名（共享密钥，如 HMAC/`jose`）转发到 CF Worker；Worker 校验服务签名而非直接验 JWT。
     - 方案 A（未采纳）：CF Worker 用 `jose` + 共享 `AUTH_SECRET` 直接校验 Auth.js JWT。
- **影响**：删除 `PortalAuth`/`gh_auth`；用户可见信任根唯一在 Auth.js；需 Vercel env（`AUTH_SECRET`、GitHub OAuth）。
- **风险链接**：R4/R5。

## ADR-006 · extra 工具保持命令式核心
- **状态**：Accepted（M5 实现定稿）
- **背景**：`litematic-preview`（WebGL/deepslate）与 `litematic-converter`（pako）无框架耦合，React 化核心收益低、风险高。
- **决策**：核心保持命令式 TS 模块；仅以 `+Page.tsx` 外壳承接与类型化边界。
- **实现（M5）**：
  1. `litematic-converter`：NBT 解析/写出与版本转换迁 `src/lib/litematic/{nbt,convert}.ts`（纯逻辑 + 单测）；`pako` 改为 `import` 打包；`+Page.tsx` 用 React 表单事件承接 UI，不再有全局脚本。
  2. `litematic-preview`：`viewer`（WebGL）/`litematic-utils`/`deepslate-helpers`/`settings`/`ui-init`/`main` 迁 `src/pages/litematic-preview/*.ts` 命令式模块（状态与 DOM 操作不进 React 状态流）；`+Page.tsx` 仅渲染静态 JSX 外壳，`useEffect` 顺序加载 vendor 脚本（`deepslate`/`gl-matrix`）与 `resource/` 资源后初始化。
  3. 类型化边界：vendor 全局（`deepslate`/`glMatrix`/`assets`/opaque 集合）以 `declare global` + npm 包类型（`typeof import('deepslate'|'gl-matrix')`）声明；核心内部使用自有最小 NBT/结构类型，不在渲染期触碰浏览器全局。
  4. 静态资源：`resource/*`（`assets.js`/`opaque.js`/`atlas.png`/chest 贴图）保持经典脚本/静态文件，随构建拷贝进输出，公开 URL `/Extra-Function/litematic-preview/resource/**` 不变。
- **影响**：避免 R12；与“统一 tsx”以「外壳 tsx + 核心 ts」达成一致。

## ADR-007 · 退役 Vue 后移除 CSP `'unsafe-eval'`
- **状态**：Accepted
- **背景**：现 CSP 为 Vue 运行期模板编译保留 `unsafe-eval`；React 预编译 JSX 不需要。
- **决策**：M7（Vue 完全移除后）从 `vercel.json` 移除 `'unsafe-eval'` 并验证。
- **影响**：安全等级提升；前置确认新依赖不需 eval。

## ADR-008 · 绞杀者迁移 + 按页面独立上线
- **状态**：Accepted
- **背景**：页面相互独立；一次性替换风险高。
- **决策**：逐页迁移，迁移期允许并存；HTML/路由切换后可独立部署与回滚；M7 前不删除旧实现。
- **影响**：降低 R13/R16；允许用低风险页（home/health）先行验证 SSG 管线。

## ADR-009 · TypeScript strict 为硬门
- **状态**：Accepted
- **决策**：`tsconfig` 开启 `strict`/`noUncheckedIndexedAccess`/`noImplicitOverride`；`npm run check:types` 入门禁；禁止新增 `@ts-ignore`/`any` 规避（R7）。
- **影响**：迁移期需逐步收敛类型；不支持“先压制后补”。

## ADR-010 · 分层测试策略
- **状态**：Accepted
- **决策**：Vitest（单元/组件）+ Playwright（E2E/对等）+ 构建断言（SSG 路由/SEO/资产/CSP）。以单元/组件为主，E2E 覆盖关键路径。详见 `06-build-and-testing.md`。
- **影响**：新增测试依赖（Vitest/Testing Library/Playwright），重量理由：SSG+TS 重构的回归成本高于依赖成本。

## ADR-011 · 分支工作流（独立分支 → 本地合并 → 推送双方）
- **状态**：Accepted
- **决策**：在 `refactor/react-ssg` 分支完成全部工作；确认无误后本地合并 `main`（`--no-ff`）并推送分支与 `main`。详见 `07-branch-workflow.md`。
- **影响**：M8 前 `main` 不受影响；需定期与 `main` 同步以减少冲突。

## ADR-012 · 静态资产在构建期拷贝进输出
- **状态**：Accepted
- **背景**：SSG 输出模型下，`/content/**`、`/vendor/**`、`/images/**`、`/fonts/**`、`/Traditional-Simplefild/**`、extra 资源必须随产物提供。
- **决策**：构建脚本把它们拷贝进输出目录；保留 `immutable` 缓存头。
- **影响**：构建时长/产物体积上升；需守卫缺失（R14）。
