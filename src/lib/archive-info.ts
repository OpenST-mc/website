// 管理员稿件编辑：info.json 的人工维护字段与预览图地址。
// 新数据模型中稳定 id / folder / preview / filename 均由 archive CI 从
// .meta.json 与文件系统派生，编辑接口只合并这里列出的字段，避免用站点
// 构建快照覆盖派生值（尤其是 submitDate 与图片 / 存档文件名）。

/** 仅人工可编辑的 info.json 字段。 */
export interface ArchiveInfoPatch {
  name: string;
  author: string;
  tags: string[];
  description: string;
}

/** archive CI 的图片源格式白名单（scripts/build.js 的 IMG_EXTS）。 */
export const PREVIEW_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

/** 预览图上限（与 Worker /api/admin/update-preview 一致）。 */
export const MAX_PREVIEW_BYTES = 10 * 1024 * 1024;

/** 从编辑器表单提取待合并字段；派生字段一律不发送。 */
export function toInfoPatch(form: ArchiveInfoPatch): ArchiveInfoPatch {
  return {
    name: form.name.trim(),
    author: form.author.trim() || '匿名',
    tags: [...new Set(form.tags.map((tag) => tag.trim()).filter(Boolean))],
    description: form.description,
  };
}

/**
 * 预览图地址：`/content/...` 由站点同源提供；旧数据的相对文件名回退到
 * archive 仓库 CDN（仍用于兼容历史条目）。
 */
export function archivePreviewUrl(preview: string): string {
  if (!preview) return '';
  if (preview.startsWith('data:image')) return preview;
  if (/^https:\/\//i.test(preview)) return preview;

  const decoded = (() => {
    try {
      return decodeURIComponent(preview);
    } catch {
      return preview;
    }
  })();
  const encoded = `/${decoded
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`;

  return decoded.startsWith('/content/') ? encoded : `https://cdn.jsdelivr.net/gh/OpenST-mc/archive@main${encoded}`;
}
