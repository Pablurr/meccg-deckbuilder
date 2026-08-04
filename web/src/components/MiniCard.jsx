import React, { useState } from 'react';
import { cardName, cardThumbSrc, cardImageEn } from '../lib/lang.js';
import ProxyStamp from './ProxyStamp.jsx';
import { useT } from '../i18n.jsx';
import { capTitle } from '../lib/rules/docText.js';
import { ZONE_LABEL_KEY } from '../lib/rules/zones.js';

// One selected card, shown as a compact version of a browser grid cell: same
// thumbnail + same −/count/+ control. Clicking the image asks for confirmation
// before removing the card, so a stray click can't silently empty the deck.
// Hover shows the shared full-size preview so the card stays readable at any panel width.
//
// `moveTargets` is the zones this copy may move to, already excluding the one
// it sits in. Dragging the card onto a zone tab stays the desktop route, but
// the card is not draggable on touch at all, so without this menu a phone user
// had to remove the copy and re-add it from the browser just to reshuffle
// zones. An empty list (a Site, which only ever has the deck) renders no
// trigger, rather than a menu with nothing to choose.
export default function MiniCard({ card, qty, lang, thumbW, onChangeQty, onToggle, trackPointer, hidePreview, isMobile, onPreview, proxyMode, zone = 'deck', room = { remaining: Infinity, ruleId: null }, moveTargets = [], onMove }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [moving, setMoving] = useState(false);
  const name = cardName(card, lang);
  return (
    <div
      className="cardcell deck-mini selected"
      title={name}
      draggable={!isMobile}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', JSON.stringify({ id: card.id, from: zone }))}
    >
      <img
        src={cardThumbSrc(card, lang, thumbW)}
        alt={name}
        loading="lazy"
        onClick={() => (isMobile ? onPreview(card) : setConfirming(true))}
        onMouseEnter={(e) => trackPointer(e, card)}
        onMouseMove={(e) => trackPointer(e, card)}
        onMouseLeave={hidePreview}
        onError={(e) => {
          // Missing localized thumb → English thumb → full-res English
          // (also covers the proxy being unavailable).
          const el = e.currentTarget;
          const chain = [...new Set([cardThumbSrc(card, lang, thumbW), cardThumbSrc(card, 'en', thumbW), cardImageEn(card)].filter(Boolean))];
          const next = chain[chain.indexOf(el.getAttribute('src')) + 1];
          if (next) el.src = next;
        }}
      />
      <ProxyStamp card={card} lang={lang} on={proxyMode} />
      {confirming ? (
        <div className="deck-mini-confirm">
          <button
            className="btn danger small"
            onClick={() => { setConfirming(false); onToggle(card.id); }}
          >{t('panel.remove')}</button>
          <button
            className="btn secondary small"
            onClick={() => setConfirming(false)}
          >{t('common.cancel')}</button>
        </div>
      ) : moving ? (
        // Same inline-disclosure shape as the remove confirmation above: the
        // choice replaces the quantity controls in place, so it needs no
        // popup layer and no extra tap to dismiss.
        <div className="deck-mini-confirm deck-mini-move">
          {moveTargets.map((target) => (
            <button
              key={target}
              className="btn secondary small"
              onClick={() => { setMoving(false); onMove(target); }}
              aria-label={t('panel.moveTo', { zone: t(ZONE_LABEL_KEY[target]) })}
            >{t(`zoneShort.${target}`)}</button>
          ))}
          <button
            className="btn secondary small"
            onClick={() => setMoving(false)}
          >{t('common.cancel')}</button>
        </div>
      ) : (
        <>
          {isMobile ? (
            // Touch: the count only. Tapping the image opens the card modal,
            // which owns quantity editing on that layout -- same split as the
            // browser tile's ZoneCtrls, and for the same reasons: a 105px card
            // cannot hold 44px buttons, and the cap reason these had was a
            // title= tooltip that touch never surfaces.
            <div className="qty-ctrl readonly">
              <span className="qty-count">{qty}</span>
            </div>
          ) : (
            <div className="qty-ctrl">
              <button
                className="qty-btn"
                disabled={room.remaining <= 0}
                title={capTitle(t, room.ruleId, room.remaining)}
                onClick={() => onChangeQty(card.id, +1)}
                aria-label={t('browser.addCopy')}
              >+</button>
              <span className="qty-count">{qty}</span>
              <button
                className="qty-btn"
                onClick={() => onChangeQty(card.id, -1)}
                aria-label={t('browser.removeCopy')}
              >−</button>
            </div>
          )}
          {moveTargets.length > 0 && (
            // Deliberately a sibling of .qty-ctrl rather than a fourth button
            // inside it: as its own control it can be grown to a 44px touch
            // target on mobile without stretching the +/count/− stack, whose
            // compact size the deck grid depends on at every panel width.
            <button
              className="deck-mini-move-btn"
              onClick={() => setMoving(true)}
              title={t('panel.move')}
              aria-label={t('panel.move')}
            >⇄</button>
          )}
        </>
      )}
    </div>
  );
}
