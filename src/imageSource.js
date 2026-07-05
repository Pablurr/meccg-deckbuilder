import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// Languages for which card images actually exist (imageBaseUrl keys).
// Note: names exist in en/fr/es/de/nl, but images only in en/es/fr.
export const IMAGE_LANGUAGES = ['en', 'es', 'fr'];

// Build the remote image URL for a card in a language:
//   imageBaseUrl[lang] (ends with "/") + card.image ("Burat.jpg")
// Falls back to en if the requested language has no base URL.
export function imageUrl(card, imageBaseUrls, lang = 'en') {
  const base = (imageBaseUrls[card.setCode] || {});
  const root = base[lang] || base.en || base.fr || base.es;
  if (!root || !card.image) return null;
  return root + card.image;
}

// Fetch a remote image with a simple on-disk cache (keyed by URL hash), so
// repeated exports (and PDF+ZIP of the same deck) don't re-download.
export async function fetchImageBuffer(url, cacheDir) {
  if (cacheDir) {
    const key = crypto.createHash('sha1').update(url).digest('hex');
    const cachePath = path.join(cacheDir, key);
    if (existsSync(cachePath)) return readFile(cachePath);
    const buf = await download(url);
    await mkdir(cacheDir, { recursive: true });
    await writeFile(cachePath, buf);
    return buf;
  }
  return download(url);
}

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Build a resolver getImage(card) -> Promise<Buffer> for a given language.
export function makeImageResolver(imageBaseUrls, lang, cacheDir) {
  return async (card) => {
    const url = imageUrl(card, imageBaseUrls, lang);
    if (!url) throw new Error(`no image URL for ${card.id}`);
    return fetchImageBuffer(url, cacheDir);
  };
}
