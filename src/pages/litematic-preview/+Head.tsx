// 预览页面级样式 / 脚本（对齐旧 apps/extra/litematic-preview/index.html <head>）。
export default function PreviewHead() {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1.0" />
      <link rel="stylesheet" href="/vendor/material-icons.css" />
      <link rel="stylesheet" href="/vendor/font-awesome.css" />
      <script src="/vendor/insights.bundle.js" defer></script>
    </>
  );
}
