import React, { useState } from 'react';

// Tab bar for the deck panel: one tab per zone (deckbuilding: Play deck / Pool /
// Sideboard / SB vs FW / Location / Notes; freeform: Cards / Notes — order
// fixed by spec).
// Each tab is itself a drop target: zones live in separate tabs so source and
// destination can never both be visible, and this also works when the
// destination zone is empty (there is no drop area inside it to aim at).
//
// `optional` names the tabs that stand for a zone a deck may simply not use
// (1.6.1's Fallen-wizard sideboard). While such a zone is empty its tab reads
// as an INVITATION -- dashed, muted, prefixed with "+", and carrying no count,
// because "0 / 10" claims a budget the player never opted into. It becomes an
// ordinary tab, count and all, the moment it holds a card.
//
// `dragOver` exists because a tab that does not react to a card held over it
// does not read as a target at all. It is the tab's own state rather than the
// panel's: nothing outside this bar needs to know, and a drop or a leave
// always clears it, so it cannot get stuck lit.
export default function ZoneTabs({ tabs, active, onSelect, onDrop, labels, counts, caps, optional, titles }) {
  const [dragOver, setDragOver] = useState(null);
  return (
    <div className="ztabs">
      {tabs.map((id) => {
        const cap = caps[id];
        const count = counts[id];
        const over = cap != null && count != null && count > cap;
        const inviting = optional && optional.has(id) && !count;
        return (
          <button
            key={id}
            type="button"
            className={[
              'ztab',
              active === id ? 'on' : '',
              over ? 'over' : '',
              inviting ? 'optional' : '',
              dragOver === id ? 'drop-over' : '',
            ].filter(Boolean).join(' ')}
            // Undefined for every tab whose label is already its full name,
            // which renders no attribute at all rather than an empty tooltip.
            title={titles && titles[id]}
            // WCAG 2.5.3 -- the accessible name must CONTAIN the visible label,
            // or voice control stops matching what the user can actually read on
            // the pill. So the long name is appended to the short one rather
            // than replacing it. Undefined when there is no long name, which
            // leaves the button's own text as its accessible name.
            aria-label={titles && titles[id] ? `${labels[id]} — ${titles[id]}` : undefined}
            onClick={() => onSelect(id)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragOver(id)}
            onDragLeave={() => setDragOver((cur) => (cur === id ? null : cur))}
            onDrop={(e) => { setDragOver(null); onDrop(e, id); }}
          >
            {inviting ? `+ ${labels[id]}` : labels[id]}
            {!inviting && count != null && (
              <span className="cnt">{cap != null ? `${count} / ${cap}` : count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
