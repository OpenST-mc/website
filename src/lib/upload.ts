// 上传前置校验：类型（扩展名）与大小，错误信息面向用户可读。

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'];
export const ARCHIVE_EXTENSIONS = ['.litematic', '.zip', '.rar'];
export const SUBMISSION_ARCHIVE_EXTENSIONS = ['.litematic', '.zip'];

export interface FileValidationOptions {
  extensions: string[];
  label: string;
  maxBytes?: number;
}

function formatMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
}

/** 校验失败返回可读错误信息，通过返回 null。 */
export function validateUploadFile(file: File, options: FileValidationOptions): string | null {
  const maxBytes = options.maxBytes ?? MAX_UPLOAD_BYTES;
  if (file.size > maxBytes) {
    return `${options.label}超过 ${formatMB(maxBytes)} 限制（当前 ${formatMB(file.size)}）`;
  }
  const name = file.name.toLowerCase();
  if (!options.extensions.some((ext) => name.endsWith(ext))) {
    return `${options.label}格式不支持，仅接受 ${options.extensions.join(' / ')}`;
  }
  return null;
}
