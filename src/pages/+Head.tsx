// 全站默认 head：favicon 与 referrer 策略（各页 +Head 在其上追加 CSS/SEO）。
export default function Head() {
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
