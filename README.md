# website

<a href="https://deepwiki.com/OpenST-mc/website">
  <img src="https://deepwiki.com/badge.svg" alt="Ask Deepwiki">
</a>

![github repo sth](https://socialify.git.ci/OpenST-mc/website/image?custom_language=React&forks=1&issues=1&language=1&name=1&owner=1&pattern=Circuit+Board&pulls=1&stargazers=1&theme=Dark)

OpenST的官方网站

采用 React + TypeScript + Vike（SSG 预渲染）+ Tailwind CSS + CF Workers + Vercel Functions 架构

## 鸣谢 & 参考 (Acknowledgments)

本项目的实现离不开以下优秀开源项目的启发与代码支持：

- [Litematic-Convertor](https://github.com/Harusarri/litematica-converter) - 投影转换功能的实现
- [Litematic-Viewer](https://github.com/EndingCredits/litematic-viewer) - 3d预览的实现

## 部署方法：

> 前置：Node ≥ 22.12（见 `engines`）与 pnpm（`packageManager` 已钉版；`corepack enable` 或全局安装 pnpm 即可）。

1. 初次设置

```bash
git clone https://github.com/OpenST-mc/website.git
```

```bash
cd website
```

```bash
git submodule update --init --recursive
```

```bash
pnpm install
```

2. 启动

```bash
pnpm run dev
```

- vite服务器会自动部署于localhost:4000，并开启局域网内访问功能

3. 构建与预览（SSG 产物 `dist/client`，Vercel 构建部署同一产物）

```bash
pnpm run build
pnpm run preview
```

> [OpenST开发文档](https://openst-mc.github.io/OpenST-Docs/#/)
