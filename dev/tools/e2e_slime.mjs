// Real-browser check of the slime prank at Kirill's door: hot-start next to the door with slime, press 8, hold E 3.2 s
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/root/.cache/ref2game/claude/scripts/node_modules/playwright');
const [dir = 'live', who = 'kirill'] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const doors = { kirill: 2841, raiva: 4905, elf: 5991 };
await p.addInitScript(([dx, who]) => { const key = { kirill: 'kir', raiva: 'rai', elf: 'elf' }[who];
  window.claude = { hot: { data: { play: { x: dx, y: -480, cam: [0.894 * (dx - 480) - 960, 0.447 * (-480 - dx) - 590], [key + 'Pre']: 1,
    inv: { eggs: 6, tp: 0, alarm: 0, fire: 0, slime: 2, chalk: 0, flyers: 0, energy: 0, candle: 0, hoodie: 0, solder: 0, tea: 0, latte: 0 } }, simT: 0 } } }; }, [doors[who], who]);
await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
await p.waitForFunction(() => window.__ready, null, { timeout: 60000 }); await p.waitForTimeout(1000);
await p.mouse.move(640, 300);
const st = () => p.evaluate((who) => { const s = SCENE.state, k = s[{ kirill: 'kir', raiva: 'rai', elf: 'elf' }[who]]; return { x: Math.round(s.x), y: Math.round(s.y), hold: s.slimeHold, slime: k.slime, inv: s.inv.slime, slot: s.slot, toasts: s.toasts.map((q) => q.text), refused: k.refused }; }, who);
await p.evaluate((who) => { SCENE.state[{ kirill: 'kir', raiva: 'rai', elf: 'elf' }[who]].refused = true; }, who);
console.log('start', JSON.stringify(await st()));
await p.keyboard.press('Digit8'); await p.waitForTimeout(300);
console.log('slot8', JSON.stringify(await st()));
await p.keyboard.down('KeyE'); for (let i = 0; i < 8; i++) { await p.waitForTimeout(500); console.log('hold', JSON.stringify(await st())); } await p.keyboard.up('KeyE');
await b.close(); srv.close();
