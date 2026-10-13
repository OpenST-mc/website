# OpenST 网站重构计划（React + TSX + SSG）

将 `openst-web` 从 **Vue 3（全局 UMD + 手写 HTML 多页）** 重构为 **React + TypeScript（统一 `.tsx`/`.ts`）+ SSG 预渲染（Vike，非 Next.js）** 的完整、按时间顺序拆分的执行计划。

> 本目录是**计划文档**，不是实现。执行前先读 `01-target-architecture.md`、`05-decisions.md`、`06-build-and-testing.md`，再按 `02-roadmap.md` 顺序领取 `03-tasks.md`。

## 新增/修订需求（本轮）

1. **废弃手写 HTML**，页面统一 `tsx/ts`，由 SSG 生成 HTML。
2. **认证改用外部库**：`Auth.js (@auth/core)`，部署于 **Vercel API**（非项目内自研）。
3. **设计构建与测试**：见 `06-build-and-testing.md`。
4. **代码健壮性修复**：见 `08-robustness-checklist.md`。
5. **SPA+CSR → SSG**：Vike prerender，产物走 **Vercel 构建输出**。
6. **分支工作流**：独立本地分支开发 → 本地合并 `main` → 推送分支与 `main`；见 `07-branch-workflow.md`。

## 阅读顺序

| 文件 | 内容 |
| --- | --- |
| [`00-assessment.md`](./00-assessment.md) | 现状 vs 目标差距、迁移主体、硬约束 |
| [`01-target-architecture.md`](./01-target-architecture.md) | Vike SSG + TSX 架构、目录、部署、认证、路径 |
| [`02-roadmap.md`](./02-roadmap.md) | 时间顺序里程碑 M0→M8 + 检查点 |
| [`03-tasks.md`](./03-tasks.md) | **唯一任务列表**：每项含验收/验证/依赖/文件/规模 |
| [`04-risks.md`](./04-risks.md) | 风险、缓解、回滚 |
| [`05-decisions.md`](./05-decisions.md) | ADR（不可轻改） |
| [`06-build-and-testing.md`](./06-build-and-testing.md) | 构建管线与测试策略（需求 3） |
| [`07-branch-workflow.md`](./07-branch-workflow.md) | 分支/合并/推送工作流（需求 6） |
| [`08-robustness-checklist.md`](./08-robustness-checklist.md) | 健壮性修复清单（需求 4） |

## 执行约定

- **状态**：`[ ]` 待办 · `[~]` 进行中 · `[x]` 完成 · `[!]` 阻塞（注明）。
- **唯一任务列表**：`03-tasks.md`。跨会话以此为准。
- **每任务收尾门**：`npm run check:types` · `npm run lint` · `npm run test` · `npm run check:paths` · `npm run build`；UI 任务加人工对等。
- **生成物由源码+声明命令重算**，禁止手改生成物发版。
- 公开 URL、数据流、构建顺序除本计划明示变更外**保持不变**。

## 核心决策速览

1. **SSG 技术栈：Vike + `vike-react`**（Vite 原生、页面全 `.tsx`、`prerender: true`），**不用 Next.js**。
2. **部署改为 Vercel 构建输出**（`buildCommand` + `outputDirectory`），不再由仓库根直接服务源码；`dist` 成为生产产物。
3. **认证：`@auth/core`（Auth.js）** 放在 `api/auth/*` 的 Vercel Functions，GitHub Provider + JWT 会话 Cookie；前端用薄客户端 hook。管理员特权操作需与现有 CF Worker 建立单一信任模型（见 ADR-005）。
4. **统一 TypeScript**：应用代码全部 `.ts/.tsx`；`strict` 类型检查纳入门。
5. **测试分层**：Vitest（单元/组件）+ Playwright（E2E/对等）+ 构建断言（prerender 产物/SEO/CSP）。
6. **分支工作流**：`refactor/react-ssg` 独立分支 → 本地合并 `main` → 推送分支与 `main`。
7. **extra 工具的 WebGL/转换核心保持命令式**，仅以 TSX 外壳承接（避免无谓回归）。

## 变更规模概览

| 里程碑 | 目标 | 规模 |
| --- | --- | --- |
| M0 | 评估、决策、分支与测试策略 | 文档 |
| M1 | TS + Vike SSG 工具链 + 测试框架 + Auth.js 骨架 | XL（拆细） |
| M2 | 共享布局/SEO/错误边界 + 静态页 SSG 化 | L |
| M3 | 认证打通 + upload/admin | L |
| M4 | portal（最复杂，切片） | XL |
| M5 | extra 工具 TS 化 + 静态资源收口 | M |
| M6 | 健壮性修复 | L |
| M7 | 退役 Vue/旧 HTML + CSP 收紧 + 发布 | M |
| M8 | 合并 main + 推送分支与 main | S |
