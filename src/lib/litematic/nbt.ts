// NBT 二进制读写（litematic-converter 专用）。
// 浏览器可用、无 Node 依赖：解析用 DataView，写出为手写 writer（字节级对等旧实现）。

export type NbtTagType =
  | 'end'
  | 'byte'
  | 'short'
  | 'int'
  | 'long'
  | 'float'
  | 'double'
  | 'byteArray'
  | 'string'
  | 'list'
  | 'compound'
  | 'intArray'
  | 'longArray';

export interface NbtTag {
  type: NbtTagType;
  value: unknown;
}

export interface NbtList {
  type: NbtTagType;
  value: unknown[];
}

export interface NbtRoot {
  name: string;
  type: NbtTagType;
  value: Record<string, NbtTag>;
}

const TAG_NAMES: readonly NbtTagType[] = [
  'end',
  'byte',
  'short',
  'int',
  'long',
  'float',
  'double',
  'byteArray',
  'string',
  'list',
  'compound',
  'intArray',
  'longArray',
];

const TAG_IDS: Record<NbtTagType, number> = {
  end: 0,
  byte: 1,
  short: 2,
  int: 3,
  long: 4,
  float: 5,
  double: 6,
  byteArray: 7,
  string: 8,
  list: 9,
  compound: 10,
  intArray: 11,
  longArray: 12,
};

interface ReadState {
  offset: number;
}

function readString(view: DataView, state: ReadState): string {
  const len = view.getUint16(state.offset);
  state.offset += 2;
  const bytes = new Uint8Array(view.buffer, view.byteOffset + state.offset, len);
  state.offset += len;
  return new TextDecoder().decode(bytes);
}

function readPayload(view: DataView, state: ReadState, tagId: number): NbtTag {
  switch (tagId) {
    case 0:
      return { type: 'end', value: null };
    case 1: {
      const v = view.getInt8(state.offset);
      state.offset += 1;
      return { type: 'byte', value: v };
    }
    case 2: {
      const v = view.getInt16(state.offset);
      state.offset += 2;
      return { type: 'short', value: v };
    }
    case 3: {
      const v = view.getInt32(state.offset);
      state.offset += 4;
      return { type: 'int', value: v };
    }
    case 4: {
      const v = view.getBigInt64(state.offset);
      state.offset += 8;
      return { type: 'long', value: v };
    }
    case 5: {
      const v = view.getFloat32(state.offset);
      state.offset += 4;
      return { type: 'float', value: v };
    }
    case 6: {
      const v = view.getFloat64(state.offset);
      state.offset += 8;
      return { type: 'double', value: v };
    }
    case 7: {
      const len = view.getInt32(state.offset);
      state.offset += 4;
      const arr: number[] = [];
      for (let i = 0; i < len; i++) {
        arr.push(view.getInt8(state.offset));
        state.offset += 1;
      }
      return { type: 'byteArray', value: arr };
    }
    case 8:
      return { type: 'string', value: readString(view, state) };
    case 9: {
      const elemId = view.getUint8(state.offset);
      state.offset += 1;
      const len = view.getInt32(state.offset);
      state.offset += 4;
      const items: unknown[] = [];
      for (let i = 0; i < len; i++) {
        items.push(readPayload(view, state, elemId).value);
      }
      const list: NbtList = { type: TAG_NAMES[elemId] ?? 'end', value: items };
      return { type: 'list', value: list };
    }
    case 10: {
      const obj: Record<string, NbtTag> = {};
      for (;;) {
        const childId = view.getUint8(state.offset);
        state.offset += 1;
        if (childId === 0) break;
        const name = readString(view, state);
        obj[name] = readPayload(view, state, childId);
      }
      return { type: 'compound', value: obj };
    }
    case 11: {
      const len = view.getInt32(state.offset);
      state.offset += 4;
      const arr: number[] = [];
      for (let i = 0; i < len; i++) {
        arr.push(view.getInt32(state.offset));
        state.offset += 4;
      }
      return { type: 'intArray', value: arr };
    }
    case 12: {
      const len = view.getInt32(state.offset);
      state.offset += 4;
      const arr: bigint[] = [];
      for (let i = 0; i < len; i++) {
        arr.push(view.getBigInt64(state.offset));
        state.offset += 8;
      }
      return { type: 'longArray', value: arr };
    }
    default:
      throw new Error('Unknown NBT tag id: ' + tagId);
  }
}

export function parseNbtRoot(u8: Uint8Array): NbtRoot {
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const state: ReadState = { offset: 0 };
  const rootId = view.getUint8(state.offset);
  state.offset += 1;
  if (rootId !== 10) throw new Error('NBT root must be a compound tag');
  const name = readString(view, state);
  const tag = readPayload(view, state, rootId);
  return { name, type: tag.type, value: tag.value as Record<string, NbtTag> };
}

class NbtWriter {
  private readonly bytes: number[] = [];

  u8(v: number): void {
    this.bytes.push(v & 0xff);
  }

  i8(v: number): void {
    this.bytes.push(v & 0xff);
  }

  u16(v: number): void {
    this.bytes.push((v >>> 8) & 0xff, v & 0xff);
  }

  i16(v: number): void {
    this.u16(v);
  }

  i32(v: number): void {
    this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  }

  i64(v: number | bigint): void {
    const b = typeof v === 'bigint' ? v : BigInt(Math.trunc(v));
    for (let s = 56; s >= 0; s -= 8) this.bytes.push(Number((b >> BigInt(s)) & BigInt(0xff)));
  }

  f32(v: number): void {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, v);
    for (const x of new Uint8Array(buf)) this.bytes.push(x);
  }

  f64(v: number): void {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, v);
    for (const x of new Uint8Array(buf)) this.bytes.push(x);
  }

  str(s: string): void {
    const enc = new TextEncoder().encode(s);
    this.u16(enc.length);
    for (const x of enc) this.bytes.push(x);
  }

  writePayload(tag: NbtTag): void {
    const id = TAG_IDS[tag.type];
    if (id === undefined) throw new Error('Unknown NBT type: ' + tag.type);
    switch (id) {
      case 1:
        this.i8(tag.value as number);
        break;
      case 2:
        this.i16(tag.value as number);
        break;
      case 3:
        this.i32(tag.value as number);
        break;
      case 4:
        this.i64(tag.value as number | bigint);
        break;
      case 5:
        this.f32(tag.value as number);
        break;
      case 6:
        this.f64(tag.value as number);
        break;
      case 7: {
        const value = tag.value as number[];
        this.i32(value.length);
        for (const x of value) this.i8(x);
        break;
      }
      case 8:
        this.str(tag.value as string);
        break;
      case 9: {
        const list = tag.value as NbtList;
        const elemId = TAG_IDS[list.type] ?? 0;
        this.u8(elemId);
        this.i32(list.value.length);
        for (const item of list.value) this.writePayload({ type: list.type, value: item });
        break;
      }
      case 10: {
        const value = tag.value as Record<string, NbtTag>;
        for (const key of Object.keys(value)) {
          const child = value[key];
          if (child === undefined) continue;
          this.u8(TAG_IDS[child.type]);
          this.str(key);
          this.writePayload(child);
        }
        this.u8(0);
        break;
      }
      case 11: {
        const value = tag.value as number[];
        this.i32(value.length);
        for (const x of value) this.i32(x);
        break;
      }
      case 12: {
        const value = tag.value as bigint[];
        this.i32(value.length);
        for (const x of value) this.i64(x);
        break;
      }
      default:
        break;
    }
  }

  toUint8Array(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

export function writeNbtRoot(root: NbtRoot): Uint8Array {
  const w = new NbtWriter();
  w.u8(10);
  w.str(root.name || '');
  w.writePayload({ type: 'compound', value: root.value });
  return w.toUint8Array();
}
