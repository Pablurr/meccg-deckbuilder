import { rectForLang, cloneSrcForLang, PROXY_LABEL, LABEL_ON_DARK } from '../proxy.js';

// Bake the proxy stamp into a cut-size face (SELF-CLONE variant): sample a clean
// band segment of the face itself and stretch it over the covered zone, then
// draw "Proxy" (bold) centred. Browser-only (canvas 2d ctx). No assets, no
// fetch — the cover colour/texture comes from the card's own frame. `color` is
// the label colour (dark on light frames, light on dark frames).
export function drawProxyOnFace(ctx, w, h, lang, color = LABEL_ON_DARK) {
  const r = rectForLang(lang);
  const s = cloneSrcForLang(lang);
  const dx = Math.round(r.x * w);
  const dy = Math.round(r.y * h);
  const dw = Math.round(r.w * w);
  const dh = Math.round(r.h * h);
  const sx = Math.round(s.x * w);
  const sw = Math.round(s.w * w);
  // Source and dest never overlap (source is a clean band strip beside the
  // zone), so drawing the canvas onto itself is safe.
  ctx.drawImage(ctx.canvas, sx, dy, sw, dh, dx, dy, dw, dh);
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(dh * 0.62)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(PROXY_LABEL, dx + dw / 2, dy + dh / 2 + 1);
}
