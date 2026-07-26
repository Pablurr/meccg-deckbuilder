import React from 'react';

// Tab bar for the deck panel: one tab per zone (deckbuilding: Play deck / Pool /
// Sideboard / Location / Notes; freeform: Cards / Notes — order fixed by spec).
// Each tab is itself a drop target: zones live in separate tabs so source and
// destination can never both be visible, and this also works when the
// destination zone is empty (there is no drop area inside it to aim at).
export default function ZoneTabs({ tabs, active, onSelect, onDrop, labels, counts, caps }) {
  return (
    <div className="ztabs">
      {tabs.map((id) => {
        const cap = caps[id];
        const count = counts[id];
        const over = cap != null && count != null && count > cap;
        return (
          <button
            key={id}
            type="button"
            className={`ztab ${active === id ? 'on' : ''} ${over ? 'over' : ''}`}
            onClick={() => onSelect(id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, id)}
          >
            {labels[id]}
            {count != null && (
              <span className="cnt">{cap != null ? `${count} / ${cap}` : count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
