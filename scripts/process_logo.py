from PIL import Image

src = r"C:\Users\Marcos\Documents\sgs\totem\assets\logo-cartorio.png"
# Prefer original if still available as backup; otherwise current
import os
candidates = [
    r"C:\Users\Marcos\Documents\sgs\assets\logo-cartorio-original.png",
    r"C:\Users\Marcos\Documents\sgs\totem\assets\logo-cartorio.png",
]
for c in candidates:
    if os.path.exists(c):
        # if already processed (no blue), still process black
        src = c
        break

# Try to fetch from git history? Use current file.
src = r"C:\Users\Marcos\Documents\sgs\painel\assets\logo-cartorio.png"
paths = [
    r"C:\Users\Marcos\Documents\sgs\totem\assets\logo-cartorio.png",
    r"C:\Users\Marcos\Documents\sgs\painel\assets\logo-cartorio.png",
]

img = Image.open(src).convert("RGBA")
pixels = img.load()
w, h = img.size


def is_bg(px):
    r, g, b, a = px
    if a < 12:
        return True
    # near black
    if r < 35 and g < 35 and b < 35:
        return True
    # blue square leftover
    if b > 90 and b > r + 30 and b > g + 20:
        return True
    if b > 120 and r < 80 and g < 120:
        return True
    return False


out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
out_px = out.load()
for y in range(h):
    for x in range(w):
        p = pixels[x, y]
        out_px[x, y] = (0, 0, 0, 0) if is_bg(p) else p

bbox = out.getbbox()
if bbox:
    out = out.crop(bbox)

for p in paths:
    out.save(p, "PNG")
    print("saved", p, out.size)

# Also save a dark-bg version for print/ticket if needed - skip
