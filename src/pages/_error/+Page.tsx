import { useEffect, useState } from 'react';
import { usePageContext } from 'vike-react/usePageContext';

// Vike 错误页：404「定位失败」；对 `sub-*` 路径查库劫持并跳回档案馆深链。
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
    <div className="h-screen flex items-center justify-center font-sans">
      <div className="scan-line" />

      <div id="app" className="relative z-10 text-center px-6">
        <div id="searching" className={showError ? 'hidden' : 'space-y-6'}>
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 border-4 border-[#40B5AD]/10 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-[#40B5AD] rounded-full animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-[0.3em] text-[#40B5AD] brand-shadow uppercase">Analyzing...</h2>
            <p id="target-path" className="text-white/30 font-mono text-sm tracking-widest">
              {targetPath ? `COORD: ${targetPath}` : 'ROOT_ACCESS'}
            </p>
          </div>
        </div>

        <div id="error-box" className={showError ? 'space-y-8 max-w-lg animate-in fade-in zoom-in duration-500' : 'hidden'}>
          <div className="space-y-4">
            <h1 className="text-9xl font-black text-white/5 tracking-tighter relative">
              404
              <span className="absolute inset-0 flex items-center justify-center text-3xl tracking-widest text-[#40B5AD] brand-shadow">
                LOST IN VOID
              </span>
            </h1>
            <div className="h-px w-24 bg-[#40B5AD]/30 mx-auto" />
            <p className="text-white/50 leading-relaxed text-sm">
              页面 <span id="error-id" className="text-[#40B5AD] font-mono">{targetPath || 'null'}</span> 可能是无效的。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="https://openstmc.com/"
              className="px-10 py-4 rounded-2xl bg-[#40B5AD] text-black font-extrabold hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#40B5AD]/20"
            >
              {is404 ? '返回主页面' : '重试'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
