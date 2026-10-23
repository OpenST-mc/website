import { useDialog } from '../hooks/useDialog';

interface ImageZoomProps {
  url: string;
  name: string;
  onClose: () => void;
}

export function ImageZoom({ url, name, onClose }: ImageZoomProps) {
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`图片预览：${name}`}
      tabIndex={-1}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl cursor-zoom-out"
      onClick={onClose}
    >
      <button
        type="button"
        aria-label="关闭"
        className="absolute top-6 right-6 text-white/50 hover:text-brand transition-colors p-2"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" />
        </svg>
      </button>
      <div
        className="relative max-w-[95vw] max-h-[85vh] flex flex-col items-center select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={url}
          alt={name}
          className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl border border-white/5"
        />
        <div className="mt-6 px-4 py-1.5 bg-brand/10 border border-brand/20 rounded-full backdrop-blur-md">
          <span className="text-brand font-mono text-xs">{name}</span>
        </div>
      </div>
    </div>
  );
}
