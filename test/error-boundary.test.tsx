import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../src/components/ErrorBoundary.tsx';

afterEach(cleanup);

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('boom');
  return <div>safe-content</div>;
}

describe('ErrorBoundary', () => {
  it('shows a retryable fallback instead of a blank page, then recovers on retry', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('页面渲染出错')).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();

    rerender(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(screen.getByText('safe-content')).toBeTruthy();
    consoleError.mockRestore();
  });
});
