import React from 'react';
import { useT } from '../i18n.jsx';
import { RULES, isRuleEnabled } from '../lib/rules/validate.js';
import { SIDES } from '../lib/rules/sides.js';
import { LENGTHS } from '../lib/rules/formats.js';
import { BANNED } from '../lib/rules/banned.js';
import { REPORT_ISSUES_URL, SIDE_IDS, LENGTH_IDS } from '../lib/constants.js';

// Same fallback-safe localization DeckPanel's localizeParams uses for raw
// data values: keep the untranslated value rather than show a raw i18n key
// when a translation doesn't exist yet.
function localize(t, prefix, value) {
  const localized = t(`${prefix}.${value}`);
  return localized === `${prefix}.${value}` ? value : localized;
}

function reportRuleUrl(ruleId) {
  const title = encodeURIComponent(`[rule] ${ruleId}`);
  return `${REPORT_ISSUES_URL}?title=${title}`;
}

// "3 per card, 3 for Stage" — the default copy limit plus any per-alignment
// overrides, straight from SIDES[side].copies.
function copiesText(t, profile) {
  const parts = [t('docs.copies.default', { n: profile.copies.default })];
  for (const [alignment, n] of Object.entries(profile.copies.byAlignment)) {
    parts.push(t('docs.copies.override', { n, alignment: localize(t, 'alignment', alignment) }));
  }
  return parts.join(', ');
}

// Compose the starting-pool constraints as short localized fragments rather
// than one giant sentence template, since several fields are null/empty for
// any given side (see SIDES.*.pool) and a single template can't gracefully
// drop clauses per language.
function poolText(t, pool) {
  const parts = [
    t('docs.pool.maxCharacters', { n: pool.maxCharacters }),
    t('docs.pool.maxMinorItems', { n: pool.maxMinorItems }),
  ];
  if (pool.mindCap != null) parts.push(t('docs.pool.mindCap', { n: pool.mindCap }));
  if (pool.mindPerCharacter != null) parts.push(t('docs.pool.mindPerCharacter', { n: pool.mindPerCharacter }));
  if (pool.forbidRaces && pool.forbidRaces.length) {
    parts.push(t('docs.pool.forbidRaces', { races: pool.forbidRaces.map((r) => localize(t, 'race', r)).join(', ') }));
  }
  if (pool.requireRaces && pool.requireRaces.length) {
    parts.push(t('docs.pool.requireRaces', { races: pool.requireRaces.map((r) => localize(t, 'race', r)).join(', ') }));
  }
  return parts.join(' · ');
}

// playDeck is null for sides whose min/max haven't been sourced yet (see
// sides.js "// unverified" comments) — say so rather than showing a blank.
function playDeckText(t, playDeck) {
  return playDeck ? t('docs.playDeck.range', { min: playDeck.min, max: playDeck.max }) : t('status.unverified');
}

function StatusChip({ status, t }) {
  return <span className={`status-chip ${status}`}>{t(`status.${status}`)}</span>;
}

// Full-screen documentation modal: prose (hand-written) plus tables rendered
// straight from the same RULES/SIDES/LENGTHS/BANNED data the validator
// consumes, so the page can never say something the validator doesn't do.
// Checkboxes are read-only (showing the deck's effective defaults) unless a
// deckbuilding deck is open — freeform decks and "no deck" both fall through
// deck.mode !== 'deckbuilding' since normalizeDeck defaults mode to freeform.
export default function RulesDoc({ deck, onToggleRule, onClose }) {
  const t = useT();
  const readOnly = !deck || deck.mode !== 'deckbuilding';
  const ruleOverrides = (deck && deck.ruleset && deck.ruleset.ruleOverrides) || {};
  const notChecked = RULES.filter((r) => r.status !== 'verified');

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal doc" onClick={(e) => e.stopPropagation()}>
        <div className="doc-head">
          <h2>{t('docs.title')}</h2>
          <button className="btn secondary" onClick={onClose}>{t('common.close')}</button>
        </div>

        <section className="doc-prose">
          <p>{t('docs.intro')}</p>
          <h3>{t('setup.mode.freeform')}</h3>
          <p>{t('docs.freeform')}</p>
          <h3>{t('setup.mode.deckbuilding')}</h3>
          <p>{t('docs.deckbuilding')}</p>
          <h3>{t('docs.zonesTitle')}</h3>
          <p>{t('docs.zones')}</p>
          <h3>{t('docs.warningsTitle')}</h3>
          <p>{t('docs.warnings')}</p>
          <h3>{t('docs.enforcementTitle')}</h3>
          <p>{t('docs.enforcement')}</p>
        </section>

        <section className="doc-section">
          <h3>{t('docs.rulesTitle')}</h3>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>{t('docs.col.enforce')}</th>
                  <th>{t('docs.col.id')}</th>
                  <th>{t('docs.col.summary')}</th>
                  <th>{t('docs.col.severity')}</th>
                  <th>{t('docs.col.status')}</th>
                  <th>{t('docs.col.source')}</th>
                  <th>{t('rules.report')}</th>
                </tr>
              </thead>
              <tbody>
                {RULES.map((r) => (
                  <tr key={r.id} className={r.status !== 'verified' ? 'unchecked' : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isRuleEnabled(r.id, ruleOverrides)}
                        disabled={readOnly}
                        onChange={(e) => onToggleRule(r.id, e.target.checked)}
                        aria-label={r.id}
                      />
                    </td>
                    <td><code>{r.id}</code></td>
                    <td>{t(`rules.${r.id}.doc`)}</td>
                    <td>{t(`rules.severity.${r.severity}`)}</td>
                    <td><StatusChip status={r.status} t={t} /></td>
                    <td><a href={r.source} target="_blank" rel="noreferrer">{t('docs.sourceLink')}</a></td>
                    <td><a className="linklike" href={reportRuleUrl(r.id)} target="_blank" rel="noreferrer">{t('rules.report')}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="doc-section">
          <h3>{t('docs.notCheckedTitle')}</h3>
          <p>{t('docs.notCheckedIntro')}</p>
          <ul className="doc-notchecked">
            {notChecked.map((r) => (
              <li key={r.id}>
                <code>{r.id}</code> <StatusChip status={r.status} t={t} /> — {t(`rules.${r.id}.doc`)}
              </li>
            ))}
          </ul>
        </section>

        <section className="doc-section">
          <h3>{t('docs.sidesTitle')}</h3>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr>
                  <th>{t('docs.col.side')}</th>
                  <th>{t('docs.col.alignments')}</th>
                  <th>{t('docs.col.copies')}</th>
                  <th>{t('docs.col.playDeck')}</th>
                  <th>{t('docs.col.pool')}</th>
                </tr>
              </thead>
              <tbody>
                {SIDE_IDS.map((sid) => {
                  const p = SIDES[sid];
                  return (
                    <tr key={sid}>
                      <td>{t(`side.${sid}`)}</td>
                      <td>{p.alignments.map((a) => localize(t, 'alignment', a)).join(', ')}</td>
                      <td>{copiesText(t, p)}</td>
                      <td>{playDeckText(t, p.playDeck)}</td>
                      <td>{poolText(t, p.pool)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="doc-section">
          <h3>{t('docs.lengthsTitle')}</h3>
          <div className="doc-table-wrap">
            <table className="doc-table">
              <thead>
                <tr><th>{t('docs.col.length')}</th><th>{t('docs.col.sideboardMax')}</th></tr>
              </thead>
              <tbody>
                {LENGTH_IDS.map((lid) => (
                  <tr key={lid}><td>{t(`length.${lid}`)}</td><td>{LENGTHS[lid].sideboardMax}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="doc-section">
          <h3>{t('docs.bannedTitle')}</h3>
          {Object.entries(BANNED).map(([sid, entry]) => (
            <div key={sid} className="doc-banned-side">
              <h4>
                {t(`side.${sid}`)} <StatusChip status={entry.status} t={t} />
                {' '}<a href={entry.source} target="_blank" rel="noreferrer">{t('docs.sourceLink')}</a>
              </h4>
              <p className="doc-banned-list">{entry.names.join(', ')}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
