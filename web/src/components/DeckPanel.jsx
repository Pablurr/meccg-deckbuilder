import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cardName, deckThumbWidth } from '../lib/lang.js';
import { useCardPreview, CardPreview } from './CardPreview.jsx';
import { useT } from '../i18n.jsx';
import MiniCard from './MiniCard.jsx';
import ZoneTabs from './ZoneTabs.jsx';
import DeckNotes from './DeckNotes.jsx';
import { isDropAllowed, resolveDropTarget } from '../lib/rules/dropTargets.js';
import { moveTargets } from '../lib/rules/zones.js';
import { LENGTHS, SIDEBOARD_FW_MAX } from '../lib/rules/formats.js';
import { SIDES } from '../lib/rules/sides.js';
import { backGroupForType } from '../lib/deck.js';
import { buildGroups } from '../lib/deckList.js';
import { REPORT_ISSUES_URL } from '../lib/constants.js';
import { COE, RULE_BY_ID } from '../lib/rules/catalog.js';
import { refText } from '../lib/rules/docText.js';
import { remainingCopies } from '../lib/rules/copies.js';
import { cardWidthFor, deckZoneWidth, MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM_DESKTOP } from '../lib/zoom.js';
import { placePopover } from '../lib/popover.js';

const SEV_ICON = { error: '⛔', warning: '⚠', info: 'ℹ' };

// The hover panel waits this long before appearing, so sweeping the pointer
// across the warnings list on the way somewhere else never flashes it.
const WARN_HOVER_DELAY_MS = 180;

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
  if ((w.ruleId === 'SIDEBOARD-MAX' || w.ruleId === 'SIDEBOARD-FW-MAX' || w.ruleId === 'POOL-CHARS' || w.ruleId === 'POOL-ITEMS') && p.count != null && p.max != null) {
    p.over = p.count - p.max;
  }
  return p;
}

// Stable identity for one warning, so which cards are unfolded survives the
// re-validation that runs on every edit.
//
// ruleId + code is not enough on its own: POOL-ITEMS.unique and the
// multi-name codes fire once per offending card, so the card the warning is
// about joins the key. Keyed on ruleId alone, unfolding one card's warning
// would unfold its siblings; keyed on the array index, a warning disappearing
// would hand its unfolded state to whichever warning shifted into its slot.
export function warningKey(w) {
  const p = (w && w.params) || {};
  return [w && w.ruleId, w && w.code, p.id || p.avatarId || ''].join(':');
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
  zoom = DEFAULT_ZOOM_DESKTOP,
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
  const hasSideboardFw = Object.keys(zones.sideboardFw || {}).length > 0;
  const tabs = deckbuilding
    ? ['play', 'pool', 'sideboard', 'sideboardFw', 'location', 'notes']
    : ['cards', ...(hasPool ? ['pool'] : []), ...(hasSideboard ? ['sideboard'] : []),
       ...(hasSideboardFw ? ['sideboardFw'] : []), 'notes'];
  const [tab, setTab] = useState(deckbuilding ? 'play' : 'cards');
  // Sheet only: the zoom slider is a secondary control, so it hides behind a
  // toggle in the tab strip instead of taking a third row in the head. The
  // trigger lives in that strip rather than next to the title because the
  // strip is already 44px tall on touch, so it costs no extra height there.
  const [showZoom, setShowZoom] = useState(false);
  // Which rule warnings are unfolded, by warningKey. Folded is the default:
  // five warnings on a 14-card deck already filled 574px before the 35vh cap,
  // and the block grows with the deck, so the full text of every one of them
  // is more than the panel can show at once.
  const [openWarns, setOpenWarns] = useState(() => new Set());
  const toggleWarn = (key) => {
    hideWarnPanel(); // else the hover panel lingers beside a card now unfolded
    setOpenWarns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // Folding the warnings made the list scannable, but it put the message
  // itself behind a click — a lot to ask of someone with a mouse in hand just
  // to read one sentence. Hovering a folded card now shows its full text.
  //
  // Mouse only, and deliberately read-only: the actions (ignore this rule,
  // report it, the CoE link) stay in the unfolded card, so nothing here has to
  // be reachable, and the pointer never has to travel into a panel that could
  // move out from under it. Touch has no hover and keeps the tap-to-unfold it
  // already had.
  const [hoverWarn, setHoverWarn] = useState(null);
  const warnPopRef = useRef(null);
  const warnTimerRef = useRef(null);
  function hideWarnPanel() {
    clearTimeout(warnTimerRef.current);
    setHoverWarn(null);
  }
  function showWarnPanel(e, w) {
    // The rect is read now, while the event target is still under the pointer,
    // and stays valid because any scroll cancels the panel outright (below).
    const r = e.currentTarget.getBoundingClientRect();
    const rect = { left: r.left, right: r.right, top: r.top };
    clearTimeout(warnTimerRef.current);
    warnTimerRef.current = setTimeout(() => setHoverWarn({ w, rect }), WARN_HOVER_DELAY_MS);
  }
  // Positioned after the panel is in the DOM (its height depends on how long
  // the message is) but before paint, so it never shows up at 0,0 first.
  useLayoutEffect(() => {
    const el = warnPopRef.current;
    if (!el || !hoverWarn) return;
    const { left, top } = placePopover(
      hoverWarn.rect,
      { width: el.offsetWidth, height: el.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
    );
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [hoverWarn]);
  // Any scroll invalidates the anchor rect, and scrolling does not reliably
  // fire mouse events — same trap as the card hover preview. capture=true
  // because scroll from inner containers (the warnings list itself, the deck
  // body) does not bubble.
  useEffect(() => {
    const cancel = () => hideWarnPanel();
    window.addEventListener('wheel', cancel, true);
    window.addEventListener('scroll', cancel, true);
    return () => {
      window.removeEventListener('wheel', cancel, true);
      window.removeEventListener('scroll', cancel, true);
      clearTimeout(warnTimerRef.current);
    };
  }, []);
  // The deck's mode can change (setup dialog) after mount, and a freeform
  // deck's pool/sideboard tabs can appear or disappear as those zones empty
  // out; if the current tab no longer exists, fall back to the first tab
  // rather than showing nothing.
  useEffect(() => {
    if (!tabs.includes(tab)) setTab(tabs[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckbuilding, hasPool, hasSideboard, hasSideboardFw]);

  // Card width driven by the zoom slider, which is now a percentage of the
  // width available to the deck list rather than of the 570px source image:
  // one setting therefore means one visual density whether the panel is at its
  // 280px minimum or maximised, instead of the old absolute width that gave a
  // single card per row in a narrow panel and six in a wide one.
  //
  // The zone's outer width comes from data we already hold — the `width` prop
  // on desktop, the viewport on the full-screen sheet — rather than from a
  // measured DOM node, which keeps cardWidthFor a pure function and mirrors
  // how `maxW` below already reads window.innerWidth. A viewport change the
  // component doesn't re-render for only makes the grid slightly less dense
  // than intended; min(…,100%) still stops a card overflowing its column.
  const outerWidth = asSheet
    ? (typeof window !== 'undefined' ? window.innerWidth : DEFAULT_WIDTH)
    : width;
  const cardW = cardWidthFor(deckZoneWidth(outerWidth), zoom);
  const thumbW = deckThumbWidth(cardW);
  const gridStyle = { gridTemplateColumns: `repeat(auto-fill, minmax(min(${cardW}px, 100%), ${cardW}px))` };

  // One definition, two placements: inline in the head on desktop, in a
  // disclosure row under the tabs on the sheet. Duplicating the markup would
  // let the two drift apart (min/max/step are the slider's contract).
  // min/max come from zoom.js because they are also the range parseStoredZoom
  // accepts: a bound that lived only here could drift out of sync and make the
  // slider emit values its own reader would reject as corrupt.
  const zoomControl = (
    <label className="deckpanel-zoom">
      {t('panel.zoom')}
      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step="5"
        value={zoom}
        onChange={(e) => onZoom(Number(e.target.value))}
      />
      <span className="deckpanel-zoom-val">{zoom}%</span>
    </label>
  );

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
    sideboardFw: sumQty(zones.sideboardFw),
    cards: counts.total,
    notes: null, // the Notes tab carries no count
  };
  // 1.6.1's ten are granted flat, so unlike sideboardMax this cap does not
  // depend on the ruleset -- it is the same number in freeform, where the tab
  // only appears at all because the zone is non-empty.
  const tabCaps = { play: null, location: null, pool: poolMax, sideboard: sbMax, sideboardFw: SIDEBOARD_FW_MAX, cards: null, notes: null };
  const tabLabels = {
    play: t('zones.play'),
    location: t('zones.location'),
    pool: t('zones.pool'),
    sideboard: t('zones.sideboard'),
    sideboardFw: t('zones.sideboardFw'),
    cards: t('zones.cards'),
    notes: t('zones.notes'),
  };
  const optionalTabs = new Set(['sideboardFw']);
  const tabTitles = { sideboardFw: t('zones.sideboardFwFull') };

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
  } else if (tab === 'pool' || tab === 'sideboard' || tab === 'sideboardFw') {
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
        {!asSheet && zoomControl}
      </div>

      <div className="ztabs-row">
        <ZoneTabs
          tabs={tabs}
          active={tab}
          onSelect={setTab}
          onDrop={onDropOnTab}
          labels={tabLabels}
          counts={tabCounts}
          caps={tabCaps}
          optional={optionalTabs}
          titles={tabTitles}
        />
        {asSheet && (
          <button
            type="button"
            className={`ztabs-zoom ${showZoom ? 'on' : ''}`}
            onClick={() => setShowZoom((v) => !v)}
            aria-expanded={showZoom}
            aria-label={t('panel.zoom')}
          >{zoom}%</button>
        )}
      </div>
      {asSheet && showZoom && <div className="sheet-zoom">{zoomControl}</div>}

      {/* A region, not role="status". As a status the whole block was a live
          region, so every deck edit re-announced all five warnings in full --
          and validateDeck re-runs on every edit. Only the short count inside
          is live now; the cards themselves are navigable content. */}
      {ruleWarnings.length > 0 && (
        <div className="rule-warns" role="region" aria-label={t('rules.warningsRegion')}>
          <span className="sr-only" aria-live="polite">
            {t('rules.warningsCount', { n: ruleWarnings.length })}
          </span>
          {ruleWarnings.map((w, i) => {
            const key = warningKey(w);
            const open = openWarns.has(key);
            const params = localizeParams(w, { cardsById, lang, t });
            const ref = refText(t, RULE_BY_ID.get(w.ruleId) || {});
            return (
              <div
                key={`${key}:${i}`}
                className={`rule-warn ${w.severity} ${open ? 'open' : ''}`}
                // Unfolded, the text is already on screen: a panel repeating it
                // would just cover the card it belongs to.
                onMouseEnter={isMobile || open ? undefined : (e) => showWarnPanel(e, w)}
                onMouseLeave={isMobile || open ? undefined : hideWarnPanel}
              >
                {/* Always-visible line: severity icon, rule id, and -- folded
                    only -- a shortcut to silence the rule. Unfolded, the same
                    action is the labelled link below, so showing both would
                    put one destructive action twice in one card. */}
                <div className="rule-head">
                  <button
                    type="button"
                    className="rule-disclose"
                    onClick={() => toggleWarn(key)}
                    aria-expanded={open}
                    aria-label={t('rules.details')}
                  >{open ? '▾' : '▸'}</button>
                  <span className="rule-sev">
                    <span aria-hidden="true">{SEV_ICON[w.severity]}</span>
                    {/* The severity word is dropped from the folded line to keep
                        it to one row, so it stays for assistive tech only --
                        the icon alone carries no accessible name. */}
                    <span className="sr-only">{t(`rules.severity.${w.severity}`)}</span>
                  </span>
                  <code>{w.ruleId}</code>
                  {!open && (
                    <button
                      type="button"
                      className="rule-ignore"
                      onClick={() => onToggleRule(w.ruleId, false)}
                      aria-label={t('rules.disable')}
                      title={t('rules.disable')}
                    >⊘</button>
                  )}
                </div>
                {open && (
                  <>
                    <span className="msg">{t(`rules.${w.code}`, params)}</span>
                    <span className="rule-meta">
                      {ref && (
                        <a className="linklike" href={COE} target="_blank" rel="noreferrer">{ref}</a>
                      )}
                      <button className="linklike" onClick={() => onToggleRule(w.ruleId, false)}>{t('rules.disable')}</button>
                      <a className="linklike" href={reportUrl(w)} target="_blank" rel="noreferrer">{t('rules.report')}</a>
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* aria-hidden on purpose: every word here is already reachable through
          the disclosure button above (which carries aria-expanded and reveals
          the same text plus its actions). Exposing it a second time would
          duplicate the whole warnings list to assistive tech, and a panel that
          only a pointer can summon has no keyboard path to it anyway. */}
      {hoverWarn && (
        <div className="rule-popover" ref={warnPopRef} aria-hidden="true">
          <div className="rule-popover-head">
            <span className={`rule-sev ${hoverWarn.w.severity}`}>{SEV_ICON[hoverWarn.w.severity]}</span>
            <code>{hoverWarn.w.ruleId}</code>
            {refText(t, RULE_BY_ID.get(hoverWarn.w.ruleId) || {}) && (
              <span className="rule-popover-ref">{refText(t, RULE_BY_ID.get(hoverWarn.w.ruleId) || {})}</span>
            )}
          </div>
          <p>{t(`rules.${hoverWarn.w.code}`, localizeParams(hoverWarn.w, { cardsById, lang, t }))}</p>
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
                      // The touch equivalent of dragging this card onto another
                      // zone tab; both routes end in the same moveCopy.
                      moveTargets={moveTargets(card, activeZone)}
                      onMove={(toZone) => moveCopy(card.id, activeZone, toZone)}
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
