import { useHealthCheck, type EndpointStatus, type OverallStatus } from '../../hooks/useHealthCheck';
import '../../../css/input.css';

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

function dotClass(status: EndpointStatus): string {
  if (status === 'online')
    return 'w-2.5 h-2.5 rounded-full bg-green-500 dot-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]';
  if (status === 'offline') return 'w-2.5 h-2.5 rounded-full bg-red-600';
  return 'w-2.5 h-2.5 rounded-full bg-gray-600';
}

function pingText(status: EndpointStatus, ping: number | null): string {
  if (status === 'online') return `${ping} ms`;
  if (status === 'offline') return 'TIMEOUT';
  return '-- ms';
}

export default function Page() {
  const { data, overall, refresh, copyDebug } = useHealthCheck();
  const cfg = OVERALL[overall];

  return (
    <div className="bg-grid min-h-screen bg-black text-gray-200 font-sans portal-page">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="flex justify-between items-center mb-12 backdrop-blur-sm bg-black/40 p-4 rounded-xl border border-white/5">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">OpenST System Status</h1>
            <p className="text-gray-500 text-sm mt-1">站点状态</p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${cfg.badge}`}>
            {cfg.badgeText}
          </div>
        </header>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 mb-8 text-center shadow-2xl transition-all duration-500">
          <div className="inline-block p-4 rounded-full bg-zinc-800 mb-4">
            <div className={`w-4 h-4 rounded-full transition-all duration-700 ${cfg.dot}`} />
          </div>
          <h2 className={`text-xl font-semibold ${cfg.textColor}`}>{cfg.text}</h2>
          <p className="text-gray-500 text-sm mt-2">{cfg.desc}</p>
        </div>

        <div className="grid gap-4">
          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 p-5 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={dotClass(data.portal.status)} />
              <div>
                <div className="text-white font-medium text-sm">Portal 主站</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">Vercel Edge Network</div>
              </div>
            </div>
            <div className="text-sm font-mono text-gray-400">{pingText(data.portal.status, data.portal.ping)}</div>
          </div>

          <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 p-5 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={dotClass(data.api.status)} />
                <div>
                  <div className="text-white font-medium text-sm">API/后端</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest">Cloudflare Workers</div>
                </div>
              </div>
              <div className="text-sm font-mono text-gray-400">{pingText(data.api.status, data.api.ping)}</div>
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] font-mono bg-black/40 px-2 py-1 rounded border border-white/5 text-gray-500 tracking-tighter">
                NODE: {data.api.status === 'online' && data.api.region ? data.api.region : '--'}
              </span>
              <span className="text-[10px] font-mono bg-black/40 px-2 py-1 rounded border border-white/5 text-gray-500 tracking-tighter">
                UPSTREAM: {data.api.status === 'online' && data.api.upstream ? data.api.upstream : '--'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 p-5 rounded-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className={dotClass(data.cdn.status)} />
              <div>
                <div className="text-white font-medium text-sm">下载服务（CDN）</div>
                <div className="text-[10px] text-gray-500 uppercase tracking-widest">cdn.linvin.net (EdgeOne)</div>
              </div>
            </div>
            <div className="text-sm font-mono text-gray-400">{pingText(data.cdn.status, data.cdn.ping)}</div>
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] font-mono bg-black/40 px-2 py-1 rounded border border-white/5 text-gray-500 tracking-tighter">
              {data.cdn.status === 'online' ? 'NODE: EO_ANYCAST' : 'NODE: ANYCAST'}
            </span>
            <span className="text-[10px] font-mono bg-black/40 px-2 py-1 rounded border border-white/5 text-gray-500 tracking-tighter">
              {data.cdn.status === 'online' ? 'STATUS: OPERATIONAL' : 'CACHE: FETCHING'}
            </span>
          </div>
        </div>

        <footer className="mt-12 pt-8 border-t border-zinc-800/50 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-xs text-gray-600 font-mono">&copy; 2026 OPENST &bull; AUTO_REFRESH: 30S</div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={copyDebug}
              className="text-[11px] bg-zinc-800 text-gray-300 px-4 py-2 rounded-lg hover:bg-zinc-700 transition"
            >
              复制诊断信息
            </button>
            <button
              type="button"
              onClick={refresh}
              className="text-[11px] bg-white text-black px-4 py-2 rounded-lg hover:bg-gray-200 transition font-bold"
            >
              手动刷新
            </button>
          </div>
        </footer>
      </div>

      <div className="h-24 w-full bg-gradient-to-t from-black to-transparent pointer-events-none" />
    </div>
  );
}
