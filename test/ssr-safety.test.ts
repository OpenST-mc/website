// @vitest-environment node
// SSR/水合安全门：在纯 Node（无 jsdom 全局）下渲染页面与组件。
// 任何渲染期访问 window/document/localStorage/navigator 都会在此抛 ReferenceError。
import { describe, it, expect } from 'vitest';
import { createElement, type ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import IndexPage from '../src/pages/index/+Page.tsx';
import HealthPage from '../src/pages/health/+Page.tsx';
import UploadPage from '../src/pages/upload/+Page.tsx';
import AdminToolsPage from '../src/pages/admin_tools/+Page.tsx';
import AdminEditPage from '../src/pages/admin_tools/admin_edit/+Page.tsx';
import CreditsPage from '../src/pages/credits/+Page.tsx';
import ConverterPage from '../src/pages/litematic-converter/+Page.tsx';
import PreviewPage from '../src/pages/litematic-preview/+Page.tsx';
import { NavBar } from '../src/components/NavBar.tsx';
import { SideBar } from '../src/components/SideBar.tsx';
import { ArchiveCard } from '../src/components/ArchiveCard.tsx';
import { DetailModal } from '../src/components/DetailModal.tsx';
import { ImageZoom } from '../src/components/ImageZoom.tsx';
import { ErrorBoundary } from '../src/components/ErrorBoundary.tsx';
import { Toaster } from '../src/components/Toaster.tsx';
import { StatusPanel } from '../src/components/StatusPanel.tsx';
import type { ArchiveItem } from '../src/lib/types.ts';

const noop = (): void => {};
const item: ArchiveItem = {
  id: 'a1',
  name: '测试机器',
  author: 'Alice',
  tags: ['合成站'],
  description: '**bold**',
  category: '生产/合成',
  preview: '/content/x/preview.webp',
  filename: 'x.litematic',
  sub_id: 'sub-1',
};

const PAGES: Array<[string, ComponentType]> = [
  ['index', IndexPage],
  ['health', HealthPage],
  ['upload', UploadPage],
  ['admin_tools', AdminToolsPage],
  ['admin_tools/admin_edit', AdminEditPage],
  ['credits', CreditsPage],
  ['litematic-converter', ConverterPage],
  ['litematic-preview', PreviewPage],
];

describe('SSR without browser globals', () => {
  for (const [name, Page] of PAGES) {
    it(`renders ${name} without touching browser globals`, () => {
      const html = renderToString(createElement(Page));
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(0);
    });
  }

  it('renders global components without browser globals', () => {
    expect(
      renderToString(
        createElement(ErrorBoundary, null, createElement(NavBar, {
          user: null,
          isAdmin: false,
          onLogin: noop,
          onLogout: noop,
          onOpenMenu: noop,
        })),
      ),
    ).toContain('GitHub 登录');

    expect(
      renderToString(
        createElement(SideBar, {
          categories: ['生产/合成'],
          groups: {},
          selected: {},
          search: '',
          onSearchChange: noop,
          onToggleTag: noop,
          showOnlyFavs: false,
          onToggleShowOnlyFavs: noop,
          favoritesCount: 0,
          onReset: noop,
          isOpen: false,
          onClose: noop,
        }),
      ),
    ).toContain('搜索存档');

    expect(
      renderToString(
        createElement(ArchiveCard, {
          item,
          isAdmin: false,
          isFav: false,
          onOpen: noop,
          onEdit: noop,
          onToggleFav: noop,
        }),
      ),
    ).toContain('测试机器');

    expect(
      renderToString(
        createElement(DetailModal, {
          item,
          isAdmin: false,
          useProxy: true,
          onToggleProxy: noop,
          onClose: noop,
          onEdit: noop,
          on3DPreview: noop,
          onImageZoom: noop,
        }),
      ),
    ).toContain('下载文件');

    expect(renderToString(createElement(ImageZoom, { url: '/x.png', name: 'x', onClose: noop }))).toContain('/x.png');
    expect(renderToString(createElement(StatusPanel, { variant: 'empty', title: '空' }))).toContain('空');
    // Toaster 的 server 快照必须为空：SSG 首屏与客户端首帧一致（无水合差异）。
    expect(renderToString(createElement(Toaster))).toBe('');
  });
});
