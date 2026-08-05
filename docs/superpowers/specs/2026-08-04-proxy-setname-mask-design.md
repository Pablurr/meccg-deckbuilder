# Proxy stamp — always-on EN/ES copyright mask — Design

Date: 2026-08-04
Status: Draft
Builds on: [2026-07-28-proxy-frame-patches-design.md](2026-07-28-proxy-frame-patches-design.md)
(frame patches, geometry — still in force; **`PROXY_LABEL_COLOR`'s generation
method is replaced by this design, see Data below**)

## Goal

Today the copyright-zone mask (patch + label) only appears when the "Mode
Proxy" checkbox is on, in all three image languages. For **en** and **es**
this needs to become the *default* appearance: the mask should always cover
the `©19xx Tolkien Enterprises` notice, whether or not the checkbox is
checked, because that notice should never be shown regardless of proxy
intent.

- **fr is unchanged.** The checkbox keeps gating the stamp exactly as today;
  label stays `"Proxy"`.
- **en/es**: the mask (patch background + label) renders **unconditionally**
  for any card that has a swatch key. The label text and colour depend on the
  checkbox:
  - checkbox **off** (new default) → the card's own set's **official
    translated name**, read straight from `cards.json` (`setNames[card.setCode][lang]`,
    via the existing `setName()` in [lang.js](../../../web/src/lib/lang.js)) —
    e.g. "Against the Shadow" / "Contra la Sombra" for `AS`.
  - checkbox **on** → unchanged, `"Proxy"`.
- Regions still take no swatch key → never stamped. No change to that
  fail-safe.
- **One shared table for both label kinds.** `"Proxy"` and the translated set
  name are the same visual object — a small caption over the frame — so they
  use exactly the same font, size and per-key colour. Concretely, the real
  FR-sampled colour this design introduces for the set name (see Background)
  becomes the *only* `PROXY_LABEL_COLOR` table; the old synthetic
  contrast-pick method is retired, not kept as a second table. There is one
  set of label variables, and `"Proxy"` vs. the set name is just which string
  gets drawn into it.

Geometry, the 32 patch PNGs, and the `-fr` tone offset are **all unchanged**
— see Background below for why.

## Background (measured this session)

- **The current rect already fits every translated set name at the current
  font size.** Measured with the real Arial Bold metrics at ref width 570,
  rect width 179 px: the longest of the seven official names,
  `Servidores de la Oscuridad` (es, set DM), comes out to **124 px** — every
  other set name is shorter. No geometry change is needed; `PROXY_PATCH_RECT`
  stays exactly as defined by the July design.
- **The FR set name and the FR "Remastérisé…" credit share one font size on
  the real card** — confirmed visually on `cards/fr/as/Burat.jpg`: `Contre
  l'Ombre` (bottom-left) and `Remastérisé - Traduction non officielle`
  (bottom-right) are printed in the same font, weight and size. That is
  exactly the size `PROXY_LABEL_FONT_FRAC` (0.0155 × card width) was
  calibrated against in the July design, so it applies unchanged to the new
  set-name label too. No new font-size constant.
- **The FR set-name text colour is not the same as today's `PROXY_LABEL_COLOR`.**
  The existing table is a synthetic high-contrast black/white pick (mean
  luminance of the *patch* under the label footprint, threshold 118) — it was
  never meant to reproduce a real printed colour. Sampling the actual glyph
  pixels of `Contre l'Ombre` on that same card (threshold on luminance vs.
  local background, real photographed text) gives `#B3ACB5` — a muted light
  lavender-grey, visibly different from the synthetic `#F0F0EA`. Per the
  unification above, this real-sampled value **replaces** the synthetic one
  in `PROXY_LABEL_COLOR` for that key, for both label kinds — it is not a
  second table alongside the old one.
- **Official translated set names already exist in `cards.json`**, one row
  per set (`AS`, `BA`, `DM`, `LE`, `TD`, `TW`, `WH`), each with `en`/`es`/`fr`
  filled. The app already parses and threads this data
  (`collectSetNames` in [parseCards.js](../../../web/src/lib/parseCards.js),
  `setName()` in [lang.js](../../../web/src/lib/lang.js)) for the set filter
  — this feature is a new consumer of an existing table, not new data.
- **`card.setCode`** (not `card.set`) is the field carrying the set id on a
  parsed card object (see `flattenCards`).

## Design

### Data — `proxy.js`

- `PROXY_LABEL_COLOR` (16 keys → hex) is **regenerated** in place — same
  name, same shape, new values and a new source (real FR pixels instead of
  patch-luminance contrast; see *Tooling*). No second table.
- New pure helper, replacing the three call sites that currently hardcode
  `PROXY_LABEL` / `PROXY_LABEL_COLOR[key]`:

  ```js
  // null when the card takes no stamp at all under the given mode.
  export function proxyStampFor(card, lang, proxyMode, setNames) {
    const key = swatchKeyForCard(card);
    if (!key) return null;
    if (lang === 'fr' && !proxyMode) return null;
    const text = proxyMode ? PROXY_LABEL : setName(setNames, card.setCode, lang);
    return { key, text, color: PROXY_LABEL_COLOR[key] };
  }
  ```

  (`setName` imported from `lib/lang.js`; falls back to the bare set code if
  a set is ever missing a name, same fallback the set filter already relies
  on. `PROXY_LABEL_FONT_FRAC` and `PROXY_LABEL_POS` are untouched and apply
  to both label kinds, as already established in Background.)

- `patchUrl(key, lang)` unchanged — the background patch image (en/es plain,
  fr tone-shifted) doesn't depend on checkbox state.

### Rendering — three call sites, must stay identical

| Path | File | Change |
|---|---|---|
| CSS overlay (card grid, deck panel) | [ProxyStamp.jsx](../../../web/src/components/ProxyStamp.jsx) | `on` prop replaced by calling `proxyStampFor`; renders nothing when it returns `null`; label text/colour come from the result instead of the `PROXY_LABEL`/`PROXY_LABEL_COLOR` constants. |
| Imperative hover preview | [CardPreview.jsx](../../../web/src/components/CardPreview.jsx) (`useCardPreview`) | Same switch — this is a second, hand-written DOM path that must not drift from `ProxyStamp.jsx`. |
| Canvas export (ZIP/PDF) | [proxyDraw.js](../../../web/src/lib/export/proxyDraw.js) | `drawProxyOnFace(ctx, w, h, patchBmp, key, text, color)` takes text/colour as params instead of hardcoding them. |

All three need `lang`, `proxyMode`, and `setNames` in scope, and just call
`proxyStampFor` once.

### Export pipeline — `api.js`

- `makeStampFor(cards, lang, proxyMode, setNames)`: the early return changes
  from *"skip everything when `!proxyMode`"* to *"skip only when `lang ===
  'fr' && !proxyMode'"*. For en/es, patches load unconditionally now.
- `stampFor(card)` returns `{ patchBmp, key, text, color } | null` via
  `proxyStampFor`.
- `_setNames` cached at module scope in `getCards()`, mirroring the existing
  `_index` pattern — `exportDeck`/`exportPdf` don't currently receive
  `setNames` as a param and don't need to start now.
- [bleedCanvas.js](../../../web/src/lib/export/bleedCanvas.js): its
  `drawProxyOnFace(fctx, ..., stamp.patchBmp, stamp.key)` call adds
  `stamp.text, stamp.color`.

### Prop threading — `setNames`

`setNames` is loaded once in `App.jsx` and already reaches `FilterBar` and
`DeckPanel`. It does **not** yet reach `CardBrowser` → `MiniCard`, or
`CardPreviewModal`, both of which render `ProxyStamp`. Threading needed:

- `App.jsx` → `CardBrowser` → `MiniCard` (and `CardBrowser`'s own
  `useCardPreview` call) → `ProxyStamp`
- `App.jsx` → `CardPreviewModal` → `ProxyStamp`
- `DeckPanel` already receives `setNames`; thread it into its own
  `useCardPreview` call and its `MiniCard`s.

`ExportDialog.jsx` does not need `setNames` — the export functions in
`api.js` resolve it internally.

### Tooling — `scripts/make_proxy_patches.py`

`label_colour()`'s patch-luminance contrast pick is **removed** and replaced
by real-pixel sampling, under the same function name:

- For each of the up to 12 sampled FR cards per key (same corpus walk and cap
  `fr_offset` already uses), crop the known set-name text region, isolate
  glyph pixels from the parchment/frame background by luminance deviation
  against the local per-card background, and average the surviving pixels'
  RGB across all sampled cards for that key.
- Written to `scripts/proxy-patch-colors.txt` (same file, new content —
  contrast source replaced, format unchanged: `key #RRGGBB`), and the
  reviewed values pasted as literals into `PROXY_LABEL_COLOR` in `proxy.js`
  — same "generate once, freeze as literals" discipline as before, for the
  same reason: CSS and canvas must never be able to diverge at runtime.
- `_qa()` sheet extended to render, per key, both label states side by side —
  `"Proxy"` and a representative real set name, both in the new colour — so
  the sign-off artefact is also where the legibility risk below gets caught.

### Non-goals

- No change to `PROXY_PATCH_RECT`, the 32 patch PNGs, or the FR tone offset.
- No change to fr behaviour in any way.
- No per-set font-size tuning — one shared `PROXY_LABEL_FONT_FRAC` for every
  set name, validated to fit all seven.
- No stamping of Regions (unchanged fail-safe).
- No new UI: the existing "Mode Proxy" checkbox is reused as-is; its meaning
  for en/es shifts from "show/hide the mask" to "Proxy label vs. set-name
  label", which is a behavioural change but not a new control.

## Verification

1. `scripts/make_proxy_patches.py` runs clean, regenerates
   `proxy-patch-colors.txt` with the new real-sampled values, and the
   regenerated QA sheet shows all 16 keys in both label states (`"Proxy"`
   and a real set name) with no visible patch seam and legible text at the
   new colour.
2. `npm test` passes, including new `proxy.test.js` cases: `fr` requires
   `proxyMode`; `en`/`es` are stamped regardless of `proxyMode`; the label
   text switches between `PROXY_LABEL` and the official translated set name;
   Regions stay `null` in every combination.
3. In the running app: with Mode Proxy off, browsing an en or es card shows
   the translated set name over the copyright zone; switching to fr shows the
   real copyright (unchanged); checking Mode Proxy switches en/es back to
   "Proxy" and fr on.
4. A ZIP export and a PDF export, each with Mode Proxy off and image
   language en or es, open with the translated set name baked into the
   front — not the real copyright, not blank.

## Risks

- **A real-sampled colour is not contrast-guaranteed the way the retired
  synthetic pick was.** The old `label_colour()` deliberately chose whichever
  of two fixed values (near-black / near-white) maximised contrast against
  each patch, precisely to guarantee "Proxy" stays legible on all 16
  backgrounds. The new colour is instead whatever the real FR print happened
  to use at that spot — legible there because FR cards carry their own
  distinct tone grade, but not derived from, or guaranteed against, the
  en/es patch backgrounds it will now also sit on for both label kinds. If
  the QA sheet shows a low-contrast key, that key gets a manual override in
  the colours file (same escape hatch the July design already uses for
  frame-mismatch keys like `hero-site`/`pallando`) rather than a fallback to
  the old synthetic method.
- **Text-colour sampling is noisier than a synthetic pick** — it's reading
  real photographed glyphs, not a computed fill. Mitigated the same way the
  July design mitigated the FR tone offset: average over up to 12 cards per
  key, cap the outlier influence, and gate the final numbers on the QA sheet
  before committing them as literals.
- **A set added later without translated names** would fall back to the
  bare set code as the label (same fallback `setLabel`/`setName` already use
  for the set filter) — acceptable, matches existing behaviour elsewhere in
  the app rather than inventing a new failure mode.
