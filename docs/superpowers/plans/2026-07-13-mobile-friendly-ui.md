# Mobile-friendly UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the MECCG deck-builder web UI reflow to a touch-friendly phone layout automatically (viewport ≤768px or coarse pointer), with full feature parity and desktop behavior unchanged.

**Architecture:** One responsive component tree. A shared breakpoint drives both CSS media queries (pure layout reflow) and a `useIsMobile()` React hook (the few behavioral forks: tap-to-preview instead of tap-to-add, deck panel rendered as a full-screen bottom sheet instead of an inline sidebar). A new `CardPreviewModal` gives touch users the full-size card view that desktop gets on hover, sized to fit entirely on screen.

**Tech Stack:** React 18, Vite 5 (root `web/`, dev on :5173), Vitest 2 (pure-Node tests in `test/*.test.js`, no jsdom — DOM/React behavior is verified live in the browser preview).

---

## File Structure

**Created:**
- `web/src/lib/mobile.js` — pure, testable detection primitives: the `MOBILE_QUERY` media-query string and `isMobileWidth(width, coarse)` predicate.
- `web/src/lib/useIsMobile.js` — thin React hook wrapping `window.matchMedia(MOBILE_QUERY)`.
- `web/src/components/CardPreviewModal.jsx` — full-screen tap preview with ＋/count/− and close; card always fully visible.
- `test/mobile.test.js` — unit tests for `mobile.js`.

**Modified:**
- `web/src/App.jsx` — new state (`isMobile`, `deckSheetOpen`, `previewCard`), wire modal + mobile sheet.
- `web/src/components/CardBrowser.jsx` — mobile tap opens preview instead of toggling.
- `web/src/components/DeckPanel.jsx` — `asSheet` mode (bottom sheet), mobile mini-card tap opens preview.
- `web/src/components/DeckDrawer.jsx` — mobile deck-count pill + "View deck" button.
- `web/src/components/FilterBar.jsx` — mobile "Filters ▾" collapse of the facet row.
- `web/src/styles.css` — modal/sheet styles + one `@media` block for all layout reflow.

**Breakpoint single-source note:** the query string lives in `web/src/lib/mobile.js` as `MOBILE_QUERY`. The CSS `@media` block in `styles.css` must use the identical condition. A comment in each file points at the other.

---

## Task 1: Mobile detection primitives

**Files:**
- Create: `web/src/lib/mobile.js`
- Create: `web/src/lib/useIsMobile.js`
- Test: `test/mobile.test.js`

- [ ] **Step 1: Write the failing test**

Create `test/mobile.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { MOBILE_QUERY, isMobileWidth } from '../web/src/lib/mobile.js';

describe('MOBILE_QUERY', () => {
  it('matches the CSS breakpoint: 768px max-width or coarse pointer', () => {
    expect(MOBILE_QUERY).toBe('(max-width: 768px), (pointer: coarse)');
  });
});

describe('isMobileWidth', () => {
  it('is true at or below 768px', () => {
    expect(isMobileWidth(768, false)).toBe(true);
    expect(isMobileWidth(375, false)).toBe(true);
  });
  it('is false above 768px with a fine pointer', () => {
    expect(isMobileWidth(1024, false)).toBe(false);
    expect(isMobileWidth(769, false)).toBe(false);
  });
  it('is true for a coarse pointer regardless of width', () => {
    expect(isMobileWidth(1400, true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- mobile`
Expected: FAIL — cannot resolve `../web/src/lib/mobile.js`.

- [ ] **Step 3: Write the pure module**

Create `web/src/lib/mobile.js`:

```javascript
// Single source of truth for the mobile breakpoint. The CSS @media block in
// web/src/styles.css MUST use this exact same condition — keep them in sync.
export const MOBILE_QUERY = '(max-width: 768px), (pointer: coarse)';

// Pure predicate mirroring MOBILE_QUERY, used in tests and as a fallback.
export function isMobileWidth(width, coarsePointer) {
  return width <= 768 || coarsePointer === true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- mobile`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the React hook (verified live, not unit-tested)**

Create `web/src/lib/useIsMobile.js`:

```javascript
import { useEffect, useState } from 'react';
import { MOBILE_QUERY } from './mobile.js';

// Boolean that tracks whether the mobile layout is active, driven by the same
// media query the CSS uses. Updates on resize/orientation change.
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(MOBILE_QUERY).matches
      : false
  );

  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/mobile.js web/src/lib/useIsMobile.js test/mobile.test.js
git commit -m "feat: mobile breakpoint detection (pure logic + useIsMobile hook)"
```

---

## Task 2: CardPreviewModal component + styles

**Files:**
- Create: `web/src/components/CardPreviewModal.jsx`
- Modify: `web/src/styles.css` (append modal styles)

This component is presentational; it is verified live in Task 7 (no jsdom in this repo). Its quantity clamping reuses the already-tested `maxCopies` from `web/src/lib/deck.js`.

- [ ] **Step 1: Create the component**

Create `web/src/components/CardPreviewModal.jsx`:

```javascript
import React from 'react';
import { cardName, cardImageSrc, cardImageEn } from '../lib/lang.js';
import { maxCopies } from '../lib/deck.js';
import { useT } from '../i18n.jsx';

// Full-screen card preview for touch (desktop uses the hover CardPreview).
// The image is constrained to fit ENTIRELY within the viewport (see styles):
// the wrapper takes the space above the control bar and the img uses
// object-fit:contain, so the whole card is always visible without scrolling.
export default function CardPreviewModal({ card, qty, lang, onChangeQty, onClose }) {
  const t = useT();
  if (!card) return null;
  const max = maxCopies(card);
  const name = cardName(card, lang);
  return (
    <div className="card-modal-backdrop" onClick={onClose}>
      <div className="card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-modal-imgwrap">
          <img
            src={cardImageSrc(card, lang)}
            alt={name}
            onError={(e) => {
              const el = e.currentTarget;
              const en = cardImageEn(card);
              if (en && el.getAttribute('src') !== en) el.src = en;
            }}
          />
        </div>
        <div className="card-modal-bar">
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
```

- [ ] **Step 2: Verify the `common.done` i18n key exists (add if missing)**

Run: `grep -n "'common.done'\|\"common.done\"\|common\.done\|done:" web/src/lib/i18n.js`
Expected: a `done` entry under `common` for both `fr` and `en`. If absent, open `web/src/lib/i18n.js`, find the `common` group in each of the `fr` and `en` objects (it already has `cancel`), and add alongside it: `done: 'Terminé'` in `fr` and `done: 'Done'` in `en`. (The repo has a key-parity test in `test/i18n.test.js`, so both languages must get the key.)

- [ ] **Step 3: Append modal styles to `web/src/styles.css`**

Add at the end of the file:

```css
/* ---- Card preview modal (touch full-size preview) ---- */
.card-modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0, 0, 0, .85);
  z-index: 1100;
  display: flex;
}
.card-modal {
  margin: auto;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  max-width: 100vw;
  max-height: 100vh;
}
/* Takes all space above the bar; min-height:0 lets the img shrink to fit. */
.card-modal-imgwrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
}
/* Whole card always visible: never wider/taller than its box, keep aspect. */
.card-modal-imgwrap img {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
}
.card-modal-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  padding: 12px;
  background: var(--panel);
  border-top: 1px solid var(--line);
}
.qty-btn.big { width: 44px; height: 44px; font-size: 26px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel-2); }
.card-modal-count { font-weight: 700; font-size: 20px; color: var(--accent); min-width: 28px; text-align: center; }
```

- [ ] **Step 4: Run the test suite to confirm nothing broke (i18n parity)**

Run: `npm test`
Expected: PASS (existing suite + Task 1's `mobile` tests; `i18n` parity test still green).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/CardPreviewModal.jsx web/src/styles.css web/src/lib/i18n.js
git commit -m "feat: full-screen CardPreviewModal for touch (fits entirely on screen)"
```

---

## Task 3: Wire isMobile + preview modal into App and CardBrowser

**Files:**
- Modify: `web/src/App.jsx`
- Modify: `web/src/components/CardBrowser.jsx`

- [ ] **Step 1: Add imports and state to `App.jsx`**

At the top of `web/src/App.jsx`, add these imports after the existing component imports (after the `ImportDialog` import on line 13):

```javascript
import CardPreviewModal from './components/CardPreviewModal.jsx';
import { useIsMobile } from './lib/useIsMobile.js';
```

Inside `App()`, add these three lines just after the existing `const [error, setError] = useState(null);` line:

```javascript
  const isMobile = useIsMobile();
  const [deckSheetOpen, setDeckSheetOpen] = useState(false);
  const [previewCard, setPreviewCard] = useState(null);
```

- [ ] **Step 2: Pass mobile props to CardBrowser**

In `App.jsx`, replace the `<CardBrowser ... />` element (currently line 119) with:

```javascript
        <CardBrowser cards={cards} filters={filters} quantities={quantities} lang={uiLang} onChangeQty={changeQty} onToggle={toggleCard} onSelectAll={selectAll} isMobile={isMobile} onPreview={setPreviewCard} />
```

- [ ] **Step 3: Render the preview modal**

In `App.jsx`, add this just before the closing `</div>` of `<div className="app">` (i.e. immediately after the `showExport` block, before line 175's `</div>`):

```javascript
      {previewCard && (
        <CardPreviewModal
          card={previewCard}
          qty={quantities[previewCard.id] || 0}
          lang={uiLang}
          onChangeQty={changeQty}
          onClose={() => setPreviewCard(null)}
        />
      )}
```

- [ ] **Step 4: Make CardBrowser tap open the preview on mobile**

In `web/src/components/CardBrowser.jsx`, change the function signature (line 10) to accept the new props:

```javascript
export default function CardBrowser({ cards, filters, quantities, lang, onChangeQty, onToggle, onSelectAll, isMobile, onPreview }) {
```

Then replace the `onClick={() => onToggle(c.id)}` on the `<img>` (line 41) with:

```javascript
                onClick={() => (isMobile ? onPreview(c) : onToggle(c.id))}
```

- [ ] **Step 5: Manually sanity-check the build compiles**

Run: `npm run build`
Expected: builds successfully (no unresolved imports / syntax errors). Output ends with `✓ built in …`.

- [ ] **Step 6: Commit**

```bash
git add web/src/App.jsx web/src/components/CardBrowser.jsx
git commit -m "feat: mobile card tap opens full-screen preview modal"
```

---

## Task 4: Deck panel as a bottom sheet on mobile

**Files:**
- Modify: `web/src/App.jsx`
- Modify: `web/src/components/DeckPanel.jsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: Add `asSheet`, `onClose`, `isMobile`, `onPreview` to DeckPanel**

In `web/src/components/DeckPanel.jsx`, extend the `DeckPanel` props (the destructured object starting line 83) by adding these four keys (e.g. after `onToggle,`):

```javascript
  asSheet = false,
  onClose,
  isMobile = false,
  onPreview,
```

- [ ] **Step 2: Give MiniCard mobile behavior**

In `DeckPanel.jsx`, change the `MiniCard` signature (line 28) to add `isMobile` and `onPreview`:

```javascript
function MiniCard({ card, qty, lang, thumbW, onChangeQty, onToggle, trackPointer, hidePreview, isMobile, onPreview }) {
```

Replace the `<img>`'s `onClick={() => setConfirming(true)}` (line 39) with:

```javascript
        onClick={() => (isMobile ? onPreview(card) : setConfirming(true))}
```

And pass the two new props through where `MiniCard` is rendered (inside the `groups.map`, the `<MiniCard ... />` on lines 199-209) by adding:

```javascript
                    isMobile={isMobile}
                    onPreview={onPreview}
```

- [ ] **Step 3: Render as a sheet when `asSheet` is set**

In `DeckPanel.jsx`, the root returned element (line 153) is:

```javascript
    <div className="deckpanel" style={{ flexBasis: `${width}px`, width: `${width}px` }}>
```

Replace it with a version that switches to sheet mode. Change that opening tag to:

```javascript
    <div className={`deckpanel ${asSheet ? 'sheet' : ''}`} style={asSheet ? undefined : { flexBasis: `${width}px`, width: `${width}px` }}>
```

Then, immediately after that opening `<div>`, replace the existing resizer line (line 154):

```javascript
      <div className="deckpanel-resizer" onMouseDown={startResize} aria-hidden="true" />
```

with (resizer is desktop-only; sheet gets a close button instead):

```javascript
      {!asSheet && <div className="deckpanel-resizer" onMouseDown={startResize} aria-hidden="true" />}
      {asSheet && (
        <button className="deckpanel-sheet-close btn secondary" onClick={onClose} aria-label={t('common.close')}>✕</button>
      )}
```

In the `deckpanel-head` block, hide the desktop-only collapse chevron and maximize button when `asSheet`. Replace the collapse `<button className="deckpanel-toggle" ...>` (lines 156-158) and the maximize `<button className="deckpanel-max" ...>` (lines 160-165) each by wrapping them: prefix each with `{!asSheet && (` and close with `)}`. Concretely the two buttons become:

```javascript
        {!asSheet && (
          <button className="deckpanel-toggle" onClick={onToggleCollapsed} aria-label={t('panel.collapse')}>
            <span className="chevron">›</span>
          </button>
        )}
        <b>{t('panel.title')}</b>
        {!asSheet && (
          <button
            className="deckpanel-max"
            onClick={toggleMax}
            aria-label={isMaxed ? t('panel.restore') : t('panel.maximize')}
            title={isMaxed ? t('panel.restore') : t('panel.maximize')}
          >{isMaxed ? '⇥' : '⤢'}</button>
        )}
```

- [ ] **Step 4: Confirm the `common.close` i18n key exists (add if missing)**

Run: `grep -n "close:" web/src/lib/i18n.js`
Expected: a `close` entry under `common` in both `fr` and `en`. If absent, add `close: 'Fermer'` (fr) and `close: 'Close'` (en) alongside `cancel` in each language's `common` group.

- [ ] **Step 5: Render the sheet from App on mobile**

In `web/src/App.jsx`, the `DeckPanel` is currently rendered inline inside `.main-row` gated on `hasSelection` (lines 120-136). Change that gate so the inline sidebar only shows on desktop:

Replace `{hasSelection && (` (line 120) with:

```javascript
        {hasSelection && !isMobile && (
```

Then add the mobile sheet. Immediately after the closing `</div>` of `.main-row` (line 137) and before `<DeckDrawer ... />`, insert:

```javascript
      {isMobile && deckSheetOpen && hasSelection && (
        <DeckPanel
          asSheet
          isMobile
          cardsById={cardsById}
          quantities={quantities}
          lang={uiLang}
          counts={counts}
          warnings={warnings}
          collapsed={false}
          zoom={cardZoom}
          onZoom={setCardZoom}
          onChangeQty={changeQty}
          onToggle={toggleCard}
          onPreview={setPreviewCard}
          onClose={() => setDeckSheetOpen(false)}
        />
      )}
```

- [ ] **Step 6: Add sheet styles to `web/src/styles.css`**

Append:

```css
/* ---- Deck panel as full-screen bottom sheet (mobile) ---- */
.deckpanel.sheet {
  position: fixed;
  inset: 0;
  z-index: 1050;
  width: 100%;
  flex: none;
  border-left: none;
  animation: sheet-up .18s ease-out;
}
@keyframes sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
.deckpanel-sheet-close {
  position: absolute;
  top: 8px; right: 10px;
  z-index: 6;
  width: 40px; height: 40px;
  padding: 0;
}
```

- [ ] **Step 7: Build to confirm it compiles**

Run: `npm run build`
Expected: builds successfully.

- [ ] **Step 8: Commit**

```bash
git add web/src/App.jsx web/src/components/DeckPanel.jsx web/src/styles.css web/src/lib/i18n.js
git commit -m "feat: deck panel renders as full-screen bottom sheet on mobile"
```

---

## Task 5: Deck drawer — mobile count pill + "View deck"

**Files:**
- Modify: `web/src/components/DeckDrawer.jsx`
- Modify: `web/src/App.jsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: Add the mobile controls to DeckDrawer**

Replace the whole body of `web/src/components/DeckDrawer.jsx` with:

```javascript
import React from 'react';
import { useT } from '../i18n.jsx';

// Bottom action bar. On mobile it also surfaces the deck count and a button to
// open the deck sheet (the right-hand DeckPanel is hidden on mobile).
export default function DeckDrawer({ total, onManage, onExport, onImport, onNew, isMobile, onViewDeck }) {
  const t = useT();
  return (
    <div className="drawer">
      {isMobile && (
        <button className="btn secondary drawer-viewdeck" onClick={onViewDeck} disabled={total === 0}>
          {t('drawer.viewDeck')} <span className="deckpanel-badge">{total}</span>
        </button>
      )}
      <div className="spacer" />
      <button className="btn secondary" onClick={onNew}>{t('drawer.new')}</button>
      <button className="btn secondary" onClick={onImport}>{t('drawer.import')}</button>
      <button className="btn secondary" onClick={onManage}>{t('drawer.myDecks')}</button>
      <button className="btn" onClick={onExport} disabled={total === 0}>{t('drawer.export')}</button>
    </div>
  );
}
```

- [ ] **Step 2: Add the `drawer.viewDeck` i18n key**

Open `web/src/lib/i18n.js`, find the `drawer` group in both the `fr` and `en` objects (it already has `new`, `import`, `myDecks`, `export`). Add alongside them:
- `fr`: `viewDeck: 'Voir le deck',`
- `en`: `viewDeck: 'View deck',`

- [ ] **Step 3: Pass the new props from App**

In `web/src/App.jsx`, replace the `<DeckDrawer ... />` element (lines 138-144) with:

```javascript
      <DeckDrawer
        total={counts.total}
        onManage={() => setShowManager(true)}
        onExport={() => setShowExport(true)}
        onImport={() => setShowImport(true)}
        onNew={newDeck}
        isMobile={isMobile}
        onViewDeck={() => setDeckSheetOpen(true)}
      />
```

- [ ] **Step 4: Style the view-deck button**

Append to `web/src/styles.css`:

```css
.drawer-viewdeck { display: inline-flex; align-items: center; gap: 8px; }
```

- [ ] **Step 5: Run the test suite (i18n parity)**

Run: `npm test`
Expected: PASS — `test/i18n.test.js` confirms the new `drawer.viewDeck` key exists in both languages.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/DeckDrawer.jsx web/src/App.jsx web/src/lib/i18n.js web/src/styles.css
git commit -m "feat: mobile drawer shows deck count + View deck button"
```

---

## Task 6: FilterBar collapse + responsive CSS

**Files:**
- Modify: `web/src/components/FilterBar.jsx`
- Modify: `web/src/App.jsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: Collapse the facet row behind a toggle on mobile**

In `web/src/components/FilterBar.jsx`, change the import line 1 to include `useState` (it already does) — no change needed. Change the component signature (line 31) to accept `isMobile`:

```javascript
export default function FilterBar({ facets, filters, onChange, lang, onLangChange, isMobile }) {
```

Add local state at the top of the component body (just after `const t = useT();`, line 32):

```javascript
  const [filtersOpen, setFiltersOpen] = useState(false);
```

Then wrap the facet row. Replace the `<div className="filterbar-bottom">` opening tag (line 66) and add a toggle button before it. Replace lines 66 with:

```javascript
      {isMobile && (
        <button
          className={`chip-toggle filters-toggle ${filtersOpen ? 'on' : ''}`}
          onClick={() => setFiltersOpen((o) => !o)}
        >{t('filter.filters')} {filtersOpen ? '▴' : '▾'}</button>
      )}
      <div className="filterbar-bottom" style={isMobile && !filtersOpen ? { display: 'none' } : undefined}>
```

- [ ] **Step 2: Add the `filter.filters` i18n key**

Open `web/src/lib/i18n.js`, find the `filter` group in both `fr` and `en` (it has `search`, `set`, `type`, etc.). Add:
- `fr`: `filters: 'Filtres',`
- `en`: `filters: 'Filters',`

- [ ] **Step 3: Pass `isMobile` from App**

In `web/src/App.jsx`, replace the `<FilterBar ... />` element (line 117) with:

```javascript
      <FilterBar facets={derivedFacets} filters={filters} onChange={setFilters} lang={uiLang} onLangChange={setUiLang} isMobile={isMobile} />
```

- [ ] **Step 4: Add the responsive `@media` block**

Append this to the very end of `web/src/styles.css`. This is the ONLY layout media query; its condition must stay identical to `MOBILE_QUERY` in `web/src/lib/mobile.js`.

```css
/* ================= Mobile layout (keep in sync with MOBILE_QUERY) ============ */
@media (max-width: 768px), (pointer: coarse) {
  /* Filter bar: search inputs stack full-width; brand smaller. */
  .filterbar { padding: 8px 10px; }
  .brand-logo { height: 26px; }
  .filterbar input[type="search"] { flex: 1 1 100%; min-width: 0; }
  .filters-toggle { align-self: flex-start; }
  /* Open facet menus must not spill off-screen. */
  .facet-menu { left: 0; right: 0; min-width: 0; max-width: calc(100vw - 24px); }

  /* Card grid: ~3 columns, tighter gaps/padding. */
  .browser { padding: 8px; }
  .grid { grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 6px; }

  /* Bottom drawer: wraps, comfortable touch targets. */
  .drawer { gap: 8px; padding: 8px 10px; }
  .drawer .btn { padding: 10px 12px; min-height: 44px; }
  .drawer-viewdeck { order: -1; }

  /* Modals: use more of the screen, bigger touch targets, no h-overflow. */
  .modal { width: min(560px, 96vw); padding: 16px; }
  .modal .btn { min-height: 44px; }
  .import-textarea, .import-list select { width: 100%; }
}
```

- [ ] **Step 5: Build + run the full test suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests pass (i18n parity includes the new `filter.filters` key).

- [ ] **Step 6: Commit**

```bash
git add web/src/components/FilterBar.jsx web/src/App.jsx web/src/lib/i18n.js web/src/styles.css
git commit -m "feat: mobile filter collapse + responsive layout media query"
```

---

## Task 7: Live verification in the browser preview

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Use the preview tool `preview_start` with `{ name: "meccg" }` (from `.claude/launch.json`, Vite on :5173). Get the `tabId`.

- [ ] **Step 2: Verify DESKTOP is unchanged**

Resize the preview window to desktop (1280×800, light or dark). Confirm:
- Inline right deck sidebar appears after selecting a card (tap a card → it toggles into the deck, sidebar shows).
- Hover over a grid card shows the full-size hover preview after ~0.6s.
- No console errors (`read_console_messages`, `onlyErrors: true`).

- [ ] **Step 3: Verify MOBILE layout**

`resize_window` to mobile (375×812). Reload if needed. Confirm via `read_page` / `computer` screenshots:
- Filter bar: two search boxes stacked full-width; a "Filters ▾" button; tapping it reveals/hides the facet dropdowns.
- Card grid reflows to ~3 columns.

- [ ] **Step 4: Verify tap preview fits entirely on screen**

Tap a grid card. Confirm:
- A full-screen preview opens showing the **entire card with no clipping and no scrolling**.
- The ＋ / count / − controls adjust the quantity (tap ＋ → count becomes 1).
- "Done"/backdrop closes the modal; the card now shows its qty control in the grid.
- Take a screenshot as proof.

- [ ] **Step 5: Verify the deck bottom sheet**

With at least one card selected, confirm the bottom drawer shows a "View deck" button with a count badge. Tap it:
- The deck slides up as a full-screen sheet with grouped cards, the zoom slider, and a ✕ close button (no drag-resizer, no maximize/collapse chevron).
- The zoom slider changes card size.
- Tapping a mini-card image opens the same full-screen preview.
- ✕ closes the sheet.
- Take a screenshot as proof.

- [ ] **Step 6: Report results**

Summarize what was verified with the screenshots (desktop unchanged; mobile grid/filter/preview/sheet working; preview card fully visible). If any check fails, diagnose via source, fix, re-run the affected task's build/test, and re-verify from Step 2.

---

## Self-Review Notes

- **Spec coverage:** Detection (Task 1 + media query in Task 6); card grid reflow + tap-to-preview (Tasks 3, 6); CardPreviewModal with fit-on-screen sizing (Task 2, verified Task 7 Step 4); deck bottom sheet (Task 4); filter collapse (Task 6); drawer count/View-deck (Task 5); modal touch targets (Task 6); full parity retained (nothing removed, desktop paths gated on `!isMobile`). All spec sections map to a task.
- **Acceptance criterion #2 (whole card visible):** enforced by `.card-modal-imgwrap` flex + `object-fit: contain` (Task 2) and explicitly checked in Task 7 Step 4.
- **Type/name consistency:** `isMobile`, `onPreview`, `previewCard`, `deckSheetOpen`, `asSheet`, `onViewDeck`, `MOBILE_QUERY`, `isMobileWidth`, `useIsMobile` used consistently across App and children. i18n keys added: `common.done`, `common.close` (verify-or-add), `drawer.viewDeck`, `filter.filters`.
- **Breakpoint single source:** `MOBILE_QUERY` string and the `@media` condition are byte-identical; both carry a sync comment.
```
