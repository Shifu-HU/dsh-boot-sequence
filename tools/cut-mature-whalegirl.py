#!/usr/bin/env python3
"""Mature whale-girl bust as a colourless line drawing.

Edge-based extraction: the sheet's drawing lines are luminance discontinuities,
so a Sobel-like gradient isolates them while flat fills (white apron, blue hair)
drop out. The result is tinted to a single colour, so it is strictly monochrome.

A preview pair (on dark and on light) is written next to the asset so the look
can be judged before it ships.
"""
import sys
from pathlib import Path
from PIL import Image, ImageFilter, ImageChops, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
DST = ROOT / "assets" / "mascot" / "whalegirl.png"
PREV = ROOT / "out" / "mascot-preview.png"
INK = (238, 242, 247)

im = Image.open(SRC).convert("RGB")
W, H = im.size

box = (int(W * 0.02), int(H * 0.01), int(W * 0.298), int(H * 0.71))
cell = im.crop(box)
w, h = cell.size

# Hard guard against the side view: its silhouette begins well right of the
# front figure's centreline. Clip the working canvas at that seam so nothing
# from the neighbour can bleed in, whatever the algorithm does downstream.
seam = int(w * 0.955)
alpha_clip = int(w * 0.935)

gray = cell.convert("L")

# gradient magnitude via difference-of-blur, which is cheap and robust here
soft = gray.filter(ImageFilter.GaussianBlur(radius=1.6))
hard = gray.filter(ImageFilter.GaussianBlur(radius=4.5))
diff = ImageChops.difference(soft, hard)          # 0..255 ridges at edges

# stretch: ignore sub-noise, saturate real lines
lut = []
for v in range(256):
    if v <= 9:
        lut.append(0)          # fill texture and JPEG-ish noise die here
    elif v >= 40:
        lut.append(255)
    else:
        lut.append(int((v - 9) / 31 * 255))
alpha = diff.point(lut)

# suppress paper: a near-white pixel far from an edge contributes nothing
gp = gray.load()
ap = alpha.load()
for y in range(h):
    for x in range(w):
        if gp[x, y] > 240 and ap[x, y] < 90:
            ap[x, y] = 0
        # hard vertical seam: nothing to the right of it belongs to this view
        if x > alpha_clip:
            ap[x, y] = 0

alpha = alpha.filter(ImageFilter.MaxFilter(3))   # thicken hairlines
alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.4))

# Speckle removal: isolated pixels inside the face read as noise. A pixel that
# has fewer than 3 inked neighbours is dropped before the mass keep.
import numpy as np
arr = np.array(alpha, dtype=np.uint8)
ink = (arr > 60).astype(np.uint8)
# 3x3 neighbour count (sum of the box minus the centre)
pad = np.pad(ink, 1, mode='constant')
neigh = sum(pad[dy:dy + ink.shape[0], dx:dx + ink.shape[1]]
            for dy in range(3) for dx in range(3)) - ink
arr[(ink == 1) & (neigh < 3)] = 0
alpha = Image.fromarray(arr, mode="L")

# drop the neighbouring view that bleeds into the right edge: keep the largest
# connected ink mass and discard everything else
from collections import deque
px = alpha.load()
seen = bytearray(w * h)
best, best_size = [], 0
for sy in range(h):
    for sx in range(w):
        i0 = sy * w + sx
        if seen[i0] or px[sx, sy] < 40:
            continue
        comp, q = [], deque([(sx, sy)])
        seen[i0] = 1
        while q:
            x, y = q.popleft()
            comp.append((x, y))
            for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
                if 0 <= nx < w and 0 <= ny < h:
                    ni = ny * w + nx
                    if not seen[ni] and px[nx, ny] >= 40:
                        seen[ni] = 1
                        q.append((nx, ny))
        if len(comp) > best_size:
            best, best_size = comp, len(comp)

mask = Image.new("L", (w, h), 0)
mp = mask.load()
for x, y in best:
    mp[x, y] = px[x, y]
alpha = mask.filter(ImageFilter.MaxFilter(3))

bbox = alpha.getbbox()
if bbox:
    alpha = alpha.crop(bbox)

out = Image.new("RGBA", alpha.size, INK + (0,))
out.putalpha(alpha)
ratio = 520 / out.height
out = out.resize((max(1, round(out.width * ratio)), 520), Image.LANCZOS)

DST.parent.mkdir(parents=True, exist_ok=True)
out.save(DST)

# preview: the same art over the boot background and over white
PREV.parent.mkdir(parents=True, exist_ok=True)
dark = Image.new("RGB", out.size, (5, 8, 13))
dark.paste(out, (0, 0), out)
light = Image.new("RGB", out.size, (250, 250, 252))
light.paste(out, (0, 0), out)
sheet = Image.new("RGB", (out.width * 2 + 24, out.height), (26, 30, 38))
sheet.paste(dark, (0, 0))
sheet.paste(light, (out.width + 24, 0))
sheet.save(PREV)

print("wrote", DST, out.size, DST.stat().st_size, "bytes")
print("preview", PREV)
