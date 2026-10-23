import type { ArchiveItem, ArchiveDict, Session, SessionUser, WorkerUploadResponse } from './types.ts';

// 轻量 runtime 校验（不新增依赖；schema 库论证见 T6.1）。

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}

export function isArchiveItem(v: unknown): v is ArchiveItem {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.name === 'string' &&
    typeof o.author === 'string' &&
    isStringArray(o.tags) &&
    typeof o.description === 'string' &&
    typeof o.category === 'string' &&
    typeof o.preview === 'string' &&
    (o.display === undefined || typeof o.display === 'string') &&
    (o.thumb === undefined || typeof o.thumb === 'string') &&
    typeof o.filename === 'string' &&
    typeof o.sub_id === 'string'
  );
}

/** 校验并过滤数据库数组；畸形条目丢弃并告警，不使页面崩溃。 */
export function parseDatabase(raw: unknown): ArchiveItem[] {
  if (!Array.isArray(raw)) {
    console.warn('[schema] database.json 不是数组，已忽略');
    return [];
  }
  const out: ArchiveItem[] = [];
  for (const item of raw) {
    if (isArchiveItem(item)) out.push(item);
    else console.warn('[schema] 跳过畸形稿件条目');
  }
  return out;
}

/** 解析 STCharacters.txt：每行「繁体 简体...」，展开为扁平对应数组。 */
export function parseS2T(text: string): ArchiveDict {
  const s: string[] = [];
  const t: string[] = [];
  text.split(/\r?\n/).forEach((line) => {
    if (!line || line.startsWith('#')) return;
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      parts.slice(1).forEach((simple) => {
        s.push(parts[0]!);
        t.push(simple);
      });
    }
  });
  return { s, t };
}

function parseSessionUser(raw: unknown): SessionUser {
  const o = raw as Record<string, unknown>;
  return {
    name: typeof o.name === 'string' ? o.name : null,
    email: typeof o.email === 'string' ? o.email : null,
    image: typeof o.image === 'string' ? o.image : null,
    isAdmin: o.isAdmin === true,
  };
}

/**
 * 校验 /api/auth/session 响应。未登录（null）返回 null；
 * 结构畸形（user 非对象等）同样按未登录处理，绝不把畸形数据当会话使用。
 */
export function parseSession(raw: unknown): Session | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.user !== undefined && o.user !== null && typeof o.user !== 'object') return null;
  return {
    user: o.user ? parseSessionUser(o.user) : undefined,
    expires: typeof o.expires === 'string' ? o.expires : undefined,
  };
}

/** sub-id 规范格式（与 api/share.js 的服务端校验一致）。 */
const SUB_ID_RE = /^sub-\d+(-\d+)?$/;

export function isSubId(v: unknown): v is string {
  return typeof v === 'string' && SUB_ID_RE.test(v);
}

/** 从 location.search（可带 `?`）中提取合法 sub-id 深链；非法返回 null。 */
export function parseSubIdFromSearch(search: string): string | null {
  const qs = search.startsWith('?') ? search.slice(1) : search;
  return isSubId(qs) ? qs : null;
}

/** 通用查询参数净化：拒绝空、超长与控制字符（`folder` 等自由文本参数用）。 */
export function sanitizeQueryParam(raw: string | null, maxLen = 128): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > maxLen) return null;
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null;
  return raw;
}

const hasControlChars = (v: string): boolean => /[\u0000-\u001f\u007f]/.test(v);

/** 仅接受无控制字符的 https URL，其余一律丢弃。 */
function safeHttpsUrl(v: string): string | null {
  if (hasControlChars(v)) return null;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/**
 * 校验 /api/archive-upload 中继响应。畸形（非对象/字段类型错误/控制字符）返回 null；
 * 非 https 的 downloadUrl 丢弃（调用方回退 /dl/<filePath>）。
 */
export function parseWorkerUpload(raw: unknown): WorkerUploadResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: WorkerUploadResponse = {};
  if (o.downloadUrl !== undefined) {
    if (typeof o.downloadUrl !== 'string') return null;
    if (hasControlChars(o.downloadUrl)) return null;
    const url = safeHttpsUrl(o.downloadUrl);
    if (url) out.downloadUrl = url;
  }
  if (o.filePath !== undefined) {
    if (typeof o.filePath !== 'string') return null;
    if (hasControlChars(o.filePath)) return null;
    out.filePath = o.filePath;
  }
  return out;
}

/** /api/upload-token 响应：短时上传令牌（缺失/畸形按未授权处理）。 */
export interface UploadToken {
  token: string;
  login: string;
}

export function parseUploadToken(raw: unknown): UploadToken | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.token !== 'string' || o.token.length === 0) return null;
  if (typeof o.login !== 'string' || o.login.length === 0) return null;
  return { token: o.token, login: o.login };
}

/** 校验 /api/stats 下载计数：仅接受有限非负数字。 */
export function parseDownloadStats(raw: unknown): number | null {
  if (!raw || typeof raw !== 'object') return null;
  const count = (raw as Record<string, unknown>).count;
  if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) return null;
  return count;
}

/** /health 附加信息（可选字段，仅保留字符串）。 */
export interface HealthExtra {
  region?: string;
  upstream?: string;
}

export function parseHealthExtra(raw: unknown): HealthExtra {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    region: typeof o.region === 'string' ? o.region : undefined,
    upstream: typeof o.upstream === 'string' ? o.upstream : undefined,
  };
}

/** 校验 localStorage 收藏列表：仅保留字符串，畸形回退空数组。 */
export function parseFavoriteIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string');
}

/** 外链白名单：仅放行 https://github.com/... （投稿 Issue 回跳）。 */
export function sanitizeGithubUrl(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const safe = safeHttpsUrl(raw);
  if (!safe) return '';
  const host = new URL(safe).hostname;
  return host === 'github.com' || host.endsWith('.github.com') ? safe : '';
}

/** JSON-LD 安全序列化：转义 `<` 防止 </script> 提前闭合（值为静态数据亦防御）。 */
export function toJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
