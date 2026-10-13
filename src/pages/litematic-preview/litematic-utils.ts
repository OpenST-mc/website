// litematic NBT → 结构数据（自 apps/extra/litematic-preview/src/litematic-utils.js 迁移）。
import type { Litematic, LitematicRegion, NbtCompound, NbtTag, RawLitematicNbt } from './types';

export type BlockVisitor = (x: number, y: number, z: number, blockID: number) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asCompound(tag: NbtTag | undefined): NbtCompound {
  if (!tag || !isRecord(tag.value)) throw new Error('Malformed NBT compound tag');
  return tag.value as NbtCompound;
}

function asNumber(tag: NbtTag | undefined): number {
  if (!tag || typeof tag.value !== 'number') throw new Error('Malformed NBT numeric tag');
  return tag.value;
}

export function readLitematicFromNBTData(nbtdata: RawLitematicNbt): Litematic {
  const litematic: Litematic = { regions: [] };

  const regions = asCompound(nbtdata.value['Regions']);
  for (const regionName in regions) {
    const regionTag = regions[regionName];
    if (!regionTag) continue;
    const region = asCompound(regionTag);

    const blockPalette = stripNBTTyping(region['BlockStatePalette']);

    const palette = Array.isArray(blockPalette) ? (blockPalette as LitematicRegion['blockPalette']) : [];
    const nbits = Math.ceil(Math.log2(palette.length));

    const size = asCompound(region['Size']);
    const w = Math.abs(asNumber(size['x']));
    const h = Math.abs(asNumber(size['y']));
    const d = Math.abs(asNumber(size['z']));

    const packedData = region['BlockStates']?.value;

    const litematicRegion: LitematicRegion = {
      name: regionName,
      width: w,
      height: h,
      depth: d,
      size: [w, h, d],
      packedData: (packedData ?? []) as Array<[number, number]>,
      nbits,
      blockPalette: palette,
      position: [0, 0, 0],
    };

    // 解析子投影的世界坐标偏移量
    if (region['Position']) {
      const position = asCompound(region['Position']);
      litematicRegion.position = [
        asNumber(position['x']),
        asNumber(position['y']),
        asNumber(position['z']),
      ];
    }

    litematic.regions.push(litematicRegion);
  }

  return litematic;
}

// 按需解码：从 packed bit 数据中解码指定 Y 范围，回调仅对非空气方块触发
export function iterateRegionBlocks(
  region: LitematicRegion,
  y_min: number,
  y_max: number,
  callback: BlockVisitor
): void {
  const packedData = region.packedData;
  const nbits = region.nbits;
  const w = region.width;
  const h = region.height;
  const d = region.depth;

  const effectiveMax = y_max === -1 ? h : Math.min(y_max, h);
  if (y_min >= h) return;

  const mask = (1 << nbits) - 1;
  const wd = w * d;
  const packedLen = packedData.length;

  for (let x = 0; x < w; x++) {
    for (let y = y_min; y < effectiveMax; y++) {
      const baseIdx = y * wd + x;
      for (let z = 0; z < d; z++) {
        const linearIdx = baseIdx + z * w;

        const start_offset = linearIdx * nbits;
        const start_arr_index = start_offset >>> 5;
        const end_arr_index = ((linearIdx + 1) * nbits - 1) >>> 5;
        const start_bit_offset = start_offset & 0x1f;

        const half_ind = start_arr_index >>> 1;
        let blockStart: number;
        let blockEnd: number;
        if ((start_arr_index & 0x1) === 0) {
          blockStart = packedData[half_ind]![1];
          blockEnd = packedData[half_ind]![0];
        } else {
          blockStart = packedData[half_ind]![0];
          if (half_ind + 1 < packedLen) {
            blockEnd = packedData[half_ind + 1]![1];
          } else {
            blockEnd = 0;
          }
        }

        let blockID: number;
        if (start_arr_index === end_arr_index) {
          blockID = (blockStart >>> start_bit_offset) & mask;
        } else {
          const end_offset = 32 - start_bit_offset;
          blockID = ((blockStart >>> start_bit_offset) & mask) | ((blockEnd << end_offset) & mask);
        }

        if (blockID > 0) {
          callback(x, y, z, blockID);
        }
      }
    }
  }
}

// Hacky function needed to convert NBT to pure JSON
// use at your own risk
export function stripNBTTyping(nbtData: unknown): unknown {
  if (isRecord(nbtData) && 'type' in nbtData) {
    switch (nbtData['type']) {
      case 'compound': {
        const newDict: Record<string, unknown> = {};
        for (const [k, v] of Object.entries((nbtData['value'] as Record<string, unknown>) ?? {})) {
          newDict[k] = stripNBTTyping(v);
        }
        return newDict;
      }
      case 'list': {
        const newList: unknown[] = [];
        const source = (nbtData['value'] as { value?: unknown[] } | undefined)?.value;
        if (Array.isArray(source)) {
          for (const [k, v] of source.entries()) {
            newList[k] = stripNBTTyping(v);
          }
        }
        return newList;
      }
      default:
        return nbtData['value'];
    }
  }

  if (isRecord(nbtData) && !Array.isArray(nbtData)) {
    const newDict: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(nbtData)) {
      newDict[k] = stripNBTTyping(v);
    }
    return newDict;
  }

  return nbtData;
}

export function getMaterialList(litematic: Litematic): Record<string, number> {
  const blockCounts: Record<string, number> = {};

  for (const region of litematic.regions) {
    const blockPalette = region.blockPalette;

    iterateRegionBlocks(region, 0, -1, (_x, _y, _z, blockID) => {
      if (blockID < blockPalette.length) {
        const blockName = blockPalette[blockID]!.Name;
        blockCounts[blockName] = (blockCounts[blockName] ?? 0) + 1;
      } else {
        blockCounts['unknown'] = (blockCounts['unknown'] ?? 0) + 1;
      }
    });
  }

  return blockCounts;
}
