import { useEffect, useId, useMemo, useState, type MouseEvent } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { fetchJson, HttpError } from '../lib/http';
import { parseDownloadStats } from '../lib/schema';
import { notify } from '../lib/notify';
import { useDialog } from '../hooks/useDialog';
import type { ArchiveItem } from '../lib/types';

interface DetailModalProps {
  item: ArchiveItem;
  isAdmin: boolean;
  useProxy: boolean;
  onToggleProxy: (v: boolean) => void;
  onClose: () => void;
  onEdit: () => void;
  on3DPreview: () => void;
  onImageZoom: (url: string, name: string) => void;
}

export function DetailModal({
  item,
  isAdmin,
  useProxy,
  onToggleProxy,
  onClose,
  onEdit,
  on3DPreview,
  onImageZoom,
}: DetailModalProps) {
  const [downloadCount, setDownloadCount] = useState<number | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const titleId = useId();
  const dialogRef = useDialog<HTMLDivElement>(true, onClose);

  useEffect(() => {
    setPreviewFailed(false);
  }, [item.preview]);

  const renderedDescription = useMemo(() => {
    if (!item.description) return '<p class="italic opacity-50 text-gray-600">作者没留下任何简介，一定是大佬吧！</p>';
    try {
      return DOMPurify.sanitize(String(marked.parse(item.description, { breaks: true, gfm: true })));
    } catch {
      return '';
    }
  }, [item.description]);

  const id = item.sub_id || item.id;
  const downloadHref = id ? `/api/download?id=${encodeURIComponent(id)}` : '#';

  useEffect(() => {
    setDownloadCount(null);
    if (!id) return;
    const controller = new AbortController();
    fetchJson<unknown>(`/api/stats?id=${encodeURIComponent(id)}`, {
      signal: controller.signal,
      timeoutMs: 8000,
      retries: 1,
    })
      .then(({ data }) => {
        const count = parseDownloadStats(data);
        if (count !== null) setDownloadCount(count);
      })
      .catch((error: unknown) => {
        // 统计失败不影响下载：取消静默，其余仅告警。
        if (error instanceof HttpError && error.code === 'aborted') return;
        console.warn('[stats] 下载计数获取失败', error);
      });
    return () => controller.abort();
  }, [id]);

  const handleMdClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') onImageZoom((target as HTMLImageElement).src, 'Preview');
  };

  const copyPermalink = () => {
    if (!item.sub_id) return;
    navigator.clipboard
      .writeText(`https://openstmc.com/api/share?${item.sub_id}`)
      .then(() => notify('success', '直链已复制到剪贴板'))
      .catch(() => notify('error', '复制失败，请检查浏览器剪贴板权限'));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-6 detail-modal-container">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-[#1a1a1a] w-full max-w-6xl md:rounded-[2rem] shadow-2xl overflow-hidden relative z-10 flex flex-col md:flex-row h-full md:h-auto md:max-h-[90vh] border border-white/5"
      >
        {isAdmin ? (
          <div className="absolute top-6 left-6 z-30 flex gap-2">
            <button
              type="button"
              onClick={onEdit}
              className="bg-brand/20 hover:bg-brand text-brand hover:text-black px-4 py-2 rounded-full text-xs font-bold transition-all border border-brand/20 backdrop-blur-md flex items-center gap-2"
            >
              编辑稿件
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-6 right-6 z-30 bg-black/50 hover:bg-brand text-white w-10 h-10 rounded-full flex items-center justify-center transition-all group"
        >
          <svg className="w-6 h-6 group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M6 18L18 6M6 6l12 12" strokeWidth="2.5" />
          </svg>
        </button>

        <div className="flex flex-col md:flex-row w-full overflow-y-auto md:overflow-visible">
          <div className="w-full md:w-3/5 bg-black/20 flex items-center justify-center border-b md:border-b-0 md:border-r border-white/5 p-4 md:p-10 md:sticky md:top-0 h-auto md:h-[90vh]">
            {item.preview && !previewFailed ? (
              <img
                src={item.preview}
                alt={item.name}
                onClick={(e) => {
                  e.stopPropagation();
                  onImageZoom((e.target as HTMLImageElement).src, item.name);
                }}
                onError={() => setPreviewFailed(true)}
                className="w-full h-auto md:max-h-full object-contain rounded-xl shadow-2xl cursor-zoom-in"
              />
            ) : (
              <div className="text-sm text-gray-400 italic">预览图暂不可用</div>
            )}
          </div>

          <div className="w-full md:w-2/5 p-8 md:p-10 flex flex-col gap-8 bg-[#1a1a1a] md:overflow-y-auto md:h-[90vh] text-gray-400">
            <div>
              <div className="text-brand text-xs font-bold tracking-[0.2em] uppercase mb-2">Archive Detail</div>
              <h2 id={titleId} className="text-3xl font-bold text-white leading-tight">
                {item.name}
              </h2>

              <div className="flex flex-col gap-3 mt-4">
                <p className="text-lg text-gray-200">by {item.author}</p>

                <button
                  type="button"
                  onClick={copyPermalink}
                  title="点击复制直链"
                  className="group self-start flex items-center gap-2 bg-white/5 hover:bg-brand/10 border border-white/5 hover:border-brand/30 px-3 py-1.5 rounded-xl cursor-pointer transition-all active:scale-95"
                >
                  <span className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase">ID:</span>
                  <span className="text-xs font-mono text-gray-400 group-hover:text-brand transition-colors">{item.sub_id}</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="text-[12px] bg-white/5 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 font-bold hover:border-brand/30 transition-colors"
                >
                  {t}
                </span>
              ))}
            </div>

            <div className="flex-1">
              <h4 className="text-[10px] text-brand font-bold mb-3 uppercase tracking-widest opacity-80">Description</h4>
              <div className="markdown-body text-sm leading-relaxed" onClick={handleMdClick}>
                <div dangerouslySetInnerHTML={{ __html: renderedDescription }} />
              </div>
            </div>

            <div className="pt-6 pb-10 mt-auto flex flex-col gap-4">
              {item.filename && item.filename.endsWith('.litematic') ? (
                <button
                  type="button"
                  onClick={on3DPreview}
                  className="group relative overflow-hidden bg-[#F59E0B]/10 hover:bg-[#F59E0B]/20 border border-[#F59E0B]/30 text-[#F59E0B] text-center py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.97]"
                >
                  投影预览
                </button>
              ) : null}

              <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                <div className="flex items-center gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center text-brand">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14H11V21L20 10H13Z" />
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-gray-200">GitHub 下载加速</span>
                    <span className="text-[10px] text-gray-500 font-medium">如果下载速度慢请开启</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useProxy}
                    onChange={(e) => onToggleProxy(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand peer-checked:after:bg-black" />
                </label>
              </div>

              <div className="flex flex-col gap-2">
                <a
                  href={downloadHref}
                  className="bg-brand hover:brightness-110 text-black text-center py-4 rounded-2xl text-lg font-bold flex items-center justify-center gap-3 transition-all active:scale-[0.97] shadow-xl shadow-brand/20"
                >
                  下载文件
                </a>
                {downloadCount !== null ? (
                  <span className="text-center text-[10px] text-gray-500 font-mono">已下载 {downloadCount} 次</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
