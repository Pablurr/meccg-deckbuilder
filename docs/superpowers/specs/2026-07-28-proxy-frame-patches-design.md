# Proxy stamp — frame patches — Design

Date: 2026-07-28
Status: Approved
Supersedes: the *Assets* and *Geometry* sections of
[2026-07-23-proxy-card-stamp-design.md](2026-07-23-proxy-card-stamp-design.md)

## Goal

Replace the proxy stamp's covering asset. The branch currently hides the
copyright / set-name notice under a **band segment cloned from a real card and
stretched** over a small rect — a flat patch that reads as a rectangle on every
card. We now have the **16 empty card frames** as PNG templates, so the notice
can be covered by **the frame itself, reconstructed**: the covered zone is
repainted with the same pixels the frame would have if nothing had been printed
there.

Everything else about proxy mode is unchanged: the global "Mode Proxy" toggle,
the classifier, where the stamp is applied (on-screen + ZIP + PDF), and the
non-goals of the July spec all still hold.

## Background (measured this session)

All figures measured on the local corpus (`cards/remastered-all`, `cards/fr`)
plus two ES cards fetched from the CDN.

- **The templates are the EN/ES remaster frames.** Template PNGs are
  **570×796 RGBA** — the exact size of the source card images. Mean absolute
  per-channel difference between a template and a card of the matching key, over
  a pure-frame window, is **1.28 overall across 132 EN cards** — ≤0.6 for 13 of
  the 16 keys — and **0.08** on the two ES cards checked. The crop therefore
  re-registers pixel-perfectly: rail lines, rivets, the corner shield and the
  torn parchment edge of sites all continue across the seam.
  Two keys sit above that floor: `hero-site` at **11.21** (identical on all 12
  cards sampled, so a systematic difference in that one frame, not per-card
  noise) and `pallando` at **5.11**. Both are candidates for a per-key crop
  override if the QA sheet shows a seam.
- **The FR images are not the same frames.** They come from a different
  repository (`DavRupprecht/meccg-fr`), are **570×798**, and differ from the
  templates by a mean absolute difference of **26.08** per channel (per-key means
  **21–36**, n=132). This is a colour-grade/hue difference, not a registration
  error: a per-pixel offset search finds the optimum at **dy = 0** (fraction
  mapping is correct despite the 2 px height difference), and fitting a
  per-channel gain+offset over the covered rect does **not** reduce the error
  (19.28 → 19.78 mean). This corrects the July spec's claim that the three image
  languages share the same frames.
- **Site frames are card-independent.** The torn parchment edge is identical
  across five different Site/Hero cards and matches `_SITE HERO.png` in shape.
  There is no per-card variation to preserve — the `hero-site` residual above is
  systematic to the frame, not variation between cards.
- **Region cards have no frame in the covered zone.** Both region templates are
  transparent at the bottom-left (the map art bleeds through), and region cards
  carry no copyright line there. They stay unstamped.
- **Text extents** (fractions of card width/height). Measured by locating glyph
  strokes through per-column local contrast, over 24 EN and 35 FR cards. A
  card-vs-template difference is **not** a usable detector here: it fires on the
  card-specific `Art by …` line, and on FR cards it fires everywhere.

  | Notice | x | y | |
  |---|---|---|---|
  | `©19xx Tolkien Enterprises` (en, es) | 0.1632 – 0.4246 | 0.951 – 0.971 | must be covered |
  | FR set name (`Contre l'Ombre`, `L'Œil de Sauron`, …) | 0.1789 – 0.3561 | 0.942 – 0.957 | must be covered |
  | FR `Remastérisé - Traduction non officielle` | starts **0.4684** | 0.952 – 0.961 | must **not** be touched |

  The ES notice is the same string at the same place as EN, confirming that one
  rect can serve all three languages.

  The third row is the binding constraint on the right-hand side and the one
  this design nearly got wrong: the patch must end in the 0.0438-wide (25 px)
  gap between the end of the copyright and the start of the French remaster
  credit. Beware the four site frames when measuring — the bright torn parchment
  edge sits at ≈0.4526 and reads as a glyph to a naive detector, which is what
  first suggested a false 9 px window.
- **Reference text metrics.** `Remastérisé - Traduction non officielle` has a cap
  height of ≈6.2 px at 570 width, i.e. a font size of **≈0.0155 × card width**.
- **Export scaling.** Fronts are scaled to a 750×1050 cut size (822×1122 with
  bleed, 300 DPI). The patch is upscaled by the same 1.32 factor as the card it
  sits on, so it stays exactly as sharp as its surroundings. No higher-resolution
  source exists — the templates are 570 wide, like the cards.

## Design

### Assets

`assets/card-templates/` — the 18 source template PNGs, committed. Two are the
region templates: unused by the generator, kept for provenance so a future
recalibration does not depend on a local Downloads folder.

`scripts/make_proxy_patches.py` (replaces `make_proxy_swatches.py`) writes
`web/public/proxy-patches/`:

- `<key>.png` — 16 files, used for **en** and **es**. The template cropped over
  the draw box (below), carrying the template's own alpha, with a 7 px alpha ramp
  applied inward from each edge. **179×48 px RGBA.**
- `<key>-fr.png` — 16 files, used for **fr**. Same crop, with a per-channel
  constant added to R/G/B before writing. The constant is the mean difference
  between the FR cards of that key and the template, measured over the margin
  ring only (never over the covered text), averaged across every FR card of that
  key present in `cards/fr`, and clamped to ±40 per channel.

Computing the FR correction offline rather than at runtime keeps the on-screen
CSS overlay and the canvas baking byte-identical, costs nothing per card, and
suits the static-CDN deployment.

The generator also writes `scripts/proxy-patch-qa.png` (not committed): every key
× {en, fr}, before/after, at 3× — the artefact the calibration is signed off on.

`web/public/proxy-swatches/` and `scripts/make_proxy_swatches.py` are deleted.

### Geometry

One rect for all three languages. `PROXY_RECT.enes` / `PROXY_RECT.fr` and
`rectForLang()` are removed.

```
core   x 0.150 → 0.440   y 0.9320 → 0.9750    (fully opaque; covers the notice)
margin 7 px at 570 width = 0.01228 w, 0.00879 h   (alpha ramp 0 → 1)
draw   x 0.1377 → 0.4523  y 0.9232 → 0.9838   (the box the asset is drawn into)
```

Clearance between the core and the nearest text: **0.013 left** (≈8 px),
**0.015 right** (≈9 px), **0.010 top** (≈8 px), **0.004 bottom** (≈3 px); and
between the *outer* edge and the French remaster credit it must not touch,
**0.016** (≈9 px). The bottom is the tight edge; 0.975 was verified to erase the
notice cleanly on every key in the calibration renders, and the margin ramp lies
outside the core so the core itself stays fully opaque. Its left edge sits at
0.150, just left of the notice and just right
of the site/character number shield (right edge ≈0.159) — and because the
template carries the same empty shield, overlapping it is invisible anyway.

The margin is what makes the seam disappear. Without it the patch reads as a
rectangle on FR cards even after tone correction; with it, no boundary is
visible on any of the 16 keys in either language.

Fractions are resolved against each card's own pixel size, which handles the
570×798 FR images correctly (verified: dy = 0 is optimal).

### Label

`Proxy`, **Arial Bold** (`bold <size>px Arial, Helvetica, sans-serif` on canvas;
`font-weight: 700` + the same stack in CSS).

- Size: **0.0155 × card width** — matching `Remastérisé - Traduction non
  officielle`.
- Position: centred at **x = 0.295** (the core's horizontal centre),
  **y = 0.9565** (the vertical centre of the reference text's band).
- Colour: a **frozen per-key constant**, `#191919` or `#F0F0EA`, in a
  `PROXY_LABEL_COLOR` table in `proxy.js`. The generator picks each value from
  the mean luminance under the label's own footprint (threshold 118) and prints
  the table for review; the reviewed values are then committed as literals so CSS
  and canvas can never diverge.

Centring is deliberate and is the one departure from a left-aligned notice: the
bottom-left corner of the four site frames is torn away (transparent), so a
left-aligned label lands on the card art or on black and becomes illegible. The
core's centre is opaque frame on all 16 keys.

### Code changes

| File | Change |
|---|---|
| `web/src/lib/proxy.js` | Drop `PROXY_RECT` / `rectForLang`; add `PROXY_PATCH_RECT` (the draw box), `PROXY_LABEL_FONT_FRAC`, `PROXY_LABEL_POS`, `PROXY_LABEL_COLOR`. Add `patchUrl(key, lang)` → `/proxy-patches/<key>[-fr].png`. `swatchKeyForCard` unchanged. |
| `web/src/components/ProxyStamp.jsx` | Position by `PROXY_PATCH_RECT`; `background-size: 100% 100%`; label in Arial Bold at the per-key colour. |
| `web/src/lib/export/proxyDraw.js` | `drawProxyOnFace` draws the patch bitmap into the draw box and the label in `bold`. Keep the averaged-fill fallback for a missing bitmap. `loadSwatchBitmaps` → `loadPatchBitmaps(keys, lang)`. |
| `web/src/api.js`, `web/src/lib/export/bleedCanvas.js` | Pass `lang` when loading patches; rename swatch → patch. |
| `test/proxy.test.js` | Drop the `rectForLang` cases; assert the single rect, the per-key colour table completeness (16 entries), and `patchUrl` language selection. Classifier tests unchanged. |
| `README.md` | Update the proxy-mode paragraph: frame patches, not cloned bands. |

## Non-goals

Everything listed in the July spec still applies. Additionally:

- No runtime colour matching. The FR correction is baked into the FR asset set.
- No region stamping, and no third asset variant for the `enOriginal` /
  `esOriginal` images (not selectable in the UI).
- No attempt to cover the bottom-right `Remaster 20xx` / `Remastérisé…` text.
- No per-card patch selection. 16 keys × 2 languages is the whole library.

## Verification

1. `scripts/make_proxy_patches.py` runs clean and emits 32 PNGs plus the QA sheet.
2. Visual QA on `scripts/proxy-patch-qa.png`: for all 16 keys in both en and fr,
   the notice is gone, no patch boundary is visible, and the label is legible.
   Per-key overrides are added to the generator only if a key fails this.
3. `npm test` passes.
4. In the running app, toggling Mode Proxy on a browsed card, the deck panel and
   the preview modal shows/removes the stamp in all three languages.
5. A ZIP export and a PDF export each opened and checked on one card per key
   group — the baked front matches what the screen showed.

## Risks

- **The label colour table is calibrated by eye.** Mitigated by freezing it as
  literals under test (16 entries, each one of two allowed values) and by the QA
  sheet being the sign-off artefact.
- **FR frames may drift** if the upstream FR repository re-renders its cards. The
  correction is a committed constant, so a drift would show as a faint tone step;
  regenerating the assets fixes it.
- **`hero-site` and `pallando`** are the two keys whose template does not match
  the EN cards to the sub-unit level the others reach (11.21 and 5.11 mean abs
  difference). The margin ramp should absorb it; if the QA sheet shows a seam,
  the fix is a per-key crop override in the generator, not a change to the shared
  geometry.
- **`stage-resource` in FR** has a genuinely different frame gradient (teal in FR
  vs a pink cast in the template), which the constant offset only partly
  reconciles. Accepted: with the margin ramp the residue is not visible at card
  size. If it proves objectionable, that one key gets a hand-tuned offset.
