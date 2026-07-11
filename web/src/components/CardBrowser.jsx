import React, { useMemo } from 'react';
import { filterCards } from '../lib/filter.js';
import { maxCopies } from '../lib/deck.js';
import { cardName, cardImageSrc, cardThumbSrc } from '../lib/lang.js';
import { useCardPreview, CardPreview } from './CardPreview.jsx';
import { useT } from '../i18n.jsx';

const CAP = 600; // safety cap on rendered cells

export default function CardBrowser({ cards, filters, quantities, lang, onChangeQty, onToggle, onSelectAll }) {
  const t = useT();
  const filtered = useMemo(() => filterCards(cards, filters), [cards, filters]);
  const shown = filtered.slice(0, CAP);
  const { previewRef, previewImgRef, trackPointer, hidePreview } = useCardPreview(lang);

  return (
    <div className="browser">
      <div className="browser-meta">
        <span>
          {t('browser.count', { n: filtered.length })}{filtered.length > CAP ? t('browser.capped', { cap: CAP }) : ''}
        </span>
        {filtered.length > 0 && (
          <button className="btn secondary small" onClick={() => onSelectAll(filtered.map((c) => c.id))}>
            {t('browser.selectAll', { n: filtered.length })}
          </button>
        )}
      </div>
      <div className="grid">
        {shown.map((c) => {
          const qty = quantities[c.id] || 0;
          const max = maxCopies(c);
          const name = cardName(c, lang);
          return (
            <div key={c.id} className={`cardcell ${qty > 0 ? 'selected' : ''}`}>
              {/* Click image to select (qty 1) / deselect. Use −/+ for copies once selected.
                  Hover shows a full-size preview. */}
              <img
                src={cardThumbSrc(c, lang)}
                alt={name}
                loading="lazy"
                onClick={() => onToggle(c.id)}
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
              {qty > 0 && (
                <div className="qty-ctrl">
                  <button className="qty-btn" onClick={() => onChangeQty(c.id, +1)} disabled={qty >= max} aria-label={t('browser.addCopy')}>+</button>
                  <span className="qty-count">{qty}</span>
                  <button className="qty-btn" onClick={() => onChangeQty(c.id, -1)} aria-label={t('browser.removeCopy')}>−</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Shared hover preview (hidden until a card is hovered). */}
      <CardPreview previewRef={previewRef} previewImgRef={previewImgRef} />
    </div>
  );
}
