import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getMaterialList,
  iterateRegionBlocks,
  readLitematicFromNBTData,
  stripNBTTyping,
} from '../src/pages/litematic-preview/litematic-utils';
import { structuresFromLitematic } from '../src/pages/litematic-preview/deepslate-helpers';
import type { LitematicRegion } from '../src/pages/litematic-preview/types';

function tag(type: string, value: unknown) {
  return { type, value };
}

// 2x1x2 区域：linearIdx = x + z*w，块 id 依次 [1, 2, 3, 0]，nbits=2。
// 64 位字 = 1 | 2<<2 | 3<<4 = 57；packedData 每个 long 为 [high, low]。
function makeRegion(overrides: Partial<LitematicRegion> = {}): LitematicRegion {
  return {
    name: 'r1',
    width: 2,
    height: 1,
    depth: 2,
    size: [2, 1, 2],
    position: [5, 0, -3],
    packedData: [[0, 57]],
    nbits: 2,
    blockPalette: [
      { Name: 'minecraft:air' },
      { Name: 'minecraft:stone', Properties: { facing: 'north' } },
      { Name: 'minecraft:redstone_wire' },
      { Name: 'minecraft:oak_planks' },
    ],
    ...overrides,
  };
}

function makeRawNbt(region: Record<string, unknown>) {
  return {
    value: {
      Regions: tag('compound', { r1: tag('compound', region) }),
    },
  };
}

describe('readLitematicFromNBTData', () => {
  it('reads region size/position/palette/packed data from NBT shape', () => {
    const litematic = readLitematicFromNBTData(
      makeRawNbt({
        Size: tag('compound', { x: tag('int', 2), y: tag('int', 1), z: tag('int', 2) }),
        Position: tag('compound', { x: tag('int', 5), y: tag('int', 0), z: tag('int', -3) }),
        BlockStatePalette: tag('list', {
          type: 'compound',
          value: [
            { Name: tag('string', 'minecraft:air') },
            {
              Name: tag('string', 'minecraft:stone'),
              Properties: tag('compound', { facing: tag('string', 'north') }),
            },
            { Name: tag('string', 'minecraft:redstone_wire') },
            { Name: tag('string', 'minecraft:oak_planks') },
          ],
        }),
        BlockStates: tag('longArray', [[0, 57]]),
      })
    );

    expect(litematic.regions).toHaveLength(1);
    const region = litematic.regions[0];
    expect(region?.name).toBe('r1');
    expect(region?.width).toBe(2);
    expect(region?.height).toBe(1);
    expect(region?.depth).toBe(2);
    expect(region?.nbits).toBe(2);
    expect(region?.position).toEqual([5, 0, -3]);
    expect(region?.packedData).toEqual([[0, 57]]);
    expect(region?.blockPalette[1]).toEqual({
      Name: 'minecraft:stone',
      Properties: { facing: 'north' },
    });
  });

  it('defaults to origin when a region has no Position tag', () => {
    const litematic = readLitematicFromNBTData(
      makeRawNbt({
        Size: tag('compound', { x: tag('int', 1), y: tag('int', 1), z: tag('int', 1) }),
        BlockStatePalette: tag('list', {
          type: 'compound',
          value: [{ Name: tag('string', 'minecraft:air') }, { Name: tag('string', 'minecraft:stone') }],
        }),
        BlockStates: tag('longArray', [[0, 0]]),
      })
    );

    expect(litematic.regions[0]?.position).toEqual([0, 0, 0]);
    expect(litematic.regions[0]?.nbits).toBe(1);
  });
});

describe('iterateRegionBlocks', () => {
  it('decodes block ids for every non-air position', () => {
    const blocks: Array<[number, number, number, number]> = [];
    iterateRegionBlocks(makeRegion(), 0, -1, (x, y, z, id) => blocks.push([x, y, z, id]));

    expect(blocks).toEqual([
      [0, 0, 0, 1],
      [0, 0, 1, 3],
      [1, 0, 0, 2],
    ]);
  });

  it('stops at y_min / y_max bounds', () => {
    const called: number[] = [];
    iterateRegionBlocks(makeRegion(), 0, 0, (x, y, z) => called.push(x, y, z));
    expect(called).toHaveLength(0);

    iterateRegionBlocks(makeRegion(), 1, -1, (x, y, z) => called.push(x, y, z));
    expect(called).toHaveLength(0);
  });
});

describe('getMaterialList', () => {
  it('counts blocks by palette name, ignoring air', () => {
    expect(getMaterialList({ regions: [makeRegion()] })).toEqual({
      'minecraft:stone': 1,
      'minecraft:redstone_wire': 1,
      'minecraft:oak_planks': 1,
    });
  });
});

describe('stripNBTTyping', () => {
  it('strips type wrappers from compounds, lists and leaves', () => {
    const input = tag('compound', {
      name: tag('string', 'value'),
      nested: tag('compound', { count: tag('int', 3) }),
      items: tag('list', { type: 'int', value: [1, 2] }),
    });

    expect(stripNBTTyping(input)).toEqual({
      name: 'value',
      nested: { count: 3 },
      items: [1, 2],
    });
  });

  it('passes through non-tagged values', () => {
    expect(stripNBTTyping(42)).toBe(42);
    expect(stripNBTTyping({ plain: 'x' })).toEqual({ plain: 'x' });
  });
});

describe('structuresFromLitematic', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds palette blocks, falls back to cake for out-of-range ids and keeps region offsets', () => {
    const blocks: Array<{ pos: number[]; id: string; props?: unknown }> = [];
    class FakeStructure {
      constructor(public size: number[]) {}
      addBlock(pos: number[], id: string, props?: unknown) {
        blocks.push({ pos, id, props });
      }
    }
    vi.stubGlobal('deepslate', { Structure: FakeStructure });

    const region = makeRegion({
      blockPalette: [{ Name: 'minecraft:air' }, { Name: 'minecraft:stone', Properties: { facing: 'north' } }],
    });
    const result = structuresFromLitematic({ regions: [region] }, 0, -1);

    expect(result).toHaveLength(1);
    expect(result[0]?.position).toEqual([5, 0, -3]);
    expect(blocks).toEqual([
      { pos: [0, 0, 0], id: 'minecraft:stone', props: { facing: 'north' } },
      { pos: [0, 0, 1], id: 'minecraft:cake', props: undefined },
      { pos: [1, 0, 0], id: 'minecraft:cake', props: undefined },
    ]);
  });
});
