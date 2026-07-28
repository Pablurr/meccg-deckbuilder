import React, { useEffect, useState } from 'react';
import { cardName, deckThumbWidth } from '../lib/lang.js';
import { useCardPreview, CardPreview } from './CardPreview.jsx';
import { useT } from '../i18n.jsx';
import MiniCard from './MiniCard.jsx';
import ZoneTabs from './ZoneTabs.jsx';
import DeckNotes from './DeckNotes.jsx';
import { isDropAllowed, resolveDropTarget } from '../lib/rules/dropTargets.js';
import { LENGTHS } from '../lib/rules/formats.js';
import { SIDES } from '../lib/rules/sides.js';
import { backGroupForType } from '../lib/deck.js';
import { buildGroups } from '../lib/deckList.js';
import { REPORT_ISSUES_URL } from '../lib/constants.js';
import { COE, RULE_BY_ID } from '../lib/rules/catalog.js';
import { refText } from '../lib/rules/docText.js';
import { remainingCopies } from '../lib/rules/copies.js';

const SEV_ICON = { error: '⛔', warning: '⚠', info: 'ℹ' };

// validate.js resolves card names English-first (it has no notion of the
// user's display language). Where a warning's params carry a card `id` (or,
// for the multi-name/avatar-reference cases, an `ids`/`avatarId`), look the
// card(s) back up here and swap in the localized name so every row names
// cards in the viewer's language, never a mix of English and translated.
export function localizeParams(w, { cardsById, lang, t }) {
  const p = { ...w.params };
  if (p.id) {
    const c = cardsById.get(p.id);
    if (c) p.name = cardName(c, lang);
  }
  if (p.avatarId) {
    const c = cardsById.get(p.avatarId);
    if (c) p.avatar = cardName(c, lang);
  }
  if (p.names) {
    p.names = p.names
      .map((n, i) => {
        const id = p.ids && p.ids[i];
        const c = id && cardsById.get(id);
        return c ? cardName(c, lang) : n;
      })
      .join(', ');
  }
  if (p.side) p.side = t(`side.${p.side}`);
  if (p.length) p.length = t(`length.${p.length}`);
  // Localize raw data values (alignment/race) the same way as side/length
  // above; t() falls back key -> en -> the key string itself when a
  // translation is missing, so an exact-match-to-key means "no translation
  // exists" and we keep the original data value rather than show a raw key.
  if (p.alignment) {
    const localized = t(`alignment.${p.alignment}`);
    p.alignment = localized === `alignment.${p.alignment}` ? p.alignment : localized;
  }
  if (p.race) {
    const localized = t(`race.${p.race}`);
    p.race = localized === `race.${p.race}` ? p.race : localized;
  }
  // POOL-ITEMS.unique/.hoard carry { id, name } with no count/max (they flag
  // one specific card, not a total), so p.over would be NaN for them. Guard
  // on both operands being present rather than on ruleId alone, so no
  // template ever gets handed a value the validator didn't actually supply.
  if ((w.ruleId === 'SIDEBOARD-MAX' || w.ruleId === 'POOL-CHARS' || w.ruleId === 'POOL-ITEMS') && p.count != null && p.max != null) {
    p.over = p.count - p.max;
  }
  return p;
}

function reportUrl(w) {
  const title = encodeURIComponent(`[rule] ${w.ruleId}`);
  const body = encodeURIComponent(JSON.stringify(w.params));
  return `${REPORT_ISSUES_URL}?title=${title}&body=${body}`;
}

const MIN_WIDTH = 280;
const DEFAULT_WIDTH = 360;
// Fraction of the viewport the panel may cover at most (and the "maximize" size).
const MAX_FRACTION = 0.97;
// Natural source-image width; the zoom slider is a percentage of this.
const SOURCE_WIDTH = 570;

function warningText(t, w) {
  if (w.code === 'emptyDeck') return t('warn.emptyDeck');
  if (w.code === 'missingBack') return t('warn.missingBack', { group: t(`group.${w.group}`) });
  if (w.code === 'missingImage') return t('warn.missingImage', { n: w.count });
  return '';
}

function sumQty(map) {
  return Object.values(map || {}).reduce((a, b) => a + b, 0);
}

// The Pool tab's cap (SIDES[side].pool.maxCharacters) governs Character
// entries only — eligible starting minor items also live in the pool but
// answer to their own maxMinorItems cap (POOL-ITEMS), which this tab does
// not display. Count only what the cap governs so the tab and the
// POOL-CHARS validator warning never disagree on the same deck.
function poolCharCount(pool, cardsById) {
  return Object.entries(pool || {}).reduce((sum, [id, n]) => {
    const c = cardsById.get(id);
    return c && c.type === 'Character' ? sum + n : sum;
  }, 0);
}

export default function DeckPanel({
  cardsById,
  quantities,
  zones = { sideboard: {}, pool: {} },
  deck,
  changeZoneQty,
  moveCopy,
  lang,
  counts,
  warnings,
  ruleWarnings = [],
  onToggleRule,
  collapsed,
  onToggleCollapsed,
  width = DEFAULT_WIDTH,
  onResize,
  zoom = 50,
  onZoom,
  onChangeQty,
  onToggle,
  onChangeNote,
  asSheet = false,
  onClose,
  isMobile = false,
  onPreview,
  proxyMode = false,
  capCtx = null,
}) {
  const t = useT();
  const { previewRef, previewImgRef, stampRef, trackPointer, hidePreview } = useCardPreview(lang, proxyMode);

  const deckbuilding = deck && deck.mode === 'deckbuilding';
  // A freeform deck normally has no reason to show Pool/Sideboard (freeform
  // never routes new cards there), but a deck switched from deckbuilding to
  // freeform keeps whatever zones it already had (normalizeDeck preserves
  // them deliberately, never discarding user data). Those cards must stay
  // reachable — viewable, adjustable, removable — from every surface, so the
  // tab appears whenever its zone is non-empty, in either mode.
  const hasPool = Object.keys(zones.pool || {}).length > 0;
  const hasSideboard = Object.keys(zones.sideboard || {}).length > 0;
  const tabs = deckbuilding
    ? ['play', 'pool', 'sideboard', 'location', 'notes']
    : ['cards', ...(hasPool ? ['pool'] : []), ...(hasSideboard ? ['sideboard'] : []), 'notes'];
  const [tab, setTab] = useState(deckbuilding ? 'play' : 'cards');
  // The deck's mode can change (setup dialog) after mount, and a freeform
  // deck's pool/sideboard tabs can appear or disappear as those zones empty
  // out; if the current tab no longer exists, fall back to the first tab
  // rather than showing nothing.
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckbuilding, hasPool, hasSideboard]);

  // Card width driven by the zoom slider (% of the source image). min(…,100%)
  // keeps a card from overflowing when the panel is dragged narrower than it.
  const cardW = Math.round((SOURCE_WIDTH * zoom) / 100);
  const thumbW = deckThumbWidth(cardW);
  const gridStyle = { gridTemplateColumns: `repeat(auto-fill, minmax(min(${cardW}px, 100%), ${cardW}px))` };

  // Drag the left edge to resize; released listeners live only for the drag.
  function startResize(e) {
    e.preventDefault();
    const maxW = window.innerWidth * MAX_FRACTION;
    const onMove = (ev) => {
      const w = Math.min(maxW, Math.max(MIN_WIDTH, window.innerWidth - ev.clientX));
      onResize(w);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // Toggle between (near) full width and the default width.
  const maxW = typeof window !== 'undefined' ? window.innerWidth * MAX_FRACTION : 1200;
  const isMaxed = width >= maxW - 2;
  function toggleMax() {
    onResize(isMaxed ? DEFAULT_WIDTH : maxW);
  }

  // Caps: sideboard from the game length, pool characters from the side.
  // Both null in freeform (deck.ruleset is null) or while unset.
  const sbMax = deck && deck.ruleset ? LENGTHS[deck.ruleset.length].sideboardMax : null;
  const poolMax = deck && deck.ruleset ? SIDES[deck.ruleset.side].pool.maxCharacters : null;

  const tabCounts = {
    play: counts.byGroup.playdeck,
    location: counts.byGroup.locationdeck,
    pool: poolCharCount(zones.pool, cardsById),
    sideboard: sumQty(zones.sideboard),
    cards: counts.total,
    notes: null, // the Notes tab carries no count
  };
  const tabCaps = { play: null, location: null, pool: poolMax, sideboard: sbMax, cards: null, notes: null };
  const tabLabels = {
    play: t('zones.play'),
    location: t('zones.location'),
    pool: t('zones.pool'),
    sideboard: t('zones.sideboard'),
    cards: t('zones.cards'),
    notes: t('zones.notes'),
  };

  // Entries + editing wired for whichever tab is active. play/location/cards
  // all edit `quantities` (zone 'deck'); pool/sideboard edit their zone map.
  let activeEntries = [];
  let activeZone = 'deck';
  let activeOnChangeQty = onChangeQty;
  let activeOnToggle = onToggle;
  if (tab === 'play' || tab === 'location' || tab === 'cards') {
    const wantGroup = tab === 'play' ? 'playdeck' : tab === 'location' ? 'locationdeck' : null;
    activeEntries = Object.entries(quantities)
      .map(([id, qty]) => ({ card: cardsById.get(id), qty }))
      .filter((it) => it.card && (wantGroup == null || backGroupForType(it.card.type) === wantGroup));
  } else if (tab === 'pool' || tab === 'sideboard') {
    activeZone = tab;
    activeEntries = Object.entries(zones[tab] || {})
      .map(([id, qty]) => ({ card: cardsById.get(id), qty }))
      .filter((it) => it.card);
    activeOnChangeQty = (id, delta) => changeZoneQty(tab, id, delta);
    // Full removal (the mini-card's confirm button) must zero out this zone's
    // entry specifically — the shared `onToggle` only knows about `quantities`.
    activeOnToggle = (id) => changeZoneQty(tab, id, -((zones[tab] || {})[id] || 0));
  }
  const groups = tab === 'notes' ? [] : buildGroups(activeEntries, lang);

  // Drop target is the tab itself (not an area inside the panel): zones live
  // in separate tabs, so source and destination are never visible together,
  // and this still works when the destination zone is empty.
  function onDropOnTab(e, toZone) {
    e.preventDefault();
    let payload;
    try { payload = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { return; }
    if (!payload || !payload.id) return;
    const card = cardsById.get(payload.id);
    if (!card) return;
    if (!isDropAllowed(card, toZone)) return; // e.g. a Site dropped on Pool: ignored silently
    moveCopy(payload.id, payload.from, resolveDropTarget(toZone));
  }

  if (collapsed) {
    return (
      <div className="deckpanel collapsed">
        <button className="deckpanel-toggle" onClick={onToggleCollapsed} aria-label={t('panel.expand')}>
          <span className="chevron">‹</span>
          <span className="deckpanel-badge">{counts.total}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={`deckpanel ${asSheet ? 'sheet' : ''}`} style={asSheet ? undefined : { flexBasis: `${width}px`, width: `${width}px` }}>
      {!asSheet && <div className="deckpanel-resizer" onMouseDown={startResize} aria-hidden="true" />}
      {asSheet && (
        <button className="deckpanel-sheet-close btn secondary" onClick={onClose} aria-label={t('common.close')}>✕</button>
      )}
      <div className="deckpanel-head">
        {!asSheet && (
          <button className="deckpanel-toggle" onClick={onToggleCollapsed} aria-label={t('panel.collapse')}>
            <span className="chevron">›</span>
          </button>
        )}
        <b>{t('panel.title')}</b>
        {!asSheet && (
          <button
            className="deckpanel-max"
            onClick={toggleMax}
            aria-label={isMaxed ? t('panel.restore') : t('panel.maximize')}
            title={isMaxed ? t('panel.restore') : t('panel.maximize')}
          >{isMaxed ? '⇥' : '⤢'}</button>
        )}
        <div className="deckpanel-counts">
          <span className="count-pill">{t('drawer.total')} <b>{counts.total}</b></span>
          <span className="count-pill">{t('drawer.playdeck')} <b>{counts.byGroup.playdeck}</b></span>
          <span className="count-pill">{t('drawer.location')} <b>{counts.byGroup.locationdeck}</b></span>
        </div>
        <label className="deckpanel-zoom">
          {t('panel.zoom')}
          <input
            type="range"
            min="15"
            max="100"
            step="5"
            value={zoom}
            onChange={(e) => onZoom(Number(e.target.value))}
          />
          <span className="deckpanel-zoom-val">{zoom}%</span>
        </label>
      </div>

      <ZoneTabs
        tabs={tabs}
        active={tab}
        onSelect={setTab}
        onDrop={onDropOnTab}
        labels={tabLabels}
        counts={tabCounts}
        caps={tabCaps}
      />

      {ruleWarnings.length > 0 && (
        <div className="rule-warns" role="status">
          {ruleWarnings.map((w, i) => {
            const params = localizeParams(w, { cardsById, lang, t });
            const ref = refText(t, RULE_BY_ID.get(w.ruleId) || {});
            return (
              <div key={i} className={`rule-warn ${w.severity}`}>
                <span className="rule-sev" title={t(`rules.severity.${w.severity}`)}>
                  <span aria-hidden="true">{SEV_ICON[w.severity]}</span> {t(`rules.severity.${w.severity}`)}
                </span>
                <span className="msg">{t(`rules.${w.code}`, params)}</span>
                <span className="rule-meta">
                  <code>{w.ruleId}</code>
                  {ref && (
                    <a className="linklike" href={COE} target="_blank" rel="noreferrer">{ref}</a>
                  )}
                  <button className="linklike" onClick={() => onToggleRule(w.ruleId, false)}>{t('rules.disable')}</button>
                  <a className="linklike" href={reportUrl(w)} target="_blank" rel="noreferrer">{t('rules.report')}</a>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="warns">⚠ {warnings.map((w) => warningText(t, w)).join(' · ')}</div>
      )}

      <div className="deckpanel-body">
        {tab === 'notes' ? (
          <DeckNotes notes={(deck && deck.notes) || {}} onChange={onChangeNote} />
        ) : (
          groups.map((g) => {
            const n = g.items.reduce((a, b) => a + b.qty, 0);
            return (
              <div key={g.type} className="deck-group">
                <div className="deck-group-head">
                  {t(`panel.group.${g.type}`)} <span className="muted">({n})</span>
                </div>
                <div className="deck-mini-grid" style={gridStyle}>
                  {g.items.map(({ card, qty }) => (
                    <MiniCard
                      key={card.id}
                      card={card}
                      qty={qty}
                      lang={lang}
                      thumbW={thumbW}
                      onChangeQty={activeOnChangeQty}
                      onToggle={activeOnToggle}
                      trackPointer={trackPointer}
                      hidePreview={hidePreview}
                      isMobile={isMobile}
                      onPreview={onPreview}
                      proxyMode={proxyMode}
                      zone={activeZone}
                      room={capCtx
                        ? remainingCopies(card, activeZone, { quantities, zones }, capCtx)
                        : { remaining: Infinity, ruleId: null }}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* Shared hover preview (hidden until a card is hovered). */}
      <CardPreview previewRef={previewRef} previewImgRef={previewImgRef} stampRef={stampRef} />
    </div>
  );
}
