/* Browser-only NBT shim (no Node require, no CDN). Uses globalThis.pako from vendor/. */
const __pako = globalThis.pako;

const __TAG_NAMES = [
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
const __TAG_IDS = {
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

function __readString(view, state) {
  const len = view.getUint16(state.offset);
  state.offset += 2;
  const bytes = new Uint8Array(view.buffer, view.byteOffset + state.offset, len);
  state.offset += len;
  return new TextDecoder().decode(bytes);
}

function __readPayload(view, state, tagId) {
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
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(view.getInt8(state.offset));
        state.offset += 1;
      }
      return { type: 'byteArray', value: arr };
    }
    case 8:
      return { type: 'string', value: __readString(view, state) };
    case 9: {
      const elemId = view.getUint8(state.offset);
      state.offset += 1;
      const len = view.getInt32(state.offset);
      state.offset += 4;
      const items = [];
      for (let i = 0; i < len; i++) {
        items.push(__readPayload(view, state, elemId).value);
      }
      return { type: 'list', value: { type: __TAG_NAMES[elemId], value: items } };
    }
    case 10: {
      const obj = {};
      for (;;) {
        const childId = view.getUint8(state.offset);
        state.offset += 1;
        if (childId === 0) break;
        const name = __readString(view, state);
        obj[name] = __readPayload(view, state, childId);
      }
      return { type: 'compound', value: obj };
    }
    case 11: {
      const len = view.getInt32(state.offset);
      state.offset += 4;
      const arr = [];
      for (let i = 0; i < len; i++) {
        arr.push(view.getInt32(state.offset));
        state.offset += 4;
      }
      return { type: 'intArray', value: arr };
    }
    case 12: {
      const len = view.getInt32(state.offset);
      state.offset += 4;
      const arr = [];
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

function __parseNbtRoot(u8) {
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const state = { offset: 0 };
  const rootId = view.getUint8(state.offset);
  state.offset += 1;
  if (rootId !== 10) throw new Error('NBT root must be a compound tag');
  const name = __readString(view, state);
  const tag = __readPayload(view, state, rootId);
  return { name: name, type: tag.type, value: tag.value };
}

class __NbtWriter {
  constructor() {
    this.bytes = [];
  }
  u8(v) {
    this.bytes.push(v & 0xff);
  }
  i8(v) {
    this.bytes.push(v & 0xff);
  }
  u16(v) {
    this.bytes.push((v >>> 8) & 0xff, v & 0xff);
  }
  i16(v) {
    this.u16(v);
  }
  i32(v) {
    this.bytes.push((v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff);
  }
  i64(v) {
    const b = typeof v === 'bigint' ? v : BigInt(Math.trunc(v));
    for (let s = 56; s >= 0; s -= 8) this.bytes.push(Number((b >> BigInt(s)) & BigInt(0xff)));
  }
  f32(v) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, v);
    for (const x of new Uint8Array(buf)) this.bytes.push(x);
  }
  f64(v) {
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, v);
    for (const x of new Uint8Array(buf)) this.bytes.push(x);
  }
  str(s) {
    const enc = new TextEncoder().encode(s);
    this.u16(enc.length);
    for (const x of enc) this.bytes.push(x);
  }
  writePayload(tag) {
    const id = __TAG_IDS[tag.type];
    if (id === undefined) throw new Error('Unknown NBT type: ' + tag.type);
    switch (id) {
      case 1:
        this.i8(tag.value);
        break;
      case 2:
        this.i16(tag.value);
        break;
      case 3:
        this.i32(tag.value);
        break;
      case 4:
        this.i64(tag.value);
        break;
      case 5:
        this.f32(tag.value);
        break;
      case 6:
        this.f64(tag.value);
        break;
      case 7: {
        this.i32(tag.value.length);
        for (const x of tag.value) this.i8(x);
        break;
      }
      case 8:
        this.str(tag.value);
        break;
      case 9: {
        const elemId = __TAG_IDS[tag.value.type] ?? 0;
        this.u8(elemId);
        this.i32(tag.value.value.length);
        for (const item of tag.value.value) {
          if (elemId === 10 || elemId === 9) {
            this.writePayload({ type: tag.value.type, value: item });
          } else {
            this.writePayload({ type: tag.value.type, value: item });
          }
        }
        break;
      }
      case 10: {
        for (const key of Object.keys(tag.value)) {
          const child = tag.value[key];
          this.u8(__TAG_IDS[child.type]);
          this.str(key);
          this.writePayload(child);
        }
        this.u8(0);
        break;
      }
      case 11: {
        this.i32(tag.value.length);
        for (const x of tag.value) this.i32(x);
        break;
      }
      case 12: {
        this.i32(tag.value.length);
        for (const x of tag.value) this.i64(x);
        break;
      }
      default:
        break;
    }
  }
  toUint8Array() {
    return new Uint8Array(this.bytes);
  }
}

function __writeNbtRoot(root) {
  const w = new __NbtWriter();
  w.u8(10);
  w.str(root.name || '');
  w.writePayload({ type: 'compound', value: root.value });
  return w.toUint8Array();
}

function __bigIntReplacer(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value;
}

const nbt = {
  parse: async (u8) => {
    const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8);
    return { parsed: __parseNbtRoot(bytes) };
  },
  writeUncompressed: (parsed) => __writeNbtRoot(parsed),
};

// Upload form submit event listener (guarded: no throw if DOM ids change)
const __uploadForm = document.getElementById('uploadForm');
if (__uploadForm) {
  __uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const __fileInput = document.getElementById('file');
    const file = __fileInput && __fileInput.files ? __fileInput.files[0] : null;
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const buffer = reader.result;
        if (!__pako) throw new Error('pako library not loaded (vendor/pako.min.js missing)');
        const inflatedBuffer = __pako.inflate(new Uint8Array(buffer)); // Decompress NBT data
        const data = await nbt.parse(inflatedBuffer); // Parse NBT data
        const nbt_data = data.parsed.value;

        console.log('Original NBT data:', JSON.stringify(nbt_data, __bigIntReplacer, 2));

        const __targetEl = document.getElementById('targetVersion');
        if (!__targetEl) return;
        const targetVersion = parseInt(__targetEl.value, 10); // Select target version

        // Show warning message when converting to 1.19 or lower
        if (targetVersion <= 3105) {
          const userConfirmed = confirm(
            'Warning: Converting to versions 1.19 or lower may result in corrupted files or unconverted NBT tags. Do you wish to continue?'
          );
          if (!userConfirmed) {
            alert('Conversion cancelled.');
            return;
          }
        }

        nbt_data.MinecraftDataVersion.value = targetVersion; // Update version to target version

        if (targetVersion >= 3953) {
          // For versions 1.21 or higher
          nbt_data.Version.value = 7; // Set NBT version

          // Recursive function to rename Count to count
          const renameCountTags = (obj) => {
            if (typeof obj !== 'object' || obj === null) return;

            for (const key in obj) {
              if (key === 'Count' && obj[key] !== undefined) {
                // Change Count to count
                obj['count'] = { type: 'int', value: obj['Count'].value };
                delete obj['Count'];
              } else if (key === 'BlockEntityTag' && obj[key]?.value?.Items) {
                // Recursively process items in BlockEntityTag
                renameCountTags(obj[key].value.Items);
              } else {
                // Recursively search all objects
                renameCountTags(obj[key]);
              }
            }
          };

          // Function to convert sign text
          const convertSignTags = (obj) => {
            if (typeof obj !== 'object' || obj === null) return;

            for (const key in obj) {
              if (['Text1', 'Text2', 'Text3', 'Text4'].includes(key)) {
                // Convert Text1~Text4 to front_text and back_text
                const messages = ['Text1', 'Text2', 'Text3', 'Text4'].map((textKey) => {
                  return obj[textKey] ? obj[textKey].value : '{"text":""}';
                });

                obj['front_text'] = {
                  type: 'compound',
                  value: {
                    has_glowing_text: {
                      type: 'byte',
                      value: obj['GlowingText'] ? obj['GlowingText'].value : 0,
                    },
                    color: {
                      type: 'string',
                      value: obj['Color'] ? obj['Color'].value : 'black',
                    },
                    messages: {
                      type: 'list',
                      value: {
                        type: 'string',
                        value: messages,
                      },
                    },
                  },
                };

                obj['back_text'] = {
                  type: 'compound',
                  value: {
                    has_glowing_text: {
                      type: 'byte',
                      value: 0,
                    },
                    color: {
                      type: 'string',
                      value: 'black',
                    },
                    messages: {
                      type: 'list',
                      value: {
                        type: 'string',
                        value: ['{"text":""}', '{"text":""}', '{"text":""}', '{"text":""}'],
                      },
                    },
                  },
                };

                // Remove the original text keys
                delete obj['Text1'];
                delete obj['Text2'];
                delete obj['Text3'];
                delete obj['Text4'];
                delete obj['GlowingText'];
                delete obj['Color'];
              } else {
                // Recursively search all objects
                convertSignTags(obj[key]);
              }
            }
          };

          // Function to convert redstone wire tags
          const convertRedstoneWireTags = (obj) => {
            if (typeof obj !== 'object' || obj === null) return;

            if (obj['Name'] && obj['Name'].value === 'minecraft:redstone_wire' && obj['Properties']) {
              const properties = obj['Properties'].value;
              // Maintain the direction information as 'none' or 'side'
              for (const dir of ['north', 'south', 'east', 'west']) {
                if (properties[dir] && properties[dir].value === 'none') {
                  properties[dir].value = 'none';
                } else if (properties[dir] && properties[dir].value === 'side') {
                  properties[dir].value = 'side';
                }
              }
            }

            // Recursively search all objects
            for (const key in obj) {
              convertRedstoneWireTags(obj[key]);
            }
          };

          // Call conversion functions for higher versions
          renameCountTags(nbt_data);
          convertSignTags(nbt_data);
          convertRedstoneWireTags(nbt_data);
        } else {
          // For lower versions
          // Only update MinecraftDataVersion and Version for lower versions
          nbt_data.Version.value = targetVersion >= 3218 && targetVersion < 3463 ? 6 : targetVersion <= 2586 ? 5 : 6;

          // Do not modify other data
        }

        console.log('Modified NBT data:', JSON.stringify(nbt_data, __bigIntReplacer, 2));

        const outputBuffer = __pako.gzip(nbt.writeUncompressed(data.parsed)); // Recompress the data

        const blob = new Blob([outputBuffer], { type: 'application/octet-stream' });
        console.log('Final output blob:', blob);
        const link = document.createElement('a');
        link.href = globalThis.URL.createObjectURL(blob);
        link.download = file.name;
        document.body.appendChild(link);
        link.click(); // Click the download link
        link.remove();
      } catch (error) {
        console.error('Error processing the file:', error);
        alert('An error occurred while processing the file. Please check the console log.');
      }
    };
    reader.readAsArrayBuffer(file); // Read the file
  });
}
