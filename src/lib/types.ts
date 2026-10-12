// 领域类型集中定义。

/** 稿件条目（对应 archive/data/database.json 的元素）。 */
export interface ArchiveItem {
  id: string;
  name: string;
  author: string;
  tags: string[];
  description: string;
  category: string;
  preview: string;
  filename: string;
  sub_id: string;
}

/** 繁→简映射（STCharacters.txt 解析结果，扁平对应数组）。 */
export interface ArchiveDict {
  s: string[];
  t: string[];
}

/** /archive 页构建期注入数据。 */
export interface ArchiveData {
  items: ArchiveItem[];
  dict: ArchiveDict;
}

/** Auth.js 会话中的用户资料（HttpOnly Cookie 之外可读的非敏感部分）。 */
export interface SessionUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  isAdmin?: boolean;
}

/** Auth.js 会话（/api/auth/session 响应）。 */
export interface Session {
  user?: SessionUser;
  expires?: string;
}

/** CF Worker / Vercel 代理写操作的统一结果（判别联合：ok 收窄）。 */
export interface WorkerResponseOk {
  ok: true;
  status: number;
  text: string;
  json?: unknown;
}

export interface WorkerResponseErr {
  ok: false;
  status: number;
  text: string;
  json?: unknown;
}

export type WorkerResponse = WorkerResponseOk | WorkerResponseErr;

/** /api/archive-upload 中继响应。 */
export interface WorkerUploadResponse {
  downloadUrl?: string;
  filePath?: string;
}

/** /api/stats 下载计数响应。 */
export interface DownloadStats {
  count: number;
}
