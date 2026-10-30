// v9 feature checks in node (pure sim): node tools/v9test.cjs
require('../live/sim.js'); const SIM = globalThis.SIM; let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const run = (S, n, inp = {}) => { for (let i = 0; i < n; i++) SIM.step(S, typeof inp === 'function' ? inp(i) : inp); };
const at = (S, x, y) => { S.x = x; S.y = y; S.vx = S.vy = 0; S.path = []; };
// 1. drop and pick up the rotten pumpkin
{ const S = SIM.spawn(0); run(S, 10); at(S, 1500, 120); S.carry = 'rotten'; run(S, 2, { g: 1 }); run(S, 2);
  ok(!S.carry && S.drops.length === 1, 'G drops the pumpkin'); const d = S.drops[0];
  S.act = { k: 'drop', i: 0, at: [d.x, d.y], r: 70 }; run(S, 2); ok(S.carry === 'rotten' && !S.drops.length, 'click picks it up again'); }
// 2. garage is solid
{ const S = SIM.spawn(0); run(S, 10); at(S, 6500, -1050); run(S, 240, { right: 1 }); ok(!(S.x > 6585 - 17 && S.y < -940 + 17), 'garage blocks (x=' + Math.round(S.x) + ', y=' + Math.round(S.y) + ')'); }
// 3. firecracker near passers-by stuns them
{ const S = SIM.spawn(0); run(S, 10); const n = S.npc[1]; at(S, n.x - 60, n.y + 10); S.inv.fire = 2; S.slot = 7; run(S, 2, { e: 1 }); run(S, 2);
  ok(S.fires.length === 1, 'E places a firecracker anywhere'); at(S, n.x - 600, n.y); run(S, 120 * 3.2); ok(n.stunT > S.t - 0.5, 'bang stuns the passer-by'); }
// 4. hit a passer-by 3 times → revenge
{ const S = SIM.spawn(0); run(S, 10); const n = S.npc[2]; at(S, n.x - 300, n.y); for (let k = 0; k < 3; k++) SIM.personHit ? 0 : 0;
  const hit = (S2) => { S2.proj.push({ kind: 'eggs', sx0: 0, sy0: 0, sx1: 0, sy1: 0, gx0: S2.x, gy0: S2.y, gx1: n.x, gy1: n.y, t0: S2.t, dur: 0.01, arc: 1, tg: { kind: 'npc', id: n.id }, seed: 1 }); run(S2, 3); };
  hit(S); hit(S); hit(S); ok(!!n.rev, 'three eggs → revenge (' + (n.rev && n.rev.st) + ')');
  let hp0 = S.hp, money0 = S.money; run(S, 120 * 8); ok(S.hp < hp0 || S.money < money0 || S.wrapT > 0, 'revenge lands: hp ' + hp0 + '→' + S.hp + ', money ' + money0 + '→' + S.money + ', ach payback ' + !!S.ach.payback); }
// 5. unread: messages arriving while the chat is open are read
{ const S = SIM.spawn(0); run(S, 10); S.phone = { app: 'dm', who: 'Эльф', t: S.t }; S.msgs.push({ from: 'Эльф', text: 'x', gt: 0, read: false }); run(S, 2); ok(S.msgs.filter((m) => m.from === 'Эльф' && !m.group).every((m) => m.read), 'opening a conversation marks it read (v12: the list itself does not)');
  S.phone = { app: 'dm', who: 'Модеры 🎃', t: S.t }; S.msgs.push({ from: 'Кирилл', text: 'y', gt: 0, read: false, group: true }, { from: 'Кирилл', text: 'z', gt: 0, read: false }); run(S, 2);
  ok(S.msgs[S.msgs.length - 2].read && !S.msgs[S.msgs.length - 1].read, 'group chat marks only group messages'); }
// 6. arrest → released by Elf's house
{ const S = SIM.spawn(0); run(S, 10); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; run(S, 120 * 12); at(S, S.raid.units[0].x + 20, S.raid.units[0].y); S.raid.units[0].st = 'chase'; run(S, 30);
  ok(S.raid.arrests >= 1 && Math.abs(S.x - (SIM.HE.door[0] + 170)) < 5, 'arrest releases at Elf\'s (x=' + Math.round(S.x) + ', arrests ' + S.raid.arrests + ')'); }
// 7. peaceful ending
{ const S = SIM.spawn(0); run(S, 10); SIM.runDev(S, 'peace'); SIM.runDev(S, 'finale'); ok(S.finale && S.finale.kind === 'peace' && S.finale.lines[0].cg === 'cg_peace1' && S.ach.saint, 'peace finale + Святой Коля'); 
  const S2 = SIM.spawn(0); run(S2, 10); SIM.runDev(S2, 'done all'); SIM.runDev(S2, 'finale'); ok(S2.finale.kind === 'party', 'party finale otherwise'); }
// 8. chalk anywhere
{ const S = SIM.spawn(0); run(S, 10); at(S, 900, 250); S.inv.chalk = 1; S.slot = 6; run(S, 2, { e: 1 }); ok(S.chalk && !S.chalk.mod, 'chalk anywhere starts');
  { const c = S.chalk; for (let k = 0; k < 6; k++) { const p = []; for (let i = 0; i < 12; i++) p.push([c.at[0] - 120 + k * 40 + 6 * Math.sin(i), c.at[1] - 100 + i * 17]); c.strokes.push({ col: k % 5, p }); } } run(S, 1, { enter: 1 }); run(S, 2); ok(S.drawings.length === 1 && S.drawings[0].free && S.ach.picasso, 'v12.1: a free drawing is kept + Пикассо (big drawing)'); }
// 9. alarm decoy draws the patrol
{ const S = SIM.spawn(0); run(S, 10); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; run(S, 120 * 12); S.ghost = true; at(S, 2000, 0); S.inv.alarm = 1; S.slot = 5; run(S, 2, { e: 1 }); run(S, 2);
  ok(S.decoys.length === 1, 'alarm on the ground'); run(S, 120 * 6.5); ok(S.raid.units.some((u) => u.alertAt || u.st === 'alert' || u.st === 'search'), 'patrol goes to check'); }
// 10. lamp shot out
{ const S = SIM.spawn(0); run(S, 10); S.hasGun = true; S.gun = true; S.inv.bb = 10; const [lx, ly] = SIM.LAMPS[3]; at(S, lx - 200, ly + 250); run(S, 2);
  const q = SIM.proj(lx, ly), c = [q[0] + SIM.LAMPHEAD[0], q[1] - SIM.LAMPHEAD[1]]; const tg = SIM.aimTarget(S, c); ok(tg.kind === 'lamp', 'lamp head is a target (' + tg.kind + ')');
  run(S, 1, { rpress: 1, px: c[0] - S.cam[0], py: c[1] - S.cam[1] }); run(S, 60); ok(!SIM.lampLit(S, 3), 'BB breaks the lamp'); }
// 11. cat
{ const S = SIM.spawn(0); run(S, 10); at(S, S.cat.x + 60, S.cat.y + 40); S.act = { k: 'cat', at: [S.cat.x, S.cat.y], r: 80 }; run(S, 2); ok(S.cat.follow > S.t, 'petting makes the cat follow'); at(S, S.x + 400, S.y); run(S, 240); ok(Math.hypot(S.cat.x - S.x, S.cat.y - S.y) < 160, 'cat follows'); }
// 12. bowl
{ const S = SIM.spawn(0); run(S, 10); S.hp = 50; S.act = { k: 'bowl', at: [SIM.BOWL[0], SIM.BOWL[1] + 40], r: 90 }; at(S, SIM.BOWL[0], SIM.BOWL[1] + 40); run(S, 2); ok(S.hp === 58 && S.sugarT > S.t, 'candy: +8 HP, sugar rush'); }
console.log(fails ? fails + ' FAILED' : 'all ok'); process.exit(fails ? 1 : 0);
