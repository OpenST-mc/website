// 档案馆页面级 SEO / 样式 / 脚本（对齐旧 apps/portal/index.html <head>）。
export default function ArchiveHead() {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      <meta
        name="description"
        content="OpenST 档案馆：归档、转换并在线预览 Minecraft 优秀储电作品。提供精密机器存档下载与 WebGL 投影预览。"
      />
      <meta
        property="og:description"
        content="OpenST：归档、转换并在线预览 Minecraft 优秀储电作品。支持 WebGL 投影预览。"
      />
      <meta itemProp="description" content="OpenST档案馆提供精密机器存档下载与 WebGL 投影预览。" />
      <meta name="title" content="OpenST Archive" />
      <meta itemProp="name" content="OpenST Archive" />
      <meta property="og:image" content="https://openstmc.com/images/favicon-1.png" />
      <meta itemProp="image" content="https://openstmc.com/images/favicon-1.png" />
      <meta name="twitter:image" content="https://openstmc.com/images/favicon-1.png" />
      <meta property="twitter:card" content="summary_large_image" />
      <link rel="stylesheet" href="/css/ArchiveOutput.css" />
      <script src="/vendor/insights.bundle.js" defer></script>
    </>
  );
}
