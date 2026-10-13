import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpFetch, fetchJson, readJsonSafe, HttpError } from '../src/lib/http.ts';

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('httpFetch', () => {
  it('returns the response on success and normalizes no error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ a: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await httpFetch('/x');
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('aborts on timeout with code=timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }),
    );

    const p = httpFetch('/slow', { timeoutMs: 50 });
    const assertion = expect(p).rejects.toMatchObject({ name: 'HttpError', code: 'timeout' });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });

  it('maps network failures to code=network', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(httpFetch('/x')).rejects.toMatchObject({ name: 'HttpError', code: 'network' });
  });

  it('respects caller cancellation with code=aborted', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    await expect(httpFetch('/x', { signal: ctrl.signal })).rejects.toMatchObject({ code: 'aborted' });
  });

  it('retries idempotent GET on network errors with backoff', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('down'))
      .mockRejectedValueOnce(new TypeError('down'))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await httpFetch('/retry', { retries: 2, retryDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never retries non-idempotent writes', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('down'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(httpFetch('/post', { method: 'POST', retries: 3, retryDelayMs: 1 })).rejects.toMatchObject({
      code: 'network',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries GET on 5xx then returns the last response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ err: true }, 502))
      .mockResolvedValueOnce(jsonResponse({ err: true }, 503));
    vi.stubGlobal('fetch', fetchMock);

    const res = await httpFetch('/flaky', { retries: 1, retryDelayMs: 1 });
    expect(res.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('fetchJson', () => {
  it('parses JSON and surfaces the response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ session: null })));
    const { data, response } = await fetchJson<{ session: null }>('/api/auth/session');
    expect(data).toEqual({ session: null });
    expect(response.ok).toBe(true);
  });

  it('throws code=invalid-json for non-JSON bodies (no false success)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(new Response('<html>err</html>', { status: 200 }))),
    );
    await expect(fetchJson('/x')).rejects.toBeInstanceOf(HttpError);
    await expect(fetchJson('/x')).rejects.toMatchObject({ code: 'invalid-json' });
  });
});

describe('readJsonSafe', () => {
  it('returns parsed JSON or undefined, never throws', async () => {
    expect(await readJsonSafe(jsonResponse({ a: 1 }))).toEqual({ a: 1 });
    expect(await readJsonSafe(new Response('not json', { status: 200 }))).toBeUndefined();
    expect(await readJsonSafe(new Response(null, { status: 204 }))).toBeUndefined();
  });
});
