# OpenST website

与 Minecraft 储电社区相关的静态门户 + 存档提交系统，部署于 Vercel。

## 开发命令

```bash
npm run dev              # Vite dev server → localhost:4000 (0.0.0.0, CORS 开启)
npm run build            # 完整构建: sitemap → build.js → Tailwind×3 → vendor → Vite build
npm run preview          # 预览 Vite 构建产物
```

- `npm run build` 依次执行：`build:sitemap` → `node data/build.js` → `build:ArchiveCSS` → `build:PortalCSS` → `build:AdminCSS` → `build:vendor` → `vite build`。
- 单独构建 CSS：`npm run build:ArchiveCSS` / `npm run build:PortalCSS` / `npm run build:AdminCSS`（产物 `css/ArchiveOutput.css`、`css/output.css`、`css/AdminOutput.css` 已提交）。
- `npm run build:vendor`（`scripts/build-vendor.js`）：从 node_modules 复制第三方 dist 文件到 `vendor/` 并用 esbuild 打包压缩。vendor 文件已提交，仅升级依赖后需重跑。
- **顺序缺陷**：`build:sitemap` 在 `data/build.js` 之前执行，但 `sitemap.js` 读取由 `build.js` 生成的 `archive/data/database.json`，因此 sitemap 会用到上一次提交的旧数据。CI 里顺序是正确的（先 build.js 后 sitemap.js）。

## 架构

- **前端**: Vue 3 SPA（无 Router/CLI）；Vue/marked/JSZip/DOMPurify 等第三方库全部自托管于 `vendor/`（`npm run build:vendor` 生成，页面用 `/vendor/*.js` 绝对路径引用，禁止再引入外部 CDN 脚本）。注意不能用 `public/` 目录——Vercel 仓库根部署不会服务 `public/`。
- **CSS**: Tailwind CSS v4，三个入口 `css/input.css`(Portal) / `css/ArchiveInput.css`(Archive) / `css/AdminInput.css`（404、admin_tools、profile 页，`@source` 显式声明扫描范围）。
- **部署方式**: Vercel 直接以仓库根目录为静态站点（archive/admin_tools 等页面原样服务），非 dist；因此各页面脚本保持“全局库 + 原生 ESM 相对导入”模式，不要在原始页面里写 npm 裸导入（insights 脚本用 `js/insights-src.js` 源码 → esbuild 打包为 IIFE）。
- **安全头**: `vercel.json` 全局下发严格 CSP（script-src 仅 'self' + va.vercel-scripts.com + unsafe-eval——后者是 Vue 运行时模板编译所需，inline 脚本仍被禁）、nosniff、frame-ancestors、Referrer-Policy: no-referrer。**所有 HTML 禁止内联 `<script>` 与内联事件属性**（onclick 等），页面逻辑一律放 `js/` 目录外部文件。
- **认证**: GitHub OAuth token 仅存 HttpOnly Cookie（`gh_token`，Worker 设置，7 天）；前端 `PortalAuth`（`auth/auth.js`）只缓存非敏感资料。OAuth 回调必须校验一次性 `state`（sessionStorage），scope 为 `public_repo`。
- **后端**: CF Workers 部署于 `https://api.openstmc.com`，前端在 `archive/scripts/main.js`、`upload/upload.js`、`admin_tools/admin_edit.js` 中硬编码此地址。
  - 源码有两份：`workers/workers.js`（占位 token 的旧版）与 `workers/workers 2.js`（"Security Enhanced Edition"，从 `env.*` 读密钥、ASN 黑名单走 `env.BLACKLIST_ASNS`）。当前使用后者。
- **Vercel**: `api/share.js` 社交分享卡重定向（`/share/:subid` → `/api/share?id=`，见 `vercel.json`）。

## 数据

- `data/build.js` 扫描 `archive/archive/*/info.json`，生成 `archive/data/database.json`（Archive SPA 在 `archive/scripts/main.js` 中加载），并用 sharp 把 `preview.*` 压缩为 `preview.webp`。
- **存在两份 database.json**：`archive/data/database.json`（build.js 生成）与根目录 `data/database.json`（被 `404.html`、`admin_tools/admin_edit.html` 加载，build.js 不会生成它，需手动保持同步）。
- `node data/sitemap.js` 读取 `archive/data/database.json` 生成 `sitemap.xml` + `robots.txt`。
- 新建稿件脚手架 `node archive/scripts/init.js`：注意它把文件夹建在 `archive/` 下，而 build.js 扫描的是 `archive/archive/`，需手动移动。

## 目录

| 目录 | 说明 |
|---|---|
| `archive/archive/` | 稿件文件夹（当前 82 个，随投稿增长），各含 `info.json` + `preview.*` + `.litematic` |
| `archive/scripts/` | Archive SPA 组件（`main.js` 入口、`ui.js`、`logic.js`、`config.js`） |
| `upload/` | 投稿 SPA（`index.html` + `upload.js`） |
| `Extra-Function/` | `litematic-converter` 投影转换 + `litematic-preview` WebGL 3D 预览 |
| `auth/` | GitHub OAuth 共享模块（localStorage 只存非敏感资料，token 在 Cookie） |
| `admin_tools/` | 管理员编辑页（`admin_edit.js` / `admin_tools.js` 为页面逻辑） |
| `js/` | 各页面外部脚本（`portal.js`、`404.js`、`health.js`、`auth-callback.js`、`credits.js`、`insights-src.js`） |
| `vendor/` | 自托管第三方库（已提交，`npm run build:vendor` 生成；`webfonts/` 为 font-awesome 字体） |
| `scripts/build-vendor.js` | vendor 构建脚本 |

## CI / 部署

- `.github/workflows/main.yml`：push 到 `main` 且改动 `archive/archive/**` 或 `data/build.js` 时重建数据库 + sitemap 并提交。注意其 `paths` 用了 `../../` 前缀（GitHub path filter 只接受仓库根相对 glob），触发条件很可能失效，实际只能靠 `workflow_dispatch`；且提交的 `file_pattern` 是 `data/database.json`，而 build.js 实际写入 `archive/data/database.json`，二者不匹配。
- Vercel：前端纯静态（**仓库根目录直接部署**，非 dist）；`vercel.json` 配置 cleanUrls、`/archive/*.litematic`、`/vendor/*` 等资源 1 年缓存 + 全局安全头/严格 CSP。
- 管理员功能依赖 GitHub OAuth token 对 `OpenST-mc/website` 仓库的写入权限。
- Worker 接口有 CSRF Origin 校验、内存限流、Content-Length 上限；上传仅接受图片预览与 zip；生产建议叠加 Cloudflare WAF 速率限制。
- **Cloudflare WAF 注意**：api.openstmc.com 的 WAF 规则若采用「端点白名单 + Managed Challenge」模式，新增端点必须同步加白，否则 fetch 无法通过挑战（表现为 403 + 无 CORS 头）。当前全部 API 端点清单：`/api/session`、`/api/logout`、`/api/exchange-token`、`/api/submit-issue`、`/api/archive-upload`、`/api/admin/update-info`、`/api/admin/update-preview`、`/api/admin/replace-litematic`、`/api/admin/delete-archive`、`/api/wiki/submit-archive`、`/dl/*`、`/health`。

## 安全约定 (强制)

- token 绝不进 localStorage/JS 变量，仅存 HttpOnly Cookie；新接口一律 `credentials: 'include'`。
- 所有渲染 Markdown 的 `v-html`/`innerHTML` 必须经过 `DOMPurify.sanitize`。
- 所有 HTML 禁止内联 `<script>` 与内联事件属性；新页面脚本放 `js/` 并遵守严格 CSP（script-src 'self' + va.vercel-scripts.com）。
- 第三方前端库一律走 `/vendor/`，禁止新引外部 CDN 脚本。

## 代码标准 (强制)

- 单文件 ≤800 行，单行 ≤100 字符
- 注释使用中文、无 emoji、仅单行式 `// 注释`
- 驼峰命名、2 空格缩进、运算符两侧空格、逻辑块间空行

## 测试 / 质量

- 无自动化测试框架、无 linter/formatter/typecheck。
- `test/` 仅含 .litematic 样本；`archive/scripts/mock.js` 可在开发时注入模拟数据（`<script>` 按需引用）。

## 注意

- `.gitignore` 排除了 `AGENTS.md` 和 `test/`（但 AGENTS.md 仍被 git 追踪）。
- `package.json` 中 `next` 依赖未被任何代码引用，可视为遗留。
