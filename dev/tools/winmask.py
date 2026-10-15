# Kirill's window overlay: the window part of house_kirill with the glass made translucent, drawn over Kirill's rig
# (he stands behind the glass; the frame and the wall around it stay opaque). Writes live/assets/kwin_overlay.png + manifest entry.
import json, re
import numpy as np
from PIL import Image, ImageDraw
CROP = (0.452, 0.62, 0.613, 0.865)                       # fractions of the house sprite (also used by scene.js)
GLASS = [(0.4655, 0.7215), (0.5995, 0.6365), (0.5995, 0.7695), (0.4655, 0.8485)]   # glass parallelogram (fractions)
im = Image.open('live/assets/house_kirill.png').convert('RGBA'); W, H = im.size
box = (round(CROP[0] * W), round(CROP[1] * H), round(CROP[2] * W), round(CROP[3] * H))
c = im.crop(box); a = np.array(c).astype(np.float32)
m = Image.new('L', c.size, 0); d = ImageDraw.Draw(m)
d.polygon([(x * W - box[0], y * H - box[1]) for x, y in GLASS], fill=255)
glass = np.array(m).astype(np.float32) / 255.0
# frame bars (mullions) are bright/dark wood: keep them opaque inside the glass
rgb = a[:, :, :3]; purple = (rgb[:, :, 2] > rgb[:, :, 1] + 12) | (rgb.sum(2) < 120)
k = glass * purple
a[:, :, 3] = a[:, :, 3] * (1 - 0.68 * k)                   # glass: 32 % of the room shows over Kirill (blinds, reflections)
Image.fromarray(a.clip(0, 255).astype(np.uint8)).save('live/assets/kwin_overlay.png', optimize=True)
man = json.loads(re.sub(r'^window\.ASSETS = |;\s*$', '', open('live/assets.js').read().strip()))
man['kwin_overlay'] = {'w': c.size[0], 'h': c.size[1], 'crop': [0, 0, c.size[0], c.size[1]], 'scale': 1}
open('live/assets.js', 'w').write('window.ASSETS = ' + json.dumps(man) + ';\n')
print('kwin_overlay', c.size)
