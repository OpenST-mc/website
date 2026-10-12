import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 弹层/抽屉的焦点管理：打开时聚焦首个可聚焦元素（或容器本身），
 * Esc 关闭、Tab 焦点陷阱，关闭/卸载时恢复此前焦点。
 */
export function useDialog<T extends HTMLElement>(active: boolean, onClose: () => void): RefObject<T | null> {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const container = ref.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = (): HTMLElement[] => {
      if (!container) return [];
      return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.getAttribute('aria-hidden') !== 'true',
      );
    };

    const firstFocusable = focusables()[0];
    (firstFocusable ?? container)?.focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !container) return;
      const list = focusables();
      if (list.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const current = document.activeElement;
      if (!container.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && (current === first || current === container)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused?.focus();
    };
  }, [active]);

  return ref;
}
