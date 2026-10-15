# Measure placement anchors of generated set pieces -> live/anchors.js (window.ANCH).
# Houses: the front-left ground corner (lowest point of the left part) and the gable width -> scale.
import json, glob, os
import numpy as np
from PIL import Image
out = {}
OVR = {'house_kolya': (435 / 1089, 928 / 982)}
for f in sorted(glob.glob('live/assets/house_*.png')):
    n = os.path.basename(f)[:-4]
    a = np.array(Image.open(f).convert('RGBA'))[:, :, 3]
    H, W = a.shape
    bot = np.array([(np.where(a[:, x] > 128)[0].max() if (a[:, x] > 128).any() else -1) for x in range(W)])
    xs = np.where(bot >= 0)[0]; xl, xr = int(xs.min()), int(xs.max())
    cx = max(range(xl, xl + int(0.55 * (xr - xl))), key=lambda x: bot[x]); cy = int(bot[cx])
    im = np.array(Image.open(f).convert('RGBA')).astype(int)
    r, g, b = im[:, :, 0], im[:, :, 1], im[:, :, 2]
    warm = (r > 200) & (g > 110) & (b < 110) & (a > 200)
    from scipy import ndimage
    lab, k = ndimage.label(ndimage.binary_dilation(warm, iterations=5))
    lights = []
    for i in range(1, k + 1):
        yy, xx = np.where((lab == i) & warm)
        if len(xx) > 120: lights.append([int(xx.mean()), int(yy.mean()), int(len(xx))])
    lights.sort(key=lambda q: -q[2])
    out[n] = {'cx': int(cx), 'cy': cy, 'gw': int(cx - xl), 'w': W, 'h': H, 'lights': lights[:10]}
    if n in OVR:                                  # the porch continues the side wall: anchor the body corner instead of the porch corner
        fx, fy = OVR[n]; cx, cy = round(fx * W), round(fy * H); out[n].update(cx=cx, cy=cy, gw=cx - xl)
# coarse alpha masks (cell px of the trimmed texture) for hit tests in the sim: houses and trees
def mask(path, cell):
    a = np.array(Image.open(path).convert('RGBA'))[:, :, 3]; H, W = a.shape; rows = []
    for y in range(0, H, cell):
        rows.append(''.join('1' if (a[y:y + cell, x:x + cell] > 100).mean() > 0.4 else '0' for x in range(0, W, cell)))
    return {'w': W, 'h': H, 'cell': cell, 'rows': rows}
for f in sorted(glob.glob('live/assets/house_*.png')):
    n = os.path.basename(f)[:-4]; out[n]['mask'] = mask(f, 12)
for n in ['tree_a', 'tree_b']:
    f = 'live/assets/%s.png' % n
    if os.path.exists(f): out[n] = {'mask': mask(f, 10)}; out[n]['w'] = out[n]['mask']['w']; out[n]['h'] = out[n]['mask']['h']
open('live/anchors.js', 'w').write('(typeof window !== "undefined" ? window : globalThis).ANCH = ' + json.dumps(out) + ';\n')
print(json.dumps(out, indent=0)[:600])
