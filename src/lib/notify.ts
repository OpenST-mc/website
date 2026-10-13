// 全局轻量通知：替代裸 alert 的统一用户反馈。
// 仅客户端使用（模块导入无浏览器全局依赖），通过 useSyncExternalStore 订阅。

export type NoticeKind = 'info' | 'success' | 'error';

export interface Notice {
  id: number;
  kind: NoticeKind;
  message: string;
}

const HOLD_MS: Record<NoticeKind, number> = { info: 6000, success: 6000, error: 10000 };

let snapshot: readonly Notice[] = [];
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let nextId = 1;

function emit(): void {
  for (const listener of listeners) listener();
}

export function notify(kind: NoticeKind, message: string): number {
  const id = nextId++;
  snapshot = [...snapshot, { id, kind, message }];
  timers.set(
    id,
    setTimeout(() => dismissNotice(id), HOLD_MS[kind]),
  );
  emit();
  return id;
}

export function dismissNotice(id: number): void {
  const timer = timers.get(id);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(id);
  }
  const next = snapshot.filter((notice) => notice.id !== id);
  if (next.length !== snapshot.length) {
    snapshot = next;
    emit();
  }
}

export function getNotices(): readonly Notice[] {
  return snapshot;
}

export function subscribeNotices(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** SSG/首屏的稳定空快照（保证无水合差异）。 */
export const EMPTY_NOTICES: readonly Notice[] = [];

/** 测试辅助：清空全部通知与待触发计时器。 */
export function resetNotices(): void {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  snapshot = [];
  emit();
}
