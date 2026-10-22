# per-frame head centre of Kolya's frame atlases (relative to the feet anchor, atlas px) -> live/khead.js (window.KHEAD[name] = [[dx, dy], ...])
import json, re, sys, numpy as np
from PIL import Image
s = open('live/kframes.js').read(); KF = json.loads(s[s.find('{'):s.rfind('}') + 1])
out = {}
for n, m in KF.items():
    if not re.match(r'(k16|k16t|k16r|k16c|ka)_[pm]\d+w$', n): continue
    im = np.asarray(Image.open('live/assets/' + n + '.png').convert('RGBA'))[:, :, 3] > 100
    fw, fh, h = m['fw'], m['fh'], m['h']; res = []
    for i in range(m['n']):
        f = im[:, i * fw:(i + 1) * fw]; rows = np.where(f.sum(1) >= 3)[0]
        if not len(rows): res.append(None); continue
        top = rows[0]; xs = []
        for r in range(int(top + 0.04 * h), int(top + 0.12 * h)):
            c = np.where(f[r])[0]
            if len(c): xs.append((c[0] + c[-1]) / 2)
        cx = float(np.median(xs)) if xs else m['ax']; cy = top + 0.085 * h
        res.append([round(cx - m['ax'], 1), round(cy - m['ay'], 1)])
    out[n] = res
# the action atlases (arms over the head, crouching): find the head by matching the idle frame's head patch of the same yaw
from numpy.lib.stride_tricks import sliding_window_view as swv
for n in list(out):
    if not n.startswith('ka_'): continue
    ref = 'k16_' + n[3:]; m = KF[n]; mr = KF[ref]
    R = np.asarray(Image.open('live/assets/' + ref + '.png').convert('RGBA')).astype(np.float32); hp = out[ref][8]; hs = int(0.17 * mr['h'])
    cx, cy = int(8 * mr['fw'] + mr['ax'] + hp[0]), int(mr['ay'] + hp[1]); P = R[cy - hs // 2:cy + hs // 2, cx - hs // 2:cx + hs // 2]
    A = np.asarray(Image.open('live/assets/' + n + '.png').convert('RGBA')).astype(np.float32); res = []
    for i in range(m['n']):
        F = A[:, i * m['fw']:(i + 1) * m['fw']]; fa = F[:, :, 3:4] / 255; pa = P[:, :, 3:4] / 255
        Fp = F[:, :, :3] * fa; Pp = P[:, :, :3] * pa
        W = swv(Fp[:int(0.75 * m['fh'])], (P.shape[0], P.shape[1], 3))[:, :, 0]          # (Y, X, ph, pw, 3)
        d = ((W[::2, ::2] - Pp) ** 2).mean(axis=(2, 3, 4)); y, x = np.unravel_index(np.argmin(d), d.shape)
        res.append([round(x * 2 + P.shape[1] / 2 - m['ax'], 1), round(y * 2 + P.shape[0] / 2 - m['ay'], 1)])
    out[n] = res
open('live/khead.js', 'w').write('(typeof window!=="undefined"?window:globalThis).KHEAD = ' + json.dumps(out, separators=(',', ':')) + ';\n')
print(len(out), 'atlases')
if len(sys.argv) > 1:   # debug: draw the head points on a sheet
    from PIL import ImageDraw
    n = sys.argv[1]; m = KF[n]; im = Image.open('live/assets/' + n + '.png').convert('RGBA'); bg = Image.new('RGBA', im.size, (60, 90, 60, 255)); bg.alpha_composite(im); g = ImageDraw.Draw(bg)
    for i, p in enumerate(out[n]):
        if p: x, y = i * m['fw'] + m['ax'] + p[0], m['ay'] + p[1]; g.ellipse([x - 0.09 * m['h'], y - 0.09 * m['h'], x + 0.09 * m['h'], y + 0.09 * m['h']], outline=(255, 0, 0), width=2)
    bg.convert('RGB').save(sys.argv[2])
