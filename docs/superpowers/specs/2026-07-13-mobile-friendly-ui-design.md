# Mobile-friendly UI — Design

Date: 2026-07-13
Status: Approved

## Goal

Make the MECCG deck-builder web UI usable on phones. The app currently has a
desktop-only layout (top filter bar, scrolling card grid, a fixed 360px
resizable deck sidebar on the right, a bottom action drawer, and modal dialogs)
with **zero `@media` queries**, and it relies on mouse **hover** for the
full-size card preview — which touch devices don't have.

The mobile version must **detect automatically when to display** (no manual
toggle) and keep **full feature parity** with desktop (browse, filter, build,
save/load, import, export).

## Non-goals (YAGNI)

- No PWA / offline / service worker.
- No separate mobile route or separate mobile component tree.
- No gesture/drag library, no touch drag-reorder.
- No landscape-specific layouts.
- No changes to backend, export formats, or card data.

## Detection

A single breakpoint is the source of truth, defined once and used by both CSS
and JS so they never disagree:

- **Breakpoint:** `max-width: 768px`.
- **CSS media queries** handle all pure *layout* reflow (grid columns, filter
  bar stacking, drawer, hiding the desktop sidebar). Live on resize, no JS.
- **`useIsMobile()` hook** (new, `web/src/lib/useIsMobile.js`) returns a boolean
  from `window.matchMedia`, subscribing to changes (resize/orientation). Used
  only where *behavior* — not just layout — must differ.
- The media query is `(max-width: 768px), (pointer: coarse)`: width is the
  primary trigger, but a genuine touch device gets touch behavior even in a wide
  window. Both the CSS and the hook use this same condition.

The hook and CSS both derive from a shared constant/string so the breakpoint
lives in one place.

## Component changes

### 1. Card grid — `CardBrowser.jsx`
- **CSS only:** on mobile shrink grid cells (roughly 3 columns; e.g.
  `grid-template-columns: repeat(auto-fill, minmax(90px, 1fr))`), reduce padding.
- **Behavior (via `isMobile`):** on mobile, tapping a card image no longer
  toggles it into the deck. It opens the full-screen **CardPreviewModal** (see
  #2). On desktop, unchanged (tap = toggle, hover = preview).
- Existing hover handlers (`onMouseEnter/Move/Leave`) stay; they're inert on
  touch. The desktop hover `CardPreview` element still renders on desktop only.

### 2. New `CardPreviewModal.jsx`
- Full-screen overlay (reuses `.modal-backdrop` z-layer conventions).
- Shows the **full-resolution** card image plus a control bar with
  **＋ / count / −** quantity controls, and a close (✕) / "Done" affordance.
- **Sizing (hard requirement):** the card image must display **entirely within
  the viewport** — never larger than the screen, never requiring scroll. The
  image is constrained by `max-width: 100vw` (minus a small margin) and
  `max-height` = viewport height minus the control bar height, with
  `object-fit: contain`, preserving aspect ratio. Verified at 375×812 and other
  sizes.
- Reuses the existing localized-image source + fallback chain (localized →
  English → full-res) already used in `CardBrowser`/`CardPreview`.
- Tapping the backdrop or ✕ closes it; quantity edits update the deck live.

### 3. Deck panel — `DeckPanel.jsx` → bottom sheet on mobile
- On mobile the right sidebar is **not rendered inline** in `.main-row`; the
  grid uses full width.
- Instead the panel renders as a **full-screen bottom sheet** overlay, toggled
  by `deckSheetOpen` state, containing the same grouped mini-cards, zoom slider,
  and warnings, plus a close button. It slides up from the bottom.
- Desktop-only affordances are hidden on mobile: mouse **drag-resize**
  (`.deckpanel-resizer`), maximize button, and the collapse chevron. The **zoom
  slider stays** (still useful on mobile).
- Mini-card behavior on mobile: tapping the image opens the same
  **CardPreviewModal**; the existing remove-confirm overlay and ＋/− controls
  remain. (On desktop, mini-card image tap still shows the hover preview.)
- Implementation: `DeckPanel` gains an `asSheet` (mobile) prop that switches
  its root class/positioning and hides desktop affordances; contents are shared.

### 4. Filter bar — `FilterBar.jsx`
- The two search inputs stack **full-width** and stay always visible.
- The 8 facet dropdowns + unique/reset are too tall on a phone, so on mobile
  they collapse behind a **"Filters ▾"** toggle (local `useState`, mobile-only);
  expanded, they wrap as today. Desktop layout unchanged.
- Facet dropdown menus (`.facet-menu`) get `max-width`/position guards so an
  open menu never overflows the screen edge on mobile.

### 5. Bottom drawer — `DeckDrawer.jsx` + modals
- On mobile the drawer shows a **deck-count pill** and a **"View deck ▲"**
  button that sets `deckSheetOpen = true`. Action buttons (New / Import / My
  decks / Export) wrap as today; touch targets bumped to ≥40px tall.
- Modals (`DeckManager`, `ImportDialog`, `ExportDialog`) already use
  `width: min(560px, 92vw)` and `max-height: 86vh`, so they mostly work.
  Tweaks: buttons ≥40px tall, import textarea / selects full-width, ensure no
  horizontal overflow.

## State added to `App.jsx`

- `isMobile` — from `useIsMobile()`.
- `deckSheetOpen` — boolean, whether the mobile deck sheet is open.
- `previewCard` — the card currently shown in `CardPreviewModal`, or `null`.

These are small and localized. On desktop, `isMobile` is false and all existing
code paths run exactly as before (sidebar inline, hover preview, tap = toggle).

## Data flow

- `App` owns `previewCard` and `deckSheetOpen`. It passes an `onPreview(card)`
  callback down to `CardBrowser` and (sheet) `DeckPanel`, and renders
  `CardPreviewModal` when `previewCard` is set, wiring its ＋/− to the existing
  `changeQty` and its remove to `toggleCard`.
- On mobile, `App` renders `DeckPanel` as an overlay (`asSheet`) gated on
  `deckSheetOpen` instead of inline in `.main-row`.
- The `DeckDrawer` receives `onViewDeck` (mobile) alongside its existing
  actions.

## Error handling / edge cases

- Rotating the device (portrait↔landscape) updates `isMobile` via matchMedia;
  if a user crosses the breakpoint with the deck sheet open, closing/reflow is
  handled (sheet only renders when both `isMobile` and `deckSheetOpen`).
- Image load failures in the preview modal fall back through the same chain as
  the grid (localized → English → full-res).
- The 600-cell render cap and all filtering logic are unchanged.

## Testing / verification

- **Unit:** `useIsMobile` (mock `matchMedia`, assert boolean + subscription
  cleanup); `CardPreviewModal` add/remove wiring (clamps to `maxCopies`).
- **Live (browser preview):** verify at **375×812 (mobile)** and a desktop
  width:
  - grid reflows to ~3 columns; filter row collapses behind "Filters".
  - tapping a card opens the preview modal with the **whole card visible, no
    scroll**; ＋/− adjusts quantity.
  - "View deck" opens the bottom sheet with grouped cards + zoom; close works.
  - desktop width still shows the inline sidebar, hover preview, tap-to-toggle.
  - screenshots of grid, preview modal, and deck sheet as proof.

## Acceptance criteria

1. On a ≤768px viewport (or coarse pointer), the UI reflows to a phone layout
   automatically, with no manual toggle.
2. The full-res card preview opened on tap shows the **entire card within the
   screen** — no part clipped, no scrolling required — at any phone size.
3. All desktop features remain reachable on mobile: browse, filter, build,
   save/load, import, export.
4. Desktop behavior and layout are unchanged.
