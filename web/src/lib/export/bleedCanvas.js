import { CARD_W_CUT, CARD_H_CUT, CARD_W_BLEED, CARD_H_BLEED, DPI } from '../constants.js';
import { bleedOps } from './bleedOps.js';
import { withPngDpi } from './pngDpi.js';

// Image bytes (JPEG/PNG) -> MPC-ready PNG bytes: resize to the cut size,
// replicate the edges outward as bleed, tag 300 DPI. Browser-only (canvas).
export async function toMpcPng(bytes) {
  const bmp = await createImageBitmap(new Blob([bytes]));
  const face = document.createElement('canvas');
  face.width = CARD_W_CUT;
  face.height = CARD_H_CUT;
  const fctx = face.getContext('2d');
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(bmp, 0, 0, CARD_W_CUT, CARD_H_CUT);
  bmp.close();

  const out = document.createElement('canvas');
  out.width = CARD_W_BLEED;
  out.height = CARD_H_BLEED;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false; // exact pixel replication for the bleed strips
  for (const o of bleedOps()) ctx.drawImage(face, o.sx, o.sy, o.sw, o.sh, o.dx, o.dy, o.dw, o.dh);

  const blob = await new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png')
  );
  return withPngDpi(new Uint8Array(await blob.arrayBuffer()), DPI);
}
