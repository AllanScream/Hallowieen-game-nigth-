# Kolya frame sheets (art/gen/kw_<view>_<kind>.png, 4x2 generated sheets) -> normalized atlases art/gen/kf_<view>_<kind>.png
# + live/kframes.js (window.KFR): frame box, anchor, phone-LED points. Walk/carry frames are anchored by the head (no body
# jitter), action frames by the feet (planted) shifted by the idle head-feet offset; every frame's lowest pixel is the ground.
import json, glob, os
import numpy as np
from PIL import Image
from scipy import ndimage
TH = 300                       # normalized standing height (px) in the atlas
VIEWS = ['e', 'se', 's', 'ne', 'n']
def figures(path, cols=4):
    # cut by the emptiest row between the two figure rows, then by the emptiest columns near the cell borders of each row
    im = Image.open(path).convert('RGBA'); a = np.array(im); al = a[:, :, 3] > 40; H, W = al.shape
    rp = ndimage.uniform_filter1d(al.sum(1).astype(float), 9); lo, hi = int(H * 0.3), int(H * 0.7); ycut = lo + int(np.argmin(rp[lo:hi]))
    out = []
    for (r0, r1) in ((0, ycut), (ycut, H)):
        band = al[r0:r1]; cp = ndimage.uniform_filter1d(band.sum(0).astype(float), 9); cuts = [0]
        for j in range(1, cols):
            q = j / cols; wd = int(W / cols * 0.45); c0, c1 = int(W * q - wd), int(W * q + wd); cuts.append(c0 + int(np.argmin(cp[c0:c1])))
        cuts.append(W)
        for i in range(cols):
            mask = np.zeros_like(al); mask[r0:r1, cuts[i]:cuts[i + 1]] = band[:, cuts[i]:cuts[i + 1]]
            lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=3))
            if n > 1:                                   # drop crumbs from neighbouring cells, keep the figure and its props
                sizes = ndimage.sum(mask, lab, range(1, n + 1)); keep = [j + 1 for j, z in enumerate(sizes) if z > 0.02 * sizes.max()]
                mask = mask & np.isin(lab, keep)
            ys, xs = np.where(mask)
            if len(ys): out.append((ys.min(), ys.max(), xs.min(), xs.max(), mask))
    return a, out
def measure(mask, y0, y1):
    h = y1 - y0 + 1; ys, xs = np.where(mask)
    hd = xs[ys < y0 + 0.12 * h]; ft = xs[ys > y1 - 0.06 * h]
    return float(np.median(hd)), float(ft.mean()), h
meta = {}
JOBS = [(f'kf_{v}', v, {k: f'art/gen/kw_{v}_{k}.png' for k in ('walk', 'act', 'carry')}) for v in VIEWS] + [('rf_se', 'se', {'act': 'art/gen/rv_act.png'}), ('ef_se', 'se', {'act': 'art/gen/el_act.png'})]   # Kolya; Raiva, Elf at their doors
for prefix, v, srcs in JOBS:
    sheets = {k: figures(f) for k, f in srcs.items() if os.path.exists(f)}
    # the idle frame (act #1) fixes the head-over-feet offset of this view
    a0, fr0 = sheets['act']; y0, y1, x0, x1, m0 = fr0[0]; hx0, fx0, h0 = measure(m0[y0:y1 + 1, :][:, :], 0, y1 - y0)
    for kind, (a, frs) in sheets.items():
        if len(frs) != 8: print('WARN', v, kind, len(frs), 'figures')
        hs = [f[1] - f[0] + 1 for f in frs]
        ref = (frs[0][1] - frs[0][0] + 1) if kind == 'act' else float(np.median(hs)) / 0.985
        s = TH / ref
        if kind == 'act': y0, y1, x0, x1, mm = frs[0]; hxa, fxa, _ = measure(mm[y0:y1 + 1], 0, y1 - y0); off = (hxa - fxa) * s
        crops = []
        for (y0, y1, x0, x1, mask) in frs:
            sub = a[y0:y1 + 1, x0:x1 + 1].copy(); mk = mask[y0:y1 + 1, x0:x1 + 1]; sub[~mk] = 0
            hx, fx, h = measure(mk, 0, y1 - y0)
            ax = (fx + off / s) if kind == 'act' else ((hx + fx) / 2 if v in ('s', 'n') else hx)   # anchor x in crop px (front/back: between head and feet)
            img = Image.fromarray(sub).resize((max(1, round(sub.shape[1] * s)), max(1, round(sub.shape[0] * s))), Image.LANCZOS)
            # phone LED: the brightest near-white cluster above the waist
            arr = np.array(img).astype(int); lum = arr[:, :, :3].sum(2); sat = arr[:, :, :3].max(2) - arr[:, :, :3].min(2)
            cand = (lum > 640) & (sat < 60) & (arr[:, :, 3] > 200); cand[int(img.height * 0.6):] = False
            led = None
            if cand.sum() > 6: yy, xx = np.where(cand); led = [float(xx.mean()), float(yy.mean())]
            crops.append((img, ax * s, led))
        L = max(c[1] for c in crops) + 8; R = max(c[0].width - c[1] for c in crops) + 8; T = max(c[0].height for c in crops) + 10
        fw, fh = int(np.ceil(L + R)), int(np.ceil(T)); n = len(crops)
        atlas = Image.new('RGBA', (fw * n, fh), (0, 0, 0, 0)); leds = []
        for i, (img, ax, led) in enumerate(crops):
            ox = round(i * fw + L - ax); oy = fh - img.height - 2; atlas.alpha_composite(img, (ox, oy))
            leds.append([round(ox - i * fw + led[0] - L, 1), round(oy + led[1] - (fh - 2), 1)] if led else None)
        name = f'{prefix}_{kind}'; atlas.save(f'art/gen/{name}.png', optimize=True)
        meta[name] = {'n': n, 'fw': fw, 'fh': fh, 'ax': round(L, 1), 'ay': fh - 2, 'h': TH, 'led': leds}
        print(name, n, fw, fh, 'scale %.3f' % s)
# ---- 16-direction walk + idle sheets (art/gen/k16_<tag>.png, 5 x 2: 8 walk frames + 2 idle), poses from tools/mannequin.py ----
# One scale per sheet from the idle height (same standing height in every direction). Every frame is anchored by the HEAD:
# x = head centre, y = head top + the idle head-to-ground height -> no horizontal or vertical jitter between frames or views
# (the iso front foot reaching lower on screen no longer lifts the body).
def headtop(mk):
    rows = mk.sum(1); thr = max(6, 0.12 * rows.max()); return int(np.argmax(rows >= thr))
def headx(mk, t, h):
    ys, xs = np.where(mk[t:t + int(0.16 * h)]); return float(xs.mean())
T9 = ('p0', 'p22', 'p45', 'p67', 'p90', 'm22', 'm45', 'm67', 'm90')
T17 = T9 + ('p11', 'p33', 'p56', 'p78', 'm11', 'm33', 'm56', 'm78')                # 32 directions: the in-between facings
W10 = [(f'art/gen/{c}_{t}.png', f'{c}_{t}w') for c in ('k16', 'k16t', 'k16r') for t in T17] + [(f'art/gen/k16c_{t}.png', f'k16c_{t}w') for t in T9] + \
      [(f'art/gen/{c}_{t}.png', f'{c}_{t}w') for c in ('pw', 'sw') for t in ('p0', 'p45', 'p90', 'm45', 'm90')]     # Kolya 16 dirs; Elf's raid: police, soldiers
for f, name in W10:
    if not os.path.exists(f): continue
    a, frs = figures(f, cols=5)
    if len(frs) != 10: print('WARN', name, len(frs), 'figures')
    y0, y1, x0, x1, m = frs[8]; mk = m[y0:y1 + 1, x0:x1 + 1]; hidle = (y1 - y0) - headtop(mk)   # idle: head top -> ground
    s = TH / hidle; crops = []
    for (y0, y1, x0, x1, mask) in frs:
        sub = a[y0:y1 + 1, x0:x1 + 1].copy(); mk = mask[y0:y1 + 1, x0:x1 + 1]; sub[~mk] = 0
        t = headtop(mk); hx = headx(mk, t, hidle)
        img = Image.fromarray(sub).resize((max(1, round(sub.shape[1] * s)), max(1, round(sub.shape[0] * s))), Image.LANCZOS)
        led = None
        arr = np.array(img).astype(int) if name[:3] in ('pw_', 'k16') else None
        if name.startswith('pw_'):                                # the police flashlight's lit tip: the brightest warm-yellow cluster
            cand = (arr[:, :, 0] > 225) & (arr[:, :, 1] > 175) & (arr[:, :, 2] < 170) & (arr[:, :, 3] > 200)
            if cand.sum() > 3: yy, xx = np.where(cand); led = [float(xx.mean()), float(yy.mean())]
        elif name.startswith('k16t_'):                            # Kolya's phone flashlight: the brightest near-white cluster above the hips
            lum = arr[:, :, :3].sum(2); sat = arr[:, :, :3].max(2) - arr[:, :, :3].min(2); cand = (lum > 650) & (sat < 70) & (arr[:, :, 3] > 200); cand[int(img.height * 0.62):] = False
            if cand.sum() > 2: yy, xx = np.where(cand); led = [float(xx.mean()), float(yy.mean())]
        elif name.startswith('k16r_'):                            # the airsoft rifle's orange muzzle tip
            cand = (arr[:, :, 0] > 200) & (arr[:, :, 1] > 70) & (arr[:, :, 1] < 175) & (arr[:, :, 2] < 90) & (arr[:, :, 0] - arr[:, :, 2] > 140) & (arr[:, :, 3] > 200)
            cand[:int(img.height * 0.2)] = False
            if cand.sum() > 3:
                from scipy import ndimage as nd
                lab, k = nd.label(cand); sz = nd.sum(cand, lab, range(1, k + 1)); j = int(np.argmax(sz)) + 1; yy, xx = np.where(lab == j); led = [float(xx.mean()), float(yy.mean())]
        crops.append((img, hx * s, t * s, led))                 # anchor x, head-top y (scaled crop px), torch tip
    L = max(c[1] for c in crops) + 6; R = max(c[0].width - c[1] for c in crops) + 6
    top = max(c[2] for c in crops) + 4; bot = max(c[0].height - c[2] - TH for c in crops) + 4     # room above the head / below ground
    fw, fh = int(np.ceil(L + R)), int(np.ceil(top + TH + bot)); n = len(crops)
    atlas = Image.new('RGBA', (fw * n, fh), (0, 0, 0, 0))
    leds = []
    for i, (img, ax, ty, led) in enumerate(crops):
        ox, oy = round(i * fw + L - ax), round(top - ty); atlas.alpha_composite(img, (ox, oy))
        leds.append([round(ox - i * fw + led[0] - L, 1), round(oy + led[1] - (top + TH), 1)] if led else None)
    if name.startswith(('k16t_', 'k16r_')) and any(leds):        # Kolya's light / muzzle: a stray or missing point takes the sheet's median
        ok = [l for l in leds if l]; mx, my = float(np.median([l[0] for l in ok])), float(np.median([l[1] for l in ok]))
        leds = [l if l and abs(l[0] - mx) < 30 and abs(l[1] - my) < 30 else [round(mx, 1), round(my, 1)] for l in leds]
    atlas.save(f'art/gen/{name}.png', optimize=True)
    meta[name] = {'n': n, 'fw': fw, 'fh': fh, 'ax': round(L, 1), 'ay': round(top + TH, 1), 'h': TH, 'led': leds}
    print(name, n, fw, fh, 'scale %.3f' % s, 'feet below ground (px):', [round(c[0].height - c[2] - TH) for c in crops])
# ---- 16-direction action sheets (art/gen/ka_<tag>.png, 3 x 2: idle, throw wind-up / release / follow-through, reach, crouch) ----
# Feet planted: every frame is placed by its feet (+ the idle head-over-feet offset) and stands on its lowest pixel; one scale per sheet
for t in T9:
    f = f'art/gen/ka_{t}.png'
    if not os.path.exists(f): continue
    a, frs = figures(f, cols=3)
    if len(frs) != 6: print('WARN', f, len(frs), 'figures')
    y0, y1, x0, x1, m = frs[0]; mk0 = m[y0:y1 + 1, x0:x1 + 1]; hidle = (y1 - y0) - headtop(mk0); s = TH / hidle
    hx0, fx0, _ = measure(mk0, 0, y1 - y0); off = (hx0 - fx0) * s
    crops = []
    for (y0, y1, x0, x1, mask) in frs:
        sub = a[y0:y1 + 1, x0:x1 + 1].copy(); mk = mask[y0:y1 + 1, x0:x1 + 1]; sub[~mk] = 0
        _, fx, _ = measure(mk, 0, y1 - y0); img = Image.fromarray(sub).resize((max(1, round(sub.shape[1] * s)), max(1, round(sub.shape[0] * s))), Image.LANCZOS)
        crops.append((img, fx * s + off))
    L = max(c[1] for c in crops) + 8; R = max(c[0].width - c[1] for c in crops) + 8; T = max(c[0].height for c in crops) + 10
    fw, fh = int(np.ceil(L + R)), int(np.ceil(T)); n = len(crops); atlas = Image.new('RGBA', (fw * n, fh), (0, 0, 0, 0))
    for i, (img, ax) in enumerate(crops): atlas.alpha_composite(img, (round(i * fw + L - ax), fh - img.height - 2))
    name = f'ka_{t}w'; atlas.save(f'art/gen/{name}.png', optimize=True)
    meta[name] = {'n': n, 'fw': fw, 'fh': fh, 'ax': round(L, 1), 'ay': fh - 2, 'h': TH, 'led': [None] * n}
    print(name, n, fw, fh, 'scale %.3f' % s)
open('live/kframes.js', 'w').write('(typeof window!=="undefined"?window:globalThis).KFR = ' + json.dumps(meta) + ';\n')
