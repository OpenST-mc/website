// GitHub contents API 的 Base64 编解码。
export function encodeBase64Bytes(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function encodeBase64Utf8(text) {
  return encodeBase64Bytes(new TextEncoder().encode(text));
}

export function decodeBase64Utf8(content) {
  const binary = atob(String(content).replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
