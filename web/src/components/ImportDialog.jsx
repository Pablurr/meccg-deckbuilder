import React, { useEffect, useMemo, useState } from 'react';
import { parseDeckList, buildNameIndex, resolveDeckList, preferredMatchId } from '../lib/importDeck.js';
import { maxCopies } from '../lib/deck.js';
import { cardName } from '../lib/lang.js';
import { useT } from '../i18n.jsx';

// Alignment preference options for auto-resolving duplicate-name lines.
// value '' means "no preference" (keep the first match).
const ALIGN_OPTIONS = [
  { value: '', key: 'import.alignPref.none' },
  { value: 'hero', key: 'import.alignPref.hero' },
  { value: 'minion', key: 'import.alignPref.minion' },
  { value: 'balrog', key: 'import.alignPref.balrog' },
  { value: 'fallenWizard', key: 'import.alignPref.fallenWizard' },
];

const PLACEHOLDER = `1x Bûrat
2x Beautiful Gold Ring
3x Glamour of Surpassing Excellence`;

function cardLabel(c, lang) {
  const bits = [c.setCode, c.type, c.alignment].filter(Boolean).join(' · ');
  return `${c.id} — ${cardName(c, lang)} (${bits})`;
}

export default function ImportDialog({ cards, lang = 'fr', onClose, onImport }) {
  const t = useT();
  const [text, setText] = useState('');
  const [resolved, setResolved] = useState(null); // array of resolved lines
  const [choice, setChoice] = useState({}); // line index -> chosen card id (for ambiguous)
  const [alignPref, setAlignPref] = useState(''); // '' | hero | minion | balrog | fallenWizard

  const nameIndex = useMemo(() => buildNameIndex(cards), [cards]);

  function analyze() {
    setResolved(resolveDeckList(parseDeckList(text), nameIndex));
  }

  // (Re)compute the per-line default selection whenever the results or the
  // alignment preference change. The preference pre-selects a match for
  // ambiguous lines; the player can still override any line's dropdown after
  // (a manual pick survives until the preference changes or the list is
  // re-analyzed). Falls back to the first match when the preference doesn't
  // resolve a single winner.
  useEffect(() => {
    if (!resolved) return;
    const next = {};
    resolved.forEach((line, i) => {
      if (line.matches.length === 0) return;
      next[i] = preferredMatchId(line.matches, alignPref) || line.matches[0].id;
    });
    setChoice(next);
  }, [resolved, alignPref]);

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
        <h2>{t('import.title')}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('import.help', { fmt: 'Nx name', ex: 'star glass = Star-glass' })}
        </p>

        <textarea
          className="import-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={7}
        />

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={analyze} disabled={!text.trim()}>{t('import.analyze')}</button>
        </div>

        {resolved && (
          <>
            <p className="muted">
              {t('import.summary', { ok: okCount })}{notFoundCount ? t('import.summaryNotFound', { n: notFoundCount }) : ''}.
            </p>
            <label className="import-alignpref">
              {t('import.alignPref')}
              <select value={alignPref} onChange={(e) => setAlignPref(e.target.value)}>
                {ALIGN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(o.key)}</option>
                ))}
              </select>
            </label>
            <ul className="import-list">
              {resolved.map((line, i) => {
                if (line.status === 'notfound') {
                  return (
                    <li key={i} className="imp-notfound">
                      {t('import.notFound', { qty: line.qty, name: line.name })}
                    </li>
                  );
                }
                if (line.status === 'ambiguous') {
                  return (
                    <li key={i} className="imp-ambiguous">
                      {t('import.ambiguous', { qty: line.qty, name: line.name })}
                      <select
                        value={choice[i] || ''}
                        onChange={(e) => setChoice((prev) => ({ ...prev, [i]: e.target.value }))}
                      >
                        {line.matches.map((c) => (
                          <option key={c.id} value={c.id}>{cardLabel(c, lang)}</option>
                        ))}
                      </select>
                    </li>
                  );
                }
                const c = line.matches[0];
                const capped = Math.min(maxCopies(c), line.qty);
                return (
                  <li key={i} className="imp-ok">
                    ✓ {capped}× <b>{cardName(c, lang)}</b> <span className="muted">({c.id})</span>
                    {capped < line.qty && <span className="muted">{t('import.capped', { n: capped })}</span>}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button
            className="btn"
            onClick={() => onImport(importable)}
            disabled={!resolved || Object.keys(importable).length === 0}
          >
            {t('import.submit', { n: Object.values(importable).reduce((a, b) => a + b, 0) })}
          </button>
        </div>
      </div>
    </div>
  );
}
