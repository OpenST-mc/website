import { useCallback, useEffect, useState } from 'react';
import { getSession, type Session, type SessionUser } from '../lib/auth';

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

  const refresh = useCallback(() => {
    setStatus('loading');
    getSession()
      .then((s) => {
        setSession(s);
        setStatus(s?.user ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
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
