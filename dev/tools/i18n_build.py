# Build live/lang_en.js from art/i18n (index → English, plus hand templates): python3 tools/i18n_build.py
import json, re, sys
sys.path.insert(0, 'art/i18n')
from en_a import EN as A
from en_b import EN as B, EXTRA
from en_c import EXTRA as EXTRA_C                                         # v11: the contacts' answers and Elf's lines (tools/dm_build.py)
from en_v12 import EXTRA as EXTRA_12                                      # v12: the prologue, the festival, the console
EXTRA = EXTRA + EXTRA_C + EXTRA_12
ks = json.load(open('art/i18n/ks_v9.json', encoding='utf-8'))
EN = dict(A); EN.update(B)
pairs, seen = [], set()
for i, en in sorted(EN.items()):
    ru = ks[i]
    if ru.startswith(' ') or ru.endswith(' ') or ru in seen: continue
    seen.add(ru); pairs.append([ru, en])
for ru, en in EXTRA + [['К', 'K'], ['Р', 'R'], ['Э', 'E'], ['Т', 'T'], ['С', 'S'], ['модеры {0}/3', 'mods {0}/3']]:
    if ru in seen: continue
    seen.add(ru); pairs.append([ru, en])
# placeholders must match
bad = [p for p in pairs if set(re.findall(r'\{\w+\}', p[1])) - set(re.findall(r'\{\w+\}', p[0]))]
for b in bad: print('placeholder mismatch:', b)
missing = [k for k in ks if k not in seen and not re.match(r'^[a-zа-яё]+$', k) and not k.startswith(' ') and not k.endswith(' ')]
open('live/lang_en.js', 'w', encoding='utf-8').write('// English for «Сладость или гадость» (tools/i18n_build.py from art/i18n): [russian, english]; {0} {1} {x} {n} are placeholders\nwindow.LANG_EN = ' + json.dumps(pairs, ensure_ascii=False, indent=0) + ';\n')
print(len(pairs), 'pairs;', len(missing), 'source strings without English')
for m in missing: print('  -', m[:110])
