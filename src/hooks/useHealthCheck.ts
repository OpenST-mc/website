import { useCallback, useEffect, useRef, useState } from 'react';
import { httpFetch, readJsonSafe } from '../lib/http';
import { notify } from '../lib/notify';
import { parseHealthExtra } from '../lib/schema';

const PORTAL_URL = 'https://openst.qzz.io/archive/不要动这是占位符！.txt';
const API_HEALTH_URL = 'https://openstsubmission.linvin.net/health';
const CDN_HEALTH_URL = 'https://cdn.linvin.net/gh/OpenST-mc/archive@main/README.md';

export type EndpointStatus = 'unknown' | 'online' | 'offline';
export type OverallStatus = 'loading' | 'operational' | 'partial_outage' | 'major_outage' | 'offline';

export interface EndpointState {
  status: EndpointStatus;
  ping: number | null;
}

export interface HealthData {
  portal: EndpointState;
  api: EndpointState & { region?: string; upstream?: string };
  cdn: EndpointState;
}

const INITIAL: HealthData = {
  portal: { status: 'unknown', ping: null },
  api: { status: 'unknown', ping: null },
  cdn: { status: 'unknown', ping: null },
};

export interface HealthCheck {
  data: HealthData;
  overall: OverallStatus;
  refresh: () => void;
  copyDebug: () => void;
}

// 系统状态拨测：主站 / API / CDN，30s 轮询。副作用限定在 effect；失败有统一提示。
export function useHealthCheck(): HealthCheck {
  const [data, setData] = useState<HealthData>(INITIAL);
  const [overall, setOverall] = useState<OverallStatus>('loading');
  const dataRef = useRef(data);
  dataRef.current = data;
  const inFlight = useRef(false);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setOverall('offline');
        return;
      }

      const vStart = Date.now();
      const portalPromise = httpFetch(PORTAL_URL, { mode: 'no-cors', cache: 'no-store', timeoutMs: 6000, retries: 1 })
        .then((): EndpointState => ({ status: 'online', ping: Date.now() - vStart }))
        .catch((): EndpointState => ({ status: 'offline', ping: null }));

      const wStart = Date.now();
      const apiPromise = httpFetch(API_HEALTH_URL, { cache: 'no-store', timeoutMs: 6000, retries: 1 })
        .then(readJsonSafe)
        .then((raw): HealthData['api'] => {
          const extra = parseHealthExtra(raw);
          return { status: 'online', ping: Date.now() - wStart, ...extra };
        })
        .catch((): HealthData['api'] => ({ status: 'offline', ping: null }));

      const cStart = Date.now();
      const cdnPromise = httpFetch(CDN_HEALTH_URL, { mode: 'no-cors', cache: 'no-store', timeoutMs: 6000, retries: 1 })
        .then((): EndpointState => ({ status: 'online', ping: Date.now() - cStart }))
        .catch((): EndpointState => ({ status: 'offline', ping: null }));

      const [portal, api, cdn] = await Promise.all([portalPromise, apiPromise, cdnPromise]);
      setData({ portal, api, cdn });

      if (portal.status === 'online' && api.status === 'online' && cdn.status === 'online') setOverall('operational');
      else if (portal.status === 'offline' && api.status === 'offline' && cdn.status === 'offline')
        setOverall('major_outage');
      else setOverall('partial_outage');
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    void check();
    const id = window.setInterval(() => void check(), 30000);
    return () => window.clearInterval(id);
  }, [check]);

  const copyDebug = useCallback(() => {
    const d = dataRef.current;
    const info = `OpenST Status Report\n---\nPortal: ${d.portal.status === 'online' ? `${d.portal.ping}ms` : 'Error'}\nAPI: ${d.api.status === 'online' ? `${d.api.ping}ms` : 'Error'}\nNode: ${d.api.region || 'Unknown'}\nUpstream: ${d.api.upstream || 'Unknown'}\nTime: ${new Date().toISOString()}`;
    navigator.clipboard
      .writeText(info)
      .then(() => notify('success', '诊断信息已复制到剪贴板'))
      .catch(() => notify('error', '复制失败，请检查浏览器剪贴板权限'));
  }, []);

  return { data, overall, refresh: () => void check(), copyDebug };
}
