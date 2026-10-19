// live/i18n.js — Russian / English. The game keeps every string in Russian (the sim, the saves); the screen translates at the
// moment of drawing: canvas text (fillText / strokeText / measureText), the GL labels (lib.js asks TR first) and the HTML menu.
// The dictionary is window.LANG_EN (lang_en.js): exact strings and templates with {0} {1} {x} {n}; a captured part is translated
// again (names in any case, lists «a, b и c»). A string that cannot be translated whole stays Russian (no half-translated lines).
(function () {
  const CYR = /[А-Яа-яЁё]/;
  let LANG = 'ru', exact = null, tpls = null; const cache = new Map();
  function compile() {
    exact = new Map(); tpls = [];
    for (const [ru, en] of (window.LANG_EN || [])) {
      if (/\{(\d+|x|n)\}/.test(ru)) { const names = [];
        const src = '^' + ru.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\d+|x|n)\\\}/g, (m, k) => { names.push(k); return '([\\s\\S]+?)'; }) + '$';
        tpls.push({ re: new RegExp(src), names, en, lit: ru.replace(/\{(\d+|x|n)\}/g, '').length }); }
      else exact.set(ru, en);
    }
    tpls.sort((a, b) => b.lit - a.lit);                                                 // the most specific template first
  }
  // a captured part: whole, or a list «a, b и c» (an item may itself contain « и »)
  function part(s) { const t = tr(s); if (!CYR.test(t)) return t;
    const out = []; for (const p of s.split(', ')) { const t2 = tr(p); if (!CYR.test(t2)) { out.push(t2); continue; }
      let ok = false; for (const m of p.matchAll(/ и /g)) { const a = tr(p.slice(0, m.index)), b = tr(p.slice(m.index + 3)); if (!CYR.test(a) && !CYR.test(b)) { out.push(a, b); ok = true; break; } }
      if (!ok) return null; }
    return out.length > 1 ? out.slice(0, -1).join(', ') + ' and ' + out[out.length - 1] : out[0]; }
  function tr(s) {
    if (LANG !== 'en' || typeof s !== 'string' || !CYR.test(s)) return s;
    let r = cache.get(s); if (r !== undefined) return r;
    if (!exact) compile();
    r = exact.get(s);
    if (r === undefined) { r = s;
      for (const T of tpls) { const m = T.re.exec(s); if (!m) continue; const vals = {}; let ok = true;
        for (let i = 0; i < T.names.length; i++) { const g = m[i + 1], t = CYR.test(g) ? part(g) : g; if (t === null || CYR.test(t)) { ok = false; break; } vals[T.names[i]] = t; }
        if (ok) { r = T.en.replace(/\{(\d+|x|n)\}/g, (q, k) => (vals[k] !== undefined ? vals[k] : q)); break; } } }
    if (cache.size > 8000) cache.clear(); cache.set(s, r); return r;
  }
  window.TR = tr;
  // every canvas text goes through the dictionary (the phone, the minimap, the label textures)
  const P = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (P) { const f0 = P.fillText, s0 = P.strokeText, m0 = P.measureText;
    P.fillText = function (t, ...a) { return f0.call(this, tr(t), ...a); };
    P.strokeText = function (t, ...a) { return s0.call(this, tr(t), ...a); };
    P.measureText = function (t) { return m0.call(this, tr(t)); }; }
  // the HTML: text nodes and placeholders keep their Russian original; new and changed nodes are translated as they appear
  const ORIG = new WeakMap(), MINE = new WeakMap();
  function node(n) {
    if (n.nodeType === 3) { let o; if (MINE.has(n) && MINE.get(n) === n.nodeValue) o = ORIG.get(n); else { o = n.nodeValue; ORIG.set(n, o); }
      if (o === undefined) return; const t = LANG === 'en' ? tr(o) : o; MINE.set(n, t); if (n.nodeValue !== t) n.nodeValue = t; return; }
    if (n.nodeType !== 1 || n.tagName === 'SCRIPT' || n.tagName === 'STYLE' || n.hasAttribute('data-notr')) return;
    if (n.hasAttribute('placeholder')) { if (!n.dataset.ph || (n.dataset.phMine !== n.getAttribute('placeholder'))) n.dataset.ph = n.getAttribute('placeholder');
      const t = LANG === 'en' ? tr(n.dataset.ph) : n.dataset.ph; n.dataset.phMine = t; n.setAttribute('placeholder', t); }
    for (const c of n.childNodes) node(c);
  }
  let obs = null;
  function applyDOM() { if (!document.body) return; node(document.body); if (!window.__titleRu) window.__titleRu = document.title; document.title = LANG === 'en' ? tr(window.__titleRu) : window.__titleRu;
    if (!obs) { obs = new MutationObserver((ms) => { for (const m of ms) { if (m.type === 'characterData') node(m.target); else m.addedNodes.forEach(node); } });
      obs.observe(document.body, { subtree: true, childList: true, characterData: true }); } }
  window.setLang = (l) => { LANG = l === 'en' ? 'en' : 'ru'; window.LANG = LANG; cache.clear(); document.documentElement.lang = LANG; applyDOM();
    try { window.dispatchEvent(new Event('langchange')); } catch (e) {} };
  window.LANG = LANG;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyDOM); else applyDOM();
})();
