# 08 · 健壮性修复清单（需求 4）

> 系统性修复目标。M6 按此逐条落实并勾选；每项给出「问题—做法—验证」。

## A. 类型与数据契约

- [x] **strict TS 全覆盖**：`strict`/`noUncheckedIndexedAccess`/`noImplicitOverride`；无新增 `any`/`@ts-ignore`。
- [x] **外部数据 runtime 校验**：`database.json`、Auth 会话、Worker/Vercel API 响应、URL 查询参数，经 `zod`/`valibot` schema 后再使用（`src/lib/schema.ts`）。
  - 验证：注入畸形 fixture，断言降级而非崩溃。
- [x] **领域类型集中**：`ArchiveItem`/`Session`/`WorkerResponse` 等定义于 `src/lib/types.ts`，组件不重复声明。
- [x] **判别联合处理**：API 结果的 `ok/err` 分支穷尽，避免“假成功”。
  - 验证：`switch` 穷尽检查 + 单测。

## B. 错误处理与网络

- [x] **统一 HTTP 封装**（`src/lib/http.ts`）：超时（AbortController）、状态码归一、JSON 解析失败、错误结构化。
  - 验证：单测（超时/500/非 JSON）。
- [x] **错误边界**：页面级 + 关键子树级 `ErrorBoundary`，降级 UI 可重试。
  - 验证：组件测试触发抛错。
- [x] **空态/加载态/失败态**统一组件，避免空白页。
- [x] **竞态与取消**：快速切换筛选/深链时取消过期请求（或丢弃过期结果）。
  - 验证：快速连续操作无错乱。
- [x] **资源加载失败**：图片/字体/脚本失败有回退（懒加载 `onError`）。
- [x] **重试策略**：仅对幂等 GET 做有限重试 + 退避；写操作不自动重试。
- [x] **用户反馈**：替换裸 `alert` 为统一提示（或至少保证信息明确、不吞错）。

## C. SSG / 水合安全（架构前提）

- [x] **渲染期禁触浏览器全局**：`window`/`document`/`localStorage`/`navigator`/`matchMedia` 仅在 `useEffect` 或客户端事件中访问。
  - 验证：`grep` 审查 + 构建期渲染无 `ReferenceError`。
- [x] **消除水合差异**：不使用 `Date.now()`/`Math.random()`/`localStorage` 初值直接参与首屏渲染；必要时 `useEffect` 后再更新。
  - 验证：控制台零 hydration mismatch；E2E 检查。
- [x] **`useSyncExternalStore`/惰性初始化**处理仅客户端状态。
- [x] **canvas/WebGL/轮询**在 `useEffect` 中初始化并在卸载时清理（定时器/监听器/资源）。
  - 验证：路由切换无泄漏（内存/监听器计数）。
- [x] **依赖注入数据**：SSG 构建期数据经 `+data.ts` 传入，客户端不重复首屏请求。

## D. 安全

- [x] **XSS**：Markdown 仅 `DOMPurify.sanitize` 后 `dangerouslySetInnerHTML`；禁止直接注入未净化 HTML。
  - 验证：负例（`<img onerror>`、`<script>`）被移除。
- [x] **开放重定向**：Auth `callbackUrl` 仅允许站内相对路径（白名单校验）。
  - 验证：`//evil.com`、`https://evil.com` 被拒。
- [x] **URL/参数**：`sub-*`、`folder`、`id` 做格式校验与编码；不做未校验的路径拼接。
- [x] **上传校验**：类型（`.litematic/.zip/.rar`，图片）与大小（≤50MB）前置校验；错误可读。
- [x] **认证**：JWT 会话校验（ADR-005）；过期/篡改即失效；`credentials: 'include'` 明确。
- [x] **不要记录敏感信息**：控制台/错误上报不含 token/密钥。
- [x] **CSP 兼容**：M7 后无 `unsafe-eval`；无内联脚本/事件属性（React 天然满足）。
- [x] **依赖审计**：`npm audit` 无高危未处理；新增依赖钉版。

## E. 可访问性（a11y）

- [x] 图片 `alt`（非装饰）。
- [x] 交互元素用语义化 `<button>/<a>`，非 `div` 假按钮。
- [x] 弹层/抽屉焦点管理：打开聚焦、Esc 关闭、焦点陷阱与恢复。
- [x] 键盘可达：筛选、分页、收藏、关闭均可键盘操作。
- [x] 颜色对比与可见焦点态；`prefers-reduced-motion` 尊重动画。
- [x] 验证：axe/Lighthouse 无严重项。

## F. 性能与资源

- [x] 按路由拆包，避免把 portal 依赖带进静态页。
- [x] 图片懒加载 + 合适尺寸（沿用现 `useLazyImage` 语义）。
- [x] 字体 `font-display: swap`；避免阻塞。
- [x] 大列表分页/虚拟化（如需要）。
- [x] 验证：Lighthouse/构建报告无显著回归。

## G. 状态与持久化

- [x] 收藏 `openst_favs`、认证会话等读写做容错（JSON 解析失败回退）。
- [x] localStorage 不可用（隐私模式）时不崩溃。
- [x] 状态更新幂等；避免重复提交（上传/编辑 submit 防抖/禁用）。

## H. 可观测性

- [x] 保留 Vercel Analytics/Speed Insights（`insights`）。
- [x] 关键失败路径有可诊断日志（不泄露敏感信息）。
- [x] 生产错误可定位（错误边界上报或至少控制台结构化）。

## 验收

- [x] 上述全部勾选并在 M6 检查点复核。
- [x] 无渲染期浏览器全局访问；无未捕获异常；无高危依赖；无 XSS/开放重定向/上传绕过。

## M6 落实记录（2026-10）

- 校验方案：未引入 `zod`/`valibot`；校验面小且均为降级语义，以纯函数集中于 `src/lib/schema.ts`（`parseDatabase`/`parseSession`/`parseWorkerUpload`/`parseDownloadStats`/`parseHealthExtra`/`parseFavoriteIds`，URL 参数 `isSubId`/`sanitizeQueryParam`），避免新增运行期依赖（见 T6.1 备注）。
- 验证命令：`npm run check:types` · `npm run lint` · `npm run test` · `npm run check:paths` · `npm run build` · `npx playwright test`（含 axe serious/critical 门与 hydration 检查）。
- 依赖审计：`npm audit` 0 漏洞（vite/dompurify/vue 取补丁版；sharp 0.35.5、esbuild 0.28.2 精确钉版后全量构建通过）。
- 对比度修复：按 axe 报告统一提升暗底小字号文本（gray-400/slate-400、text-white/60-70），并新增 `:focus-visible` 与 `prefers-reduced-motion` 全局规则。
