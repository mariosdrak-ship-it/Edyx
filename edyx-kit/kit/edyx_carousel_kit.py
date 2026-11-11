#!/usr/bin/env python3
"""
Edyx carousel kit  -  builds the exact Edyx carousel look from a JSON spec.

Usage:
    pip install -r kit/requirements.txt
    python kit/edyx_carousel_kit.py specs/reviews.json --photos photos --out out

Output: <name>_1.jpg ... <name>_N.jpg (1206x1505, 4:5) + <name>_sheet.png (contact sheet)
No progress dots. Swipe hand only on slide 1. Logo bottom-left on every slide.
"""
import argparse, json, math, os, sys, urllib.request
from pathlib import Path
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ASSETS = ROOT / "assets"
FONTS = ASSETS / "fonts"
W, H, S = 1206, 1505, 3
GOLD = (232, 205, 150, 255); CW = (200, 222, 228, 255); COL = (232, 233, 238, 244)
WHITE = (250, 251, 253, 255); NOTE = (210, 225, 230, 255)
TEAL = np.array([0, 55, 68], np.float32)          # brand dark teal (0,55,68)

FONT_URLS = {
    "Inter[opsz,wght].ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf",
    "Inter-Italic[opsz,wght].ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter-Italic%5Bopsz%2Cwght%5D.ttf",
    "EBGaramond-Italic.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/EBGaramond-Italic%5Bwght%5D.ttf",
    "EBGaramond-Roman.ttf": "https://raw.githubusercontent.com/google/fonts/main/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf",
}

def ensure_fonts():
    FONTS.mkdir(parents=True, exist_ok=True)
    for name, url in FONT_URLS.items():
        p = FONTS / name
        if not p.exists():
            print("downloading font", name)
            urllib.request.urlretrieve(url, p)

def fnt(kind, sz):
    px = int(sz * S)
    if kind == "bold":  f = ImageFont.truetype(str(FONTS / "Inter[opsz,wght].ttf"), px); f.set_variation_by_axes([32, 800])
    elif kind == "light": f = ImageFont.truetype(str(FONTS / "Inter[opsz,wght].ttf"), px); f.set_variation_by_axes([32, 260])
    elif kind == "reg":  f = ImageFont.truetype(str(FONTS / "Inter[opsz,wght].ttf"), px); f.set_variation_by_axes([32, 440])
    elif kind == "bis":  f = ImageFont.truetype(str(FONTS / "Inter-Italic[opsz,wght].ttf"), px); f.set_variation_by_axes([32, 800])
    elif kind == "ital": f = ImageFont.truetype(str(FONTS / "EBGaramond-Italic.ttf"), int(px * 1.3)); f.set_variation_by_axes([400])   # Greek italic accent
    elif kind == "bi":   f = ImageFont.truetype(str(FONTS / "EBGaramond-Italic.ttf"), int(px * 1.2)); f.set_variation_by_axes([700])
    else:                f = ImageFont.truetype(str(FONTS / "EBGaramond-Roman.ttf"), int(px * 1.2)); f.set_variation_by_axes([700])
    return f

def seg_w(t, f, sz, tr): return sum(f.getlength(c) for c in t) + len(t) * tr * sz * S

# ---------------------------------------------------------------- images
def prep(path, box, out=(W, H)):
    im = Image.open(path).convert("RGB").crop(box).resize(out, Image.LANCZOS)
    return np.array(im).astype(np.float32)

def pc(path, frac):
    """crop to 4:5 (top fraction frac: 0=top,1=bottom) and scale to 1206x1505"""
    im = Image.open(path); w, h = im.size
    target = W / H
    if w / h > target:                      # too wide -> crop width around the centre
        cw = int(round(h * target)); x0 = (w - cw) // 2; return prep(path, (x0, 0, x0 + cw, h))
    ch = int(round(w / target)); y0 = int((h - ch) * frac)
    return prep(path, (0, y0, w, y0 + ch))

def overlay(a, dim=0.9, top=(0, 0), bot=(0, 0), left=(0, 0)):
    ys = np.arange(H)[:, None]; xs = np.arange(W)[None, :]; d = np.zeros((H, W), np.float32)
    if top[0]: d = np.maximum(d, np.clip(1 - ys / top[1], 0, 1) ** 1.2 * top[0] * np.ones((1, W)))
    if bot[0]: d = np.maximum(d, np.clip((ys - bot[1]) / (H - bot[1]), 0, 1) ** 1.1 * bot[0] * np.ones((1, W)))
    if left[0]: d = np.maximum(d, np.clip(1 - xs / left[1], 0, 1) ** 1.1 * left[0] * np.ones((H, 1)))
    a = a * dim * (1 - np.clip(d, 0, 0.9)[..., None])
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).convert("RGBA")

def band(img, y0, y1, strength=0.55, soft=110):
    """soft dark band behind the text zone = the 'readable text' fix"""
    ys = np.arange(H)[:, None].astype(np.float32)
    m = np.clip((ys - (y0 - soft)) / soft, 0, 1) * np.clip(((y1 + soft) - ys) / soft, 0, 1)
    arr = np.array(img.convert("RGB")).astype(np.float32) * (1 - strength * m[..., None])
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")

def tealphoto(a, k=0.28):
    ys = np.arange(H)[:, None]; out = a * k + TEAL * (1 - k)
    out = out * np.clip(1 - ((ys - 760) / 1200) ** 2 * 0.25, 0.75, 1)[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).convert("RGBA")

def tealbg(seed=0):
    """photo-less teal background with soft waves"""
    ys = np.arange(H)[:, None]; xs = np.arange(W)[None, :]
    g = np.zeros((H, W, 3), np.float32) + TEAL
    g += (np.exp(-(((xs - 603) / 760) ** 2 + ((ys - 760) / 800) ** 2)) * 14)[..., None] * np.array([0.2, 1.0, 1.1])
    g *= np.clip(1 - ((ys - 760) / 1200) ** 2 * 0.3, 0.72, 1)[..., None]
    im = Image.fromarray(np.clip(g, 0, 255).astype(np.uint8)).convert("RGBA")
    L = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0)); d = ImageDraw.Draw(L); xsw = np.linspace(0, W, 400)
    def wave(b, A, lam, ph, A2, lam2, ph2): return b + A * np.sin(2 * np.pi * xsw / lam + ph) + A2 * np.sin(2 * np.pi * xsw / lam2 + ph2)
    for i in range(9):
        yw = wave(1150 + i * 46, 44 + i * 3, 820, seed + i * 0.35, 16, 330, seed * 2 + i * 0.5)
        d.line([(x * S, y * S) for x, y in zip(xsw, yw)], fill=(150, 220, 230, int(max(22, 100 - i * 9))), width=int(2.2 * S), joint="curve")
    return Image.alpha_composite(im, L.resize((W, H), Image.LANCZOS))

# ---------------------------------------------------------------- text
class Txt:
    def __init__(s): s.layer = Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0)); s.d = ImageDraw.Draw(s.layer)
    def line(s, segs, sz, base, tr=-0.02, cx=W / 2, x=None, maxw=1130, scale=None, col=None):
        def meas(sz):
            fs = [fnt(k, sz) for _, k in segs]; return fs, [seg_w(t, f, sz, tr) for (t, _), f in zip(segs, fs)]
        fs, ws = meas(sz)
        if scale is None and sum(ws) / S > maxw: sz *= maxw / (sum(ws) / S); fs, ws = meas(sz)
        xx = (cx * S - sum(ws) / 2) if x is None else x * S
        for (t, k), f in zip(segs, fs):
            for c in t: s.d.text((xx, base * S), c, font=f, fill=(col or COL), anchor="ls"); xx += f.getlength(c) + tr * sz * S
        return sz
    def fit(s, lines, sz, tr=-0.02, maxw=1130):
        m = sz
        for segs in lines:
            fs = [fnt(k, sz) for _, k in segs]; w = sum(seg_w(t, f, sz, tr) for (t, _), f in zip(segs, fs)) / S
            m = min(m, sz * maxw / w if w > maxw else sz)
        return m
    def apply(s, img):
        L = s.layer.resize((W, H), Image.LANCZOS)
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sh.putalpha(L.split()[3].filter(ImageFilter.GaussianBlur(8)).point(lambda v: int(v * 0.45)))
        img = Image.alpha_composite(img, sh); img.alpha_composite(L); return img

def label(t, text, y, sz=28, col=CW, tr=0.3):
    f = fnt("light", sz); w = sum(f.getlength(c) for c in text) + len(text) * tr * sz * S; x = W * S / 2 - w / 2
    for c in text: t.d.text((x, y * S), c, font=f, fill=col, anchor="ls"); x += f.getlength(c) + tr * sz * S

def cwrap(t, segs, sz, y0, width, lh, col=None, tr=-0.005):
    """centered word-wrap with mixed kinds; returns the next free y"""
    words = [[]]
    for tx, k in segs:
        cur = ""
        for ch in tx:
            if ch == " ":
                if cur: words[-1].append((cur, k)); cur = ""
                if words[-1]: words.append([])
            else: cur += ch
        if cur: words[-1].append((cur, k))
    words = [w for w in words if w]
    kinds = {k for w in words for _, k in w}; fs = {k: fnt(k, sz) for k in kinds}; space = fnt("light", sz).getlength(" ")
    wl = lambda w: sum(seg_w(p, fs[k], sz, tr) for p, k in w)
    lines = [[]]; cur = 0
    for w in words:
        l = wl(w)
        if cur + l > width * S and lines[-1]: lines.append([]); cur = 0
        lines[-1].append((w, l)); cur += l + space
    y = y0
    for ln in lines:
        tot = sum(l for _, l in ln) + space * (len(ln) - 1); x = W * S / 2 - tot / 2
        for w, l in ln:
            for p, k in w:
                for c in p: t.d.text((x, y * S), c, font=fs[k], fill=(col or COL), anchor="ls"); x += fs[k].getlength(c) + tr * sz * S
            x += space
        y += lh
    return y

# ---------------------------------------------------------------- brand marks
def _logo_circle(size=150):
    lg = Image.open(ASSETS / "logo.jpeg").convert("RGB")
    cx, cy, r = 391, 569, 383                       # circle position inside logo.jpeg
    lg = lg.crop((cx - r, cy - r, cx + r, cy + r)).resize((600, 600), Image.LANCZOS)
    m = Image.new("L", (600, 600), 0); ImageDraw.Draw(m).ellipse((2, 2, 597, 597), fill=255); lg.putalpha(m)
    return lg.resize((size, size), Image.LANCZOS)

def add_logo(img, ring=False):
    D = 150; X, Y = 58, 1318; lg = _logo_circle(D)
    mm = Image.new("L", (W, H), 0); ImageDraw.Draw(mm).ellipse((X, Y, X + D, Y + D), fill=140)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sh.putalpha(mm.filter(ImageFilter.GaussianBlur(9)))
    img = Image.alpha_composite(img, sh); img.alpha_composite(lg, (X, Y))
    if ring:
        rl = Image.new("RGBA", (W * 3, H * 3), (0, 0, 0, 0)); ImageDraw.Draw(rl).ellipse((X * 3, Y * 3, (X + D) * 3, (Y + D) * 3), outline=(170, 225, 235, 200), width=6)
        img = Image.alpha_composite(img, rl.resize((W, H), Image.LANCZOS))
    return img

def add_hand(img):
    mk = cv2.imread(str(ASSETS / "hand_mask.png"), 0).astype(np.float32) / 255
    mk = cv2.GaussianBlur(mk, (0, 0), 3); mk = np.clip((mk - 0.5) * 5 + 0.5, 0, 1); mk = cv2.resize(mk, (190, 185), interpolation=cv2.INTER_AREA)
    full = np.zeros((H, W), np.float32); full[1310:1495, 1000:1190] = mk; al = Image.fromarray((full * 255).astype(np.uint8))
    hl = Image.new("RGBA", (W, H), (250, 251, 255, 255)); hl.putalpha(al)
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sh.putalpha(al.filter(ImageFilter.GaussianBlur(6)).point(lambda v: int(v * 0.8)))
    img = Image.alpha_composite(img, sh); img.alpha_composite(hl); return img

# ---------------------------------------------------------------- slide layouts
def A3r(t, h1, h2, exp, fix, hs=128):
    """bridge layout: 2 title lines + 2-3 body lines + gold payoff lines"""
    t.line(h1, hs, 215, maxw=1060); t.line(h2, hs, 350, maxw=1060)
    bs = t.fit([[(x, "reg")] for x in exp] + [[(x, "bold")] for x in fix], 52, tr=-0.006, maxw=1100); y = 490
    for x in exp: t.line([(x, "reg")], bs, y, tr=-0.006, scale=1, col=WHITE); y += 66
    y += 22
    for x in fix: t.line([(x, "bold")], bs, y, tr=-0.006, scale=1, col=GOLD); y += 66

def color(c): return GOLD if c == "gold" else (CW if c == "cw" else None)

def photo_or_teal(ph, base_dir, seed, default_frac=0.4):
    if not ph: return None, tealbg(seed)
    if isinstance(ph, str): ph = {"path": ph}
    p = Path(ph["path"]); p = p if p.is_absolute() else Path(base_dir) / p
    if not p.exists(): print("WARNING photo missing, using teal background:", p); return None, tealbg(seed)
    a = pc(str(p), ph.get("frac", default_frac))
    if ph.get("blur"): a = cv2.GaussianBlur(a, (0, 0), ph["blur"])
    return (a, ph), None

def build(spec, photos_dir, out_dir):
    ensure_fonts(); out_dir = Path(out_dir); out_dir.mkdir(parents=True, exist_ok=True)
    name = spec["name"]; tag = spec.get("tag", "ΓΙΑ ΚΑΘΕ ΕΠΙΧΕΙΡΗΣΗ"); files = []
    def save(img, n): p = out_dir / f"{name}_{n}.jpg"; img.convert("RGB").save(p, quality=95); files.append(p)
    # ---- 1 COVER
    c = spec["cover"]; ph, bgimg = photo_or_teal(c.get("photo"), photos_dir, 1, 0.0)
    img = overlay(ph[0], dim=0.6, top=(0.8, 820), bot=(0.88, 900)) if ph else bgimg
    t = Txt()
    for ln in c["lines"]:
        t.line([(ln["t"], ln.get("k", "bold"))], ln.get("s", 104), ln["y"], maxw=ln.get("maxw", 1060), col=color(ln.get("c")))
    if c.get("bottom"): t.line([(c["bottom"], "bold")], 50, 1215, tr=-0.006, maxw=1100)
    t.line([(c.get("sub", "Σύρε για να δεις πώς"), "light")], 46, 1285, tr=-0.005, col=CW)
    save(add_hand(add_logo(t.apply(img))), 1)
    # ---- 2 BRIDGE
    b = spec["bridge"]; ph, bgimg = photo_or_teal(b.get("photo"), photos_dir, 3, 0.3)
    img = band(overlay(ph[0], dim=0.55, top=(0.85, 900), bot=(0.45, 1250)), 150, 780, 0.5) if ph else bgimg
    t = Txt(); A3r(t, [(b["h1"], "bold")], [(b["h2"], "ital")], b["exp"], b["fix"], hs=b.get("hs", 128)); save(add_logo(t.apply(img)), 2)
    # ---- 3.. VALUE slides
    for i, v in enumerate(spec["values"]):
        ph, bgimg = photo_or_teal(v.get("photo"), photos_dir, 5 + i, 0.4)
        img = band(overlay(ph[0], dim=0.5, top=(0.5, 500), bot=(0.5, 1100)), 380, 1180, 0.65) if ph else bgimg
        t = Txt(); label(t, tag, 175, col=GOLD)
        t.line([(v.get("num", "0%d" % (i + 1)), "ital")], 200, 520, tr=0, col=GOLD)
        y = cwrap(t, [(v["title"], "bold")], 80, 690, 920, 96, tr=-0.02)
        y = cwrap(t, [(v["body"], "reg")], 46, y + 30, 880, 64, col=WHITE)
        cwrap(t, [(v["fix"], "bold")], 44, y + 28, 880, 60, col=GOLD)
        if v.get("note"): t.line([(v["note"], "light")], 30, 1290, cx=703, tr=-0.004, col=NOTE, maxw=900)
        save(add_logo(t.apply(img)), 3 + i)
    # ---- last CTA
    k = spec["cta"]; ph, bgimg = photo_or_teal(k.get("photo"), photos_dir, 9, 0.4)
    img = band(tealphoto(cv2.GaussianBlur(ph[0], (0, 0), 7), 0.24), 380, 1100, 0.35) if ph else bgimg
    t = Txt(); label(t, k["label"], 300, col=GOLD)
    lines = k.get("lines") or [
        {"t": "Επικοινώνησε", "k": "bold", "s": 124, "y": 560}, {"t": "μαζί μας", "k": "ital", "s": 130, "y": 710},
        {"t": "για να δούμε μαζί τι να αλλάξεις", "k": "light", "s": 48, "y": 860, "c": "cw"},
        {"t": "στα βίντεό σου.", "k": "light", "s": 48, "y": 925, "c": "cw"}, {"t": "edyx.gr", "k": "bold", "s": 60, "y": 1060}]
    for ln in lines: t.line([(ln["t"], ln.get("k", "bold"))], ln.get("s", 60), ln["y"], tr=-0.005 if ln.get("k") == "light" else -0.02, maxw=ln.get("maxw", 1000), col=color(ln.get("c")))
    save(add_logo(t.apply(img), ring=True), 3 + len(spec["values"]))
    # ---- contact sheet
    sh = Image.new("RGB", (402 * len(files), 502))
    for i, p in enumerate(files): sh.paste(Image.open(p).resize((402, 502)), (i * 402, 0))
    sheet = out_dir / f"{name}_sheet.png"; sh.save(sheet)
    print("built", len(files), "slides ->", out_dir); return files, sheet

def main():
    ap = argparse.ArgumentParser(); ap.add_argument("spec"); ap.add_argument("--photos", default=str(ROOT / "photos")); ap.add_argument("--out", default=str(ROOT / "out"))
    a = ap.parse_args(); spec = json.load(open(a.spec, encoding="utf-8")); build(spec, Path(a.photos), a.out)

if __name__ == "__main__": main()
