import React, { useState } from 'react';
import { useT } from '../i18n.jsx';
import { SIDE_IDS, LENGTH_IDS } from '../lib/constants.js';

// Mode + (side, length, tournament) chooser, shown on deck creation and from
// deck settings. Emits a partial deck: { mode, ruleset }.
export default function DeckSetupDialog({ initial = {}, onConfirm, onClose }) {
  const t = useT();
  const [mode, setMode] = useState(initial.mode || 'freeform');
  const r = initial.ruleset || {};
  const [side, setSide] = useState(r.side || 'wizard');
  const [length, setLength] = useState(r.length || 'standard');
  const [tournament, setTournament] = useState(!!r.tournament);

  function confirm() {
    // r.ruleOverrides only exists while the deck is already deckbuilding; a
    // deck coming back from freeform has ruleset === null (see applySetup /
    // normalizeDeck), so its overrides live in initial.savedRuleOverrides
    // instead. Falling back to it here is what makes ignored rules survive a
    // freeform round-trip (see deck.js normalizeDeck for where they're kept).
    onConfirm(mode === 'deckbuilding'
      ? { mode, ruleset: { side, length, tournament, ruleOverrides: r.ruleOverrides || initial.savedRuleOverrides || {} } }
      : { mode: 'freeform', ruleset: null });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('setup.title')}</h2>
        <div className="setup-modes">
          {['freeform', 'deckbuilding'].map((m) => (
            <label key={m} className={`setup-mode ${mode === m ? 'on' : ''}`}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
              <b>{t(`setup.mode.${m}`)}</b>
              <span className="muted">{t(`setup.mode.${m}.hint`)}</span>
            </label>
          ))}
        </div>
        {mode === 'deckbuilding' && (
          <>
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
            <label className="row">
              <input type="checkbox" checked={tournament} onChange={(e) => setTournament(e.target.checked)} />
              {t('setup.tournament')}
            </label>
          </>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="btn" onClick={confirm}>{t('common.ok')}</button>
        </div>
      </div>
    </div>
  );
}
