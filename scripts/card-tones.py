#!/usr/bin/env python3
"""Card tones: one rule, explicit colors (no transparency, no blend).

RULE  (OKLCH, same hue):   dark = card color with lightness x 0.82 and chroma x 0.82.
      Measured from the Figma samples (pink, blue, yellow, green): L x0.80-0.85, C x0.76-0.89, hue unchanged.
TEXT  on a band is always white; pick card colors dark enough that it reaches 3:1 (titles) / 4.5:1 (descriptions).

Usage:  python3 scripts/card-tones.py          prints the table + the CSS lines to paste in shared/theme.css
        python3 scripts/card-tones.py --write  rewrites the --d1..--d6 / --o1..--o6 values inside shared/theme.css
"""
import math, re, sys, pathlib

K_L, K_C = 0.82, 0.82
MIN_LARGE = 3.0   # WCAG AA large text (24px bold titles)
MIN_SMALL = 4.5   # WCAG AA normal text (14px descriptions) -- reported, not forced

def hex2rgb(h):
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return [int(h[i:i + 2], 16) for i in (0, 2, 4)]
def lin(c): c /= 255; return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
def unlin(c): c = max(0, min(1, c)); return 255 * (12.92 * c if c <= .0031308 else 1.055 * c ** (1 / 2.4) - .055)
def to_oklch(h):
    r, g, b = [lin(v) for v in hex2rgb(h)]
    l = (.4122214708 * r + .5363325363 * g + .0514459929 * b) ** (1 / 3)
    m = (.2119034982 * r + .6806995451 * g + .1073969566 * b) ** (1 / 3)
    s = (.0883024619 * r + .2817188376 * g + .6299787005 * b) ** (1 / 3)
    L = .2104542553 * l + .7936177850 * m - .0040720468 * s
    a = 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s
    bb = .0259040371 * l + .7827717662 * m - .8086757660 * s
    return L, math.hypot(a, bb), math.atan2(bb, a)
def from_oklch(L, C, H):
    a, b = C * math.cos(H), C * math.sin(H)
    l = (L + .3963377774 * a + .2158037573 * b) ** 3
    m = (L - .1055613458 * a - .0638541728 * b) ** 3
    s = (L - .0894841775 * a - 1.2914855480 * b) ** 3
    r = 4.0767416621 * l - 3.3077115913 * m + .2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s
    bl = -.0041960863 * l - .7034186147 * m + 1.7076147010 * s
    return r, g, bl
def to_hex(L, C, H):
    for _ in range(40):                       # if the color falls outside sRGB, lower the chroma until it fits
        r, g, b = from_oklch(L, C, H)
        if all(-1e-4 <= v <= 1 + 1e-4 for v in (r, g, b)): break
        C *= .97
    return '#%02x%02x%02x' % tuple(round(unlin(v)) for v in (r, g, b))
def rel_lum(h): r, g, b = [lin(v) for v in hex2rgb(h)]; return .2126 * r + .7152 * g + .0722 * b
def contrast(a, b):
    la, lb = rel_lum(a), rel_lum(b)
    if la < lb: la, lb = lb, la
    return (la + .05) / (lb + .05)
def darken(h):
    L, C, H = to_oklch(h)
    return to_hex(L * K_L, C * K_C, H)

CSS = pathlib.Path(__file__).resolve().parent.parent / "shared" / "theme.css"
src = CSS.read_text()
rows = []
BLOCK = r'^(?::root|html\[data-palette="(\w+)"\])\s*\{([^}]*)\}'
for m in re.finditer(BLOCK, src, re.M):
    name = m.group(1) or "red"
    body = m.group(2)
    if "--ink" not in body: continue          # other :root rules (motion easing...)
    ink = re.search(r'--ink:\s*(#\w+)', body).group(1)
    cs = [re.search(r'--c%d:\s*(#\w+)' % i, body).group(1) for i in range(1, 7)]
    rows.append((name, ink, cs))

out, lines = [], {}
print("palette   card     -> dark      text     ratio  (title 3:1 / desc 4.5:1)")
for name, ink, cs in rows:
    ds, os_ = [], []
    for i, c in enumerate(cs, 1):
        d = darken(c)
        o = "#ffffff"                              # text inside the cards is always white
        ds.append(d); os_.append(o)
        cr = contrast(o, d)
        flag = ("OK" if cr >= MIN_SMALL else ("title only" if cr >= MIN_LARGE else "FAIL")) + ""
        print("%-9s %s -> %s  %s  %5.2f  %s" % (name if i == 1 else "", c, d, o, cr, flag))
    lines[name] = (ds, os_)
if "--write" in sys.argv:
    txt = src
    # remove any previous generated values, then append them to each palette rule
    txt = re.sub(r'\s*/\* card tones \(scripts/card-tones\.py\)[^*]*\*/', '', txt)
    txt = re.sub(r'\s*--d[1-6]:\s*#\w+;|\s*--o[1-6]:\s*#\w+;', '', txt)
    def put(m):
        name = m.group(1) or "red"
        ds, os_ = lines[name]
        add = ("\n  /* card tones (scripts/card-tones.py): d = dark band, o = text on it */\n  " + " ".join("--d%d: %s;" % (i + 1, d) for i, d in enumerate(ds))
               + "\n  " + " ".join("--o%d: %s;" % (i + 1, o) for i, o in enumerate(os_)) + "\n")
        head, body = m.group(0)[:m.start(2) - m.start(0)], m.group(2)
        return head + body.rstrip() + add + "}"
    txt = re.sub(BLOCK, lambda m: put(m) if "--ink" in m.group(2) else m.group(0), txt, flags=re.M)
    CSS.write_text(txt)
    print("\nwritten to", CSS)
