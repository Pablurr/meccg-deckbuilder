// Shared image fetching for the in-browser exports.

export async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

// Front image bytes for a card in a language, falling back to English when
// the localized file is missing (matches the on-screen <img> fallback).
export async function fetchCardImageBytes(card, lang = 'en') {
  const base = card.imageBaseUrl || {};
  const root = base[lang] || base.en;
  if (!root || !card.image) throw new Error(`no image URL for ${card.id}`);
  try {
    return await fetchBytes(root + card.image);
  } catch (e) {
    if (base.en && root !== base.en) return fetchBytes(base.en + card.image);
    throw e;
  }
}

export function dataUrlToBytes(dataUrl) {
  const b64 = String(dataUrl).split(',')[1] || '';
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Map fn over items with at most `limit` in flight; preserves order.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
