# v12: face / heart / gesture emoji → kaomoji, the same way in every file (sim, scene, i18n tables).
# The variant is picked from the letters just before the emoji inside its string, so a Russian line and its
# copy in the i18n tables convert identically.  python3 tools/kaomoji.py  (idempotent)
import re, sys

K = {
    '😘': ['(づ￣ ³￣)づ', '(˘ ³˘)♡', '(* ^ ω ^)♡', '(´ ε ` )♡'],
    '😏': ['(￢‿￢)', '(¬‿¬ )', '( ˘ ▽˘)', '(￢ω￢)'],
    '👁': ['(◉_◉)', '(⊙_⊙)', '(☉_☉)'],
    '💀': ['(x_x)', '(×_×)', '(✖╭╮✖)'],
    '💅': ['(￣ω￣)', '(￣ー￣)', '(´｡• ω •｡`)'],
    '😺': ['(=^･ω･^=)', '(=^‥^=)'],
    '😈': ['ψ(｀∇´)ψ', '(｀∀´)Ψ', '(¬‿¬)ψ'],
    '😐': ['(￣_￣)', '(・_・)'],
    '🙄': ['(￢_￢;)', '(¬_¬ )'],
    '😤': ['(╬ Ò﹏Ó)', '(＃`Д´)'],
    '👍': ['(b ᵔ▽ᵔ)b', '(＾▽＾)b'],
    '🙂': ['(^_^)', '(* ^ ω ^)'],
    '😊': ['(* ^ ω ^)', '(◕‿◕)'],
    '👋': ['(^_^)/', '(・ω・)ノ'],
    '😌': ['(´-ω-`)', '(˘ω˘)'],
    '🙏': ['(人´∀`)', '(人◕ω◕)'],
    '😂': ['(≧▽≦)', '(ﾉ≧∀≦)ﾉ'],
    '👀': ['(･_･ )', '(⊙ω⊙)'],
    '🤢': ['(×﹏×)', '(＞﹏＜)'],
    '💕': ['(♡˙︶˙♡)', '♡♡'],
    '❤': ['♡'],
    '🤖': ['[◕‿◕]'],
    '😳': ['(⁄ ⁄•⁄ω⁄•⁄ ⁄)'],
    '😭': ['(╥﹏╥)'],
    '😎': ['(⌐■_■)'],
    '🥺': ['(´• ω •`)'],
    '😉': ['(^_~)'],
    '😅': ['(^_^;)'],
    '🤔': ['(￢_￢)?'],
}
QUOTES = '\'"`'
PAT = re.compile('(' + '|'.join(map(re.escape, K)) + ')️?')

def conv(s):
    out, last = [], 0
    for m in PAT.finditer(s):
        e = m.group(1); i = m.start(); j = i; letters = []
        while j > 0 and len(letters) < 10:
            j -= 1; c = s[j]
            if c in QUOTES or c == '\n': break
            if c.isalnum(): letters.append(c)
        v = K[e]; k = v[sum(ord(c) for c in letters) % len(v)]
        out.append(s[last:i]); out.append(k); last = m.end()
    out.append(s[last:]); return ''.join(out)

if __name__ == '__main__':
    files = sys.argv[1:] or ['live/sim.js', 'live/scene.js', 'art/i18n/en_a.py', 'art/i18n/en_b.py', 'art/i18n/dm_v11.py', 'art/i18n/ks_v9.json', 'art/i18n/strings.json']
    for f in files:
        s = open(f, encoding='utf-8').read(); t = conv(s)
        if t != s: open(f, 'w', encoding='utf-8').write(t)
        print(f, len(PAT.findall(s)), '→ kaomoji')
