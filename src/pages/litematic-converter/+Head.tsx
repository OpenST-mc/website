// 转换器页面级样式 / 脚本
// （对齐旧 apps/extra/litematic-converter/index.html <head>）。
export default function ConverterHead() {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script src="/vendor/insights.bundle.js" defer></script>
    </>
  );
}
