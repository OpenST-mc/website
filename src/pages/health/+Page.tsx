import { useHealthCheck, type OverallStatus } from '../../hooks/useHealthCheck';

interface OverallConfig {
  text: string;
  dot: string;
  badge: string;
  badgeText: string;
  desc: string;
  textColor: string;
}

const OVERALL: Record<OverallStatus, OverallConfig> = {
  loading: {
    text: '正在读取边缘数据...',
    dot: 'bg-gray-600',
    badge: 'bg-gray-800 text-gray-400',
    badgeText: '正在初始化...',
    desc: '正在通过独立节点拨测全球服务可用性',
    textColor: 'text-white',
  },
  operational: {
    text: '所有系统运行正常',
    dot: 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]',
    badge: 'bg-green-900/30 text-green-400',
    badgeText: 'SYSTEM OPERATIONAL',
    desc: '当前所有服务均处于最佳运行状态',
    textColor: 'text-green-500',
  },
  partial_outage: {
    text: '部分服务响应异常',
    dot: 'bg-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]',
    badge: 'bg-yellow-900/30 text-yellow-400',
    badgeText: 'PARTIAL OUTAGE',
    desc: '核心功能可用，但部分链路存在延迟或抖动',
    textColor: 'text-yellow-500',
  },
  major_outage: {
    text: '核心服务完全失联',
    dot: 'bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.6)] dot-pulse',
    badge: 'bg-red-900/40 font-bold text-red-500',
    badgeText: 'MAJOR OUTAGE',
    desc: '检测到大面积服务中断，技术团队可能正在处理',
    textColor: 'text-red-500',
  },
  offline: {
    text: '本地网络连接断开',
    dot: 'bg-zinc-600',
    badge: 'bg-zinc-800 text-zinc-500',
    badgeText: 'LOCAL OFFLINE',
    desc: '请检查您的设备网络连接后再试',
    textColor: 'text-yellow-500',
  },
};

function dotClass(status: 'unknown' | 'online' | 'offline'): string {
  if (status === 'online') return 'w-2.5 h-2.5 rounded-full bg-green-500 dot-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]';
  if (status === 'offline') return 'w-2.5 h-2.5 rounded-full bg-red-600';
  return 'w-2.5 h-2.5 rounded-full bg-gray-600';
}

function pingText(status: 'unknown' | 'online' | 'offline', ping: number | null): string {
  if (status === 'online') return `${ping} ms`;
  if (status === 'offline') return 'TIMEOUT';
  return '-- ms';
}

export default function Page() {
  const { data, overall, refresh, copyDebug } = useHealthCheck();
  const cfg = OVERALL[overall];

  return (
    <div className="bg-grid min-h-screen bg-black font-sans text-gray-200">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-12 flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-4 backdrop-blur-sm">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">OpenST System Status</h1>
            <p className="mt-1 text-sm text-gray-500">站点状态</p>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${cfg.badge}`}>{cfg.badgeText}</div>
        </header>

        <div
          id="main-status"
          className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center shadow-2xl transition-all duration-500"
        >
          <div className="mb-4 inline-block rounded-full bg-zinc-800 p-4">
            <div className={`h-4 w-4 rounded-full transition-all duration-700 ${cfg.dot}`} />
          </div>
          <h2 className={`text-xl font-semibold ${cfg.textColor}`}>{cfg.text}</h2>
          <p className="mt-2 text-sm text-gray-500">{cfg.desc}</p>
        </div>

        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className={dotClass(data.portal.status)} />
              <div>
                <div className="text-sm font-medium text-white">Portal 主站</div>
                <div className="text-[10px] tracking-widest text-gray-500 uppercase">Vercel Edge Network</div>
              </div>
            </div>
            <div className="font-mono text-sm text-gray-400">{pingText(data.portal.status, data.portal.ping)}</div>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={dotClass(data.api.status)} />
                <div>
                  <div className="text-sm font-medium text-white">API/后端</div>
                  <div className="text-[10px] tracking-widest text-gray-500 uppercase">Cloudflare Workers</div>
                </div>
              </div>
              <div className="font-mono text-sm text-gray-400">{pingText(data.api.status, data.api.ping)}</div>
            </div>
            <div className="flex gap-2">
              <span className="rounded border border-white/5 bg-black/40 px-2 py-1 font-mono text-[10px] tracking-tighter text-gray-500">
                NODE: {data.api.status === 'online' && data.api.region ? data.api.region : '--'}
              </span>
              <span className="rounded border border-white/5 bg-black/40 px-2 py-1 font-mono text-[10px] tracking-tighter text-gray-500">
                UPSTREAM: {data.api.status === 'online' && data.api.upstream ? data.api.upstream : '--'}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 backdrop-blur-md">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={dotClass(data.cdn.status)} />
              <div>
                <div className="text-sm font-medium text-white">下载服务（CDN）</div>
                <div className="text-[10px] tracking-widest text-gray-500 uppercase">cdn.linvin.net (EdgeOne)</div>
              </div>
            </div>
            <div className="font-mono text-sm text-gray-400">{pingText(data.cdn.status, data.cdn.ping)}</div>
          </div>
          <div className="flex gap-2">
            <span className="rounded border border-white/5 bg-black/40 px-2 py-1 font-mono text-[10px] tracking-tighter text-gray-500">
              {data.cdn.status === 'online' ? 'NODE: EO_ANYCAST' : 'NODE: ANYCAST'}
            </span>
            <span className="rounded border border-white/5 bg-black/40 px-2 py-1 font-mono text-[10px] tracking-tighter text-gray-500">
              {data.cdn.status === 'online' ? 'STATUS: OPERATIONAL' : 'CACHE: FETCHING'}
            </span>
          </div>
        </div>

        <footer className="mt-12 flex flex-col items-center justify-between gap-6 border-t border-zinc-800/50 pt-8 md:flex-row">
          <div className="font-mono text-xs text-gray-600">© 2026 OPENST • AUTO_REFRESH: 30S</div>
          <div className="flex gap-3">
            <button
              type="button"
              className="rounded-lg bg-zinc-800 px-4 py-2 text-[11px] text-gray-300 transition hover:bg-zinc-700"
              onClick={copyDebug}
            >
              复制诊断信息
            </button>
            <button
              type="button"
              className="rounded-lg bg-white px-4 py-2 text-[11px] font-bold text-black transition hover:bg-gray-200"
              onClick={refresh}
            >
              手动刷新
            </button>
          </div>
        </footer>
      </div>

      <div className="pointer-events-none h-24 w-full bg-gradient-to-t from-black to-transparent" />
    </div>
  );
}
