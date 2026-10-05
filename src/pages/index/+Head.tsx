// 首页页面级 SEO / 样式 / 脚本（与旧 pages/home/index.html <head> 逐字一致）。
export default function HomeHead() {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      <meta name="title" content="OpenST | Portal" />
      <meta
        name="description"
        content="OpenST ：归档、转换并在线预览 Minecraft 优秀储电作品。提供精密机器存档下载与 WebGL 投影预览。"
      />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://openstmc.com/" />
      <meta
        property="og:description"
        content="OpenST：归档、转换并在线预览 Minecraft 优秀储电作品。支持 WebGL 投影预览。"
      />
      <meta property="og:image" content="https://openstmc.com/images/favicon-1.png" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:domain" content="openstmc.com" />
      <meta name="twitter:url" content="https://openstmc.com/" />
      <meta name="twitter:title" content="OpenST | Portal" />
      <meta name="twitter:description" content="提供精密机器存档下载与 WebGL 投影预览。" />
      <meta name="twitter:image" content="https://openstmc.com/images/favicon-1.png" />
      <meta itemProp="name" content="OpenST | Portal" />
      <meta itemProp="description" content="OpenST：提供精密机器存档下载与 WebGL 投影预览。" />
      <meta itemProp="image" content="https://openstmc.com/images/favicon-1.png" />
      <link rel="stylesheet" href="/css/output.css" />
      <script src="/vendor/insights.bundle.js" defer></script>
    </>
  );
}
