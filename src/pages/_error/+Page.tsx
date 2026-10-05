import { useEffect, useState } from 'react';
import { usePageContext } from 'vike-react/usePageContext';

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

// Vike 错误页：404 定位失败界面；对 `sub-*` 路径做数据库劫持并跳回档案馆深链。
export default function Page() {
  const { is404 } = usePageContext();
  const [targetPath, setTargetPath] = useState('');
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    const segment = window.location.pathname.split('/').pop() ?? '';
    setTargetPath(segment);

    if (segment.startsWith('sub-')) {
      fetch('/archive/data/database.json')
        .then((res) => res.json())
        .then((db: unknown) => {
          const exists = Array.isArray(db) && db.some((item) => (item as { sub_id?: string }).sub_id === segment);
          if (exists) window.location.replace(`/archive?${segment}`);
        })
        .catch((e) => console.error('Database fetch failed', e));
    }

    const timer = window.setTimeout(() => setShowError(true), 1000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex h-screen items-center justify-center font-sans">
      <style>{PAGE_CSS}</style>
      <div className="scan-line" />

      <div id="app" className="relative z-10 px-6 text-center">
        <div id="searching" className={showError ? 'hidden' : 'space-y-6'}>
          <div className="relative mx-auto h-24 w-24">
            <div className="absolute inset-0 rounded-full border-4 border-[#40B5AD]/10" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-t-[#40B5AD]" />
          </div>
          <div className="space-y-2">
            <h2 className="brand-shadow text-2xl font-black tracking-[0.3em] text-[#40B5AD] uppercase">Analyzing...</h2>
            <p id="target-path" className="font-mono text-sm tracking-widest text-white/30">
              {targetPath ? `COORD: ${targetPath}` : 'ROOT_ACCESS'}
            </p>
          </div>
        </div>

        <div id="error-box" className={showError ? 'animate-in zoom-in space-y-8 duration-500 fade-in' : 'hidden'}>
          <div className="space-y-4">
            <h1 className="relative text-9xl font-black tracking-tighter text-white/5">
              404
              <span className="brand-shadow absolute inset-0 flex items-center justify-center text-3xl tracking-widest text-[#40B5AD]">
                LOST IN VOID
              </span>
            </h1>
            <div className="mx-auto h-px w-24 bg-[#40B5AD]/30" />
            <p className="text-sm leading-relaxed text-white/50">
              页面 <span id="error-id" className="font-mono text-[#40B5AD]">{targetPath || 'null'}</span> 可能是无效的。
            </p>
          </div>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="https://openstmc.com/"
              className="rounded-2xl bg-[#40B5AD] px-10 py-4 font-extrabold text-black shadow-xl shadow-[#40B5AD]/20 transition-all hover:scale-105 active:scale-95"
            >
              {is404 ? '返回主页面' : '重试'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
