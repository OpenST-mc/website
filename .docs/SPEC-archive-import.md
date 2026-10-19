# Spec: 对齐 archive 新版数据库的导入 + 投稿页去 sub-id

## Objective

1. 将 `content/` 子模块更新到 `OpenST-mc/archive` 当前 main（新版「git 版本化数据库」）。
2. 重写 `data/build.ts` 的导入层：直接读取 archive CI 产物，不再递归扫描 `info.json`，不在 website 构建期生成图片派生。
3. `archive/data/database.json` 与新版 archive 对齐，同时保持站点现有契约不变（详情深链、分享、下载、统计、管理员编辑仍按 `sub_id`/文件夹 id 工作）。
4. `/upload` 生成的 `info.json` 不再写入客户端 `id: sub-*`；稳定 sub-id 改由 archive CI/CD 写入稿件目录的 `.meta.json`。

## Assumptions（已与用户确认）

- “仅改投稿页”：只改 `src/pages/upload/+Page.tsx`；`admin_tools` 打包器与 `admin_edit` 保持现状。
- 详情深链/分享标识仍用 `sub_id`，但来源改为 archive CI/CD 生成的稳定 id；旧链接不改、不做兼容层改造。
- 导入层读取新版本 submodule，即本地 `D:\webStorm Project\archive` 对应的 `OpenST-mc/archive` main（当前含 `d0ee53f` 重构及后续 CI 提交）。
- 新 archive 中 `preview.webp` 为详情图（≤1000px），`thumb.webp` 为卡片图（≤480px），website 不再生成 `display.webp`。
- 不新增公开路由、不改 `/share/:subid`、`/archive?sub-*`、`/api/download`、`/api/stats` 的 URL 形态。

## Data Contract

archive `content/data/index.json`（数组，已按文件夹名排序）：

| archive 字段 | website `ArchiveItem` | 说明 |
| --- | --- | --- |
| `id` | `sub_id` | archive CI/CD 生成的稳定 `sub-<epoch>`；存量稿件保留原 id |
| （由 `.meta.json` 反查） | `id` | 稿件文件夹名；用于 `/content/<category>/<id>/...`、下载、管理员编辑、收藏 |
| `name` / `author` / `tags` / `description` | 同名 | 直接透传 |
| `category` | `category` | 相对父路径，允许 1–3 段 |
| `preview` | `preview` + `display` | 详情图；`display` 与 `preview` 同值，保持现有消费者契约 |
| `thumb` | `thumb` | 卡片图 |
| `filename` | `filename` | 存档文件名 |
| `sha256` | 不导入 | 站点当前不使用 |

`content/_meta/index-by-id.json` 用于交叉校验：id 集合必须与 `data/index.json` 一致，`category` 必须一致。

## Commands

```bash
git submodule update --remote content
node data/build.ts
node data/sitemap.js
pnpm run check:types
pnpm run lint
pnpm test
pnpm run check:paths
pnpm run build          # 完整 SSG + check:build
```

## Project Structure

- `data/build.ts`：导入 CLI（读取 archive 产物 → 写 `archive/data/database.json`）。
- `data/archive-import.js`（新增）：纯映射/校验函数，便于 Vitest。
- `test/archive-import.test.ts`（新增）：导入映射与失败路径测试。
- `src/pages/upload/+Page.tsx`：删除 `infoJson.id`。
- `archive/data/database.json`、`sitemap.xml`、`robots.txt`：重新生成，不手改。
- `content/`：只更新子模块指针，不修改其内部受控文件。

## Code Style

沿用现有 CommonJS/ESM 与 2 空格缩进；构建脚本用 `console.log/warn` 输出中文摘要；纯函数无副作用，CLI 入口集中做 I/O。

```js
// data/archive-import.js
export function toArchiveItem(indexEntry, folder) {
  return {
    id: folder,
    name: indexEntry.name,
    author: indexEntry.author || 'Unknown',
    tags: indexEntry.tags || [],
    description: indexEntry.description || '',
    category: indexEntry.category,
    preview: indexEntry.preview,
    display: indexEntry.preview,
    thumb: indexEntry.thumb,
    filename: indexEntry.filename,
    sub_id: indexEntry.id,
  };
}
```

## Testing Strategy

- Vitest 纯函数测试：
  - 正常映射：`sub_id === index.id`、`id === folder`、`display === preview`、`thumb` 透传。
  - 缺少文件夹映射、重复文件夹 id、非法 `sub-*`、category 不一致时抛错。
  - 空 `preview`/`thumb` 的条目仍能映射（由 `check:build` 负责最终产物断言）。
- 构建断言：`check:build` 继续要求全量 `thumb` 与图片文件存在。
- 回归：`pnpm test`、`pnpm run check:types`、`pnpm run lint`、`pnpm run check:paths`、`pnpm run build`。

## Boundaries

- Always：从子模块产物重建生成物；保持 `sub_id` 深链/分享/下载行为；跑完质量门。
- Ask first：修改 archive 子模块内部代码、改公开 URL 形态、删除既有测试/门。
- Never：手改 `archive/data/database.json`/`sitemap.xml`；删除 legacy `sub-*`；改动无关的 litematic-preview 工作区修改；引入 CDN、`public/` 或新数据库。

## Success Criteria

- `git submodule status content` 指向 archive main（含 `a88eaf4` 及以上），`content/` 无未跟踪派生图。
- `archive/data/database.json` 条目数 82；每条 `sub_id` 等于 `content/data/index.json` 的 `id`，`id` 等于稿件文件夹名。
- `preview`/`thumb` 均指向 archive 已提交产物；不再出现 `display.webp`。
- `sitemap.xml` 使用新版 sub-id；旧 `/archive?sub-*`、`/share/sub-*` 仍能定位（存量 id 未变）。
- `/upload` 生成的 `info.json` 无 `id` 字段。
- Worker 管理员定位表改为读取 `data/index.json`，同时登记稳定 id 与文件夹名，`admin_edit` 的 `folder` 参数保持不变。
- 所有质量门通过。

## Status

2026-10-19 已实现：submodule `a88eaf4`；`pnpm test`（167）、`pnpm run test:e2e`（26）、`pnpm run build` 全绿。
