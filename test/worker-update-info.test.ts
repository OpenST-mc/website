import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Worker 源码入口（Wrangler 负责打包部署）。
// 这里在测试内声明最小形状，并用动态 import 加载，避免额外维护 .d.ts 文件。
interface OpenSTWorker {
  fetch(request: Request, env: Record<string, unknown>): Promise<Response>;
}

const workerUrl = pathToFileURL(path.resolve(process.cwd(), 'workers', 'src', 'index.js')).href;
const { default: worker } = (await import(/* @vite-ignore */ workerUrl)) as { default: OpenSTWorker };

const INDEX = [
  {
    id: 'sub-1',
    category: '其他杂物',
    preview: '/content/其他杂物/测试机器/preview.webp',
  },
];

const EXISTING = {
  id: 'sub-1',
  name: '旧名字',
  author: '作者',
  tags: ['其他杂物'],
  description: 'old',
  folder: '测试机器',
  preview: 'preview.webp',
  filename: 'old.litematic',
  submitDate: '2026-01-01T00:00:00.000Z',
};

function toBase64(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64');
}

function fromBase64(text: string): string {
  return Buffer.from(text, 'base64').toString('utf8');
}

describe('worker /api/admin/update-info', () => {
  const cache = { match: vi.fn(), put: vi.fn(), delete: vi.fn() };
  let puts: Array<{ url: string; body: Record<string, unknown> }> = [];

  beforeEach(() => {
    puts = [];
    cache.match.mockReset().mockResolvedValue(undefined);
    cache.put.mockReset().mockResolvedValue(undefined);
    cache.delete.mockReset().mockResolvedValue(true);
    vi.stubGlobal('caches', { default: cache });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('raw.githubusercontent.com')) {
          return new Response(JSON.stringify(INDEX), { status: 200 });
        }
        if (url.includes('/contents/') && (!init?.method || init.method === 'GET')) {
          return new Response(JSON.stringify({ content: toBase64(JSON.stringify(EXISTING)), sha: 'sha-1' }), {
            status: 200,
          });
        }
        if (url.includes('/contents/') && init?.method === 'PUT') {
          puts.push({ url, body: JSON.parse(String(init.body)) as Record<string, unknown> });
          return new Response('{}', { status: 200 });
        }
        throw new Error(`unexpected fetch: ${url}`);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function call(newInfo: unknown, folder = '测试机器'): Promise<Response> {
    const request = new Request('https://api.openstmc.com/api/admin/update-info', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test-token' },
      body: JSON.stringify({ folder, newInfo }),
    });
    return worker.fetch(request, {});
  }

  it('merges only editable fields, strips derived fields and preserves submitDate', async () => {
    const res = await call({
      name: '新名字',
      author: '作者',
      tags: ['整流器'],
      description: 'new',
      id: 'sub-hacked',
      folder: 'hacked',
      preview: 'evil.webp',
      filename: 'evil.litematic',
      submitDate: '2099-01-01T00:00:00.000Z',
    });

    expect(res.status).toBe(200);
    expect(puts).toHaveLength(1);

    const written = JSON.parse(fromBase64(String(puts[0]!.body.content))) as Record<string, unknown>;
    expect(written).toEqual({
      name: '新名字',
      author: '作者',
      tags: ['整流器'],
      description: 'new',
      submitDate: EXISTING.submitDate,
    });
    expect(cache.delete).toHaveBeenCalled();
  });

  it('rejects malformed or empty patches without writing', async () => {
    expect((await call({ name: '   ', author: '', tags: [], description: '' })).status).toBe(400);
    expect((await call({ name: 'x', author: 1, tags: [], description: '' })).status).toBe(400);
    expect(puts).toHaveLength(0);
  });
});
