// 领域类型判别联合：ok/err 分支可穷尽收窄（类型层由 tsc 保证，行为层由此测试固定）。
import { describe, it, expect } from 'vitest';
import type { WorkerResponse } from '../src/lib/types.ts';

function describeResult(res: WorkerResponse): string {
  if (res.ok) return `ok:${res.status}`;
  return `err:${res.status}`;
}

describe('WorkerResponse', () => {
  it('narrows the ok branch and carries status/json', () => {
    expect(describeResult({ ok: true, status: 200, text: '{}', json: {} })).toBe('ok:200');
  });

  it('narrows the err branch instead of faking success', () => {
    expect(describeResult({ ok: false, status: 401, text: 'unauthorized' })).toBe('err:401');
  });
});
