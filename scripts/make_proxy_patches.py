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
CORE = (0.150, 0.9320, 0.440, 0.9750)   # x0, y0, x1, y1 — fully opaque
MARGIN_PX = 7                            # alpha ramp, at REF_W
LABEL_FONT_FRAC = 0.0155
LABEL_CX, LABEL_CY = 0.295, 0.9565
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
    merged.putdata([min(s, r) for s, r in zip(a.getchannel('A').get_flattened_data(), ramp.get_flattened_data())])
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
    vals = [(p, a) for p, a in zip(rgb.get_flattened_data(), alpha.get_flattened_data()) if a > 200]
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
