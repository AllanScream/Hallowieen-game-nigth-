# dist/halloween/game/index.html → dist/artifact.html (artifact page contract: no doctype/html/head/body, own title,
# explicit dark tokens) + files.json (published path → source path) for the Artifact publish call.
import re, json, os, glob
g = 'dist/halloween/game'
s = open(os.path.join(g, 'index.html'), encoding='utf-8').read()
s = re.sub(r'<!doctype html>\s*', '', s, flags=re.I)
s = re.sub(r'<html[^>]*>\s*<head>\s*<meta charset="utf-8">\s*', '', s, flags=re.I)
s = re.sub(r'<meta name="viewport"[^>]*>\s*', '', s, flags=re.I)
s = s.replace('</head><body>', '').replace('</body></html>', '')
s = s.replace(':root{--ar:1.7778;', ':root{--ar:1.7778;--bg:#050304;--fg:#f6e7c8;color-scheme:dark;')
s = s.replace('html,body{margin:0;background:#000;height:100%;overflow:hidden;', 'html,body{margin:0;background:var(--bg);color:var(--fg);height:100%;overflow:hidden;')
open('dist/artifact.html', 'w', encoding='utf-8').write(s)
files = {}
for f in sorted(glob.glob(g + '/*.js')) + sorted(glob.glob(g + '/assets/*.png') + glob.glob(g + '/assets/*.webp')):
    files[os.path.relpath(f, g)] = f
json.dump(files, open('dist/files.json', 'w'), indent=0)
print(len(files), 'files'); print(s[:300])
