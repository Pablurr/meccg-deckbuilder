import { rectForLang, PROXY_LABEL } from '../proxy.js';

// Bake the proxy stamp into a cut-size face: swatch texture stretched over the
// covered rect, "Proxy" centred on top. Browser-only (canvas 2d ctx).
// If the swatch bitmap is missing, fill with the average of the pixels already
// under the rect — proxy mode must never leave the notice visible.
export function drawProxyOnFace(ctx, w, h, swatchBmp, lang) {
  const r = rectForLang(lang);
  const x = Math.round(r.x * w);
  const y = Math.round(r.y * h);
  const rw = Math.round(r.w * w);
  const rh = Math.round(r.h * h);
  if (swatchBmp) {
    ctx.drawImage(swatchBmp, x, y, rw, rh);
  } else {
    const data = ctx.getImageData(x, y, rw, rh).data;
    let R = 0, G = 0, B = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) { R += data[i]; G += data[i + 1]; B += data[i + 2]; }
    ctx.fillStyle = `rgb(${Math.round(R / n)},${Math.round(G / n)},${Math.round(B / n)})`;
    ctx.fillRect(x, y, rw, rh);
  }
  ctx.fillStyle = '#cfcdc6';
  ctx.font = `${Math.round(rh * 0.62)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(PROXY_LABEL, x + rw / 2, y + rh / 2 + 1);
}

// Fetch + decode the swatch PNGs once per export. A failed swatch maps to
// null so drawProxyOnFace falls back to the averaged fill.
export async function loadSwatchBitmaps(keys) {
  const out = new Map();
  await Promise.all([...keys].map(async (key) => {
    try {
      const res = await fetch(`/proxy-swatches/${key}.png`);
      if (!res.ok) throw new Error(String(res.status));
      out.set(key, await createImageBitmap(await res.blob()));
    } catch {
      out.set(key, null);
    }
  }));
  return out;
}

// Free the decoded swatch bitmaps once an export has consumed them.
export function closeSwatchBitmaps(bitmaps) {
  for (const bmp of bitmaps.values()) if (bmp) bmp.close();
}
