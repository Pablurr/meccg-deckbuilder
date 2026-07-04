import React, { useMemo } from 'react';
import { filterCards } from '../lib/filter.js';
import { maxCopies } from '../lib/deck.js';

const CAP = 600; // safety cap on rendered cells

export default function CardBrowser({ cards, filters, quantities, onChangeQty, onToggle }) {
  const filtered = useMemo(() => filterCards(cards, filters), [cards, filters]);
  const shown = filtered.slice(0, CAP);

  return (
    <div className="browser">
      <div className="browser-meta">
        {filtered.length} carte(s){filtered.length > CAP ? ` — affichage des ${CAP} premières, affinez les filtres` : ''}
      </div>
      <div className="grid">
        {shown.map((c) => {
          const qty = quantities[c.id] || 0;
          const max = maxCopies(c);
          const name = c.name?.fr || c.name?.en || c.id;
          return (
            <div
              key={c.id}
              className={`cardcell ${qty > 0 ? 'selected' : ''}`}
              title={name}
            >
              {/* First click selects (qty 1), second click deselects. Use −/+ for copies. */}
              <img
                src={`/images/${c.relativePath}`}
                alt={name}
                loading="lazy"
                onClick={() => onToggle(c.id)}
              />
              {qty > 0 && <div className="qty-badge">{qty}{max === 1 ? '' : `/${max}`}</div>}
              <div className="cap">{name}</div>
              <div className="qty-bar">
                <button
                  className="qty-btn"
                  onClick={() => onChangeQty(c.id, -1)}
                  disabled={qty === 0}
                  aria-label="Retirer une copie"
                >−</button>
                <span className="qty-count">{qty}</span>
                <button
                  className="qty-btn"
                  onClick={() => onChangeQty(c.id, +1)}
                  disabled={qty >= max}
                  aria-label="Ajouter une copie"
                >+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
