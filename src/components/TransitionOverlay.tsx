import { HOME_TRANSITION_LOGS } from '../hooks/useHomeEffects';

// 彩蛋过渡遮罩（五连击后显示）。
export function TransitionOverlay({ active, logIndex }: { active: boolean; logIndex: number }) {
  if (!active) return null;
  const safeIndex = Math.min(logIndex, HOME_TRANSITION_LOGS.length);
  const label =
    safeIndex === 0 ? 'GATE: INITIALIZING...' : `STATUS: ${HOME_TRANSITION_LOGS[safeIndex - 1] ?? 'ACCESS_GRANTED'}`;

  return (
    <div id="transition-overlay" className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0a]">
      <div className="scan-line" />
      <div id="app" className="relative z-10 px-6 text-center">
        <div id="searching" className="space-y-6">
          <div className="relative mx-auto h-24 w-24">
            <div className="absolute inset-0 rounded-full border-4 border-[#40B5AD]/10" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-t-[#40B5AD]" />
          </div>
          <div className="space-y-2">
            <h2 className="brand-shadow text-2xl font-black tracking-[0.3em] text-[#40B5AD] uppercase">Bypassing...</h2>
            <p id="inject-log" className="font-mono text-xs tracking-widest text-white/30 uppercase">
              {label}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
