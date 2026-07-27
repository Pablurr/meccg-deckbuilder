import React, { useState } from 'react';
import { cardName, cardThumbSrc, cardImageEn } from '../lib/lang.js';
import ProxyStamp from './ProxyStamp.jsx';
import { useT } from '../i18n.jsx';
import { capTitle } from '../lib/rules/docText.js';

// One selected card, shown as a compact version of a browser grid cell: same
// thumbnail + same −/count/+ control. Clicking the image asks for confirmation
// before removing the card, so a stray click can't silently empty the deck.
// Hover shows the shared full-size preview so the card stays readable at any zoom.
export default function MiniCard({ card, qty, lang, thumbW, onChangeQty, onToggle, trackPointer, hidePreview, isMobile, onPreview, proxyMode, zone = 'deck', room = { remaining: Infinity, ruleId: null } }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
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
      <ProxyStamp card={card} lang={lang} on={proxyMode} src={cardThumbSrc(card, lang, thumbW)} />
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
    </div>
  );
}
