import { parseCards } from './lib/parseCards.js';
import { createDeckStore } from './lib/deckStore.js';
import { CARD_W_CUT, CARD_H_CUT } from './lib/constants.js';
import { fetchBytes, fetchCardImageBytes, dataUrlToBytes, mapLimit } from './lib/export/images.js';
import { toMpcPng } from './lib/export/bleedCanvas.js';
import { buildDeckZip } from './lib/export/zip.js';

async function json(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${opts?.method || 'GET'} ${url} → ${res.status}`);
  return res.json();
}

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
      cache.set(card.id, { bytes: await process(await fetchCardImageBytes(card, lang)) });
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

// Builds the MPC ZIP in the browser and triggers the download.
export async function exportDeck({ deckName, cardIds, backAssignments, lang = 'en' }) {
  const index = requireIndex();
  const cards = cardIds.map((id) => index.get(id)).filter(Boolean);
  const getFrontPng = await prefetchFronts(cards, lang, toMpcPng);
  const getBackBytes = makeGetBackBytes(backAssignments);
  const getBackPng = async (group) => toMpcPng(await getBackBytes(group));
  const { bytes, counts, failures } = await buildDeckZip({ deckName, cards, getFrontPng, getBackPng });
  downloadBlob(new Blob([bytes], { type: 'application/zip' }), `${safeName(deckName)}_${lang}_MPC.zip`);
  return { counts, failures };
}

// Triggers a PDF sheet download (letter/a4/a3); returns { pages, failures }.
export async function exportPdf({ deckName, cardIds, backAssignments, includeBacks, format = 'letter', lang = 'en' }) {
  const res = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckName, cardIds, backAssignments, includeBacks, format, lang }),
  });
  if (!res.ok) throw new Error(`export-pdf → ${res.status}`);
  const pages = Number(res.headers.get('X-Export-Pages') || '0');
  const failures = JSON.parse(res.headers.get('X-Export-Failures') || '[]');
  downloadBlob(await res.blob(), `${safeName(deckName)}_${format}_${lang}_sheets.pdf`);
  return { pages, failures };
}
