# Proxy Frame Patches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the proxy stamp's stretched cloned-band swatches with patches cropped from the 16 empty card-frame templates, so the copyright / set-name zone is repainted with the frame itself instead of covered by a visible rectangle.

**Architecture:** A one-off Python generator crops each template over a fixed rect plus a 7 px feathered margin and writes 32 small RGBA PNGs (16 keys × {en/es, fr}); the FR variant carries a baked per-channel colour offset because the FR card images come from a different repository. At runtime both the CSS overlay and the canvas baking read one shared rect and one shared label spec from `proxy.js`, so screen and export cannot diverge.

**Tech Stack:** Python 3 + Pillow (generator, offline); React 18 + plain CSS (screen); Canvas 2D (export); Vitest (tests); Vite (build).

**Spec:** [2026-07-28-proxy-frame-patches-design.md](../specs/2026-07-28-proxy-frame-patches-design.md)

## Global Constraints

- Card fraction geometry, one rect for all three image languages. Core (opaque): `x 0.150 → 0.470`, `y 0.9320 → 0.9750`. Margin: `7` px at 570 width. Draw box: `x 0.1377 → 0.4823`, `y 0.9232 → 0.9838`.
- Label text is the literal string `Proxy` in every language (existing `PROXY_LABEL`).
- Label font: **Arial Bold** — `bold <size>px Arial, Helvetica, sans-serif` on canvas, `font-family: Arial, Helvetica, sans-serif` + `font-weight: 700` in CSS. No letter-spacing on either side.
- Label size: `0.0155 × card width`. Label centre: `x 0.310`, `y 0.9565` (fractions of card width/height).
- Label colour: one of exactly two values — `#191919` (dark) or `#F0F0EA` (light).
- Reference card size `570 × 796`. FR card images are `570 × 798`; all geometry is fractional and resolves against each card's own size.
- Asset paths: `/proxy-patches/<key>.png` (en, es) and `/proxy-patches/<key>-fr.png` (fr).
- The 16 keys in `SWATCH_KEYS` and the `swatchKeyForCard` classifier are **unchanged**. Region cards stay unstamped (`null`).
- Commits: conventional-commit prefixes (`feat:`, `refactor:`, `test:`, `docs:`, `chore:`), matching the branch's existing history.
- All commands run from the repo root, `C:\Users\bleyp\Desktop\Claude Projects\meccg`, on Windows PowerShell.

---

### Task 1: Vendor the templates and generate the patch assets

**Files:**
- Create: `assets/card-templates/` (18 PNGs copied from `C:\Users\bleyp\Downloads\_NEW TEMPLATES`)
- Create: `scripts/make_proxy_patches.py`
- Create: `web/public/proxy-patches/*.png` (32 files, generated)
- Create: `scripts/proxy-patch-colors.txt` (generated; the label-colour table for Task 2)
- Create: `test/proxyPatches.test.js`
- Generated but **not** committed: `scripts/proxy-patch-qa.png`

**Interfaces:**
- Consumes: nothing.
- Produces: the 32 PNGs at `web/public/proxy-patches/<key>.png` and `<key>-fr.png`, each `196×48` RGBA; and `scripts/proxy-patch-colors.txt`, one line per key formatted `<key> <#RRGGBB> <mean-luminance>`, which Task 2 transcribes into `PROXY_LABEL_COLOR`.

- [ ] **Step 1: Copy the 18 templates into the repo**

```powershell
New-Item -ItemType Directory -Force "assets\card-templates" | Out-Null
Copy-Item "C:\Users\bleyp\Downloads\_NEW TEMPLATES\*.png" "assets\card-templates\"
(Get-ChildItem "assets\card-templates" -Filter *.png).Count
```

Expected output: `18`

- [ ] **Step 2: Add `.gitignore` entry for the QA sheet**

Append to `.gitignore`:

```
scripts/proxy-patch-qa.png
```

- [ ] **Step 3: Write the failing test**

Create `test/proxyPatches.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SWATCH_KEYS } from '../web/src/lib/proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATCHES = path.join(__dirname, '..', 'web', 'public', 'proxy-patches');

// Minimal PNG header reader: IHDR is always the first chunk, at byte 16.
async function pngInfo(file) {
  const buf = await readFile(file);
  expect(buf.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf.readUInt8(25), // 6 = truecolour with alpha
  };
}

describe('proxy patch assets', () => {
  it('ships one RGBA 196x48 patch per key per language variant', async () => {
    expect(SWATCH_KEYS).toHaveLength(16);
    for (const key of SWATCH_KEYS) {
      for (const name of [`${key}.png`, `${key}-fr.png`]) {
        const info = await pngInfo(path.join(PATCHES, name));
        expect({ name, ...info }).toEqual({ name, width: 196, height: 48, colorType: 6 });
      }
    }
  });
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `npm test -- proxyPatches`

Expected: FAIL — `ENOENT` on `web/public/proxy-patches/hero-character.png`.

- [ ] **Step 5: Write the generator**

Create `scripts/make_proxy_patches.py`:

```python
"""Generate the 32 proxy frame patches from the card-frame templates.

Crops each template over the covered rect plus a feathered margin, so the
copyright / set-name zone can be repainted with the frame itself. Writes:
  web/public/proxy-patches/<key>.png      used for en + es
  web/public/proxy-patches/<key>-fr.png   same crop, tone-shifted to the FR grade
  scripts/proxy-patch-colors.txt          label colour per key (for proxy.js)
  scripts/proxy-patch-qa.png              visual QA sheet (not committed)

Run from the repo root:  python scripts/make_proxy_patches.py
Spec: docs/superpowers/specs/2026-07-28-proxy-frame-patches-design.md
"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEMPLATES = os.path.join(ROOT, 'assets', 'card-templates')
OUT = os.path.join(ROOT, 'web', 'public', 'proxy-patches')
FR_CARDS = os.path.join(ROOT, 'cards', 'fr')
EN_CARDS = os.path.join(ROOT, 'cards', 'remastered-all')
QA = os.path.join(ROOT, 'scripts', 'proxy-patch-qa.png')
COLORS = os.path.join(ROOT, 'scripts', 'proxy-patch-colors.txt')

REF_W, REF_H = 570, 796
CORE = (0.150, 0.9320, 0.470, 0.9750)   # x0, y0, x1, y1 — fully opaque
MARGIN_PX = 7                            # alpha ramp, at REF_W
LABEL_FONT_FRAC = 0.0155
LABEL_CX, LABEL_CY = 0.310, 0.9565
LUM_THRESHOLD = 118
DARK, LIGHT = '#191919', '#F0F0EA'
FR_CLAMP = 40
ARIAL_BOLD = r'C:\Windows\Fonts\arialbd.ttf'

TEMPLATE_BY_KEY = {
    'hero-character': '_CHARACTER HERO.png',
    'minion-character': '_CHARACTER MINION.png',
    'hero-site': '_SITE HERO.png',
    'minion-site': '_SITE MINION.png',
    'balrog-site': '_SITE BALROG.png',
    'fw-site': '_SITE FALLEN WIZARD.png',
    'hero-resource': '_RESOURCE HERO.png',
    'minion-resource': '_RESOURCE MINION.png',
    'stage-resource': '_RESOURCE STAGE.png',
    'hazard': '_HAZARD.png',
    'red': '_RINGWRAITH & BALROG.png',
    'alatar': '_WIZARD ALATAR.png',
    'gandalf': '_WIZARD GANDALF.png',
    'pallando': '_WIZARD PALLANDO.png',
    'radagast': '_WIZARD RADAGAST.png',
    'saruman': '_WIZARD SARUMAN.png',
}

# Per-key crop overrides, if the QA sheet shows a seam for a key. Same shape as
# CORE. Empty until a key needs one (see the spec's Risks section).
OVERRIDES = {}


def boxes(w, h, key):
    """(core, outer, margin) in pixels for a card of size w x h."""
    c = OVERRIDES.get(key, CORE)
    m = round(MARGIN_PX * w / REF_W)
    core = (round(c[0] * w), round(c[1] * h), round(c[2] * w), round(c[3] * h))
    outer = (core[0] - m, core[1] - m, core[2] + m, core[3] + m)
    return core, outer, m


def build_patch(key, w=REF_W, h=REF_H):
    """Template crop over the outer box, with an alpha ramp across the margin."""
    t = Image.open(os.path.join(TEMPLATES, TEMPLATE_BY_KEY[key])).convert('RGBA')
    if t.size != (w, h):
        t = t.resize((w, h), Image.LANCZOS)
    _, outer, m = boxes(w, h, key)
    a = t.crop(outer)
    ow, oh = a.size
    ramp = Image.new('L', (ow, oh), 0)
    dr = ImageDraw.Draw(ramp)
    for i in range(m + 1):
        dr.rectangle([i, i, ow - 1 - i, oh - 1 - i], outline=round(255 * i / m))
    dr.rectangle([m, m, ow - 1 - m, oh - 1 - m], fill=255)
    # The template is already transparent where the frame is cut away (site
    # tears, region bleed); the ramp only ever lowers alpha further, never adds.
    merged = Image.new('L', (ow, oh))
    merged.putdata([min(s, r) for s, r in zip(a.getchannel('A').getdata(), ramp.getdata())])
    a.putalpha(merged)
    return a, outer, m


def fr_offset(key, patch, outer, m):
    """Mean per-channel delta (FR cards - patch) over the margin ring only."""
    cards = []
    for dirpath, _, files in os.walk(FR_CARDS):
        for f in files:
            if f.lower().endswith(('.jpg', '.png')):
                cards.append(os.path.join(dirpath, f))
    keyed = [p for p in cards if _key_of_fr(p) == key][:12]
    if not keyed:
        return (0.0, 0.0, 0.0)
    ow, oh = patch.size
    mask = Image.new('L', (ow, oh), 255)
    ImageDraw.Draw(mask).rectangle([m, m, ow - 1 - m, oh - 1 - m], fill=0)
    pr = patch.convert('RGB')
    acc = [0.0, 0.0, 0.0]
    for p in keyed:
        im = Image.open(p).convert('RGB')
        w, h = im.size
        _, o, mm = boxes(w, h, key)
        band = im.crop(o).resize((ow, oh), Image.LANCZOS)
        for ci in range(3):
            hb = band.split()[ci].histogram(mask)
            hp = pr.split()[ci].histogram(mask)
            n = sum(hb) or 1
            acc[ci] += sum(i * hb[i] for i in range(256)) / n - sum(i * hp[i] for i in range(256)) / n
    return tuple(max(-FR_CLAMP, min(FR_CLAMP, v / len(keyed))) for v in acc)


_FR_INDEX = None


def _key_of_fr(path):
    """Swatch key for an FR image, resolved through cards.json by set+filename."""
    global _FR_INDEX
    if _FR_INDEX is None:
        _FR_INDEX = {}
        with open(os.path.join(ROOT, 'web', 'public', 'cards.json'), encoding='utf-8') as f:
            data = json.load(f)
        for s in data.values():
            if isinstance(s, dict) and 'cards' in s:
                for c in s['cards'].values():
                    rel = (c.get('relativePath') or '').split('/')
                    if len(rel) > 1:
                        _FR_INDEX[(rel[0], os.path.basename('/'.join(rel)))] = swatch_key(c)
    parts = os.path.normpath(path).split(os.sep)
    return _FR_INDEX.get((parts[-2], parts[-1]))


DUAL = {'Tidings of Death': 'minion-resource', 'Deadly Dart': 'minion-resource',
        'Beasts of the Wood': 'hero-resource', 'Wild Hounds': 'hero-resource'}
WIZ = {'alatar', 'gandalf', 'pallando', 'radagast', 'saruman'}
BY_TA = {'Character/Hero': 'hero-character', 'Character/Minion': 'minion-character',
         'Site/Hero': 'hero-site', 'Site/Minion': 'minion-site',
         'Site/Balrog': 'balrog-site', 'Site/Fallen-wizard': 'fw-site',
         'Resource/Hero': 'hero-resource', 'Resource/Minion': 'minion-resource',
         'Resource/Stage': 'stage-resource'}


def swatch_key(c):
    """Mirror of swatchKeyForCard in web/src/lib/proxy.js."""
    if c.get('type') == 'Region':
        return None
    race = (c.get('attributes') or {}).get('race', '')
    if race == 'Ringwraith' or (race == 'Balrog' and c.get('type') == 'Character'):
        return 'red'
    if race in ('Wizard', 'Fallen-wizard'):
        n = (c.get('name') or {}).get('en', '').lower()
        return n if n in WIZ else None
    if c.get('type') == 'Resource' and c.get('alignment') == 'Dual':
        return DUAL.get((c.get('name') or {}).get('en', ''))
    if c.get('type') == 'Hazard':
        return 'hazard'
    return BY_TA.get('%s/%s' % (c.get('type'), c.get('alignment')))


def label_colour(patch, outer):
    """Dark or light, from the mean luminance of the opaque pixels the label covers."""
    f = ImageFont.truetype(ARIAL_BOLD, max(6, round(LABEL_FONT_FRAC * REF_W)))
    probe = ImageDraw.Draw(Image.new('RGB', (1, 1)))
    cx, cy = LABEL_CX * REF_W - outer[0], LABEL_CY * REF_H - outer[1]
    l, t, r, b = probe.textbbox((cx, cy), 'Proxy', font=f, anchor='mm')
    pad = 2
    crop = patch.crop((int(l - pad), int(t - pad), int(r + pad), int(b + pad)))
    rgb, alpha = crop.convert('RGB'), crop.getchannel('A')
    vals = [(p, a) for p, a in zip(rgb.getdata(), alpha.getdata()) if a > 200]
    if len(vals) < (crop.width * crop.height) // 2:
        return LIGHT, 0.0
    lum = sum(0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2] for p, _ in vals) / len(vals)
    return (DARK if lum > LUM_THRESHOLD else LIGHT), lum


def main():
    os.makedirs(OUT, exist_ok=True)
    rows, colours = [], []
    for key in TEMPLATE_BY_KEY:
        patch, outer, m = build_patch(key)
        patch.save(os.path.join(OUT, '%s.png' % key))

        off = fr_offset(key, patch, outer, m)
        chans = [patch.split()[i].point(lambda v, o=off[i]: max(0, min(255, int(round(v + o)))))
                 for i in range(3)]
        Image.merge('RGBA', chans + [patch.getchannel('A')]).save(os.path.join(OUT, '%s-fr.png' % key))

        col, lum = label_colour(patch, outer)
        colours.append((key, col, lum))
        rows.append((key, off))
        print('%-17s size=%dx%d  fr_offset=%s  label=%s (lum %.0f)'
              % (key, patch.width, patch.height, tuple(round(v, 1) for v in off), col, lum))

    with open(COLORS, 'w', encoding='utf-8') as f:
        for key, col, lum in colours:
            f.write('%s %s %.1f\n' % (key, col, lum))
    print('\nlabel colours -> %s' % COLORS)
    _qa()


def _qa():
    """Before/after sheet: every key x {en, fr}, 3x, using a real local card."""
    with open(os.path.join(ROOT, 'web', 'public', 'cards.json'), encoding='utf-8') as f:
        data = json.load(f)
    samples = {}
    for s in data.values():
        if not (isinstance(s, dict) and 'cards' in s):
            continue
        for c in s['cards'].values():
            k = swatch_key(c)
            rel = (c.get('relativePath') or '')
            if not k or k in samples or not rel:
                continue
            en = os.path.join(EN_CARDS, rel.replace('/', os.sep))
            parts = rel.split('/')
            fr = os.path.join(FR_CARDS, parts[0], os.path.basename(rel))
            if os.path.isfile(en):
                samples[k] = (en, fr if os.path.isfile(fr) else None)

    font = ImageFont.truetype(ARIAL_BOLD, 12)
    colours = {}
    with open(COLORS, encoding='utf-8') as f:
        for line in f:
            k, c, _lum = line.split()
            colours[k] = c
    panels = []
    for key in TEMPLATE_BY_KEY:
        en, fr = samples[key]
        for tag, path in (('en', en), ('fr', fr)):
            if not path:
                continue
            card = Image.open(path).convert('RGB')
            w, h = card.size
            suffix = '-fr' if tag == 'fr' else ''
            p = Image.open(os.path.join(OUT, '%s%s.png' % (key, suffix))).convert('RGBA')
            _, outer, _ = boxes(w, h, key)
            p = p.resize((outer[2] - outer[0], outer[3] - outer[1]), Image.LANCZOS)
            after = card.copy()
            after.paste(p, (outer[0], outer[1]), p)
            d = ImageDraw.Draw(after)
            lf = ImageFont.truetype(ARIAL_BOLD, max(6, round(LABEL_FONT_FRAC * w)))
            d.text((LABEL_CX * w, LABEL_CY * h), 'Proxy', font=lf,
                   fill=colours[key], anchor='mm')
            y0, y1, x1 = int(h * 0.925), int(h * 0.99), int(w * 0.62)
            panels.append(('%s / %s' % (key, tag), card.crop((0, y0, x1, y1)), after.crop((0, y0, x1, y1))))

    S = 3
    cw, ch = panels[0][1].width * S, panels[0][1].height * S
    sheet = Image.new('RGB', (cw + 8, (ch * 2 + 30) * len(panels) + 8), (18, 18, 18))
    d = ImageDraw.Draw(sheet)
    y = 4
    for lab, before, after in panels:
        d.text((6, y), lab, font=font, fill=(255, 220, 120))
        sheet.paste(before.resize((cw, ch), Image.LANCZOS), (4, y + 14))
        sheet.paste(after.resize((cw, ch), Image.LANCZOS), (4, y + 14 + ch))
        y += ch * 2 + 30
    sheet.save(QA)
    print('QA sheet -> %s  (%d panels)' % (QA, len(panels)))


if __name__ == '__main__':
    main()
```

- [ ] **Step 6: Run the generator**

Run: `python scripts/make_proxy_patches.py`

Expected: 16 lines of the form `hero-character    size=196x48  fr_offset=(...)  label=#... (lum ...)`, then the colours path and `QA sheet -> ... (32 panels)`.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm test -- proxyPatches`

Expected: PASS — 1 test.

- [ ] **Step 8: Review the QA sheet**

Open `scripts/proxy-patch-qa.png`. For all 32 panels confirm: the copyright / set-name is gone, no patch boundary is visible, the label is legible. If a key fails, add an entry to `OVERRIDES` in the generator, re-run Steps 6–7, and re-check. Do not proceed until every panel passes.

- [ ] **Step 9: Commit**

```bash
git add .gitignore assets/card-templates scripts/make_proxy_patches.py scripts/proxy-patch-colors.txt web/public/proxy-patches test/proxyPatches.test.js
git commit -m "feat: generate proxy frame patches from card templates"
```

---

### Task 2: Rework the shared geometry and label constants

**Files:**
- Modify: `web/src/lib/proxy.js` (replace lines 17–28, the `PROXY_RECT` / `rectForLang` block)
- Modify: `test/proxy.test.js:6` and `test/proxy.test.js:67-84` (the `geometry` describe block)

**Interfaces:**
- Consumes: `scripts/proxy-patch-colors.txt` from Task 1.
- Produces, from `web/src/lib/proxy.js`:
  - `PROXY_PATCH_RECT: { x: number, y: number, w: number, h: number }` — the draw box, fractions of card width/height.
  - `PROXY_LABEL_FONT_FRAC: number` — label font size as a fraction of card width.
  - `PROXY_LABEL_POS: { cx: number, cy: number }` — label centre, fractions of card width/height.
  - `PROXY_LABEL_COLOR: Record<string, string>` — one `#RRGGBB` per key, 16 entries.
  - `PROXY_LABEL_FONT_CQW: number`, `PROXY_LABEL_DY_CQH: number` — the CSS container-query equivalents, derived from the above.
  - `patchUrl(key: string, lang: string): string` — `/proxy-patches/<key>.png`, or `<key>-fr.png` when `lang === 'fr'`.
  - `PROXY_RECT` and `rectForLang` are **removed**.

- [ ] **Step 1: Write the failing test**

In `test/proxy.test.js`, change the import on line 6 to:

```javascript
import {
  swatchKeyForCard, PROXY_PATCH_RECT, PROXY_LABEL, SWATCH_KEYS,
  PROXY_LABEL_COLOR, PROXY_LABEL_FONT_FRAC, PROXY_LABEL_POS,
  PROXY_LABEL_FONT_CQW, PROXY_LABEL_DY_CQH, patchUrl,
} from '../web/src/lib/proxy.js';
```

and replace the whole `describe('geometry', ...)` block (lines 67–84) with:

```javascript
describe('geometry', () => {
  it('exposes one fractional draw rect inside the card', () => {
    const r = PROXY_PATCH_RECT;
    for (const k of ['x', 'y', 'w', 'h']) {
      expect(r[k]).toBeGreaterThan(0);
      expect(r[k]).toBeLessThan(1);
    }
    expect(r.x + r.w).toBeLessThan(1);
    expect(r.y + r.h).toBeLessThanOrEqual(1);
    expect(PROXY_LABEL).toBe('Proxy');
    expect(SWATCH_KEYS).toHaveLength(16);
  });

  it('covers the measured copyright and set-name extents in every language', () => {
    const r = PROXY_PATCH_RECT;
    // en/es "(c)19xx Tolkien Enterprises" and the widest fr set name
    const notices = [
      { x0: 0.165, x1: 0.433, y0: 0.951, y1: 0.971 },
      { x0: 0.172, x1: 0.365, y0: 0.942, y1: 0.957 },
    ];
    for (const n of notices) {
      expect(r.x).toBeLessThan(n.x0);
      expect(r.x + r.w).toBeGreaterThan(n.x1);
      expect(r.y).toBeLessThan(n.y0);
      expect(r.y + r.h).toBeGreaterThan(n.y1);
    }
  });

  it('centres the label horizontally in the draw rect', () => {
    expect(PROXY_LABEL_POS.cx).toBeCloseTo(PROXY_PATCH_RECT.x + PROXY_PATCH_RECT.w / 2, 6);
  });

  it('derives the css container-query units from the rect', () => {
    expect(PROXY_LABEL_FONT_CQW).toBeCloseTo((PROXY_LABEL_FONT_FRAC / PROXY_PATCH_RECT.w) * 100, 6);
    const boxMid = PROXY_PATCH_RECT.y + PROXY_PATCH_RECT.h / 2;
    expect(PROXY_LABEL_DY_CQH).toBeCloseTo(((PROXY_LABEL_POS.cy - boxMid) / PROXY_PATCH_RECT.h) * 100, 6);
  });

  it('gives every key exactly one of the two allowed label colours', () => {
    expect(Object.keys(PROXY_LABEL_COLOR).sort()).toEqual([...SWATCH_KEYS].sort());
    for (const key of SWATCH_KEYS) {
      expect(['#191919', '#F0F0EA']).toContain(PROXY_LABEL_COLOR[key]);
    }
  });

  it('selects the fr patch variant only for fr', () => {
    expect(patchUrl('hazard', 'fr')).toBe('/proxy-patches/hazard-fr.png');
    expect(patchUrl('hazard', 'en')).toBe('/proxy-patches/hazard.png');
    expect(patchUrl('hazard', 'es')).toBe('/proxy-patches/hazard.png');
    expect(patchUrl('hazard', undefined)).toBe('/proxy-patches/hazard.png');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- proxy.test`

Expected: FAIL — `PROXY_PATCH_RECT` is undefined.

- [ ] **Step 3: Replace the geometry block in `proxy.js`**

In `web/src/lib/proxy.js`, replace lines 17–28 (from the `// Covered zone, ...` comment through the closing brace of `rectForLang`) with:

```javascript
// Covered zone, as fractions of card width/height. One rect for en/es/fr: it
// clears both the left-aligned "©19xx Tolkien Enterprises" (en, es) and the
// more-centred French set name. The opaque core is x 0.150–0.470, y 0.932–0.975;
// the rect below adds the 7px-at-570 feathered margin baked into each patch PNG.
// Spec: docs/superpowers/specs/2026-07-28-proxy-frame-patches-design.md
export const PROXY_PATCH_RECT = { x: 0.1377, y: 0.9232, w: 0.3446, h: 0.0606 };

// "Proxy" label: Arial Bold, sized like the card's own
// "Remastérisé - Traduction non officielle" line and sitting on its band.
export const PROXY_LABEL_FONT_FRAC = 0.0155;          // of card width
export const PROXY_LABEL_POS = { cx: 0.310, cy: 0.9565 };

// The same label spec expressed in container-query units, for the CSS overlay
// whose container is the patch box (see .proxy-stamp in styles.css). Derived,
// never hand-tuned, so the DOM and canvas paths cannot drift apart.
export const PROXY_LABEL_FONT_CQW = (PROXY_LABEL_FONT_FRAC / PROXY_PATCH_RECT.w) * 100;
export const PROXY_LABEL_DY_CQH =
  ((PROXY_LABEL_POS.cy - (PROXY_PATCH_RECT.y + PROXY_PATCH_RECT.h / 2)) / PROXY_PATCH_RECT.h) * 100;

// Label colour per key: whichever of the two contrasts with that frame's rail.
// Generated by scripts/make_proxy_patches.py (see scripts/proxy-patch-colors.txt)
// and committed as literals so CSS and canvas render identically.
export const PROXY_LABEL_COLOR = {
  // PASTE HERE — see Step 4
};

// The en/es patch, or the fr variant (the FR card images come from a different
// repository and carry a different colour grade; the offset is baked in).
export function patchUrl(key, lang) {
  return `/proxy-patches/${key}${lang === 'fr' ? '-fr' : ''}.png`;
}
```

- [ ] **Step 4: Fill in `PROXY_LABEL_COLOR` from the generator output**

Read `scripts/proxy-patch-colors.txt`. Each line is `<key> <#RRGGBB> <lum>`. Write one entry per line into the `PROXY_LABEL_COLOR` object, in the `SWATCH_KEYS` order, as:

```javascript
  'hero-character': '#191919',
```

replacing the `// PASTE HERE` comment. There must be exactly 16 entries and every value must be `'#191919'` or `'#F0F0EA'`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- proxy.test`

Expected: PASS — 7 tests.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/proxy.js test/proxy.test.js
git commit -m "refactor: single proxy rect + derived Arial Bold label spec"
```

---

### Task 3: Bake the patch on the canvas export path

**Files:**
- Modify: `web/src/lib/export/proxyDraw.js` (whole file)
- Modify: `web/src/lib/export/bleedCanvas.js:6-8`, `:18`
- Modify: `web/src/api.js:8-9`, `:97-111`

**Interfaces:**
- Consumes: `PROXY_PATCH_RECT`, `PROXY_LABEL`, `PROXY_LABEL_FONT_FRAC`, `PROXY_LABEL_POS`, `PROXY_LABEL_COLOR`, `patchUrl` from Task 2.
- Produces:
  - `drawProxyOnFace(ctx, w, h, patchBmp, key)` — note the 5th parameter is now the **key** (needed for the colour), not the lang.
  - `loadPatchBitmaps(keys: Iterable<string>, lang: string): Promise<Map<string, ImageBitmap|null>>`
  - `closePatchBitmaps(bitmaps: Map<string, ImageBitmap|null>): void`
  - The stamp object passed through `bleedCanvas` becomes `{ patchBmp, key }`.

- [ ] **Step 1: Rewrite `proxyDraw.js`**

Replace the whole of `web/src/lib/export/proxyDraw.js` with:

```javascript
import {
  PROXY_PATCH_RECT, PROXY_LABEL, PROXY_LABEL_FONT_FRAC,
  PROXY_LABEL_POS, PROXY_LABEL_COLOR, patchUrl,
} from '../proxy.js';

// Bake the proxy stamp into a cut-size face: the frame patch drawn over the
// copyright / set-name zone, "Proxy" in Arial Bold on top. Browser-only
// (canvas 2d ctx). If the patch bitmap is missing, fill with the average of the
// pixels already under the rect — proxy mode must never leave the notice visible.
export function drawProxyOnFace(ctx, w, h, patchBmp, key) {
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
  ctx.fillStyle = PROXY_LABEL_COLOR[key] || '#F0F0EA';
  ctx.font = `bold ${Math.round(PROXY_LABEL_FONT_FRAC * w)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(PROXY_LABEL, PROXY_LABEL_POS.cx * w, PROXY_LABEL_POS.cy * h);
}

// Fetch + decode the patch PNGs once per export, in the export's image language.
// A failed patch maps to null so drawProxyOnFace falls back to the averaged fill.
export async function loadPatchBitmaps(keys, lang) {
  const out = new Map();
  await Promise.all([...keys].map(async (key) => {
    try {
      const res = await fetch(patchUrl(key, lang));
      if (!res.ok) throw new Error(String(res.status));
      out.set(key, await createImageBitmap(await res.blob()));
    } catch {
      out.set(key, null);
    }
  }));
  return out;
}

// Free the decoded patch bitmaps once an export has consumed them.
export function closePatchBitmaps(bitmaps) {
  for (const bmp of bitmaps.values()) if (bmp) bmp.close();
}
```

- [ ] **Step 2: Update `bleedCanvas.js`**

Change line 7 (the comment) and line 18:

```javascript
// the proxy stamp baked in. stamp = { patchBmp, key } | null.
```

```javascript
  if (stamp) drawProxyOnFace(fctx, CARD_W_CUT, CARD_H_CUT, stamp.patchBmp, stamp.key);
```

- [ ] **Step 3: Update `api.js`**

Change line 9:

```javascript
import { loadPatchBitmaps, closePatchBitmaps } from './lib/export/proxyDraw.js';
```

Replace lines 97–111 with:

```javascript
// (card) => { patchBmp, key } | null. Null when proxy mode is off or the card
// takes no stamp (Regions). Loads only the patches this deck needs, in the
// export's image language. Returns { stampFor, closePatches } so callers can
// free the bitmaps after export.
async function makeStampFor(cards, lang, proxyMode) {
  if (!proxyMode) return { stampFor: () => null, closePatches: () => {} };
  const keys = new Set(cards.map(swatchKeyForCard).filter(Boolean));
  const patches = await loadPatchBitmaps(keys, lang);
  return {
    stampFor: (card) => {
      const key = swatchKeyForCard(card);
      return key ? { patchBmp: patches.get(key), key } : null;
    },
    closePatches: () => closePatchBitmaps(patches),
  };
}
```

- [ ] **Step 4: Rename the destructured `closeSwatches` at both call sites**

In `web/src/api.js`, replace `closeSwatches` with `closePatches` on lines 117, 126, 134 and 152 (two `const { stampFor, closeSwatches } = ...` declarations and their two `closeSwatches();` calls in the `finally` blocks).

- [ ] **Step 5: Verify no stale identifiers remain**

```powershell
Get-ChildItem web\src -Recurse -Include *.js,*.jsx | Select-String -Pattern "swatchBmp|loadSwatchBitmaps|closeSwatchBitmaps|closeSwatches"
```

Expected: no output.

```powershell
Get-ChildItem web\src -Recurse -Include *.js,*.jsx | Select-String -Pattern "rectForLang"
```

Expected: hits in `web\src\components\CardPreview.jsx` only — that file is Task 4's job.

- [ ] **Step 6: Run the tests and the build**

Run: `npm test`

Expected: PASS — all suites.

Run: `npm run build`

Expected: `✓ built in ...`, no unresolved-import errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/export/proxyDraw.js web/src/lib/export/bleedCanvas.js web/src/api.js
git commit -m "feat: bake frame patches into the canvas export path"
```

---

### Task 4: Switch the on-screen overlay to the patch

**Files:**
- Modify: `web/src/components/ProxyStamp.jsx` (whole file)
- Modify: `web/src/components/CardPreview.jsx:3`, `:51-65`
- Modify: `web/src/styles.css:180-198`

**Interfaces:**
- Consumes: `PROXY_PATCH_RECT`, `PROXY_LABEL`, `PROXY_LABEL_COLOR`, `PROXY_LABEL_FONT_CQW`, `PROXY_LABEL_DY_CQH`, `patchUrl`, `swatchKeyForCard` from Task 2.
- Produces: no new exports. `<ProxyStamp card lang on />` keeps its props.

- [ ] **Step 1: Rewrite `ProxyStamp.jsx`**

Replace the whole of `web/src/components/ProxyStamp.jsx` with:

```jsx
import React from 'react';
import {
  swatchKeyForCard, PROXY_PATCH_RECT, PROXY_LABEL, PROXY_LABEL_COLOR,
  PROXY_LABEL_FONT_CQW, PROXY_LABEL_DY_CQH, patchUrl,
} from '../lib/proxy.js';

const pct = (f) => `${f * 100}%`;

// CSS overlay repainting the copyright / set-name zone with the card frame's own
// patch, plus the "Proxy" label. Must live inside a positioned wrapper that
// matches the card image bounds exactly. The label scales with the box via cqw
// and is nudged onto the reference band via cqh (see .proxy-stamp in styles.css).
// Renders nothing when off or for cards without a stamp (Regions).
export default function ProxyStamp({ card, lang, on }) {
  if (!on) return null;
  const key = swatchKeyForCard(card);
  if (!key) return null;
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
        backgroundImage: `url(${patchUrl(key, lang)})`,
      }}
    >
      <span
        style={{
          color: PROXY_LABEL_COLOR[key],
          fontSize: `${PROXY_LABEL_FONT_CQW}cqw`,
          transform: `translateY(${PROXY_LABEL_DY_CQH}cqh)`,
        }}
      >
        {PROXY_LABEL}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Update the imperative hover preview**

In `web/src/components/CardPreview.jsx`, change line 3 to:

```javascript
import {
  swatchKeyForCard, PROXY_PATCH_RECT, PROXY_LABEL, PROXY_LABEL_COLOR,
  PROXY_LABEL_FONT_CQW, PROXY_LABEL_DY_CQH, patchUrl,
} from '../lib/proxy.js';
```

and replace lines 51–65 (the `const stamp = stampRef.current;` block) with:

```javascript
    const stamp = stampRef.current;
    if (stamp) {
      const key = proxyOn ? swatchKeyForCard(c) : null;
      if (key) {
        const r = PROXY_PATCH_RECT;
        stamp.style.left = `${r.x * 100}%`;
        stamp.style.top = `${r.y * 100}%`;
        stamp.style.width = `${r.w * 100}%`;
        stamp.style.height = `${r.h * 100}%`;
        stamp.style.backgroundImage = `url(${patchUrl(key, lang)})`;
        const span = stamp.firstElementChild;
        if (span) {
          span.textContent = PROXY_LABEL;
          span.style.color = PROXY_LABEL_COLOR[key];
          span.style.fontSize = `${PROXY_LABEL_FONT_CQW}cqw`;
          span.style.transform = `translateY(${PROXY_LABEL_DY_CQH}cqh)`;
        }
        stamp.style.display = 'flex';
      } else {
        stamp.style.display = 'none';
      }
    }
```

- [ ] **Step 3: Give the imperative stamp a span to fill**

In `web/src/components/CardPreview.jsx` line 117, the preview stamp div is currently empty. Change it to:

```jsx
      <div className="proxy-stamp" ref={stampRef} style={{ display: 'none' }}><span /></div>
```

- [ ] **Step 4: Update the CSS**

In `web/src/styles.css`, replace lines 180–198 with:

```css
/* Proxy-mode overlay: the card frame's own patch repainted over the copyright
   zone, plus "Proxy". Positioned in % of the card box; the label's size, colour
   and vertical nudge come from proxy.js as inline styles so the DOM and the
   canvas export stay identical. */
.proxy-stamp {
  position: absolute;
  background-size: 100% 100%;
  container-type: size;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  z-index: 2;
}
.proxy-stamp span {
  font-family: Arial, Helvetica, sans-serif;
  font-weight: 700;
  line-height: 1;
}
```

- [ ] **Step 5: Verify no stale identifiers remain**

```powershell
Get-ChildItem web\src -Recurse -Include *.js,*.jsx | Select-String -Pattern "proxy-swatches|rectForLang|PROXY_RECT"
```

Expected: no output.

- [ ] **Step 6: Run the tests and the build**

Run: `npm test`

Expected: PASS — all suites.

Run: `npm run build`

Expected: `✓ built in ...`, no errors.

- [ ] **Step 7: Verify in the running app**

Start the dev server with the `preview_start` tooling — never with a raw shell command. If `.claude/launch.json` has no entry yet, create one named `dev` with `runtimeExecutable: "npm"`, `runtimeArgs: ["run", "dev"]`, `port: 5173`. With Mode Proxy ON, for image language FR then EN then ES, check on a browsed card, a hovered card, a deck-panel card and the preview modal that the notice is covered, no patch boundary shows, and `Proxy` is legible. Toggle Mode Proxy OFF and confirm the stamp disappears everywhere.

Capture a screenshot of the browser grid with the stamp on.

- [ ] **Step 8: Commit**

```bash
git add web/src/components/ProxyStamp.jsx web/src/components/CardPreview.jsx web/src/styles.css
git commit -m "feat: repaint the on-screen proxy zone with the frame patch"
```

---

### Task 5: Retire the swatch assets and document the change

**Files:**
- Delete: `web/public/proxy-swatches/` (16 PNGs)
- Delete: `scripts/make_proxy_swatches.py`
- Delete: `scripts/swatch-qa.png` if present, and its `.gitignore` entry if present
- Modify: `README.md` (the proxy-mode paragraph)

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Confirm nothing references the old assets**

```powershell
Get-ChildItem web\src, test, scripts, README.md -Recurse -Include *.js,*.jsx,*.py,*.md, README.md | Select-String -Pattern "proxy-swatches|make_proxy_swatches|SWATCH"
```

Expected: only `SWATCH_KEYS` hits, in `web\src\lib\proxy.js`, `test\proxy.test.js` and `test\proxyPatches.test.js`. Any `proxy-swatches` or `make_proxy_swatches` hit must be fixed before deleting.

- [ ] **Step 2: Delete the old assets and generator**

```powershell
Remove-Item -Recurse -Force "web\public\proxy-swatches"
Remove-Item -Force "scripts\make_proxy_swatches.py"
if (Test-Path "scripts\swatch-qa.png") { Remove-Item -Force "scripts\swatch-qa.png" }
```

If `.gitignore` contains a `scripts/swatch-qa.png` line, remove that line.

- [ ] **Step 3: Update the README**

In `README.md`, replace lines 77–82 (the body of the `### Mode Proxy` section) with:

```markdown
L'interrupteur **« Proxy »** (à côté du sélecteur de langues, **activé par défaut**) efface la
mention « ©19xx Tolkien Enterprises » — ou le nom d'extension sur les cartes FR — en **repeignant
la zone avec le cadre vierge du type de carte**, puis écrit « Proxy » par-dessus en Arial Bold.
C'est une exigence de MPC pour les cartes proxy. Les 16 cadres sources sont dans
`assets/card-templates/` ; les 32 patchs de `web/public/proxy-patches/` s'en régénèrent avec
`python scripts/make_proxy_patches.py`. Les cartes FR utilisent la variante `-fr` (leurs images
viennent d'une autre source, à la colorimétrie différente). Le tampon apparaît **à l'écran et dans
les exports ZIP/PDF** ; désactive l'interrupteur pour retrouver les images d'origine. Les cartes
**Région** et les **dos** ne sont jamais tamponnés.
```

- [ ] **Step 4: Run the full verification**

Run: `npm test`

Expected: PASS — all suites, including `proxyPatches`.

Run: `npm run build`

Expected: `✓ built in ...`, no missing-asset warnings.

- [ ] **Step 5: Verify both exports end to end**

In the running app with Mode Proxy ON, build a small deck (at least one Character, one Site, one Hazard, one wizard avatar and one Region). Export the MPC ZIP and the PDF, once with image language `fr` and once with `en`. Open one front PNG from each ZIP and each PDF and confirm the notice is covered, the patch is seamless, `Proxy` reads correctly, and the Region card is untouched.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: retire the proxy swatch assets and document frame patches"
```

---

## Notes for the implementer

- **`container-type: size` is required** on `.proxy-stamp` for `cqw`/`cqh` to resolve; it is already there. `PROXY_LABEL_FONT_CQW` is a percentage of the *patch box width*, not the card width — that conversion is exactly what `proxy.js` derives.
- **Do not hand-edit the numbers in `PROXY_LABEL_COLOR`.** They come from the generator. If a colour looks wrong on the QA sheet, change `LUM_THRESHOLD` or add an `OVERRIDES` entry in the generator and re-run it.
- **`drawProxyOnFace`'s 5th argument changed meaning** from `lang` to `key`. The language is now resolved when the bitmaps are *loaded*, not when they are drawn.
- The averaged-fill fallback in `drawProxyOnFace` is deliberately kept: a missing patch must still hide the copyright, even if it looks worse.
