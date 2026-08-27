# OpenST website

与 Minecraft 储电社区相关的静态门户 + 存档提交系统，部署于 Vercel。

## 开发命令

```bash
npm run dev              # Vite dev server → localhost:4000 (0.0.0.0, CORS 开启)
npm run build            # 完整构建: build.js → sitemap → Tailwind×3 → vendor → Vite build
npm run preview          # 预览 Vite 构建产物（本地参考用，Vercel 部署不使用 dist）
```

- `npm run build` 依次执行：`data/build.js`（读子模块）→ `build:sitemap` → `build:ArchiveCSS` → `build:PortalCSS` → `build:AdminCSS` → `build:vendor` → `vite build`。
- 单独构建 CSS：`npm run build:ArchiveCSS` / `build:PortalCSS` / `build:AdminCSS`。
- `npm run build:vendor`：从 node_modules 复制第三方 dist 到 `vendor/` 并以 esbuild 打包（含 `packages/js/insights-src.js` → insights.bundle.js）。vendor 已提交，仅升级依赖后需重跑。

## 稿件数据架构（2026-08 拆分）

- **数据仓库**：`OpenST-mc/archive`（公开），目录结构 `<一级分类>/<二级标签>/<稿件>/…`，两级体系严格物化站点 `apps/portal/scripts/config.js` 的 `TAG_CONFIG`（该库内 `scripts/config.snapshot.json` 为同步快照；config 键含 `/` 时目录名以 `-` 落盘，如 `逻辑/传输`→`逻辑-传输`）。全部二级目录常驻仓库，空目录以 `.gitkeep` 占位。无明确二级归属的稿件允许直接放在一级分类根下。含 82+ 稿件、独立 CI（递归重建索引/预览图 → 自提交 → 向 website 发 `repository_dispatch(archive-update)`）。id 全局唯一，id→路径定位表为 `_meta/index-by-id.json`（category 字段为相对父路径，可一段或两段）。Secrets：`SITE_DISPATCH_TOKEN`（操作 website 用 PAT）。
- **新稿件添加流程**：在 archive 库对应 `<一级>/<二级>/` 下新建 `<全局唯一id>/{info.json,preview.*,存档}` → push → CI 自动重建并联动部署；管理员亦可通过 Worker admin API 直接写入现有稿件。
- **子模块接入**：website 以 `git submodule add … content` 挂载于 `content/`，站点直接静态服务 `/content/<一级>[/<二级>]/<id>/…`（immutable 缓存）。
- **自动同步**：`.github/workflows/sync-archive.yml` 接收 dispatch → `submodule update --remote` → 生成 `archive/data/database.json` + sitemap → 提交推送触发 Vercel 部署。`main.yml` 仅保留手动全量重建入口。
- **数据库 category 字段**：值为稿件的相对父路径（如 `潜影盒处理/潜影盒打包机` 或单段 `其他杂物`），前端直链、api/download.js 与 Worker 定位逻辑均按 `[category, id, filename]` 拼接，层级数无关。

## 本地开发与生产一致性

- `npm run dev` 已内置与 `vercel.json rewrites` 镜像的中间件（vite.config.js `publicRewrites`）：本地访问 `/`、`/archive/*`、`/js/*` 等公开路径的行为与生产完全一致，**请勿**用物理路径（如 `/apps/portal/`）判断线上表现。
- `npm run preview` 的 dist 为 vite 打包参考产物，与生产部署形态不同（生产为仓库根静态服务），勿以 dist 判断样式与路径。
- Tailwind 三入口均使用显式 `@source` 声明扫描范围：PortalCSS←pages/home+health+packages/js；ArchiveCSS←apps/{portal,upload,admin,extra}+packages/js；AdminCSS←apps/admin+404+pages。新增页面必须同步加入对应入口的 @source。

## 目录结构

| 路径 | 说明 |
|---|---|
| `pages/home/index.html` | 门户首页（原根 index.html），404.html 特意保留在根级以配合平台兜底 |
| `apps/portal/` | Archive SPA（index.html + scripts/ + data/database.json 构建产物） |
| `apps/upload/` | 投稿页；`apps/auth/` 回调页；`apps/admin/`（原 admin_tools）；`apps/health/`；`apps/credits/` |
| `apps/extra/litematic-*` | 投影转换 / WebGL 3D 预览工具 |
| `packages/js/` | 各页面外部脚本（portal/404/auth-callback/credits/health/insights-src） |
| `assets/` | fonts、images、s2t 简繁词典（原 fonts/images/Traditional-Simplefild） |
| `css/` | Tailwind v4 三入口与产物（@source 扫描 apps/admin 等） |
| `api/` | Vercel Functions：share（社交卡重定向）、download/stats（Upstash Redis 计数） |
| `workers/workers 2.js` | CF Workers 后端唯一源码版（Security Enhanced Edition） |
| `scripts/` `data/` | 构建/生成脚本（不再被部署 URL 直接暴露源码路径的历史包袱） |

## 公开 URL 兼容

公开路径全部不变，由 `vercel.json` rewrites 映射到新物理位置：
`/js→packages/js`、`/archive→apps/portal`、`/upload→apps/upload`、`/auth→apps/auth`、
`/admin_tools→apps/admin`、`/health→apps/health`、`/profile/april/december→apps/credits`、
`/Extra-Function→apps/extra`、`/fonts|/images|/Traditional-Simplefild→assets/*`、`/→pages/home/index.html`。
新增页面目录时需同步补 rewrite 与（如适用）vite.config.js 的 PUBLIC_ALIASES 别名表。

## 前端要点

- Vue 3 SPA（无 Router/CLI）；第三方库自托管于 `vendor/`，禁止外链 CDN。
- 跨目录模块引用一律使用根绝对公开路径（如 `/archive/scripts/config.js`），保证 Vercel rewrite 与 Vite alias 双侧一致。
- CSS：三个输入文件按 @source 显式扫描范围编译；产物已提交。
- **注意**：不能使用 `public/` 目录——Vercel 仓库根部署不服务它。

## 安全头与认证

- CSP 严格模式（script-src 'self' + va.vercel-scripts.com + unsafe-eval 供 Vue 运行时编译），所有 HTML 禁内联 `<script>`/事件属性。
- GitHub OAuth token 仅存 HttpOnly Cookie（Worker 设置）；前端 `PortalAuth` 只缓存非敏感资料；回调校验一次性 state；scope=public_repo。
- Worker 登录查询 `/api/check-admin?logout=1` 为 WAF 白名单别名，可登出。

## 后端

- CF Workers：`https://api.openstmc.com`，源码 `workers/workers 2.js`（env 注入密钥）。
- `GH_REPO`（权限校验/会话）与 `ARCHIVE_REPO`（稿件内容增删改）分离；管理员端点经 `_meta/index-by-id.json` 定位真实路径（10 分钟 Cache API 缓存）。
- 上传走 Telegram 中继（≤50MB），wiki 提交建 issue 于 `OpenST-mc/Submissions`。
- 会话：exchange-token 预热 + resolveSession 两级缓存（前端 localStorage 10 分钟 + Worker Cache API 10 分钟），token 失效不缓存。
- `/dl/*` Telegram 文件代理；share/download 依赖 Upstash Redis env。

## Cloudflare WAF 注意

api.openstmc.com 采用「端点白名单 + Managed Challenge」，新增 API 端点必须同步加白，
否则 fetch 得到 403 且无 CORS 头。现役端点：`/api/session`、`/api/logout`、`/api/check-admin`、
`/api/exchange-token`、`/api/submit-issue`、`/api/archive-upload`、`/api/admin/*`（update-info /
update-preview / replace-litematic / delete-archive）、`/api/wiki/submit-archive`、`/dl/*`、`/health`。

## 数据流水线

1. 新投稿合并进 `OpenST-mc/archive`（或经 admin API 直接写入）
2. archive CI 自动重建索引、压缩预览图并 dispatch website
3. website sync 工作流 bump 子模块指针、重建 database.json/sitemap 并部署

本地临时辅助脚本目录 `temp-opencode/`（已 gitignore），勿提交正式内容。
