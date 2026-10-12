import { useSyncExternalStore } from 'react';
import { dismissNotice, getNotices, subscribeNotices, EMPTY_NOTICES, type NoticeKind } from '../lib/notify';

const KIND_STYLES: Record<NoticeKind, string> = {
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  error: 'border-red-500/30 bg-red-500/10 text-red-200',
};

// 全局通知容器：挂在页面级 Wrapper 内，SSG 首屏为空（无水合差异）。
export function Toaster() {
  const notices = useSyncExternalStore(subscribeNotices, getNotices, () => EMPTY_NOTICES);
  if (notices.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 w-[min(24rem,calc(100vw-3rem))]">
      {notices.map((notice) => (
        <div
          key={notice.id}
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md bg-black/80 ${KIND_STYLES[notice.kind]}`}
        >
          <span className="text-sm leading-relaxed break-words flex-1">{notice.message}</span>
          <button
            type="button"
            aria-label="关闭通知"
            onClick={() => dismissNotice(notice.id)}
            className="shrink-0 text-white/60 hover:text-white transition-colors text-sm leading-none mt-0.5"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
