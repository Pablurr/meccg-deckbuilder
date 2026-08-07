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

// How one pill reads, from its numbers alone. Pulled out of the render because
// it is the only behaviour in this file worth pinning, and the project has no
// DOM test environment: a component is covered by testing the pure function it
// renders from.
//
// `count === null` means "this tab carries no count" (Notes) and must not be
// read as an empty zone -- an empty optional zone shows the invitation, a
// countless one shows nothing at all.
export function tabPresentation({ count, cap, optional }) {
  const inviting = !!optional && count === 0;
  return {
    inviting,
    over: cap != null && count != null && count > cap,
    showCount: !inviting && count != null,
  };
}

export default function ZoneTabs({ tabs, active, onSelect, onDrop, labels, counts, caps, extras, optional, titles }) {
  const [dragOver, setDragOver] = useState(null);
  return (
    <div className="ztabs">
      {tabs.map((id) => {
        const cap = caps[id];
        const count = counts[id];
        const extra = extras && extras[id];
        const { inviting, over, showCount } = tabPresentation({ count, cap, optional: optional && optional.has(id) });
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
            // leaves the button's own text (label + count) as its accessible
            // name -- which is also why the count has to be re-appended here:
            // an aria-label REPLACES the whole accessible name, content and
            // all, so without this a sighted user sees "Talon vs SD  4 / 10"
            // while a screen reader hears the name and the long description
            // but no count -- the one tab this attribute touches is the one
            // tab that lost its count. Omitted while `inviting`, matching the
            // visible pill, which shows no count either while the zone is
            // still just an invitation.
            aria-label={titles && titles[id]
              ? `${labels[id]}${showCount ? ` ${cap != null ? `${count} / ${cap}` : count}${extra ? ` (+${extra})` : ''}` : ''} — ${titles[id]}`
              : undefined}
            onClick={() => onSelect(id)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => setDragOver(id)}
            onDragLeave={() => setDragOver((cur) => (cur === id ? null : cur))}
            onDrop={(e) => { setDragOver(null); onDrop(e, id); }}
          >
            {inviting ? `+ ${labels[id]}` : labels[id]}
            {showCount && (
              <span className="cnt">
                {cap != null ? `${count} / ${cap}` : count}
                {extra ? ` (+${extra})` : ''}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
