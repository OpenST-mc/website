# 07 · 分支工作流（需求 6）

> 需求：重构工作在**本地独立分支**进行；确认一切正常后**本地合并到 `main`**，并**推送分支与 `main` 到远程**。

## 1. 分支约定

- 分支名：**`refactor/react-ssg`**（从 `main` 切出）。
- 全程在该分支开发；`main` 在 M8 之前保持旧版可部署。
- 里程碑（M0–M7）各一个检查点提交；单个任务可小步提交。
- 禁止 force-push、禁止改写已推送历史、禁止空提交。

## 2. 建立分支（T0.3）

```bash
git status                 # 确认工作区干净
git checkout main
git pull --ff-only origin main
git checkout -b refactor/react-ssg
git push -u origin refactor/react-ssg   # 建成即建立远程跟踪（可选，便于备份）
```

## 3. 开发中的提交纪律

```bash
# 小步提交，信息贴合仓库风格
git add <files>
git commit -m "refactor(portal): migrate archive SPA to React+TSX (SSG)"
```

- **只提交有意变更**；不提交密钥、生成物误改、临时文件（`temp-opencode/` 已被忽略）。
- 提交前本地跑权威门：`npm run check:types && npm run lint && npm run test && npm run check:paths`。

## 4. 与 `main` 保持同步（降低 R13 冲突）

```bash
git fetch origin
git merge origin/main        # 或 git rebase origin/main（团队约定一种，勿混用）
# 解决冲突后重跑全门
```

- 建议每完成一个里程碑同步一次。
- 若采用 rebase，仅在**未共享**或已明确协调时进行；已推送分支优先 `merge`。

## 5. 合并前核对（T8.1）

- [ ] M0–M7 检查点全部完成
- [ ] `git status` 干净，无未提交/未跟踪的正式文件
- [ ] 权威门 + `npm run build`（含 `check:build`）+ `npm run test:e2e` 全绿
- [ ] Vercel 预览冒烟通过（全部公开 URL）
- [ ] `git diff main...refactor/react-ssg` 已审阅，无意外文件（密钥、dist、临时物）

```bash
git log --oneline main..refactor/react-ssg     # 查看将并入的提交
git diff --stat main...refactor/react-ssg      # 查看变更规模
```

## 6. 本地合并到 `main`（T8.2）

```bash
git checkout main
git pull --ff-only origin main
git merge --no-ff refactor/react-ssg -m "Merge refactor/react-ssg: React+TSX SSG migration"
# 合并后在 main 重跑权威门，确保合并结果健康
npm run check:types && npm run lint && npm run test && npm run check:paths && npm run build
```

> 使用 `--no-ff` 保留特性分支历史，便于日后定位；如团队偏好 fast-forward 可改，但需在 PR/记录中说明。

## 7. 推送分支与 `main`（T8.3）

```bash
git push origin refactor/react-ssg
git push origin main
git status -sb                    # 确认本地与 origin 同步
git ls-remote --heads origin      # 确认两分支均在远程
```

**注意**：按需求**保留** `refactor/react-ssg` 远程分支（不自动删除）。

## 8. 失败与回滚

- 合并后若发现严重问题：
  - 未推送：`git reset --hard <合并前 main 的 SHA>` 或 `git merge --abort`（合并进行中）。
  - 已推送：`git revert -m 1 <merge-commit>` 生成反向提交（不 force-push）。
- 特性分支可随时弃用而不影响已发布的旧 `main`（M8 前）。

## 9. 与 Vercel/CI 的交互

- 推送 `refactor/react-ssg` 会触发 Vercel 预览部署（若开启分支部署），用于预发布验证。
- 合并并推送 `main` 触发生产部署。
- 认证相关 Vercel env（`AUTH_SECRET`、GitHub OAuth）需在**预览与生产**均配置就绪，否则预览登录不可用。
