// v12: which Russian strings of the sources (art/i18n/strings.json from tools/i18n_extract.py) the English dictionary misses: node tools/i18n_missing.cjs
const fs = require('fs');
globalThis.window = globalThis; globalThis.document = { readyState: 'complete', body: null, documentElement: {}, addEventListener() {} };
require('../live/lang_en.js'); require('../live/i18n.js'); window.setLang('en');
const CYR = /[А-Яа-яЁё]/, S = JSON.parse(fs.readFileSync('art/i18n/strings.json', 'utf8')), out = [];
for (const [s, f] of Object.entries(S)) { if (/^[а-яё]{1,2}$/.test(s) || /^[a-zа-яё ]+$/.test(s) && s.length < 14 && !/ /.test(s)) continue;   // console aliases, keyboard-layout letters
  for (const part of s.split('\n')) { if (!CYR.test(part)) continue; const t = window.TR(part); if (CYR.test(t)) out.push([part, f]); } }
const uniq = [...new Map(out.map((o) => [o[0], o])).values()];
console.log(uniq.length + ' untranslated'); uniq.forEach(([s, f]) => console.log(f.padEnd(8) + JSON.stringify(s)));
