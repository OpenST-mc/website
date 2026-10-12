import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ArchiveCard } from '../src/components/ArchiveCard';
import { SideBar } from '../src/components/SideBar';
import { DetailModal } from '../src/components/DetailModal';
import type { ArchiveItem } from '../src/lib/types';

class MockIntersectionObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

const item: ArchiveItem = {
  id: 'a1',
  name: '测试机器',
  author: 'Alice',
  tags: ['合成站', '1.21.x'],
  description: '<script>alert(1)</script>\n\n**bold**',
  category: '生产/合成',
  preview: '/content/x/preview.webp',
  filename: 'x.litematic',
  sub_id: 'sub-1',
};

describe('ArchiveCard', () => {
  it('shows name/author and emits fav/ open events', () => {
    const onToggleFav = vi.fn();
    const onOpen = vi.fn();
    render(
      <ArchiveCard item={item} isAdmin={false} isFav={false} onOpen={onOpen} onEdit={() => {}} onToggleFav={onToggleFav} />,
    );
    expect(screen.getByText('测试机器')).toBeTruthy();
    expect(screen.getByText('by Alice')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('收藏'));
    expect(onToggleFav).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('测试机器'));
    expect(onOpen).toHaveBeenCalled();
  });

  it('exposes the admin edit action only for admins', () => {
    const onEdit = vi.fn();
    const { rerender } = render(
      <ArchiveCard item={item} isAdmin={false} isFav onOpen={() => {}} onEdit={onEdit} onToggleFav={() => {}} />,
    );
    expect(screen.queryByLabelText('编辑稿件')).toBeNull();
    rerender(<ArchiveCard item={item} isAdmin isFav onOpen={() => {}} onEdit={onEdit} onToggleFav={() => {}} />);
    fireEvent.click(screen.getByLabelText('编辑稿件'));
    expect(onEdit).toHaveBeenCalled();
  });
});

describe('SideBar', () => {
  it('emits search changes and shows reset when filtered', () => {
    const onSearchChange = vi.fn();
    const onReset = vi.fn();
    render(
      <SideBar
        categories={['生产/合成']}
        groups={{ '生产/合成': new Set(['合成站']) }}
        selected={{ '生产/合成': ['合成站'] }}
        search="abc"
        onSearchChange={onSearchChange}
        onToggleTag={() => {}}
        showOnlyFavs={false}
        onToggleShowOnlyFavs={() => {}}
        favoritesCount={2}
        onReset={onReset}
        isOpen={false}
        onClose={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText('搜索存档/作者/简介/标签...'), { target: { value: 'xyz' } });
    expect(onSearchChange).toHaveBeenCalledWith('xyz');
    fireEvent.click(screen.getByText('清除所有筛选'));
    expect(onReset).toHaveBeenCalled();
  });
});

describe('DetailModal', () => {
  it('sanitizes markdown and builds the counted download href', () => {
    render(
      <DetailModal
        item={item}
        isAdmin={false}
        useProxy
        onToggleProxy={() => {}}
        onClose={() => {}}
        onEdit={() => {}}
        on3DPreview={() => {}}
        onImageZoom={() => {}}
      />,
    );
    expect(document.body.innerHTML).not.toContain('<script>alert');
    expect(screen.getByText('bold')).toBeTruthy();
    expect(screen.getByText('下载文件').closest('a')?.getAttribute('href')).toBe('/api/download?id=sub-1');
  });
});
