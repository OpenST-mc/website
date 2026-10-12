# OpenST website

与 Minecraft 储电社区相关的 SSG 门户 + 存档提交系统，部署于 Vercel。

# Agent Skills (OpenCode)

This project uses skills installed under `.agents/skills/` (or a compatible path).

## Core Rules

- If a task matches a skill, invoke it with the `skill` tool before acting.
- Skills are located in `.agents/skills/<skill-name>/SKILL.md`.
- Follow the skill workflow strictly; do not partially apply it.
- Never skip required steps such as spec, plan, or test when a skill demands them.

## Intent → Skill Mapping

Map the user's intent to the matching skill automatically:

- Feature / new functionality → `spec-driven-development`, then `incremental-implementation` and `test-driven-development`
- Planning / breakdown → `planning-and-task-breakdown`
- Bug / failure / unexpected behavior → `debugging-and-error-recovery`
- Code review → `code-review-and-quality`
- Refactoring / simplification → `code-simplification`
- API or interface design → `api-and-interface-design`
- UI work → `frontend-ui-engineering`

## Execution Model

For every request:

1. Determine if any skill applies (even a small chance).
2. Load the skill with `skill({ name: "<skill-name>" })`.
3. Follow the skill workflow exactly.
4. Only proceed to implementation once required steps are complete.

## 开发命令

```bash
npm run dev              # Vite dev server → localhost:4000 (0.0.0.0, CORS 开启)
npm run build            # 完整构建: data/build.js → sitemap → Tailwind×3 → vendor → Vite/Vike SSG → build:static → check:build
npm run preview          # 预览 SSG 生产产物 dist/client（E2E 基座；Vercel 服务同一产物）
```

- `npm run build` 依次执行：`data/build.js`（读子模块 `content/` 生成 `archive/data/database.json`）→ `build:sitemap` → `build:ArchiveCSS` → `build:PortalCSS` → `build:AdminCSS` → `build:vendor` → `vite build`（Vike `prerender: true` 产出 `dist/client`）→ `build:static`（拷贝静态资产进输出）→ `check:build`（路由/SEO/资产/CSP 断言）。
- 单独构建 CSS：`npm run build:ArchiveCSS` / `build:PortalCSS` / `build:AdminCSS`（生成并提交静态 `css/*Output.css`，用于公开 `/css/*.css` 兼容；页面运行时不再引用它们）。
- `npm run build:vendor`：从 node_modules 复制第三方 dist 到 `vendor/` 并以 esbuild 打包（含 `packages/js/insights-src.js` → insights.bundle.js）。vendor 已提交，仅升级依赖后需重跑。
- `npm run doctor`：React Doctor（`react-doctor`，钉版 devDependency）扫描 React 反模式/性能/安全/可维护性（advisory）。
- CI（GitHub Actions）：`.github/workflows/ci.yml`（`quality`：`check:types`/`lint`/`test`/`check:paths`；`build-and-e2e`：`npm run build` + `npm run test:e2e`）与 `.github/workflows/react-doctor.yml`（PR 增量扫描 + 评论，advisory）。

## 稿件数据架构（2026-08 拆分）

- **数据仓库**：`OpenST-mc/archive`（公开），目录结构 `<一级分类>/<二级标签>/<稿件>/…`，两级体系严格物化站点 `src/lib/config.ts` 的 `TAG_CONFIG`（该库内 `scripts/config.snapshot.json` 为同步快照；config 键含 `/` 时目录名以 `-` 落盘，如 `逻辑/传输`→`逻辑-传输`）。全部二级目录常驻仓库，空目录以 `.gitkeep` 占位。无明确二级归属的稿件允许直接放在一级分类根下。含 82+ 稿件、独立 CI（递归重建索引/预览图 → 自提交 → 向 website 发 `repository_dispatch(archive-update)`）。id 全局唯一，id→路径定位表为 `_meta/index-by-id.json`（category 字段为相对父路径，可一段或两段）。Secrets：`SITE_DISPATCH_TOKEN`（操作 website 用 PAT）。
- **新稿件添加流程**：在 archive 库对应 `<一级>/<二级>/` 下新建 `<全局唯一id>/{info.json,preview.*,存档}` → push → CI 自动重建并联动部署；管理员亦可通过 Worker admin API 直接写入现有稿件。
- **子模块接入**：website 以 `git submodule add … content` 挂载于 `content/`，站点直接静态服务 `/content/<一级>[/<二级>]/<id>/…`（immutable 缓存）。
- **自动同步**：`.github/workflows/sync-archive.yml` 接收 dispatch → `submodule update --remote` → 生成 `archive/data/database.json` + sitemap → 提交推送触发 Vercel 部署。`main.yml` 仅保留手动全量重建入口。
- **数据库 category 字段**：值为稿件的相对父路径（如 `潜影盒处理/潜影盒打包机` 或单段 `其他杂物`），前端直链、api/download.js 与 Worker 定位逻辑均按 `[category, id, filename]` 拼接，层级数无关。

## 本地开发与生产一致性

- `npm run dev` 的 `vite.config.ts devPublicRewrites` 与 `vercel.json rewrites` 镜像：本地访问 `/fonts/*`、`/images/*`、`/Traditional-Simplefild/*`、`/Extra-Function/*`（静态资源）行为与生产一致；页面路由由 Vike 直接接管（`/`、`/archive`、`/upload`、`/admin_tools`、`/health`、`/profile/april/december`、`/Extra-Function/*`），**请勿**用物理路径（如 `/apps/extra/`）判断线上表现。
- `npm run preview` 服务的是 SSG 生产产物 `dist/client`（Playwright E2E 基座）；页面 HTML 均为构建期预渲染，不存在「预览 ≠ 生产形态」的差异。
- Tailwind 三入口（`css/{input,ArchiveInput,AdminInput}.css`）由页面 `import` 进入 Vite 模块图：dev 下由 `@tailwindcss/vite` 编译并 HMR，构建期产出哈希资源注入各页 HTML；三入口统一 `source(none)` + `@source "../src"`（只扫 `src/`）。新增独立源码目录时必须同步加入三入口的 @source，否则类名静默丢失。

## 目录结构

| 路径 | 说明 |
| ---- | ---- |
| `src/` | React 19 + Vike SSG 源码：`pages/`（文件式路由 + `+route.ts` 特殊 URL）、`components/`、`hooks/`、`lib/` |
| `api/` | Vercel Functions：share、download/stats；`auth/*`（Auth.js Edge）、`admin/*` 与 `submit-issue`（服务签名代理 → CF Worker） |
| `apps/extra/litematic-preview/resource/` | WebGL 预览器运行时资源（经典脚本/贴图），构建期拷入输出；页面本体在 `src/pages/litematic-*` |
| `packages/js/insights-src.js` | 埋点打包源码（esbuild → `vendor/insights.bundle.js`） |
| `assets/` | fonts、images、s2t 简繁词典 |
| `css/` | Tailwind v4 三入口与产物（@source 扫描 `src/`） |
| `archive/data/database.json` | SSG 构建期数据源（`data/build.js` 从 `content/` 子模块重建） |
| `scripts/` `data/` | 构建/守卫/生成脚本（`check-paths.js`、`check-build.ts`、`build-static.ts`） |
| `workers/workers 2.js` | CF Workers 后端唯一源码版（Security Enhanced Edition） |
| `vendor/` | 自托管第三方运行时（构建期生成、已提交） |

## 公开 URL 兼容

- 页面路由：Vike 文件式路由（`src/pages/**/+Page.tsx`）构建期预渲染为静态 HTML；特殊 URL 由 `+route.ts` 声明（`/Extra-Function/litematic-*`、`/profile/april/december`）。
- 静态兼容：`vercel.json rewrites` 仅保留 `/fonts→assets/fonts`、`/images→assets/images`、`/Traditional-Simplefild→assets/s2t`、`/Extra-Function→apps/extra`（页面预渲染 HTML 优先命中，资源回退物理目录）、`/favicon.ico`、`/profile/april/december/credits.html`（旧链接）、`/share/:subid→/api/share?id=:subid`。
- `npm run check:paths` 守卫 `vercel.json` 与 `vite.config.ts PUBLIC_ALIASES` 双侧一致；新增映射必须两侧同步并过门。

## 前端要点

- React 19 函数组件 + Vike SSG（`prerender: true`），应用代码全部 `.ts/.tsx`；文件式路由，不引入 Router。
- 第三方库自托管于 `vendor/`，禁止外链 CDN；`vendor/` 由 `npm run build:vendor` 从 node_modules 生成并已提交。
- 模块引用用相对路径或别名 `@/*`；运行时公开资源一律以根绝对路径字面量出现（如 `/vendor/deepslate.umd.js`）。
- CSS：`css/{input,ArchiveInput,AdminInput}.css` 是唯一样式源（Tailwind v4，`source(none)` + `@source ../src`），页面通过相对路径 `import` 引入；dev HMR、构建产出哈希资源。`npm run build:*CSS` 仍生成并提交静态 `css/*Output.css`（公开路径兼容）。
- **注意**：不能使用 `public/` 目录——静态资产由 `build:static` 显式拷贝进 `dist/client`。

## 安全头与认证

- CSP 严格模式（`script-src 'self' https://va.vercel-scripts.com`，**不含** `'unsafe-eval'`），所有页面禁内联 `<script>`/事件属性；`check:build` 断言 CSP。
- 认证：Auth.js（`@auth/core`）GitHub OAuth，JWT 会话 Cookie 为 HttpOnly；前端 `useSession` 只读非敏感资料，不缓存令牌。
- 管理员特权：Vercel `api/admin/*`、`api/submit-issue` 在 Edge 侧解析 Auth.js 会话（`src/lib/edge-session.ts`），以服务签名（`src/lib/proxy-sign.ts`）转发 CF Worker（ADR-005 方案 B）；Worker 侧 `/api/check-admin` 仍在 WAF 白名单内。

## 后端

- CF Workers：`https://api.openstmc.com`，源码 `workers/workers 2.js`（env 注入密钥）。
- `GH_REPO`（权限校验/会话）与 `ARCHIVE_REPO`（稿件内容增删改）分离；管理员端点经 `_meta/index-by-id.json` 定位真实路径（10 分钟 Cache API 缓存）。
- 上传走 Telegram 中继（≤50MB），wiki 提交建 issue 于 `OpenST-mc/Submissions`。
- 会话：Worker 提供 exchange-token / resolveSession（两级缓存，10 分钟）；站点前端会话统一走 Auth.js `/api/auth/session`，不再使用 localStorage 缓存。
- `/dl/*` Telegram 文件代理；share/download 依赖 Upstash Redis env。

## Cloudflare WAF 注意

api.openstmc.com 采用「端点白名单 + Managed Challenge」，新增 API 端点必须同步加白，
否则 fetch 得到 403 且无 CORS 头。现役端点：`/api/session`、`/api/logout`、`/api/check-admin`、
`/api/exchange-token`、`/api/submit-issue`、`/api/archive-upload`、`/api/admin/*`（update-info /
update-preview / replace-litematic / delete-archive）、`/api/wiki/submit-archive`、`/dl/*`、`/health`。
Vercel 侧同源端点 `/api/auth/*`、`/api/admin/*`、`/api/submit-issue` 走服务签名转发（ADR-005 方案 B），
不经浏览器直连 Worker，无需额外 WAF 白名单。

## 数据流水线

1. 新投稿合并进 `OpenST-mc/archive`（或经 admin API 直接写入）
2. archive CI 自动重建索引、压缩预览图并 dispatch website
3. website sync 工作流 bump 子模块指针、重建 database.json/sitemap 并部署

本地临时辅助脚本目录 `temp-opencode/`（已 gitignore），勿提交正式内容。

## Tech Stack

- Node `^20.19.0 || >=22.12.0`（以 `engines` 为准）；`react ^19` + `vike`/`vike-react`（SSG），不引入 Router/CLI；`vite ^7`；`tailwindcss ^4`；构建期 `sharp`、`esbuild`（精确钉版）；计数 `Upstash Redis`；埋点仅 Vercel 官方二件。
- 第三方库自托管于 `vendor/`（已提交），禁止外链 CDN。禁止新建 `public/`。

## Quality Gates

可重复的检查必须由机器守，不靠人眼。门只会变严，不会放宽。

- 风格与静态检查是强制的：格式必须机器统一，不靠 reviewer 肉眼；未定义引用、悬空绑定视为构建失败同级缺陷。
- 门的定义：`lint` / `test` / `check:paths` 全绿。新增门只加命令，不加叙述；门只增不减。
- 构建必须从干净安装可重现：新增构建期工具必须显式声明并钉版，不依赖传递运气。
- 生成物永远由源码加声明命令重算，不接受手改生成物后直接发版。
- 解析器、编解码、金额计数这类不可逆逻辑，改动必须附真实输入的往返验证，不接受只看 diff 即合併。


## AI-assisted Development

AI 可实现或修改代码，但必须沿用既有体系。

AI must NOT：发明新的路由/目录映射、引入 CDN 或 `public/`、另建 DB 或映射表、压制类型/构建错误、为合并不相关的改动、重写能跑的代码只为换写法；不得新增未经重量证明的依赖，不得绕过既有检查门，不得手改生成物。

做视觉或结构变更时，保留：路由表、路径方案、数据流向、CSP、构建顺序。需求模糊时，选与现状一致的最简实现。

## Gotchas

- `npm run preview` 即 SSG 生产产物 `dist/client`（E2E 基座）；页面为构建期预渲染 HTML。
- Tailwind 三入口以 `@source "../src"` 扫描；新增独立源码目录必须同步三入口，否则类名静默丢失。
- 构建顺序即 `npm run build` 定义（含 `build:static` → `check:build`），不得调换或跳段发版。
- `content/` 子模块缺失会导致 `data/build.js`、E2E 与构建断言失败；CI 使用 recursive checkout。
