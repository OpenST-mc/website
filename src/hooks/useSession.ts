import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession } from '../lib/auth';
import type { Session, SessionUser } from '../lib/types';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface UseSessionResult {
  user: SessionUser | null;
  isAdmin: boolean;
  status: SessionStatus;
  refresh: () => void;
}

// 会话读取仅发生在客户端（useEffect），不参与 SSG 渲染。
export function useSession(): UseSessionResult {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');
  const requestId = useRef(0);

  const refresh = useCallback(() => {
    const id = ++requestId.current;
    setStatus('loading');
    getSession()
      .then((s) => {
        // 竞态保护：只有最新一次请求的结果可以落地。
        if (requestId.current !== id) return;
        setSession(s);
        setStatus(s?.user ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (requestId.current !== id) return;
        setSession(null);
        setStatus('unauthenticated');
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    user: session?.user ?? null,
    isAdmin: Boolean(session?.user?.isAdmin),
    status,
    refresh,
  };
}
