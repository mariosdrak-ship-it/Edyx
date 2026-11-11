#!/usr/bin/env python3
"""Build several carousels at once: Instagram slides, TikTok copies (1080x1348) and one preview sheet.
Usage: python kit/batch.py specs/a.json specs/b.json ... [--photos photos] [--out out]
"""
import argparse, json, sys
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
from edyx_carousel_kit import build, ROOT

ap = argparse.ArgumentParser(); ap.add_argument("specs", nargs="+")
ap.add_argument("--photos", default=str(ROOT / "photos")); ap.add_argument("--out", default=str(ROOT / "out"))
a = ap.parse_args(); out = Path(a.out); tik = out / "tiktok"; tik.mkdir(parents=True, exist_ok=True)
rows = []
for sp in a.specs:
    spec = json.load(open(sp, encoding="utf-8")); files, _ = build(spec, Path(a.photos), out)
    for f in files:
        Image.open(f).resize((1080, 1348), Image.LANCZOS).save(tik / f.name, quality=92)
    rows.append([Image.open(f).resize((300, 374)) for f in files])
w = max(len(r) for r in rows) * 300
sheet = Image.new("RGB", (w, 374 * len(rows)), "white")
for y, r in enumerate(rows):
    for x, im in enumerate(r): sheet.paste(im, (x * 300, y * 374))
sheet.save(out / "batch_preview.png"); print("preview ->", out / "batch_preview.png", "| tiktok copies ->", tik)
