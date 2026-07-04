async function json(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${opts?.method || 'GET'} ${url} → ${res.status}`);
  return res.json();
}

export const getCards = () => json('/api/cards');

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

// Triggers a ZIP download; returns { counts, failures } from response headers.
export async function exportDeck({ deckName, cardIds, backAssignments }) {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deckName, cardIds, backAssignments }),
  });
  if (!res.ok) throw new Error(`export → ${res.status}`);
  const counts = JSON.parse(res.headers.get('X-Export-Counts') || '{}');
  const failures = JSON.parse(res.headers.get('X-Export-Failures') || '[]');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(deckName || 'deck').replace(/[^a-zA-Z0-9_-]+/g, '_')}_MPC.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { counts, failures };
}
