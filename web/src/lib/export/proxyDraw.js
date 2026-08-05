import {
  PROXY_PATCH_RECT, PROXY_LABEL_FONT_FRAC, PROXY_LABEL_POS, patchUrl,
} from '../proxy.js';

// Bake the proxy stamp into a cut-size face: the frame patch drawn over the
// copyright / set-name zone, the label in Arial Bold on top. Browser-only
// (canvas 2d ctx). If the patch bitmap is missing, fill with the average of the
// pixels already under the rect — the notice must never survive the export.
// The label text and colour are decided by proxyStampFor, never here: this
// function draws what it is handed.
export function drawProxyOnFace(ctx, w, h, patchBmp, text, color) {
  const r = PROXY_PATCH_RECT;
  const x = Math.round(r.x * w);
  const y = Math.round(r.y * h);
  const rw = Math.round(r.w * w);
  const rh = Math.round(r.h * h);
  if (patchBmp) {
    ctx.drawImage(patchBmp, x, y, rw, rh);
  } else {
    const data = ctx.getImageData(x, y, rw, rh).data;
    let R = 0, G = 0, B = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) { R += data[i]; G += data[i + 1]; B += data[i + 2]; }
    ctx.fillStyle = `rgb(${Math.round(R / n)},${Math.round(G / n)},${Math.round(B / n)})`;
    ctx.fillRect(x, y, rw, rh);
  }
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(PROXY_LABEL_FONT_FRAC * w)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, PROXY_LABEL_POS.cx * w, PROXY_LABEL_POS.cy * h);
}

// Fetch + decode the patch PNGs once per export, in the export's image language.
// A failed patch maps to null so drawProxyOnFace falls back to the averaged fill.
export async function loadPatchBitmaps(keys, lang) {
  const out = new Map();
  await Promise.all([...keys].map(async (key) => {
    try {
      const res = await fetch(patchUrl(key, lang));
      if (!res.ok) throw new Error(String(res.status));
      out.set(key, await createImageBitmap(await res.blob()));
    } catch {
      out.set(key, null);
    }
  }));
  return out;
}

// Free the decoded patch bitmaps once an export has consumed them.
export function closePatchBitmaps(bitmaps) {
  for (const bmp of bitmaps.values()) if (bmp) bmp.close();
}
