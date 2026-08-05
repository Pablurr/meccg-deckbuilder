# Proxy set-name mask Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For en/es card images, always mask the `©19xx Tolkien Enterprises`
notice — showing the set's official translated name when Mode Proxy is off,
and `"Proxy"` when it is on — while fr behaviour stays exactly as today.

**Architecture:** One new pure helper, `proxyStampFor(card, lang, proxyMode,
setNames)` in `web/src/lib/proxy.js`, becomes the single decision point for
"is there a stamp, and what does it say". The three existing render paths (the
React overlay, the imperative hover preview, the canvas export) each drop their
hardcoded `PROXY_LABEL` / `PROXY_LABEL_COLOR[key]` and call it instead. The
per-key colour table is regenerated from real FR card pixels with an enforced
contrast floor. Geometry and the 32 patch PNGs are untouched.

**Tech Stack:** Vite + React 18 (JSX, no TypeScript), Vitest, canvas 2d,
Python 3 + Pillow for the offline asset/colour generator.

## Global Constraints

- **French for prose** (docs, README, owner-facing messages), **English for
  code** (identifiers, comments, rule ids, commit messages).
- **`docs/ARCHITECTURE.md` is the project's technical memory.** §8 covers the
  proxy stamp. It must be updated **in the same commit** as the code change,
  along with §15 (dated journal) and the date at the top of the file. A change
  shipped without it is half-done.
- **"Faction" never means a side.** The word is `side` / camp.
- **No new runtime dependency.** There are exactly two (`jszip`, `pdf-lib`).
  `colorsys` used in Task 4 is Python stdlib and offline-only — not a runtime
  dependency.
- **One source of truth per domain.** `proxy.js` is authoritative for stamp
  classification, geometry and labels. Do not reimplement any of it elsewhere.
- **Comments explain the *why* and the traps, not the *what*.** Match the
  density and voice of the surrounding code.
- `npm test` must pass with **0 failures**. A JSX syntax error fails a test
  file **at compile time** — read the *file* count, not just the test count.
- Card image languages are exactly `en`, `es`, `fr` (`IMAGE_LANGUAGES`).
- The parsed card object's set id field is **`card.setCode`** (not `card.set`).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `web/src/lib/proxy.js` | **Modify.** Add `proxyStampFor`; later, new `PROXY_LABEL_COLOR` values. | 1, 4 |
| `test/proxy.test.js` | **Modify.** Cases for `proxyStampFor`; later, the colour-table assertions. | 1, 4 |
| `web/src/components/ProxyStamp.jsx` | **Modify.** Render from `proxyStampFor`. | 2 |
| `web/src/components/CardPreview.jsx` | **Modify.** Same switch in the imperative hover path. | 2 |
| `web/src/styles.css` | **Modify.** `white-space: nowrap` on the label span. | 2 |
| `web/src/App.jsx` | **Modify.** Thread `setNames` to 4 render sites. | 2 |
| `web/src/components/CardBrowser.jsx` | **Modify.** Accept + forward `setNames`. | 2 |
| `web/src/components/MiniCard.jsx` | **Modify.** Accept + forward `setNames`. | 2 |
| `web/src/components/DeckPanel.jsx` | **Modify.** Accept + forward `setNames`. | 2 |
| `web/src/components/CardPreviewModal.jsx` | **Modify.** Accept + forward `setNames`. | 2 |
| `web/src/lib/export/proxyDraw.js` | **Modify.** `drawProxyOnFace` takes text + colour. | 3 |
| `web/src/lib/export/bleedCanvas.js` | **Modify.** Pass them through. | 3 |
| `web/src/api.js` | **Modify.** Cache `setNames`; gate patch loading per language. | 3 |
| `scripts/make_proxy_patches.py` | **Modify.** Replace `label_colour` with sample-then-floor. | 4 |
| `scripts/proxy-patch-colors.txt` | **Regenerate.** New values + provenance columns. | 4 |
| `docs/ARCHITECTURE.md` | **Modify.** §8 + §15 + header date. | 2, 3, 4 |
| `README.md` | **Modify.** User-visible behaviour change. | 3 |

---

## Task 1: The `proxyStampFor` helper

Pure logic, no rendering. Lands unused; Task 2 wires it up.

**Files:**
- Modify: `web/src/lib/proxy.js` (add import at line 1, helper after `swatchKeyForCard`)
- Test: `test/proxy.test.js`

**Interfaces:**
- Consumes: `swatchKeyForCard(card)`, `PROXY_LABEL`, `PROXY_LABEL_COLOR` (all
  already exported from `proxy.js`); `setName(setNames, code, lang)` from
  `web/src/lib/lang.js`.
- Produces: `proxyStampFor(card, lang, proxyMode, setNames)` →
  `{ key: string, text: string, color: string } | null`. Tasks 2 and 3 call
  exactly this signature and destructure exactly these three fields.

- [ ] **Step 1: Write the failing test**

Append to `test/proxy.test.js`:

```js
describe('proxyStampFor', () => {
  const SET_NAMES = {
    AS: { en: 'Against the Shadow', es: 'Contra la Sombra', fr: "Contre l'Ombre" },
  };
  const card = {
    id: 'AS-1', setCode: 'AS', type: 'Character', alignment: 'Minion',
    attributes: {}, name: { en: 'Bûrat' },
  };
  const region = {
    id: 'AS-R', setCode: 'AS', type: 'Region', alignment: '',
    attributes: {}, name: { en: 'Anywhere' },
  };

  it('leaves fr untouched: a stamp only when proxy mode is on', () => {
    expect(proxyStampFor(card, 'fr', false, SET_NAMES)).toBeNull();
    expect(proxyStampFor(card, 'fr', true, SET_NAMES)).toEqual({
      key: 'minion-character', text: 'Proxy',
      color: PROXY_LABEL_COLOR['minion-character'],
    });
  });

  it('always masks en/es, whatever the proxy mode', () => {
    for (const lang of ['en', 'es']) {
      expect(proxyStampFor(card, lang, true, SET_NAMES).text).toBe('Proxy');
      expect(proxyStampFor(card, lang, false, SET_NAMES)).not.toBeNull();
    }
  });

  it('labels the unchecked en/es mask with the official translated set name', () => {
    expect(proxyStampFor(card, 'en', false, SET_NAMES).text).toBe('Against the Shadow');
    expect(proxyStampFor(card, 'es', false, SET_NAMES).text).toBe('Contra la Sombra');
  });

  it('uses one colour table for both label kinds', () => {
    const proxy = proxyStampFor(card, 'en', true, SET_NAMES);
    const named = proxyStampFor(card, 'en', false, SET_NAMES);
    expect(named.color).toBe(proxy.color);
    expect(named.key).toBe(proxy.key);
  });

  it('never stamps a Region, in any language or mode', () => {
    for (const lang of ['en', 'es', 'fr']) {
      for (const mode of [true, false]) {
        expect(proxyStampFor(region, lang, mode, SET_NAMES)).toBeNull();
      }
    }
  });

  it('falls back to the bare set code when a set has no translated name', () => {
    expect(proxyStampFor(card, 'en', false, {}).text).toBe('AS');
  });

  it('resolves every real card to a drawable label with no proxy mode', async () => {
    const cards = await loadCards();
    const raw = JSON.parse(await readFile(CARDS_JSON, 'utf-8'));
    const setNames = collectSetNames(raw);
    for (const c of cards) {
      const stamp = proxyStampFor(c, 'en', false, setNames);
      if (c.type === 'Region') expect(stamp).toBeNull();
      else expect(typeof stamp.text === 'string' && stamp.text.length > 0).toBe(true);
    }
  });
});
```

Extend the two import blocks at the top of the same file:

```js
import { flattenCards, collectSetNames } from '../web/src/lib/parseCards.js';
import {
  swatchKeyForCard, PROXY_PATCH_RECT, PROXY_LABEL, SWATCH_KEYS,
  PROXY_LABEL_COLOR, PROXY_LABEL_FONT_FRAC, PROXY_LABEL_POS,
  PROXY_LABEL_FONT_CQW, PROXY_LABEL_DY_CQH, patchUrl, proxyStampFor,
} from '../web/src/lib/proxy.js';
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run test/proxy.test.js
```

Expected: FAIL — `proxyStampFor is not a function`.

- [ ] **Step 3: Write the implementation**

In `web/src/lib/proxy.js`, add to the imports at the very top of the file:

```js
import { setName } from './lang.js';
```

Then append, after `swatchKeyForCard`:

```js
// What a card's stamp shows, or null when it takes no stamp at all.
//
// en/es always mask the copyright notice: it must never reach a print run,
// whatever the user intended, so the checkbox no longer decides WHETHER there
// is a mask for those two languages -- only what caption sits on it. "Proxy"
// for an actual proxy print; otherwise the set's own translated name, which is
// what the FR cards print in that exact spot anyway.
//
// fr keeps the original behaviour untouched (no stamp unless proxy mode is on)
// because the FR images carry the set name there instead of a copyright line,
// so there is nothing that has to be hidden.
export function proxyStampFor(card, lang, proxyMode, setNames) {
  const key = swatchKeyForCard(card);
  if (!key) return null;
  if (lang === 'fr' && !proxyMode) return null;
  const text = proxyMode ? PROXY_LABEL : setName(setNames, card.setCode, lang);
  return { key, text, color: PROXY_LABEL_COLOR[key] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run test/proxy.test.js
```

Expected: PASS, all files.

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: 0 failures. Check the **file** count as well as the test count.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/proxy.js test/proxy.test.js
git commit -m "feat: add proxyStampFor, the single decision point for stamp labels"
```

---

## Task 2: On-screen rendering

Wires the helper into both DOM paths and threads `setNames` from `App`. After
this task the behaviour is visible in the browser; exports still show the old
behaviour (Task 3).

**Files:**
- Modify: `web/src/components/ProxyStamp.jsx` (whole component)
- Modify: `web/src/components/CardPreview.jsx:20`, `:52-75`
- Modify: `web/src/styles.css:233-237`
- Modify: `web/src/App.jsx:280`, `:282`, `:310`, `:417`
- Modify: `web/src/components/CardBrowser.jsx:119`, `:150`, `:213`
- Modify: `web/src/components/MiniCard.jsx:19`, `:48`
- Modify: `web/src/components/DeckPanel.jsx:151`, `:158`, `:530-542`
- Modify: `web/src/components/CardPreviewModal.jsx:19`, `:39`
- Modify: `docs/ARCHITECTURE.md` §8, §15, header date

**Interfaces:**
- Consumes: `proxyStampFor(card, lang, proxyMode, setNames)` from Task 1.
- Produces: `ProxyStamp` and `useCardPreview` both take a new `setNames` prop /
  third argument. `useCardPreview(lang, proxyOn, setNames)` — argument order
  matters, Task 3 does not touch it.

**Note on the `on` prop:** `ProxyStamp` keeps its existing prop name `on` for
the proxy-mode flag. Callers already pass `on={proxyMode}`; only `setNames` is
added. Do not rename it — that would touch four call sites for no gain.

- [ ] **Step 1: Rewrite `ProxyStamp.jsx`**

Replace the whole file with:

```jsx
import React from 'react';
import {
  proxyStampFor, PROXY_PATCH_RECT,
  PROXY_LABEL_FONT_CQW, PROXY_LABEL_DY_CQH, patchUrl,
} from '../lib/proxy.js';

const pct = (f) => `${f * 100}%`;

// CSS overlay repainting the copyright / set-name zone with the card frame's own
// patch, plus the label. Must live inside a positioned wrapper that matches the
// card image bounds exactly. The label scales with the box via cqw and is nudged
// onto the reference band via cqh (see .proxy-stamp in styles.css).
// What is drawn -- and whether anything is drawn at all -- is proxyStampFor's
// call, not this component's: `on` is the proxy-mode flag, not a visibility flag.
export default function ProxyStamp({ card, lang, on, setNames }) {
  const stamp = proxyStampFor(card, lang, on, setNames);
  if (!stamp) return null;
  const r = PROXY_PATCH_RECT;
  return (
    <div
      className="proxy-stamp"
      aria-hidden="true"
      style={{
        left: pct(r.x),
        top: pct(r.y),
        width: pct(r.w),
        height: pct(r.h),
        backgroundImage: `url(${patchUrl(stamp.key, lang)})`,
      }}
    >
      <span
        style={{
          color: stamp.color,
          fontSize: `${PROXY_LABEL_FONT_CQW}cqw`,
          transform: `translateY(${PROXY_LABEL_DY_CQH}cqh)`,
        }}
      >
        {stamp.text}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Update the imperative hover preview**

In `web/src/components/CardPreview.jsx`, replace the import block at lines 3-6:

```jsx
import {
  proxyStampFor, PROXY_PATCH_RECT,
  PROXY_LABEL_FONT_CQW, PROXY_LABEL_DY_CQH, patchUrl,
} from '../lib/proxy.js';
```

Change the hook signature at line 20:

```jsx
export function useCardPreview(lang, proxyOn = false, setNames = {}) {
```

Replace the stamp block (lines 54-75) with:

```jsx
    const stamp = stampRef.current;
    if (stamp) {
      const spec = proxyStampFor(c, lang, proxyOn, setNames);
      if (spec) {
        const r = PROXY_PATCH_RECT;
        stamp.style.left = `${r.x * 100}%`;
        stamp.style.top = `${r.y * 100}%`;
        stamp.style.width = `${r.w * 100}%`;
        stamp.style.height = `${r.h * 100}%`;
        stamp.style.backgroundImage = `url(${patchUrl(spec.key, lang)})`;
        const span = stamp.firstElementChild;
        if (span) {
          span.textContent = spec.text;
          span.style.color = spec.color;
          span.style.fontSize = `${PROXY_LABEL_FONT_CQW}cqw`;
          span.style.transform = `translateY(${PROXY_LABEL_DY_CQH}cqh)`;
        }
        stamp.style.display = 'flex';
      } else {
        stamp.style.display = 'none';
      }
    }
```

- [ ] **Step 3: Stop the longer label from wrapping**

In `web/src/styles.css`, the `.proxy-stamp span` rule at lines 233-237 becomes:

```css
.proxy-stamp span {
  font-family: Arial, Helvetica, sans-serif;
  font-weight: 700;
  line-height: 1;
  /* "Servidores de la Oscuridad" is 124px of the 179px box in Arial Bold, so
     it fits -- but the canvas path never wraps, and a fallback font on a
     machine without Arial could push it over. Wrapping is the one way these
     two paths could visibly disagree. */
  white-space: nowrap;
}
```

- [ ] **Step 4: Thread `setNames` through the component tree**

`web/src/App.jsx` — add `setNames={setNames}` to four elements:
- line 280, `<CardBrowser ... />`
- line 282, the desktop `<DeckPanel`
- line 310, the mobile-sheet `<DeckPanel`
- line 417, `<CardPreviewModal`

`web/src/components/CardBrowser.jsx`:
- line 119, add `setNames` to the destructured props:
  `export default function CardBrowser({ cards, filters, quantities, lang, onChangeQty, onToggle, onSelectAll, isMobile, onPreview, proxyMode, setNames, deckMode, side, zones, changeZoneQty, capCtx }) {`
- line 150: `useCardPreview(lang, proxyMode, setNames)`
- line 213: `<ProxyStamp card={c} lang={lang} on={proxyMode} setNames={setNames} />`

`web/src/components/MiniCard.jsx`:
- line 19, add `setNames` to the destructured props (after `proxyMode`)
- line 48: `<ProxyStamp card={card} lang={lang} on={proxyMode} setNames={setNames} />`

`web/src/components/DeckPanel.jsx`:
- line 151 area, add `setNames = {},` beside `proxyMode = false,`
- line 158: `useCardPreview(lang, proxyMode, setNames)`
- in the `<MiniCard` block at lines 530-542, add `setNames={setNames}` beside
  `proxyMode={proxyMode}`

`web/src/components/CardPreviewModal.jsx`:
- line 19: `export default function CardPreviewModal({ card, lang, rows = [], onChangeZoneQty, onClose, proxyMode, setNames }) {`
- line 39: `<ProxyStamp card={card} lang={lang} on={proxyMode} setNames={setNames} />`

- [ ] **Step 5: Run the full suite**

```bash
npm test
```

Expected: 0 failures. A JSX typo here fails a whole test file at compile time —
confirm the file count matches the previous run.

- [ ] **Step 6: Verify in the browser**

Start the dev server (via the preview tooling, not a raw shell command) and check:
1. Mode Proxy **off**, language **EN** → browsed cards show the set name over
   the copyright zone (e.g. "Against the Shadow" on an AS card).
2. Same with **ES** → "Contra la Sombra".
3. Same with **FR** → the real card bottom, no stamp at all.
4. Mode Proxy **on** → all three show "Proxy".
5. Regions show no stamp in any combination.
6. The hover preview, the deck panel minicards and the mobile preview modal all
   agree with the grid — these are three different code paths.

- [ ] **Step 7: Update `docs/ARCHITECTURE.md`**

In §8 (around lines 823-882):
- The opening "Pourquoi" paragraph now has to say that for en/es the mask is
  unconditional and the toggle only picks the caption, while fr is unchanged.
- Add a short subsection documenting `proxyStampFor` as the single decision
  point, and state the invariant: the three render paths must never decide any
  of this themselves.
- Note the `white-space: nowrap` and why (the canvas path cannot wrap).

Also add a dated entry to §15 and update the date at the top of the file.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/ProxyStamp.jsx web/src/components/CardPreview.jsx web/src/styles.css web/src/App.jsx web/src/components/CardBrowser.jsx web/src/components/MiniCard.jsx web/src/components/DeckPanel.jsx web/src/components/CardPreviewModal.jsx docs/ARCHITECTURE.md
git commit -m "feat: always mask the copyright notice on en/es card images"
```

---

## Task 3: Export pipeline

Makes the ZIP and PDF exports agree with the screen.

**Files:**
- Modify: `web/src/lib/export/proxyDraw.js:10-31`
- Modify: `web/src/lib/export/bleedCanvas.js:7`, `:18`
- Modify: `web/src/api.js:11`, `:16-18`, `:98-113`
- Modify: `docs/ARCHITECTURE.md` §8, §15
- Modify: `README.md`

**Interfaces:**
- Consumes: `proxyStampFor` (Task 1).
- Produces: `drawProxyOnFace(ctx, w, h, patchBmp, text, color)` — note the
  `key` parameter is **replaced** by `text` and `color`, not appended; the key
  was only ever used to look the colour up. `stampFor(card)` now returns
  `{ patchBmp, key, text, color } | null`.

- [ ] **Step 1: Take the label from the caller in `proxyDraw.js`**

Replace lines 1-31 of `web/src/lib/export/proxyDraw.js`:

```js
import {
  PROXY_PATCH_RECT, PROXY_LABEL_FONT_FRAC, PROXY_LABEL_POS, patchUrl,
} from '../proxy.js';

// Bake the proxy stamp into a cut-size face: the frame patch drawn over the
// copyright / set-name zone, the label in Arial Bold on top. Browser-only
// (canvas 2d ctx). If the patch bitmap is missing, fill with the average of the
// pixels already under the rect — the notice must never survive the export.
// The label text and colour are decided by proxyStampFor, never here: this
// function draws what it is handed.
export function drawProxyOnFace(ctx, w, h, patchBmp, text, color) {
  const r = PROXY_PATCH_RECT;
  const x = Math.round(r.x * w);
  const y = Math.round(r.y * h);
  const rw = Math.round(r.w * w);
  const rh = Math.round(r.h * h);
  if (patchBmp) {
    ctx.drawImage(patchBmp, x, y, rw, rh);
  } else {
    const data = ctx.getImageData(x, y, rw, rh).data;
    let R = 0, G = 0, B = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) { R += data[i]; G += data[i + 1]; B += data[i + 2]; }
    ctx.fillStyle = `rgb(${Math.round(R / n)},${Math.round(G / n)},${Math.round(B / n)})`;
    ctx.fillRect(x, y, rw, rh);
  }
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(PROXY_LABEL_FONT_FRAC * w)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, PROXY_LABEL_POS.cx * w, PROXY_LABEL_POS.cy * h);
}
```

- [ ] **Step 2: Pass them through `bleedCanvas.js`**

Line 7's comment and line 18:

```js
// the proxy stamp baked in. stamp = { patchBmp, text, color } | null.
```

```js
  if (stamp) drawProxyOnFace(fctx, CARD_W_CUT, CARD_H_CUT, stamp.patchBmp, stamp.text, stamp.color);
```

- [ ] **Step 3: Resolve `setNames` and the per-language gate in `api.js`**

Line 8 becomes:

```js
import { swatchKeyForCard, proxyStampFor } from './lib/proxy.js';
```

Line 11 gains a second module-scope cache:

```js
let _index = null;     // id -> card, set by getCards(); used by the export functions
let _setNames = null;  // set code -> { en, es, fr }, likewise — the stamp labels need it
```

In `getCards` (lines 16-18):

```js
  const { cards, facets, index, setNames } = parseCards(await res.json());
  _index = index;
  _setNames = setNames;
  return { cards, facets, setNames, defaultBacks: { playdeck: true, locationdeck: true } };
```

Replace `makeStampFor` (lines 98-113):

```js
// (card) => { patchBmp, key, text, color } | null. Loads only the patches this
// deck needs, in the export's image language. Returns { stampFor, closePatches }
// so callers can free the bitmaps after export.
//
// The early bail is per-language, not global: en/es always mask the copyright
// notice, so only fr can skip the work entirely when proxy mode is off.
async function makeStampFor(cards, lang, proxyMode) {
  if (lang === 'fr' && !proxyMode) return { stampFor: () => null, closePatches: () => {} };
  const setNames = _setNames || {};
  const keys = new Set(cards.map(swatchKeyForCard).filter(Boolean));
  const patches = await loadPatchBitmaps(keys, lang);
  return {
    stampFor: (card) => {
      const spec = proxyStampFor(card, lang, proxyMode, setNames);
      return spec ? { ...spec, patchBmp: patches.get(spec.key) } : null;
    },
    closePatches: () => closePatchBitmaps(patches),
  };
}
```

`exportDeck` and `exportPdf` keep calling `makeStampFor(cards, lang, proxyMode)`
unchanged — no signature change at those two call sites.

- [ ] **Step 4: Run the full suite**

```bash
npm test
```

Expected: 0 failures.

- [ ] **Step 5: Verify a real export**

In the running app, with **Mode Proxy off** and image language **EN**:
1. Export a small deck as a ZIP; open one front PNG. The copyright notice must
   be gone and the set name baked in its place.
2. Export the same deck as a PDF; confirm the same on a sheet.
3. Repeat with image language **FR**, still proxy off — the fronts must be the
   untouched original images.

- [ ] **Step 6: Update the docs**

`docs/ARCHITECTURE.md` §8: record that the export path bails per-language now,
and that `drawProxyOnFace` no longer knows about label text or colour. Add the
§15 entry.

`README.md`: update the proxy-mode paragraph — for en/es the copyright zone is
always repainted, the toggle chooses between the set name and "Proxy"; fr is
unaffected.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/export/proxyDraw.js web/src/lib/export/bleedCanvas.js web/src/api.js docs/ARCHITECTURE.md README.md
git commit -m "feat: bake the en/es set-name mask into ZIP and PDF exports"
```

---

## Task 4: Regenerate the label colours from real FR cards

Replaces the synthetic black/white contrast pick with the FR tint, floored for
legibility. Purely visual — the behaviour from Tasks 1-3 is already correct.

**Requires the local card corpus** under `cards/` (gitignored, absent from a
fresh clone), Pillow ≥ 11.3, and `C:\Windows\Fonts\arialbd.ttf`. The generator
already fails loudly via `_require_corpus` if the corpus is missing. If it is
not available, stop and report — do not invent colour values.

**Files:**
- Modify: `scripts/make_proxy_patches.py` (`label_colour`, constants, `main`, `_qa`)
- Regenerate: `scripts/proxy-patch-colors.txt`
- Modify: `web/src/lib/proxy.js:45-62` (`PROXY_LABEL_COLOR` literals)
- Modify: `test/proxy.test.js:115-120`
- Modify: `docs/ARCHITECTURE.md` §8, §15

**Interfaces:**
- Consumes: `boxes(w, h, key)`, `_key_of_fr(path)`, `M.OUT`, `REF_W`, `REF_H`,
  `LABEL_FONT_FRAC`, `LABEL_CX`, `LABEL_CY`, `ARIAL_BOLD` — all already in
  `make_proxy_patches.py`.
- Produces: no JS signature change. `PROXY_LABEL_COLOR` keeps its name, shape
  and 16 keys; only the values change, from two fixed hexes to 16 distinct ones.

- [ ] **Step 1: Write the failing test**

In `test/proxy.test.js`, replace the existing colour test (lines 115-120):

```js
  it('gives every key its own sampled label colour', () => {
    expect(Object.keys(PROXY_LABEL_COLOR).sort()).toEqual([...SWATCH_KEYS].sort());
    for (const key of SWATCH_KEYS) {
      expect(PROXY_LABEL_COLOR[key]).toMatch(/^#[0-9A-F]{6}$/);
    }
    // The retired generator only ever emitted these two. Seeing them again
    // means the table was not regenerated from the FR cards.
    const values = SWATCH_KEYS.map((k) => PROXY_LABEL_COLOR[k]);
    expect(values.every((v) => v === '#191919' || v === '#F0F0EA')).toBe(false);
    // 16 frames, 16 tones: a duplicate means two keys were sampled as one.
    expect(new Set(values).size).toBe(SWATCH_KEYS.length);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run test/proxy.test.js
```

Expected: FAIL — the table still holds only `#191919` / `#F0F0EA`.

- [ ] **Step 3: Replace the colour pass in the generator**

In `scripts/make_proxy_patches.py`, add to the imports at the top:

```python
import colorsys
```

Replace the `LUM_THRESHOLD`, `DARK`, `LIGHT` constants (lines 38-39) with the
two below. All three are used only by the `label_colour` being replaced, so
nothing else breaks:

```python
INK_DIFF_MIN = 28      # card-vs-patch luminance delta that counts as printed ink
MIN_CONTRAST = 80      # label luminance must clear this against BOTH patch variants
```

Add a shared corpus walk (the existing `fr_offset` duplicates this inline —
give both the same source of truth):

```python
_FR_PATHS = None


def fr_card_paths():
    """Every FR card image, walked once and cached."""
    global _FR_PATHS
    if _FR_PATHS is None:
        _FR_PATHS = []
        for dirpath, _, files in os.walk(FR_CARDS):
            for f in files:
                if f.lower().endswith(('.jpg', '.png')):
                    _FR_PATHS.append(os.path.join(dirpath, f))
    return _FR_PATHS


def _lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
```

In `fr_offset`, replace its inline walk (lines 99-104) with:

```python
    keyed = [p for p in fr_card_paths() if _key_of_fr(p) == key][:12]
```

Now replace `label_colour` (lines 177-190) entirely:

```python
def fr_tint(key):
    """Mean RGB of the set-name ink the FR cards actually print, for one key.

    Isolates the glyphs by differencing each card against its own -fr patch --
    which IS the reconstructed empty frame, so whatever differs from it is the
    printed text. A luminance-vs-local-background threshold does NOT work here:
    on the four site frames the bottom-left corner is torn away, and the dark
    torn edge outvotes the glyphs (it read near-black for minion-site, whose
    "Contre l'Ombre" is plainly white). Differencing is also polarity-agnostic,
    which matters because the ink is light on the dark frames and dark on the
    light ones.
    """
    patch = Image.open(os.path.join(OUT, '%s-fr.png' % key)).convert('RGB')
    pp = list(patch.get_flattened_data())
    plum = sum(_lum(q) for q in pp) / len(pp)
    acc, cards = [0.0, 0.0, 0.0], 0
    for p in [q for q in fr_card_paths() if _key_of_fr(q) == key][:12]:
        im = Image.open(p).convert('RGB')
        w, h = im.size
        _, outer, _ = boxes(w, h, key)
        band = im.crop(outer).resize(patch.size, Image.LANCZOS)
        ink = [b for b, q in zip(band.get_flattened_data(), pp)
               if abs(_lum(b) - _lum(q)) > INK_DIFF_MIN]
        if len(ink) < 40:
            continue
        # Keep the half furthest from the frame tone: the glyph core, not the
        # anti-aliased edge, which would drag the mean back toward the frame.
        ink.sort(key=lambda c: -abs(_lum(c) - plum))
        core = ink[:max(20, len(ink) // 2)]
        for ci in range(3):
            acc[ci] += sum(q[ci] for q in core) / len(core)
        cards += 1
    if not cards:
        raise SystemExit('No usable FR cards for key %r; cannot sample the label colour.' % key)
    return tuple(round(v / cards) for v in acc)


def patch_label_lum(key, variant):
    """Mean luminance of the patch pixels the label sits on, for one variant."""
    p = Image.open(os.path.join(OUT, '%s%s.png' % (key, variant))).convert('RGBA')
    _, outer, _ = boxes(REF_W, REF_H, key)
    f = ImageFont.truetype(ARIAL_BOLD, max(6, round(LABEL_FONT_FRAC * REF_W)))
    probe = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    cx, cy = LABEL_CX * REF_W - outer[0], LABEL_CY * REF_H - outer[1]
    l, t, r, b = probe.textbbox((cx, cy), 'Proxy', font=f, anchor='mm')
    crop = p.crop((int(l - 2), int(t - 2), int(r + 2), int(b + 2)))
    rgb, alpha = crop.convert('RGB'), crop.getchannel('A')
    vals = [q for q, a in zip(rgb.get_flattened_data(), alpha.get_flattened_data()) if a > 200]
    return sum(_lum(q) for q in vals) / len(vals) if vals else 128.0


def label_colour(key):
    """The FR tint, pushed if needed until it clears MIN_CONTRAST.

    The real FR cards print this text illegibly on the light frames -- measured
    contrast of 2 for radagast, 7 for gandalf, 13 for hero-character. Copying
    that faithfully would be fine for the set name (decoration; the mask hides
    the notice either way) but not for "Proxy", which is functional information
    when checking a print run and was contrast-guaranteed by construction
    before. So: keep the sampled hue and saturation, move only the lightness,
    and only as far as the floor requires. Ten of the sixteen keys clear it
    untouched and keep their FR tint exactly.

    Returns (final_hex, fr_tint_hex, moved).
    """
    tint = fr_tint(key)
    plums = [patch_label_lum(key, ''), patch_label_lum(key, '-fr')]
    as_hex = lambda c: '#%02X%02X%02X' % tuple(c)
    if all(abs(_lum(tint) - p) >= MIN_CONTRAST for p in plums):
        return as_hex(tint), as_hex(tint), False
    h, _l, s = colorsys.rgb_to_hls(*[c / 255 for c in tint])
    at = lambda L: tuple(round(c * 255) for c in colorsys.hls_to_rgb(h, L, s))
    # Move away from the frame: darker under a light one, lighter under a dark
    # one. Targeting the worst of the two variants clears both at once.
    darker = sum(plums) / 2 >= 128
    want = (min(plums) - MIN_CONTRAST) if darker else (max(plums) + MIN_CONTRAST)
    want = max(0.0, min(255.0, want))
    lo, hi = 0.0, 1.0
    for _ in range(40):                     # bisect: HLS lightness is not luminance
        mid = (lo + hi) / 2
        if _lum(at(mid)) < want:
            lo = mid
        else:
            hi = mid
    return as_hex(at((lo + hi) / 2)), as_hex(tint), True
```

- [ ] **Step 4: Update `main()` to the new call shape**

In `main()`, replace the colour lines (the `col, lum = label_colour(patch, outer)`
call, its `colours.append`, its `print`, and the file write):

```python
        col, tint, moved = label_colour(key)
        colours.append((key, col, tint, moved))
        print('%-17s size=%dx%d  fr_offset=%s  label=%s (fr tint %s%s)'
              % (key, patch.width, patch.height, tuple(round(v, 1) for v in off),
                 col, tint, ', floored' if moved else ''))
```

and:

```python
    with open(COLORS, 'w', encoding='utf-8') as f:
        for key, col, tint, moved in colours:
            f.write('%s %s %s %s\n' % (key, col, tint, 'floored' if moved else 'sampled'))
```

In `_qa()`, the colours file now has four columns — update its reader:

```python
    with open(COLORS, encoding='utf-8') as f:
        for line in f:
            k, c, _tint, _origin = line.split()
            colours[k] = c
```

and draw both label states so the sheet shows what was signed off. Replace the
whole block at lines 289-297 — from `after = card.copy()` down to and including
the `panels.append(...)` line — with:

```python
            y0, y1, x1 = int(h * 0.925), int(h * 0.99), int(w * 0.62)
            lf = ImageFont.truetype(ARIAL_BOLD, max(6, round(LABEL_FONT_FRAC * w)))
            before = card.crop((0, y0, x1, y1))
            # Both captions: "Proxy" is what the toggle draws, the set name is
            # what en/es show without it. The contrast floor has to hold for
            # both, and only the sheet can confirm it did.
            for state, caption in (('Proxy', 'Proxy'), ('set name', 'Against the Shadow')):
                after = card.copy()
                after.paste(p, (outer[0], outer[1]), p)
                ImageDraw.Draw(after).text((LABEL_CX * w, LABEL_CY * h), caption,
                                           font=lf, fill=colours[key], anchor='mm')
                panels.append(('%s / %s / %s' % (key, tag, state), before,
                               after.crop((0, y0, x1, y1))))
```

This doubles the sheet from ~32 panels to ~64 — expected, not a bug.

- [ ] **Step 5: Run the generator**

```bash
python scripts/make_proxy_patches.py
```

Expected: 16 lines printed, each with a distinct `label=` hex; about six say
`floored`. `scripts/proxy-patch-colors.txt` rewritten with four columns.

The 32 PNGs are rewritten byte-identically — this task changes no pixels. If
`git status` shows the patch PNGs as modified, stop: something in the crop path
changed and that is a regression, not part of this task.

- [ ] **Step 6: Review the QA sheet**

Open `scripts/proxy-patch-qa.png` (not committed). For all 16 keys, in both
languages and **both** label states, confirm the notice is gone, no patch seam
is visible, and the label is legible. A key that fails legibility gets a manual
value in `proxy-patch-colors.txt` and a note in §8 — do not lower
`MIN_CONTRAST` globally to rescue one key.

- [ ] **Step 7: Copy the reviewed values into `proxy.js`**

Replace the `PROXY_LABEL_COLOR` literals at `web/src/lib/proxy.js:45-62` with
the first two columns of the regenerated `scripts/proxy-patch-colors.txt`, and
update the comment above it:

```js
// Label colour per key: the tone the FR cards actually print their set name in,
// pushed away from the frame only where that tone would be illegible on it.
// Generated by scripts/make_proxy_patches.py (see scripts/proxy-patch-colors.txt,
// whose third column keeps the unfloored FR tint) and committed as literals so
// CSS and canvas render identically.
```

- [ ] **Step 8: Run the tests**

```bash
npm test
```

Expected: 0 failures, including the rewritten colour test.

- [ ] **Step 9: Update `docs/ARCHITECTURE.md`**

§8's colour paragraph currently says the table is "généré par le script … et
committé en littéraux". Extend it: the source is now real FR card pixels
isolated by differencing against the `-fr` patch, with a contrast floor of 80
against both variants; record the two traps (the torn-corner artefact that
makes a threshold sampler wrong, and the fact that six keys are floored rather
than faithful). Add the §15 entry.

- [ ] **Step 10: Commit**

```bash
git add scripts/make_proxy_patches.py scripts/proxy-patch-colors.txt web/src/lib/proxy.js test/proxy.test.js docs/ARCHITECTURE.md
git commit -m "feat: sample label colours from the FR cards, with a contrast floor"
```

---

## Verification (whole feature)

1. `npm test` — 0 failures, file count unchanged from before the branch.
2. On screen, all four combinations behave: en/es always masked (set name off,
   "Proxy" on), fr unchanged (nothing off, "Proxy" on), Regions never stamped.
3. The grid, the hover preview, the deck panel and the mobile modal agree.
4. ZIP and PDF exports match what the screen showed, in all three languages.
5. `scripts/proxy-patch-qa.png` reviewed for all 16 keys × 2 languages × 2
   label states.
6. `docs/ARCHITECTURE.md` §8, §15 and the header date are current; `README.md`
   describes the new behaviour.
