import { describe, expect, it } from 'vitest';
import { parseNbtRoot, writeNbtRoot, type NbtRoot, type NbtTag } from '../src/lib/litematic/nbt';
import {
  convertLitematic,
  convertRedstoneWireTags,
  convertSignTags,
  gzipNbt,
  inflateNbt,
  renameCountTags,
  requiresLegacyWarning,
} from '../src/lib/litematic/convert';

function makeRoot(extra: Record<string, NbtTag> = {}): NbtRoot {
  return {
    name: '',
    type: 'compound',
    value: {
      MinecraftDataVersion: { type: 'int', value: 4000 },
      Version: { type: 'int', value: 7 },
      ...extra,
    },
  };
}

describe('NBT reader/writer', () => {
  it('round-trips every tag type through write -> parse', () => {
    const root: NbtRoot = {
      name: 'hello',
      type: 'compound',
      value: {
        byte: { type: 'byte', value: -5 },
        short: { type: 'short', value: 300 },
        int: { type: 'int', value: 70000 },
        long: { type: 'long', value: 1234567890123n },
        float: { type: 'float', value: 1.5 },
        double: { type: 'double', value: 2.25 },
        string: { type: 'string', value: '存档' },
        byteArray: { type: 'byteArray', value: [1, -2, 3] },
        intArray: { type: 'intArray', value: [1, 2, 3] },
        longArray: { type: 'longArray', value: [1n, -2n] },
        list: { type: 'list', value: { type: 'string', value: ['a', 'b'] } },
        compound: { type: 'compound', value: { nested: { type: 'int', value: 1 } } },
      },
    };

    expect(parseNbtRoot(writeNbtRoot(root))).toEqual(root);
  });

  it('rejects a root that is not a compound tag', () => {
    expect(() => parseNbtRoot(new Uint8Array([1, 0, 0]))).toThrow('NBT root must be a compound tag');
  });
});

describe('convertLitematic', () => {
  it('updates MinecraftDataVersion to the target version', () => {
    const root = makeRoot();
    convertLitematic(root, 3105);
    expect(root.value['MinecraftDataVersion']?.value).toBe(3105);
  });

  it('sets NBT Version 7 and runs new-format tag conversions for 1.21+ (3953)', () => {
    const root = makeRoot({
      Items: {
        type: 'list',
        value: {
          type: 'compound',
          value: [{ id: { type: 'string', value: 'minecraft:cobblestone' }, Count: { type: 'int', value: 64 } }],
        },
      },
    });

    convertLitematic(root, 3953);

    expect(root.value['Version']?.value).toBe(7);
    const items = root.value['Items']?.value as { value: Array<Record<string, NbtTag>> };
    expect(items.value[0]?.['Count']).toBeUndefined();
    expect(items.value[0]?.['count']).toEqual({ type: 'int', value: 64 });
  });

  it.each([
    [3953, 7],
    [3463, 6],
    [3218, 6],
    [3105, 6],
    [2230, 5],
    [2586, 5],
  ])('maps target data version %i to NBT Version %i', (target, expected) => {
    const root = makeRoot();
    convertLitematic(root, target);
    expect(root.value['Version']?.value).toBe(expected);
  });

  it('flags versions at or below 1.19 (3105) as needing a legacy warning', () => {
    expect(requiresLegacyWarning(3105)).toBe(true);
    expect(requiresLegacyWarning(2586)).toBe(true);
    expect(requiresLegacyWarning(3106)).toBe(false);
    expect(requiresLegacyWarning(3953)).toBe(false);
  });
});

describe('renameCountTags', () => {
  it('renames Count to count on items nested inside BlockEntityTag', () => {
    const item: Record<string, unknown> = {
      id: { type: 'string', value: 'minecraft:chest' },
      Count: { type: 'int', value: 3 },
    };
    const blockEntity: Record<string, unknown> = {
      BlockEntityTag: {
        type: 'compound',
        value: { Items: { type: 'list', value: { type: 'compound', value: [item] } } },
      },
    };

    renameCountTags(blockEntity);

    expect(item['Count']).toBeUndefined();
    expect(item['count']).toEqual({ type: 'int', value: 3 });
  });

  it('walks plain nested objects without touching non-Count keys', () => {
    const node: Record<string, unknown> = {
      inner: { Count: { type: 'int', value: 1 }, Other: { type: 'int', value: 2 } },
    };

    renameCountTags(node);

    const inner = node['inner'] as Record<string, unknown>;
    expect(inner['count']).toEqual({ type: 'int', value: 1 });
    expect(inner['Other']).toEqual({ type: 'int', value: 2 });
  });
});

describe('convertSignTags', () => {
  it('moves Text1..Text4/GlowingText/Color into front_text/back_text', () => {
    const sign: Record<string, unknown> = {
      Text1: { type: 'string', value: '{"text":"a"}' },
      Text2: { type: 'string', value: '{"text":"b"}' },
      GlowingText: { type: 'byte', value: 1 },
      Color: { type: 'string', value: 'red' },
    };

    convertSignTags(sign);

    expect(sign['Text1']).toBeUndefined();
    expect(sign['Text2']).toBeUndefined();
    expect(sign['GlowingText']).toBeUndefined();
    expect(sign['Color']).toBeUndefined();

    const front = (sign['front_text'] as NbtTag).value as Record<string, NbtTag>;
    const frontMessages = (front['messages']?.value as { value: string[] }).value;
    expect(frontMessages).toEqual(['{"text":"a"}', '{"text":"b"}', '{"text":""}', '{"text":""}']);
    expect(front['has_glowing_text']?.value).toBe(1);
    expect(front['color']?.value).toBe('red');

    const back = (sign['back_text'] as NbtTag).value as Record<string, NbtTag>;
    expect((back['messages']?.value as { value: string[] }).value).toEqual([
      '{"text":""}',
      '{"text":""}',
      '{"text":""}',
      '{"text":""}',
    ]);
    expect(back['color']?.value).toBe('black');
  });

  it('defaults missing text/color tags and recurses into nested compounds', () => {
    const node: Record<string, unknown> = {
      nested: { Text3: { type: 'string', value: '{"text":"c"}' } },
    };

    convertSignTags(node);

    const nested = node['nested'] as Record<string, unknown>;
    const front = (nested['front_text'] as NbtTag).value as Record<string, NbtTag>;
    expect((front['messages']?.value as { value: string[] }).value).toEqual([
      '{"text":""}',
      '{"text":""}',
      '{"text":"c"}',
      '{"text":""}',
    ]);
    expect(front['has_glowing_text']?.value).toBe(0);
    expect(front['color']?.value).toBe('black');
  });
});

describe('convertRedstoneWireTags', () => {
  it('keeps none/side directions on redstone wire properties', () => {
    const wire: Record<string, unknown> = {
      Name: { type: 'string', value: 'minecraft:redstone_wire' },
      Properties: {
        type: 'compound',
        value: {
          north: { type: 'string', value: 'none' },
          east: { type: 'string', value: 'side' },
          south: { type: 'string', value: 'up' },
        },
      },
    };

    convertRedstoneWireTags(wire);

    const props = (wire['Properties'] as NbtTag).value as Record<string, NbtTag>;
    expect(props['north']?.value).toBe('none');
    expect(props['east']?.value).toBe('side');
    expect(props['south']?.value).toBe('up');
  });

  it('recurses into nested compounds', () => {
    const nested: Record<string, unknown> = {
      layer: {
        Name: { type: 'string', value: 'minecraft:redstone_wire' },
        Properties: {
          type: 'compound',
          value: { west: { type: 'string', value: 'none' } },
        },
      },
    };

    convertRedstoneWireTags(nested);

    const layer = nested['layer'] as Record<string, unknown>;
    const props = (layer['Properties'] as NbtTag).value as Record<string, NbtTag>;
    expect(props['west']?.value).toBe('none');
  });
});

describe('gzip helpers', () => {
  it('gzipNbt output inflates back to the original NBT bytes', () => {
    const root = makeRoot({ label: { type: 'string', value: 'preset' } });
    const uncompressed = writeNbtRoot(root);
    expect(inflateNbt(gzipNbt(root))).toEqual(uncompressed);
  });
});
