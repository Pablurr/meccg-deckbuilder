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

// On-disk path for a card's image in a language, or null when that language
// has no local image tree. `en` uses the remastered nested layout
// (roots.en/<relativePath>, e.g. as/minions/Burat.jpg); `fr` uses the flat
// per-set layout (roots.fr/<setDir>/<image>, e.g. as/Burat.jpg). Any other
// language (es, …) has no local copy and returns null.
export function localImagePath(card, lang, roots = {}) {
  if (lang === 'en' && roots.en && card.relativePath) {
    return path.join(roots.en, card.relativePath);
  }
  if (lang === 'fr' && roots.fr && card.image) {
    const setDir = (card.relativePath || '').split('/')[0];
    if (setDir) return path.join(roots.fr, setDir, card.image);
  }
  return null;
}

// Resolver that prefers a local image file and only downloads from the CDN
// (with disk cache) when there is no local copy — e.g. Spanish, or a card
// missing from the local set. Keeps en/fr exports fully offline and fast.
export function makeLocalImageResolver(imageBaseUrls, lang, cacheDir, roots) {
  const remote = makeImageResolver(imageBaseUrls, lang, cacheDir);
  return async (card) => {
    const local = localImagePath(card, lang, roots);
    if (local && existsSync(local)) return readFile(local);
    return remote(card);
  };
}
