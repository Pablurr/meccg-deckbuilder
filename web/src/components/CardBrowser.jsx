import React, { useMemo, useState } from 'react';
import { filterCards } from '../lib/filter.js';
import { cardName, cardImageSrc, cardThumbSrc } from '../lib/lang.js';
import { useCardPreview, CardPreview } from './CardPreview.jsx';
import ProxyStamp from './ProxyStamp.jsx';
import { useT } from '../i18n.jsx';
import { zonesFor } from '../lib/rules/zones.js';
import { isLegalForSide } from '../lib/rules/sides.js';
import { siteIndex } from '../lib/rules/sites.js';
import { resolveBanned } from '../lib/rules/banned.js';
import { isRuleEnabled } from '../lib/rules/catalog.js';
import { remainingCopies } from '../lib/rules/copies.js';
import { capTitle } from '../lib/rules/docText.js';

const CAP = 600; // safety cap on rendered cells

// One zone's stepper: label, −, count, +, laid out horizontally.
//
// It used to be a vertical stack (label over + over count over −), which cost
// ~65px of height per zone. Three of them therefore needed ~200px inside a
// 168px tile, so expanding a card showed the first counter and pushed the
// others off the artwork — the reason the extra zones were unusable.
// Horizontal, a row costs ~24px and all three fit with room to spare.
//
// Reading −/count/+ left to right is the other half of the fix: that is the
// direction the number moves, and it matches the card modal's bar. (The
// up-means-more argument only applied while the control was a vertical stack.)
function ZoneRow({ zone, qty, room, onChange, t, muted = false }) {
  const label = t(`zoneShort.${zone}`);
  return (
    <div className={`qty-ctrl zoned${muted ? ' muted' : ''}`}>
      <span className="zlbl">{label}</span>
      {/* Three rows are visible at once now, so the buttons have to say WHICH
          zone they act on: without the suffix a screen reader announces three
          identically named "add a copy" buttons. zoneShort is used rather than
          the full zone name because it is the only key that exists for all
          three (the play zone is `zoneShort.deck` but `zones.play`). */}
      <button
        className="qty-btn"
        disabled={qty <= 0}
        onClick={() => onChange(zone, -1)}
        aria-label={`${t('browser.removeCopy')} (${label})`}
      >−</button>
      <span className="qty-count">{qty}</span>
      <button
        className="qty-btn"
        disabled={room.remaining <= 0}
        title={capTitle(t, room.ruleId, room.remaining)}
        onClick={() => onChange(zone, +1)}
        aria-label={`${t('browser.addCopy')} (${label})`}
      >+</button>
    </div>
  );
}

// Deckbuilding-only zone controls for one card cell. State is local to this
// component instance so expanding one card's extra zones never affects any
// other cell in the grid.
function ZoneCtrls({ card, zones, quantities, changeZoneQty, t, capCtx, isMobile }) {
  const [expanded, setExpanded] = useState(false);
  const z = zonesFor(card);
  const zoneQty = (zone) => (zone === 'deck' ? (quantities[card.id] || 0) : (zones[zone][card.id] || 0));

  // Touch: the tile reports counts and nothing more. A tap already opens the
  // card modal (see the img onClick below), and that modal owns quantity
  // editing there because it has room for 44px buttons and for saying WHY a +
  // is blocked. Neither fits a 116x162 tile: these controls needed 20x18
  // buttons, their cap reason lived in a title= tooltip touch can never
  // surface, and the overlay covered 64% of the artwork. Desktop keeps them --
  // a mouse is precise and hover shows the tooltip.
  if (isMobile) {
    const held = [z.primary, ...z.extra].filter((zn) => zoneQty(zn) > 0);
    if (held.length === 0) return null;
    return (
      <div className="zone-ctrls readonly">
        {held.map((zn) => (
          <span key={zn} className="zone-tally">{t(`zoneShort.${zn}`)} {zoneQty(zn)}</span>
        ))}
      </div>
    );
  }
  const room = (zone) => (capCtx
    ? remainingCopies(card, zone, { quantities, zones }, capCtx)
    : { remaining: Infinity, ruleId: null });
  const onChange = (zone, delta) => changeZoneQty(zone, card.id, delta);
  const row = (zone, muted) => (
    <ZoneRow key={zone} zone={zone} qty={zoneQty(zone)} room={room(zone)} onChange={onChange} t={t} muted={muted} />
  );
  return (
    // Expanded, the rows share one background instead of floating as three
    // separate chips: one padded panel reads as a single control and costs
    // less of the artwork than three do.
    <div className={`zone-ctrls${expanded ? ' expanded' : ''}`}>
      {row(z.primary, false)}
      {expanded && z.extra.map((zn) => row(zn, true))}
      {z.extra.length > 0 && (
        // A toggle, not the one-way "reveal" it was: expanding used to be
        // final for the life of the cell, so a player who opened it to check a
        // count could not give the artwork back.
        //
        // Collapsed it lists the hidden zones with their counts (the whole
        // point of a summary); expanded it lists only their names, because the
        // counts are then on screen right below it and repeating them is noise
        // on a 116px tile. Keeping the names in both states is what gives the
        // button an accessible name without inventing a new i18n key.
        <button
          className="zone-expander"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
        >
          {z.extra.map((zn) => (expanded ? t(`zoneShort.${zn}`) : `${t(`zoneShort.${zn}`)} ${zoneQty(zn)}`)).join(' · ')}
          {expanded ? ' ▴' : ' ▾'}
        </button>
      )}
    </div>
  );
}

export default function CardBrowser({ cards, filters, quantities, lang, onChangeQty, onToggle, onSelectAll, isMobile, onPreview, proxyMode, setNames, deckMode, side, zones, changeZoneQty, capCtx }) {
  const t = useT();
  const [showAll, setShowAll] = useState(false);
  const filtered = useMemo(() => filterCards(cards, filters), [cards, filters]);
  // 1.4.1 opens five Balrog sites (no hero or minion counterpart) to every
  // side. isLegalForSide doesn't know about it on its own, so derive the set
  // from siteIndex -- the single source of truth the validator also reads --
  // and OR it into both legality checks below.
  const openBalrog = useMemo(() => siteIndex(cards).openBalrog, [cards]);
  // 1.3.F6 / 1.3.B5 ban a named list of cards for the Fallen-wizard and the
  // Balrog. Those cards are legal by alignment, so nothing else in the filter
  // catches them — without this they sit in the browser looking playable and
  // only the validator objects, after the player has already added them.
  //
  // Gated on the rule being enabled: turning BANNED off in the rules panel
  // stops the validator complaining, so it must un-hide them too, or the
  // browser would keep enforcing a rule the player switched off. The gate is
  // read into a boolean rather than depending on capCtx, which App rebuilds on
  // every render and would re-walk all 1683 cards each time.
  const banEnforced = Boolean(side) && isRuleEnabled('BANNED', (capCtx && capCtx.ruleOverrides) || {});
  const bannedIds = useMemo(
    () => (banEnforced ? resolveBanned(cards).bySide[side] : undefined),
    [cards, side, banEnforced],
  );
  // Legality filter: on by default in deckbuilding, hides cards that aren't
  // legal for the chosen side. `showAll` reveals the rest, visibly marked
  // (never disabled by this filter). Copy caps are the only thing that
  // actually blocks an add, via remainingCopies/ZoneCtrls below.
  const legal = (c) => isLegalForSide(c, side, openBalrog, bannedIds);
  const visible = side && !showAll ? filtered.filter(legal) : filtered;
  const shown = visible.slice(0, CAP);
  const { previewRef, previewImgRef, stampRef, trackPointer, hidePreview } = useCardPreview(lang, proxyMode, setNames);

  return (
    <div className="browser">
      <div className="browser-meta">
        <span>
          {t('browser.count', { n: visible.length })}{visible.length > CAP ? t('browser.capped', { cap: CAP }) : ''}
        </span>
        <div className="browser-actions">
          {visible.length > 0 && (
            <button className="btn secondary small" onClick={() => onSelectAll(visible.map((c) => c.id))}>
              {t('browser.selectAll', { n: visible.length })}
            </button>
          )}
          {side && (
            <label className="legality-toggle">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              {t('browser.showAll')}
            </label>
          )}
        </div>
      </div>
      <div className="grid">
        {shown.map((c) => {
          const qty = quantities[c.id] || 0;
          const name = cardName(c, lang);
          const deckbuilding = deckMode === 'deckbuilding';
          const anySelected = deckbuilding
            ? qty > 0 || (zones.sideboard[c.id] || 0) > 0 || (zones.pool[c.id] || 0) > 0
            : qty > 0;
          const illegal = deckbuilding && side && showAll && !legal(c);
          return (
            <div key={c.id} className={`cardcell ${anySelected ? 'selected' : ''} ${illegal ? 'illegal' : ''}`}>
              {/* A real element, not the ::after it used to be: generated content
                  carries no text alternative, so the one thing distinguishing an
                  illegal card was invisible to assistive tech and to anyone who
                  cannot read the glyph. The mark is decorative; the sr-only span
                  is what says what it means. */}
              {illegal && (
                <span className="illegal-mark">
                  <span aria-hidden="true">⚠</span>
                  <span className="sr-only">{t('browser.illegalMark')}</span>
                </span>
              )}
              {/* Click image to select (qty 1) / deselect. Use −/+ for copies once selected.
                  Hover shows a full-size preview. */}
              <img
                src={cardThumbSrc(c, lang)}
                alt={name}
                loading="lazy"
                onClick={() => (isMobile ? onPreview(c) : onToggle(c.id))}
                onMouseEnter={(e) => trackPointer(e, c)}
                onMouseMove={(e) => trackPointer(e, c)}
                onMouseLeave={hidePreview}
                onError={(e) => {
                  // Missing localized thumb → English thumb → direct full-res
                  // (the last step also covers the proxy being unavailable).
                  const el = e.currentTarget;
                  const chain = [...new Set([cardThumbSrc(c, lang), cardThumbSrc(c, 'en'), cardImageSrc(c, 'en')].filter(Boolean))];
                  const next = chain[chain.indexOf(el.getAttribute('src')) + 1];
                  if (next) el.src = next;
                }}
              />
              <ProxyStamp card={c} lang={lang} on={proxyMode} setNames={setNames} />
              {deckbuilding ? (
                <ZoneCtrls card={c} zones={zones} quantities={quantities} changeZoneQty={changeZoneQty} t={t} capCtx={capCtx} isMobile={isMobile} />
              ) : (
                qty > 0 && (
                  <div className="qty-ctrl">
                    <button className="qty-btn" onClick={() => onChangeQty(c.id, +1)} aria-label={t('browser.addCopy')}>+</button>
                    <span className="qty-count">{qty}</span>
                    <button className="qty-btn" onClick={() => onChangeQty(c.id, -1)} aria-label={t('browser.removeCopy')}>−</button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
      {/* Shared hover preview (hidden until a card is hovered). */}
      <CardPreview previewRef={previewRef} previewImgRef={previewImgRef} stampRef={stampRef} />
    </div>
  );
}
