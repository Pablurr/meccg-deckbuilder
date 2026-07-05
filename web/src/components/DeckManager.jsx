import React, { useEffect, useState } from 'react';
import * as api from '../api.js';
import { useT } from '../i18n.jsx';

export default function DeckManager({ deck, cardIds, quantities, onClose, onLoad, onSaved }) {
  const t = useT();
  const [decks, setDecks] = useState([]);
  const [name, setName] = useState(deck.name || t('app.newDeck'));
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
    await api.createDeck({ name: `${d.name} ${t('decks.copySuffix')}`, cardIds: d.cardIds, quantities: d.quantities, backAssignments: d.backAssignments });
    await refresh();
  }

  async function remove(id) {
    await api.deleteDeck(id);
    await refresh();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('decks.title')}</h2>

        <div className="row">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('decks.namePlaceholder')} />
          <button className="btn" onClick={save} disabled={busy}>
            {deck.id ? t('decks.save') : t('decks.create')} ({cardIds.length})
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          {deck.id ? t('decks.current', { name: deck.name }) : t('decks.notSaved')}
        </p>

        <ul className="deck-list">
          {decks.length === 0 && <li className="muted">{t('decks.none')}</li>}
          {decks.map((d) => (
            <li key={d.id}>
              <span className="name">{d.name} <span className="muted">· {t('decks.cardsCount', { n: d.count })}</span></span>
              <button className="btn secondary" onClick={() => load(d.id)}>{t('decks.load')}</button>
              <button className="btn secondary" onClick={() => duplicate(d.id)}>{t('decks.duplicate')}</button>
              <button className="btn secondary" onClick={() => remove(d.id)}>{t('decks.delete')}</button>
            </li>
          ))}
        </ul>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
