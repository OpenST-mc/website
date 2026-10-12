import { describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useDialog } from '../src/hooks/useDialog.ts';
import { afterEach } from 'vitest';

afterEach(cleanup);

function Dialog({ onClose }: { onClose: () => void }) {
  const ref = useDialog<HTMLDivElement>(true, onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true" aria-label="测试弹层" tabIndex={-1}>
      <button type="button">第一个</button>
      <button type="button">最后一个</button>
    </div>
  );
}

describe('useDialog', () => {
  it('focuses the first focusable element on open', () => {
    render(<Dialog onClose={() => {}} />);
    expect(document.activeElement?.textContent).toBe('第一个');
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Dialog onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab focus inside the container', () => {
    render(<Dialog onClose={() => {}} />);
    const first = screen.getByText('第一个');
    const last = screen.getByText('最后一个');

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('restores focus to the previously focused element on unmount', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(<Dialog onClose={() => {}} />);
    expect(document.activeElement?.textContent).toBe('第一个');

    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
