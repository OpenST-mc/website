# 02 · 时间顺序路线图

> 严格按 M0 → M8 执行。里程碑内任务可并行；里程碑间设检查点。任务详情见 [`03-tasks.md`](./03-tasks.md)。

## 总览

```
M0 评估 / 决策 / 分支 / 测试策略
   └─▶ M1 TS + Vike SSG 工具链 + 测试框架 + Auth.js 骨架
          └─▶ M2 共享布局/SEO/错误边界 + 静态页 SSG 化
                 └─▶ M3 认证打通 + upload / admin
                        └─▶ M4 portal（切片）
                               └─▶ M5 extra 工具 TS 化 + 静态资源收口
                                      └─▶ M6 健壮性修复
                                             └─▶ M7 退役 Vue/旧 HTML + CSP 收紧 + 发布
                                                    └─▶ M8 合并 main + 推送分支与 main
```

**排序理由**

1. **地基先行**（M1）：TS、Vike/Vite、SSG 构建、测试框架、Auth.js 骨架一次性铺好，避免每页重复解决。
2. **先静态低风险**（M2）：home/404/health/credits 无认证、依赖少，用来打磨 SSG/水合/SEO/构建断言。
3. **再认证依赖页**（M3）：Auth.js 与 Worker 信任模型先打通，再迁 upload/admin。
4. **最后最复杂**（M4 portal），再收口 extra 与静态资源（M5）。
5. **健壮性专项**（M6）集中修复，避免散落。
6. **退役与发布**（M7）收口；**合并推送**（M8）按需求 6 执行。

**分支模型**：全程在 **`refactor/react-ssg`** 独立分支开发（M0 建立）。每个里程碑一个检查点提交。M8 在本地合并 `main` 并推送双方（见 `07-branch-workflow.md`）。

---

## M0 · 评估、决策、分支与测试策略

**目标**：固化事实与决策，建立分支，定义构建/测试与健壮性基线。
**任务**：T0.1 … T0.5。**产出**：本目录全部文档 + `refactor/react-ssg` 分支。

### Checkpoint M0
- [ ] `00-assessment.md` / `01-target-architecture.md` 经维护者确认
- [ ] `05-decisions.md` ADR 无未决项（尤其 ADR-005 认证信任模型）
- [ ] `06-build-and-testing.md` 门命令可执行
- [ ] `refactor/react-ssg` 分支已建立

---

## M1 · TS + Vike SSG 工具链 + 测试框架 + Auth.js 骨架

**目标**：React/TS/SSG 可构建、可 dev、可预渲染、可测试；Auth.js 可响应；旧 Vue 页面不回归。
**任务**：T1.1 … T1.12。

关键内容：TypeScript 与 `check:types`；Vike + `vike-react` renderer；`vite.config` 迁移 `.ts`；Vercel `buildCommand/outputDirectory`；静态资产拷贝；逻辑迁移 TS；Auth.js `api/auth/*`；Vitest/Playwright/构建断言；质量门重写。

### Checkpoint M1
- [ ] `npm run build` 产出预渲染 HTML（至少一个路由）且静态资产完整
- [ ] `npm run test`（Vitest）与 `npm run check:types` 绿
- [ ] `npm run dev` HMR 正常；旧 Vue 页面抽查无回归
- [ ] `/api/auth/session` 在本地可返回未登录态

---

## M2 · 共享布局/SEO/错误边界 + 静态页 SSG 化

**目标**：建立布局与 head 体系，迁移无认证静态页，验证 SSG 首屏/水合/SEO。
**任务**：T2.1 … T2.6。

### Checkpoint M2
- [ ] `/`、`404`、`/health`、`/profile/april/december` 首屏 HTML 含内容，水合后交互对等
- [ ] SEO head 与旧版逐字一致；无 hydration 警告
- [ ] 构建断言（路由/SEO）通过

---

## M3 · 认证打通 + upload / admin

**目标**：Auth.js 全链路可用；迁移 upload、admin_tools、admin_edit。
**任务**：T3.1 … T3.7。依赖 M1 的 Auth.js 骨架与 M2 的布局。

### Checkpoint M3
- [ ] GitHub 登录/登出/会话/管理员判定对等
- [ ] upload 投递、admin 打包/编辑/删除全部对等（含 Worker 信任模型）
- [ ] 无 `PortalAuth` 残留引用

---

## M4 · portal（切片）

**目标**：迁移最复杂的档案馆 SPA，拆为纵向切片。
**任务**：T4.1 … T4.9。依赖 M3。

切片：构建期数据注入 → 壳与深链 → NavBar/SideBar → 卡片/懒加载/分页 → DetailModal → 放大/复制/标题 → 逻辑复用与对等 → 性能与 SSG 核对。

### Checkpoint M4
- [ ] SSG 首屏含稿件列表；客户端筛选/分页/收藏/深链全对等
- [ ] 单测（logic）与组件测试绿；E2E 覆盖主流程
- [ ] 全量门绿

---

## M5 · extra 工具 TS 化 + 静态资源收口

**目标**：extra 工具以 TSX 外壳承接，命令式核心保持；静态资产进入输出。
**任务**：T5.1 … T5.4。

### Checkpoint M5
- [ ] 转换器/预览器行为对等（WebGL 未回归）
- [ ] `/content/**`、`/vendor/**`、`/images/**`、`/fonts/**` 在新的输出模型下可达且缓存头正确
- [ ] 全量门绿

---

## M6 · 健壮性修复

**目标**：按 `08-robustness-checklist.md` 系统性修复。
**任务**：T6.1 … T6.6。

### Checkpoint M6
- [ ] runtime 校验、错误边界、网络封装、SSR 安全、上传校验、可访问性全部落实
- [ ] 无 `any` 泛滥；无渲染期浏览器全局访问

---

## M7 · 退役 Vue/旧 HTML + CSP 收紧 + 发布

**目标**：删除 Vue 与手写 HTML 残留，移除 `unsafe-eval`，更新文档。
**任务**：T7.1 … T7.5。

### Checkpoint M7
- [ ] 仓库无 `Vue`/`createApp`/`v-cloak`/手写页面 HTML 残留
- [ ] CSP 无 `'unsafe-eval'`
- [ ] 干净安装可重现构建；生产预览冒烟通过

---

## M8 · 合并与推送（需求 6）

**目标**：本地合并 `main` 并推送分支与 `main` 到远程。
**任务**：T8.1 … T8.3。详见 `07-branch-workflow.md`。

### Checkpoint M8 · 完成
- [ ] `main` 含全部重构；`refactor/react-ssg` 已推送
- [ ] `origin/main` 与本地一致
- [ ] 发布后生产 URL 全部可达且行为对等
