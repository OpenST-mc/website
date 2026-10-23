// 统一 HTTP 封装：超时（AbortController）、错误归一（HttpError）、
// 幂等 GET 有限重试 + 退避；写操作绝不自动重试。浏览器/CJS/SSG 语法均安全。

export type HttpErrorCode = 'timeout' | 'aborted' | 'network' | 'invalid-json';

export class HttpError extends Error {
  readonly code: HttpErrorCode;
  readonly status: number;
  readonly url: string;

  constructor(message: string, options: { code: HttpErrorCode; url: string; status?: number; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = 'HttpError';
    this.code = options.code;
    this.status = options.status ?? 0;
    this.url = options.url;
  }
}

export interface HttpOptions extends RequestInit {
  /** 单次尝试的超时（ms），默认 10000。 */
  timeoutMs?: number;
  /** 幂等请求的重试次数（不含首次），默认 0。 */
  retries?: number;
  /** 首次退避间隔（ms），按 ×2 递增，默认 300。 */
  retryDelayMs?: number;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt(url: string, timeoutMs: number, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const external = init.signal;
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = (): void => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener('abort', onExternalAbort, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new HttpError(`请求超时（${timeoutMs}ms）`, { code: 'timeout', url, cause: error });
    if (external?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
      throw new HttpError('请求已取消', { code: 'aborted', url, cause: error });
    }
    throw new HttpError('网络请求失败', { code: 'network', url, cause: error });
  } finally {
    clearTimeout(timer);
    external?.removeEventListener('abort', onExternalAbort);
  }
}

/** fetch + 超时 + 归一错误；GET/HEAD 可配置有限重试，写方法只执行一次。 */
export async function httpFetch(url: string, options: HttpOptions = {}): Promise<Response> {
  const { timeoutMs = 10000, retries = 0, retryDelayMs = 300, ...init } = options;
  const method = (init.method ?? 'GET').toUpperCase();
  const idempotent = method === 'GET' || method === 'HEAD';
  const maxAttempts = idempotent ? Math.max(1, retries + 1) : 1;

  let lastError: unknown;
  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
    if (attemptIndex > 0) await sleep(retryDelayMs * 2 ** (attemptIndex - 1));
    try {
      const response = await attempt(url, timeoutMs, init);
      if (idempotent && response.status >= 500 && attemptIndex < maxAttempts - 1) continue;
      return response;
    } catch (error) {
      lastError = error;
      const retryable = error instanceof HttpError && error.code === 'network';
      if (!retryable || attemptIndex === maxAttempts - 1) throw error;
    }
  }
  throw lastError;
}

/** 读取 JSON；非 JSON 响应抛 HttpError（成功状态也不例外，避免“假成功”）。 */
export async function fetchJson<T = unknown>(
  url: string,
  options: HttpOptions = {},
): Promise<{ data: T; response: Response }> {
  const response = await httpFetch(url, options);
  const text = await response.text();
  try {
    return { data: JSON.parse(text) as T, response };
  } catch (error) {
    throw new HttpError('响应不是合法 JSON', {
      code: 'invalid-json',
      url,
      status: response.status,
      cause: error,
    });
  }
}

/** 宽松 JSON 读取：失败返回 undefined，绝不抛错（用于允许降级的可选数据）。 */
export async function readJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
