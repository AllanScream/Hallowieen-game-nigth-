// v11 feature checks in node (pure sim): node tools/v11test.cjs
require('../live/sim.js'); const SIM = globalThis.SIM; let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, n, inp = {}) => { for (let i = 0; i < n; i++) SIM.step(S, typeof inp === 'function' ? inp(i) : inp); };
const at = (S, x, y) => { S.x = x; S.y = y; S.vx = S.vy = 0; S.path = []; };
const slotOf = (n) => SIM.SLOTS.indexOf(n) + 1;
// 1. flyers: stick one, take it down again with E, the post is free
{ const S = SIM.spawn(0); run(S, 10); S.noWeather = true; const [lx, ly] = SIM.LAMPS[4]; at(S, lx + 40, ly + 40); S.inv.flyers = 1; S.slot = slotOf('flyers'); run(S, 2, { e: 1 }); run(S, 2);
  ok((S.flyers2 || []).includes(4) && S.inv.flyers === 0, 'a flyer goes up on the post');
  run(S, 2, { e: 1 }); run(S, 2); ok(!(S.flyers2 || []).includes(4) && S.inv.flyers === 1, 'E takes it down, back in the pocket');
  SIM.runDev(S, 'refuse all'); S.target = 'kirill'; run(S, 2, { e: 1 }); run(S, 2); ok(S.kir.lamps.includes(4), 'a moderator\'s flyer goes up');
  run(S, 2, { e: 1 }); run(S, 2); ok(!S.kir.lamps.includes(4) && S.inv.flyers === 1, 'and comes down too'); }
// 2. tp: «tp home kirill» goes to Kirill, every house by name
{ const S = SIM.spawn(0); run(S, 10); const cases = [['tp home kirill', SIM.MODH.kirill.door[0]], ['tp дом эльфа', SIM.MODH.elf.door[0]], ['tp petrov', SIM.HOUSES.find((h) => h.id === 'a').door[0]], ['ез кирилл', SIM.MODH.kirill.door[0]], ['tp home', SIM.HKO.door[0]]];
  cases.forEach(([c, x]) => { SIM.runDev(S, c); ok(Math.abs(S.x - x) < 2, c + ' → x ' + Math.round(S.x)); }); }
// 3. contacts answer what was written, by mood
{ const S = SIM.spawn(0); run(S, 10); S.noWeather = true;
  const ask = (who, t) => { S.phone = { app: 'dm', who, t: S.t - 1 }; run(S, 1, { text: t }); run(S, 600); const l = S.dm[who]; return l[l.length - 1]; };
  let r = ask('Эльф', 'привет'); ok(!r.me && /Коля|Приветик/.test(r.text), 'Elf answers a greeting: ' + r.text);
  r = ask('Тимофей', 'где я?'); ok(/у своего дома|Ты /.test(r.text), 'Timofey says where you are: ' + r.text);
  SIM.runDev(S, 'refuse all'); S.kir.p = 30; r = ask('Кирилл', 'привет'); ok(/засрал|нахуй/.test(r.text), 'Kirill answers in anger after pranks: ' + r.text);
  S.costume = 'pumpkin'; r = ask('Райва', 'как мой костюм?'); ok(/Тыквоголов/.test(r.text), 'Raiva comments on the costume: ' + r.text);
  r = ask('Скелет', 'займи денег'); ok(/долг/i.test(r.text), 'Skelet on money: ' + r.text); }
// 4. Elf's messages are flirtier
{ const S = SIM.spawn(0); ok(S.msgs.some((m) => m.from === 'Эльф' && /😘/.test(m.text)), 'Elf\'s first message flirts'); }
console.log(fails ? fails + ' FAILED' : 'all ok'); process.exit(fails ? 1 : 0);
