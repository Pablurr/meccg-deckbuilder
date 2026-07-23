# Proxy Card Stamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cover the bottom-left copyright (en/es) / set-name (fr) on card images with a texture-matched "Proxy" label, on screen and in ZIP/PDF exports, behind a global toggle (ON by default) next to the language selector.

**Architecture:** A pure classifier (`swatchKeyForCard`) maps each card to one of 16 swatch textures (or `null` for Regions); shared fractional geometry (`PROXY_RECT`) positions the covered zone per image language (en/es vs fr). Two renderers consume them: a CSS overlay component on screen (negligible cost) and a canvas routine baked into export pixels (ZIP fronts before bleed; PDF fronts as stamped JPEG). Spec: `docs/superpowers/specs/2026-07-23-proxy-card-stamp-design.md`.

**Tech Stack:** React 18 + Vite (existing), Canvas API, vitest, Python/Pillow (one-off swatch generation).

## Global Constraints

- The stamp label is exactly `Proxy` in all three languages.
- Never stamp: card **backs**, `type === "Region"` cards, cards whose classifier returns `null`.
- `proxyMode` default is **ON**; persisted under localStorage key `meccg.proxyMode`; OFF removes every stamp (screen + ZIP + PDF).
- Toggle UI sits **next to the language selector** (`LangLink`, in `.filterbar-top`).
- Swatch assets: exactly 16 PNGs in `web/public/proxy-swatches/`, keys: `hero-character, minion-character, hero-site, minion-site, balrog-site, fw-site, hero-resource, minion-resource, stage-resource, hazard, red, alatar, gandalf, pallando, radagast, saruman`.
- When proxyMode is ON and a swatch bitmap fails to load at export, fill the rect with the average colour of the pixels already under it — never leave the notice visible.
- When proxyMode is OFF, the export pipelines must behave byte-for-byte as today (PDF keeps embedding raw CDN bytes).
- Run all commands from the repo root `C:\Users\bleyp\Desktop\Claude Projects\meccg`. Tests: `npm test` (vitest, files in `test/`).
- Work happens on the existing branch `proxy-card-stamp`.

---

### Task 1: Classifier & geometry module (`proxy.js`)

**Files:**
- Create: `web/src/lib/proxy.js`
- Test: `test/proxy.test.js`

**Interfaces:**
- Consumes: flattened card shape from `web/src/lib/parseCards.js` (`{ id, type, alignment, name: {en,...}, attributes: {race,...} }`).
- Produces (later tasks rely on these exact names):
  - `swatchKeyForCard(card)` → `string | null`
  - `PROXY_RECT` = `{ enes: {x,y,w,h}, fr: {x,y,w,h} }` (fractions 0–1 of card width/height)
  - `rectForLang(lang)` → one of the two rects (`fr` iff `lang === 'fr'`)
  - `PROXY_LABEL` = `'Proxy'`
  - `SWATCH_KEYS` = array of the 16 valid keys

- [ ] **Step 1: Write the failing test**

Create `test/proxy.test.js` (mirrors `test/parseCards.test.js` conventions — loads the real `cards.json`, flattens it):

```js
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { flattenCards } from '../web/src/lib/parseCards.js';
import { swatchKeyForCard, rectForLang, PROXY_RECT, PROXY_LABEL, SWATCH_KEYS } from '../web/src/lib/proxy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARDS_JSON = path.join(__dirname, '..', 'web', 'public', 'cards.json');

async function loadCards() {
  return flattenCards(JSON.parse(await readFile(CARDS_JSON, 'utf-8')));
}

describe('swatchKeyForCard', () => {
  it('classifies every card as a valid key or null, never throws', async () => {
    const cards = await loadCards();
    expect(cards.length).toBe(1683);
    const valid = new Set(SWATCH_KEYS);
    for (const c of cards) {
      const key = swatchKeyForCard(c);
      if (c.type === 'Region') expect(key).toBeNull();
      else expect(key === null || valid.has(key)).toBe(true);
    }
    // every non-Region card must get a stamp (no silent null gaps)
    const unstamped = cards.filter((c) => c.type !== 'Region' && swatchKeyForCard(c) === null);
    expect(unstamped.map((c) => c.id)).toEqual([]);
  });

  it('classifies the verified reference cards', async () => {
    const cards = await loadCards();
    const byId = new Map(cards.map((c) => [c.id, c]));
    const key = (id) => swatchKeyForCard(byId.get(id));
    // wizards: TW frame == WH (fallen) frame
    expect(key('TW-156')).toBe('gandalf');
    expect(key('WH-4')).toBe('gandalf');
    expect(key('TW-181')).toBe('saruman');
    expect(key('WH-9')).toBe('saruman');
    expect(key('TW-117')).toBe('alatar');
    expect(key('TW-175')).toBe('pallando');
    expect(key('TW-178')).toBe('radagast');
    // ringwraiths + the Balrog character share one red frame
    expect(key('LE-50')).toBe('red');
    expect(key('LE-58')).toBe('red');
    expect(key('BA-3')).toBe('red');
    // sites: the 22 Site/Balrog must NOT be red
    const balrogSite = cards.find((c) => c.type === 'Site' && c.alignment === 'Balrog');
    expect(swatchKeyForCard(balrogSite)).toBe('balrog-site');
    expect(key('WH-55')).toBe('fw-site');
    // dual resources are mapped by name
    expect(key('LE-245')).toBe('minion-resource'); // Tidings of Death
    expect(key('LE-419')).toBe('minion-resource'); // Deadly Dart
    expect(key('WH-38')).toBe('hero-resource');    // Beasts of the Wood
    expect(key('WH-40')).toBe('hero-resource');    // Wild Hounds
    // the 10 plain type keys
    expect(key('AS-1')).toBe('minion-character');  // Bûrat
    expect(key('BA-1')).toBe('hero-character');    // Strider
    const stage = cards.find((c) => c.type === 'Resource' && c.alignment === 'Stage');
    expect(swatchKeyForCard(stage)).toBe('stage-resource');
    const hazard = cards.find((c) => c.type === 'Hazard');
    expect(swatchKeyForCard(hazard)).toBe('hazard');
    const region = cards.find((c) => c.type === 'Region');
    expect(swatchKeyForCard(region)).toBeNull();
  });
});

describe('geometry', () => {
  it('exposes sane fractional rects and label', () => {
    for (const r of [PROXY_RECT.enes, PROXY_RECT.fr]) {
      for (const k of ['x', 'y', 'w', 'h']) {
        expect(r[k]).toBeGreaterThan(0);
        expect(r[k]).toBeLessThan(1);
      }
      expect(r.x + r.w).toBeLessThan(1);
      expect(r.y + r.h).toBeLessThanOrEqual(1);
    }
    expect(rectForLang('fr')).toBe(PROXY_RECT.fr);
    expect(rectForLang('en')).toBe(PROXY_RECT.enes);
    expect(rectForLang('es')).toBe(PROXY_RECT.enes);
    expect(rectForLang(undefined)).toBe(PROXY_RECT.enes);
    expect(PROXY_LABEL).toBe('Proxy');
    expect(SWATCH_KEYS).toHaveLength(16);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/proxy.test.js`
Expected: FAIL — `Cannot find module '../web/src/lib/proxy.js'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `web/src/lib/proxy.js`:

```js
// Proxy-stamp classification & geometry. Pure data + functions, no IO.
// Maps each card to one of 16 swatch textures (the band segment matching the
// card frame's colour) and positions the covered copyright / set-name zone.
// Spec: docs/superpowers/specs/2026-07-23-proxy-card-stamp-design.md

export const PROXY_LABEL = 'Proxy';

export const SWATCH_KEYS = [
  'hero-character', 'minion-character',
  'hero-site', 'minion-site', 'balrog-site', 'fw-site',
  'hero-resource', 'minion-resource', 'stage-resource',
  'hazard',
  'red',
  'alatar', 'gandalf', 'pallando', 'radagast', 'saruman',
];

// Covered zone, as fractions of card width/height. en/es show the left-aligned
// "©19xx Tolkien Enterprises"; fr shows the more-centred French set name.
// Values calibrated visually (final task) — keep both rects in sync with the
// CSS overlay and the canvas baking, which both read them from here.
export const PROXY_RECT = {
  enes: { x: 0.095, y: 0.953, w: 0.375, h: 0.034 },
  fr: { x: 0.255, y: 0.953, w: 0.325, h: 0.034 },
};

export function rectForLang(lang) {
  return lang === 'fr' ? PROXY_RECT.fr : PROXY_RECT.enes;
}

// The four Resource/Dual cards reuse the minion/hero resource frame by name.
const DUAL_BY_NAME = {
  'Tidings of Death': 'minion-resource',
  'Deadly Dart': 'minion-resource',
  'Beasts of the Wood': 'hero-resource',
  'Wild Hounds': 'hero-resource',
};

const WIZARD_NAMES = new Set(['alatar', 'gandalf', 'pallando', 'radagast', 'saruman']);

const BY_TYPE_ALIGNMENT = {
  'Character/Hero': 'hero-character',
  'Character/Minion': 'minion-character',
  'Site/Hero': 'hero-site',
  'Site/Minion': 'minion-site',
  'Site/Balrog': 'balrog-site',
  'Site/Fallen-wizard': 'fw-site',
  'Resource/Hero': 'hero-resource',
  'Resource/Minion': 'minion-resource',
  'Resource/Stage': 'stage-resource',
};

// One of the 16 swatch keys, or null for Regions / unknown combinations
// (null = leave the card unstamped; fail-safe, never a wrong stamp).
export function swatchKeyForCard(card) {
  if (!card || card.type === 'Region') return null;
  const race = (card.attributes && card.attributes.race) || '';
  // The 9 Ringwraiths and The Balrog (BA-3) share one identical red frame.
  // The type guard keeps the 22 Site/Balrog on their own balrog-site frame.
  if (race === 'Ringwraith' || (race === 'Balrog' && card.type === 'Character')) return 'red';
  // Each wizard's frame is identical in its Wizard and Fallen-wizard version.
  if (race === 'Wizard' || race === 'Fallen-wizard') {
    const name = ((card.name && card.name.en) || '').toLowerCase();
    if (WIZARD_NAMES.has(name)) return name;
  }
  if (card.type === 'Resource' && card.alignment === 'Dual') {
    return DUAL_BY_NAME[(card.name && card.name.en) || ''] || null;
  }
  if (card.type === 'Hazard') return 'hazard';
  return BY_TYPE_ALIGNMENT[`${card.type}/${card.alignment}`] || null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- test/proxy.test.js`
Expected: PASS (3 tests). If the full-scan test reports unstamped ids, inspect those cards' `type`/`alignment` and extend `BY_TYPE_ALIGNMENT` accordingly — do not loosen the assertion.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: all existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/proxy.js test/proxy.test.js
git commit -m "feat: proxy-stamp classifier and shared geometry"
```

---

### Task 2: Swatch assets (16 PNGs + generation script)

**Files:**
- Create: `scripts/make_proxy_swatches.py`
- Create: `web/public/proxy-swatches/<key>.png` × 16 (script output, committed)

**Interfaces:**
- Consumes: local card images `cards/remastered-all/**` + `web/public/cards.json` (paths resolved via each card's `relativePath`).
- Produces: `web/public/proxy-swatches/{hero-character,minion-character,hero-site,minion-site,balrog-site,fw-site,hero-resource,minion-resource,stage-resource,hazard,red,alatar,gandalf,pallando,radagast,saruman}.png` — small band-texture crops that later tasks stretch over the covered rect.

- [ ] **Step 1: Write the generation script**

Create `scripts/make_proxy_swatches.py`:

```python
"""One-off generator for the 16 proxy-stamp swatches.

Crops a clean segment of the bottom border rail (between the copyright and the
"Remaster 20xx" text) from a representative local card per swatch key, and
writes web/public/proxy-swatches/<key>.png. Also writes scripts/swatch-qa.png,
a labeled montage for visual QA (not committed).

Run from the repo root:  python scripts/make_proxy_swatches.py
"""
import json
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGES = os.path.join(ROOT, 'cards', 'remastered-all')
OUT = os.path.join(ROOT, 'web', 'public', 'proxy-swatches')
QA = os.path.join(ROOT, 'scripts', 'swatch-qa.png')

# Clean band segment: x between the copyright (ends ~0.46) and "Remaster"
# (starts ~0.65); y spanning the rail. Per-key overrides allowed below.
CROP = (0.48, 0.952, 0.62, 0.986)

def _race(c):
    return (c.get('attributes') or {}).get('race', '')

def _name(c):
    return (c.get('name') or {}).get('en', '')

# key -> predicate over the raw cards.json card dict. The script picks the
# FIRST matching card whose local image file exists.
PREDICATES = {
    'hero-character':   lambda c: c['type'] == 'Character' and c['alignment'] == 'Hero' and _race(c) not in ('Wizard',),
    'minion-character': lambda c: c['type'] == 'Character' and c['alignment'] == 'Minion' and _race(c) != 'Ringwraith',
    'hero-site':        lambda c: c['type'] == 'Site' and c['alignment'] == 'Hero',
    'minion-site':      lambda c: c['type'] == 'Site' and c['alignment'] == 'Minion',
    'balrog-site':      lambda c: c['type'] == 'Site' and c['alignment'] == 'Balrog',
    'fw-site':          lambda c: c['type'] == 'Site' and c['alignment'] == 'Fallen-wizard',
    'hero-resource':    lambda c: c['type'] == 'Resource' and c['alignment'] == 'Hero',
    'minion-resource':  lambda c: c['type'] == 'Resource' and c['alignment'] == 'Minion',
    'stage-resource':   lambda c: c['type'] == 'Resource' and c['alignment'] == 'Stage',
    'hazard':           lambda c: c['type'] == 'Hazard',
    'red':              lambda c: _race(c) == 'Ringwraith' or (_race(c) == 'Balrog' and c['type'] == 'Character'),
    'alatar':           lambda c: _race(c) == 'Wizard' and _name(c) == 'Alatar',
    'gandalf':          lambda c: _race(c) == 'Wizard' and _name(c) == 'Gandalf',
    'pallando':         lambda c: _race(c) == 'Wizard' and _name(c) == 'Pallando',
    'radagast':         lambda c: _race(c) == 'Wizard' and _name(c) == 'Radagast',
    'saruman':          lambda c: _race(c) == 'Wizard' and _name(c) == 'Saruman',
}

def load_cards():
    with open(os.path.join(ROOT, 'web', 'public', 'cards.json'), encoding='utf-8') as f:
        data = json.load(f)
    out = []
    for set_obj in data.values():
        if isinstance(set_obj, dict) and 'cards' in set_obj:
            out.extend(set_obj['cards'].values())
    return out

def main():
    os.makedirs(OUT, exist_ok=True)
    cards = load_cards()
    swatches = []
    for key, pred in PREDICATES.items():
        path = None
        chosen = None
        for c in cards:
            if not pred(c):
                continue
            p = os.path.join(IMAGES, (c.get('relativePath') or '').replace('/', os.sep))
            if os.path.isfile(p):
                path, chosen = p, c
                break
        if not path:
            raise SystemExit(f'no local image found for swatch key {key!r}')
        im = Image.open(path).convert('RGB')
        w, h = im.size
        x0, y0, x1, y1 = CROP
        crop = im.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))
        crop.save(os.path.join(OUT, f'{key}.png'))
        swatches.append((key, _name(chosen), crop))
        print(f'{key:16s} <- {chosen["id"]:8s} {_name(chosen)}')

    # QA montage: 4x-scaled swatches with labels, one per row.
    scale = 4
    roww = max(s.width for _, _, s in swatches) * scale + 260
    rowh = max(s.height for _, _, s in swatches) * scale + 8
    canvas = Image.new('RGB', (roww, rowh * len(swatches)), (24, 24, 24))
    draw = ImageDraw.Draw(canvas)
    for i, (key, name, s) in enumerate(swatches):
        big = s.resize((s.width * scale, s.height * scale), Image.NEAREST)
        canvas.paste(big, (250, i * rowh + 4))
        draw.text((8, i * rowh + rowh // 2 - 6), f'{key} ({name})', fill=(220, 220, 210))
    canvas.save(QA)
    print(f'QA montage: {QA}')

if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run the script**

Run: `python scripts/make_proxy_swatches.py`
Expected: 16 lines `key <- CARD-ID Name`, then `QA montage: ...scripts/swatch-qa.png`. Verify: `ls web/public/proxy-swatches` lists exactly 16 PNGs.

- [ ] **Step 3: Visual QA of the montage**

Read `scripts/swatch-qa.png` (image view). Check each row: pure band texture — **no letters or fragments** of "©", "Tolkien", "Remaster", no rivet/screw circles dominating, and the expected colour per key (minion purple, hero copper/bronze, hazard charcoal, red for `red`, distinct grey/blue/brown for each wizard, stone for `fw-site`). If a row shows text or a decoration, add a per-key crop override to the script, e.g. change `CROP` handling to `crop_box = OVERRIDES.get(key, CROP)` with an `OVERRIDES = {'hazard': (0.50, 0.952, 0.60, 0.986)}` dict, re-run, re-check.

- [ ] **Step 4: Delete the QA montage and commit**

```bash
rm scripts/swatch-qa.png
git add scripts/make_proxy_swatches.py web/public/proxy-swatches
git commit -m "feat: 16 proxy-stamp swatch textures + generation script"
```

---

### Task 3: Global proxyMode state + toggle next to the language selector

**Files:**
- Modify: `web/src/App.jsx` (state at ~line 34, props at lines 130, 132, 134–148, 152–167, 196–206, 208–215)
- Modify: `web/src/components/FilterBar.jsx` (toggle component; props at line 48; render at line 102)
- Modify: `web/src/lib/i18n.js` (two new keys in both `fr` and `en` blocks)
- Modify: `web/src/styles.css` (toggle placement)

**Interfaces:**
- Consumes: nothing from earlier tasks (pure UI state).
- Produces: `proxyMode` boolean prop threaded to `FilterBar`, `CardBrowser`, `DeckPanel` (both instances), `CardPreviewModal`, `ExportDialog`; `onProxyChange(bool)` on FilterBar. localStorage key `meccg.proxyMode` (`'1'`/`'0'`).

- [ ] **Step 1: Add persisted state in App.jsx**

In `web/src/App.jsx`, after line 34 (`const [previewCard, setPreviewCard] = useState(null);`), add:

```js
  // Proxy mode: cover the copyright/set-name with a "Proxy" stamp everywhere
  // (screen + exports). ON by default; persisted so the choice sticks.
  const [proxyMode, setProxyMode] = useState(() => {
    try { return localStorage.getItem('meccg.proxyMode') !== '0'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('meccg.proxyMode', proxyMode ? '1' : '0'); } catch { /* storage unavailable */ }
  }, [proxyMode]);
```

- [ ] **Step 2: Thread the prop through App.jsx**

Still in `App.jsx`:
- Line 130: `<FilterBar ... isMobile={isMobile} proxyMode={proxyMode} onProxyChange={setProxyMode} />`
- Line 132: `<CardBrowser ... onPreview={setPreviewCard} proxyMode={proxyMode} />`
- Desktop `DeckPanel` (lines 134–148): add `proxyMode={proxyMode}` alongside the existing props.
- Mobile sheet `DeckPanel` (lines 152–167): add `proxyMode={proxyMode}`.
- `ExportDialog` (lines 197–206): add `proxyMode={proxyMode}`.
- `CardPreviewModal` (lines 209–215): add `proxyMode={proxyMode}`.

(`CardBrowser`, `DeckPanel`, `CardPreviewModal`, `ExportDialog` accept-and-ignore the new prop until Tasks 4–6 use it — harmless in the meantime.)

- [ ] **Step 3: Add the toggle in FilterBar.jsx**

In `web/src/components/FilterBar.jsx`, after the `LangLink` component (line 46), add:

```jsx
// Proxy-mode switch: stamps "Proxy" over the copyright on every card shown and
// exported. Sits beside the language selector on the logo row.
function ProxyToggle({ on, onChange }) {
  const t = useT();
  return (
    <label className={`chip-toggle proxy-toggle ${on ? 'on' : ''}`} title={t('proxy.tooltip')} style={{ cursor: 'pointer' }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      {' '}{t('proxy.label')}
    </label>
  );
}
```

Change the signature (line 48) to:

```jsx
export default function FilterBar({ facets, filters, onChange, lang, onLangChange, isMobile, proxyMode, onProxyChange }) {
```

And at line 102, render the toggle just before the language selector:

```jsx
        <ProxyToggle on={proxyMode} onChange={onProxyChange} />
        <LangLink lang={lang} onLangChange={onLangChange} />
```

- [ ] **Step 4: Add i18n keys**

In `web/src/lib/i18n.js`, add to the **fr** block (after `'filter.filters': 'Filtres',` line 32):

```js
    // Proxy mode
    'proxy.label': 'Proxy',
    'proxy.tooltip': 'Mode Proxy : recouvre le copyright par « Proxy » (requis pour MPC)',
```

And to the **en** block (after `'filter.reset': 'reset',` line 153):

```js
    // Proxy mode
    'proxy.label': 'Proxy',
    'proxy.tooltip': 'Proxy mode: covers the copyright with "Proxy" (required by MPC)',
```

- [ ] **Step 5: Place the toggle in styles.css**

`.lang-link` currently pushes itself right with `margin-left: auto` (line 55: `.filterbar-top .lang-link { margin-left: auto; }`). With the toggle inserted before it, move the auto margin to the toggle so the pair sits together on the right. Replace line 55 with:

```css
.filterbar-top .proxy-toggle { margin-left: auto; margin-right: 10px; flex: 0 0 auto; }
.filterbar-top .lang-link { margin-left: 0; }
```

- [ ] **Step 6: Verify in the browser**

Start the dev server (preview tools, launch config `dev` → `vite`, port 5173) and check:
- The « Proxy » chip sits left of the FR/EN/ES language links, checked/highlighted by default.
- Clicking it toggles the `on` style; reload the page → the choice persisted (localStorage `meccg.proxyMode`).
- Mobile width (375px): the toggle stays usable on the top row.
Expected: no console errors; nothing else changed visually.

- [ ] **Step 7: Run the suite and commit**

Run: `npm test` → all PASS.

```bash
git add web/src/App.jsx web/src/components/FilterBar.jsx web/src/lib/i18n.js web/src/styles.css
git commit -m "feat: global proxyMode toggle next to the language selector"
```

---

### Task 4: On-screen stamp — grid, deck panel, mobile modal

**Files:**
- Create: `web/src/components/ProxyStamp.jsx`
- Modify: `web/src/components/CardBrowser.jsx` (props line 10; cell lines 34–61)
- Modify: `web/src/components/DeckPanel.jsx` (MiniCard lines 28–81; both call sites)
- Modify: `web/src/components/CardPreviewModal.jsx` (lines 10, 20–30)
- Modify: `web/src/styles.css` (`.proxy-stamp`, `.proxy-wrap`)

**Interfaces:**
- Consumes: `swatchKeyForCard(card)`, `rectForLang(lang)`, `PROXY_LABEL` from `web/src/lib/proxy.js` (Task 1); swatch PNGs at `/proxy-swatches/<key>.png` (Task 2); `proxyMode` prop (Task 3).
- Produces: `<ProxyStamp card={card} lang={lang} on={bool} />` — absolutely-positioned overlay, renders `null` when off or unstampable. Later tasks don't consume it.

- [ ] **Step 1: Create the ProxyStamp component**

Create `web/src/components/ProxyStamp.jsx`:

```jsx
import React from 'react';
import { swatchKeyForCard, rectForLang, PROXY_LABEL } from '../lib/proxy.js';

const pct = (f) => `${f * 100}%`;

// CSS overlay covering the copyright / set-name zone with the card-type's band
// texture and the "Proxy" label. Must live inside a positioned wrapper that
// matches the card image bounds exactly. Text scales with the box via cqh
// (see .proxy-stamp in styles.css). Renders nothing when off or for cards
// without a stamp (Regions).
export default function ProxyStamp({ card, lang, on }) {
  if (!on) return null;
  const key = swatchKeyForCard(card);
  if (!key) return null;
  const r = rectForLang(lang);
  return (
    <div
      className="proxy-stamp"
      aria-hidden="true"
      style={{
        left: pct(r.x),
        top: pct(r.y),
        width: pct(r.w),
        height: pct(r.h),
        backgroundImage: `url(/proxy-swatches/${key}.png)`,
      }}
    >
      <span>{PROXY_LABEL}</span>
    </div>
  );
}
```

- [ ] **Step 2: Add the stamp CSS**

In `web/src/styles.css`, after the `.cardcell img { cursor: pointer; }` rule (line 178), add:

```css
/* Proxy-mode overlay: band texture + "Proxy" over the copyright zone.
   Positioned in % of the card box; the label scales with the box via cqh. */
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
  font-size: 62cqh;
  line-height: 1;
  color: #cfcdc6;
  letter-spacing: 0.04em;
}
/* Shrink-wrapped positioned wrapper for the modal image (img keeps its own
   max constraints, so the wrapper box == the visible card bounds). */
.proxy-wrap {
  position: relative;
  display: flex;
  max-width: 100%;
  max-height: 100%;
  min-height: 0;
}
```

- [ ] **Step 3: Stamp the browser grid**

In `web/src/components/CardBrowser.jsx`:
- Line 10: add `proxyMode` to the destructured props.
- Add the import: `import ProxyStamp from './ProxyStamp.jsx';`
- Inside the `.cardcell` div (which is already `position: relative`), right after the `<img ... />` element (line 53), add:

```jsx
              <ProxyStamp card={c} lang={lang} on={proxyMode} />
```

- [ ] **Step 4: Stamp the deck panel minis**

In `web/src/components/DeckPanel.jsx`:
- Add the import: `import ProxyStamp from './ProxyStamp.jsx';`
- `MiniCard` (line 28): add `proxyMode` to its props; after its `<img ... />` (line 51), add `<ProxyStamp card={card} lang={lang} on={proxyMode} />`.
- `DeckPanel` (line 83): add `proxyMode = false` to the destructured props; pass `proxyMode={proxyMode}` to `<MiniCard ...>` (lines 210–222).

- [ ] **Step 5: Stamp the mobile modal**

In `web/src/components/CardPreviewModal.jsx`:
- Line 10: add `proxyMode` to the props.
- Add the import: `import ProxyStamp from './ProxyStamp.jsx';`
- Wrap the image (lines 21–29) in the shrink-wrapped positioned div:

```jsx
        <div className="card-modal-imgwrap">
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
            <ProxyStamp card={card} lang={lang} on={proxyMode} />
          </div>
        </div>
```

- [ ] **Step 6: Verify in the browser**

With the dev server running:
- Grid: stamps sit on the bottom band of every card; **Region cards have none** (filter Type=Region to check). Toggle OFF → all stamps vanish instantly.
- Deck panel: add cards, check minis are stamped; zoom slider small→large keeps the stamp anchored.
- Switch language FR: stamp shifts to the centred fr rect. EN/ES: left rect.
- Wizard check: find Gandalf (TW) and Gandalf (WH) → grey-ish stamp; a Ringwraith and The Balrog → red; a Balrog Site → not red.
- Mobile width: tap a card → modal shows the stamp aligned on the letterboxed image (resize the window: it must track the image, not the wrapper).
- Clicks still work through the stamp (pointer-events: none): selecting/deselecting on the grid is unaffected.
Expected: stamp texture blends with each card's band; label legible at deck-panel/modal sizes, smudge-like at small grid sizes (same as the original fine print).

- [ ] **Step 7: Run the suite and commit**

Run: `npm test` → all PASS.

```bash
git add web/src/components/ProxyStamp.jsx web/src/components/CardBrowser.jsx web/src/components/DeckPanel.jsx web/src/components/CardPreviewModal.jsx web/src/styles.css
git commit -m "feat: on-screen proxy stamp in grid, deck panel and mobile modal"
```

---

### Task 5: On-screen stamp — imperative hover preview

**Files:**
- Modify: `web/src/components/CardPreview.jsx` (hook signature line 16; `showPreview` lines 40–50; `CardPreview` component lines 94–100)
- Modify: `web/src/components/CardBrowser.jsx` (lines 14, 66)
- Modify: `web/src/components/DeckPanel.jsx` (lines 103, 230)

**Interfaces:**
- Consumes: `swatchKeyForCard`, `rectForLang` from Task 1; `proxyMode` prop from Task 3.
- Produces: `useCardPreview(lang, proxyOn)` now also returns `stampRef`; `<CardPreview previewRef previewImgRef stampRef />` renders the stamp div. (The hover box is driven imperatively by design — no re-renders on mousemove — so the stamp is set imperatively too.)

- [ ] **Step 1: Extend the hook**

In `web/src/components/CardPreview.jsx`:
- Add the import: `import { swatchKeyForCard, rectForLang } from '../lib/proxy.js';`
- Line 16: `export function useCardPreview(lang, proxyOn = false) {`
- After `const previewImgRef = useRef(null);` (line 18), add: `const stampRef = useRef(null);`
- In `showPreview(c)` (line 40), after `img.src = cardImageSrc(c, lang);` (line 46), add:

```js
    // The preview box is imperative (no re-render per hover), so the stamp is
    // positioned imperatively too; .proxy-stamp CSS handles the label scaling.
    const stamp = stampRef.current;
    if (stamp) {
      const key = proxyOn ? swatchKeyForCard(c) : null;
      if (key) {
        const r = rectForLang(lang);
        stamp.style.left = `${r.x * 100}%`;
        stamp.style.top = `${r.y * 100}%`;
        stamp.style.width = `${r.w * 100}%`;
        stamp.style.height = `${r.h * 100}%`;
        stamp.style.backgroundImage = `url(/proxy-swatches/${key}.png)`;
        stamp.style.display = 'flex';
      } else {
        stamp.style.display = 'none';
      }
    }
```

- Line 89: return `{ previewRef, previewImgRef, stampRef, trackPointer, hidePreview }`.

- [ ] **Step 2: Render the stamp div in the preview box**

Replace the `CardPreview` component (lines 94–100) with:

```jsx
export function CardPreview({ previewRef, previewImgRef, stampRef }) {
  return (
    <div className="card-preview" ref={previewRef} style={{ display: 'none' }} aria-hidden="true">
      <img ref={previewImgRef} alt="" />
      <div className="proxy-stamp" ref={stampRef} style={{ display: 'none' }}>
        <span>Proxy</span>
      </div>
    </div>
  );
}
```

(`.card-preview` is `position: fixed` with `overflow: hidden` — it is the containing block, and its box tracks the scaled card exactly, so % positioning aligns.)

- [ ] **Step 3: Update both callers**

- `CardBrowser.jsx` line 14: `const { previewRef, previewImgRef, stampRef, trackPointer, hidePreview } = useCardPreview(lang, proxyMode);` and line 66: `<CardPreview previewRef={previewRef} previewImgRef={previewImgRef} stampRef={stampRef} />`.
- `DeckPanel.jsx` line 103: same hook change (`useCardPreview(lang, proxyMode)`); line 230: pass `stampRef` to `<CardPreview ...>`.

- [ ] **Step 4: Verify in the browser**

- Hover a card ≥600ms → full-size preview shows the stamp on the band, correct texture, label crisp.
- Hover a Region → no stamp. Toggle OFF → previews show original cards (toggle state applies on next hover — acceptable since flipping the toggle closes no preview).
- Hover previews from the deck panel behave identically.
Expected: no jitter on mousemove (stamp is set once per show, not per move).

- [ ] **Step 5: Run the suite and commit**

Run: `npm test` → all PASS.

```bash
git add web/src/components/CardPreview.jsx web/src/components/CardBrowser.jsx web/src/components/DeckPanel.jsx
git commit -m "feat: proxy stamp on the imperative hover preview"
```

---

### Task 6: Bake the stamp into the MPC ZIP export

**Files:**
- Create: `web/src/lib/export/proxyDraw.js`
- Modify: `web/src/lib/export/bleedCanvas.js` (whole file — small)
- Modify: `web/src/api.js` (lines 4–7 imports; `prefetchFronts` line 82; `exportDeck` lines 96–105)
- Modify: `web/src/components/ExportDialog.jsx` (lines 26, 67)

**Interfaces:**
- Consumes: `rectForLang`, `PROXY_LABEL`, `swatchKeyForCard` (Task 1); swatch PNGs (Task 2); `proxyMode` prop (Task 3).
- Produces (Task 7 relies on these exact signatures):
  - `drawProxyOnFace(ctx, w, h, swatchBmp, lang)` — draws swatch (or averaged-fill fallback) + label into the rect, in canvas pixels.
  - `loadSwatchBitmaps(keys)` → `Promise<Map<key, ImageBitmap|null>>`.
  - `renderCutFace(bytes, stamp)` → `Promise<canvas 750×1050>`, `stamp = { swatchBmp, lang } | null`.
  - `toMpcPng(bytes, stamp = null)` — unchanged output when `stamp` is null.
  - `makeStampFor(cards, lang, proxyMode)` in api.js → `Promise<(card) => stamp|null>`.
  - `api.exportDeck({ ..., proxyMode })`.

- [ ] **Step 1: Create the canvas stamp routine**

Create `web/src/lib/export/proxyDraw.js`:

```js
import { rectForLang, PROXY_LABEL } from '../proxy.js';

// Bake the proxy stamp into a cut-size face: swatch texture stretched over the
// covered rect, "Proxy" centred on top. Browser-only (canvas 2d ctx).
// If the swatch bitmap is missing, fill with the average of the pixels already
// under the rect — proxy mode must never leave the notice visible.
export function drawProxyOnFace(ctx, w, h, swatchBmp, lang) {
  const r = rectForLang(lang);
  const x = Math.round(r.x * w);
  const y = Math.round(r.y * h);
  const rw = Math.round(r.w * w);
  const rh = Math.round(r.h * h);
  if (swatchBmp) {
    ctx.drawImage(swatchBmp, x, y, rw, rh);
  } else {
    const data = ctx.getImageData(x, y, rw, rh).data;
    let R = 0, G = 0, B = 0;
    const n = data.length / 4;
    for (let i = 0; i < data.length; i += 4) { R += data[i]; G += data[i + 1]; B += data[i + 2]; }
    ctx.fillStyle = `rgb(${Math.round(R / n)},${Math.round(G / n)},${Math.round(B / n)})`;
    ctx.fillRect(x, y, rw, rh);
  }
  ctx.fillStyle = '#cfcdc6';
  ctx.font = `${Math.round(rh * 0.62)}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(PROXY_LABEL, x + rw / 2, y + rh / 2 + 1);
}

// Fetch + decode the swatch PNGs once per export. A failed swatch maps to
// null so drawProxyOnFace falls back to the averaged fill.
export async function loadSwatchBitmaps(keys) {
  const out = new Map();
  await Promise.all([...keys].map(async (key) => {
    try {
      const res = await fetch(`/proxy-swatches/${key}.png`);
      if (!res.ok) throw new Error(String(res.status));
      out.set(key, await createImageBitmap(await res.blob()));
    } catch {
      out.set(key, null);
    }
  }));
  return out;
}
```

- [ ] **Step 2: Refactor bleedCanvas.js around a shared cut face**

Replace the body of `web/src/lib/export/bleedCanvas.js` with:

```js
import { CARD_W_CUT, CARD_H_CUT, CARD_W_BLEED, CARD_H_BLEED, DPI } from '../constants.js';
import { bleedOps } from './bleedOps.js';
import { withPngDpi } from './pngDpi.js';
import { drawProxyOnFace } from './proxyDraw.js';

// Image bytes (JPEG/PNG) -> cut-size (750x1050) face canvas, optionally with
// the proxy stamp baked in. stamp = { swatchBmp, lang } | null.
export async function renderCutFace(bytes, stamp = null) {
  const bmp = await createImageBitmap(new Blob([bytes]));
  const face = document.createElement('canvas');
  face.width = CARD_W_CUT;
  face.height = CARD_H_CUT;
  const fctx = face.getContext('2d');
  fctx.imageSmoothingEnabled = true;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(bmp, 0, 0, CARD_W_CUT, CARD_H_CUT);
  bmp.close();
  if (stamp) drawProxyOnFace(fctx, CARD_W_CUT, CARD_H_CUT, stamp.swatchBmp, stamp.lang);
  return face;
}

// Face bytes -> MPC-ready PNG bytes: resize to the cut size, stamp if asked,
// replicate the edges outward as bleed, tag 300 DPI. Browser-only (canvas).
export async function toMpcPng(bytes, stamp = null) {
  const face = await renderCutFace(bytes, stamp);

  const out = document.createElement('canvas');
  out.width = CARD_W_BLEED;
  out.height = CARD_H_BLEED;
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false; // exact pixel replication for the bleed strips
  for (const o of bleedOps()) ctx.drawImage(face, o.sx, o.sy, o.sw, o.sh, o.dx, o.dy, o.dw, o.dh);

  const blob = await new Promise((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/png')
  );
  return withPngDpi(new Uint8Array(await blob.arrayBuffer()), DPI);
}

// Face bytes -> stamped cut-size JPEG bytes (no bleed) for the PDF sheets.
export async function toStampedJpeg(bytes, stamp, quality = 0.92) {
  const face = await renderCutFace(bytes, stamp);
  const blob = await new Promise((resolve, reject) =>
    face.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas toBlob failed'))), 'image/jpeg', quality)
  );
  return new Uint8Array(await blob.arrayBuffer());
}
```

- [ ] **Step 3: Thread proxyMode through api.exportDeck**

In `web/src/api.js`:
- Add imports: `import { swatchKeyForCard } from './lib/proxy.js';` and `import { loadSwatchBitmaps } from './lib/export/proxyDraw.js';`
- In `prefetchFronts` (line 82), pass the card to the processor:

```js
      cache.set(card.id, { bytes: await process(await fetchCardImageBytes(card, lang), card) });
```

- Before `exportDeck`, add:

```js
// (card) => { swatchBmp, lang } | null. Null when proxy mode is off or the
// card takes no stamp (Regions). Loads only the swatches this deck needs.
async function makeStampFor(cards, lang, proxyMode) {
  if (!proxyMode) return () => null;
  const keys = new Set(cards.map(swatchKeyForCard).filter(Boolean));
  const swatches = await loadSwatchBitmaps(keys);
  return (card) => {
    const key = swatchKeyForCard(card);
    return key ? { swatchBmp: swatches.get(key), lang } : null;
  };
}
```

- Replace `exportDeck` (lines 96–105) with:

```js
// Builds the MPC ZIP in the browser and triggers the download.
export async function exportDeck({ deckName, cardIds, backAssignments, lang = 'en', proxyMode = false }) {
  const index = requireIndex();
  const cards = cardIds.map((id) => index.get(id)).filter(Boolean);
  const stampFor = await makeStampFor(cards, lang, proxyMode);
  const getFrontPng = await prefetchFronts(cards, lang, (bytes, card) => toMpcPng(bytes, stampFor(card)));
  const getBackBytes = makeGetBackBytes(backAssignments);
  const getBackPng = async (group) => toMpcPng(await getBackBytes(group)); // backs are never stamped
  const { bytes, counts, failures } = await buildDeckZip({ deckName, cards, getFrontPng, getBackPng });
  downloadBlob(new Blob([bytes], { type: 'application/zip' }), `${safeName(deckName)}_${lang}_MPC.zip`);
  return { counts, failures };
}
```

- [ ] **Step 4: Pass proxyMode from the export dialog**

In `web/src/components/ExportDialog.jsx`:
- Line 26: add `proxyMode = false` to the destructured props.
- Line 67: `const r = await api.exportDeck({ deckName: deck.name, cardIds, backAssignments: backs, lang: imageLang, proxyMode });`

- [ ] **Step 5: Run the suite**

Run: `npm test`
Expected: all PASS (pure modules untouched; if any test imports `toMpcPng`, the added optional parameter is backward-compatible).

- [ ] **Step 6: Verify a real ZIP in the browser**

In the running app: build a small deck (~6 cards covering a hero character, a minion, a wizard avatar, a Ringwraith, a hazard, a site), export the MPC ZIP with proxy ON, and inspect 2–3 extracted PNGs (822×1122): the band shows the swatch + "Proxy" where the copyright was, bleed edges replicate the stamped pixels, backs untouched. Export again with proxy OFF → PNGs identical to pre-change output.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/export/proxyDraw.js web/src/lib/export/bleedCanvas.js web/src/api.js web/src/components/ExportDialog.jsx
git commit -m "feat: bake proxy stamp into MPC ZIP fronts"
```

---

### Task 7: Bake the stamp into the PDF export

**Files:**
- Modify: `web/src/api.js` (`exportPdf`, lines 108–121)
- Modify: `web/src/components/ExportDialog.jsx` (line 73)

**Interfaces:**
- Consumes: `makeStampFor` (Task 6, same file), `toStampedJpeg` from `web/src/lib/export/bleedCanvas.js` (Task 6), `proxyMode` prop (Task 3).
- Produces: `api.exportPdf({ ..., proxyMode })`. `web/src/lib/export/pdf.js` needs **no change**: `embedAuto` already sniffs bytes, and stamped fronts arrive as cut-size JPEG bytes.

- [ ] **Step 1: Thread proxyMode through api.exportPdf**

In `web/src/api.js`, add `toStampedJpeg` to the bleedCanvas import (line 5):

```js
import { toMpcPng, toStampedJpeg } from './lib/export/bleedCanvas.js';
```

Replace `exportPdf` (lines 108–121) with:

```js
// Builds the print-sheet PDF in the browser and triggers the download.
export async function exportPdf({ deckName, cardIds, backAssignments, includeBacks, format = 'letter', lang = 'en', proxyMode = false }) {
  const index = requireIndex();
  const cards = cardIds.map((id) => index.get(id)).filter(Boolean);
  const stampFor = await makeStampFor(cards, lang, proxyMode);
  // Proxy off: raw CDN bytes, the PDF scales them (no resampling — unchanged).
  // Proxy on: bake the stamp into a cut-size JPEG face instead.
  const getFrontBytes = await prefetchFronts(cards, lang, (bytes, card) => {
    const stamp = stampFor(card);
    return stamp ? toStampedJpeg(bytes, stamp) : bytes;
  });
  const { bytes, failures, pageCount } = await buildSheetPdf({
    cards,
    getFrontBytes,
    getBackBytes: makeGetBackBytes(backAssignments),
    includeBacks,
    format,
  });
  downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${safeName(deckName)}_${format}_${lang}_sheets.pdf`);
  return { pages: pageCount, failures };
}
```

- [ ] **Step 2: Pass proxyMode from the export dialog**

In `web/src/components/ExportDialog.jsx` line 73:

```js
        const r = await api.exportPdf({ deckName: deck.name, cardIds, backAssignments: backs, includeBacks, format: pageFormat, lang: imageLang, proxyMode });
```

- [ ] **Step 3: Run the suite**

Run: `npm test` → all PASS.

- [ ] **Step 4: Verify a real PDF in the browser**

Export the same test deck as PDF (letter, with backs) with proxy ON: open it, zoom on a front's bottom band → swatch + "Proxy", no copyright; backs pages unchanged; Region cards (if any in deck) unstamped. Export with proxy OFF → fronts show the original copyright (raw-bytes path intact).

- [ ] **Step 5: Commit**

```bash
git add web/src/api.js web/src/components/ExportDialog.jsx
git commit -m "feat: bake proxy stamp into PDF sheet fronts"
```

---

### Task 8: Rect calibration, full visual pass, README

**Files:**
- Modify: `web/src/lib/proxy.js` (only the `PROXY_RECT` fractions, if needed)
- Modify: `README.md` (MPC export section, near line 85)

**Interfaces:**
- Consumes: everything above.
- Produces: final calibrated `PROXY_RECT` values; README note.

- [ ] **Step 1: Calibrate `PROXY_RECT.enes`**

Dev server + proxy ON, language **EN**: open the modal/hover preview on cards from different sets (copyright years differ: ©1995 TW-era, ©1997 AS, ©1998 BA). Check: the stamp fully covers "©19xx Tolkien Enterprises" with a small margin, without touching the "Remaster 20xx" text or the art-credit plate above. Switch to **ES**: same cards in Spanish remaster — same check. Adjust `PROXY_RECT.enes` fractions in `web/src/lib/proxy.js` if any edge shows.

- [ ] **Step 2: Calibrate `PROXY_RECT.fr`**

Language **FR**: check one card from **each of the 7 sets** (as, ba, dm, le, td, tw, wh — use the Set filter) so every French set name is verified covered ("Les Sorciers", "La Main Blanche", "Contre l'Ombre", and the td/dm/le/ba names — the longest one drives the rect width). Adjust `PROXY_RECT.fr` if a name overflows. Note: FR shows no copyright, so total coverage of the set name with margin is the only criterion.

- [ ] **Step 3: Re-check exports after calibration**

If any fraction changed: re-export one ZIP (EN) and one PDF (FR), confirm the baked stamps match the screen (same rect source). Run `npm test` (the geometry sanity test still passes).

- [ ] **Step 4: README note**

In `README.md`, the MPC section explains the bleed (line ~85: "Chaque carte est agrandie puis complétée d'un bleed (extension des bords) pour produire un…"). After that paragraph, add:

```markdown
Le **mode Proxy** (interrupteur « Proxy » à côté du sélecteur de langues, activé par
défaut) recouvre la mention « ©19xx Tolkien Enterprises » (ou le nom d'extension sur
les cartes FR) par un tampon « Proxy » assorti à la texture du cadre de chaque type de
carte — exigence de MPC pour les cartes proxy. Le tampon apparaît à l'écran et dans les
exports ZIP/PDF ; désactive l'interrupteur pour retrouver les images d'origine.
Les cartes Région et les dos ne sont jamais tamponnés.
```

- [ ] **Step 5: Final full pass**

- `npm test` → all PASS.
- `npm run build` → build succeeds.
- Browser: toggle OFF → zero stamp anywhere (grid, panel, hover, modal); toggle ON → stamps everywhere expected; reload persists the choice.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/proxy.js README.md
git commit -m "feat: calibrate proxy-stamp rects; document proxy mode"
```
