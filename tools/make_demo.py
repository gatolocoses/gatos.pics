#!/usr/bin/env python3
"""Build demo/demo.cmp — a synthetic demo package for gatos.pics.

All images are generated (gradients + shapes + noise): no real footage, no
personal data. The 'encode' variant differs from 'source' by blur + slight
noise so Diff/Crops have something honest to show.
"""
import base64, io, json, math, random, sys
from PIL import Image, ImageDraw, ImageFilter

W, H = 960, 540
FRAMES = [10, 20, 30, 40]
random.seed(7)

def base_image(seed):
    rng = random.Random(seed)
    im = Image.new("RGB", (W, H))
    px = im.load()
    hue = rng.random()
    for y in range(H):
        for x in range(0, W, 4):
            r = int(120 + 90*math.sin(x/W*math.pi + hue*6))
            g = int(110 + 80*math.sin(y/H*math.pi + hue*4))
            b = int(130 + 70*math.cos((x+y)/(W+H)*math.pi*2 + hue*3))
            for dx in range(4):
                if x+dx < W: px[x+dx, y] = (r, g, b)
    d = ImageDraw.Draw(im)
    for i in range(rng.randint(4, 7)):
        cx, cy = rng.randint(60, W-60), rng.randint(40, H-40)
        rad = rng.randint(25, 90)
        col = tuple(rng.randint(30, 255) for _ in range(3))
        if rng.random() < 0.5:
            d.ellipse([cx-rad, cy-rad, cx+rad, cy+rad], outline=col, width=rng.randint(3, 9))
        else:
            d.rectangle([cx-rad, cy-rad//2, cx+rad, cy+rad//2], outline=col, width=rng.randint(3, 9))
    d.text((24, 20), "demo sintética — nada real", fill=(255, 255, 255))
    return im

def encode_like(im):
    out = im.filter(ImageFilter.GaussianBlur(1.1))
    rng = random.Random(im.tobytes()[::997].__len__())
    px = out.load()
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            n = rng.randint(-6, 6)
            r, g, b = px[x, y]
            px[x, y] = (max(0, min(255, r+n)), max(0, min(255, g+n)), max(0, min(255, b+n)))
    return out

def to_dataurl(im):
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

images = {}
for i, f in enumerate(FRAMES):
    src = base_image(100 + i)
    images[f"src_{f}"] = to_dataurl(src)
    images[f"enc1_{f}"] = to_dataurl(encode_like(src))

# S2 real de los pares (mismo paquete que usa el pipeline local de referencia)
import subprocess, tempfile, json as _json, os as _os
VENV = _os.environ.get("GATOS_S2_PYTHON", "")
s2 = {}
if VENV and _os.path.exists(VENV):
    with tempfile.TemporaryDirectory() as td:
        paths = {}
        for i, f in enumerate(FRAMES):
            src = base_image(100 + i); enc = encode_like(src)
            pa, pb = f"{td}/{f}_a.png", f"{td}/{f}_b.png"
            src.save(pa); enc.save(pb)
            paths[f] = (pa, pb)
        code = (
            "import sys, json\n"
            "from ssimulacra2.ssimulacra2 import compute_ssimulacra2\n"
            "pairs = json.load(open(sys.argv[1]))\n"
            "print(json.dumps({k: round(compute_ssimulacra2(v[0], v[1]), 2) for k, v in pairs.items()}))\n"
        )
        mapping = {str(f): paths[f] for f in FRAMES}
        r = subprocess.run([VENV, "-c", code, "/dev/stdin"], input=_json.dumps(mapping),
                           capture_output=True, text=True)
        if r.returncode == 0:
            s2 = _json.loads(r.stdout.strip().splitlines()[-1])

metrics = {"per_frame": s2}
if s2:
    metrics["ssimulacra2"] = round(sum(s2.values()) / len(s2), 2)

pkg = {
  "format": "gatos.pics/cmp@1",
  "manifest": {
    "title": "gatos.pics — demo con cuadros sintéticos",
    "version": 1,
    "frames": FRAMES,
    "frame_labels": {str(f): f"demo {i+1}" for i, f in enumerate(FRAMES)},
    "variants": [
      {"id": "src", "name": "Fuente", "color": "#7bd389",
       "note": "referencia"},
      {"id": "enc1", "name": "Encode", "color": "#7bb3ff",
       "note": "desenfoque + ruido simulados",
       "cmd": "encoder --entrada in.png --crf 42 --preset demo --salida out.png",
       **({"metrics": metrics} if s2 else {})},
    ],
  },
  "images": images,
}

out = sys.argv[1] if len(sys.argv) > 1 else "demo/demo.cmp"
with open(out, "w") as f:
    json.dump(pkg, f)
print(f"{out}: {len(images)} images, {sum(len(v) for v in images.values())/1e6:.1f} MB of data URLs")
