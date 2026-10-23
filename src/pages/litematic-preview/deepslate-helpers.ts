// deepslate 资源装载与 litematic → Structure 构建
// （自 apps/extra/litematic-preview/src/deepslate-helpers.js 迁移）。
import { iterateRegionBlocks } from './litematic-utils';
import type { DeepslateResources, Litematic, StructurePlacement } from './types';

function upperPowerOfTwo(x: number): number {
  x -= 1;
  x |= x >> 1;
  x |= x >> 2;
  x |= x >> 4;
  x |= x >> 8;
  x |= x >> 18;
  x |= x >> 32;
  return x + 1;
}

let deepslateResources: DeepslateResources | null = null;

export function getDeepslateResources(): DeepslateResources | null {
  return deepslateResources;
}

// Load Deepslate resources from texture atlas image
// Taken from Deepslate examples
export function loadDeepslateResources(textureImage: HTMLImageElement): DeepslateResources {
  console.log('loading resources...');
  const blockDefinitions: Record<string, unknown> = {};
  Object.keys(assets.blockstates).forEach((id) => {
    const definition = assets.blockstates[id];
    if (definition === undefined) return;
    blockDefinitions['minecraft:' + id] = deepslate.BlockDefinition.fromJson(id, definition);
  });

  const blockModels: Record<string, ReturnType<typeof deepslate.BlockModel.fromJson>> = {};
  Object.keys(assets.models).forEach((id) => {
    const model = assets.models[id];
    if (model === undefined) return;
    blockModels['minecraft:' + id] = deepslate.BlockModel.fromJson(id, model);
  });
  Object.values(blockModels).forEach((m) => m.flatten({ getBlockModel: (id) => blockModels[id.toString()] ?? null }));

  const atlasCanvas = document.createElement('canvas');
  const atlasSize = upperPowerOfTwo(
    textureImage.width >= textureImage.height ? textureImage.width : textureImage.height,
  );
  atlasCanvas.width = textureImage.width;
  atlasCanvas.height = textureImage.height;

  const atlasCtx = atlasCanvas.getContext('2d');
  if (!atlasCtx) throw new Error('Cannot create atlas canvas context');
  atlasCtx.drawImage(textureImage, 0, 0);

  const atlasData = atlasCtx.getImageData(0, 0, atlasSize, atlasSize);

  const idMap: Record<string, [number, number, number, number]> = {};

  Object.keys(assets.textures).forEach((id) => {
    const texture = assets.textures[id];
    if (!texture) return;
    const [u, v, du, dv] = texture;
    const dv2 = du !== dv && id.startsWith('block/') ? du : dv;
    idMap['minecraft:' + id] = [u / atlasSize, v / atlasSize, (u + du) / atlasSize, (v + dv2) / atlasSize];
  });

  const textureAtlas = new deepslate.TextureAtlas(atlasData, idMap);

  const resources: DeepslateResources = {
    getBlockDefinition(id) {
      return blockDefinitions[id];
    },
    getBlockModel(id) {
      return blockModels[id];
    },
    getTextureUV(id) {
      return textureAtlas.getTextureUV(id);
    },
    getTextureAtlas() {
      return textureAtlas.getTextureAtlas();
    },
    getBlockFlags(id) {
      return {
        opaque: OPAQUE_BLOCKS.has(id.toString()),
        self_culling: !NON_SELF_CULLING.has(id.toString()),
        semi_transparent: TRANSPARENT_BLOCKS.has(id.toString()),
      };
    },
    getBlockProperties() {
      return null;
    },
    getDefaultBlockProperties() {
      return null;
    },
  };

  deepslateResources = resources;
  return resources;
}

export function structuresFromLitematic(litematic: Litematic, yMin = 0, yMax = -1): StructurePlacement[] {
  const regions = litematic.regions;
  const result: StructurePlacement[] = [];
  let totalBlocks = 0;

  console.log('Building blocks from', regions.length, 'regions...');

  for (const r of regions) {
    const blockPalette = r.blockPalette;
    const pos = r.position || [0, 0, 0];
    const w = r.width;
    const h = r.height;
    const d = r.depth;

    const effYMax = yMax === -1 ? h : Math.min(yMax, h);
    const structure = new deepslate.Structure([w, h, d]);

    iterateRegionBlocks(r, yMin, effYMax, (x, y, z, blockID) => {
      if (blockID >= blockPalette.length) {
        structure.addBlock([x, y, z], 'minecraft:cake');
        return;
      }
      const blockInfo = blockPalette[blockID]!;
      totalBlocks++;
      const props = blockInfo.Properties;
      if (props) {
        structure.addBlock([x, y, z], blockInfo.Name, props as Record<string, string>);
      } else {
        structure.addBlock([x, y, z], blockInfo.Name);
      }
    });

    result.push({ structure, position: pos });
  }
  console.log('Done!', totalBlocks, ' blocks created across', regions.length, 'regions');

  return result;
}
