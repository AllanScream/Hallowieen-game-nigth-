// End-to-end check of the packed build as the player runs it: serve dist/halloween/game, start play with a click,
// walk to Elf's door by clicking the ground, knock, screenshot. node tools/e2e_elf.mjs [gameDir] [outDir]
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/root/.cache/ref2game/claude/scripts/node_modules/playwright');
const [dir = 'dist/halloween/game', out = 'frames/e2e'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
if (process.env.NEAR) await p.addInitScript(() => { window.claude = { hot: { data: { play: { x: 5990, y: -330, cam: [4100, -3420] }, simT: 0 } } }; });   // start play next to Elf's gate (slow GPU-less runs)
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }); await p.waitForTimeout(1500);
const box = await p.evaluate(() => { const r = document.getElementById('c').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
const toPage = (vx, vy) => [box[0] + vx / 1920 * box[2], box[1] + vy / 1080 * box[3]];
if (await p.evaluate(() => !SCENE.state)) { await p.click('#m_new'); } await p.waitForTimeout(800);   // main menu → new game (a hot restore starts in play)                       // leave the attract demo
const info = async () => p.evaluate(() => { const s = SCENE.state; return s ? { x: s.x, y: s.y, cam: s.cam, dlg: s.dlg && s.dlg.text, who: s.dlg && s.dlg.who, elf: !!s.elf, mods: Object.keys(SIM.MODS) } : null; });
console.log('start', JSON.stringify(await info()));
const door = await p.evaluate(() => [SIM.HE.door[0], SIM.FACADE + 70]);
for (let k = 0; k < 40; k++) {                                                              // click the ground toward the door, 600 px at a time
  const s = await info(); const d = Math.hypot(door[0] - s.x, door[1] - s.y); if (d < 60) break;
  const g = await p.evaluate(([x, y]) => SIM.proj(x, y), door), kp = await p.evaluate(([x, y]) => SIM.proj(x, y), [s.x, s.y]);
  let vx = g[0] - s.cam[0], vy = g[1] - s.cam[1]; const kx = kp[0] - s.cam[0], ky = kp[1] - s.cam[1], l = Math.hypot(vx - kx, vy - ky);
  if (l > 600) { vx = kx + (vx - kx) / l * 600; vy = ky + (vy - ky) / l * 600; }
  await p.mouse.click(...toPage(vx, vy)); await p.waitForTimeout(l > 600 ? 3600 : 3000);
}
console.log('at door', JSON.stringify(await info()));
await p.screenshot({ path: out + '/1_elf_house.png' });
{ const s = await info(), q = await p.evaluate(() => SIM.proj(SIM.HE.door[0], SIM.FACADE, 80)); await p.mouse.click(...toPage(q[0] - s.cam[0], q[1] - s.cam[1])); }
await p.waitForTimeout(2500);
console.log('after knock', JSON.stringify(await info()));
await p.screenshot({ path: out + '/2_elf_knock.png' });
console.log('errors', JSON.stringify(errs));
await b.close(); srv.close();
