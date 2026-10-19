# Packed build: every texture as WebP (lossy RGB q90, lossless alpha; full-screen pictures q92) — about 5× smaller than PNG.
#   python3 tools/webp.py dist/halloween/game
import os, sys, glob
from multiprocessing import Pool
from PIL import Image
def conv(f):
    n = os.path.basename(f)[:-4]; im = Image.open(f); b = os.path.getsize(f)
    im = im.convert('RGBA') if (im.mode in ('RGBA', 'LA') or (im.mode == 'P' and 'transparency' in im.info)) else im.convert('RGB')
    q = 92 if n.startswith('cg_') or n == 'menu_art' else 90
    out = f[:-4] + '.webp'; im.save(out + '.tmp', 'WEBP', quality=q, method=4, alpha_quality=100); os.replace(out + '.tmp', out); os.remove(f)
    return b, os.path.getsize(out)
if __name__ == '__main__':
    g = sys.argv[1]
    with Pool(max(2, os.cpu_count() or 2)) as p: r = p.map(conv, sorted(glob.glob(os.path.join(g, 'assets', '*.png'))), chunksize=4)
    h = os.path.join(g, 'index.html'); s = open(h, encoding='utf-8').read()
    s = s.replace("window.ASSET_URL = (n) => 'assets/' + n + '.png';", "window.ASSET_URL = (n) => 'assets/' + n + '.webp';").replace('url(assets/menu_art.png)', 'url(assets/menu_art.webp)')
    assert "'.webp'" in s and 'menu_art.webp' in s
    open(h, 'w', encoding='utf-8').write(s)
    print(f'webp: {sum(a for a, _ in r) / 1e6:.1f} MB → {sum(b for _, b in r) / 1e6:.1f} MB ({len(r)} files)')
