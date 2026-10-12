import type { ReactNode } from 'react';

interface StatusPanelProps {
  variant: 'loading' | 'empty' | 'error';
  title: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
}

// 统一的加载/空/失败态面板，避免空白页；失败态可重试。
export function StatusPanel({ variant, title, description, onRetry, retryLabel = '重试' }: StatusPanelProps) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className="py-20 flex flex-col items-center gap-3 text-center"
    >
      {variant === 'loading' ? (
        <div
          aria-hidden="true"
          className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/60 animate-spin"
        />
      ) : null}
      <p className={`text-sm ${variant === 'error' ? 'text-red-300' : 'text-gray-400'}`}>{title}</p>
      {description ? <p className="text-xs text-gray-400 max-w-sm leading-relaxed">{description}</p> : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-white/80 hover:bg-white/10 hover:text-white transition-colors"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
