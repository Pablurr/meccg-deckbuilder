import React, { useMemo, useState } from 'react';
import { parseDeckList, buildNameIndex, resolveDeckList } from '../lib/importDeck.js';
import { maxCopies } from '../lib/deck.js';

const PLACEHOLDER = `1x Bûrat
2x Beautiful Gold Ring
3x Glamour of Surpassing Excellence`;

function cardLabel(c) {
  const bits = [c.setCode, c.type, c.alignment].filter(Boolean).join(' · ');
  return `${c.id} — ${c.name?.en || c.name?.fr || c.id} (${bits})`;
}

export default function ImportDialog({ cards, onClose, onImport }) {
  const [text, setText] = useState('');
  const [resolved, setResolved] = useState(null); // array of resolved lines
  const [choice, setChoice] = useState({}); // line index -> chosen card id (for ambiguous)

  const nameIndex = useMemo(() => buildNameIndex(cards), [cards]);

  function analyze() {
    const lines = resolveDeckList(parseDeckList(text), nameIndex);
    const initialChoice = {};
    lines.forEach((line, i) => {
      if (line.matches.length >= 1) initialChoice[i] = line.matches[0].id;
    });
    setChoice(initialChoice);
    setResolved(lines);
  }

  // Build the final { id: count } map from resolved+chosen lines (capped).
  const importable = useMemo(() => {
    if (!resolved) return {};
    const q = {};
    resolved.forEach((line, i) => {
      if (line.status === 'notfound') return;
      const id = choice[i] || (line.matches[0] && line.matches[0].id);
      if (!id) return;
      const card = line.matches.find((c) => c.id === id) || line.matches[0];
      const capped = Math.max(1, Math.min(maxCopies(card), line.qty));
      q[id] = (q[id] || 0) + capped;
    });
    return q;
  }, [resolved, choice]);

  const okCount = resolved ? resolved.filter((l) => l.status !== 'notfound').length : 0;
  const notFoundCount = resolved ? resolved.filter((l) => l.status === 'notfound').length : 0;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Importer une liste</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Colle une liste au format <code>Nx nom de carte</code>. Le nom doit être complet
          (accents ignorés). L'import remplace la sélection courante.
        </p>

        <textarea
          className="import-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={7}
        />

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={analyze} disabled={!text.trim()}>Analyser</button>
        </div>

        {resolved && (
          <>
            <p className="muted">
              {okCount} ligne(s) reconnue(s){notFoundCount ? `, ${notFoundCount} introuvable(s)` : ''}.
            </p>
            <ul className="import-list">
              {resolved.map((line, i) => {
                if (line.status === 'notfound') {
                  return (
                    <li key={i} className="imp-notfound">
                      ✗ {line.qty}× <b>{line.name}</b> — introuvable
                    </li>
                  );
                }
                if (line.status === 'ambiguous') {
                  return (
                    <li key={i} className="imp-ambiguous">
                      ⚠ {line.qty}× <b>{line.name}</b> — plusieurs cartes, choisis :
                      <select
                        value={choice[i] || ''}
                        onChange={(e) => setChoice((prev) => ({ ...prev, [i]: e.target.value }))}
                      >
                        {line.matches.map((c) => (
                          <option key={c.id} value={c.id}>{cardLabel(c)}</option>
                        ))}
                      </select>
                    </li>
                  );
                }
                const c = line.matches[0];
                const capped = Math.min(maxCopies(c), line.qty);
                return (
                  <li key={i} className="imp-ok">
                    ✓ {capped}× <b>{c.name?.en || c.name?.fr}</b> <span className="muted">({c.id})</span>
                    {capped < line.qty && <span className="muted"> — limité à {capped}</span>}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Annuler</button>
          <button
            className="btn"
            onClick={() => onImport(importable)}
            disabled={!resolved || Object.keys(importable).length === 0}
          >
            Importer ({Object.values(importable).reduce((a, b) => a + b, 0)} cartes)
          </button>
        </div>
      </div>
    </div>
  );
}
