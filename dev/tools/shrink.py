# Downscale live/assets textures to what the game draws (×~3 headroom), in place; rewrites live/assets.js sizes.
import glob, os, re, json, fnmatch
from PIL import Image
RULES = [('cg_*', 'w', 1536), ('menu_art', 'w', 1536), ('kf_*', 'h', 320), ('k16*', 'h', 330), ('ka_*', 'h', 330), ('pw_*', 'h', 330), ('sw_*', 'h', 330), ('ef_*', 'h', 320), ('rf_*', 'h', 320), ('raiva*', 'h', 420), ('house_*', 'w', 1100), ('*_tex', 'w', 1024), ('kolya*', 'h', 420), ('kirill*', 'h', 420), ('npc_*', 'h', 400), ('courier*', 'h', 400),
         ('tree_*', 'h', 760), ('lamp', 'h', 560), ('car_*', 'w', 720), ('garage', 'w', 1000), ('coin', 'w', 96), ('ui_pumpkin', 'm', 720), ('fest_*', 'w', 560), ('probe_prop', 'w', 256), ('*', 'm', 380)]
QUANT = ['cg_*', 'menu_art']
man = json.loads(re.sub(r'^window\.ASSETS = |;\s*$', '', open('live/assets.js').read().strip()))
for f in sorted(glob.glob('live/assets/*.png')):
    n = os.path.basename(f)[:-4]
    if '__' in n: continue                                  # rig parts share one canvas: scaled by their rig height instead
    rule = next(r for r in RULES if fnmatch.fnmatch(n, r[0])); im = Image.open(f); w, h = im.size
    cur = w if rule[1] == 'w' else h if rule[1] == 'h' else max(w, h)
    if cur > rule[2]:
        k = rule[2] / cur; im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS); im.save(f, optimize=True)
        if n in man: man[n]['w'], man[n]['h'] = im.size
    if any(fnmatch.fnmatch(n, q) for q in QUANT) and im.mode != 'P':   # full-screen pictures: 256 colours (pixel art keeps), ~4x smaller
        im = Image.open(f).convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG); im.save(f, optimize=True)
open('live/assets.js', 'w').write('window.ASSETS = ' + json.dumps(man) + ';\n')
print('ok', sum(os.path.getsize(f) for f in glob.glob('live/assets/*.png')) // 1024, 'KB')
