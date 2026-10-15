// Headless functional playtest of the whole Kirill loop through the sim's real input path.
const SIM = require('../live/sim.js');
process.on('uncaughtException', (e) => { console.log(log.slice(-30).join('\n')); console.log(e.stack); process.exit(1); });
const S = SIM.spawn(0), HK = SIM.HK, F = SIM.FACADE;
let log = [];
const step = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) SIM.step(S, i === 0 ? inp : { rpress: inp.rpress, e: inp.e && inp.hold ? 1 : 0, press: inp.press, px: inp.px, py: inp.py }); };
const idle = (sec) => step({}, Math.round(sec / SIM.DT));
const scr = (x, y, z = 0) => { const p = SIM.proj(x, y, z); return [p[0] - S.cam[0], p[1] - S.cam[1]]; };
const goto = (x, y, max = 60) => { SIM.step(S, { goto: [x, y] }); let t = 0; while ((S.path.length || Math.hypot(S.vx, S.vy) > 5) && t < max) { idle(0.1); t += 0.1; } return Math.hypot(S.x - x, S.y - y); };
const click = (x, y, z = 0) => { const [px, py] = scr(x, y, z); step({ click: 1, px, py }); };
const key = (k, extra = {}) => { step(Object.assign({ [k]: 1 }, extra)); step({}); };
const ok = (c, m) => { log.push((c ? 'OK   ' : 'FAIL ') + m); };
S.money = 5000;
// talk to 5 neighbours
for (const n of S.npc.slice(1, 7)) { for (let k = 0; k < 4 && !S.talked[SIM.NPCS[n.i].id]; k++) { goto(n.x, n.y + 60, 8); const [px, py] = scr(n.x, n.y, 60); step({ click: 1, px, py }); let w = 0; while (S.act && w++ < 80) idle(0.1); idle(0.3); } }
ok(S.q.talk >= 5, `talked ${S.q.talk}/5, money ${S.money}`);
// knock
ok(goto(HK.door[0], F + 60) < 60, 'walk to Kirill door');
click(HK.door[0], F, 80); idle(1);
ok(S.dlg && S.dlg.who === 'kirill', 'dialog opens: ' + (S.dlg && S.dlg.text.slice(0, 40)));
step({ choose: 1 }); idle(0.2); ok(S.kir.refused, 'chose prank → refused'); step({ choose: 0 }); idle(0.1); ok(!S.dlg, 'dialog closed');
// shop
key('tab'); ok(!!S.phone, 'phone opens');
for (const id of ['eggs', 'tp', 'alarm', 'fire', 'slime', 'chalk', 'flyers']) step({ phone: 'buy_' + id });
key('tab'); ok(S.inv.eggs >= 12 && S.inv.tp === 4 && S.inv.flyers === 5, `bought: ${JSON.stringify(S.inv)}`);
const waitWindow = (sec = 3.2) => { let k = 0; const busy = () => { for (let u = 0; u <= sec; u += 0.05) if (SIM.kirillWindow(S.t + u)) return true; return false; }; while (busy() && k++ < 4000) idle(0.05); };   // a free stretch of `sec` s before Kirill looks out again
// eggs at the facade
goto(HK.door[0] - 120, -300); S.slot = 1;
for (let i = 0; i < 6; i++) { waitWindow(); const [px, py] = scr(HK.x0 + 120 + i * 60, F, 120); step({ rpress: 1, px, py }); step({ rpress: 0 }); idle(1.2); }
ok(S.kir.p > 10, `eggs → ${S.kir.p.toFixed(1)} %`);
// TP: hold & release
S.slot = 2; for (let i = 0; i < 2; i++) { waitWindow(); const [px, py] = scr(HK.door[0], F, 230); step({ rpress: 1, px, py }, 1); for (let k = 0; k < 90; k++) SIM.step(S, { rpress: 1, px, py }); step({ rpress: 0, px, py }); idle(1.5); }
ok((S.kir.pr.tp || 0) >= 6, `tp → ${S.kir.p.toFixed(1)} % (tp ${S.kir.pr.tp})`);
// doorbell ditch: ring, run to the road
S.slot = 3; goto(HK.door[0], F + 60); waitWindow(); key('e'); goto(HK.door[0] - 300, 150, 4); idle(3.5);
ok((S.kir.pr.bell || 0) >= 8, `bell → ${S.kir.p.toFixed(1)} %, hp ${S.hp}`);
// alarm in mailbox
S.slot = 5; goto(HK.mail[0], HK.mail[1] + 40); waitWindow(); key('e'); idle(9);
ok((S.kir.pr.alarm || 0) >= 8, `alarm → ${S.kir.p.toFixed(1)} %`);
// chalk minigame: trace all points
S.slot = 6; goto(HK.gate, -270); key('e'); ok(!!S.chalk, 'chalk started');
if (S.chalk) for (const p of S.chalk.pts) { const [px, py] = scr(p[0], p[1]); SIM.step(S, { press: 1, px, py }); }
idle(0.2); ok((S.kir.pr.chalk || 0) > 0, `chalk → ${S.kir.p.toFixed(1)} %`);
// firecrackers: place, run
S.slot = 7; goto(HK.door[0], F + 60); waitWindow(); key('e'); goto(HK.door[0] - 400, 150, 4); idle(3);
ok((S.kir.pr.fire || 0) >= 10, `fire → ${S.kir.p.toFixed(1)} %, hp ${S.hp}`);
// slime: hold E 2.6 s while Kirill is not at the window
S.slot = 8; goto(HK.door[0], F + 60); idle(4.5); waitWindow(3.4); key('e'); for (let k = 0; k < 330; k++) SIM.step(S, { e: 1 }); step({});
ok(S.kir.slime === 1, `slime → ${S.kir.p.toFixed(1)} %`);
// pizza
key('tab'); step({ phone: 'pizza' }); step({ phone: 'order_pizza' }); ok(!S.phone, 'phone closes after the order');
idle(30); ok((S.kir.pr.pizza || 0) >= 10, `pizza → ${S.kir.p.toFixed(1)} % (courier ${S.courier ? S.courier.st : 'gone'})`);
// flyers on 5 lamps
S.slot = 10; for (const li of [2, 3, 1, 4, 0]) { const [lx, ly] = SIM.LAMPS[li]; goto(lx + 40, ly + 50); key('e'); }
ok(S.kir.lamps.length === 5, `flyers ${S.kir.lamps.length}/5 → ${S.kir.p.toFixed(1)} %`);
// rotten pumpkin from the alley
const [rx, ry] = SIM.ROTTEN; goto(rx, ry + 60, 40); click(rx, ry, 10); idle(1); ok(S.carry === 'rotten', 'picked the rotten pumpkin');
S.slot = 4; goto(HK.door[0] + 60, F + 60, 60); waitWindow(); key('e'); ok(S.kir.swapped, `swap → ${S.kir.p.toFixed(1)} %`);
ok(S.kir.done >= 0, `house done: ${S.kir.p.toFixed(1)} %`);
idle(15); ok(S.msgs.some((m) => m.from === 'Кирилл' && m.text.includes('трусы')), 'revenge message after 1 game minute');
idle(105); ok(S.kir.auction >= 1, `auction notifications: ${S.kir.auction}`);
// Vera quest + strange lights
goto(SIM.HOUSES[0].door[0], F + 100); const v = S.npc[0]; const [vx, vy] = scr(v.x, v.y, 60); step({ click: 1, px: vx, py: vy }); { let w = 0; while (!S.dlg && w++ < 50) idle(0.1); } step({ choose: 0 }); idle(0.2); step({ choose: 0 }); idle(0.2);
for (const [x, y] of SIM.VPUMPKINS) goto(x, y + 30, 60);
goto(SIM.HOUSES[0].door[0], F + 100); step({ click: 1, px: scr(v.x, v.y, 60)[0], py: scr(v.x, v.y, 60)[1] }); { let w = 0; while (!S.dlg && w++ < 50) idle(0.1); } step({ choose: 0 }); idle(0.2); step({ choose: 0 }); idle(0.2);
ok(S.q.vera === 2, `vera quest ${S.q.vera}, found ${S.vp.filter((q) => q >= 0).length}`);
goto(SIM.STRANGE[0], SIM.STRANGE[1] + 120, 80); ok(S.q.strange === 1, 'strange lights found');
console.log(log.join('\n')); console.log('clock', SIM.clockStr(S), 'money', S.money, 'hp', S.hp);
// second run: the gift path, and getting caught by the doorbell
{ const T = SIM.spawn(0); T.money = 500; const st = (i) => SIM.step(T, i || {});
  st({ tab: 1 }); st({}); st({ phone: 'shop' }); st({ phone: 'buy_energy' }); st({ tab: 1 }); st({});
  T.x = HK.door[0]; T.y = F + 60; for (let i = 0; i < 30; i++) st({});
  const q = SIM.proj(HK.door[0], F, 80); st({ click: 1, px: q[0] - T.cam[0], py: q[1] - T.cam[1] }); for (let i = 0; i < 60; i++) st({});
  st({ choose: 0 }); st({}); st({ choose: 0 }); st({});
  log.push((T.kir.sweet ? 'OK   ' : 'FAIL ') + 'gift «Бан-хаммер» → candy (sweet ' + T.kir.sweet + ')');
  const U = SIM.spawn(0); U.kir.refused = true; U.x = HK.door[0]; U.y = F + 60; U.slot = 3; for (let i = 0; i < 30; i++) SIM.step(U, {});
  SIM.step(U, { e: 1 }); SIM.step(U, {}); for (let i = 0; i < 480; i++) SIM.step(U, {});
  log.push((U.hp < 100 ? 'OK   ' : 'FAIL ') + 'caught after the doorbell: hp ' + U.hp); }

// third run: aiming — every house and tree takes hits exactly where the cursor is; too far is refused
{ const V = SIM.spawn(0); V.inv.eggs = 20; V.x = 1800; V.y = -300; for (let i = 0; i < 240; i++) SIM.step(V, {});
  const shoot = (c) => { const px = c[0] - V.cam[0], py = c[1] - V.cam[1], n = V.marks.length; SIM.step(V, { px, py, rpress: 1 }); for (let i = 0; i < 200; i++) SIM.step(V, { px, py }); return V.marks.length > n ? V.marks[V.marks.length - 1] : null; };
  const H = SIM.HOUSES[1], r = SIM.houseRect(H), tgt = [[0.25, 0.45], [0.5, 0.3], [0.7, 0.62]].map(([u, v]) => [r.x + r.w * u, r.y + r.h * v]);
  const hits = tgt.map(shoot), good = hits.every((m, i) => m && m.on === 'house' && m.id === H.id && Math.hypot(m.sx - tgt[i][0], m.sy - tgt[i][1]) < 1);
  log.push((good ? 'OK   ' : 'FAIL ') + 'eggs land on the neighbour house exactly at the cursor: ' + hits.map((m) => m && `${m.on}:${m.id}@${m.u.toFixed(2)},${m.v.toFixed(2)}`).join(' '));
  V.x = 520; V.y = -300; for (let i = 0; i < 240; i++) SIM.step(V, {});
  const ti = 8, tr = SIM.treeRect(ti), tm = shoot([tr.x + tr.w * 0.5, tr.y + tr.h * 0.35]);                     // the yard tree in front of Vera's house
  log.push((tm && tm.on === 'tree' && tm.i === ti ? 'OK   ' : 'FAIL ') + 'egg hits the tree crown: ' + (tm && tm.on));
  const gp = SIM.proj(V.x + 200, V.y + 250), gm = shoot(gp); log.push((gm && gm.on === 'ground' && Math.hypot(gm.x - V.x - 200, gm.y - V.y - 250) < 2 ? 'OK   ' : 'FAIL ') + 'egg on the road lands at the cursor');
  const far = SIM.proj(V.x + 3000, V.y), fm = shoot(far); log.push((!fm ? 'OK   ' : 'FAIL ') + 'a throw beyond reach is refused'); }
// fourth run: Raiva's house, her porch camera, the full prank cycle and the «КотоМем» virus
{ const S2 = SIM.spawn(0), HR = SIM.HR, st = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) SIM.step(S2, i === 0 ? inp : { rpress: inp.rpress, e: inp.e && inp.hold ? 1 : 0, press: inp.press, px: inp.px, py: inp.py }); };
  const idl = (sec) => st({}, Math.round(sec / SIM.DT)), sc = (x, y, z = 0) => { const q = SIM.proj(x, y, z); return [q[0] - S2.cam[0], q[1] - S2.cam[1]]; };
  const go = (x, y, max = 60) => { SIM.step(S2, { goto: [x, y] }); let t = 0; while ((S2.path.length || Math.hypot(S2.vx, S2.vy) > 5) && t < max) { idl(0.1); t += 0.1; } return Math.hypot(S2.x - x, S2.y - y); };
  const camFree = (sec = 3.2) => { let k = 0; const busy = () => { for (let u = 0; u <= sec; u += 0.05) if (SIM.watchOn(S2, 'raiva', S2.t + u)) return true; return false; }; while (busy() && k++ < 4000) idl(0.05); };
  const key = (k2) => { st({ [k2]: 1 }); st({}); }, R = (c, m) => log.push((c ? 'OK   ' : 'FAIL ') + 'Raiva: ' + m), rk = () => S2.rai;
  S2.money = 9000; key('tab'); for (const id of ['eggs', 'tp', 'alarm', 'fire', 'slime', 'chalk', 'flyers', 'solder']) st({ phone: 'buy_' + id }); key('tab');
  R(go(HR.door[0], SIM.FACADE + 60) < 60, 'walk to the door'); { const [px, py] = sc(HR.door[0], SIM.FACADE, 80); st({ click: 1, px, py }); idl(1); }
  R(S2.dlg && S2.dlg.who === 'raiva', 'dialog: ' + (S2.dlg && S2.dlg.text.slice(0, 50))); st({ choose: 1 }); idl(0.2); R(rk().refused && S2.target === 'raiva', 'prank → refused, target'); st({ choose: 0 }); idl(0.1);
  go(HR.door[0] - 100, -300); S2.slot = 1;
  for (let i = 0; i < 6; i++) { camFree(); const r = SIM.houseRect(HR), c = [r.x + r.w * (0.3 + 0.08 * i), r.y + r.h * 0.6]; st({ rpress: 1, px: c[0] - S2.cam[0], py: c[1] - S2.cam[1] }); st({ rpress: 0 }); idl(1.2); }
  R(rk().p > 10, `eggs → ${rk().p.toFixed(0)} %`);
  S2.slot = 3; go(HR.door[0], SIM.FACADE + 60); camFree(); key('e'); go(HR.door[0] - 300, 150, 4); idl(3.5); R((rk().pr.bell || 0) >= 8, `bell → ${rk().p.toFixed(0)} %`);
  S2.slot = 5; go(HR.mail[0], HR.mail[1] + 40); key('e'); idl(9); R((rk().pr.alarm || 0) >= 8, `alarm → ${rk().p.toFixed(0)} %`);
  S2.slot = 6; go(HR.gate, -270); key('e'); if (S2.chalk) for (const p of S2.chalk.pts) { const [px, py] = sc(p[0], p[1]); SIM.step(S2, { press: 1, px, py }); } idl(0.2); R((rk().pr.chalk || 0) > 0, `chalk → ${rk().p.toFixed(0)} %`);
  S2.slot = 7; go(HR.door[0], SIM.FACADE + 60); key('e'); go(HR.door[0] - 400, 150, 4); idl(3); R((rk().pr.fire || 0) >= 10, `fire → ${rk().p.toFixed(0)} %`);
  S2.slot = 8; go(HR.door[0], SIM.FACADE + 60); idl(4.5); camFree(3.4); key('e'); for (let k = 0; k < 330; k++) SIM.step(S2, { e: 1 }); st({}); R(rk().slime === 1, `slime → ${rk().p.toFixed(0)} %`);
  key('tab'); st({ phone: 'pizza' }); st({ phone: 'order_pizza' }); idl(34); R((rk().pr.pizza || 0) >= 10, `pizza → ${rk().p.toFixed(0)} %`);
  S2.slot = 10; for (const li of [5, 6, 4, 13, 12]) { const [lx, ly] = SIM.LAMPS[li]; go(lx + 40, ly + (ly < 0 ? 50 : -50)); key('e'); } R(rk().lamps.length === 5, `flyers ${rk().lamps.length}/5 → ${rk().p.toFixed(0)} %`);
  const [rx, ry] = SIM.ROTTENS[1]; go(rx, ry + 60, 60); { const [px, py] = sc(rx, ry, 10); st({ click: 1, px, py }); idl(1); } R(S2.carry === 'rotten', 'picked the second rotten pumpkin');
  S2.slot = 4; go(HR.door[0] + 60, SIM.FACADE + 60, 60); camFree(); key('e'); R(rk().swapped, `swap → ${rk().p.toFixed(0)} %`);
  if (rk().done < 0) { S2.slot = 2; go(HR.door[0] - 100, -300); for (let i = 0; i < 4 && rk().done < 0; i++) { camFree(); const r = SIM.houseRect(HR), c = [r.x + r.w * 0.6, r.y + r.h * 0.3]; st({ rpress: 1, px: c[0] - S2.cam[0], py: c[1] - S2.cam[1] }, 1); for (let k = 0; k < 90; k++) SIM.step(S2, { rpress: 1, px: c[0] - S2.cam[0], py: c[1] - S2.cam[1] }); st({ rpress: 0, px: c[0] - S2.cam[0], py: c[1] - S2.cam[1] }); idl(1.5); } }
  R(rk().done >= 0, `house done: ${rk().p.toFixed(0)} %`);
  idl(12); R(rk().virus && rk().virus.st === 'pending' && S2.msgs.some((m) => m.from === 'Райва' && m.text.includes('КотоМем')), 'virus message arrives');
  key('tab'); st({ phone: 'chats' }); R(rk().virus.st === 'download', 'opening the chat starts the download'); idl(3.5); R(rk().virus.st === 'active', 'virus installed');
  key('tab'); const m0 = S2.money, nEv = () => S2.ev.filter((e) => e.k === 'virus' && e.kind !== 'glitch').length; let noises = 0, seenEv = new Set();
  for (let i = 0; i < 70 * 10; i++) { idl(0.1); S2.ev.forEach((e) => { if (e.k === 'virus' && e.kind !== 'glitch' && !seenEv.has(e)) { seenEv.add(e); noises++; } }); }
  R(rk().junk.length >= 1 && S2.money < m0, `random purchases: ${rk().junk.map((j) => j.name).join(', ')} (money ${m0} → ${S2.money})`); R(noises >= 1, `phone shrieks: ${noises}`);
  const G = SIM.spawn(0); G.money = 500; G.inv.solder = 1; G.x = HR.door[0]; G.y = SIM.FACADE + 60; for (let i = 0; i < 40; i++) SIM.step(G, {});
  const q = SIM.proj(HR.door[0], SIM.FACADE, 80); SIM.step(G, { click: 1, px: q[0] - G.cam[0], py: q[1] - G.cam[1] }); for (let i = 0; i < 60; i++) SIM.step(G, {});
  SIM.step(G, { choose: 0 }); SIM.step(G, {}); SIM.step(G, { choose: 0 }); SIM.step(G, {}); R(G.rai.sweet, 'gift «Паяльник «Огонёк»» → candy'); }
// fifth run: Elf's house — the motion-sensor floodlight, the full prank cycle, then her revenge: the raid
{ const S3 = SIM.spawn(0), HE = SIM.HE, st = (inp = {}, n = 1) => { for (let i = 0; i < n; i++) SIM.step(S3, i === 0 ? inp : { rpress: inp.rpress, e: inp.e && inp.hold ? 1 : 0, press: inp.press, px: inp.px, py: inp.py }); };
  const idl = (sec) => st({}, Math.round(sec / SIM.DT)), sc = (x, y, z = 0) => { const q = SIM.proj(x, y, z); return [q[0] - S3.cam[0], q[1] - S3.cam[1]]; };
  const go = (x, y, max = 60) => { SIM.step(S3, { goto: [x, y] }); let t = 0; while ((S3.path.length || Math.hypot(S3.vx, S3.vy) > 5) && t < max) { idl(0.1); t += 0.1; } return Math.hypot(S3.x - x, S3.y - y); };
  const dark = () => { let k = 0; while (S3.elf.lit >= 0 && k++ < 200) idl(0.1); };            // stand still until the floodlight goes out
  const key = (k2) => { st({ [k2]: 1 }); st({}); }, R = (c, m) => log.push((c ? 'OK   ' : 'FAIL ') + 'Elf: ' + m), ek = () => S3.elf;
  S3.money = 9000; key('tab'); for (const id of ['eggs', 'tp', 'alarm', 'fire', 'slime', 'chalk', 'flyers', 'latte']) st({ phone: 'buy_' + id }); key('tab');
  R(go(HE.door[0], SIM.FACADE + 60) < 60, 'walk to the door'); R(ek().lit >= 0, 'moving in her yard switches the floodlight on');
  dark(); R(ek().lit < 0, 'standing still: the light goes out after a few seconds');
  { const [px, py] = sc(HE.door[0], SIM.FACADE, 80); st({ click: 1, px, py }); idl(1); }
  R(S3.dlg && S3.dlg.who === 'elf', 'dialog: ' + (S3.dlg && S3.dlg.text.slice(0, 50))); st({ choose: 1 }); idl(0.2); R(ek().refused && S3.target === 'elf', 'prank → refused, target'); st({ choose: 0 }); idl(0.1);
  go(HE.door[0] - 100, -300); S3.slot = 1;
  for (let i = 0; i < 6; i++) { const r = SIM.houseRect(HE), c = [r.x + r.w * (0.3 + 0.08 * i), r.y + r.h * 0.6]; st({ rpress: 1, px: c[0] - S3.cam[0], py: c[1] - S3.cam[1] }); st({ rpress: 0 }); idl(1.2); }
  R(ek().p > 10, `eggs from the sidewalk → ${ek().p.toFixed(0)} %`);
  { const p0 = ek().p; go(HE.door[0], SIM.FACADE + 60); const r = SIM.houseRect(HE), c = [r.x + r.w * 0.4, r.y + r.h * 0.5]; idl(0.3); R(ek().lit >= 0, 'walking up the yard lights it');
    st({ rpress: 1, px: c[0] - S3.cam[0], py: c[1] - S3.cam[1] }); st({ rpress: 0 }); idl(1.2); R(S3.ev.some((e) => e.k === 'spotted' && e.id === 'elf'), `a throw in the floodlight is spotted (${p0.toFixed(0)} → ${ek().p.toFixed(0)} %)`); }
  S3.slot = 3; go(HE.door[0], SIM.FACADE + 60); dark(); const hp0 = S3.hp; key('e'); idl(4.5); R(S3.hp < hp0, `bell, staying in the yard: a suction-cup arrow (hp ${hp0} → ${S3.hp})`);
  idl(17); go(HE.door[0], SIM.FACADE + 60); dark(); key('e'); go(HE.door[0] - 300, 150, 4); idl(3.5); R((ek().pr.bell || 0) >= 8, `bell and run → ${ek().p.toFixed(0)} %`);
  S3.slot = 5; go(HE.mail[0], HE.mail[1] + 40); key('e'); idl(9); R((ek().pr.alarm || 0) >= 8, `alarm → ${ek().p.toFixed(0)} %`);
  S3.slot = 6; go(HE.gate, -270); key('e'); if (S3.chalk) for (const p of S3.chalk.pts) { const [px, py] = sc(p[0], p[1]); SIM.step(S3, { press: 1, px, py }); } idl(0.2); R((ek().pr.chalk || 0) > 0, `chalk → ${ek().p.toFixed(0)} %`);
  S3.slot = 7; go(HE.door[0], SIM.FACADE + 60); dark(); key('e'); go(HE.door[0] - 400, 150, 4); idl(3); R((ek().pr.fire || 0) >= 10, `fire → ${ek().p.toFixed(0)} %`);
  S3.slot = 8; go(HE.door[0], SIM.FACADE + 60); idl(4.5); dark(); key('e'); for (let k = 0; k < 330; k++) SIM.step(S3, { e: 1 }); st({}); R(ek().slime === 1, `slime in the dark → ${ek().p.toFixed(0)} %`);
  key('tab'); st({ phone: 'pizza' }); st({ phone: 'order_pizza' }); idl(34); R((ek().pr.pizza || 0) >= 10, `pizza → ${ek().p.toFixed(0)} %`);
  S3.slot = 10; for (const li of [6, 7, 13, 5, 12]) { const [lx, ly] = SIM.LAMPS[li]; go(lx + 40, ly + (ly < 0 ? 50 : -50)); key('e'); } R(ek().lamps.length === 5, `flyers ${ek().lamps.length}/5 → ${ek().p.toFixed(0)} %`);
  const [rx, ry] = SIM.ROTTENS[0]; go(rx, ry + 60, 60); { const [px, py] = sc(rx, ry, 10); st({ click: 1, px, py }); idl(1); } R(S3.carry === 'rotten', 'picked the rotten pumpkin in the alley');
  S3.slot = 4; go(HE.door[0] + 60, SIM.FACADE + 60, 60); dark(); key('e'); R(ek().swapped, `swap in the dark → ${ek().p.toFixed(0)} %`);
  if (ek().done < 0) { S3.slot = 2; go(HE.door[0] - 100, -300); for (let i = 0; i < 4 && ek().done < 0; i++) { const r = SIM.houseRect(HE), c = [r.x + r.w * 0.6, r.y + r.h * 0.3]; st({ rpress: 1, px: c[0] - S3.cam[0], py: c[1] - S3.cam[1] }, 1); for (let k = 0; k < 90; k++) SIM.step(S3, { rpress: 1, px: c[0] - S3.cam[0], py: c[1] - S3.cam[1] }); st({ rpress: 0, px: c[0] - S3.cam[0], py: c[1] - S3.cam[1] }); idl(1.5); } }
  if (ek().done < 0) { S3.slot = 1; for (let i = 0; i < 8 && ek().done < 0; i++) { const r = SIM.houseRect(HE), c = [r.x + r.w * (0.25 + 0.06 * i), r.y + r.h * 0.55]; st({ rpress: 1, px: c[0] - S3.cam[0], py: c[1] - S3.cam[1] }); st({ rpress: 0 }); idl(1.2); } }
  R(ek().done >= 0, `house done: ${ek().p.toFixed(0)} %`);
  go(4360, -1150, 60); idl(10); R(!S3.raid, 'no raid before 3 game minutes');
  idl(22); R(S3.raid && S3.msgs.some((m) => m.from === 'Эльф' && m.text.includes('пизда')), 'after 3 game minutes: «Коля, тебе пизда.»');
  idl(14); R(S3.raid && S3.raid.st === 'search' && S3.raid.units.length === 4, `police and soldiers arrive: ${S3.raid && S3.raid.units.map((u) => u.kind).join(', ')}`);
  { const b = SIM.BINS[2]; S3.x = b[0] + 10; S3.y = b[1] + 60; S3.path = []; key('space'); }
  idl(60); R(S3.hidden && S3.raid.arrests === 0, 'hidden in the dumpster in the dark alley: not found in 60 s'); key('space');
  const insp = new Set(); for (let i = 0; i < 1200; i++) { idl(0.1); S3.raid.units.forEach((u) => { if (u.st === 'inspect' && u.t1) insp.add(u.npc); }); }
  R(insp.size >= 1, `they stop and question passers-by: ${[...insp].join(', ')}`);
  // in the open, right in front of a patrol: chased and arrested
  { const u = S3.raid.units[0]; S3.raid.grace = 0; S3.x = u.x + 160 * Math.cos(u.wa); S3.y = u.y + 160 * Math.sin(u.wa); S3.path = []; const m0 = S3.money; let chased = false;
    for (let i = 0; i < 100 && !S3.raid.arrests; i++) { idl(0.1); if (S3.raid.units.some((q) => q.st === 'chase')) chased = true; }
    R(chased && S3.raid.arrests === 1 && S3.money < m0, `in the open: chased and arrested (fine ${m0 - S3.money} ₽, unit ${u.st}, sus ${u.sus.toFixed(2)}, d ${Math.round(Math.hypot(S3.x - u.x, S3.y - u.y))}, hidden ${S3.hidden}, grace ${(S3.raid.grace - S3.t).toFixed(1)})`); }
  // hidden in a bush next to the route: never found
  { const b = SIM.BUSHES[8]; S3.x = b[0]; S3.y = b[1] + 55; S3.path = []; S3.raid.grace = S3.t + 1; key('space'); const a0 = S3.raid.arrests; let ch = 0; for (let i = 0; i < 900; i++) { idl(0.1); if (S3.raid.units.some((q) => q.st === 'chase')) ch++; }
    R(S3.hidden && S3.raid.arrests === a0 && ch === 0, `hidden in a bush for 90 s: not found (arrests ${S3.raid.arrests})`); key('space'); }
  // in the crowd of onlookers by the bench while a patrol walks past
  { const c = S3.raid.crowd[2]; S3.x = c[0] !== undefined ? c[0] : c.x; S3.y = (c.y || 296) + 22; S3.path = []; S3.raid.grace = 0; const a0 = S3.raid.arrests; let ch = 0;
    for (let i = 0; i < 900; i++) { idl(0.1); const cu = S3.raid.units.find((q) => q.st === 'chase'); if (cu) { if (!ch && process.env.DBG) console.log('chase at', i, 'by', cu.i, cu.kind, 'kolya', Math.round(S3.x), Math.round(S3.y), 'unit', Math.round(cu.x), Math.round(cu.y), 'crowd', SIM.raidCrowd(S3)); ch++; } }
    R(S3.raid.arrests === a0 && ch === 0, `standing in the crowd for 90 s: blends in (crowd ${SIM.raidCrowd(S3)})`); }
  // run away: Shift outruns them once they tire
  { const u = S3.raid.units[2]; S3.raid.units.forEach((q) => { if (q !== u) { q.x = 6300; q.y = -300; q.st = 'patrol'; q.goal = null; } }); u.x = 3000; u.y = 0; u.wa = Math.PI; S3.raid.grace = 0; S3.x = u.x + 300 * Math.cos(u.wa); S3.y = u.y + 300 * Math.sin(u.wa); S3.path = []; S3.hidden = false; for (let i = 0; i < 20 && u.st !== 'chase'; i++) idl(0.1);
    const a0 = S3.raid.arrests, dir = S3.x > u.x ? 1 : -1, gx = Math.max(250, Math.min(6500, S3.x + dir * 4000)); SIM.step(S3, { goto: [gx, S3.y < 0 ? -262 : 262], run: 1 });
    for (let i = 0; i < 2400 && S3.raid.units.some((q) => q.st === 'chase'); i++) SIM.step(S3, { run: 1 });
    R(S3.raid.arrests === a0, `outran the chase (arrests ${S3.raid.arrests}, states ${S3.raid.units.map((q) => q.st).join(',')})`); }
  const G = SIM.spawn(0); G.money = 500; G.inv.latte = 1; G.x = HE.door[0]; G.y = SIM.FACADE + 60; for (let i = 0; i < 40; i++) SIM.step(G, {});
  const q = SIM.proj(HE.door[0], SIM.FACADE, 80); SIM.step(G, { click: 1, px: q[0] - G.cam[0], py: q[1] - G.cam[1] }); for (let i = 0; i < 60; i++) SIM.step(G, {});
  SIM.step(G, { choose: 0 }); SIM.step(G, {}); SIM.step(G, { choose: 0 }); SIM.step(G, {}); R(G.elf.sweet, 'gift «Латте «Карамельный эльф»» → candy'); }
{ for (let i = 0; i < 120 * 40; i++) SIM.step(S, {}); const gc = (S.dm['Модеры 🎃'] || []); ok(gc.length >= 2, `moderators' chat: ${gc.length} posts`); if (process.env.CHAT) console.log(gc.map((m) => (m.from || 'Коля') + ': ' + m.text).join('\n')); }
console.log(log.slice(-30).join('\n')); process.exit(log.some((l) => l.startsWith('FAIL')) ? 1 : 0);
