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

// Deckbuilding-only zone controls for one card cell. State is local to this
// component instance so expanding one card's extra zones never affects any
// other cell in the grid.
function ZoneCtrls({ card, zones, quantities, changeZoneQty, t, capCtx }) {
  const [expanded, setExpanded] = useState(false);
  const z = zonesFor(card);
  const zoneQty = (zone) => (zone === 'deck' ? (quantities[card.id] || 0) : (zones[zone][card.id] || 0));
  const room = (zone) => (capCtx
    ? remainingCopies(card, zone, { quantities, zones }, capCtx)
    : { remaining: Infinity, ruleId: null });
  return (
    <div className="zone-ctrls">
      <div className="qty-ctrl zoned">
        <span className="zlbl">{t(`zoneShort.${z.primary}`)}</span>
        <button className="qty-btn" onClick={() => changeZoneQty(z.primary, card.id, -1)} aria-label={t('browser.removeCopy')}>−</button>
        <span className="qty-count">{zoneQty(z.primary)}</span>
        {(() => {
          const r = room(z.primary);
          return (
            <button
              className="qty-btn"
              disabled={r.remaining <= 0}
              title={capTitle(t, r.ruleId, r.remaining)}
              onClick={() => changeZoneQty(z.primary, card.id, +1)}
              aria-label={t('browser.addCopy')}
            >+</button>
          );
        })()}
      </div>
      {z.extra.length > 0 && !expanded && (
        <button className="zone-expander" onClick={() => setExpanded(true)}>
          {z.extra.map((zn) => `${t(`zoneShort.${zn}`)} ${zoneQty(zn)}`).join(' · ')} ⌃
        </button>
      )}
      {expanded && z.extra.map((zn) => (
        <div key={zn} className="qty-ctrl zoned muted">
          <span className="zlbl">{t(`zoneShort.${zn}`)}</span>
          <button className="qty-btn" onClick={() => changeZoneQty(zn, card.id, -1)} aria-label={t('browser.removeCopy')}>−</button>
          <span className="qty-count">{zoneQty(zn)}</span>
          {(() => {
            const r = room(zn);
            return (
              <button
                className="qty-btn"
                disabled={r.remaining <= 0}
                title={capTitle(t, r.ruleId, r.remaining)}
                onClick={() => changeZoneQty(zn, card.id, +1)}
                aria-label={t('browser.addCopy')}
              >+</button>
            );
          })()}
        </div>
      ))}
    </div>
  );
}

export default function CardBrowser({ cards, filters, quantities, lang, onChangeQty, onToggle, onSelectAll, isMobile, onPreview, proxyMode, deckMode, side, zones, changeZoneQty, capCtx }) {
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
  // (never disabled — the app advises, it never blocks what can be added).
  const legal = (c) => isLegalForSide(c, side, openBalrog, bannedIds);
  const visible = side && !showAll ? filtered.filter(legal) : filtered;
  const shown = visible.slice(0, CAP);
  const { previewRef, previewImgRef, stampRef, trackPointer, hidePreview } = useCardPreview(lang, proxyMode);

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
              <ProxyStamp card={c} lang={lang} on={proxyMode} />
              {deckbuilding ? (
                <ZoneCtrls card={c} zones={zones} quantities={quantities} changeZoneQty={changeZoneQty} t={t} capCtx={capCtx} />
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
