# 06 · 构建与测试设计（需求 3）

> 定义重构后的构建管线、部署产物、测试分层与门命令。所有依赖需在此登记重量理由（`AGENTS.md`：新增依赖需经重量证明，构建期工具显式声明并钉版）。

## 1. 构建管线

### 目标顺序

```
npm run build
  1. node data/build.ts                 # content 子模块 → archive/data/database.json（SSG 构建期数据源）
  2. npm run build:sitemap              # data/sitemap.ts
  3. npm run build:CSS                  # Tailwind 三入口（@source 覆盖 src/**）
  4. npm run build:vendor               # 自托管第三方运行时（保留必要项）
  5. vite build                         # Vike SSG：client/server bundle + prerender → dist/
  6. node scripts/build-static.ts       # 拷贝 content/vendor/assets/webfonts/extra 资源进 dist/
  7. node scripts/check-build.ts        # 构建断言（路由/SEO/资产/CSP）
```

> 与旧链路的差异：`vite build` 由「参考产物」变为「生产 SSG 产物」；新增 `build-static` 与 `check-build`；废弃 `data/build` 中 home→根 `index.html` 的复制。

### 产物体积与缓存

- `/content/**`、`/vendor/**`、`/Extra-Function/**/*.js`：`Cache-Control: public, max-age=31536000, immutable`（保留）。
- 应用 JS/CSS：由 Vike 生成带哈希资源，长缓存。
- 构建断言需检查关键静态文件存在（防 R14）。

## 2. 部署产物与 Vercel

```jsonc
// vercel.json（示意）
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "git submodule update --init --recursive && npm install",
  "cleanUrls": true,
  "trailingSlash": false,
  "headers": [ /* 安全头；M7 移除 unsafe-eval */ ],
  "rewrites": [ { "source": "/share/:subid", "destination": "/api/share?id=:subid" } ]
}
```

- `api/**`（含 `api/auth/*`）作为 Vercel Functions。
- 输出根需 `404.html`。
- **子模块**：SSG 与静态拷贝需要 `content/`；R1 缓解见 `04-risks.md`。

## 3. 测试分层

| 层 | 工具 | 覆盖对象 | 运行时机 |
| --- | --- | --- | --- |
| 类型 | `tsc --noEmit` | 全量 TS/TSX | 每次提交（门） |
| 单元 | Vitest | `src/lib/*`（logic/config/schema/http/auth 纯函数）、URL 构造 | 每次提交 |
| 组件 | Vitest + Testing Library + DOM 环境 | SideBar/Card/Modal/表单/分页/错误边界 | 每次提交 |
| E2E | Playwright | 各公开 URL、主流程、深链、404、认证（mock）、extra 冒烟 | 提交/发布前 |
| 构建断言 | 自定义脚本 | prerender HTML 存在、SEO meta、首屏内容、静态资产、CSP | `npm run build` 内 |

### 3.1 单元与组件

- 逻辑从 `scripts/logic.js` 迁 `src/lib/logic.ts`，单测同步迁 `.ts`，保持行为断言（现有 `test/logic.test.ts` 的用例语义不变）。
- 组件测试覆盖：筛选/清除、收藏计数、分页边界、Markdown 净化（注入 `<script>` 被移除）、空态、错误态。

### 3.2 E2E（Playwright）

- 基座：`vite preview`（SSG 产物）或 `vite dev`；优先对**构建产物**做 E2E。
- 用例：每个公开 URL 200 且含预期 `<title>`；`/archive` 首屏含稿件卡片；`?sub-*` 打开详情；登出后 admin 入口隐藏；上传表单校验；`/Extra-Function/*` 加载无致命错误；未知路径落到 404。
- 认证：用测试态会话/mock，不依赖真实 GitHub。

### 3.3 构建断言（`scripts/check-build.ts`）

- 断言每个预期路由产出 HTML 文件。
- 断言各页 `<title>`/`<meta name="description">`/og 存在且非空。
- 断言 `/archive` 首屏 HTML 含至少一个稿件名（SSG 生效）。
- 断言静态资产存在：`dist/content/...`、`dist/vendor/vue`（仅 M7 前其它 vendor）、图片/字体。
- 断言 CSP 不含 `'unsafe-eval'`（M7 之后启用此断言）。

## 4. 门命令（package.json scripts）

```jsonc
{
  "scripts": {
    "dev": "vite",
    "check:types": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "check:paths": "node scripts/check-paths.ts",
    "check:build": "node scripts/check-build.ts",
    "build": "node data/build.ts && npm run build:sitemap && npm run build:CSS && npm run build:vendor && vite build && node scripts/build-static.ts && npm run check:build"
  }
}
```

**权威门（每次提交）**：`check:types` · `lint` · `test` · `check:paths`；**发布前**：`build`（含 `check:build`）+ `test:e2e`。

## 5. 新增依赖与重量理由

| 依赖 | 用途 | 是否钉版 | 重量理由 |
| --- | --- | --- | --- |
| `react` / `react-dom` | 视图层 | 是 | 需求核心 |
| `typescript` | 类型 | 是 | 需求 1/3/4 |
| `vike` / `vike-react` | SSG | 是 | 需求 5 |
| `@auth/core` | 认证 | 是 | 需求 2 |
| `jose` | Worker 校验 JWT（ADR-005 A） | 是 | 唯一信任模型落地 |
| `vitest` / `@testing-library/react` / DOM 环境 | 单元/组件测试 | 是 | 需求 3 |
| `@playwright/test` | E2E | 是 | 需求 3 |
| `zod` 或 `valibot`（二选一） | runtime 校验 | 是 | 健壮性需求 4 |
| `@typescript-eslint/*`、`eslint-plugin-react*` | 类型感知 lint | 是 | 质量门 |

> 原则：能用现有依赖解决的不新增；每个新增项在此登记并钉精确版本。

## 6. 构建可重现性

- 从干净安装（`npm ci`）可跑通 `npm run build`。
- 构建期工具均显式声明且钉版，不依赖传递运气。
- 生成物（SSG 产物由 Vercel 生成，不入库；`database.json` 仍由 CI 提交）职责清晰，禁止手改生成物发版。

## 7. CI 调整

- 现有 `sync-archive.yml`：子模块更新 → 重建 `database.json`/sitemap → 提交（保留）。
- 新增/扩展检查工作流：`npm ci` → `check:types` → `lint` → `test` → `build`（含 `check:build`）。E2E 可按需在 PR/发布触发。
- Vercel 侧执行 `buildCommand` 产出生产产物。
