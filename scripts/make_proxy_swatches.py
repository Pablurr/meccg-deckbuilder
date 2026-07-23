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
CROP = (0.48, 0.954, 0.62, 0.966)

# Per-key crop overrides, for when a chosen card's bottom rail doesn't fit
# CROP cleanly (text bleed, dominating rivet, etc. — see the QA montage).
# Falls back to CROP when a key has no entry.
OVERRIDES = {}

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
        x0, y0, x1, y1 = OVERRIDES.get(key, CROP)
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
