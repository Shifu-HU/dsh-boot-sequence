#!/usr/bin/env python3
"""Use the supplied whale-girl line art as the boot mascot.

The image is already cropped and already monochrome, so the only work is:
  * knock the white paper out to alpha (keeping interior white, e.g. apron)
  * trim the margin
  * save the webp the plugin ships

Placed bottom-right by the stylesheet; nothing here depends on the crop side.
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
DST = ROOT / "assets" / "mascot" / "whalegirl.png"
WEBP = ROOT / "assets" / "mascot" / "whalegirl.webp"

im = Image.open(SRC).convert("RGB")
W, H = im.size
px = im.load()

def near_white(x, y, tol=232):
    r, g, b = px[x, y]
    return r >= tol and g >= tol and b >= tol

# Flood fill from the border: only the *outside* paper becomes transparent, so
# white areas enclosed by line work (apron, collar) stay opaque.
outside = bytearray(W * H)
q = deque()
for x in range(W):
    for y in (0, H - 1):
        if near_white(x, y) and not outside[y * W + x]:
            outside[y * W + x] = 1
            q.append((x, y))
for y in range(H):
    for x in (0, W - 1):
        if near_white(x, y) and not outside[y * W + x]:
            outside[y * W + x] = 1
            q.append((x, y))

while q:
    x, y = q.popleft()
    for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
        if 0 <= nx < W and 0 <= ny < H:
            i = ny * W + nx
            if not outside[i] and near_white(nx, ny):
                outside[i] = 1
                q.append((nx, ny))

# Ink stays at full alpha. The source is line art on white, so render it as
# light ink on the dark boot surface: invert the luminance of the strokes.
gray = im.convert("L")
g = gray.load()

alpha = Image.new("L", (W, H), 0)
a = alpha.load()
for y in range(H):
    for x in range(W):
        if outside[y * W + x]:
            a[x, y] = 0
            continue
        v = g[x, y]
        # The source is a JPEG: paper is ~250-255 but carries compression
        # noise. Treat anything above 235 as paper, then ramp quickly so real
        # strokes reach full alpha instead of ghosting.
        if v >= 235:
            a[x, y] = 0
        elif v <= 120:
            a[x, y] = 255
        else:
            a[x, y] = int((235 - v) / 115 * 255)

alpha = alpha.filter(ImageFilter.GaussianBlur(radius=0.4))

INK = (238, 242, 247)
out = Image.new("RGBA", (W, H), INK + (0,))
out.putalpha(alpha)

bbox = alpha.getbbox()
if bbox:
    out = out.crop(bbox)

# fit a sensible on-screen height
ratio = 620 / out.height
out = out.resize((max(1, round(out.width * ratio)), 620), Image.LANCZOS)

DST.parent.mkdir(parents=True, exist_ok=True)
out.save(DST)
out.save(WEBP, "WEBP", quality=92, method=6)
print("wrote", DST, out.size, DST.stat().st_size, "bytes")
print("wrote", WEBP, WEBP.stat().st_size, "bytes")
