import { CARD_W_CUT, CARD_H_CUT, CARD_W_BLEED, CARD_H_BLEED, DPI } from '../constants.js';
import { bleedOps } from './bleedOps.js';
import { withPngDpi } from './pngDpi.js';
import { drawProxyOnFace } from './proxyDraw.js';

// Image bytes (JPEG/PNG) -> cut-size (750x1050) face canvas, optionally with
// the proxy stamp baked in. stamp = { lang } | null (self-clone variant: the
// cover is sampled from the face itself, so no swatch is needed).
export async function renderCutFace(bytes, stamp = null) {
  const bmp = await createImageBitmap(new Blob([bytes]));
  const face = document.createElement('canvas');
  face.width = CARD_W_CUT;
  face.height = CARD_H_CUT;
  const fctx = face.getContext('2d');
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(bmp, 0, 0, CARD_W_CUT, CARD_H_CUT);
  bmp.close();
  if (stamp) drawProxyOnFace(fctx, CARD_W_CUT, CARD_H_CUT, stamp);
  return face;
}

// Face bytes -> MPC-ready PNG bytes: resize to the cut size, stamp if asked,
// replicate the edges outward as bleed, tag 300 DPI. Browser-only (canvas).
export async function toMpcPng(bytes, stamp = null) {
  const face = await renderCutFace(bytes, stamp);

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

// Face bytes -> stamped cut-size JPEG bytes (no bleed) for the PDF sheets.
export async function toStampedJpeg(bytes, stamp, quality = 0.92) {
  const face = await renderCutFace(bytes, stamp);
  const blob = await new Promise((resolve, reject) =>
    face.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/jpeg', quality)
  );
  return new Uint8Array(await blob.arrayBuffer());
}
