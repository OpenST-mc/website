// litematic-preview 自有最小类型：与 deepslate/WebGL 核心的「类型化边界」。
// 不引入 React 状态；命令式模块共享这些结构。
import type { Identifier } from 'deepslate';

export interface NbtTag {
  type: string;
  value: unknown;
}

export type NbtCompound = Record<string, NbtTag>;

export interface RawLitematicNbt {
  value: NbtCompound;
}

export interface BlockPaletteEntry {
  Name: string;
  // stripNBTTyping 后 Properties 为纯值字典（如 { facing: 'north' }）。
  Properties?: Record<string, unknown>;
}

export interface LitematicRegion {
  name: string;
  width: number;
  height: number;
  depth: number;
  size: [number, number, number];
  position: [number, number, number];
  packedData: Array<[number, number]>;
  nbits: number;
  blockPalette: BlockPaletteEntry[];
}

export interface Litematic {
  regions: LitematicRegion[];
}

export interface StructurePlacement {
  structure: unknown;
  position: [number, number, number];
}

export interface LitematicAssets {
  blockstates: Record<string, unknown>;
  models: Record<string, unknown>;
  textures: Record<string, [number, number, number, number]>;
}

export interface DeepslateResources {
  getBlockDefinition(id: string): unknown;
  getBlockModel(id: string): unknown;
  // deepslate 渲染器传入的已是 Identifier（BlockModel.getTexture 的产物），不得二次解析。
  getTextureUV(id: Identifier): unknown;
  getTextureAtlas(): ImageData;
  getBlockFlags(id: string): {
    opaque: boolean;
    self_culling: boolean;
    semi_transparent: boolean;
  };
  getBlockProperties(id: string): null;
  getDefaultBlockProperties(id: string): null;
}
