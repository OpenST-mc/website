import type { ReactNode } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';

// 根布局：为所有页面提供错误边界。
export default function Layout({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
