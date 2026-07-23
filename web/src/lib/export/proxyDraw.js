import { rectForLang, PROXY_LABEL, LABEL_ON_DARK } from '../proxy.js';

// stamp.rect is the resolved covered zone (torn-edge FR sites drop it a few px);
// fall back to the language default for older callers.

// Bake the proxy stamp into a cut-size face (SELF-CLONE variant): sample a clean
// band segment of the face itself and stretch it over the covered zone, then
// draw "Proxy" (bold) centred. Browser-only (canvas 2d ctx). No assets, no
// fetch — the cover colour/texture comes from the card's own frame.
// stamp = { lang, src: {x,y,w,h}, color }: `src` is the resolved clone source
// rect (torn-edge sites sample a clean higher strip); `color` is the label
// colour (dark on light frames, light on dark frames).
export function drawProxyOnFace(ctx, w, h, stamp) {
  const r = stamp.rect || rectForLang(stamp.lang);
  const s = stamp.src;
  const color = stamp.color || LABEL_ON_DARK;
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
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(dh * 0.62)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(PROXY_LABEL, dx + dw / 2, dy + dh / 2 + 1);
}
