# OpenST website

与 Minecraft 储电社区相关的静态门户 + 存档提交系统，部署于 Vercel。

## 代码标准 (强制)

- 单文件 ≤800 行，单行 ≤100 字符
- 代码注释使用中文，不含 emoji, 必须使用单行式注释 `// 注释`
- 驼峰命名，缩进 2 空格，运算符两侧空格
- 逻辑块间空行分隔

## 开发命令

```bash
npm run dev              # Vite dev server → localhost:4000 (0.0.0.0, CORS 开启)
npm run build            # 完整构建: sitemap → build.js → Tailwind×2 → Vite build
npm run preview          # 预览 Vite 构建产物
```

`npm run build` 依次执行：`build:sitemap` → `data/build.js` → `build:ArchiveCSS` → `build:PortalCSS` → `vite build`。如果只需 CSS 构建：`npm run build:ArchiveCSS` 或 `npm run build:PortalCSS`。

## 架构

- **前端**: Vue 3 SPA，无 Vue Router/Vue CLI — Vue、marked、JSZip 均通过 CDN 加载
- **CSS**: Tailwind CSS v4，两个独立入口: `css/input.css` (Portal) 和 `css/ArchiveInput.css` (Archive)
- **构建**: Vite 多入口打包 (`index.html` + `upload/index.html`)
- **后端**: CF Workers (`workers/workers 2.js`) — GitHub OAuth、Telegram 投稿中继、管理员工具
- **Vercel Serverless**: `api/share.js` — 社交分享卡重定向
- **数据**: `archive/data/database.json` 由 `data/build.js` 聚合各 `archive/archive/*/info.json` 生成

## 目录结构

| 目录 | 说明 |
|---|---|
| `archive/archive/` | 83 个稿件文件夹，各含 `info.json` + `preview.*` + `.litematic` |
| `archive/scripts/` | Vue SPA 组件 (`main.js` 入口, `ui.js` 组件, `logic.js` 筛选) |
| `upload/` | 独立 Vue SPA — 投稿页面 |
| `Extra-Function/` | 投影转换 + WebGL 3D 预览 |
| `auth/` | GitHub OAuth 共享模块 (localStorage 7 天过期) |
| `admin_tools/` | 管理员编辑工具页 |

## Node.js 脚本

```bash
node data/build.js             # 扫描 archive/archive/ 生成 database.json + WebP 图片压缩 (sharp)
node data/sitemap.js           # 生成 sitemap.xml + robots.txt (先确保 database.json 已生成)
npm run build:sitemap          # 同上
node archive/scripts/init.js   # 交互式创建新稿件脚手架
```

## 部署

- Vercel: `vercel.json` 配置 cleanUrls、`/share/:subid` 重写到 API、`/archive/*.litematic` 等资源 1 年缓存
- 前端纯静态 (`dist/`)；API 层由 CF Workers 提供

## 测试

`test/` 目录仅包含 .litematic 样本文件，无自动化测试框架。`archive/scripts/mock.js` 可在开发时注入 52 条模拟数据（通过 `<script>` 按需引用）。

## 注意

- `.gitignore` 排除了 `AGENTS.md` 和 `test/`
- 不需要 linter/formatter/typecheck 步骤
- 管理员功能依赖 GitHub OAuth token 对 `OpenST-mc/website` 仓库的写入权限