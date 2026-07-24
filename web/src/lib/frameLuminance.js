// On-screen label-colour sampler: measures the mean luminance of the frame
// region that ends up behind the "Proxy" label (the clone source strip) and
// picks the label colour from it — so the choice matches what the card actually
// looks like, not a category guess. Results are cached per card id.
//
// Sampling loads a CORS-clean image (the wsrv thumbnail proxy sets
// Access-Control-Allow-Origin: *) into a crossOrigin <img> so the canvas stays
// readable; a tainted/failed read falls back to the category colour. Only the
// currently-previewed card (hover / modal) is sampled, so this stays cheap.
import { cloneSrcFor, labelColor, labelColorForLum } from './proxy.js';

const _canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
if (_canvas) {
  _canvas.width = 24;
  _canvas.height = 6;
}
const _ctx = _canvas ? _canvas.getContext('2d', { willReadFrequently: true }) : null;

const _lumCache = new Map(); // card.id -> mean luminance [0..255]
const _pending = new Map(); // card.id -> Promise<color>

// Mean luminance of `src` (card-fraction rect) of a loaded image, or null if the
// image isn't ready or the canvas is tainted.
function measure(img, src) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih || !_ctx) return null;
  const W = _canvas.width;
  const H = _canvas.height;
  try {
    _ctx.clearRect(0, 0, W, H);
    _ctx.drawImage(img, src.x * iw, src.y * ih, Math.max(1, src.w * iw), Math.max(1, src.h * ih), 0, 0, W, H);
    const data = _ctx.getImageData(0, 0, W, H).data;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n++;
    }
    return n ? sum / n : null;
  } catch {
    return null; // tainted canvas — give up, caller uses the category fallback
  }
}

// Sync: luminance-based colour if this card was already sampled, else null.
export function cachedLabelColor(card) {
  if (!card) return null;
  const lum = _lumCache.get(card.id);
  return lum == null ? null : labelColorForLum(lum);
}

// Async: resolve the label colour for `card`, sampling `url` (a CORS-clean image,
// e.g. the thumbnail) once and caching it. Falls back to the category colour when
// sampling is unavailable.
export function ensureLabelColor(card, lang, url) {
  if (!card) return Promise.resolve(labelColor(card));
  if (_lumCache.has(card.id)) return Promise.resolve(labelColorForLum(_lumCache.get(card.id)));
  if (_pending.has(card.id)) return _pending.get(card.id);
  const src = cloneSrcFor(card, lang);
  const p = new Promise((resolve) => {
    if (!url || !_ctx) return resolve(labelColor(card));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const lum = measure(img, src);
      if (lum == null) return resolve(labelColor(card));
      _lumCache.set(card.id, lum);
      resolve(labelColorForLum(lum));
    };
    img.onerror = () => resolve(labelColor(card));
    img.src = url;
  }).finally(() => _pending.delete(card.id));
  _pending.set(card.id, p);
  return p;
}
