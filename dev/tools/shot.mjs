// Quick screenshots of sim states: node tools/shot.mjs OUT_DIR name1 name2 ... (states defined in SHOTS below; runs the real sim
// headless in the page, then renders). Faster than the full qa.mjs pass when iterating on one feature.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || '/root/.cache/ref2game/claude/scripts/node_modules/playwright');
const [out = 'frames/shot', ...names] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message)); p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await p.goto(`http://127.0.0.1:${srv.address().port}/live/index.html?render=1`);
await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
// each shot: a function body run in the page with S (a fresh play state), step(n, inp), at(x, y) (put Kolya + camera there)
const SHOTS = {
  elf_door: `at(SIM.HE.door[0], SIM.FACADE + 70); step(120); S.elf.st = 'door'; S.elf.refused = true; S.dlg = { who: 'elf', text: SIM.MODS && 'Опять ты. Прожектор с датчиком, если что, работает.', choices: [['Подарить подарок', 'gift'], ['Уйти', 'close']] };`,
  elf_flood: `S.elf.refused = true; at(SIM.HE.door[0] - 250, -380); for (let i = 0; i < 90; i++) SIM.step(S, { up: 1 }); step(30);`,
  raid_arrive: `S.elf.refused = true; S.elf.done = 0; at(5600, -150); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; step(140);`,
  raid_search: `S.elf.refused = true; S.elf.done = 0; at(4000, -60); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; step(120 * 12); S.raid.grace = S.t + 99; at(3900, 262); step(10); S.raid.units.forEach((u, i) => { u.x = 3600 + i * 160; u.y = [-262, 262, 0, -300][i]; u.wa = Math.PI * (i % 2 ? 0 : 1); }); S.raid.units[1].x = 3650; S.raid.units[1].wa = 0; S.raid.grace = 0; step(40);`,
  raid_chase: `S.elf.refused = true; S.elf.done = 0; at(4000, -60); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; step(120 * 12); at(3900, 0); S.raid.units.forEach((u, i) => { u.x = 3500 + i * 120; u.y = [-262, 262, 0, -300][i]; u.wa = 0; }); step(150);`,
  raid_crowd: `S.elf.refused = true; S.elf.done = 0; at(2000, 320); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; step(120 * 12); at(2010, 318); S.raid.units[1].x = 2500; S.raid.units[1].y = 262; S.raid.units[1].wa = Math.PI; step(60);`,
  kolya16: `at(2150, -40); step(10);`,
  start: `step(60);`,
  carry_walk: `at(1500, 120); S.carry = 'rotten'; step(30, { right: 1, down: 1 });`,
  throw_act: `at(1500, 120); step(20, { px: 1500, py: 300 }); S.ev.push({ k: 'throw', t: S.t - 0.2, x: S.x, y: S.y });`,
  crouch_act: `at(1500, 120); step(20, { px: 600, py: 800 }); S.ev.push({ k: 'pickup', t: S.t - 0.1, x: S.x, y: S.y });`,
  raid_reinf: `S.elf.refused = true; S.elf.done = 0; S.ghost = true; at(300, 250); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; step(120 * 14); S.raid.reinfAt = S.t; S.raid.lastSeen = [700, 0]; step(120 * 8);`,
  gift_elf: `at(SIM.HE.door[0], SIM.FACADE + 70); step(60); S.elf.sweet = true; S.dlg = { who: 'elf', text: 'Латте «Карамельный эльф»?! …Ладно. Ты прощён. Держи конфеты 🍬', cg: 'cg_gift_elf', choices: [['Спасибо!', 'close']] };`,
  hold_light: `at(1500, 120); S.light = true; step(40, { px: 1300, py: 700 });`,
  hold_gun: `at(1500, 120); S.hasGun = true; S.gun = true; S.inv.bb = 50; step(40, { px: 1500, py: 300 }); for (let i = 0; i < 3; i++) SIM.step(S, { rpress: 1, px: 1500, py: 300 });`,
  raid_west: `S.elf.refused = true; S.elf.done = 0; at(-300, -250); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; step(120 * 6);`,
  raid_west2: `S.elf.refused = true; S.elf.done = 0; at(-300, -250); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; step(120 * 14);`,
  chat_group: `SIM.runDev(S, 'refuse all'); S.dm['Модеры 🎃'] = [{ me: false, from: 'Кирилл', text: 'Народ, Коля пришёл ко мне и закидал яйцами, обмотал туалетной бумагой и заказал мне 10 пицц 😤', gt: 0 }, { me: false, from: 'Эльф', text: 'Мужчины… 🙄', gt: 0 }, { me: true, text: 'Это не я!', gt: 0 }, { me: false, from: 'Райва', text: 'Кикнуть не могу, у него админка с 2019 года 😐', gt: 0 }]; S.phone = { app: 'dm', who: 'Модеры 🎃', t: S.t - 1, scroll: 0 };`,
  contacts7: `S.phone = { app: 'contacts', t: S.t - 1, scroll: 0 };`,
  north1: `at(1500, -1150); step(5); S.cam[1] -= 250;`,
  north2: `at(3600, -1250); step(5); S.cam[1] -= 250;`,
  pizza: `S.phone = { app: 'pizza', t: S.t - 1, scroll: 0 };`,
  bench1: `at(2000, 150); step(10);`,
  bench2: `at(4050, 150); step(10);`,
  home_front: `at(SIM.HKO.door[0], SIM.FACADE + 300); step(10);`,
  walk_down: `at(SIM.HKO.door[0], SIM.FACADE + 200); step(37, { down: 1 });`,
  walk_up: `at(SIM.HKO.door[0], 300); step(41, { up: 1 });`,
  gun: `S.hasGun = true; S.gun = true; at(1500, 120); step(5); for (let i = 0; i < 20; i++) SIM.step(S, { rpress: 1, px: 1300, py: 500 });`,
  raid_beams: `S.elf.refused = true; S.elf.done = 0; at(4000, 200); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; step(120 * 9); at(4300, 230);`,
  raid_cars: `S.elf.refused = true; S.elf.done = 0; at(5400, 0); S.raid = SIM.newRaid(S); S.raid.t0 = S.t; step(120 * 7); at(5600, 60); step(2);`,
  phone_dev: `S.phone = { app: 'dev', t: S.t - 1, scroll: 0 }; SIM.runDev(S, 'help'); SIM.runDev(S, 'money 5000');`,
  phone_contacts: `S.phone = { app: 'contacts', t: S.t - 1, scroll: 0 };`,
  phone_dm: `S.phone = { app: 'dm', who: 'Скелет', t: S.t - 1, scroll: 0 }; S.dm['Скелет'] = [{ me: true, text: 'Скелет, привет! Займёшь 1500?', gt: S.gt }, { text: 'занят, катка. держи, вернёшь до часу ночи', gt: S.gt }];`,
  phone_home: `S.phone = { app: 'home', t: S.t - 1, scroll: 0 };`,
  finale1: `SIM.runDev(S, 'finale'); step(240);`,
  finale_end: `SIM.runDev(S, 'finale'); S.finale.i = S.finale.lines.length; S.finale.end = true; step(240);`,
  alley: `at(4360, -1150); step(10); S.cam[0] -= 0; `,
  endlot: `at(6450, -640); step(10);`,
  endlot2: `at(6450, -900); step(10);`,
};
for (const n of names) {
  const r = await p.evaluate(([n, body]) => { try { const S = SIM.spawn(0); S.money = 500;
      const step = (k = 1, inp = {}) => { for (let i = 0; i < k; i++) SIM.step(S, inp); };
      const at = (x, y) => { S.x = x; S.y = y; S.vx = S.vy = 0; S.path = []; const hp = SIM.proj(x, y); S.cam = [hp[0] - 960, hp[1] - 590]; S.camV = [0, 0]; };
      step(30); new Function('S', 'step', 'at', 'SIM', body)(S, step, at, SIM); window.__DBGORDER = 1; SCENE.state = S; SCENE.render(S.t + 0.01); window.__ORDER = window.__DBGORDER;
      return { ok: 1, info: JSON.stringify({ x: Math.round(S.x), y: Math.round(S.y), raid: S.raid && { st: S.raid.st, u: S.raid.units.map((u) => u.st + ':' + Math.round(u.sus * 100)) }, lit: S.elf.lit, toasts: S.toasts.map((q) => q.text) }), order: window.__ORDER };
    } catch (e) { return { err: e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' | ') }; } }, [n, SHOTS[n]]);
  console.log(n, JSON.stringify(r)); await p.screenshot({ path: `${out}/${n}.png` });
}
await b.close(); srv.close();
