import React, { useEffect, useMemo, useState } from 'react';
import { parseDocument, buildNameIndex, resolveLines, bucketFor } from '../lib/importDeck.js';
import { emptyZones, totalCopies } from '../lib/deck.js';
import { isLegalForSide } from '../lib/rules/sides.js';
import { siteIndex } from '../lib/rules/sites.js';
import { resolveBanned } from '../lib/rules/banned.js';
import { isRuleEnabled } from '../lib/rules/catalog.js';
import { SIDE_IDS, LENGTH_IDS } from '../lib/constants.js';
import { cardName } from '../lib/lang.js';
import { useT } from '../i18n.jsx';

// Alignment preference, offered in freeform only: with no side there is
// nothing to infer a preference from. In deckbuilding the side supplies it
// (PREF_BY_SIDE), so the manual control would be a second, contradictable
// source for the same decision.
const ALIGN_OPTIONS = [
  { value: '', key: 'import.alignPref.none' },
  { value: 'hero', key: 'import.alignPref.hero' },
  { value: 'minion', key: 'import.alignPref.minion' },
  { value: 'balrog', key: 'import.alignPref.balrog' },
  { value: 'fallenWizard', key: 'import.alignPref.fallenWizard' },
];

// "Excellance" (not "Excellence") matches the card data's own spelling -- see
// banned.js:11-12. Deliberately misspelled here so the placeholder actually
// imports instead of silently matching nothing.
const PLACEHOLDER = `## Pioche
1x Bûrat
2x Beautiful Gold Ring

## Talon
3x Glamour of Surpassing Excellance`;

function cardLabel(c, lang) {
  const bits = [c.setCode, c.type, c.alignment].filter(Boolean).join(' · ');
  return `${c.id} — ${cardName(c, lang)} (${bits})`;
}

// A stable reference, not `{}` inline: `setNames` sits in the `result`
// useMemo's deps, and until App.jsx wires the prop through (next task) it is
// undefined here on every render. An inline default object literal is a new
// reference each call, which would defeat that memo every render, produce a
// new `resolved` array every time, re-fire the choice-seeding effect below,
// and loop forever since that effect always calls setChoice with a freshly
// built object.
const NO_SET_NAMES = {};

export default function ImportDialog({ cards, lang = 'fr', deck, setNames = NO_SET_NAMES, onClose, onImport }) {
  const t = useT();
  const [text, setText] = useState('');
  const [doc, setDoc] = useState(null); // parseDocument output, or null pre-analysis
  const [choice, setChoice] = useState({}); // line index -> chosen card id
  const [alignPref, setAlignPref] = useState('');

  // The controls only exist after the analysis, so a manual setting can never
  // contradict the metadata carried by the pasted text.
  const [target, setTarget] = useState('new');
  const [mode, setMode] = useState('freeform');
  const [side, setSide] = useState('wizard');
  const [length, setLength] = useState('standard');

  const cardsById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const nameIndex = useMemo(() => buildNameIndex(cards, lang), [cards, lang]);
  // Both are memoized on `cards` by a WeakMap inside their own modules; the
  // useMemo here only avoids re-entering them on every keystroke.
  const openBalrog = useMemo(() => siteIndex(cards).openBalrog, [cards]);

  // The overrides deck.ruleset carries (or the legacy `savedRuleOverrides` on
  // a deck predating the rules panel) -- the exact expression submit() below
  // feeds into the outgoing ruleset, read once here so the two paths cannot
  // drift apart. Tolerates `deck` being undefined, which it still is until
  // App.jsx wires the prop through (next task).
  const ruleOverrides = ((deck && deck.ruleset) || {}).ruleOverrides || (deck && deck.savedRuleOverrides) || {};
  // BANNED is a rule the player can switch off in the rules panel; when it is
  // off the validator stops flagging those cards, so the import dialog must
  // stop marking them illegal too, or it would enforce a rule the player
  // turned off. Mirrors CardBrowser.jsx's `banEnforced` gate exactly, so the
  // two views cannot disagree about what's legal. Only the boolean goes in
  // the memo deps below, not `ruleOverrides` itself -- that object is rebuilt
  // by the `|| {}` fallback on every render while `deck` is undefined, and
  // depending on it directly would reintroduce the unstable-identity bug
  // fixed above for `setNames`.
  const banEnforced = mode === 'deckbuilding' && isRuleEnabled('BANNED', ruleOverrides);
  const bannedIds = useMemo(() => (banEnforced ? resolveBanned(cards).bySide[side] : undefined), [cards, side, banEnforced]);

  // Seeding order, for the first resolution -- which runs before anything is
  // on screen: pasted metadata > the open deck's ruleset > nothing.
  function analyze() {
    const parsed = parseDocument(text);
    const r = (deck && deck.ruleset) || {};
    setMode(parsed.meta.mode || (deck && deck.mode) || 'freeform');
    setSide(parsed.meta.side || r.side || 'wizard');
    setLength(parsed.meta.length || r.length || 'standard');
    setDoc(parsed);
  }

  const effectiveSide = mode === 'deckbuilding' ? side : null;

  // alignPref is in the deps because in freeform it IS the rank-3 tiebreaker;
  // in deckbuilding effectiveSide supersedes it and resolve.js ignores it.
  const result = useMemo(() => {
    if (!doc) return null;
    return resolveLines(doc.lines, { nameIndex, cardsById, setNames, side: effectiveSide, alignPref });
  }, [doc, nameIndex, cardsById, setNames, effectiveSide, alignPref]);

  const resolved = result ? result.resolved : null;

  // Default selection per line. A manual pick SURVIVES a side change unless
  // the card it names is no longer among the candidates -- the previous
  // implementation wiped every manual pick whenever the preference moved.
  useEffect(() => {
    if (!resolved) return;
    setChoice((prev) => {
      const next = {};
      resolved.forEach((line, i) => {
        if (line.matches.length === 0) return;
        const kept = prev[i] && line.matches.some((c) => c.id === prev[i]) ? prev[i] : null;
        next[i] = kept || line.matches[0].id;
      });
      return next;
    });
  }, [resolved]);

  const importable = useMemo(() => {
    const quantities = {};
    const zones = emptyZones();
    if (!resolved) return { quantities, zones };
    resolved.forEach((line, i) => {
      if (line.status === 'notfound') return;
      const id = choice[i] || (line.matches[0] && line.matches[0].id);
      if (!id) return;
      const count = Math.max(1, line.qty);
      // The card, not just its id: the zone a line may land in depends on the
      // card's type, and the player's manual pick can change that card.
      const card = line.matches.find((c) => c.id === id) || line.matches[0];
      const bucket = bucketFor(card, line.target, { quantities, zones });
      bucket[id] = (bucket[id] || 0) + count;
    });
    return { quantities, zones };
  }, [resolved, choice]);

  // totalCopies, not a hand-listed map trio: the previous list named
  // quantities/pool/sideboard only, so a paste that resolved entirely into
  // the Fallen-wizard sideboard counted as zero importable cards and the
  // submit button (below) stayed disabled forever (I1, final review). Same
  // function App.jsx already uses for "does this deck have cards" (§4/§5).
  const importCount = totalCopies(importable.quantities, importable.zones);

  const okCount = resolved ? resolved.filter((l) => l.status !== 'notfound').length : 0;
  const notFoundCount = resolved ? resolved.filter((l) => l.status === 'notfound').length : 0;
  const proseCount = result ? result.prose.length : 0;

  // Prose collected by the resolver is appended to the "other notes" field, so
  // pasting a forum post keeps its commentary instead of dropping it.
  function submit() {
    const notes = { ...(doc ? doc.notes : {}) };
    if (result && result.prose.length) {
      notes.other = [notes.other, result.prose.join('\n')].filter(Boolean).join('\n').trim();
    }
    onImport({
      quantities: importable.quantities,
      zones: importable.zones,
      notes,
      name: (doc && doc.name) || t('import.defaultName'),
      mode,
      ruleset: mode === 'deckbuilding'
        ? { side, length, tournament: !!((deck && deck.ruleset) || {}).tournament, ruleOverrides }
        : null,
      target,
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('import.title')}</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {t('import.help', { fmt: '3x Bûrat · Bûrat - 3', ex: 'burat = Bûrat' })}
        </p>

        <textarea
          className="import-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={7}
        />

        {!doc && (
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn secondary" onClick={analyze} disabled={!text.trim()}>{t('import.analyze')}</button>
          </div>
        )}

        {doc && (
          <>
            <fieldset className="import-settings">
              <legend>{t('import.step2')}</legend>
              <div className="row">
                <label>{t('import.target')}
                  <select value={target} onChange={(e) => setTarget(e.target.value)}>
                    <option value="new">{t('import.target.new')}</option>
                    <option value="replace">{t('import.target.replace')}</option>
                  </select>
                </label>
                <label>{t('import.mode')}
                  <select value={mode} onChange={(e) => setMode(e.target.value)}>
                    <option value="freeform">{t('setup.mode.freeform')}</option>
                    <option value="deckbuilding">{t('setup.mode.deckbuilding')}</option>
                  </select>
                </label>
              </div>
              {mode === 'deckbuilding' ? (
                <div className="row">
                  <label>{t('setup.side')}
                    <select value={side} onChange={(e) => setSide(e.target.value)}>
                      {SIDE_IDS.map((s) => <option key={s} value={s}>{t(`side.${s}`)}</option>)}
                    </select>
                  </label>
                  <label>{t('setup.length')}
                    <select value={length} onChange={(e) => setLength(e.target.value)}>
                      {LENGTH_IDS.map((l) => <option key={l} value={l}>{t(`length.${l}`)}</option>)}
                    </select>
                  </label>
                </div>
              ) : (
                <label className="import-alignpref">
                  {t('import.alignPref')}
                  <select value={alignPref} onChange={(e) => setAlignPref(e.target.value)}>
                    {ALIGN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{t(o.key)}</option>)}
                  </select>
                </label>
              )}
            </fieldset>

            <p className="muted">
              {t('import.summary', { ok: okCount })}
              {notFoundCount ? t('import.summaryNotFound', { n: notFoundCount }) : ''}
              {proseCount ? t('import.summaryProse', { n: proseCount }) : ''}.
            </p>

            <ul className="import-list">
              {resolved.map((line, i) => {
                if (line.status === 'notfound') {
                  return <li key={i} className="imp-notfound">{t('import.notFound', { qty: line.qty, name: line.name })}</li>;
                }
                if (line.status === 'ambiguous') {
                  return (
                    <li key={i} className="imp-ambiguous">
                      {t('import.ambiguous', { qty: line.qty, name: line.name })}
                      <select value={choice[i] || ''} onChange={(e) => setChoice((prev) => ({ ...prev, [i]: e.target.value }))}>
                        {line.matches.map((c) => <option key={c.id} value={c.id}>{cardLabel(c, lang)}</option>)}
                      </select>
                    </li>
                  );
                }
                const c = cardsById.get(choice[i]) || line.matches[0];
                // Marked, never blocked: the card imports either way. Same
                // call as CardBrowser's, so the two cannot disagree.
                const illegal = effectiveSide && !isLegalForSide(c, effectiveSide, openBalrog, bannedIds);
                if (illegal) {
                  return <li key={i} className="imp-illegal">{t('import.illegal', { qty: line.qty, name: cardName(c, lang), side: t(`side.${effectiveSide}`) })}</li>;
                }
                return (
                  <li key={i} className="imp-ok">
                    ✓ {line.qty}× <b>{cardName(c, lang)}</b> <span className="muted">({c.id})</span>
                  </li>
                );
              })}
            </ul>

            {proseCount > 0 && (
              <details className="import-prose">
                <summary>{t('import.prose')} ({proseCount})</summary>
                <pre>{result.prose.join('\n')}</pre>
              </details>
            )}
          </>
        )}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn" onClick={submit} disabled={!doc || importCount === 0}>
            {t('import.submit', { n: importCount })}
          </button>
        </div>
      </div>
    </div>
  );
}
