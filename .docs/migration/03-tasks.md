# 03 · 任务清单（唯一任务列表目标）

> 状态：`[ ]` 待办 · `[~]` 进行中 · `[x]` 完成 · `[!]` 阻塞（注明）。
> 每任务收尾门：`npm run check:types` · `npm run lint` · `npm run test` · `npm run check:paths` · `npm run build`（UI 加人工对等）。
> 全程在 `refactor/react-ssg` 分支（T0.3 建立）。禁止跳依赖、跳过质量门、手改生成物。

---

## M0 · 评估、决策、分支与测试策略

### [x] 1 现状评估更新
**描述**：更新 `00-assessment.md`，标注 SPA→SSG、JS→TS、自研认证→Auth.js、根服务→Vercel 输出的差距。
**验收**：页面清单/耦合点/构建链路准确；差距表完整。
**验证**：与代码交叉核对。
**依赖**：无 · **规模**：S · **文件**：`00-assessment.md`

### [x] 2 目标架构与 ADR 定稿
**描述**：确认 `01-target-architecture.md` 与 `05-decisions.md`；重点敲定 ADR-005（Auth.js 与 CF Worker 的信任模型）。
**验收**：无未决 ADR；路由↔公开 URL 映射逐条确认。
**验证**：维护者评审。
**依赖**：T0.1 · **规模**：M · **文件**：`01-target-architecture.md`、`05-decisions.md`

### [x] 3 建立重构分支
**描述**：从 `main` 创建 `refactor/react-ssg`，确认工作区干净。
**验收**：`git branch --show-current` = `refactor/react-ssg`。
**验证**：`git status`。
**依赖**：T0.2 · **规模**：XS · **文件**：无

### [x] 4 构建与测试策略设计
**描述**：完成 `06-build-and-testing.md`：构建管线、静态拷贝、Vercel 输出、测试分层、构建断言、门命令。
**验收**：门命令可在当前基线执行；依赖清单与重量理由明确。
**验证**：逐条执行现行命令。
**依赖**：T0.2 · **规模**：M · **文件**：`06-build-and-testing.md`

### [x] 5 健壮性基线
**描述**：完成 `08-robustness-checklist.md` 并作为 M6 验收依据。
**验收**：清单覆盖类型/校验/错误/SSR/安全/可访问性。
**验证**：维护者评审。
**依赖**：T0.2 · **规模**：S · **文件**：`08-robustness-checklist.md`

### Checkpoint M0
- [x] 文档全部确认；分支已建立；门命令可执行

---

## M1 · TS + Vike SSG 工具链 + 测试框架 + Auth.js 骨架

### [x] 1 引入 TypeScript 并迁移纯逻辑
**描述**：新增 `tsconfig.json`（strict）、`check:types`；将 `scripts/config.js`、`scripts/logic.js` 迁移为 `src/lib/{config,logic}.ts` 并保留/迁移单测。
**验收**：`npm run check:types` 无错；过滤逻辑行为不变（测试绿）。
**验证**：`npm run check:types`；`npm run test`。
**依赖**：M0 · **规模**：M · **文件**：`tsconfig.json`、`src/lib/{config,logic}.ts`、`test/logic.test.ts`

### [x] 2 安装 Vike + vike-react 并建 renderer 骨架
**描述**：加入 `vike`、`vike-react`（钉版）；建立 `src/renderer/{+config.ts,+onRenderHtml.tsx,+onRenderClient.tsx,+Layout.tsx,+Head.tsx}` 与一个最小 `pages/index`。
**验收**：`vite dev` 渲染最小页；`vite build` 能 prerender 出 HTML。
**验证**：`npm run dev`；`npm run build` 后检查 `dist/`。
**依赖**：T1.1 · **规模**：M · **文件**：`package.json`、`src/renderer/*`、`src/pages/index/*`

### [x] 3 vite.config 迁移为 TS 并接入 Vike
**描述**：`vite.config.js` → `vite.config.ts`；加入 Vike 插件；保留 Tailwind 与公开 URL 解析（是否仍需 rewrite 中间件按 Vike 路由评估）。
**验收**：dev/build 均通过；Tailwind 生效。
**验证**：`npm run dev`、`npm run build`。
**依赖**：T1.2 · **规模**：M · **文件**：`vite.config.ts`、`scripts/paths.ts`（若抽）

### [x] 4 SSG 构建与静态资产拷贝
**描述**：确定构建流水线；新增/改造脚本把 `content/`、`vendor/`、`assets/`（images/fonts/s2t）、`webfonts/`、extra 资源拷贝进输出；`data/build.ts` 仍生成 `archive/data/database.json` 供构建期读取。
**验收**：产物含上述静态树；公开 URL 可达。
**验证**：`npm run build` 后逐一 `Test-Path` 产物文件。
**依赖**：T1.2 · **规模**：M · **文件**：`scripts/build-static.*`、`package.json`、`vite.config.ts`

### [x] 5 Vercel 构建输出配置
**描述**：`vercel.json` 增加 `buildCommand`/`outputDirectory`/`installCommand`（含子模块初始化）；确认 `api/**` Functions 仍被识别；确保输出根有 `404.html`；保留安全头与 `/share` rewrite。
**验收**：Vercel 预览构建成功；路由/API/静态均可达。
**验证**：部署预览或本地 `vercel build`（若可用）。
**依赖**：T1.4 · **规模**：M · **文件**：`vercel.json`

### [x] 6 Tailwind @source 适配
**描述**：三入口 `@source` 覆盖 `src/**`（pages/components/hooks/lib）；移除 `[v-cloak]`。
**验收**：仅出现在 `tsx` 的类名进入产物。
**验证**：构造探针类名 grep 产物。
**依赖**：T1.2 · **规模**：S · **文件**：`css/*Input.css`

### [x] 7 Auth.js `@auth/core` 骨架
**描述**：`api/auth/[...auth].ts` 调 `Auth(request, config)`；GitHub Provider、JWT 会话、`AUTH_SECRET`/`trustHost`；`callbacks` 预留 `isAdmin`。
**验收**：`/api/auth/session` 返回 null（未登录）；`/api/auth/signin/github` 正确重定向。
**验证**：本地 `vercel dev` 或受控环境请求。
**依赖**：T1.5 · **规模**：M · **文件**：`api/auth/[...auth].ts`、`src/lib/auth-server.ts`

### [x] 8 前端 auth 客户端与 `useSession`
**描述**：`src/lib/auth.ts`（`getSession/signIn/signOut`）与 `src/hooks/useSession.ts`（`{user,isAdmin,status}`）。
**验收**：类型完备；在最小页可读会话。
**验证**：组件测试 + 手工。
**依赖**：T1.7 · **规模**：M · **文件**：`src/lib/auth.ts`、`src/hooks/useSession.ts`

### [x] 9 Vitest 单元/组件测试框架
**描述**：引入 `vitest` + `@testing-library/react` + DOM 环境；配置 `npm run test`；迁移既有测试。
**验收**：示例组件测试可运行。
**验证**：`npm run test`。
**依赖**：T1.1 · **规模**：M · **文件**：`package.json`、`vitest.config.ts`、`test/**`

### [x] 10 Playwright E2E 框架
**描述**：引入 `@playwright/test`；配置对构建预览的 E2E 基座与一条冒烟用例。
**验收**：`npm run test:e2e` 可跑通冒烟。
**验证**：本地执行。
**依赖**：T1.4 · **规模**：M · **文件**：`playwright.config.ts`、`e2e/**`

### [x] 11 构建断言脚本
**描述**：新增脚本断言：每个路由存在预渲染 HTML、含预期 SEO meta、首屏含关键内容、无 `unsafe-eval`（M7 后）、静态资产存在。
**验收**：断言脚本在构建后运行；缺项即失败。
**验证**：`npm run check:build`。
**依赖**：T1.4 · **规模**：M · **文件**：`scripts/check-build.*`、`package.json`

### [x] 12 质量门重写
**描述**：ESLint 迁移 `typescript-eslint` + React 插件；移除 `Vue` 全局；Prettier 适配；`check-paths` 适配新路由/输出。
**验收**：`lint`/`check:types`/`check:paths` 绿。
**验证**：三门连跑。
**依赖**：T1.1、T1.3 · **规模**：M · **文件**：`eslint.config.*`、`.prettierignore`、`scripts/check-paths.*`

### Checkpoint M1
- [x] SSG 产物与静态资产完整；Vitest/类型门绿
- [x] dev HMR 正常；旧 Vue 页面抽查无回归；Auth 会话端点可用

---

## M2 · 共享布局/SEO/错误边界 + 静态页 SSG 化

### [x] 1 共享 Layout/Head/SEO 与错误边界
**描述**：统一 head（title/description/og/twitter/itemprop/favicon/JSON-LD）、根布局、`ErrorBoundary`、`NotFound`。
**验收**：各页面可复用且 SEO 可覆盖。
**验证**：构建断言 + 人工。
**依赖**：M1 · **规模**：M · **文件**：`src/renderer/*`、`src/components/*`

### [x] 2 home → SSG TSX
**描述**：`/` 迁移 `pages/home` 与 `packages/js/portal.js`（彩蛋过渡、字体解锁、控制台提示）。
**验收**：首屏含内容；交互/SEO 对等；移除 `data/build.js` 的 home→根 index 复制。
**验证**：E2E + 人工；构建断言。
**依赖**：T2.1 · **规模**：M · **文件**：`src/pages/index/+Page.tsx`、`data/build.ts`

### [x] 3 404 → SSG
**描述**：`sub-*` 劫持与错误页迁移；确保输出根 `404.html`。
**验收**：命中/未命中行为对等。
**验证**：E2E + 人工。
**依赖**：T2.1 · **规模**：S · **文件**：`src/pages/_error/*`、`vercel.json`

### [x] 4 health → SSG TSX
**描述**：拨测/30s 轮询/复制诊断迁移；网络请求放 `useEffect`。
**验收**：状态判定与自动刷新对等。
**验证**：E2E + 人工。
**依赖**：T2.1 · **规模**：M · **文件**：`src/pages/health/*`、`src/hooks/*`

### [x] 5 credits → SSG TSX
**描述**：星空 canvas、Markdown 加载、入场遮罩迁移；canvas 逻辑放 `useEffect`。
**验收**：动画/加载/遮罩对等。
**验证**：E2E + 人工。
**依赖**：T2.1 · **规模**：M · **文件**：`src/pages/credits/*`

### [x] 6 静态页对等与构建断言
**描述**：对上述页面逐项核对 SEO/行为，扩充构建断言。
**验收**：对等清单全勾；断言覆盖新路由。
**验证**：`npm run check:build` + E2E。
**依赖**：T2.2–T2.5 · **规模**：S · **文件**：`e2e/**`、`scripts/check-build.*`

### Checkpoint M2
- [x] 静态页首屏含内容、水合无警告、SEO 对等；构建断言通过

---

## M3 · 认证打通 + upload / admin

### [x] 认证信任模型落地
**描述**：按 ADR-005 定稿并实现：Worker 校验 Auth.js JWT（`jose`+共享密钥）**或** Vercel 已认证代理。管理员判定写进会话。
**验收**：管理员判定与旧 Worker 行为等价；令牌不可伪造/过期即失效。
**验证**：受控端点测试（登录/未登录/越权）。
**依赖**：T1.7、M2 · **规模**：L · **文件**：`workers/workers 2.js`（或 `api/admin-proxy.ts`）、`src/lib/auth-server.ts`

### [x] T3.2 登录/登出/回调流程
**描述**：用 Auth.js 端点替换旧回调页；`signIn('github', { callbackUrl })` 的站内跳转白名单。
**验收**：登录/登出/回跳对等；无法开放重定向。
**验证**：E2E（mock） + 人工。
**依赖**：T3.1 · **规模**：M · **文件**：`src/lib/auth.ts`、`src/components/*`、删除 `apps/auth/*`
**备注**：`sanitizeCallbackUrl` + `AuthButton` 已落地并单测；旧 `apps/auth/auth-callback.html` 仍被未迁移的 portal/upload OAuth 重定向使用，删除顺延至 T3.6/T7.2（strangler 安全）。

### [x] T3.3 admin_tools → TSX
**描述**：打包器 UI/JSZip/`info.json` 逐行对等迁移。
**验收**：zip 与 `info.json` 语义一致。
**验证**：组件/单元测试 + 人工。
**依赖**：T3.1 · **规模**：M · **文件**：`src/pages/admin_tools/*`
**备注**：`/admin_tools` 与 `/admin_tools/admin_edit` 共享旧 `/admin_tools/:path*` rewrite，会遮蔽 Vike 路由，故与 T3.4 合并落地；`info.json`/zip 语义抽到 `src/lib/packer.ts` 并单测。

### [x] T3.4 admin_edit → TSX
**描述**：编辑器表单、标签、预览、`update-preview/replace-litematic/update-info/delete-archive` 迁移并用新会话鉴权。
**验收**：四端点请求形状与成功/失败分支对等。
**验证**：受控环境抽查 + 人工。
**依赖**：T3.1 · **规模**：L · **文件**：`src/pages/admin_tools/admin_edit/*`、`src/lib/api.ts`
**备注**：改用 `useSession` 会话门 + 同源 `/api/admin/*` 代理（方案 B）；四端点请求体形状保持不变。

### [ ] T3.5 upload → SSG shell + 交互
**描述**：登录门、表单、标签、预览、JSZip→`archive-upload`→`submit-issue` 迁移；改用 `useSession`。
**验收**：`info.json`/Issue body 逐字对等；失败回退。
**验证**：E2E（mock）+ 受控端到端。
**依赖**：T3.1 · **规模**：L · **文件**：`src/pages/upload/*`

### [ ] T3.6 移除 `PortalAuth`
**描述**：删除 `apps/auth/auth.js` 及全部 `PortalAuth` 引用（portal/upload/admin）。
**验收**：grep 无 `PortalAuth`/`gh_auth` 业务（除迁移说明）。
**验证**：`npm run lint` + grep。
**依赖**：T3.2–T3.5 · **规模**：S · **文件**：`apps/auth/*`、各引用处

### [ ] T3.7 M3 对等与门
**描述**：汇总对等清单并跑全量门。
**验收**：认证/上传/管理全对等；门绿。
**验证**：全门 + E2E。
**依赖**：T3.2–T3.6 · **规模**：S · **文件**：本文件

### Checkpoint M3
- [ ] 认证全链路对等；upload/admin 全对等；无 `PortalAuth` 残留

---

## M4 · portal（切片）

### [ ] T4.1 构建期数据注入
**描述**：`+data.ts` 在构建期读取 `database.json` 与繁简字典；定义 `ArchiveItem` 类型与 runtime 校验；序列化传客户端。
**验收**：SSG 首屏含稿件列表；无需首屏 `fetch`。
**验证**：构建断言（HTML 含稿件名）+ 单测。
**依赖**：M3 · **规模**：M · **文件**：`src/pages/archive/+data.ts`、`src/lib/{types,schema}.ts`

### [ ] T4.2 壳、深链与认证
**描述**：`App` 壳；`?sub-*` 打开详情；`popstate` 还原；`document.title` 同步；`useSession`。
**验收**：深链/前进后退/标题与旧版一致。
**验证**：E2E + 人工。
**依赖**：T4.1 · **规模**：M · **文件**：`src/pages/archive/+Page.tsx`、`src/components/App.tsx`

### [ ] T4.3 NavBar 与 SideBar
**描述**：显式 props/回调；移动抽屉、收藏开关、动态标签收窄、重置。
**验收**：筛选/清除/收藏计数/移动端对等；无 `$parent` 类耦合。
**验证**：组件测试 + 人工。
**依赖**：T4.2 · **规模**：M · **文件**：`src/components/{NavBar,SideBar}.tsx`

### [ ] T4.4 卡片网格、懒加载与分页
**描述**：`ArchiveCard`、`useLazyImage`、分页/页码输入。
**验收**：懒加载进/出视口与分页对等。
**验证**：组件测试 + 网络面板。
**依赖**：T4.3 · **规模**：M · **文件**：`src/components/ArchiveCard.tsx`、`src/hooks/useLazyImage.ts`

### [ ] T4.5 DetailModal
**描述**：Markdown（marked+DOMPurify，`dangerouslySetInnerHTML`）、下载链接、`/api/stats` 计数、3D 预览链接、代理开关、复制直链。
**验收**：渲染/计数/链接/复制对等。
**验证**：组件测试 + E2E。
**依赖**：T4.4 · **规模**：M · **文件**：`src/components/DetailModal.tsx`

### [ ] T4.6 图片放大与标题
**描述**：根级图片放大、body overflow 锁、`closeZoom`。
**验收**：行为对等。
**验证**：E2E + 人工。
**依赖**：T4.5 · **规模**：S · **文件**：`src/components/ImageZoom.tsx`

### [ ] T4.7 逻辑复用与组件测试
**描述**：确认筛选/动态标签仍走 `src/lib/logic.ts`；补组件测试（SideBar/ArchiveCard/分页）。
**验收**：`logic` 单测不变；组件测试覆盖主交互。
**验证**：`npm run test`。
**依赖**：T4.4 · **规模**：M · **文件**：`test/**`

### [ ] T4.8 性能与 SSG/水合核对
**描述**：检查首屏 HTML、水合耗时、bundle 体积、图片懒加载、无 hydration mismatch。
**验收**：无明显性能回归；无警告。
**验证**：Lighthouse/内存 + 控制台。
**依赖**：T4.6 · **规模**：M · **文件**：`src/pages/archive/*`

### [ ] T4.9 portal 切路由与验收
**描述**：`/archive` 路由替换旧 HTML；跑对等与全门。
**验收**：公开 URL/SEO 不变；功能对等。
**验证**：全门 + E2E。
**依赖**：T4.8 · **规模**：S · **文件**：`src/pages/archive/*`

### Checkpoint M4
- [ ] SSG 首屏含列表；筛选/分页/收藏/深链/下载全对等；门绿

---

## M5 · extra 工具 TS 化 + 静态资源收口

### [ ] T5.1 extra 决策
**描述**：书面确认命令式核心保持；仅 TSX 外壳承接 UI。
**验收**：决策记录；核心不移入 React 状态流。
**验证**：评审。
**依赖**：M4 · **规模**：XS · **文件**：本文件

### [ ] T5.2 litematic-converter TS 化
**描述**：`index.js` → TS 模块；`+Page.tsx` 外壳挂载；pako 由 import。
**验收**：转换行为对等。
**验证**：E2E + 人工。
**依赖**：T5.1 · **规模**：M · **文件**：`src/pages/litematic-converter/*`、`src/lib/litematic/*`

### [ ] T5.3 litematic-preview TSX 外壳
**描述**：`+Page.tsx` 外壳 + 原命令式模块（deepslate/gl-matrix/WebGL）保持；仅类型化边界。
**验收**：预览/设置/触控行为对等，无渲染回归。
**验证**：E2E + 人工。
**依赖**：T5.1 · **规模**：L · **文件**：`src/pages/litematic-preview/*`

### [ ] T5.4 静态资源收口
**描述**：确认 `content/`、`vendor/`、`assets/`、`webfonts/`、extra 资源进入输出且缓存头正确。
**验收**：公开 URL 可达；`immutable` 头保留。
**验证**：构建后 `Test-Path` + 响应头检查。
**依赖**：T1.4、T5.2、T5.3 · **规模**：M · **文件**：`scripts/build-static.*`、`vercel.json`

### Checkpoint M5
- [ ] extra 对等；静态资产在输出模型下可达

---

## M6 · 健壮性修复

> 逐条落实 `08-robustness-checklist.md`。

### [ ] T6.1 Runtime schema 校验
**描述**：对 `database.json`、会话、Worker/Auth 响应、URL 参数做校验；失败走降级/错误边界。
**验收**：畸形数据不致崩溃；类型收窄。
**验证**：单测（注入坏数据）。
**依赖**：M5 · **规模**：M · **文件**：`src/lib/schema.ts`、`src/lib/api.ts`

### [ ] T6.2 错误边界与网络封装
**描述**：统一 fetch 封装（超时/中止/错误归一）、页面级错误边界与降级 UI。
**验收**：网络失败有可见反馈；无未捕获异常。
**验证**：单测 + 手工断网。
**依赖**：T6.1 · **规模**：M · **文件**：`src/lib/http.ts`、`src/components/ErrorBoundary.tsx`

### [ ] T6.3 SSR/水合安全审查
**描述**：消除渲染期对 `window/document/localStorage` 的访问；时间/随机值导致的水合差异修复。
**验收**：构建期不触浏览器全局；无 hydration mismatch。
**验证**：构建 + 控制台 + 单测。
**依赖**：M4 · **规模**：M · **文件**：`src/**`

### [ ] T6.4 安全审查
**描述**：XSS（仅 sanitize 后注入）、URL/重定向白名单、上传类型/大小校验、OAuth state、CSP 兼容。
**验收**：无危险注入；上传有约束。
**验证**：安全清单走查 + E2E 负例。
**依赖**：T6.2 · **规模**：M · **文件**：`src/lib/*`、`src/pages/upload/*`

### [ ] T6.5 可访问性与键盘
**描述**：图片 alt、按钮语义、焦点管理（弹层/抽屉）、键盘可达。
**验收**：关键交互键盘可用；无严重 axe 问题。
**验证**：axe/Lighthouse + 人工。
**依赖**：M4 · **规模**：M · **文件**：`src/components/*`

### [ ] T6.6 性能收口
**描述**：bundle 拆分/按路由、图片与字体优化、避免重复依赖。
**验收**：关键路由体积/首屏达标。
**验证**：构建报告 + Lighthouse。
**依赖**：M4 · **规模**：M · **文件**：`vite.config.ts`、`src/**`

### Checkpoint M6
- [ ] 清单全部落实；无渲染期浏览器全局；上传/重定向有校验

---

## M7 · 退役 Vue/旧 HTML + CSP 收紧 + 发布

### [ ] T7.1 删除 Vue 依赖与产物
**描述**：删除 `vue`/`@vitejs/plugin-vue`/`vite-plugin-vue-devtools` 与 `vendor/vue.global.prod.js` 及 `build-vendor` 中的复制项。
**验收**：依赖与 vendor 无 vue；构建成功。
**验证**：`npm install && npm run build`；grep。
**依赖**：M2–M6 · **规模**：M · **文件**：`package.json`、`package-lock.json`、`scripts/build-vendor.*`、`vendor/`

### [ ] T7.2 清理旧 HTML/JS/CSS 残留
**描述**：删除手写页面 HTML、旧 Vue/patched JS、`[v-cloak]`、`packages/js/*` 中已迁移脚本；移除 `Vue` 全局。
**验收**：无 `Vue`/`createApp`/`v-cloak`/手写页面 HTML 残留。
**验证**：grep + `npm run lint`。
**依赖**：T7.1 · **规模**：M · **文件**：`apps/**`、`pages/**`、`packages/js/**`、`css/*`

### [ ] T7.3 CSP 移除 `'unsafe-eval'`
**描述**：确认无运行期 eval 需求后，从 `vercel.json` CSP 移除 `'unsafe-eval'`。
**验收**：生产/预览无 CSP 违规。
**验证**：控制台检查。
**依赖**：T7.2 · **规模**：S · **文件**：`vercel.json`

### [ ] T7.4 文档更新
**描述**：更新 `AGENTS.md`（技术栈/目录/构建顺序/部署/认证/@source）、`README.md`、`package.json` 描述。
**验收**：文档与实现一致；无 Vue/旧部署表述。
**验证**：人工审阅。
**依赖**：T7.2 · **规模**：M · **文件**：`AGENTS.md`、`README.md`、`package.json`

### [ ] T7.5 全量验收 + 生产预览冒烟
**描述**：干净安装重现构建；全门；全部公开 URL 冒烟。
**验收**：门全绿；URL 行为对等；`404`、认证、上传、下载正常。
**验证**：Vercel 预览。
**依赖**：T7.3、T7.4 · **规模**：M · **文件**：无

### Checkpoint M7
- [ ] 无 Vue/旧 HTML 残留；CSP 无 `unsafe-eval`；干净安装可重现；预览冒烟通过

---

## M8 · 合并与推送（需求 6）

### [ ] T8.1 预合并核对
**描述**：确认 M0–M7 全部完成、工作区干净、与 `main` 差异已审阅。
**验收**：`git status` 干净；检查点全勾。
**验证**：`git log --oneline`、`git diff main`。
**依赖**：M7 · **规模**：S · **文件**：无

### [ ] T8.2 本地合并 `main`
**描述**：`git checkout main && git merge --no-ff refactor/react-ssg`（保留历史），解决冲突（预期少）。
**验收**：`main` 含全部重构；合并后门全绿。
**验证**：合并后在 `main` 重跑全门。
**依赖**：T8.1 · **规模**：S · **文件**：无

### [ ] T8.3 推送分支与 `main`
**描述**：`git push origin refactor/react-ssg && git push origin main`。
**验收**：远程两分支与本地一致。
**验证**：`git ls-remote` / `git status -sb`。
**依赖**：T8.2 · **规模**：XS · **文件**：无

### Checkpoint M8 · 完成
- [ ] `origin/main` 与 `origin/refactor/react-ssg` 均更新；生产验证通过
