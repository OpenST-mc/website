import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Toaster } from '../src/components/Toaster.tsx';
import { StatusPanel } from '../src/components/StatusPanel.tsx';
import { notify, resetNotices } from '../src/lib/notify.ts';

afterEach(() => {
  cleanup();
  resetNotices();
  vi.useRealTimers();
});

describe('notify store', () => {
  it('adds notices and auto-dismisses after the hold window', () => {
    vi.useFakeTimers();
    render(<Toaster />);
    act(() => {
      notify('success', '保存成功');
    });
    expect(screen.getByText('保存成功')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(6001);
    });
    expect(screen.queryByText('保存成功')).toBeNull();
  });

  it('renders multiple notices and closes one without touching the others', () => {
    render(<Toaster />);
    act(() => {
      notify('error', '网络错误');
      notify('info', '提示信息');
    });
    expect(screen.getAllByLabelText('关闭通知')).toHaveLength(2);

    fireEvent.click(screen.getAllByLabelText('关闭通知')[0]!);
    expect(screen.queryByText('网络错误')).toBeNull();
    expect(screen.getByText('提示信息')).toBeTruthy();
  });

  it('uses role=alert for errors and role=status otherwise', () => {
    render(<Toaster />);
    act(() => {
      notify('error', '出错了');
    });
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('StatusPanel', () => {
  it('renders empty/loading/error variants with an optional retry action', () => {
    const onRetry = vi.fn();
    render(<StatusPanel variant="error" title="加载失败" description="请检查网络" onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
