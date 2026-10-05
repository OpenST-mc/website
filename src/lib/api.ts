// 管理员端点封装：走同源 Vercel 代理 /api/admin/*（T3.1 方案 B），
// 由代理校验 Auth.js 会话并以服务签名转发 CF Worker。

export interface AdminResult {
  ok: boolean;
  status: number;
  text: string;
  json?: unknown;
}

async function post(path: string, body: BodyInit, isJson: boolean): Promise<AdminResult> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: isJson ? { 'Content-Type': 'application/json' } : undefined,
    body,
  });
  const text = await res.text();
  let json: unknown;
  if (res.headers.get('content-type')?.includes('application/json')) {
    try {
      json = JSON.parse(text);
    } catch {
      /* 非 JSON 保持 undefined */
    }
  }
  return { ok: res.ok, status: res.status, text, json };
}

export function updateInfo(folder: string, newInfo: unknown): Promise<AdminResult> {
  return post('/api/admin/update-info', JSON.stringify({ folder, newInfo }), true);
}

export function deleteArchive(folder: string): Promise<AdminResult> {
  return post('/api/admin/delete-archive', JSON.stringify({ folder }), true);
}

export function replaceLitematic(file: File, folder: string): Promise<AdminResult> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  return post('/api/admin/replace-litematic', fd, false);
}

export function updatePreview(file: File, folder: string): Promise<AdminResult> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('folder', folder);
  return post('/api/admin/update-preview', fd, false);
}
