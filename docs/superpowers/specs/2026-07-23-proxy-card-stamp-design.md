# Proxy Card stamp — Design

Date: 2026-07-23
Status: Approved

## Goal

Cover the copyright / set-name notice at the bottom-left of each card and replace
it with the label **"Proxy"**, so that decks exported to **MPC (MakePlayingCards)**
pass its proxy requirement (no copyright symbol, no trademark). The replacement
must **blend into the card frame**: the covering patch has the colour and texture
of the bottom border rail, which differs by card type (hero, minion, sites,
resources, hazard) and per avatar.

A single global **"Mode Proxy"** toggle (ON by default) applies the stamp
everywhere — on-screen and in both exports — and turning it off removes it
completely (the way to get the untouched cards back, including for FR).

The three image languages share the **same frames**, so one swatch set covers
en + es + fr; only the horizontal position of the covered zone differs (see
Geometry).

## Non-goals (YAGNI)

- No per-language toggle. The single global toggle is the only control; OFF
  removes every stamp (that is the "remove it" affordance, incl. FR).
- No content-aware / self-clone rendering. A fixed 16-swatch library is used
  (chosen over cloning for lower on-screen cost and full visual control).
- No stamping of card **backs** or **Region** cards.
- No stamping of the `enOriginal` / `esOriginal` variants (not selectable in the
  UI; out of scope). The stamp targets the default en/es remaster + fr.
- No covering of the bottom-right "Remaster 20xx" / "Remastérisé…" text — only the
  bottom-left copyright / set-name zone.
- No new swatches for `Resource/Dual` or per-Ringwraith colours — they reuse
  existing swatches (see Classifier).

## Background (verified facts)

- Source card image: **570×796** px. Export pipeline scales to cut **750×1050**,
  then adds bleed → **822×1122** @ 300 DPI ([constants.js](web/src/lib/constants.js)).
- The copyright sits in the **bottom border rail**, which is textured and coloured
  per card type — a flat black or flat colour would not blend. Measured band
  colours confirm strong variation (minion purple, hero copper, hazard charcoal,
  avatars each distinct).
- **en/es** show `©19xx Tolkien Enterprises` **left-aligned** (~x 0.10→0.46).
- **fr** (DavRupprecht repo) has **no copyright**; the bottom-left instead shows
  the **French set name** ("Les Sorciers", "La Main Blanche", "Contre l'Ombre"…),
  positioned **more centred** (~x 0.28→0.56), length varies by set. Frames/backgrounds
  are otherwise identical to en/es.
- Data has **no `Avatar` type**; avatars are `Character` cards identified by
  `race` / name. Verified against all 1683 cards.
- Verified per-card facts: each wizard's frame is **identical** in its Wizard
  (TW) and Fallen-wizard (WH) version; the 9 Ringwraiths **and** The Balrog share
  **one identical red** frame; `Site/Fallen-wizard` (4) have their **own** frame;
  `Resource/Dual` (4) reuse minion/hero resource frames by name.

## Component 1 — Classifier & geometry (`web/src/lib/proxy.js`)

Pure, IO-free, unit-tested. Exports:

### `swatchKeyForCard(card)` → key `string` | `null`

Resolution order (first match wins):

1. `type === "Region"` → **`null`** (no stamp).
2. `race === "Ringwraith"` **or** (`race === "Balrog"` **and** `type === "Character"`)
   → **`red`**.
   *(Guard verified: only BA-3 "The Balrog" has `race === "Balrog"`; the 22
   `Site/Balrog` have empty race and fall through to `balrog-site`.)*
3. `race ∈ {"Wizard", "Fallen-wizard"}` → the English name lowercased, one of
   **`alatar`, `gandalf`, `pallando`, `radagast`, `saruman`**.
4. `type === "Resource"` **and** `alignment === "Dual"` → by English name:
   `Tidings of Death`, `Deadly Dart` → **`minion-resource`**;
   `Beasts of the Wood`, `Wild Hounds` → **`hero-resource`**.
5. otherwise by `(type, alignment)` → one of the 10 type keys:
   - `Character/Hero` → `hero-character`
   - `Character/Minion` → `minion-character`
   - `Site/Hero` → `hero-site`
   - `Site/Minion` → `minion-site`
   - `Site/Balrog` → `balrog-site`
   - `Site/Fallen-wizard` → `fw-site`
   - `Resource/Hero` → `hero-resource`
   - `Resource/Minion` → `minion-resource`
   - `Resource/Stage` → `stage-resource`
   - `Hazard/*` → `hazard`

A card that matches none of the above (should not happen) returns `null` and is
left unstamped (fail-safe, never a wrong stamp).

### `PROXY_RECT` — covered-zone geometry, fractional (0–1) of card W/H

Two rectangles, one per image-language group, over the **same** swatch set:

- `PROXY_RECT.enes` = `{ x, y, w, h }` covering the left-aligned copyright.
- `PROXY_RECT.fr`   = `{ x, y, w, h }` covering the more-centred set name (wider).

Exact fractions are **calibrated visually** during implementation (start points:
`enes ≈ {x:0.095, y:0.953, w:0.375, h:0.034}`, `fr ≈ {x:0.255, y:0.953, w:0.325, h:0.034}`),
verified to fully cover the widest string per group across all sets.

Helper `rectForLang(lang)` returns `fr` for `lang === 'fr'`, else `enes`.

### `PROXY_LABEL = "Proxy"` — same word for all languages.

## Component 2 — Swatch library (static assets)

**16 PNGs** in `web/public/proxy-swatches/<key>.png`:

`hero-character, minion-character, hero-site, minion-site, balrog-site, fw-site,
hero-resource, minion-resource, stage-resource, hazard, red, alatar, gandalf,
pallando, radagast, saruman`.

- Each swatch is a **clean horizontal segment of that type's bottom-rail band**,
  cropped from a representative card in the local `cards/remastered-all/` set,
  sized to comfortably fill the covered rectangle (band is ~horizontally uniform,
  so one crop covers either language rectangle).
- Generated **once** by a build/one-off script (`scripts/` or a `test`-adjacent
  node script) listing one source card + crop box per key, then **manual visual
  QA**. Assets are committed; the game is discontinued, so the set is stable.
- Same 16 assets serve **en + es + fr** (identical frames).

## Component 3 — Two renderers, one geometry

Both consume `swatchKeyForCard`, `rectForLang`, and `PROXY_LABEL`; neither owns
its own copy of the geometry.

### On-screen — CSS, fluid (`<ProxyStamp card lang />`)

- New React component rendered **inside the positioned wrapper** of each card
  `<img>`: card grid ([CardBrowser.jsx](web/src/components/CardBrowser.jsx)),
  modal ([CardPreviewModal.jsx](web/src/components/CardPreviewModal.jsx)), hover
  preview ([CardPreview.jsx](web/src/components/CardPreview.jsx)), and deck panel
  ([DeckPanel.jsx](web/src/components/DeckPanel.jsx)).
- Renders nothing when `proxyMode` is off or `swatchKeyForCard(card) === null`.
- A `<div>` positioned with the rect as `%` (`left/top/width/height`), with
  `background-image: url(/proxy-swatches/<key>.png)` and `background-size: 100% 100%`,
  containing a centred `<span>Proxy</span>` styled to read like the native muted
  copyright text (light grey, small).
- Wrappers that are not already positioned get `position: relative` added.
- Cost: the 16 swatches are browser-cached and reused across all cells → negligible
  even with hundreds of cards. No canvas, no pixel reads.

### Export — canvas, pixel-baked (`drawProxyOnFace`)

- New routine `drawProxyOnFace(ctx, w, h, swatchBmp, lang)`: `drawImage` the swatch
  into `rectForLang(lang)` scaled to `w,h`, then `fillText("Proxy")` centred in the
  rect (muted colour, matched size).
- **ZIP** ([bleedCanvas.js](web/src/lib/export/bleedCanvas.js) `toMpcPng`): applied
  on the cut-size face **before** the bleed step, **fronts only**. `toMpcPng` gains
  an optional stamp descriptor `{ swatchBmp, lang }`; backs pass nothing.
- **PDF** ([pdf.js](web/src/lib/export/pdf.js) via
  [api.js](web/src/api.js) `exportPdf`): when `proxyMode` is on, fronts are baked
  to a stamped cut-size face PNG (reusing `drawProxyOnFace`) instead of passing raw
  bytes; when off, current raw-bytes path is unchanged.
- Swatch bitmaps are loaded once per export and cached (`createImageBitmap` of the
  fetched swatch PNGs), keyed by swatch key.
- **Never** stamps backs or `null`-key (Region) cards.

## Component 4 — Global state (`proxyMode`)

- Boolean, **default ON**, persisted in `localStorage` (e.g. key `meccg.proxyMode`).
- Exposed via a small React context (or lifted App state) consumed by the card
  components and the export dialog; read by `api.exportDeck` / `api.exportPdf`
  through the export call (passed as a param, not read globally in the lib layer).
- A toggle control in the UI, placed **next to the language selector**, flips it.
  OFF ⇒ no stamp anywhere (screen + both exports), which is the affordance to
  recover original cards, including FR.

## Data flow

```
card ──swatchKeyForCard──> key|null
                              │ null → no stamp (Region/back)
                              ▼
        proxyMode ON ?  ──no──> no stamp
              │ yes
              ▼
  screen: <ProxyStamp> div  (bg = /proxy-swatches/key.png, rect = rectForLang(lang)) + "Proxy"
  export: drawProxyOnFace(ctx,w,h, swatchBmp[key], lang)  on cut face, fronts only
```

## Error handling / edge cases

- Missing/failed swatch image on screen: `background-image` simply fails to paint;
  the `<span>Proxy</span>` still covers the text region on an empty box (acceptable,
  non-fatal). On export: if a swatch bitmap fails to load, skip the swatch fill but
  still draw "Proxy" over a neutral fill sampled from the rect — never leave the
  copyright visible when proxyMode is on.
- Unknown `(type, alignment)` combination → `null` → unstamped (fail-safe).
- Backs and Regions: always unstamped by construction.
- FR set-name longer than the rect: the FR rect is sized to the widest observed set
  name; verified during calibration.

## Testing

- **Unit** ([test/proxy.test.js](test/proxy.test.js)): run `swatchKeyForCard` over
  **all 1683 cards** — asserts every card returns a valid key or `null`, never throws.
  Targeted assertions: `TW-156`→`gandalf`, `WH-4`→`gandalf` (wizard==fallen),
  `LE-50`→`red`, `TW-181`/`WH-9`→`saruman`, `BA-3`→`red`, a `Site/Balrog`→`balrog-site`,
  `WH-55`→`fw-site`, `LE-245`→`minion-resource`, `WH-38`→`hero-resource`,
  a `Region`→`null`.
- **Visual** (browser preview): with proxyMode ON, verify the stamp blends on each
  type + the 3 languages, on screen / ZIP / PDF; verify backs and Region cards are
  untouched; verify the toggle OFF removes everything.

## Files

- New: `web/src/lib/proxy.js`, `web/src/components/ProxyStamp.jsx`,
  `web/public/proxy-swatches/*.png` (16), a one-off swatch-generation script,
  `test/proxy.test.js`.
- Edited: `web/src/lib/export/bleedCanvas.js` (stamp param), `web/src/lib/export/pdf.js`
  + `web/src/api.js` (bake fronts when on, thread `proxyMode`),
  `web/src/components/CardBrowser.jsx` / `CardPreviewModal.jsx` / `CardPreview.jsx` /
  `DeckPanel.jsx` (render `<ProxyStamp>`, positioned wrappers), the export dialog +
  app shell (toggle + state), CSS for the stamp.
