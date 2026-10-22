# slice the v10 costume sheets (art/gen/costume_*.png) into live/assets/cos_<kind>_<view>.png (views 0 front .. 4 back) and
# register them in live/assets.js; the ghost sheet loses the legs below its hem (the game draws Kolya's walking legs there)
import json, re, numpy as np
from PIL import Image
from scipy import ndimage
man = json.loads(re.sub(r'^window\.ASSETS = |;\s*$', '', open('live/assets.js').read().strip()))
meta = {}
def comps(a, minpx=800):
    lab, n = ndimage.label(ndimage.binary_dilation(a[:, :, 3] > 20, iterations=6))
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if (lab[sl] == i + 1).sum() < minpx: continue
        out.append(sl)
    return out
def save(name, im, scale=0.5):
    w, h = im.size; im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    im.save('live/assets/' + name + '.png'); man[name] = {'w': im.size[0], 'h': im.size[1], 'crop': [0, 0, w, h], 'scale': 1.0}
# ghost
a = np.asarray(Image.open('art/gen/costume_ghost.png').convert('RGBA')).copy()
sls = sorted(comps(a), key=lambda s: s[1].start)
assert len(sls) == 5, len(sls)
meta['ghost'] = []
for v, sl in enumerate(sls):
    c = a[sl].copy(); al = c[:, :, 3] > 40; lum = c[:, :, :3].astype(float) @ [0.3, 0.59, 0.11]
    light = al & (lum > 110); H = c.shape[0]; ground = np.where(al.any(1))[0][-1]; top = np.where(al.any(1))[0][0]
    lab, nl = ndimage.label(light); big = np.argmax(ndimage.sum(light, lab, range(1, nl + 1))) + 1; light = lab == big   # the sheet only (not the shoe soles)
    low = np.full(c.shape[1], -1)
    for x in range(c.shape[1]):
        r = np.where(light[:, x])[0]
        if len(r): low[x] = r[-1]
    for x in range(c.shape[1]):
        cut = low[x] + 3 if low[x] >= 0 else 0
        c[cut:, x, 3] = 0
    notch = int(np.percentile(low[low >= 0], 25))
    im = Image.fromarray(c)
    # keep the full box down to the ground so the game can stand the sprite on its feet
    meta['ghost'].append({'gf': round((ground + 1) / H, 4), 'tf': round(top / H, 4), 'hem': round((ground - notch) / (ground - top + 1), 3), 'cx': round(float(np.where(al[ground - 40:ground + 1].any(0))[0].mean()) / c.shape[1], 3)})
    save('cos_ghost_%d' % v, im)
# pumpkin helmet: 5 in a row
a = np.asarray(Image.open('art/gen/costume_pumpkin.png').convert('RGBA'))
sls = sorted(comps(a), key=lambda s: s[1].start); assert len(sls) == 5, len(sls)
for v, sl in enumerate(sls): save('cos_pumpkin_%d' % v, Image.fromarray(a[sl]))
# hats: two rows of five
a = np.asarray(Image.open('art/gen/costume_hats.png').convert('RGBA'))
sls = comps(a); rows = sorted(sls, key=lambda s: s[0].start); top5 = sorted([s for s in sls if s[0].stop < a.shape[0] * 0.5], key=lambda s: s[1].start); bot5 = sorted([s for s in sls if s[0].start >= a.shape[0] * 0.45], key=lambda s: s[1].start)
assert len(top5) == 5 and len(bot5) == 5, (len(top5), len(bot5))
for v, sl in enumerate(top5): save('cos_hat_%d' % v, Image.fromarray(a[sl]))
for v, sl in enumerate(bot5):
    c = a[sl]; save('cos_horns_%d' % v, Image.fromarray(c[: int(c.shape[0] * 0.5)]))          # horns + the top of the band only
open('live/assets.js', 'w').write('window.ASSETS = ' + json.dumps(man) + ';\n')
open('live/costumes.js', 'w').write('window.COSMETA = ' + json.dumps(meta) + ';\n')
print(json.dumps(meta))
