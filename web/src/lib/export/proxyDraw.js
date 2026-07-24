import { rectForLang, PROXY_LABEL, labelColorForLum } from '../proxy.js';

// Mean luminance [0..255] of a canvas region (own bytes, never tainted here).
function regionLuminance(ctx, x, y, w, h) {
  const data = ctx.getImageData(x, y, w, h).data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    n++;
  }
  return n ? sum / n : 0;
}

// Bake the proxy stamp into a cut-size face (SELF-CLONE variant): sample a clean
// band segment of the face itself and stretch it over the covered zone, then
// draw "Proxy" (bold) centred. Browser-only (canvas 2d ctx). No assets, no
// fetch — the cover colour/texture comes from the card's own frame. The label
// colour is chosen from the ACTUAL luminance of the pasted patch (authoritative,
// per card), so it stays legible whatever the frame turns out to be.
// stamp = { lang, rect: {x,y,w,h}, src: {x,y,w,h} }.
export function drawProxyOnFace(ctx, w, h, stamp) {
  const r = stamp.rect || rectForLang(stamp.lang);
  const s = stamp.src;
  const dx = Math.round(r.x * w);
  const dy = Math.round(r.y * h);
  const dw = Math.round(r.w * w);
  const dh = Math.round(r.h * h);
  const sx = Math.round(s.x * w);
  const sy = Math.round(s.y * h);
  const sw = Math.round(s.w * w);
  const sh = Math.round(s.h * h);
  // Source and dest never share pixels (the source strip is either beside the
  // zone or a clean row above it), so drawing the canvas onto itself is safe.
  ctx.drawImage(ctx.canvas, sx, sy, sw, sh, dx, dy, dw, dh);
  const color = labelColorForLum(regionLuminance(ctx, dx, dy, dw, dh));
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(dh * 0.62)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(PROXY_LABEL, dx + dw / 2, dy + dh / 2 + 1);
}
