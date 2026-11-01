// Bounded ZIP STORE profile. No decompression, ZIP64, encryption or arbitrary paths.
export const PACKAGE_LIMIT = 80 * 1024 * 1024;
const encoder = new TextEncoder();
export function crc32(bytes: Uint8Array) {
  let crc = -1;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ -1) >>> 0;
}
const safe = (name: string) =>
  /^(?:manifest\.json|world\.json|assets\/[a-f0-9-]{36}\.(?:png|webp|jpeg|glb|gltf))$/.test(
    name,
  );
export function writeZip(files: Map<string, Uint8Array>): Uint8Array {
  const chunks: Uint8Array[] = [],
    central: Uint8Array[] = [];
  let offset = 0;
  for (const [path, bytes] of files) {
    if (!safe(path)) throw Error("package_invalid");
    const name = encoder.encode(path),
      local = new Uint8Array(30 + name.length),
      l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint32(14, crc32(bytes), true);
    l.setUint32(18, bytes.length, true);
    l.setUint32(22, bytes.length, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);
    const entry = new Uint8Array(46 + name.length),
      c = new DataView(entry.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint32(16, crc32(bytes), true);
    c.setUint32(20, bytes.length, true);
    c.setUint32(24, bytes.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    entry.set(name, 46);
    chunks.push(local, bytes);
    central.push(entry);
    offset += local.length + bytes.length;
  }
  const directorySize = central.reduce((n, b) => n + b.length, 0),
    end = new Uint8Array(22),
    e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.size, true);
  e.setUint16(10, files.size, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);
  if (offset + directorySize + 22 > PACKAGE_LIMIT) throw Error("package_large");
  const result = new Uint8Array(offset + directorySize + 22);
  let pos = 0;
  for (const b of [...chunks, ...central, end]) {
    result.set(b, pos);
    pos += b.length;
  }
  return result;
}
export function readZip(bytes: Uint8Array): Map<string, Uint8Array> {
  if (bytes.length > PACKAGE_LIMIT) throw Error("package_large");
  try {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      end = bytes.length - 22;
    if (
      end < 0 ||
      v.getUint32(end, true) !== 0x06054b50 ||
      v.getUint32(end + 4, true) !== 0 ||
      v.getUint16(end + 20, true) !== 0
    )
      throw 0;
    const count = v.getUint16(end + 10, true),
      dir = v.getUint32(end + 16, true),
      size = v.getUint32(end + 12, true);
    if (
      !count ||
      count > 42 ||
      count !== v.getUint16(end + 8, true) ||
      dir + size !== end
    )
      throw 0;
    const files = new Map<string, Uint8Array>();
    let p = dir,
      nextLocal = 0;
    for (let i = 0; i < count; i++) {
      if (
        v.getUint32(p, true) !== 0x02014b50 ||
        v.getUint16(p + 8, true) !== 0 ||
        v.getUint16(p + 10, true) !== 0 ||
        v.getUint16(p + 30, true) ||
        v.getUint16(p + 32, true) ||
        v.getUint16(p + 34, true) ||
        v.getUint32(p + 38, true)
      )
        throw 0;
      const n = v.getUint16(p + 28, true),
        len = v.getUint32(p + 24, true),
        offset = v.getUint32(p + 42, true);
      if (
        len !== v.getUint32(p + 20, true) ||
        offset !== nextLocal ||
        p + 46 + n > end
      )
        throw 0;
      const name = new TextDecoder("utf-8", { fatal: true }).decode(
        bytes.subarray(p + 46, p + 46 + n),
      );
      if (
        !safe(name) ||
        files.has(name) ||
        len > 16 * 1024 * 1024 ||
        (name.endsWith(".json") && len > 2 * 1024 * 1024)
      )
        throw 0;
      if (
        v.getUint32(offset, true) !== 0x04034b50 ||
        v.getUint16(offset + 6, true) ||
        v.getUint16(offset + 8, true) ||
        v.getUint16(offset + 28, true) ||
        v.getUint16(offset + 26, true) !== n ||
        v.getUint32(offset + 18, true) !== len ||
        v.getUint32(offset + 22, true) !== len
      )
        throw 0;
      const start = offset + 30 + n;
      if (
        start + len > dir ||
        new TextDecoder().decode(bytes.subarray(offset + 30, start)) !== name
      )
        throw 0;
      const data = bytes.slice(start, start + len),
        crc = crc32(data);
      if (
        v.getUint32(p + 16, true) !== crc ||
        v.getUint32(offset + 14, true) !== crc
      )
        throw 0;
      files.set(name, data);
      nextLocal = start + len;
      p += 46 + n;
    }
    if (p !== end || nextLocal !== dir) throw 0;
    return files;
  } catch {
    throw Error("package_invalid");
  }
}
