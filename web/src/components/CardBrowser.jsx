import React, { useMemo } from 'react';
import { filterCards } from '../lib/filter.js';

const CAP = 600; // safety cap on rendered cells

export default function CardBrowser({ cards, filters, selectedIds, onToggle }) {
  const filtered = useMemo(() => filterCards(cards, filters), [cards, filters]);
  const shown = filtered.slice(0, CAP);

  return (
    <div className="browser">
      <div className="browser-meta">
        {filtered.length} carte(s){filtered.length > CAP ? ` — affichage des ${CAP} premières, affinez les filtres` : ''}
      </div>
      <div className="grid">
        {shown.map((c) => {
          const selected = selectedIds.has(c.id);
          const name = c.name?.fr || c.name?.en || c.id;
          return (
            <div
              key={c.id}
              className={`cardcell ${selected ? 'selected' : ''}`}
              onClick={() => onToggle(c.id)}
              title={name}
            >
              <img src={`/images/${c.relativePath}`} alt={name} loading="lazy" />
              <div className="cap">{name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
