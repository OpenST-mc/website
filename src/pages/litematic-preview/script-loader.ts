// 按需加载 vendor 经典脚本（deepslate/gl-matrix/resource），同一 src 只加载一次。
const pending = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
  const existing = pending.get(src);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener('error', () => reject(new Error(`脚本加载失败: ${src}`)), { once: true });
    document.head.appendChild(script);
  });

  pending.set(src, promise);
  return promise;
}
