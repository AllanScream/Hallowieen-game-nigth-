# overlay the sim's collision boxes / circles on a shot taken with the camera centred on Kolya (x, y): python3 tools/colov.py shot.png x y out.png
import sys, json, subprocess
from PIL import Image, ImageDraw
img, x, y, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
C, SN = 0.894, 0.447
P = lambda a, b: (C * (a + b), SN * (b - a))
q = P(x, y); cam = (q[0] - 960, q[1] - 590)
js = "global.window=global;require('./live/sim.js');const S=SIM;console.log(JSON.stringify({B:S.BOX,C:S.CIRC||[]}))"
d = json.loads(subprocess.check_output(['node', '-e', js]))
im = Image.open(img).convert('RGB'); g = ImageDraw.Draw(im)
S = lambda a, b: (P(a, b)[0] - cam[0], P(a, b)[1] - cam[1])
for b in d['B']:
    pts = [S(b[0], b[1]), S(b[2], b[1]), S(b[2], b[3]), S(b[0], b[3])]
    g.polygon(pts, outline=(0, 255, 255))
for c in d['C']:
    if c[2] <= 0: continue
    import math
    pts = [S(c[0] + c[2] * math.cos(t / 12 * math.pi), c[1] + c[2] * math.sin(t / 12 * math.pi)) for t in range(24)]
    g.polygon(pts, outline=(255, 0, 255))
im.save(out)
