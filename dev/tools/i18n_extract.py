# Pull every Russian string literal out of the game sources: python3 tools/i18n_extract.py → art/i18n/strings.json
# JS: '…' "…" `…` (template ${…} → {0}, {1}…); HTML: text between tags and attribute values. Comments are skipped.
import re, json, sys, os
CYR = re.compile('[А-Яа-яЁё]')
def js_strings(src):
    out = []; i = 0; n = len(src)
    while i < n:
        c = src[i]
        if c == '/' and i + 1 < n and src[i+1] == '/':            # line comment
            j = src.find('\n', i); i = n if j < 0 else j; continue
        if c == '/' and i + 1 < n and src[i+1] == '*':
            j = src.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c in '\'"`':
            q = c; j = i + 1; buf = []; k = 0; parts = []
            while j < n and src[j] != q:
                if src[j] == '\\': buf.append(src[j:j+2]); j += 2; continue
                if q == '`' and src[j] == '$' and j + 1 < n and src[j+1] == '{':
                    depth = 1; j += 2; st = j
                    while j < n and depth:
                        if src[j] == '{': depth += 1
                        elif src[j] == '}': depth -= 1
                        j += 1
                    buf.append('{%d}' % k); k += 1; continue
                buf.append(src[j]); j += 1
            s = ''.join(buf)
            try: s = json.loads('"' + s.replace('"', '\\"').replace("\\'", "'").replace('\\`', '`') + '"')
            except Exception: pass
            if CYR.search(s): out.append(s)
            i = j + 1; continue
        i += 1
    return out
res = {}
for f in ['live/sim.js', 'live/scene.js', 'live/audio.js']:
    for s in js_strings(open(f, encoding='utf-8').read()): res.setdefault(s, f)
html = open('live/index.html', encoding='utf-8').read()
body, script = html.split('<script>', 1)
for m in re.finditer(r'>([^<>]+)<', body):
    t = m.group(1).strip()
    if CYR.search(t): res.setdefault(t, 'html')
for m in re.finditer(r'(?:placeholder|title)="([^"]+)"', body):
    if CYR.search(m.group(1)): res.setdefault(m.group(1), 'html')
for s in js_strings(script): res.setdefault(s, 'html.js')
os.makedirs('art/i18n', exist_ok=True)
json.dump(res, open('art/i18n/strings.json', 'w'), ensure_ascii=False, indent=0)
print(len(res), 'strings,', sum(len(k) for k in res), 'chars')
