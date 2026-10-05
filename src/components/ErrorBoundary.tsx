import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// 页面级错误边界：渲染期抛错时展示可重试的降级 UI，不白屏。
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-black text-gray-300 p-6">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-white">页面渲染出错</h1>
            <p className="text-sm text-gray-500 break-all">{this.state.error.message}</p>
            <button
              type="button"
              onClick={this.reset}
              className="px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition"
            >
              重试
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
