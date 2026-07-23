import { parseCards } from './lib/parseCards.js';
import { createDeckStore } from './lib/deckStore.js';
import { CARD_W_CUT, CARD_H_CUT } from './lib/constants.js';
import { fetchBytes, fetchCardImageBytes, dataUrlToBytes, mapLimit } from './lib/export/images.js';
import { toMpcPng, toStampedJpeg } from './lib/export/bleedCanvas.js';
import { buildDeckZip } from './lib/export/zip.js';
import { buildSheetPdf } from './lib/export/pdf.js';
import { swatchKeyForCard } from './lib/proxy.js';
import { loadSwatchBitmaps, closeSwatchBitmaps } from './lib/export/proxyDraw.js';

let _index = null; // id -> card, set by getCards(); used by the export functions

export async function getCards() {
  const res = await fetch('/cards.json');
  if (!res.ok) throw new Error(`GET /cards.json → ${res.status}`);
  const { cards, facets, index } = parseCards(await res.json());
  _index = index;
  return { cards, facets, defaultBacks: { playdeck: true, locationdeck: true } };
}

export function requireIndex() {
  if (!_index) throw new Error('cards not loaded yet');
  return _index;
}

const store = createDeckStore();

export const listDecks = () => store.list();
export const getDeck = (id) => store.get(id);
export const createDeck = (body) => store.create(body || {});
export const updateDeck = (id, body) => store.update(id, body || {});
export const deleteDeck = async (id) => {
  await store.remove(id);
  return { ok: true };
};

// Custom back: normalized in the browser to a cut-size JPEG data URL and
// stored with the deck (bounded size, fits in localStorage).
export async function uploadBack(file) {
  const bmp = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W_CUT;
  canvas.height = CARD_H_CUT;
  canvas.getContext('2d').drawImage(bmp, 0, 0, CARD_W_CUT, CARD_H_CUT);
  bmp.close();
  return { path: canvas.toDataURL('image/jpeg', 0.9) };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const safeName = (s) => (s || 'deck').replace(/[^a-zA-Z0-9_-]+/g, '_');

const DEFAULT_BACK_URLS = {
  playdeck: '/card-backs/CardBack300dpi.png',
  locationdeck: '/card-backs/SiteCardBack300dpi.png',
};

// Back image bytes per group: custom data URL if assigned, else shipped default.
// Legacy non-dataURL assignments (old server paths) fall back to the default.
function makeGetBackBytes(backAssignments = {}) {
  return async (group) => {
    const v = backAssignments[group];
    if (v && String(v).startsWith('data:')) return dataUrlToBytes(v);
    return fetchBytes(DEFAULT_BACK_URLS[group]);
  };
}

// Fetch + process each unique card's front once (copies reuse it), with
// bounded concurrency. Returns a lookup that throws for failed cards.
async function prefetchFronts(cards, lang, process) {
  const unique = [...new Map(cards.map((c) => [c.id, c])).values()];
  const cache = new Map();
  await mapLimit(unique, 6, async (card) => {
    try {
      cache.set(card.id, { bytes: await process(await fetchCardImageBytes(card, lang), card) });
    } catch (e) {
      cache.set(card.id, { error: e });
    }
  });
  return (card) => {
    const r = cache.get(card.id);
    if (!r) throw new Error(`no image for ${card.id}`);
    if (r.error) throw r.error;
    return r.bytes;
  };
}

// (card) => { swatchBmp, lang } | null. Null when proxy mode is off or the
// card takes no stamp (Regions). Loads only the swatches this deck needs.
// Returns { stampFor, closeSwatches } so callers can free the bitmaps after export.
async function makeStampFor(cards, lang, proxyMode) {
  if (!proxyMode) return { stampFor: () => null, closeSwatches: () => {} };
  const keys = new Set(cards.map(swatchKeyForCard).filter(Boolean));
  const swatches = await loadSwatchBitmaps(keys);
  return {
    stampFor: (card) => {
      const key = swatchKeyForCard(card);
      return key ? { swatchBmp: swatches.get(key), lang } : null;
    },
    closeSwatches: () => closeSwatchBitmaps(swatches),
  };
}

// Builds the MPC ZIP in the browser and triggers the download.
export async function exportDeck({ deckName, cardIds, backAssignments, lang = 'en', proxyMode = false }) {
  const index = requireIndex();
  const cards = cardIds.map((id) => index.get(id)).filter(Boolean);
  const { stampFor, closeSwatches } = await makeStampFor(cards, lang, proxyMode);
  try {
    const getFrontPng = await prefetchFronts(cards, lang, (bytes, card) => toMpcPng(bytes, stampFor(card)));
    const getBackBytes = makeGetBackBytes(backAssignments);
    const getBackPng = async (group) => toMpcPng(await getBackBytes(group)); // backs are never stamped
    const { bytes, counts, failures } = await buildDeckZip({ deckName, cards, getFrontPng, getBackPng });
    downloadBlob(new Blob([bytes], { type: 'application/zip' }), `${safeName(deckName)}_${lang}_MPC.zip`);
    return { counts, failures };
  } finally {
    closeSwatches();
  }
}

// Builds the print-sheet PDF in the browser and triggers the download.
export async function exportPdf({ deckName, cardIds, backAssignments, includeBacks, format = 'letter', lang = 'en', proxyMode = false }) {
  const index = requireIndex();
  const cards = cardIds.map((id) => index.get(id)).filter(Boolean);
  const { stampFor, closeSwatches } = await makeStampFor(cards, lang, proxyMode);
  try {
    // Proxy off: raw CDN bytes, the PDF scales them (no resampling — unchanged).
    // Proxy on: bake the stamp into a cut-size JPEG face instead.
    const getFrontBytes = await prefetchFronts(cards, lang, (bytes, card) => {
      const stamp = stampFor(card);
      return stamp ? toStampedJpeg(bytes, stamp) : bytes;
    });
    const { bytes, failures, pageCount } = await buildSheetPdf({
      cards,
      getFrontBytes,
      getBackBytes: makeGetBackBytes(backAssignments),
      includeBacks,
      format,
    });
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${safeName(deckName)}_${format}_${lang}_sheets.pdf`);
    return { pages: pageCount, failures };
  } finally {
    closeSwatches();
  }
}
