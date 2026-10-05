import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// 页面级错误边界：捕获渲染异常并给出可重试的降级 UI。
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div role="alert" className="p-8 text-center text-white">
            <h1 className="text-xl font-bold">页面出错了</h1>
            <p className="mt-2 text-sm text-gray-400">渲染时发生异常，请重试。</p>
            <button
              type="button"
              className="mt-4 rounded bg-white px-4 py-2 text-sm font-medium text-black"
              onClick={() => this.setState({ hasError: false })}
            >
              重试
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
