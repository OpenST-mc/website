import { TransitionOverlay } from '../../components/TransitionOverlay';
import { useHomeEffects } from '../../hooks/useHomeEffects';

export default function Page() {
  const { transitioning, logIndex, onSecretClick } = useHomeEffects();

  return (
    <div className="min-h-screen p-4 md:p-12">
      <div className="logic-grid pointer-events-none fixed inset-0 z-0" />

      <div className="rs-wire top-[10%] md:top-[15%]" />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-16 flex flex-col justify-between gap-6 border-b border-white/5 pb-8 sm:flex-row sm:items-end md:mb-32">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="signal" />
              <h1 className="glitch-text loading-skeleton cursor-default text-3xl font-black tracking-tighter text-white md:text-4xl">
                OPEN<span className="loading-skeleton text-[#40B5AD]">ST</span>
              </h1>
            </div>
            <p
              className="loading-skeleton cursor-pointer text-[9px] tracking-[0.2em] text-gray-600 uppercase md:text-[10px] md:tracking-[0.4em]"
              onClick={(e) => onSecretClick(e.currentTarget)}
            >
              Protocol Version 4.5 // Sub-System Active
            </p>
          </div>

          <div
            id="credits-trigger"
            className="group hidden cursor-pointer text-right sm:block"
            onClick={(e) => onSecretClick(e.currentTarget)}
          >
            <div className="loading-skeleton text-[10px] tracking-widest text-gray-700 group-hover:text-cyan-500 group-hover:transition-colors">
              ACCESS_KEY: CREDITS
            </div>
            <div className="mt-1 flex justify-end gap-1">
              <div className="h-1 w-4 bg-white/5 group-hover:bg-cyan-500/50" />
              <div className="h-1 w-8 bg-white/5 group-hover:bg-cyan-500" />
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 md:gap-12">
          <div className="space-y-10 lg:col-span-7 md:space-y-12">
            <div className="space-y-4 md:space-y-6">
              <h2 className="loading-skeleton text-4xl leading-none font-black text-white uppercase md:text-6xl">
                THE
                <br />
                ARCHIVE
              </h2>
              <p className="loading-skeleton max-w-md border-l-2 border-red-600 pl-4 text-sm text-gray-500 italic uppercase md:pl-6 md:text-base">
                &quot;开源，社区，MC。&quot;
              </p>
            </div>

            <a href="/archive/index.html" className="group relative block">
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-cyan-600 opacity-20 blur transition duration-500 group-hover:opacity-40" />
              <div className="tech-panel relative flex h-64 flex-col justify-between overflow-hidden bg-black p-8 md:h-80 md:p-12">
                <div className="z-10">
                  <span className="loading-skeleton text-[9px] font-bold tracking-[0.5em] text-red-500 uppercase md:text-[10px]">
                    PRIMARY_ENTRY
                  </span>
                  <h3 className="loading-skeleton mt-2 text-2xl font-black text-white uppercase md:mt-4 md:text-3xl">
                    进入档案馆
                  </h3>
                </div>
                <div className="loading-skeleton z-10 flex items-center gap-4 text-[10px] tracking-widest text-gray-500 transition-colors group-hover:text-white md:text-xs">
                  <span className="truncate uppercase">Initializing_Session</span>
                  <div className="hidden h-px flex-1 bg-white/10 sm:block" />
                  <span className="shrink-0 uppercase">0x801_Deployed</span>
                </div>
                <div className="loading-skeleton absolute -right-6 -bottom-6 -mr-6 -mb-6 text-7xl font-black text-white/[0.02] uppercase select-none md:-right-10 md:-bottom-10 md:-mr-10 md:-mb-10 md:text-9xl">
                  DATA
                </div>
              </div>
            </a>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-5 md:gap-6">
            <div className="loading-skeleton mb-2 text-[9px] font-bold tracking-[0.3em] text-gray-800 uppercase md:text-[10px]">
              // Auxiliary_Modules
            </div>

            <a href="https://wiki.openstmc.com" target="_blank" rel="noreferrer" className="tech-panel group p-6 md:p-8">
              <div className="flex items-start justify-between">
                <h4 className="loading-skeleton text-base font-bold text-white uppercase transition-colors group-hover:text-[#40B5AD] md:text-lg">
                  Wiki
                </h4>
                <span className="loading-skeleton font-mono text-[10px] text-gray-800 uppercase md:text-xs">01</span>
              </div>
              <p className="loading-skeleton mt-4 text-[11px] leading-relaxed text-gray-600 uppercase md:text-xs">
                学习储电知识，社区驱动的大型 Wiki
              </p>
            </a>

            <a
              href="/Extra-Function/litematic-converter/index.html"
              target="_blank"
              rel="noreferrer"
              className="tech-panel group border-l-purple-900/50 p-6 hover:border-l-purple-500 md:p-8"
            >
              <div className="flex items-start justify-between">
                <h4 className="loading-skeleton text-base font-bold text-white uppercase transition-colors group-hover:text-purple-400 md:text-lg">
                  版本转换 (CONV)
                </h4>
                <span className="loading-skeleton font-mono text-[10px] text-gray-800 uppercase md:text-xs">02</span>
              </div>
              <p className="loading-skeleton mt-4 text-[11px] leading-relaxed text-gray-600 uppercase md:text-xs">
                跨版本投影转换，支持 MC 1.12 到最新版本
              </p>
            </a>

            <a
              href="/Extra-Function/litematic-preview/index.html"
              target="_blank"
              rel="noreferrer"
              className="tech-panel group border-l-orange-900/50 p-6 hover:border-l-orange-500 md:p-8"
            >
              <div className="flex items-start justify-between">
                <h4 className="loading-skeleton text-base font-bold text-white uppercase transition-colors group-hover:text-orange-400 md:text-lg">
                  结构预览 (WebGL)
                </h4>
                <span className="loading-skeleton font-mono text-[10px] text-gray-800 uppercase md:text-xs">03</span>
              </div>
              <p className="loading-skeleton mt-4 text-[11px] leading-relaxed text-gray-600 uppercase md:text-xs">
                3D 预览投影，无需打开游戏即可查看机器细节
              </p>
            </a>

            <div className="space-y-4 rounded-sm border border-white/5 p-4 md:p-6">
              <div className="flex justify-between text-[7px] tracking-tighter md:text-[8px]">
                <span className="loading-skeleton text-gray-700 uppercase">Buffer_Load</span>
                <span className="loading-skeleton text-red-500 uppercase">Optimal</span>
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

        <footer className="mt-24 flex flex-col items-center justify-between gap-8 border-t border-white/5 pt-8 md:mt-32 md:flex-row md:gap-6">
          <div className="loading-skeleton text-[9px] tracking-[0.2em] text-gray-700 uppercase md:tracking-[0.5em]">
            © 2026 OpenST-mc // Technical Storage Protocol
          </div>
          <div className="flex gap-8">
            <a
              href="https://github.com/OpenST-mc"
              className="loading-skeleton text-[9px] tracking-widest text-gray-500 uppercase transition-colors hover:text-white"
            >
              Github_Repo
            </a>
            <a
              href="https://status.openstmc.com/"
              className="loading-skeleton text-[9px] tracking-widest text-gray-500 uppercase transition-colors hover:text-white"
            >
              ST_Network
            </a>
            <a
              href="https://qm.qq.com/q/XrYt5ObyiQ"
              className="loading-skeleton text-[9px] tracking-widest text-gray-500 uppercase transition-colors hover:text-white"
            >
              QQ_Group
            </a>
          </div>
        </footer>
      </div>

      <TransitionOverlay active={transitioning} logIndex={logIndex} />
    </div>
  );
}
