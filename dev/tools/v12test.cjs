// v12 feature checks in node (pure sim + the English dictionary): node tools/v12test.cjs
require('../live/sim.js'); const SIM = globalThis.SIM; let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, n, inp = {}) => { for (let i = 0; i < n; i++) SIM.step(S, typeof inp === 'function' ? inp(i) : inp); };
// the English dictionary, as the page uses it
globalThis.window = globalThis; globalThis.document = { readyState: 'complete', body: null, documentElement: {}, addEventListener() {} };
require('../live/lang_en.js'); require('../live/i18n.js'); const EN = (s) => { window.setLang('en'); const r = window.TR(s); window.setLang('ru'); return r; };
const CYR = /[А-Яа-яЁё]/;
const fresh = () => { const S = SIM.spawn(0); run(S, 10); S.noWeather = true; return S; };
const ask = (S, who, t, wait = 900) => { S.phone = { app: 'dm', who, t: S.t - 1 }; const n0 = (S.dm[who] || []).length; run(S, 1, { text: t }); run(S, wait); return S.dm[who].slice(n0 + 1).filter((m) => !m.me); };
// 1. contacts' messages live in their own threads, the chats list is per conversation
{ const S = fresh(); const L = SIM.chatList(S); ok(L[0] && L.includes('Модеры 🎃') && L.includes('Эльф'), 'chat list: ' + L.join(', '));
  ok(!(S.dm['Модеры 🎃'] || []).some((m) => m.from === 'Эльф' && /Только попробуй/.test(m.text)), 'Elf\'s private message is not in the mods\' chat');
  ok((S.dm['Эльф'] || []).length > 0, 'Elf\'s private message is in her thread'); }
// 2. replies answer what was written
{ const S = fresh(); const cases = [['Кирилл', 'ты смотрел аниме?', /аниме|Тыковк/i], ['Райва', 'крутила гачу?', /5★|гач|капсул/i], ['Эльф', 'а костюм горничной?', /горничн|голосов|Фартук|Долг/i],
    ['Скелет', 'что думаешь про Кирилла', /Кирилл/], ['Тимофей', 'где Эльф сейчас', /Эльф|латте/], ['Эльф', 'идёт дождь', /Дождь|Гроза/], ['Райва', 'который час', /\d\d:\d\d/],
    ['Кирилл', 'фывапролдж', /фывапролдж/], ['Эльф', 'ххх ыыы', /ххх ыыы/], ['Скелет', '(^_^)', /\(/], ['Тимофей', 'ахахах', /улыбаешься/]];
  for (const [who, t, re] of cases) { const r = ask(S, who, t); ok(r.length && re.test(r[0].text), who + ' ← «' + t + '» → ' + (r[0] ? r[0].text : '—')); } }
// 3. lines rotate instead of repeating at random
{ const S = fresh(); const seen = new Set(); for (let i = 0; i < 4; i++) seen.add(ask(S, 'Кирилл', 'расскажи про стрим ' + 'x'.repeat(i))[0].text); ok(seen.size >= 2, 'stream lines rotate (' + seen.size + ' different of 4)'); }
// 4. the same message twice gets noticed, help gives a concrete hint, the group answers with two voices
{ const S = fresh(); ask(S, 'Райва', 'покажи логи'); const r = ask(S, 'Райва', 'покажи логи'); ok(/Дубликат|Ctrl\+C/.test(r[0].text), 'a repeated message: ' + r[0].text);
  const h = ask(S, 'Тимофей', 'помоги, что делать?'); ok(h.length === 2 && /стучал/.test(h[1].text), 'help → hint: ' + h.map((m) => m.text).join(' | '));
  let two = 0; for (let i = 0; i < 6; i++) { const g = ask(S, 'Модеры 🎃', 'что там с гачей ' + i); if (g.length >= 2) two++; } ok(two > 0, 'the group chat answers with two members sometimes (' + two + '/6)'); }
// 5. every new line has English, templates included
{ const S = fresh(); const lines = []; for (const who of ['Кирилл', 'Райва', 'Эльф', 'Скелет', 'Тимофей', 'Модеры 🎃'])
    for (const t of ['привет', 'гача', 'аниме', 'стрим', 'горничная', 'дождь', 'пицца', 'помоги', 'время', 'да', 'нет', 'ахах', 'скучно', 'спать', 'кто ты', 'qwerty', 'why?', '(^_^)', 'кирилл', 'вера'])
      ask(S, who, t, 700).forEach((m) => lines.push((who === 'Модеры 🎃' ? '' : '') + m.text));
  const bad = lines.filter((l) => CYR.test(EN(l)) && !/«[^»]*[А-Яа-яЁё][^»]*»/.test(l));   // a quote of Russian typing stays Russian, by design ok(bad.length === 0, lines.length + ' answers translate to English' + (bad.length ? ': ' + bad.slice(0, 4).join(' || ') : ''));
  ok(!lines.some((l) => /[😘😏💅💀👁😈]/u.test(l)), 'no face emoji left, kaomoji instead'); }

// 6. the prologue: scenes only, Elf's voice line, skip with Esc, the achievement only when watched to the end
const EN_ok = (t) => !CYR.test(EN(t));
{ const S = fresh(); SIM.startIntro(S); const t0 = S.gt, L = S.intro.lines; ok(L.some((l) => l.voice) && L.some((l) => l.k === 'donate') && L.some((l) => l.k === 'chat'), 'the prologue has the stream chat, the donation and the voice note');
  ok(L.every((l) => EN_ok(l.text.split('\n')[0]) && (!l.who || EN_ok(l.who))), 'every prologue line has English');
  for (let i = 0; i < L.length + 2 && S.intro; i++) { run(S, 60); ok(S.gt === t0 || !S.intro, ''); run(S, 1, { click: 1, px: 900, py: 500 }); }
  ok(!S.intro && S.ach.binge, 'clicked through: the game starts, «Ещё одну серию» unlocked, the clock stood still meanwhile');
  const S2 = fresh(); SIM.startIntro(S2); run(S2, 30); run(S2, 1, { esc: 1 }); ok(!S2.intro && !(S2.ach || {}).binge, 'Esc skips it, no achievement');
  const S3 = fresh(); SIM.startIntro(S3, true); run(S3, 30); run(S3, 1, { esc: 1 }); ok(S3.intro && S3.intro.over, 'the prologue alone (from «Об игре») ends in a state the page sends back to the menu'); }
// 7. the festival: the gate is open, the yards are not, the four mini-games and the candy stall
{ const S = fresh(); S.x = 2620; S.y = 300; S.path = SIM.findPath([S.x, S.y], [2600, 760]); let tst = false; for (let i = 0; i < 120 * 6; i++) { run(S, 1); tst = tst || S.toasts.some((q) => /Праздник на площади/.test(q.text)); }
  ok(SIM.inPlaza(S.x, S.y) && S.fest.seen, 'walks through the gate into the plaza (' + Math.round(S.x) + ',' + Math.round(S.y) + ')');
  ok(tst, 'a toast welcomes him');
  S.x = 2000; S.y = 300; S.path = []; run(S, 120 * 2, { down: 1 }); ok(S.y < 420, 'the south yards stay closed (y=' + Math.round(S.y) + ')'); }
const fest = (S, id) => { const st = SIM.FSTALLS.find((q) => q[1] === id), a = SIM.festAt(st); S.x = a[0]; S.y = a[1]; S.path = []; S.act = { k: 'fest', id, at: a, r: 999 }; run(S, 2); };
{ const S = fresh(); fest(S, 'carve'); ok(S.dlg && S.dlg.who === 'Организатор', 'the carving booth opens with the organizer'); run(S, 1, { choose: 0 }); run(S, 1); ok(S.mg && S.mg.k === 'carve', 'carving starts');
  const C = SIM.CARVE; for (let k = 0; k < 6; k++) { for (let i = 0; i < 30; i++) { const a = i / 29 * 6.28; run(S, 1, { press: 1, px: C.cx + (k - 2.5) * 80 + 40 * Math.cos(a), py: C.cy + (k % 2 ? -80 : 90) + 40 * Math.sin(a) }); } run(S, 1, { px: 50, py: 50 }); }
  const m0 = S.money, U = SIM.FUI.done; run(S, 1, { click: 1, px: U.x + 5, py: U.y + 5 }); const R = S.mg.res;
  ok(R && R.judges.length === 3 && R.place >= 1, 'the judges score it: ' + R.score + ', place ' + R.place);
  ok(R.place !== 1 || (S.ach.carver && S.money === m0 + 300), 'a win pays 300 ₽ and unlocks the achievement');
  ok(EN_ok(R.title) && R.judges.every((j) => EN_ok(j[0]) && EN_ok(j[2])) && EN_ok(R.line), 'the result reads in English');
  run(S, 2, { e: 1 }); run(S, 2); ok(!S.mg && S.fest.carve && S.fest.carve.strokes.length === 6, 'the carved pumpkin is kept for the booth');
  const S2 = fresh(); fest(S2, 'carve'); run(S2, 1, { choose: 0 }); run(S2, 1); run(S2, 1, { click: 1, px: U.x + 5, py: U.y + 5 }); ok(S2.mg.res && S2.mg.res.place === 4, 'an empty pumpkin comes last'); }
{ const S = fresh(); S.money = 100; fest(S, 'apples'); run(S, 1, { choose: 0 }); run(S, 1); ok(S.mg && S.mg.k === 'apples' && S.money === 80, 'apple bobbing costs 20 ₽');
  let caught = 0; for (let i = 0; i < 120 * 21; i++) { let inp = {}; if (S.mg && !S.mg.res && i % 6 === 0) { const up = S.mg.apples.find((a) => SIM.appleUp(a, S.t)); if (up) { const q = SIM.applePos(up, S.t); inp = { click: 1, px: q[0], py: q[1] }; } } run(S, 1, inp); }
  const R = S.mg && S.mg.res; ok(R && R.n >= 10, 'a quick hand catches 10+ apples in 20 s (' + (R && R.n) + ')'); ok(S.ach.apples, '«Зубастик» unlocked'); }
{ const S = fresh(); fest(S, 'stage'); ok(S.dlg && /Без костюма/.test(S.dlg.text), 'no costume — no stage');
  const S2 = fresh(); S2.costume = 'ghost'; fest(S2, 'stage'); run(S2, 1, { choose: 0 }); run(S2, 1); ok(S2.mg && S2.mg.k === 'stage' && Math.hypot(S2.x - SIM.STAGEP[0], S2.y - SIM.STAGEP[1]) < 2, 'on stage');
  const D = ['up', 'right', 'down', 'left']; for (let i = 0; i < 120 * 12 && S2.mg && !S2.mg.res; i++) { const G = S2.mg; const k = S2.t >= G.at && i % 3 === 0 ? { [D[G.seq[G.i]]]: 1 } : {}; run(S2, 1, k); }
  ok(S2.mg.res && S2.mg.res.hits === 8 && S2.ach.catwalk, 'eight poses, «Звезда подиума» (' + (S2.mg.res && S2.mg.res.hits) + ')'); run(S2, 2, { esc: 1 }); run(S2, 2); ok(!S2.mg && S2.y > SIM.STAGEP[1] + 100, 'off the stage in front of it');
  ok(S2.dm['Эльф'].some((m) => /на сцене/.test(m.text)), 'Elf saw the show'); }
{ const S = fresh(); S.money = 2000; fest(S, 'gacha'); ok(S.mg && S.mg.k === 'gacha', 'the gacha screen opens');
  const U = SIM.FUI; for (let i = 0; i < 2; i++) { run(S, 1, { click: 1, px: U.g10.x + 5, py: U.g10.y + 5 }); run(S, 120 * 3); }
  ok(S.fest.gacha.pulls === 20 && S.money < 2000 - 900 + 1200, '×10 twice: 20 pulls for 900 ₽');
  ok(S.fest.cos.length >= 1 && S.ach.gacha5, 'the pity gives a ★5 costume by the 20th pull: ' + S.fest.cos.join(', '));
  ok(S.mg.res2.items.some((q) => q.r >= 4), '×10 has at least one ★4');
  ok(S.mg.res2.items.every((q) => EN_ok(q.name) || !CYR.test(q.name)), 'the drops read in English');
  run(S, 1, { esc: 1 }); run(S, 1); S.q.vera = 2; const sv = S.npc.find((n) => n.id === 'vera'); S.dlg = null; S.x = sv.x + 60; S.y = sv.y + 40;
  S.act = { k: 'npc', id: 'vera', at: [sv.x, sv.y + 50], r: SIM.K.TALK }; run(S, 3); const i = S.dlg.choices.findIndex((c) => c[1] === 'vera_wardrobe'); run(S, 1, { choose: i }); run(S, 1);
  ok(S.dlg.choices.some((c) => /★5/.test(c[0])), 'the ★5 costume is in Vera\'s chest'); }
{ const S = fresh(); S.money = 50; S.hp = 50; fest(S, 'candy'); run(S, 1, { choose: 0 }); ok(S.hp === 75 && S.money === 20, 'a caramel apple: +25 HP for 30 ₽'); }
// 8. the console: «help» fits, every command explained, the new ones work
{ const S = fresh(); S.phone = { app: 'dev', t: S.t - 1 }; const n0 = S.devLog.length; run(S, 1, { text: 'help' }); const out = S.devLog.slice(n0 + 1).map((l) => l.text);
  ok(out.length >= 27 && out.every((l, i) => !i || / — /.test(l)), 'v12.1: «help» lists every command with what it does (' + out.length + ' lines)'); ok(S.phone.scroll > 0, 'and the console opens at the top of the list'); ok(out.join(' ').includes('weather') && out.join(' ').includes('prologue'), 'it names every command');
  run(S, 1, { text: 'help tp' }); ok(/телепорт/.test(S.devLog[S.devLog.length - 1].text), '«help tp» explains tp');
  run(S, 1, { text: 'fest' }); ok(SIM.inPlaza(S.x, S.y), '«fest» teleports to the plaza'); run(S, 1, { text: 'gacha' }); ok(S.fest.gacha.pity === SIM.GACHA.pity - 1, '«gacha» sets the pity');
  run(S, 1, { text: 'clear' }); ok(S.devLog.length === 1, '«clear» empties the console'); S.phone = null; run(S, 1, { text: '' });
  const D = S.devLog; S.phone = { app: 'dev', t: S.t - 1 }; run(S, 1, { text: 'help all' }); ok(D.every((l) => l.me || EN_ok(l.text)), 'the console help reads in English');
  run(S, 1, { text: 'prologue' }); ok(S.intro && !S.intro.only, '«prologue» plays it now'); }
// 9. the epilogue in both endings: the stream chat reacts
{ const S = fresh(); SIM.runDev(S, 'refuse all'); S.stats.eggs = 40; S.fest.carves = 1; S.fest.carve = { place: 1, strokes: [], score: 9 }; SIM.runDev(S, 'finale'); const L = S.finale.lines;
  ok(L.some((l) => l.cg === 'cg_epi_party' && l.k === 'chat' && /ЯИЦ БРОШЕНО: 40/.test(l.text) && /вайфу/.test(l.text)), 'the party ending ends in his room, the chat counts the eggs and the pumpkin');
  ok(L.every((l) => l.text.split('\n').every((p) => EN_ok(p))), 'the whole ending reads in English');
  const S2 = fresh(); SIM.runDev(S2, 'peace'); SIM.runDev(S2, 'finale'); ok(S2.finale.lines.some((l) => l.cg === 'cg_epi_peace' && l.k === 'donate'), 'the kind ending too'); }
// 10. the mods' chat holds Kirill's post and Elf's voice note; the phone can play it
{ const S = fresh(); const G = S.dm['Модеры 🎃']; ok(G.some((m) => m.voice) && G.some((m) => m.from === 'Кирилл'), 'the group thread opens with the voice note');
  S.phone = { app: 'dm', who: 'Модеры 🎃', t: S.t }; const b = SIM.phoneLayout ? SIM.phoneLayout(S).find((q) => q.id === 'vplay') : null; ok(!SIM.phoneLayout || b, 'a play button under it');
  ok(EN_ok(G[0].text) && EN_ok(G[1].text), 'both read in English'); }

// 11. v12.1 fixes
{ const S = fresh(); fest(S, 'carve'); run(S, 1, { choose: 0 }); run(S, 1); const U = SIM.FUI; run(S, 1, { click: 1, px: U.done.x + 5, py: U.done.y + 5 }); ok(!!S.mg.res, 'a result card');
  run(S, 1, { click: 1, px: U.ok.x + U.ok.w / 2, py: U.ok.y + U.ok.h / 2 }); run(S, 1); ok(!S.mg, '«Дальше» closes the mini-game'); }
{ let all = 0, good = 0; for (const st of SIM.FSTALLS) for (let x = 2280; x <= 2960; x += 136) for (let y = 450; y <= 1070; y += 124) { if (!SIM.findPath([x, y], [2620, 760]).length) continue; const S = fresh(); S.x = x; S.y = y; all++;
    const q = SIM.proj(st[2], st[3]), c = SIM.pick(S, [q[0], q[1] - 40]); if (!c) continue; S.act = c; S.path = SIM.findPath([x, y], c.at); run(S, 120 * 8); if (S.dlg || S.mg) good++; }
  ok(good === all, 'every stall opens from every side of the plaza (' + good + '/' + all + ')');
  const S = fresh(); S.x = 3020 - 100; S.y = 960; ok(SIM.festNear(S) === 'candy', 'E works at the side of the candy stall'); }
{ const S = fresh(); S.money = 100; S.hp = 40; S.x = 2800; S.y = 980; run(S, 2, { e: 1 }); run(S, 1); run(S, 1, { choose: 1 }); ok(S.hp === 52 && S.money === 80, 'cotton candy: +12 HP for 20 ₽'); }
{ const S = fresh(); S.money = 100; fest(S, 'apples'); run(S, 1, { choose: 0 }); run(S, 1); let tries = 0, got = 0;
  for (let i = 0; i < 120 * 19 && tries < 12; i++) { const G = S.mg; const up = G.apples.filter((a) => SIM.appleUp(a, S.t + 0.01) && SIM.appleUp(a, S.t + 0.1)); if (i % 40 === 0 && up.length) { const q = SIM.applePos(up[0], S.t); const n0 = G.n; tries++; run(S, 1, { click: 1, px: q[0], py: q[1] - 18 }); if (G.n > n0) got++; } else run(S, 1); }
  ok(got === tries && tries >= 8, 'every click on an apple above the water lands (' + got + '/' + tries + ')'); }
{ const S = fresh(); S.q.vera = 2; S.costume = 'ghost'; S.fest.cos = ['pumpkin_gold', 'ghost_neon']; const sv = S.npc.find((n) => n.id === 'vera'); S.x = sv.x + 60; S.y = sv.y + 40;
  S.act = { k: 'npc', id: 'vera', at: [sv.x, sv.y + 50], r: SIM.K.TALK }; run(S, 3); const i = S.dlg.choices.findIndex((c) => c[1] === 'vera_wardrobe'); run(S, 1, { choose: i }); run(S, 1);
  const L = SIM.dlgLayout(S); ok(S.dlg.choices.length === 7 && new Set(L.choices.map((r) => r.y)).size === 2 && L.choices.every((r) => r.w >= 240), 'Vera\'s seven costumes sit in two rows of wide buttons'); }
{ const S = fresh(); S.inv.chalk = 1; S.slot = 6; S.x = SIM.MODH.kirill.gate; S.y = -270; SIM.runDev(S, 'refuse kirill'); run(S, 2, { e: 1 }); run(S, 1);
  ok(S.chalk && S.chalk.free && S.chalk.mod === 'kirill', 'chalk at Kirill\'s gate: free drawing');
  const c = S.chalk, base = SIM.proj(c.at[0], c.at[1]); for (let k = 0; k < 3; k++) { for (let i = 0; i < 30; i++) run(S, 1, { press: 1, px: base[0] - S.cam[0] - 60 + k * 50 + 3 * i, py: base[1] - S.cam[1] - 30 + 2 * i, slot: k + 1 }); run(S, 1, { px: 5, py: 5 }); }
  ok(c.strokes.length === 3 && c.strokes.map((q) => q.col).join('') === '012' && S.slot === 6, 'the mouse draws, 1–3 pick colours, the hotbar stays');
  run(S, 1, { enter: 1 }); run(S, 1); ok(!S.chalk && S.kir.pr.chalk > 0 && S.drawings.some((d) => d.free && d.mod === 'kirill'), 'Enter: the drawing stays on the sidewalk and counts as a prank'); }
console.log(fails ? fails + ' FAILED' : 'all ok'); process.exit(fails ? 1 : 0);
