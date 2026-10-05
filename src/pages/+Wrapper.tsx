import type { ReactNode } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';

// 全局包装：所有页面套页面级错误边界。
export default function Wrapper({ children }: { children: ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
