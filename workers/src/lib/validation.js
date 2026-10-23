// 管理端请求的字段、文件名与文件夹校验。
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
export const PREVIEW_SOURCE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
export const ARCHIVE_FILE_EXTENSIONS = ['.litematic', '.zip', '.rar'];

// 仅接受 info.json 的人工维护字段；id/folder/preview/filename 等派生字段忽略。
export function normalizeInfoPatch(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const { name, author, tags, description } = raw;
  if (typeof name !== 'string') return null;
  const cleanName = name.trim();
  if (!cleanName || cleanName.length > 200) return null;

  if (typeof author !== 'string' || author.length > 200) return null;

  if (!Array.isArray(tags) || tags.length > 100) return null;
  const cleanTags = [];
  for (const tag of tags) {
    if (typeof tag !== 'string') return null;
    const clean = tag.trim();
    if (!clean || clean.length > 100) return null;
    if (!cleanTags.includes(clean)) cleanTags.push(clean);
  }

  if (typeof description !== 'string' || description.length > 200000) return null;

  return {
    name: cleanName,
    author: author.trim() || '匿名',
    tags: cleanTags,
    description,
  };
}

export function isFileEntry(value) {
  return Boolean(value) && typeof value === 'object' && typeof value.arrayBuffer === 'function';
}

function isSafeFileName(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= 200 &&
    name !== '.' &&
    name !== '..' &&
    !/[\/\\\u0000-\u001f\u007f]/.test(name)
  );
}

export function previewSourceName(name) {
  if (!isSafeFileName(name)) return null;
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  return PREVIEW_SOURCE_EXTENSIONS.includes(ext) ? `preview.${ext}` : null;
}

export function isArchiveFileName(name) {
  return isSafeFileName(name) && ARCHIVE_FILE_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext));
}

// 校验稿件文件夹名，防止路径穿越。
export function isSafeFolder(folder) {
  return (
    typeof folder === 'string' &&
    folder.length > 0 &&
    folder.length <= 100 &&
    !folder.includes('/') &&
    !folder.includes('\\') &&
    folder !== '.' &&
    folder !== '..'
  );
}
