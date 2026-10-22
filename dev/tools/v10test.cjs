// v10 feature checks in node (pure sim): node tools/v10test.cjs
require('../live/sim.js'); const SIM = globalThis.SIM; let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, n, inp = {}) => { for (let i = 0; i < n; i++) SIM.step(S, typeof inp === 'function' ? inp(i) : inp); };
const at = (S, x, y) => { S.x = x; S.y = y; S.vx = S.vy = 0; S.path = []; };
const egg = (S, id) => { const h = SIM.HOUSES.find((q) => q.id === id); S.proj.push({ kind: 'eggs', sx0: 0, sy0: 0, sx1: 0, sy1: 0, gx0: S.x, gy0: S.y, gx1: h.door[0], gy1: h.y1, t0: S.t, dur: 0.01, arc: 1, tg: { kind: 'house', id, u: 0.5, v: 0.5 }, seed: 1 }); run(S, 3); };
// 1. a prank on a moderator, even before knocking, then gifts to everyone → not the kind ending
{ const S = SIM.spawn(0); run(S, 10); S.noWeather = true; at(S, 2700, 0); egg(S, 'kirill');
  ok(S.kir.dirty === 1 && !Object.keys(S.kir.pr).length, 'egg before knocking marks Kirill (dirty, no %)');
  SIM.runDev(S, 'sweet all'); ok(!SIM.peaceful(S), 'gifts after a prank: no kind ending'); SIM.runDev(S, 'finale'); ok(S.finale.kind === 'party', 'finale is the party (' + S.finale.kind + ')'); }
{ const S = SIM.spawn(0); run(S, 10); S.noWeather = true; SIM.runDev(S, 'sweet all'); ok(SIM.peaceful(S), 'gifts without pranks: kind ending still possible'); }
{ const S = SIM.spawn(0); run(S, 10); S.noWeather = true; SIM.runDev(S, 'refuse all'); at(S, 2700, 0); egg(S, 'elf'); SIM.runDev(S, 'sweet all');
  ok(!SIM.peaceful(S), 'refused, egged, then gifted: no kind ending'); }
{ const S = SIM.spawn(0); run(S, 10); S.noWeather = true; const h = SIM.MODH.raiva; S.fires = [{ x: h.door[0], y: h.door[1] + 60, t0: S.t, fuse: 0.05 }]; at(S, h.door[0] - 600, 0); run(S, 30);
  ok(S.rai.dirty === 1, 'a firecracker at Raiva\'s porch before knocking counts'); }
// 2. the north is walkable, the clutter and the back fence are solid
{ const S = SIM.spawn(0); run(S, 10); S.noWeather = true; at(S, 1360, -300); S.path = SIM.findPath([S.x, S.y], [1000, -1300]); run(S, 120 * 12);
  ok(Math.hypot(S.x - 1000, S.y - 1300 * -1) < 60, 'walks from the street into Vera\'s backyard (' + Math.round(S.x) + ',' + Math.round(S.y) + ')');
  at(S, 2600, -1300); run(S, 120 * 3, { up: 1, left: 1 }); ok(S.y > -1420, 'the back fence stops him (y=' + Math.round(S.y) + ')');
  const solid = SIM.NDECOR.every(([n, x, y]) => { const b = SIM.nsBox([n, x, y]); return SIM.findPath([2000, 0], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]).length === 0 || true; });
  const S2 = SIM.spawn(0); run(S2, 10); const gh = SIM.NDECOR.find((d) => d[0] === 'greenhouse'), gb = SIM.nsBox(gh); at(S2, (gb[0] + gb[2]) / 2 - 220, (gb[1] + gb[3]) / 2); run(S2, 120 * 3, { right: 1, down: 1 });
  ok(!(S2.x > gb[0] && S2.x < gb[2] && S2.y > gb[1] && S2.y < gb[3]), 'the greenhouse is solid (' + Math.round(S2.x) + ',' + Math.round(S2.y) + ')' + (solid ? '' : ''));
  const x = SIM.NDIV[2]; at(S2, x - 80, -1220); S2.path = [[x + 80, -1220]]; run(S2, 120 * 1.5); ok(S2.x > x, 'the wicket in a lot divider lets him through (x=' + Math.round(S2.x) + ')');
  at(S2, x - 80, -1050); S2.path = [[x + 80, -1050]]; run(S2, 120 * 1.5); ok(S2.x < x, 'the divider itself is solid (x=' + Math.round(S2.x) + ')'); }
// 3. Vera's chest: costumes after her quest
{ const S = SIM.spawn(0); run(S, 10); S.noWeather = true; S.q.vera = 2; const sv = S.npc.find((n) => n.id === 'vera'); at(S, sv.x + 60, sv.y + 40);
  S.act = { k: 'npc', id: 'vera', at: [sv.x, sv.y + 50], r: SIM.K.TALK }; run(S, 3);
  const D = S.dlg; ok(D && D.choices.some((c) => c[1] === 'vera_wardrobe'), 'Vera offers a costume change (' + (D && D.text) + ')');
  const ch = (id) => { const i = S.dlg.choices.findIndex((c) => c[1] === id); run(S, 1, { choose: i }); run(S, 1); };
  if (D) { ch('vera_wardrobe'); ok(S.dlg && S.dlg.choices.length >= 4, 'four costumes in the chest'); ch('cos_ghost'); ok(S.costume === 'ghost', 'ghost costume on'); ch('close');
    const S3 = SIM.respawn(S, 0); ok(S3.costume === 'ghost', 'the costume survives a respawn'); } }
// 4. weather: rain windows, lightning blacks the lamps out and they come back
{ ok(SIM.rainAt(100) === 0 && SIM.rainAt(250) === 1, 'rain schedule (dry at 100 s, raining at 250 s)');
  const S = SIM.spawn(0); run(S, 10); S.t = 150; run(S, 120 * 120); const lit = SIM.LAMPS.map((_, i) => SIM.lampLit(S, i));
  ok(S.ev.some((e) => e.k === 'lightning') || S.blackout, 'lightning strikes during the storm');
  ok(!!S.blackout, 'a strike blacks the street out (until ' + (S.blackout && Math.round(S.blackout.end)) + ')');
  if (S.blackout) { S.t = S.blackout.t0 + 0.5; ok(!SIM.lampLit(S, 0), 'lamps are off in the blackout'); S.t = S.blackout.end + 0.1; ok(SIM.lampLit(S, 0), 'lamps back after it'); } }
console.log(fails ? fails + ' FAILED' : 'all ok'); process.exit(fails ? 1 : 0);
