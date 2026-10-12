import { useCallback, useEffect, useMemo, useState } from 'react';
import { useData } from 'vike-react/useData';
import { CATEGORIES } from '../../lib/config';
import { calculateDynamicTags, getFilteredList, getSafePath, type SelectedTags } from '../../lib/logic';
import type { ArchiveData, ArchiveItem } from '../../lib/types';
import { parseFavoriteIds, parseSubIdFromSearch, toJsonLd } from '../../lib/schema';
import { useSession } from '../../hooks/useSession';
import { signIn, signOut } from '../../lib/auth';
import { NavBar } from '../../components/NavBar';
import { SideBar } from '../../components/SideBar';
import { ArchiveCard } from '../../components/ArchiveCard';
import { DetailModal } from '../../components/DetailModal';
import { ImageZoom } from '../../components/ImageZoom';
import { StatusPanel } from '../../components/StatusPanel';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import '../../../css/ArchiveInput.css';
import './archive.css';

const PAGE_SIZE = 7;
const FAVS_KEY = 'openst_favs';

function loadFavorites(): string[] {
  try {
    return parseFavoriteIds(JSON.parse(localStorage.getItem(FAVS_KEY) || '[]'));
  } catch {
    return [];
  }
}

function emptySelection(): SelectedTags {
  const sel: SelectedTags = {};
  CATEGORIES.forEach((cat) => {
    sel[cat] = [];
  });
  return sel;
}

export default function Page() {
  const { items, dict } = useData<ArchiveData>();
  const { user, isAdmin } = useSession();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<SelectedTags>(emptySelection);
  const [detailItem, setDetailItem] = useState<ArchiveItem | null>(null);
  const [useProxy, setUseProxy] = useState(true);
  const [zoomImage, setZoomImage] = useState<{ url: string; name: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showOnlyFavs, setShowOnlyFavs] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const normalize = useCallback(
    (str: string): string => {
      if (!str) return '';
      if (dict.t.length === 0) return str.toLowerCase().trim();
      return Array.from(str.toLowerCase().trim())
        .map((char) => {
          const idx = dict.t.indexOf(char);
          return idx > -1 ? (dict.s[idx] ?? char) : char;
        })
        .join('');
    },
    [dict],
  );

  const fullFilteredList = useMemo(() => {
    let list = getFilteredList(items, searchQuery, selectedTags, normalize);
    if (showOnlyFavs) list = list.filter((item) => favorites.includes(item.id));
    return list;
  }, [items, searchQuery, selectedTags, normalize, showOnlyFavs, favorites]);

  const totalPages = Math.max(1, Math.ceil(fullFilteredList.length / PAGE_SIZE));
  const pagedList = useMemo(
    () => fullFilteredList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [fullFilteredList, currentPage],
  );
  const dynamicTagGroups = useMemo(
    () => calculateDynamicTags(items, CATEGORIES, selectedTags),
    [items, selectedTags],
  );

  useEffect(() => setCurrentPage(1), [selectedTags, searchQuery, showOnlyFavs]);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  // 深链 `?sub-*` 与浏览器前进/后退（仅接受规范 sub-id）。
  useEffect(() => {
    const applyFromUrl = () => {
      const subId = parseSubIdFromSearch(window.location.search);
      if (subId) {
        const target = items.find((item) => item.sub_id === subId) ?? null;
        setDetailItem(target);
        document.title = target?.name ? `${target.name} - OpenST 档案馆` : 'OpenST Archive';
      } else {
        setDetailItem(null);
        document.title = 'OpenST Archive';
      }
    };
    applyFromUrl();
    window.addEventListener('popstate', applyFromUrl);
    return () => window.removeEventListener('popstate', applyFromUrl);
  }, [items]);

  useEffect(() => {
    console.log(
      '%c如果你并非网页开发人员，请勿在控制台内输入任何人传给你的脚本！\n%c在控制台输入脚本可能会让攻击者盗取你的 GitHub 访问令牌（Token），从而控制你的仓库或篡改数据。',
      'color: #333; font-size: 16px; font-weight: bold;',
      'color: red; font-size: 14px;',
    );
  }, []);

  const toggleTag = (cat: string, tag: string) => {
    setSelectedTags((prev) => {
      const list = prev[cat] ?? [];
      return { ...prev, [cat]: list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag] };
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedTags(emptySelection());
    setShowOnlyFavs(false);
    setCurrentPage(1);
    setSidebarOpen(false);
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  };

  const setPage = (p: number | string) => {
    const pageIdx = parseInt(String(p), 10);
    if (!Number.isNaN(pageIdx) && pageIdx >= 1 && pageIdx <= totalPages) {
      setCurrentPage(pageIdx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const openDetail = (item: ArchiveItem) => {
    setDetailItem(item);
    if (item.sub_id) {
      window.history.pushState({ subId: item.sub_id }, '', `${window.location.pathname}?${item.sub_id}`);
      if (item.name) document.title = `${item.name} - OpenST Archive`;
    }
  };

  const closeDetail = () => {
    setDetailItem(null);
    window.history.pushState({}, '', window.location.pathname);
    document.title = 'OpenST Archive';
  };

  const openEdit = (item: ArchiveItem) => {
    if (!item?.id) return;
    window.location.href = `/admin_tools/admin_edit?folder=${encodeURIComponent(item.id.trim())}`;
  };

  const downloadLink = (item: ArchiveItem): string => {
    const id = item.sub_id || item.id;
    return id ? `/api/download?id=${encodeURIComponent(id)}` : '';
  };

  const open3DPreview = (item: ArchiveItem) => {
    const fileUrl = downloadLink(item);
    if (fileUrl) window.open(`/Extra-Function/litematic-preview#${fileUrl}`, '_blank');
  };

  const handleImageZoom = (url: string, name: string) => {
    setZoomImage({ url, name });
    document.body.style.overflow = 'hidden';
  };

  const closeZoom = () => {
    setZoomImage(null);
    document.body.style.overflow = '';
  };

  const toggleFavorite = (itemId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      try {
        localStorage.setItem(FAVS_KEY, JSON.stringify(next));
      } catch {
        /* localStorage 不可用时忽略 */
      }
      return next;
    });
  };

  return (
    <div className="bg-dark text-white overflow-hidden font-sans flex flex-col h-screen h-[100dvh] archive-page">
      <div style={{ display: 'none' }} aria-hidden="true">
        <h1>OpenST 档案馆 - Minecraft 存储科技投影下载</h1>
        <p>汇集 1.16/1.21+ 版本最前沿的存储技术，包括全物品仓库、编码单片、自动打包机等。</p>
        <nav>
          <span>分类：非编码存储, 潜影盒处理, 编码科技, 生产合成</span>
        </nav>
      </div>

      <NavBar
        user={user}
        isAdmin={isAdmin}
        onLogin={() => void signIn('github', '/archive')}
        onLogout={() => void signOut('/archive')}
        onOpenMenu={() => setSidebarOpen(true)}
      />

      <div className="flex flex-1 overflow-hidden relative">
        <SideBar
          categories={CATEGORIES}
          groups={dynamicTagGroups}
          selected={selectedTags}
          search={searchQuery}
          onSearchChange={setSearchQuery}
          onToggleTag={toggleTag}
          showOnlyFavs={showOnlyFavs}
          onToggleShowOnlyFavs={() => setShowOnlyFavs((v) => !v)}
          favoritesCount={favorites.length}
          onReset={resetFilters}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 p-6 pb-[20vh] overflow-y-auto bg-dark" id="main-content">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start">
            <a
              href="/upload"
              className="flex flex-col h-full min-h-[320px] items-center justify-center p-6 rounded-[20px] bg-panel/30 border-2 border-dashed border-white/10 hover:border-brand/50 hover:bg-brand/5 transition-all group lg:col-span-2 xl:col-span-1"
            >
              <div className="flex flex-col lg:flex-row xl:flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-brand/10 flex items-center justify-center text-3xl group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                  🚀
                </div>
                <div className="text-center lg:text-left xl:text-center">
                  <h3 className="text-lg font-bold text-white tracking-tight">贡献你的机器</h3>
                  <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                    欢迎分享你的作品
                    <br />
                    点击前往投递系统
                  </p>
                </div>
              </div>
            </a>

            {pagedList.map((item) => (
              <ArchiveCard
                key={item.id}
                item={{ ...item, preview: getSafePath(item.preview) }}
                isAdmin={isAdmin}
                isFav={favorites.includes(item.id)}
                onOpen={() => openDetail(item)}
                onEdit={() => openEdit(item)}
                onToggleFav={() => toggleFavorite(item.id)}
              />
            ))}
          </div>

          {fullFilteredList.length > 0 ? (
            <div className="mt-16 mb-32 flex flex-col items-center gap-8">
              <div className="flex items-center gap-4">
                <div className="h-px w-12 bg-gradient-to-r from-transparent to-white/10" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">Discovery</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-white leading-none tracking-tighter">{fullFilteredList.length}</span>
                    <span className="text-[10px] text-brand font-bold uppercase tracking-wider">Archives Found</span>
                  </div>
                </div>
                <div className="h-px w-12 bg-gradient-to-l from-transparent to-white/10" />
              </div>

              {totalPages > 1 ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="上一页"
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-brand hover:text-black disabled:opacity-0 transition-all duration-300"
                    >
                      ‹
                    </button>

                    <div className="flex items-center gap-3 px-4 py-2 bg-black/40 border border-white/5 rounded-2xl">
                      <input
                        key={currentPage}
                        type="number"
                        defaultValue={currentPage}
                        aria-label="跳转页码"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setPage((e.target as HTMLInputElement).value);
                        }}
                        onBlur={(e) => setPage(e.target.value)}
                        className="w-8 bg-transparent text-center text-lg font-black text-brand outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-white/10 font-light text-xl">/</span>
                      <span className="text-gray-500 text-sm font-bold tracking-tighter">{totalPages}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      aria-label="下一页"
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:bg-brand hover:text-black disabled:opacity-0 transition-all duration-300"
                    >
                      ›
                    </button>
                  </div>
                  <span className="text-[9px] text-gray-700 font-bold uppercase tracking-[0.4em] ml-1">Navigate System</span>
                </div>
              ) : null}
            </div>
          ) : items.length === 0 ? (
            <StatusPanel
              variant="error"
              title="稿件数据暂不可用"
              description="数据库为空或加载失败，请稍后重试"
              onRetry={() => window.location.reload()}
            />
          ) : (
            <StatusPanel variant="empty" title="没有找到符合条件的机器..." description="尝试清除筛选或更换搜索关键词" />
          )}
        </main>
      </div>

      {detailItem ? (
        <ErrorBoundary>
          <DetailModal
            item={{ ...detailItem, preview: getSafePath(detailItem.preview) }}
            isAdmin={isAdmin}
            useProxy={useProxy}
            onToggleProxy={setUseProxy}
            onClose={closeDetail}
            onEdit={() => openEdit(detailItem)}
            on3DPreview={() => open3DPreview(detailItem)}
            onImageZoom={handleImageZoom}
          />
        </ErrorBoundary>
      ) : null}

      {zoomImage ? (
        <ErrorBoundary>
          <ImageZoom url={zoomImage.url} name={zoomImage.name} onClose={closeZoom} />
        </ErrorBoundary>
      ) : null}

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toJsonLd({
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'OpenST Archive',
            url: 'https://openstmc.com',
            potentialAction: {
              '@type': 'SearchAction',
              target: 'https://openstmc.com/archive?search={search_term_string}',
              'query-input': 'required name=search_term_string',
            },
          }),
        }}
      />
    </div>
  );
}
