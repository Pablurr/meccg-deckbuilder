import React, { useEffect, useState } from 'react';
import * as api from '../api.js';
import { useT } from '../i18n.jsx';
import { useIsMobile } from '../lib/useIsMobile.js';

export default function DeckManager({ deck, cardIds, quantities, zones, onClose, onLoad, onSaved }) {
  const t = useT();
  const isMobile = useIsMobile();
  const [decks, setDecks] = useState([]);
  const [name, setName] = useState(deck.name || t('app.newDeck'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmId, setConfirmId] = useState(null); // deck id awaiting delete confirmation
  const [renamingId, setRenamingId] = useState(null); // deck id whose name is being edited inline
  const [renameValue, setRenameValue] = useState('');
  const [dragIndex, setDragIndex] = useState(null); // index of the row currently being dragged (desktop reorder)

  async function refresh() {
    setDecks(await api.listDecks());
  }
  useEffect(() => { refresh().catch(() => {}); }, []);

  function startRename(d) {
    setRenamingId(d.id);
    setRenameValue(d.name);
  }

  function cancelRename() {
    setRenamingId(null);
  }

  async function commitRename(id) {
    const value = renameValue.trim();
    setRenamingId(null);
    if (!value) return; // empty name: cancel silently rather than saving a blank one
    try {
      await api.updateDeck(id, { name: value });
      await refresh();
    } catch (e) {
      setError(e.message === 'storage-full' ? t('decks.storageFull') : t('common.error', { msg: e.message }));
    }
  }

  // Persists a manual order across the whole list in one pass: every row gets
  // an explicit `order` (1-based index), so decks created before the field
  // (order === null) get a stable position too, instead of drifting with
  // updatedAt. api.reorderDecks does one read-modify-write of the whole
  // store, so this is atomic — a storage-full failure leaves the stored
  // order completely unchanged rather than half-applied. We still refresh
  // from storage on failure so the UI reflects what's actually on disk
  // rather than the optimistic (rolled-back) in-memory order.
  async function persistOrder(nextDecks) {
    setDecks(nextDecks);
    try {
      await api.reorderDecks(nextDecks.map((r) => r.id));
      await refresh();
    } catch (e) {
      setError(e.message === 'storage-full' ? t('decks.storageFull') : t('common.error', { msg: e.message }));
      await refresh().catch(() => {});
    }
  }

  function moveTo(from, to) {
    if (from === to || from < 0 || to < 0 || from >= decks.length || to >= decks.length) return;
    const next = decks.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persistOrder(next);
  }

  function moveUp(index) {
    if (index > 0) moveTo(index, index - 1);
  }

  function moveDown(index) {
    if (index < decks.length - 1) moveTo(index, index + 1);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name, cardIds, quantities, backAssignments: deck.backAssignments || {},
        mode: deck.mode, ruleset: deck.ruleset, zones, notes: deck.notes, order: deck.order,
      };
      const saved = deck.id ? await api.updateDeck(deck.id, payload) : await api.createDeck(payload);
      onSaved(saved);
      await refresh();
    } catch (e) {
      setError(e.message === 'storage-full' ? t('decks.storageFull') : t('common.error', { msg: e.message }));
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
    await api.createDeck({
      name: `${d.name} ${t('decks.copySuffix')}`,
      cardIds: d.cardIds,
      quantities: d.quantities,
      backAssignments: d.backAssignments,
      mode: d.mode,
      ruleset: d.ruleset,
      zones: d.zones,
      notes: d.notes,
      // `order` is intentionally omitted: it's the deck's manual position in
      // the saved-deck list, and copying it verbatim would collide with the
      // original's position. Leaving it unset makes the copy behave like any
      // other newly created deck — it sorts after ordered decks, by
      // updatedAt descending, so it lands near the top of the unordered
      // group instead of fighting the original for the same slot.
    });
    await refresh();
  }

  async function remove(id) {
    await api.deleteDeck(id);
    setConfirmId(null);
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
        {error && <p style={{ color: 'var(--danger)', marginTop: 0 }}>{error}</p>}

        <ul className="deck-list">
          {decks.length === 0 && <li className="muted">{t('decks.none')}</li>}
          {decks.map((d, i) => {
            const sideKey = d.mode === 'deckbuilding' ? d.side : 'freeform';
            return (
              <li
                key={d.id}
                draggable={!isMobile}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex != null) moveTo(dragIndex, i);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
              >
                {isMobile && (
                  <span className="order-btns">
                    <button className="btn secondary small" disabled={i === 0} onClick={() => moveUp(i)} aria-label={t('decks.moveUp')}>▲</button>
                    <button className="btn secondary small" disabled={i === decks.length - 1} onClick={() => moveDown(i)} aria-label={t('decks.moveDown')}>▼</button>
                  </span>
                )}
                {renamingId === d.id ? (
                  <input
                    autoFocus
                    type="text"
                    className="name"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(d.id);
                      else if (e.key === 'Escape') cancelRename();
                    }}
                  />
                ) : (
                  <span className="name" onClick={() => startRename(d)}>
                    {d.name} <span className="muted">· {t('decks.cardsCount', { n: d.count })}</span>
                  </span>
                )}
                <span className={`side-badge ${sideKey}`}>{t(`side.${sideKey}`)}</span>
                {confirmId === d.id ? (
                  <>
                    <span className="muted">{t('decks.confirmDelete', { name: d.name })}</span>
                    <button className="btn danger small" onClick={() => remove(d.id)}>{t('panel.remove')}</button>
                    <button className="btn secondary small" onClick={() => setConfirmId(null)}>{t('common.cancel')}</button>
                  </>
                ) : (
                  <>
                    <button className="btn secondary" onClick={() => load(d.id)}>{t('decks.load')}</button>
                    <button className="btn secondary" onClick={() => duplicate(d.id)}>{t('decks.duplicate')}</button>
                    <button className="btn secondary" onClick={() => setConfirmId(d.id)}>{t('decks.delete')}</button>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
}
