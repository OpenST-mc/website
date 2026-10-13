import { useEffect, useRef, useState, type RefObject } from 'react';

// 与旧 v-lazy 一致：进入视口才加载，离开视口释放（避免内存占用）。
export function useLazyImage(
  src: string,
  rootMargin = '300px',
): { ref: RefObject<HTMLImageElement | null>; src: string | undefined; visible: boolean } {
  const ref = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setVisible(entry.isIntersecting);
      },
      { rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, src: visible ? src : undefined, visible };
}
