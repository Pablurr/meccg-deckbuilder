"""Generate the 32 proxy frame patches from the card-frame templates.

Crops each template over the covered rect plus a feathered margin, so the
copyright / set-name zone can be repainted with the frame itself. Writes:
  web/public/proxy-patches/<key>.png      used for en + es
  web/public/proxy-patches/<key>-fr.png   same crop, tone-shifted to the FR grade
  scripts/proxy-patch-colors.txt          label colour per key (for proxy.js)
  scripts/proxy-patch-qa.png              visual QA sheet (not committed)

Requires:
  - Pillow >= 11.3 (for Image.get_flattened_data())
  - a Windows "Arial Bold" font at C:\\Windows\\Fonts\\arialbd.ttf
  - the local card corpus under cards/ (gitignored; not present in a fresh
    clone) — both cards/remastered-all and cards/fr must be populated, since
    the FR tone offset (fr_offset) is measured against real FR card images.

Run from the repo root:  python scripts/make_proxy_patches.py
Spec: docs/superpowers/specs/2026-07-28-proxy-frame-patches-design.md
"""
import colorsys
import json
import os
import re
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
INK_DIFF_MIN = 28      # card-vs-patch luminance delta that counts as printed ink
MIN_CONTRAST = 80      # label luminance must clear this against BOTH patch variants
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


def fr_offset(key, patch, m):
    """Mean per-channel delta (FR cards - patch) over the margin ring only."""
    keyed = [p for p in fr_card_paths() if _key_of_fr(p) == key][:12]
    if not keyed:
        raise SystemExit(
            'No FR cards found for key %r under %s; cannot compute the FR tone '
            'offset for this key.' % (key, FR_CARDS))
    ow, oh = patch.size
    mask = Image.new('L', (ow, oh), 255)
    ImageDraw.Draw(mask).rectangle([m, m, ow - 1 - m, oh - 1 - m], fill=0)
    pr = patch.convert('RGB')
    acc = [0.0, 0.0, 0.0]
    for p in keyed:
        im = Image.open(p).convert('RGB')
        w, h = im.size
        # Per-card margin is discarded: band is resized to (ow, oh) below, so
        # the mask above (built from the caller's m, i.e. patch's own margin)
        # is what actually applies.
        _, o, _ = boxes(w, h, key)
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


def _require_corpus(path, label):
    """Raise loudly if the local (gitignored) card corpus is missing, rather
    than letting a fresh clone silently produce zero-offset FR patches."""
    for _, _, files in os.walk(path):
        if files:
            return
    raise SystemExit(
        '%s (%s) is missing or empty. Regenerating proxy patches requires the '
        'local card corpus under cards/, which is gitignored and not present '
        'in a fresh clone.' % (label, path))


def _swatch_keys_from_js():
    """Pull the SWATCH_KEYS array out of web/src/lib/proxy.js by regex, so
    TEMPLATE_BY_KEY (this file's hand-maintained mirror) can't silently drift
    from it. Deliberately not a real JS parse — just enough to catch drift."""
    js_path = os.path.join(ROOT, 'web', 'src', 'lib', 'proxy.js')
    with open(js_path, encoding='utf-8') as f:
        src = f.read()
    m = re.search(r'SWATCH_KEYS\s*=\s*\[(.*?)\]', src, re.S)
    if not m:
        raise SystemExit('Could not find SWATCH_KEYS in %s' % js_path)
    return set(re.findall(r"'([^']+)'", m.group(1)))


def main():
    _require_corpus(EN_CARDS, 'EN_CARDS')
    _require_corpus(FR_CARDS, 'FR_CARDS')

    py_keys = set(TEMPLATE_BY_KEY)
    js_keys = _swatch_keys_from_js()
    if py_keys != js_keys:
        raise SystemExit(
            'TEMPLATE_BY_KEY (make_proxy_patches.py) and SWATCH_KEYS '
            '(web/src/lib/proxy.js) disagree: only in python=%s only in js=%s'
            % (sorted(py_keys - js_keys), sorted(js_keys - py_keys)))

    os.makedirs(OUT, exist_ok=True)
    colours = []
    for key in TEMPLATE_BY_KEY:
        patch, outer, m = build_patch(key)
        patch.save(os.path.join(OUT, '%s.png' % key))

        off = fr_offset(key, patch, m)
        chans = [patch.split()[i].point(lambda v, o=off[i]: max(0, min(255, int(round(v + o)))))
                 for i in range(3)]
        Image.merge('RGBA', chans + [patch.getchannel('A')]).save(os.path.join(OUT, '%s-fr.png' % key))

        col, tint, moved = label_colour(key)
        colours.append((key, col, tint, moved))
        print('%-17s size=%dx%d  fr_offset=%s  label=%s (fr tint %s%s)'
              % (key, patch.width, patch.height, tuple(round(v, 1) for v in off),
                 col, tint, ', floored' if moved else ''))

    with open(COLORS, 'w', encoding='utf-8') as f:
        for key, col, tint, moved in colours:
            f.write('%s %s %s %s\n' % (key, col, tint, 'floored' if moved else 'sampled'))
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
            k, c, _tint, _origin = line.split()
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
