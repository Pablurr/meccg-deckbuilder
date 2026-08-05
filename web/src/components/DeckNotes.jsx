import React from 'react';
import { useT } from '../i18n.jsx';

// The four fields mirror a deck primer's natural shape: how you open, your
// resource plan, your hazard plan, then everything else. Notes exist in both
// deckbuilding and freeform modes and are never validated (no length limits,
// no required fields) — see DeckPanel.jsx for how this plugs into the tab.
const FIELDS = ['starting', 'resourceStrategy', 'hazardStrategy', 'other'];

export default function DeckNotes({ notes = {}, onChange }) {
  const t = useT();
  return (
    <div className="deck-notes">
      {FIELDS.map((f) => (
        <label key={f}>
          <span className="label">{t(`notes.${f}`)}</span>
          <textarea rows={4} value={notes[f] || ''} onChange={(e) => onChange(f, e.target.value)} />
        </label>
      ))}
    </div>
  );
}
