#!/usr/bin/env bash
# Packed build dist/halloween/game from live/: the scripts, index.html (static flag), only new / changed textures re-encoded to WebP
set -e
G=dist/halloween/game; mkdir -p $G/assets
for f in anchors assets audio costumes gl i18n kframes khead lang_en lib rigs scene sim sizes; do cp live/$f.js $G/; done
python3 - <<'PY'
s = open('live/index.html', encoding='utf-8').read(); i = s.index('\n<script>\n') if '\n<script>\n' in s else s.index('<script>\n')
s = s.replace('\n<script>\n', '\n<script>window.__STATIC__ = 1;</script>\n<script>\n', 1)
open('dist/halloween/game/index.html', 'w', encoding='utf-8').write(s)
PY
n=0; for p in live/assets/*.png; do b=$(basename "$p" .png); w=$G/assets/$b.webp; if [ ! -f "$w" ] || [ "$p" -nt "$w" ]; then cp "$p" $G/assets/; n=$((n+1)); fi; done
echo "textures to encode: $n"
python3 tools/webp.py $G
grep -c "__STATIC__" $G/index.html
