// 全站默认 <head>：referrer 与 favicon。各页 `+Head.tsx` 追加页面级 SEO。
// 累积（cumulative）：本组件与页面 Head 会同时输出。
export default function GlobalHead() {
  return (
    <>
      <meta name="referrer" content="no-referrer" />
      <link rel="icon" href="/images/favicon.png" sizes="any" />
      <link rel="icon" type="image/png" sizes="48x48" href="/images/favicon-2.png" />
      <link rel="icon" type="image/png" sizes="64x64" href="/images/favicon-2.png" />
      <link rel="icon" type="image/png" sizes="96x96" href="/images/favicon-2.png" />
      <link rel="icon" type="image/png" sizes="128x128" href="/images/favicon-2.png" />
      <link rel="icon" type="image/png" sizes="196x196" href="/images/favicon-2.png" />
      <link rel="apple-touch-icon" href="/images/favicon.png" sizes="any" />
    </>
  );
}
