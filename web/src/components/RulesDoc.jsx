import React from 'react';
import { useT } from '../i18n.jsx';
import { RULES, isRuleEnabled } from '../lib/rules/validate.js';
import { SIDES } from '../lib/rules/sides.js';
import { LENGTHS } from '../lib/rules/formats.js';
import { BANNED } from '../lib/rules/banned.js';
import { REPORT_ISSUES_URL, SIDE_IDS, LENGTH_IDS } from '../lib/constants.js';
import { localize, copiesText, poolText, playDeckText, refText } from '../lib/rules/docText.js';
import { COE } from '../lib/rules/catalog.js';

function reportRuleUrl(ruleId) {
  const title = encodeURIComponent(`[rule] ${ruleId}`);
  return `${REPORT_ISSUES_URL}?title=${title}`;
}

function StatusChip({ status, t }) {
  return <span className={`status-chip ${status}`}>{t(`status.${status}`)}</span>;
}

// Glossary of the terms the interface uses for things the rules name
// differently in English. Each entry names the term by the SAME i18n key the
// interface renders it from, never a copy of the word: the tab, the warning
// and this table are then one string, so the glossary cannot document a word
// the app has stopped using.
const GLOSSARY = [
  { termKey: 'zones.play', defKey: 'docs.glossary.play' },
  { termKey: 'zones.sideboard', defKey: 'docs.glossary.sideboard' },
  { termKey: 'zones.pool', defKey: 'docs.glossary.pool' },
  { termKey: 'panel.group.Hazard', defKey: 'docs.glossary.hazard' },
  { termKey: 'alignment.Minion', defKey: 'docs.glossary.minion' },
  { termKey: 'alignment.Stage', defKey: 'docs.glossary.stage' },
];

// What the app does NOT check. Both are Section 1 clauses with no working
// implementation: 1.3.1's last sentence has no grouping field in the card data
// (partial detection would produce silent false negatives, worse than an
// absent rule), and 1.4.B2 has no deck-construction effect at all. Listing
// them is the only way a player can tell an unchecked rule from a satisfied
// one -- every other clause on this page reports.
const GAPS = [
  { key: 'docs.gap.manifestations', ref: '1.3.1' },
  { key: 'docs.gap.geann', ref: '1.4.B2' },
];

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
          <h3>{t('docs.glossaryTitle')}</h3>
          <p>{t('docs.glossaryIntro')}</p>
          <dl className="doc-glossary">
            {GLOSSARY.map(({ termKey, defKey }) => (
              <React.Fragment key={termKey}>
                <dt>{t(termKey)}</dt>
                <dd>{t(defKey)}</dd>
              </React.Fragment>
            ))}
          </dl>
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
                {RULES.map((r) => {
                  const ref = refText(t, r);
                  return (
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
                      <td>
                        {t(`rules.${r.id}.doc`)}
                        {ref && (
                          <>
                            {' '}
                            <a className="linklike" href={COE} target="_blank" rel="noreferrer">{ref}</a>
                          </>
                        )}
                      </td>
                      <td>{t(`rules.severity.${r.severity}`)}</td>
                      <td><StatusChip status={r.status} t={t} /></td>
                      <td><a href={r.source} target="_blank" rel="noreferrer">{t('docs.sourceLink')}</a></td>
                      <td><a className="linklike" href={reportRuleUrl(r.id)} target="_blank" rel="noreferrer">{t('rules.report')}</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="doc-section">
          <h3>{t('docs.gapsTitle')}</h3>
          <p>{t('docs.gapsIntro')}</p>
          <ul className="doc-notchecked">
            {GAPS.map((g) => (
              <li key={g.key}>
                {/* refText takes the rule-shaped object (it reads .ref/.refs),
                    not a bare string — so these render "CoE §1.3.1" exactly
                    like every other clause citation on the page. */}
                <a href={COE} target="_blank" rel="noreferrer">{refText(t, g)}</a> — {t(g.key)}
              </li>
            ))}
          </ul>
          {/* Every rule is sourced today, so this list is empty -- it is kept,
              behind a length guard, for whenever an unsourced rule is added. */}
          {notChecked.length > 0 && (
            <>
              <p>{t('docs.notCheckedIntro')}</p>
              <ul className="doc-notchecked">
                {notChecked.map((r) => (
                  <li key={r.id}>
                    <code>{r.id}</code> <StatusChip status={r.status} t={t} /> — {t(`rules.${r.id}.doc`)}
                  </li>
                ))}
              </ul>
            </>
          )}
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
                      <td>{playDeckText(t)}</td>
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
