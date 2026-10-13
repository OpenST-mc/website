# 04 · 风险与缓解 / 回滚

## 风险表

| # | 风险 | 影响 | 概率 | 缓解 | 触发信号 |
| --- | --- | --- | --- | --- | --- |
| R1 | **Vercel 构建拿不到 `content/` 子模块**，SSG 拷贝不到静态稿件 | 高 | 中 | `installCommand` 初始化子模块；构建期守卫 `content/` 缺失即失败；必要时退回「CI 物化 content 快照提交」 | 预览部署缺 `/content/**` |
| R2 | **部署模型切换期**（根服务→构建输出）出现路由/静态/缓存头漂移 | 高 | 中 | 保留 `vercel.json` rewrites/headers 兼容层；逐路由对等；先用 Vercel 预览验证再切生产 | 旧 URL 404 或缓存失效 |
| R3 | **SSR/水合不一致**（渲染期访问 `window`、时间/随机、`localStorage`） | 高 | 高 | `08` 清单强制；组件测试 + 控制台零警告门；`useEffect` 承载副作用 | hydration mismatch 警告、白屏 |
| R4 | **Auth.js 与 CF Worker 信任模型不清**：会话不能可靠鉴权 Worker 管理端点 | 高 | 中 | ADR-005 先定稿（JWT 校验或已认证代理）；受控端点测试（未登录/越权） | 管理操作 401/403 或越权 |
| R5 | **认证迁移丢失既有能力**（管理员判定、Cookie 属性、登出别名） | 高 | 中 | 对等清单逐项；`AUTH_SECRET`/Provider 环境变量就绪；保留 Worker 白名单端点语义 | 无法登录/管理员误判 |
| R6 | **SSG 构建期数据过大/过慢**（82+ 稿件全量注入） | 中 | 中 | 仅注入必要字段；分页首屏；必要时按需客户端拉取其余 | 构建超时、HTML 过大 |
| R7 | **类型迁移引发大面积报错被压制**（`any`/`@ts-ignore`） | 中 | 高 | 门禁禁止新增 `@ts-ignore`；review 检查；逐步收窄 | `any` 泛滥、`tsc` 被绕过 |
| R8 | **测试依赖过重/不稳定**（Playwright flaky、DOM 环境差异） | 中 | 中 | 关键路径 E2E；重试与等待策略；单元/组件为主 | E2E 频繁假红 |
| R9 | **Vike 路由与公开 URL 不匹配**（尤其 `profile/april/december`、`Extra-Function`） | 中 | 中 | `+route.ts` 显式路径 + `check-paths` 守卫 + E2E 逐个 URL | 某 URL 404 |
| R10 | **Markdown/XSS 回归** | 高 | 低 | 仅 `DOMPurify.sanitize` 后 `dangerouslySetInnerHTML`；负例测试 | XSS 报告 |
| R11 | **CSP 过早去除 `unsafe-eval`** | 中 | 中 | 放到 M7；确认无 Vue/eval 需求；预览验证 | 控制台 CSP 报错 |
| R12 | **extra WebGL 误伤** | 中 | 中 | 核心保持命令式；仅 TS 外壳；E2E 冒烟 | 预览卡顿/渲染错误 |
| R13 | **分支长期偏离 `main`**导致合并冲突 | 中 | 中 | 定期从 `main` 合并/变基到特性分支；小步提交 | 合并冲突增多 |
| R14 | **产物/静态拷贝遗漏**（`vendor`、`webfonts`、图片） | 中 | 中 | 构建断言逐一 `Test-Path`；E2E 资源 404 监控 | 线上资源 404 |
| R15 | **`data/build.js` 与 SSG 数据源职责混淆** | 中 | 中 | 明确：`data/build` 仍生成 `database.json`；SSG 构建期只读 | 数据不更新或重复 |
| R16 | **回滚困难**（部署模型已切换） | 高 | 中 | 保留旧生产部署快照；`vercel.json` 部署模型改动单独提交便于 revert；特性分支随时可弃用 | 线上故障无法快速恢复 |

## 回滚策略

**原则：分支级 + 配置级双层可回滚。**

1. **分支级**：M8 之前 `main` 不受影响。任何阶段出问题，放弃 `refactor/react-ssg` 分支或 `git reset` 即可，生产保持旧版。
2. **提交粒度**：部署模型切换（`vercel.json`）**单独提交**，便于独立 revert 回「仓库根服务」。
3. **按页面独立上线**：M2–M5 每页迁移独立提交；单页异常可单独 revert，其余页面不受影响。
4. **认证切换**：Auth.js 与旧 `auth.js` 在 M3 前并存；切换单独提交，出现问题可回退到旧认证（在删除前）。
5. **CSP**：`unsafe-eval` 移除单独提交，独立回滚。
6. **数据/后端**：除认证鉴权外不改数据流，无数据迁移回滚负担。

## 前置校验（每个里程碑上线前）

- [ ] 该范围公开 URL 不变且可达
- [ ] SEO head 与旧版一致
- [ ] 网络请求端点/方法/请求体一致
- [ ] 持久化语义变化已文档化（认证：localStorage→HttpOnly Cookie 会话）
- [ ] `check:types` / `lint` / `test` / `check:paths` / `build` 全绿
- [ ] 构建断言通过（路由/SEO/静态资产/CSP）
- [ ] Vercel 预览无 CSP 报错、无 404

## 回滚决策树

```
生产异常？
├─ 仅某页面 → revert 该页提交
├─ 认证异常 → revert Auth.js 切换提交（尚未删除旧认证时）
├─ 部署/路由异常 → revert vercel.json 提交，回到仓库根服务
└─ 整体不可用 → 维持旧 main；放弃/重置 refactor 分支
```