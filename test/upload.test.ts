import { describe, it, expect } from 'vitest';
import { validateUploadFile, MAX_UPLOAD_BYTES, IMAGE_EXTENSIONS, ARCHIVE_EXTENSIONS } from '../src/lib/upload.ts';

function fakeFile(name: string, size: number, type = ''): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('validateUploadFile', () => {
  it('accepts allowed extensions case-insensitively', () => {
    expect(
      validateUploadFile(fakeFile('a.litematic', 1024), { extensions: ARCHIVE_EXTENSIONS, label: '存档文件' }),
    ).toBeNull();
    expect(
      validateUploadFile(fakeFile('A.ZIP', 1024), { extensions: ARCHIVE_EXTENSIONS, label: '存档文件' }),
    ).toBeNull();
    expect(
      validateUploadFile(fakeFile('p.WEBP', 1024, 'image/webp'), { extensions: IMAGE_EXTENSIONS, label: '预览图' }),
    ).toBeNull();
  });

  it('rejects disallowed extensions with a readable message', () => {
    const msg = validateUploadFile(fakeFile('a.exe', 10), { extensions: ARCHIVE_EXTENSIONS, label: '存档文件' });
    expect(msg).toContain('格式');
    expect(msg).toContain('.litematic');
  });

  it('rejects files above the 50MB limit', () => {
    const msg = validateUploadFile(fakeFile('big.litematic', MAX_UPLOAD_BYTES + 1), {
      extensions: ARCHIVE_EXTENSIONS,
      label: '存档文件',
    });
    expect(msg).toContain('50MB');
  });

  it('accepts exactly 50MB', () => {
    expect(
      validateUploadFile(fakeFile('exact.litematic', MAX_UPLOAD_BYTES), {
        extensions: ARCHIVE_EXTENSIONS,
        label: '存档文件',
      }),
    ).toBeNull();
  });

  it('is case-insensitive for extension matching', () => {
    expect(
      validateUploadFile(fakeFile('x.Litematic', 1), { extensions: ARCHIVE_EXTENSIONS, label: '存档文件' }),
    ).toBeNull();
  });
});
