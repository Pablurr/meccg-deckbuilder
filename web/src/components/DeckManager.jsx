import React, { useEffect, useState } from 'react';
import * as api from '../api.js';
import { useT } from '../i18n.jsx';
import { useIsMobile } from '../lib/useIsMobile.js';
import { deckPayload } from '../lib/deck.js';
import { buildDeckListZip } from '../lib/export/deckListZip.js';
import { buildDeckListText } from '../lib/deckList.js';

export default function DeckManager({ deck, cardIds, quantities, zones, cardsById, uiLang, onClose, onLoad, onSaved, onRenamed }) {
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
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  async function refresh() {
    const rows = await api.listDecks();
    setDecks(rows);
    setSelectedIds((prev) => {
      const alive = new Set(rows.map((r) => r.id));
      const next = new Set([...prev].filter((id) => alive.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }
  useEffect(() => { refresh().catch(() => {}); }, []);

  function toggleSelected(id) {
    setExportDone(false); // the note describes the last export, not the current selection
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setExportDone(false); // the note describes the last export, not the current selection
    setSelectedIds((prev) => (prev.size === decks.length ? new Set() : new Set(decks.map((d) => d.id))));
  }

  // Text lists only: several decks pulling their images at once is a browser
  // memory problem, not a bigger version of the same button. These .txt files
  // paste straight back into the importer, so a batch export doubles as a
  // backup -- which is the reason to reuse buildDeckListText rather than write
  // a second, quietly diverging serialiser here.
  async function exportSelection() {
    setExporting(true);
    setError(null);
    setExportDone(false);
    try {
      const entries = [];
      // Sequential on purpose: reads come from localStorage and the list is
      // short, so ordering the archive like the on-screen list is worth more
      // than parallelism nobody would perceive.
      for (const d of decks) {
        if (!selectedIds.has(d.id)) continue;
        // The open deck is exported from what is on SCREEN, not from what is on
        // disk: the single-deck text export reads App's live quantities/zones,
        // and a batch that read storage instead would put two different lists
        // under one deck name depending on which button produced them. It is
        // also the deck most likely to be ticked with unsaved edits in it.
        let full;
        if (d.id === deck.id) {
          full = { ...deck, quantities, zones };
        } else {
          // A deck deleted between the click and its turn in this loop must cost
          // the user that one deck, not the whole archive: getDeck throws rather
          // than returning undefined, so an uncaught read would discard every
          // deck already gathered.
          try {
            full = await api.getDeck(d.id);
          } catch {
            continue;
          }
        }
        entries.push({
          name: full.name,
          text: buildDeckListText(cardsById, full.quantities || {}, full.name, uiLang, {
            zones: full.zones, notes: full.notes, mode: full.mode, ruleset: full.ruleset,
          }),
        });
      }
      // Every ticked deck vanished before its turn: writing an empty archive
      // would be a lie about what got exported, so just stop here. `finally`
      // still clears `exporting`.
      if (entries.length === 0) return;
      const bytes = await buildDeckListZip(entries);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `decks-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportDone(true);
    } catch (e) {
      setError(t('common.error', { msg: e.message }));
    } finally {
      setExporting(false);
    }
  }

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
      const saved = await api.updateDeck(id, { name: value });
      // Renaming the deck that is currently open moves what is on disk without
      // moving anything in App -- which left the header showing the old name and
      // the Save button claiming the two agreed. The next save then wrote
      // deck.name back over the rename.
      if (id === deck.id) onRenamed(saved);
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
      const payload = deckPayload({ deck, cardIds, quantities, zones, name });
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

        {decks.length > 0 && (
          <div className="row deck-select-bar">
            <label style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedIds.size === decks.length}
                onChange={toggleAll}
              />
              {' '}{t('decks.selectAll')}
            </label>
            <span className="spacer" />
            {exportDone && <span className="muted">✅ {t('decks.exportDone')}</span>}
            <button
              className="btn secondary"
              onClick={exportSelection}
              disabled={exporting || selectedIds.size === 0}
            >{t('decks.exportSelection')} ({selectedIds.size})</button>
          </div>
        )}

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
                <input
                  type="checkbox"
                  className="deck-select"
                  checked={selectedIds.has(d.id)}
                  onChange={() => toggleSelected(d.id)}
                  aria-label={t('decks.selectDeck')}
                />
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
