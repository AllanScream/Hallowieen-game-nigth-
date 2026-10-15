# Render iso mass-model guides (2:1 dimetric, the game's projection) to steer the generator's camera angle.
# x = along the street (screen up-right), y = across toward the viewer (screen down-right), z = up.
import sys, math
from PIL import Image, ImageDraw
C, S = 0.894, 0.447
def P(x, y, z, ox, oy): return (ox + C * (x + y), oy + S * (y - x) - z)
def box(d, x0, y0, x1, y1, z0, z1, ox, oy, cols):
    top = [P(x0, y0, z1, ox, oy), P(x1, y0, z1, ox, oy), P(x1, y1, z1, ox, oy), P(x0, y1, z1, ox, oy)]
    front = [P(x0, y1, z0, ox, oy), P(x1, y1, z0, ox, oy), P(x1, y1, z1, ox, oy), P(x0, y1, z1, ox, oy)]   # +y face (lower right)
    left = [P(x0, y0, z0, ox, oy), P(x0, y1, z0, ox, oy), P(x0, y1, z1, ox, oy), P(x0, y0, z1, ox, oy)]    # -x face (lower left)
    d.polygon(left, fill=cols[1], outline=(20, 20, 20)); d.polygon(front, fill=cols[0], outline=(20, 20, 20)); d.polygon(top, fill=cols[2], outline=(20, 20, 20))
def gable(d, x0, y0, x1, y1, z0, rh, ox, oy, cols):   # ridge along x
    ym = (y0 + y1) / 2
    front = [P(x0, y1, z0, ox, oy), P(x1, y1, z0, ox, oy), P(x1, ym, z0 + rh, ox, oy), P(x0, ym, z0 + rh, ox, oy)]
    end = [P(x0, y0, z0, ox, oy), P(x0, y1, z0, ox, oy), P(x0, ym, z0 + rh, ox, oy)]
    d.polygon(end, fill=cols[1], outline=(20, 20, 20)); d.polygon(front, fill=cols[3], outline=(20, 20, 20))
def house(out, W=1536, H=1024, wx=620, dy=430, wall=170, roof=150, porch=True):
    im = Image.new('RGB', (W, H), (0, 0, 0)); d = ImageDraw.Draw(im)
    cx, cy = wx / 2, dy / 2
    ox = W / 2 - C * (cx + cy); oy = H * 0.66 - S * (cy - cx) + 40
    cols = [(175, 175, 175), (120, 120, 120), (210, 210, 210), (95, 95, 95)]
    box(d, 0, 0, wx, dy, 0, wall, ox, oy, cols)
    gable(d, -12, -12, wx + 12, dy + 12, wall, roof, ox, oy, cols)
    if porch:
        box(d, wx * 0.36, dy, wx * 0.64, dy + 90, 0, 18, ox, oy, [(150, 150, 150), (110, 110, 110), (190, 190, 190)])
        dx0 = P(wx * 0.47, dy, 0, ox, oy); dx1 = P(wx * 0.53, dy, 0, ox, oy)   # door
        d.polygon([dx0, dx1, (dx1[0], dx1[1] - 110), (dx0[0], dx0[1] - 110)], fill=(60, 40, 30))
    # ground footprint line along the street (x axis) for orientation
    a = P(-300, dy + 160, 0, ox, oy); b = P(wx + 300, dy + 160, 0, ox, oy); d.line([a, b], fill=(60, 60, 90), width=3)
    im.save(out)
if __name__ == '__main__':
    house(sys.argv[1] if len(sys.argv) > 1 else 'study/guide_house.png')
