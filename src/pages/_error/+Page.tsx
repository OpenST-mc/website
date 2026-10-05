import { usePageContext } from 'vike-react/usePageContext';

// Vike 错误页：404 与运行时错误的统一落点。
export default function Page() {
  const { is404 } = usePageContext();
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center text-white">
      <div>
        <h1 className="text-2xl font-bold">{is404 ? '页面不存在' : '发生错误'}</h1>
        <p className="mt-2 text-sm text-gray-400">{is404 ? '你访问的页面可能已失效。' : '请稍后重试。'}</p>
        <a className="mt-6 inline-block rounded bg-white px-4 py-2 text-sm font-medium text-black" href="/">
          返回首页
        </a>
      </div>
    </main>
  );
}
