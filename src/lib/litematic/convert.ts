// litematic 版本转换（自 apps/extra/litematic-converter/index.js 迁移，
// 行为逐条对等）。
// 纯逻辑：不触 DOM；UI 表单与下载在 +Page.tsx。
import { gzip, inflate } from 'pako';
import type { NbtList, NbtRoot, NbtTag } from './nbt';
import { writeNbtRoot } from './nbt';

export const LEGACY_WARNING_MAX_VERSION = 3105;
export const NEW_FORMAT_MIN_VERSION = 3953;

export function inflateNbt(compressed: Uint8Array): Uint8Array {
  return inflate(compressed);
}

export function gzipNbt(root: NbtRoot): Uint8Array<ArrayBuffer> {
  // pako 输出为专用 ArrayBuffer；收窄泛型以便直接作为 BlobPart。
  return gzip(writeNbtRoot(root)) as Uint8Array<ArrayBuffer>;
}

export function requiresLegacyWarning(targetVersion: number): boolean {
  return targetVersion <= LEGACY_WARNING_MAX_VERSION;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTagWithItems(child: unknown): boolean {
  if (!isRecord(child)) return false;
  const value = child['value'];
  return isRecord(value) && Boolean(value['Items']);
}

export function renameCountTags(obj: unknown): void {
  if (!isRecord(obj)) return;

  for (const key in obj) {
    const child = obj[key];
    if (key === 'Count' && child !== undefined) {
      obj['count'] = { type: 'int', value: (child as NbtTag).value };
      delete obj['Count'];
    } else if (key === 'BlockEntityTag' && isTagWithItems(child)) {
      const value = (child as NbtTag).value as Record<string, unknown>;
      renameCountTags(value['Items']);
    } else {
      renameCountTags(child);
    }
  }
}

const SIGN_TEXT_KEYS = ['Text1', 'Text2', 'Text3', 'Text4'] as const;

export function convertSignTags(obj: unknown): void {
  if (!isRecord(obj)) return;

  for (const key in obj) {
    if ((SIGN_TEXT_KEYS as readonly string[]).includes(key)) {
      const messages = SIGN_TEXT_KEYS.map((textKey) => (obj[textKey] ? (obj[textKey] as NbtTag).value : '{"text":""}'));
      const glowing = obj['GlowingText'] ? (obj['GlowingText'] as NbtTag).value : 0;
      const color = obj['Color'] ? (obj['Color'] as NbtTag).value : 'black';

      obj['front_text'] = {
        type: 'compound',
        value: {
          has_glowing_text: { type: 'byte', value: glowing },
          color: { type: 'string', value: color },
          messages: {
            type: 'list',
            value: { type: 'string', value: messages } satisfies NbtList,
          },
        },
      };

      obj['back_text'] = {
        type: 'compound',
        value: {
          has_glowing_text: { type: 'byte', value: 0 },
          color: { type: 'string', value: 'black' },
          messages: {
            type: 'list',
            value: {
              type: 'string',
              value: ['{"text":""}', '{"text":""}', '{"text":""}', '{"text":""}'],
            } satisfies NbtList,
          },
        },
      };

      delete obj['Text1'];
      delete obj['Text2'];
      delete obj['Text3'];
      delete obj['Text4'];
      delete obj['GlowingText'];
      delete obj['Color'];
    } else {
      convertSignTags(obj[key]);
    }
  }
}

// 旧实现会把红石线 north/south/east/west 的 'none'/'side' 原样写回（等价 no-op）；
// 为保持转换结果一致，这里保留遍历对等语义但不修改任何值。
export function convertRedstoneWireTags(obj: unknown): void {
  if (!isRecord(obj)) return;

  for (const key in obj) {
    convertRedstoneWireTags(obj[key]);
  }
}

export function convertLitematic(root: NbtRoot, targetVersion: number): void {
  const data = root.value;
  const dataVersionTag = data['MinecraftDataVersion'];
  const versionTag = data['Version'];
  if (!dataVersionTag || !versionTag) {
    throw new Error('Missing MinecraftDataVersion/Version tag');
  }

  dataVersionTag.value = targetVersion;

  if (targetVersion >= NEW_FORMAT_MIN_VERSION) {
    versionTag.value = 7;

    renameCountTags(data);
    convertSignTags(data);
    convertRedstoneWireTags(data);
  } else {
    versionTag.value = targetVersion >= 3218 && targetVersion < 3463 ? 6 : targetVersion <= 2586 ? 5 : 6;
  }
}
