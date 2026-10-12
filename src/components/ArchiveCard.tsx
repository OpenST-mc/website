import { useEffect, useState } from 'react';
import { useLazyImage } from '../hooks/useLazyImage';
import type { ArchiveItem } from '../lib/types';

interface ArchiveCardProps {
  item: Pick<ArchiveItem, 'id' | 'name' | 'author' | 'tags' | 'preview'>;
  isAdmin: boolean;
  isFav: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onToggleFav: () => void;
}

export function ArchiveCard({ item, isAdmin, isFav, onOpen, onEdit, onToggleFav }: ArchiveCardProps) {
  const { ref, src, visible } = useLazyImage(item.preview);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [item.preview]);

  return (
    <div className="group bg-panel rounded-[20px] overflow-hidden border border-white/5 hover:border-brand/40 active:scale-[0.98] transition-all duration-300 shadow-lg flex flex-col h-full relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFav();
        }}
        aria-label={isFav ? '取消收藏' : '收藏'}
        className={`absolute top-4 left-4 z-10 p-2.5 rounded-xl bg-black/20 backdrop-blur-md border border-white/5 transition-all hover:scale-110 active:scale-90 ${
          isFav ? 'opacity-100 bg-brand/10 border-brand/20' : 'opacity-0 group-hover:opacity-100'
        }`}
      >
        <svg
          className={`w-4 h-4 transition-colors ${isFav ? 'text-brand fill-current' : 'text-white/40 group-hover:text-white/80'}`}
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isAdmin ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label="编辑稿件"
          className="absolute top-4 right-4 z-10 bg-brand text-black p-2.5 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              strokeWidth="2.5"
            />
          </svg>
        </button>
      ) : null}

      <button
        type="button"
        onClick={onOpen}
        aria-label={`查看 ${item.name}`}
        className="aspect-[16/9] overflow-hidden relative cursor-pointer bg-black/20 w-full"
      >
        {imgFailed ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">预览图加载失败</div>
        ) : (
          <img
            ref={ref}
            src={src}
            alt={item.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      <div className="p-5 flex flex-col flex-1">
        <button type="button" onClick={onOpen} className="text-left mb-3 w-full">
          <h3 className="font-bold text-base line-clamp-2 h-[2.8rem] text-gray-100 group-hover:text-brand transition-colors">
            {item.name}
          </h3>
          <p className="text-xs text-gray-500 mt-1 truncate">by {item.author}</p>
        </button>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.tags.map((tag, index) => (
            <span
              key={`${tag}-${index}`}
              className={`px-2 py-0.5 rounded-md text-[11px] font-bold border border-transparent truncate max-w-[90px] ${
                index === 0 ? 'bg-brand/10 text-brand' : 'bg-white/5 text-gray-400'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
