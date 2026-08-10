# Mobile Swipe Navigation in Card Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a mobile user swipe left/right inside `CardPreviewModal` to move to the
next/previous card, in the context it was opened from (filtered selector list, or
active deck zone/tab).

**Architecture:** Two new pure functions in `web/src/lib/cardNav.js`
(`navigateList`, `swipeDirection`) carry all the logic that can be unit-tested without
a DOM. `App.jsx` gains a `previewList` state alongside the existing `previewCard`,
populated by the caller (`CardBrowser` or `DeckPanel`) at the moment the modal opens.
`CardPreviewModal` gets touch handlers on the image area that call an `onNav(delta)`
prop; App resolves `delta` against `previewList` via `navigateList` and updates
`previewCard`.

**Tech Stack:** React 18 (JSX, no TypeScript), Vitest. No new dependency — native
`onTouchStart`/`onTouchEnd` events.

## Global Constraints

- No new runtime dependency (repo only allows `jszip` and `pdf-lib`) — implement swipe
  detection with native touch events, not a gesture library.
- This repo has **no jsdom** and never mounts a component in tests; every existing
  component test (`test/cardPreviewModal.test.js`, `test/zoneTabs.test.js`) covers a
  pure function extracted from the component, not the component itself. New logic
  must follow the same idiom.
- At the ends of a navigation list, swiping past the first/last card is a no-op (no
  wrap-around).
- In the deck panel, group titles (by card type) are transparent to navigation — the
  swipe walks the flattened, displayed order across all groups in the active zone/tab.
- Code identifiers and comments in English; user-facing strings unaffected (no new
  copy is introduced by this feature).
- `docs/ARCHITECTURE.md` must be updated in the same commit as the code that needs it
  (see Task 5).

---

### Task 1: `cardNav.js` — pure navigation and swipe-detection helpers

**Files:**
- Create: `web/src/lib/cardNav.js`
- Test: `test/cardNav.test.js`

**Interfaces:**
- Produces:
  - `navigateList(list, currentCard, delta)` → returns the card object at
    `indexOf(currentCard) + delta` in `list`, or `null` if `currentCard` isn't found
    in `list` or the target index is out of bounds. Cards are matched by `.id`.
  - `swipeDirection(dx, dy)` → returns `1` (swipe left → next), `-1` (swipe right →
    previous), or `0` (not a horizontal swipe: either too short or too vertical).
    Thresholds: `SWIPE_THRESHOLD_PX = 50` (minimum horizontal distance),
    `SWIPE_VERTICAL_TOLERANCE_PX = 30` (maximum vertical drift allowed).

- [ ] **Step 1: Write the failing tests**

```javascript
// test/cardNav.test.js
import { describe, it, expect } from 'vitest';
import { navigateList, swipeDirection } from '../web/src/lib/cardNav.js';

describe('navigateList', () => {
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

  it('moves forward within the list', () => {
    expect(navigateList(list, { id: 'a' }, 1)).toEqual({ id: 'b' });
  });

  it('moves backward within the list', () => {
    expect(navigateList(list, { id: 'c' }, -1)).toEqual({ id: 'b' });
  });

  it('returns null past the last card (no wrap-around)', () => {
    expect(navigateList(list, { id: 'c' }, 1)).toBeNull();
  });

  it('returns null before the first card (no wrap-around)', () => {
    expect(navigateList(list, { id: 'a' }, -1)).toBeNull();
  });

  it('returns null when the current card is not in the list', () => {
    expect(navigateList(list, { id: 'z' }, 1)).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(navigateList([], { id: 'a' }, 1)).toBeNull();
  });
});

describe('swipeDirection', () => {
  it('detects a left swipe as next (1)', () => {
    expect(swipeDirection(-80, 0)).toBe(1);
  });

  it('detects a right swipe as previous (-1)', () => {
    expect(swipeDirection(80, 0)).toBe(-1);
  });

  it('ignores a swipe shorter than the threshold', () => {
    expect(swipeDirection(20, 0)).toBe(0);
    expect(swipeDirection(-20, 0)).toBe(0);
  });

  it('ignores a mostly-vertical drag even if horizontal distance is large', () => {
    expect(swipeDirection(80, 60)).toBe(0);
    expect(swipeDirection(-80, -60)).toBe(0);
  });

  it('accepts a horizontal swipe with a little vertical drift', () => {
    expect(swipeDirection(-80, 15)).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- cardNav`
Expected: FAIL — `Cannot find module '../web/src/lib/cardNav.js'`

- [ ] **Step 3: Write the implementation**

```javascript
// web/src/lib/cardNav.js

// Minimum horizontal travel (px) before a touch drag counts as a swipe, and
// the maximum vertical drift still tolerated as "horizontal" -- a diagonal
// drag or a vertical scroll gesture must not be mistaken for page navigation.
export const SWIPE_THRESHOLD_PX = 50;
export const SWIPE_VERTICAL_TOLERANCE_PX = 30;

// `list` is whatever ordered set of cards the modal was opened from (the
// filtered selector grid, or the active deck zone's flattened groups) --
// callers capture it once, at open time; this function never re-derives it.
// No wrap-around: past either end it returns null, so the caller is a no-op.
export function navigateList(list, currentCard, delta) {
  if (!currentCard) return null;
  const idx = list.findIndex((c) => c.id === currentCard.id);
  if (idx === -1) return null;
  const next = list[idx + delta];
  return next || null;
}

export function swipeDirection(dx, dy) {
  if (Math.abs(dy) > SWIPE_VERTICAL_TOLERANCE_PX) return 0;
  if (dx <= -SWIPE_THRESHOLD_PX) return 1;
  if (dx >= SWIPE_THRESHOLD_PX) return -1;
  return 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- cardNav`
Expected: PASS, all 12 tests green.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/cardNav.js test/cardNav.test.js
git commit -m "feat: add pure navigateList/swipeDirection helpers for card modal swipe"
```

---

### Task 2: Wire touch swipe into `CardPreviewModal`

**Files:**
- Modify: `web/src/components/CardPreviewModal.jsx`

**Interfaces:**
- Consumes: `navigateList`/`swipeDirection` are not called directly here (App resolves
  navigation) — this task only consumes `swipeDirection` from Task 1 to decide
  *whether* a gesture counts as a swipe, and calls the new `onNav(delta)` prop.
- Produces: `CardPreviewModal` now accepts an optional `onNav(delta: 1 | -1) => void`
  prop. When absent (not passed), swiping is silently a no-op — this keeps the
  component usable without navigation context if a future caller doesn't have one.

- [ ] **Step 1: Edit `CardPreviewModal.jsx`**

Add the import and a touch-tracking ref, and wire `onTouchStart`/`onTouchEnd` on the
image wrapper (not the backdrop, not the control bar — a tap on the backdrop must keep
closing the modal, and the bar must keep swallowing clicks for its own buttons):

```javascript
import React, { useRef } from 'react';
import { cardName, cardImageSrc, cardImageEn } from '../lib/lang.js';
import ProxyStamp from './ProxyStamp.jsx';
import { useT } from '../i18n.jsx';
import { capTitle } from '../lib/rules/docText.js';
import { ZONE_LABEL_KEY } from '../lib/rules/zones.js';
import { swipeDirection } from '../lib/cardNav.js';
```

Change the component signature and body:

```javascript
export default function CardPreviewModal({ card, lang, rows = [], onChangeZoneQty, onClose, onNav, proxyMode, setNames }) {
  const t = useT();
  const touchStart = useRef(null);
  if (!card) return null;
  const name = cardName(card, lang);

  function handleTouchStart(e) {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  // Reads the recorded start point rather than accumulating deltas across
  // touchmove: a single start/end comparison is enough for a swipe gesture
  // and skips a stream of intermediate state updates on every frame.
  function handleTouchEnd(e) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !onNav) return;
    const touch = e.changedTouches[0];
    const dir = swipeDirection(touch.clientX - start.x, touch.clientY - start.y);
    if (dir) onNav(dir);
  }

  return (
    <div className="card-modal-backdrop" onClick={onClose}>
      <div className="card-modal">
        <div
          className="card-modal-imgwrap"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
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
            <ProxyStamp card={card} lang={lang} on={proxyMode} setNames={setNames} />
          </div>
        </div>
```

(The rest of the file — the control bar, `capNotices` usage, closing tags — is
unchanged.)

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS — `test/cardPreviewModal.test.js` only exercises `capNotices`, which
this task doesn't touch, so it must still be green. No new test is added in this task
(the touch handlers are exercised via App-level wiring and manual verification in
Task 4).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/CardPreviewModal.jsx
git commit -m "feat: add touch swipe detection to CardPreviewModal"
```

---

### Task 3: Capture and pass the navigation list from `CardBrowser` and `DeckPanel`

**Files:**
- Modify: `web/src/components/CardBrowser.jsx:200`
- Modify: `web/src/components/DeckPanel.jsx` (around the `MiniCard` render at line
  ~561-584)

**Interfaces:**
- Consumes: none new (uses existing `onPreview` prop, `shown` in `CardBrowser`,
  `groups` in `DeckPanel`).
- Produces: both callers now invoke `onPreview(card, list)` — a two-argument call —
  instead of `onPreview(card)`. Task 4 makes `App.jsx`'s `onPreview` handler accept
  this second argument; until Task 4 lands, the extra argument is harmlessly ignored
  by the current single-argument handler.

- [ ] **Step 1: Edit `CardBrowser.jsx`**

At line 200, change the click handler to pass the currently displayed, capped list —
the same `shown` array already used to render the grid, so swipe order always matches
what's on screen:

```javascript
                onClick={() => (isMobile ? onPreview(c, shown) : onToggle(c.id))}
```

- [ ] **Step 2: Edit `DeckPanel.jsx`**

Build the flattened navigation list once per render, right after `groups` is computed
(near line 377, `const groups = tab === 'notes' ? [] : buildGroups(activeEntries, lang, sideId);`):

```javascript
  const groups = tab === 'notes' ? [] : buildGroups(activeEntries, lang, sideId);
  // Flattened in display order (group by group, card by card within each) so
  // swipe in the mobile preview walks the same sequence the grid shows --
  // group headings are not list entries, so they're transparently skipped.
  const navList = groups.flatMap((g) => g.items.map((it) => it.card));
```

Then, at the `MiniCard` render site (around line 573), wrap `onPreview` so it carries
`navList` without changing `MiniCard`'s own API:

```javascript
                      onPreview={(c) => onPreview(c, navList)}
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: PASS — no test currently asserts on `onPreview`'s arity, and `buildGroups`
is already covered by `test/deckList.test.js`. This task doesn't add new pure logic
(the flatMap is a one-liner over already-tested data), so no new test file is needed.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/CardBrowser.jsx web/src/components/DeckPanel.jsx
git commit -m "feat: pass the navigation list to onPreview from browser and deck panel"
```

---

### Task 4: Resolve navigation in `App.jsx`

**Files:**
- Modify: `web/src/App.jsx`

**Interfaces:**
- Consumes: `navigateList` from `web/src/lib/cardNav.js` (Task 1); `onPreview(card,
  list)` two-argument call shape from `CardBrowser`/`DeckPanel` (Task 3); `onNav`
  prop accepted by `CardPreviewModal` (Task 2).
- Produces: nothing further downstream — this is the top of the wiring.

- [ ] **Step 1: Add the import and the `previewList` state**

At the top of `App.jsx`, add the import next to the other `lib/rules` imports:

```javascript
import { navigateList } from './lib/cardNav.js';
```

Near `const [previewCard, setPreviewCard] = useState(null);` (line 54), add:

```javascript
  const [previewCard, setPreviewCard] = useState(null);
  // Captured once, when the modal opens, from whichever list it was opened
  // from (the filtered selector grid, or the active deck zone) -- swipe
  // navigates this frozen snapshot, so it does not need to react to filter
  // or deck changes made while the modal is open (see design spec).
  const [previewList, setPreviewList] = useState([]);
```

- [ ] **Step 2: Add an `openPreview` handler and use it everywhere `setPreviewCard`
      was passed as `onPreview`**

Add the handler near the other handler functions (e.g. next to `changeNote`, around
line 262):

```javascript
  function openPreview(card, list) {
    setPreviewCard(card);
    setPreviewList(list);
  }
```

Replace the two `onPreview={setPreviewCard}` props (one on `CardBrowser` at line 280,
one on the mobile `DeckPanel` sheet at line 329) with:

```javascript
onPreview={openPreview}
```

- [ ] **Step 3: Pass `onNav` and clear `previewList` on close**

In the `CardPreviewModal` render block (starting at line 418), add an `onNav` prop and
update `onClose` to also reset `previewList`:

```javascript
      {previewCard && (
        <CardPreviewModal
          card={previewCard}
          lang={uiLang}
          rows={(deck.mode === 'deckbuilding' ? zoneTargets(previewCard, deck.ruleset.side) : ['deck']).map((zone) => ({
            zone,
            qty: (zone === 'deck' ? quantities : zones[zone] || {})[previewCard.id] || 0,
            room: capCtx
              ? remainingCopies(previewCard, zone, { quantities, zones }, capCtx)
              : { remaining: Infinity, ruleId: null },
          }))}
          onChangeZoneQty={changeZoneQty}
          onNav={(delta) => {
            const next = navigateList(previewList, previewCard, delta);
            if (next) setPreviewCard(next);
          }}
          onClose={() => { setPreviewCard(null); setPreviewList([]); }}
```

(Leave the remaining props — `proxyMode`, `setNames`, whatever follows — untouched.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS, 0 failures, all files compile (per the project's own completion
checklist — read the *file* count, not just the assertion count).

- [ ] **Step 5: Commit**

```bash
git add web/src/App.jsx
git commit -m "feat: resolve swipe navigation against the captured preview list in App"
```

---

### Task 5: Manual verification and `docs/ARCHITECTURE.md` update

**Files:**
- Modify: `docs/ARCHITECTURE.md` (§10 — components, CSS, mobile, a11y; and §15 — dated
  changelog)

**Interfaces:** none (documentation + manual QA only).

- [ ] **Step 1: Manually verify in the dev server**

Start the dev server preview (`npm run dev`, or the project's `run` skill), resize the
browser pane to the `mobile` preset, and check:
1. Open the card selector, tap a card tile to open the modal, swipe left → the next
   card in the visible grid appears; swipe right → the previous one. At the first/last
   card of the grid, swiping past the edge does nothing (modal stays on the same
   card).
2. Open a deck with cards in at least two type groups (e.g. Character and Item), open
   the mobile deck sheet, tap a card to open the modal, and swipe across a group
   boundary — the swipe must continue smoothly into the next group's first card, with
   no group heading interrupting the sequence.
3. Confirm the control bar's +/- buttons still work without triggering navigation
   (they live outside `.card-modal-imgwrap`, so a tap on them never reaches the touch
   handlers), and that tapping the backdrop still closes the modal.

Since this environment's browser automation drives mouse/keyboard, not real touch
events, this verification pass is done by the user on an actual mobile device or the
browser's device-emulation touch simulation; note in the final summary that automated
verification was limited to the unit tests in Tasks 1–4.

- [ ] **Step 2: Update `docs/ARCHITECTURE.md`**

In §10 (components, CSS, mobile, a11y), add a short paragraph documenting:
- `CardPreviewModal` now supports touch swipe (left/right) to navigate to the
  next/previous card, via `onNav(delta)` and the pure helpers in
  `web/src/lib/cardNav.js` (`navigateList`, `swipeDirection`).
- The navigation list is captured once at open time by the caller (`CardBrowser`'s
  `shown`, or `DeckPanel`'s flattened `groups` for the active zone) and does not react
  to later filter/deck changes while the modal stays open.
- No wrap-around at list boundaries.

In §15 (dated journal), add an entry for today's date summarizing the feature and
linking the design spec:
`docs/superpowers/specs/2026-08-09-mobile-swipe-navigation-design.md`.

Update the date at the top of `docs/ARCHITECTURE.md` to today's date.

- [ ] **Step 3: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs: record mobile swipe navigation in card modal"
```
