import { parseCards } from './lib/parseCards.js';

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

export const listDecks = () => json('/api/decks');
export const getDeck = (id) => json(`/api/decks/${id}`);
export const createDeck = (body) => json('/api/decks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const updateDeck = (id, body) => json(`/api/decks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
export const deleteDeck = (id) => json(`/api/decks/${id}`, { method: 'DELETE' });

export async function uploadBack(file) {
  const fd = new FormData();
  fd.append('file', file);
  return json('/api/backs', { method: 'POST', body: fd });
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

// Triggers a ZIP download (MPC individual images); returns { counts, failures }.
export async function exportDeck({ deckName, cardIds, backAssignments, lang = 'en' }) {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckName, cardIds, backAssignments, lang }),
  });
  if (!res.ok) throw new Error(`export → ${res.status}`);
  const counts = JSON.parse(res.headers.get('X-Export-Counts') || '{}');
  const failures = JSON.parse(res.headers.get('X-Export-Failures') || '[]');
  downloadBlob(await res.blob(), `${safeName(deckName)}_${lang}_MPC.zip`);
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
