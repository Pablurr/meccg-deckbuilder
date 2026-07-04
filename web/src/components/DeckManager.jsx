import React, { useEffect, useState } from 'react';
import * as api from '../api.js';

export default function DeckManager({ deck, cardIds, quantities, onClose, onLoad, onSaved }) {
  const [decks, setDecks] = useState([]);
  const [name, setName] = useState(deck.name || 'Nouveau deck');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setDecks(await api.listDecks());
  }
  useEffect(() => { refresh().catch(() => {}); }, []);

  async function save() {
    setBusy(true);
    try {
      const payload = { name, cardIds, quantities, backAssignments: deck.backAssignments || {} };
      const saved = deck.id ? await api.updateDeck(deck.id, payload) : await api.createDeck(payload);
      onSaved(saved);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function load(id) {
    const d = await api.getDeck(id);
    onLoad(d);
  }

  async function duplicate(id) {
    const d = await api.getDeck(id);
    await api.createDeck({ name: `${d.name} (copie)`, cardIds: d.cardIds, quantities: d.quantities, backAssignments: d.backAssignments });
    await refresh();
  }

  async function remove(id) {
    await api.deleteDeck(id);
    await refresh();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Mes decks</h2>

        <div className="row">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du deck" />
          <button className="btn" onClick={save} disabled={busy}>
            {deck.id ? 'Enregistrer' : 'Créer'} ({cardIds.length})
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          {deck.id ? `Deck courant : ${deck.name}` : 'Deck non encore sauvegardé'}
        </p>

        <ul className="deck-list">
          {decks.length === 0 && <li className="muted">Aucun deck sauvegardé.</li>}
          {decks.map((d) => (
            <li key={d.id}>
              <span className="name">{d.name} <span className="muted">· {d.count} cartes</span></span>
              <button className="btn secondary" onClick={() => load(d.id)}>Charger</button>
              <button className="btn secondary" onClick={() => duplicate(d.id)}>Dupliquer</button>
              <button className="btn secondary" onClick={() => remove(d.id)}>Suppr.</button>
            </li>
          ))}
        </ul>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}
