# 3D mannequin pose guides for the generator: a walk cycle (8 frames) + 2 idle frames per facing azimuth, rendered with the
# game's camera (orthographic, 30 deg down, the same as the 2:1 iso). Gives the image model exact, distinct poses per frame and
# the same gait phase in every direction (so the walk can switch view mid-stride). Red = right limbs, blue = left limbs.
#   python3 tools/mannequin.py PHI_DEG [out.png] [--cols 5] [--frames walk|actions]
import sys, math
from PIL import Image, ImageDraw, ImageFont
ALPHA = math.radians(30)
H_PX = 400                                  # mannequin height in px
STRIDE = 0.70                               # full gait cycle travel / height (step = 0.35 H)
DUTY = 0.6
def vec(a, b, k=1): return (a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k)
def ik(hip, ank, l1, l2, fwd):
    dx, dy, dz = ank[0] - hip[0], ank[1] - hip[1], ank[2] - hip[2]; d = math.sqrt(dx * dx + dy * dy + dz * dz); d = min(d, (l1 + l2) * 0.999)
    a = math.acos(max(-1, min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))))
    u = (dx / d, dy / d, dz / d)
    # bend direction: forward component orthogonal to the leg direction
    dot = fwd[0] * u[0] + fwd[1] * u[1] + fwd[2] * u[2]; n = (fwd[0] - dot * u[0], fwd[1] - dot * u[1], fwd[2] - dot * u[2]); nl = math.sqrt(sum(c * c for c in n)) or 1; n = tuple(c / nl for c in n)
    return vec(hip, tuple(l1 * (math.cos(a) * u[i] + math.sin(a) * n[i]) for i in range(3)))
def foot(p):
    p %= 1
    if p < DUTY: return (STRIDE * DUTY / 2) * (1 - 2 * p / DUTY), 0.0
    q = (p - DUTY) / (1 - DUTY); e = q * q * (3 - 2 * q); return (STRIDE * DUTY / 2) * (-1 + 2 * e), 0.07 * EXAG * math.sin(math.pi * q)
HOLD = None                                 # None | 'torch' (right hand holds a flashlight forward) | 'rifle' (both hands, low ready) | 'rifle2' (hip ready, level)
NOPOINT = False                             # --nopoint: frame 10 is a breathing variation, not the «Стоять!» gesture (Kolya)
EXAG = 1.0                                  # --exag K: a game-readable walk for front / back views (higher knee lift, hip sway, wider arm swing)
def pose(p, phi, idle=0):
    f = (math.cos(phi), math.sin(phi), 0.0); lf = (math.sin(phi), -math.cos(phi), 0.0); up = (0, 0, 1)
    W0 = lambda x, y, z: (x * f[0] + y * lf[0], x * f[1] + y * lf[1], z)
    W = W0
    walk = idle == 0
    pz = 0.53 - (0.012 * EXAG * (0.5 + 0.5 * math.cos(4 * math.pi * p)) if walk else 0.0)
    yaw = 0.09 * EXAG * math.sin(2 * math.pi * p) if walk else 0.0
    sway = 0.022 * (EXAG - 1) * math.sin(2 * math.pi * p) if walk else 0.0      # weight shifts over the stance foot
    J = {}
    for side, s, off in (('R', -1, 0.0), ('L', 1, 0.5)):
        fx, lift = foot(p + off) if walk else (0.0, 0.0)
        hipx = -math.sin(yaw) * 0.09 * s; hip = W(hipx, 0.09 * s - sway, pz)
        ank = W(fx, 0.085 * s, 0.045 + lift) if walk else W(0.0 + (0.02 if idle == 2 and side == 'L' else 0), 0.11 * s, 0.045)
        knee = ik(hip, ank, 0.255, 0.245, f)
        toe_pitch = max(0.0, -fx) * 1.2 if walk and lift == 0 else 0.0
        toe = vec(ank, W(0.11, 0, -0.03 + toe_pitch * 0.05))
        J['hip' + side], J['knee' + side], J['ank' + side], J['toe' + side] = hip, knee, ank, toe
    pel = W(0, -sway, pz); neck = W(0.03 if walk else 0.0, -sway * 0.8, pz + 0.30); head = W(0.035 if walk else 0.0, -sway * 0.7, pz + 0.39)
    J['pel'], J['neck'], J['head'] = pel, neck, head
    for side, s, off in (('R', -1, 0.5), ('L', 1, 0.0)):
        sh = W(math.sin(yaw) * 0.12 * s * -0.6, 0.155 * s - sway * 0.8, pz + 0.27)
        sw = (0.38 * min(1.4, EXAG) * math.sin(2 * math.pi * (p + off)) if walk else 0.0) + (0.12 if idle == 2 and side == 'R' and not HOLD else 0)
        fa = sw + (0.35 if walk else 0.15); inward = 0.0
        held = (HOLD in ('torch', 'phone') and side == 'R') or HOLD in ('rifle', 'rifle2')
        if held: sw = {'rifle2': 0.42, 'phone': 0.62}.get(HOLD, 0.25) + (0.04 * math.sin(4 * math.pi * p) if walk else 0); fa = {'rifle2': 1.55, 'phone': 1.95}.get(HOLD, 1.4); inward = 0.06 if HOLD in ('rifle', 'rifle2') else 0.04 if HOLD == 'phone' else 0.02
        if HOLD and idle == 2 and side == 'L' and not NOPOINT: sw, fa, inward = 1.45, 1.5, 0.03          # pointing forward: «Стоять!»
        el = vec(sh, W(0.17 * math.sin(sw), 0.02 * s, -0.17 * math.cos(sw)))
        hd = vec(el, W(0.155 * math.sin(fa), -inward * s, -0.155 * math.cos(fa)))
        J['sh' + side], J['el' + side], J['hand' + side] = sh, el, hd
    if HOLD == 'pumpkin':                                         # both hands hold a big pumpkin in front of the belly
        for side, s in (('R', -1), ('L', 1)):
            sh = J['sh' + side]; hd = W(0.2, 0.07 * s, pz + 0.07 + (0.006 * math.sin(4 * math.pi * p) if walk else 0))
            J['el' + side] = vec(sh, W(0.07, 0.04 * s, -0.15)); J['hand' + side] = hd
        c = W(0.25, 0.0, pz + 0.1); J['tool'] = (vec(c, W(0, -0.04, 0)), vec(c, W(0, 0.04, 0)), 0.2, (230, 120, 30))
    if HOLD == 'torch': J['tool'] = (J['handR'], vec(J['handR'], W(0.12, 0.0, -0.01)), 0.035, (250, 230, 120))
    if HOLD == 'phone': J['tool'] = (vec(J['handR'], W(0.0, 0.0, -0.02)), vec(J['handR'], W(0.02, 0.0, 0.07)), 0.05, (250, 230, 120))   # a phone held up at chest height, its light forward
    if HOLD in ('rifle', 'rifle2'):                              # low ready: muzzle forward-down; rifle2: hip ready, level, stock under the arm
        if HOLD == 'rifle': a = vec(J['handR'], W(-0.09, -0.02, 0.06)); b = vec(J['handR'], W(0.24, 0.10, -0.17))
        else: a = vec(J['handR'], W(-0.15, 0.0, 0.05)); b = vec(J['handR'], W(0.2, 0.05, -0.06))
        J['tool'] = (a, b, 0.04, (40, 40, 44))
        if idle != 2 or NOPOINT:
            hl = tuple(J['handR'][i] + (b[i] - J['handR'][i]) * 0.5 for i in range(3)); sh = J['shL']
            J['handL'] = hl; J['elL'] = vec(tuple((sh[i] + hl[i]) / 2 for i in range(3)), W(0.0, 0.05, -0.07))
    return J, f
ACT = [  # per frame: feet R/L (fwd, left, up), pelvis (fwd, up), neck lean fwd, right elbow / hand, left elbow / hand (offsets from the shoulder / elbow)
    dict(fR=(0, -0.11, 0.045), fL=(0, 0.11, 0.045), pel=(0, 0.53), lean=0.0, eR=(0.0, -0.02, -0.17), hR=(0.02, 0, -0.155), eL=(0.0, 0.02, -0.17), hL=(0.02, 0, -0.155)),
    dict(fR=(-0.16, -0.1, 0.045), fL=(0.17, 0.1, 0.045), pel=(-0.02, 0.51), lean=-0.04, eR=(-0.12, -0.05, 0.05), hR=(-0.06, 0.0, 0.14), eL=(0.15, 0.03, -0.05), hL=(0.14, 0.0, 0.0)),
    dict(fR=(-0.16, -0.1, 0.045), fL=(0.17, 0.1, 0.045), pel=(0.04, 0.51), lean=0.07, eR=(0.12, 0.02, 0.08), hR=(0.15, 0.02, 0.05), eL=(-0.08, 0.04, -0.14), hL=(-0.07, 0.0, -0.12)),
    dict(fR=(-0.2, -0.1, 0.1), fL=(0.2, 0.1, 0.045), pel=(0.07, 0.5), lean=0.12, eR=(0.12, 0.08, -0.1), hR=(0.06, 0.1, -0.12), eL=(-0.03, 0.05, -0.16), hL=(0.04, 0.0, -0.15)),
    dict(fR=(0.06, -0.1, 0.045), fL=(-0.06, 0.1, 0.045), pel=(0.01, 0.53), lean=0.04, eR=(0.16, 0.02, -0.03), hR=(0.15, 0.01, 0.01), eL=(0.0, 0.02, -0.17), hL=(0.03, 0, -0.15)),
    dict(fR=(0.04, -0.13, 0.045), fL=(0.13, 0.12, 0.045), pel=(-0.05, 0.33), lean=0.12, eR=(0.13, 0.02, -0.09), hR=(0.11, 0.0, -0.1), eL=(0.11, 0.02, -0.1), hL=(0.07, 0.0, -0.06)),
]
def pose_act(k, phi):
    f = (math.cos(phi), math.sin(phi), 0.0); lf = (math.sin(phi), -math.cos(phi), 0.0)
    W = lambda x, y, z: (x * f[0] + y * lf[0], x * f[1] + y * lf[1], z)
    A = ACT[k]; px, pz = A['pel']; J = {}
    for side, s in (('R', -1), ('L', 1)):
        hip = W(px, 0.09 * s, pz); fx, fy, fz = A['f' + side]; ank = W(fx, fy, fz)
        J['hip' + side], J['ank' + side] = hip, ank; J['knee' + side] = ik(hip, ank, 0.255, 0.245, f); J['toe' + side] = vec(ank, W(0.11, 0, -0.03))
    lean = A['lean']; J['pel'] = W(px, 0, pz); J['neck'] = W(px + lean, 0, pz + 0.30); J['head'] = W(px + lean * 1.3 + 0.01, 0, pz + 0.39)
    for side, s in (('R', -1), ('L', 1)):
        sh = W(px + lean * 0.9, 0.155 * s, pz + 0.27); ex, ey, ez = A['e' + side]; hx, hy, hz = A['h' + side]
        el = vec(sh, W(ex, ey * -s if False else ey * (1 if side == 'L' else -1), ez)); hd = vec(el, W(hx, hy * (1 if side == 'L' else -1), hz))
        J['sh' + side], J['el' + side], J['hand' + side] = sh, el, hd
    if k in (1, 2): J['tool'] = (J['handR'], vec(J['handR'], W(0.0, 0.0, 0.03)), 0.06, (245, 240, 225))      # the egg in the hand
    return J, f
def sheet_act(phi_deg, out, cols=3, rows=2):
    phi = math.radians(phi_deg); W, Hh = 1536, 1024; cw, ch = W // cols, Hh // rows
    im = Image.new('RGB', (W, Hh), (236, 236, 240)); d = ImageDraw.Draw(im)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
    except Exception: font = None
    for k in range(cols * rows):
        c, r = k % cols, k // cols; x0, y0 = c * cw, r * ch; gy = y0 + ch - 44; cx = x0 + cw / 2
        d.rectangle((x0 + 4, y0 + 4, x0 + cw - 4, y0 + ch - 4), outline=(170, 170, 185), width=3); d.line((x0 + 16, gy, x0 + cw - 16, gy), fill=(120, 120, 135), width=3)
        J, f = pose_act(k, phi); draw(d, J, f, cx, gy); d.text((x0 + 12, y0 + 10), str(k + 1), fill=(60, 60, 90), font=font)
    im.save(out)
def proj(P, cx, gy):
    X, Y, Z = P; return (cx + X * H_PX, gy + (Y * math.sin(ALPHA) - Z * math.cos(ALPHA)) * H_PX), Y * math.cos(ALPHA) + Z * math.sin(ALPHA)
def draw(d, J, f, cx, gy):
    segs = []
    C = {'R': (205, 70, 60), 'L': (60, 110, 210)}
    for s in 'RL':
        segs += [(J['hip' + s], J['knee' + s], 0.075, C[s]), (J['knee' + s], J['ank' + s], 0.065, C[s]), (J['ank' + s], J['toe' + s], 0.05, tuple(int(c * 0.7) for c in C[s])),
                 (J['sh' + s], J['el' + s], 0.055, C[s]), (J['el' + s], J['hand' + s], 0.045, C[s])]
    segs.append((J['pel'], J['neck'], 0.2, (150, 150, 158)))
    if 'tool' in J: a, b, w, col = J['tool']; segs.append((a, b, w, col))
    segs.append((J['hipR'], J['hipL'], 0.12, (130, 130, 138))); segs.append((J['shR'], J['shL'], 0.1, (150, 150, 158)))
    items = []
    for a, b, w, col in segs:
        (pa, da), (pb, db) = proj(a, cx, gy), proj(b, cx, gy); items.append(((da + db) / 2, 'seg', pa, pb, w * H_PX, col))
    hc, hd = proj(J['head'], cx, gy); items.append((hd, 'head', hc, None, 0.075 * H_PX, None))
    items.sort(key=lambda t: t[0])
    for dep, kind, pa, pb, w, col in items:
        if kind == 'seg':
            d.line([pa, pb], fill=(30, 30, 34), width=int(w + 6)); d.line([pa, pb], fill=col, width=int(w))
            for q in (pa, pb): d.ellipse((q[0] - w / 2, q[1] - w / 2, q[0] + w / 2, q[1] + w / 2), fill=col)
        else:
            r = w; d.ellipse((pa[0] - r - 3, pa[1] - r - 3, pa[0] + r + 3, pa[1] + r + 3), fill=(30, 30, 34)); d.ellipse((pa[0] - r, pa[1] - r, pa[0] + r, pa[1] + r), fill=(110, 90, 80))
            face, fd = proj(vec(J['head'], f, 0.06), cx, gy)
            if fd >= dep - 0.01:            # the face is toward the camera: draw it (skin, eyes toward the facing direction)
                d.ellipse((face[0] - r * 0.62, face[1] - r * 0.7, face[0] + r * 0.62, face[1] + r * 0.62), fill=(235, 200, 170))
                nose, _ = proj(vec(J['head'], f, 0.09), cx, gy); d.ellipse((nose[0] - 5, nose[1] - 3, nose[0] + 5, nose[1] + 5), fill=(200, 140, 110))
def sheet(phi_deg, out, cols=5, rows=2):
    phi = math.radians(phi_deg); W, Hh = 1536, 1024; cw, ch = W // cols, Hh // rows
    im = Image.new('RGB', (W, Hh), (236, 236, 240)); d = ImageDraw.Draw(im)
    try: font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 30)
    except Exception: font = None
    for k in range(cols * rows):
        c, r = k % cols, k // cols; x0, y0 = c * cw, r * ch; gy = y0 + ch - 44; cx = x0 + cw / 2
        d.rectangle((x0 + 4, y0 + 4, x0 + cw - 4, y0 + ch - 4), outline=(170, 170, 185), width=3); d.line((x0 + 16, gy, x0 + cw - 16, gy), fill=(120, 120, 135), width=3)
        if k < 8: J, f = pose(k / 8, phi)
        else: J, f = pose(0, phi, idle=1 + (k - 8))
        draw(d, J, f, cx, gy); d.text((x0 + 12, y0 + 10), str(k + 1), fill=(60, 60, 90), font=font)
    im.save(out)
if __name__ == '__main__':
    if '--hold' in sys.argv: i = sys.argv.index('--hold'); HOLD = sys.argv[i + 1]; del sys.argv[i:i + 2]
    if '--nopoint' in sys.argv: NOPOINT = True; sys.argv.remove('--nopoint')
    if '--exag' in sys.argv: i = sys.argv.index('--exag'); EXAG = float(sys.argv[i + 1]); del sys.argv[i:i + 2]
    act = '--actions' in sys.argv
    if act: sys.argv.remove('--actions')
    phi = float(sys.argv[1]); out = sys.argv[2] if len(sys.argv) > 2 else f'art/guides/walk_{int(phi)}.png'; (sheet_act if act else sheet)(phi, out); print(out)
