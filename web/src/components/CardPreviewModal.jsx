import React from 'react';
import { cardName, cardImageSrc, cardImageEn } from '../lib/lang.js';
import ProxyStamp from './ProxyStamp.jsx';
import { useT } from '../i18n.jsx';
import { capTitle } from '../lib/rules/docText.js';
import { ZONE_LABEL_KEY } from '../lib/rules/zones.js';

// Full-screen card preview for touch (desktop uses the hover CardPreview).
// The image is constrained to fit ENTIRELY within the viewport (see styles):
// the wrapper takes the space above the control bar and the img uses
// object-fit:contain, so the whole card is always visible without scrolling.
//
// `rows` is one entry per zone THIS card may occupy, built by App from
// zoneTargets -- never a fixed deck/sideboard/pool triple, since a Site has
// only the deck and an avatar may never enter the pool. On a phone, tapping a
// card tile opens this modal instead of toggling the card, so these counters
// are the primary way to add a copy anywhere; a single deck-only counter left
// the sideboard and the pool unreachable by touch.
export default function CardPreviewModal({ card, lang, rows = [], onChangeZoneQty, onClose, proxyMode }) {
  const t = useT();
  if (!card) return null;
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
            <ProxyStamp card={card} lang={lang} on={proxyMode} />
          </div>
        </div>
        <div className="card-modal-bar" onClick={(e) => e.stopPropagation()}>
          {rows.map(({ zone, qty, room }) => {
            // A blocked + must SAY why on screen. capTitle's sentence used to
            // be a title= tooltip only, which touch can never surface, and a
            // disabled button is not focusable either -- so the cap was
            // invisible and the button looked simply broken.
            const reason = capTitle(t, room.ruleId, room.remaining);
            return (
              <div className="card-modal-zone" key={zone}>
                {/* The row is the labelled group, so the two buttons keep their
                    plain "add a copy" / "remove a copy" names instead of a
                    concatenated per-zone string that would force English word
                    order onto every language. */}
                <div className="card-modal-zone-row" role="group" aria-label={t(ZONE_LABEL_KEY[zone])}>
                  <span className="card-modal-zone-name">{t(ZONE_LABEL_KEY[zone])}</span>
                  <button
                    className="qty-btn big"
                    onClick={() => onChangeZoneQty(zone, card.id, -1)}
                    disabled={qty <= 0}
                    aria-label={t('browser.removeCopy')}
                  >−</button>
                  <span className="card-modal-count">{qty}</span>
                  <button
                    className="qty-btn big"
                    onClick={() => onChangeZoneQty(zone, card.id, +1)}
                    disabled={room.remaining <= 0}
                    aria-label={t('browser.addCopy')}
                  >+</button>
                </div>
                {reason && <div className="card-modal-zone-reason">{reason}</div>}
              </div>
            );
          })}
          <button className="btn" onClick={onClose}>{t('common.done')}</button>
        </div>
      </div>
    </div>
  );
}
