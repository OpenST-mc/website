// 错误页 <head>：复用 AdminOutput.css + 页面内联特效样式；错误页不入索引。
const PAGE_CSS = `
  body {
    background-color: #0a0a0a;
    background-image:
      radial-gradient(circle at 50% 50%, rgba(64, 181, 173, 0.05) 0%, transparent 80%),
      linear-gradient(rgba(64, 181, 173, 0.02) 1px, transparent 1px),
      linear-gradient(90deg, rgba(64, 181, 173, 0.02) 1px, transparent 1px);
    background-size: 100% 100%, 30px 30px, 30px 30px;
    color: #fff;
    overflow: hidden;
  }
  .scan-line {
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #40b5ad, transparent);
    position: absolute;
    top: -2px;
    animation: scan 3s linear infinite;
    opacity: 0.3;
  }
  @keyframes scan {
    0% { top: 0%; }
    100% { top: 100%; }
  }
  .brand-shadow { text-shadow: 0 0 20px rgba(64, 181, 173, 0.5); }
`;

export default function ErrorHead() {
  return (
    <>
      <link rel="stylesheet" href="/css/AdminOutput.css" />
      <meta name="robots" content="noindex" />
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
    </>
  );
}
