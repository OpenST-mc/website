import { useState } from 'react';
import { TAG_CONFIG } from '../lib/config';
import { useDialog } from '../hooks/useDialog';
import type { SelectedTags } from '../lib/logic';

interface SideBarProps {
  categories: string[];
  groups: Record<string, Set<string>>;
  selected: SelectedTags;
  search: string;
  onSearchChange: (v: string) => void;
  onToggleTag: (cat: string, tag: string) => void;
  showOnlyFavs: boolean;
  onToggleShowOnlyFavs: () => void;
  favoritesCount: number;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function SideBar({
  categories,
  groups,
  selected,
  search,
  onSearchChange,
  onToggleTag,
  showOnlyFavs,
  onToggleShowOnlyFavs,
  favoritesCount,
  onReset,
  isOpen,
  onClose,
}: SideBarProps) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const drawerRef = useDialog<HTMLElement>(isOpen, onClose);

  const handleSubCatClick = (cat: string, subCat: string, hasSubTags: boolean) => {
    if (hasSubTags) setExpandedGroups((prev) => ({ ...prev, [subCat]: !prev[subCat] }));
    onToggleTag(cat, subCat);
  };

  const hasAnyFilter = Boolean(search) || Object.values(selected).some((v) => v && v.length > 0) || showOnlyFavs;

  return (
    <div className="shrink-0 flex text-[16px]">
      {isOpen ? (
        <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden" aria-hidden="true" />
      ) : null}
      <aside
        ref={drawerRef}
        {...(isOpen ? { role: 'dialog', 'aria-modal': true, 'aria-label': '筛选菜单', tabIndex: -1 } : {})}
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed inset-y-0 left-0 z-50 w-72 bg-[#191919] p-5 flex flex-col border-r border-white/5 transition-transform duration-300 md:relative md:translate-x-0 h-full shrink-0 shadow-2xl md:shadow-none`}
      >
        <div className="flex flex-col gap-3 mb-6 shrink-0">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              type="text"
              placeholder="搜索存档/作者/简介/标签..."
              className="w-full bg-black/40 rounded-lg px-4 py-2.5 text-base border border-white/5 focus:border-brand outline-none transition text-white pr-10"
            />
            {search ? (
              <button
                type="button"
                aria-label="清空搜索"
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
              >
                ✕
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-1">我的收藏</span>
            <div className="flex flex-col text-[14px]">
              <button
                type="button"
                onClick={onToggleShowOnlyFavs}
                className={`text-left py-2 px-3 rounded-md transition-all flex items-center gap-3 group ${
                  showOnlyFavs ? 'text-brand font-bold bg-brand/5' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <svg
                  className={`w-3.5 h-3.5 ${showOnlyFavs ? 'fill-current text-brand' : 'text-white/20 group-hover:text-white/40'}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>我的收藏 ({favoritesCount})</span>
              </button>
            </div>
          </div>

          {hasAnyFilter ? (
            <button
              type="button"
              onClick={() => {
                onReset();
                setExpandedGroups({});
              }}
              className="w-full py-2 rounded-lg bg-brand/10 border border-brand/20 text-brand text-[13px] font-bold hover:bg-brand hover:text-white transition-all"
            >
              清除所有筛选
            </button>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-8">
          {categories.map((cat) => {
            const catConfig = TAG_CONFIG[cat];
            const flat = Array.isArray(catConfig);
            return (
              <div key={cat} className="flex flex-col gap-2">
                <span className="text-[11px] text-gray-600 font-bold uppercase tracking-[0.2em] mb-1">{cat}</span>
                <div className="flex flex-col text-[14px]">
                  {flat ? (
                    Array.from(groups[cat] ?? []).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => onToggleTag(cat, tag)}
                        className={`text-left py-2 px-3 rounded-md transition-all flex items-center gap-3 ${
                          selected[cat]?.includes(tag) ? 'text-brand font-bold bg-brand/5' : 'text-white/60 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${selected[cat]?.includes(tag) ? 'bg-brand' : 'bg-white/10'}`} />
                        {tag}
                      </button>
                    ))
                  ) : catConfig ? (
                    Object.entries(catConfig).map(([subCat, subTags]) => {
                      const hasSubTags = Array.isArray(subTags) && subTags.length > 0;
                      return (
                        <div key={subCat} className="mb-1">
                          <button
                            type="button"
                            onClick={() => handleSubCatClick(cat, subCat, hasSubTags)}
                            className={`w-full text-left py-2 px-3 flex justify-between items-center group transition rounded-md hover:bg-white/5 ${
                              selected[cat]?.includes(subCat) ? 'bg-brand/10 border-l-2 border-brand text-brand' : 'text-white/80'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {!hasSubTags ? (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${selected[cat]?.includes(subCat) ? 'bg-brand' : 'bg-white/10'}`}
                                />
                              ) : null}
                              <span className="font-medium">{subCat}</span>
                            </div>
                            {hasSubTags ? (
                              <span
                                className={`text-[10px] opacity-40 transition-transform duration-300 ${expandedGroups[subCat] ? 'rotate-180' : ''}`}
                              >
                                ▼
                              </span>
                            ) : null}
                          </button>

                          {hasSubTags && expandedGroups[subCat] ? (
                            <div className="flex flex-col gap-1 ml-4 mt-1 mb-2 border-l border-white/5">
                              {subTags
                                .filter((tag) => groups[cat]?.has(tag))
                                .map((tag) => (
                                  <button
                                    key={tag}
                                    type="button"
                                    onClick={() => onToggleTag(cat, tag)}
                                    className={`text-left text-[13px] py-1.5 px-4 rounded transition-all ${
                                      selected[cat]?.includes(tag) ? 'text-brand font-bold bg-brand/5' : 'text-white/50 hover:text-white'
                                    }`}
                                  >
                                    {tag}
                                  </button>
                                ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
