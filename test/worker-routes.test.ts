import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

interface OpenSTWorker {
  fetch(request: Request, env: Record<string, unknown>): Promise<Response>;
}

const workerUrl = pathToFileURL(path.resolve(process.cwd(), 'workers', 'src', 'index.js')).href;
const { default: worker } = (await import(/* @vite-ignore */ workerUrl)) as { default: OpenSTWorker };

function call(pathname: string, init: RequestInit = {}): Promise<Response> {
  return worker.fetch(new Request(`https://api.openstmc.com${pathname}`, init), {});
}

describe('worker routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('answers CORS preflight with allow-listed origin', async () => {
    const res = await call('/api/admin/update-info', {
      method: 'OPTIONS',
      headers: { origin: 'https://openstmc.com' },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://openstmc.com');
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('returns an anonymous session without a token', async () => {
    const res = await call('/api/session');
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ user: null, isAdmin: false });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('rejects admin writes without a token', async () => {
    const res = await call('/api/admin/update-info', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ folder: '测试机器', newInfo: {} }),
    });
    expect(res.status).toBe(401);
    await expect(res.text()).resolves.toBe('Missing Token');
  });

  it('rejects an invalid proxy signature header', async () => {
    const res = await call('/api/admin/update-info', {
      method: 'POST',
      headers: { 'x-openst-proxy-sig': 'bad' },
    });
    expect(res.status).toBe(403);
    await expect(res.text()).resolves.toBe('Invalid proxy signature');
  });

  it('reports health with CORS headers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ status: { description: 'All Systems Operational' } }))),
    );
    const res = await call('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; upstream: string };
    expect(body.status).toBe('Operational');
    expect(body.upstream).toBe('All Systems Operational');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });

  it('returns the fallback text for unknown paths', async () => {
    const res = await call('/');
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe('OpenST Hub Online');
  });
});
