import React from 'react';
import { cardName, cardImageSrc, cardImageEn } from '../lib/lang.js';
import { maxCopies } from '../lib/deck.js';
import ProxyStamp from './ProxyStamp.jsx';
import { useT } from '../i18n.jsx';

// Full-screen card preview for touch (desktop uses the hover CardPreview).
// The image is constrained to fit ENTIRELY within the viewport (see styles):
// the wrapper takes the space above the control bar and the img uses
// object-fit:contain, so the whole card is always visible without scrolling.
export default function CardPreviewModal({ card, qty, lang, onChangeQty, onClose, proxyMode }) {
  const t = useT();
  if (!card) return null;
  const max = maxCopies(card);
  const name = cardName(card, lang);
  return (
    // Clicking anywhere (the card image or the letterbox around it) closes the
    // modal; only the quantity bar swallows the click so ＋/− don't dismiss it.
    <div className="card-modal-backdrop" onClick={onClose}>
      <div className="card-modal">
        <div className="card-modal-imgwrap">
          <div className="proxy-wrap">
            <img
              src={cardImageSrc(card, lang)}
              alt={name}
              onError={(e) => {
                const el = e.currentTarget;
                const en = cardImageEn(card);
                if (en && el.getAttribute('src') !== en) el.src = en;
              }}
            />
            <ProxyStamp card={card} lang={lang} on={proxyMode} src={cardImageSrc(card, lang)} />
          </div>
        </div>
        <div className="card-modal-bar" onClick={(e) => e.stopPropagation()}>
          <button
            className="qty-btn big"
            onClick={() => onChangeQty(card.id, -1)}
            disabled={qty <= 0}
            aria-label={t('browser.removeCopy')}
          >−</button>
          <span className="card-modal-count">{qty}</span>
          <button
            className="qty-btn big"
            onClick={() => onChangeQty(card.id, +1)}
            disabled={qty >= max}
            aria-label={t('browser.addCopy')}
          >+</button>
          <button className="btn" onClick={onClose}>{t('common.done')}</button>
        </div>
      </div>
    </div>
  );
}
