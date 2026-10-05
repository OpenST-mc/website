import { TAG_CONFIG, type TagCategoryConfig } from './config.ts';

// 打包器纯逻辑（与旧 apps/admin/admin_tools.js 语义对等，便于单测）。

export const DEFAULT_DESC =
  '### 🚀 机器概览\n- **核心功能**: \n- **适用版本**: Java 1.20.x\n\n### 📖 使用说明\n1. \n\n> 提示：';

export interface PackerForm {
  name: string;
  author: string;
  tags: string[];
  desc: string;
  previewFileName: string;
  litematicFileName: string;
}

export interface PackerInfoJson {
  id: string;
  name: string;
  author: string;
  tags: string[];
  description: string;
  folder: string;
  preview: string;
  filename: string;
  submitDate: string;
}

/** 把 TAG_CONFIG 展平为「分类 -> 标签数组」（对象分类只取叶子）。 */
export function flattenTagConfig(config: Record<string, TagCategoryConfig> = TAG_CONFIG): Record<string, string[]> {
  const res: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(config)) {
    res[k] = Array.isArray(v) ? v : Object.values(v).flat();
  }
  return res;
}

/** `a.PNG` -> `preview.png`。 */
export function previewFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ext ? `preview.${ext}` : 'preview';
}

/** 文件名非法字符替换。 */
export function sanitizeZipName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

/** 生成 info.json（字段顺序与旧实现一致）。 */
export function buildInfoJson(form: PackerForm, now: Date): PackerInfoJson {
  return {
    id: `sub-${now.getTime()}`,
    name: form.name,
    author: form.author || '未知',
    tags: form.tags,
    description: form.desc,
    folder: form.name,
    preview: previewFileName(form.previewFileName),
    filename: form.litematicFileName,
    submitDate: now.toISOString(),
  };
}
