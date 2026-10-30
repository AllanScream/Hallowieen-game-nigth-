# v12: slice the festival sheets and the second achievement sheet into art/gen pieces (sheets renamed *_sheet so prep skips them)
import numpy as np, os
from PIL import Image
from scipy import ndimage
G = 'art/gen'
LAB = {}
def comps(im, thr=24, grow=6, minpx=900):
    a = np.array(im)[:, :, 3] > thr; lab, n = ndimage.label(ndimage.binary_dilation(a, iterations=grow)); LAB[id(im)] = lab
    out = []
    for i, sl in enumerate(ndimage.find_objects(lab)):
        if sl is None: continue
        m = (lab[sl] == i + 1) & a[sl]
        if m.sum() < minpx: continue
        out.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop, int(m.sum()), i + 1))
    return out
def only(im, bs):                                       # keep just these components (neighbours' slivers inside the box go transparent)
    lab = LAB[id(im)]; keep = np.isin(lab, [b[5] for b in bs]); a = np.array(im); a[:, :, 3] = np.where(keep, a[:, :, 3], 0); return Image.fromarray(a)
def crop(im, b, pad=4): return im.crop((max(0, b[0] - pad), max(0, b[1] - pad), min(im.width, b[2] + pad), min(im.height, b[3] + pad)))
def src(n):
    p, q = f'{G}/{n}.png', f'{G}/{n}_sheet.png'
    if os.path.exists(p): os.replace(p, q)
    return Image.open(q).convert('RGBA')
# 1. festival props: 3 x 2 cells
im = src('fest_props'); names = [['fest_carve', 'fest_apples', 'fest_gacha'], ['fest_stage', 'fest_candy', 'fest_lanterns']]
cw, ch = im.width // 3, im.height // 2
for r in range(2):
    for c in range(3):
        cell = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)); bs = comps(cell); big = max(x[4] for x in bs); bs = [x for x in bs if x[4] > 0.12 * big]; cell = only(cell, bs)
        b = (min(x[0] for x in bs), min(x[1] for x in bs), max(x[2] for x in bs), max(x[3] for x in bs)); crop(cell, b).save(f'{G}/{names[r][c]}.png'); print(names[r][c], b)
# 2. festival UI: the big pumpkin, two apples, two stars (the capsules are drawn in code)
im = src('fest_ui'); bs = sorted(comps(im), key=lambda b: -b[4])
pk = bs[0]; crop(only(im, [pk]), pk).save(f'{G}/ui_pumpkin.png'); print('ui_pumpkin', pk)
top = sorted([b for b in bs[1:] if b[3] < im.height * 0.33], key=lambda b: b[0])
for n, b in zip(['ui_apple_r', 'ui_apple_g', 'ui_star_g', 'ui_star_s'], top): crop(only(im, [b]), b).save(f'{G}/{n}.png'); print(n, b)
# 3. achievements 16-20: one row of 5 tiles → a 5 x 1 atlas of 128 px cells
im = src('ach2'); bs = sorted([b for b in comps(im, grow=3) if b[4] > 8000], key=lambda b: b[0])[:5]
at = Image.new('RGBA', (640, 128), (0, 0, 0, 0))
for i, b in enumerate(bs): t = im.crop(b[:4]).resize((128, 128), Image.LANCZOS); at.alpha_composite(t, (i * 128, 0)); print('ach2', i, b)
at.save(f'{G}/ach_icons2.png')
