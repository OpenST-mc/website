import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { toJsonLd } from '../../lib/schema';
import '../../../css/input.css';

const BYPASS_LOGS = ['SPOOFING_IP...', 'DECRYPTING_V_FILES...', 'BYPASSING_GATE...', 'ACCESS_GRANTED'];
const CREDITS_URL = '/profile/april/december';

// 字体就绪后解锁骨架屏（对齐旧 packages/js/portal.js 行为）。
function useFontUnlock(): void {
  useEffect(() => {
    const unlock = (): void => {
      document.querySelectorAll('.loading-skeleton').forEach((el) => el.classList.remove('loading-skeleton'));
      document.body.classList.add('ready');
      console.log('%c字体加载成功', 'color: #40B5AD; font-weight: bold;');
    };
    const timeout = window.setTimeout(() => {
      if (document.querySelector('.loading-skeleton')) {
        console.warn('SYSTEM: FONT_LOAD_TIMEOUT, FORCING_DISPLAY');
        unlock();
      }
    }, 2500);
    if ('fonts' in document) {
      document.fonts.ready.then(() => {
        window.setTimeout(() => {
          window.clearTimeout(timeout);
          unlock();
        }, 200);
      });
    } else {
      window.addEventListener('load', unlock);
    }
    return () => window.clearTimeout(timeout);
  }, []);
}

// 彩蛋：800ms 内连点 5 次触发过渡遮罩并前往 Credits。
function useBypassTrigger(): { registerClick: (e: MouseEvent<HTMLElement>) => void; bypassing: boolean } {
  const [bypassing, setBypassing] = useState(false);
  const counter = useRef({ count: 0, last: 0 });

  const registerClick = useCallback((e: MouseEvent<HTMLElement>) => {
    const now = Date.now();
    if (now - counter.current.last > 800) counter.current.count = 0;
    counter.current.count += 1;
    counter.current.last = now;

    const target = e.currentTarget;
    target.style.filter = 'brightness(2)';
    target.style.transition = 'filter 0.1s';
    window.setTimeout(() => {
      target.style.filter = 'brightness(1)';
    }, 100);

    if (counter.current.count === 5) {
      counter.current.count = 0;
      setBypassing(true);
    }
  }, []);

  return { registerClick, bypassing };
}

function BypassOverlay() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.style.overflow = 'hidden';
    const id = window.setInterval(() => setStep((s) => s + 1), 600);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (step >= BYPASS_LOGS.length) window.location.href = CREDITS_URL;
  }, [step]);

  const log = BYPASS_LOGS[Math.min(step, BYPASS_LOGS.length - 1)] ?? '';
  return (
    <div className="fixed inset-0 bg-[#0a0a0a] z-[9999] flex items-center justify-center">
      <div className="scan-line" />
      <div className="relative z-10 text-center px-6">
        <div className="space-y-6">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 border-4 border-[#40B5AD]/10 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-[#40B5AD] rounded-full animate-spin" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-[0.3em] text-[#40B5AD] brand-shadow uppercase">Bypassing...</h2>
            <p className="text-white/30 font-mono text-xs tracking-widest uppercase">STATUS: {log}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  useFontUnlock();
  const { registerClick, bypassing } = useBypassTrigger();

  useEffect(() => {
    console.log(
      '%c如果你并非网页开发人员，请勿在控制台内输入任何人传给你的脚本！\n%c在控制台输入脚本可能会让攻击者盗取你的 GitHub 访问令牌（Token），从而控制你的仓库或篡改数据。',
      'color: #333; font-size: 16px; font-weight: bold;',
      'color: red; font-size: 14px;',
    );
  }, []);

  return (
    <div className="min-h-screen p-4 md:p-12 portal-page">
      {bypassing && <BypassOverlay />}
      <div className="logic-grid fixed inset-0 z-0 pointer-events-none" />
      <div className="rs-wire top-[10%] md:top-[15%]" />

      <div className="max-w-6xl mx-auto relative">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-16 md:mb-32 border-b border-white/5 pb-8 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="signal" />
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white glitch-text cursor-default loading-skeleton">
                OPEN<span className="text-[#40B5AD] loading-skeleton">ST</span>
              </h1>
            </div>
            <p className="text-[9px] md:text-[10px] text-gray-600 uppercase tracking-[0.2em] md:tracking-[0.4em] loading-skeleton">
              Protocol Version 4.5 // Sub-System Active
            </p>
          </div>

          <div
            id="credits-trigger"
            onClick={registerClick}
            className="group cursor-pointer text-right hidden sm:block"
          >
            <div className="text-[10px] text-gray-700 group-hover:text-cyan-500 transition-colors tracking-widest loading-skeleton">
              ACCESS_KEY: CREDITS
            </div>
            <div className="flex gap-1 mt-1 justify-end">
              <div className="w-4 h-1 bg-white/5 group-hover:bg-cyan-500/50" />
              <div className="w-8 h-1 bg-white/5 group-hover:bg-cyan-500" />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-12">
          <div className="lg:col-span-7 space-y-10 md:space-y-12">
            <div className="space-y-4 md:space-y-6">
              <h2 className="text-4xl md:text-6xl font-black text-white leading-none loading-skeleton uppercase">
                THE
                <br />
                ARCHIVE
              </h2>
              <p
                onClick={registerClick}
                className="text-gray-500 border-l-2 border-red-600 pl-4 md:pl-6 max-w-md italic loading-skeleton text-sm md:text-base uppercase cursor-pointer"
              >
                &quot;开源，社区，MC。&quot;
              </p>
            </div>

            <a href="/archive" className="block group relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-cyan-600 opacity-20 group-hover:opacity-40 blur transition duration-500" />
              <div className="relative tech-panel p-8 md:p-12 overflow-hidden bg-black h-64 md:h-80 flex flex-col justify-between">
                <div className="z-10">
                  <span className="text-[9px] md:text-[10px] text-red-500 font-bold tracking-[0.5em] loading-skeleton uppercase">
                    PRIMARY_ENTRY
                  </span>
                  <h3 className="text-2xl md:text-3xl font-black text-white mt-2 md:mt-4 loading-skeleton uppercase">
                    进入档案馆
                  </h3>
                </div>
                <div className="z-10 flex items-center gap-4 text-[10px] md:text-xs tracking-widest text-gray-500 group-hover:text-white transition-colors loading-skeleton">
                  <span className="truncate uppercase">Initializing_Session</span>
                  <div className="h-px flex-1 bg-white/10 hidden sm:block" />
                  <span className="shrink-0 uppercase">0x801_Deployed</span>
                </div>
                <div className="absolute right-0 bottom-0 text-white/[0.02] font-black text-7xl md:text-9xl -mb-6 -mr-6 md:-mb-10 md:-mr-10 select-none loading-skeleton uppercase">
                  DATA
                </div>
              </div>
            </a>
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4 md:gap-6">
            <div className="text-[9px] md:text-[10px] font-bold text-gray-800 tracking-[0.3em] mb-2 loading-skeleton uppercase">
              // Auxiliary_Modules
            </div>

            <a href="https://wiki.openstmc.com" target="_blank" className="tech-panel p-6 md:p-8 group">
              <div className="flex justify-between items-start">
                <h4 className="text-base md:text-lg font-bold text-white group-hover:text-[#40B5AD] transition-colors loading-skeleton uppercase">
                  Wiki
                </h4>
                <span className="text-gray-800 font-mono text-[10px] md:text-xs loading-skeleton uppercase">01</span>
              </div>
              <p className="text-[11px] md:text-xs text-gray-600 mt-4 leading-relaxed loading-skeleton uppercase">
                学习储电知识，社区驱动的大型 Wiki
              </p>
            </a>

            <a
              href="/Extra-Function/litematic-converter"
              target="_blank"
              className="tech-panel p-6 md:p-8 group border-l-purple-900/50 hover:border-l-purple-500"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-base md:text-lg font-bold text-white group-hover:text-purple-400 transition-colors loading-skeleton uppercase">
                  版本转换 (CONV)
                </h4>
                <span className="text-gray-800 font-mono text-[10px] md:text-xs loading-skeleton uppercase">02</span>
              </div>
              <p className="text-[11px] md:text-xs text-gray-600 mt-4 leading-relaxed loading-skeleton uppercase">
                跨版本投影转换，支持 MC 1.12 到最新版本
              </p>
            </a>

            <a
              href="/Extra-Function/litematic-preview"
              target="_blank"
              className="tech-panel p-6 md:p-8 group border-l-orange-900/50 hover:border-l-orange-500"
            >
              <div className="flex justify-between items-start">
                <h4 className="text-base md:text-lg font-bold text-white group-hover:text-orange-400 transition-colors loading-skeleton uppercase">
                  结构预览 (WebGL)
                </h4>
                <span className="text-gray-800 font-mono text-[10px] md:text-xs loading-skeleton uppercase">03</span>
              </div>
              <p className="text-[11px] md:text-xs text-gray-600 mt-4 leading-relaxed loading-skeleton uppercase">
                3D 预览投影，无需打开游戏即可查看机器细节
              </p>
            </a>

            <div className="p-4 md:p-6 border border-white/5 rounded-sm space-y-4">
              <div className="flex justify-between text-[7px] md:text-[8px] tracking-tighter">
                <span className="text-gray-700 loading-skeleton uppercase">Buffer_Load</span>
                <span className="text-red-500 loading-skeleton uppercase">Optimal</span>
              </div>
              <div className="flex gap-1">
                <div className="h-1 flex-1 bg-red-500/50" />
                <div className="h-1 flex-1 bg-red-500/30" />
                <div className="h-1 flex-1 bg-white/5" />
                <div className="h-1 flex-1 bg-white/5" />
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-24 md:mt-32 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 md:gap-6">
          <div className="text-[9px] text-gray-700 tracking-[0.2em] md:tracking-[0.5em] uppercase loading-skeleton">
            © 2026 OpenST-mc // Technical Storage Protocol
          </div>
          <div className="flex gap-8">
            <a
              href="https://github.com/OpenST-mc"
              className="text-[9px] text-gray-500 hover:text-white transition-colors tracking-widest loading-skeleton uppercase"
            >
              Github_Repo
            </a>
            <a
              href="https://status.openstmc.com/"
              className="text-[9px] text-gray-500 hover:text-white transition-colors tracking-widest loading-skeleton uppercase"
            >
              ST_Network
            </a>
            <a
              href="https://qm.qq.com/q/XrYt5ObyiQ"
              className="text-[9px] text-gray-500 hover:text-white transition-colors tracking-widest loading-skeleton uppercase"
            >
              QQ_Group
            </a>
          </div>
        </footer>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLd({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'OpenST Portal',
            url: 'https://openstmc.com',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://openstmc.com/archive?search={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
    </div>
  );
}
