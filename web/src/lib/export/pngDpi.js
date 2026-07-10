// Inject a pHYs chunk so exported PNGs carry the print DPI, matching the
// old server pipeline (sharp's withMetadata({ density })). Canvas-produced
// PNGs never contain a pHYs chunk, and the PNG spec guarantees IHDR is the
// first chunk, so inserting at byte 33 (8 signature + 25 IHDR) is safe.

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function withPngDpi(png, dpi) {
  const ppm = Math.round(dpi / 0.0254); // pixels per meter
  const chunk = new Uint8Array(21); // 4 length + 4 type + 9 data + 4 crc
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
  dv.setUint32(8, ppm);
  dv.setUint32(12, ppm);
  chunk[16] = 1; // unit: meter
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));

  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, 33), 0); // signature + IHDR
  out.set(chunk, 33);
  out.set(png.subarray(33), 33 + chunk.length);
  return out;
}
