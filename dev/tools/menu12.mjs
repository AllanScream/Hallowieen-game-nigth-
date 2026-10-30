// v12: the prologue as the player meets it: node tools/menu12.mjs [dir] [outDir]
// New game → the prologue → Elf's voice note plays on its line → Esc skips → the next new game has none → «Об игре» → the prologue alone → back to the menu
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/root/.cache/ref2game/claude/scripts/node_modules/playwright');
const [dir = 'live', out = 'frames/menu12'] = process.argv.slice(2); fs.mkdirSync(out, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e, st) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'content-length': st.size, 'accept-ranges': 'bytes' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => window.__ready, null, { timeout: 120000 }); await p.waitForTimeout(800);
await p.evaluate(() => { localStorage.removeItem('sog_prologue_seen'); localStorage.removeItem('sog_save'); });
const st = () => p.evaluate(() => { const P = window.__PLAY && window.__PLAY(); return P ? { intro: P.intro ? { i: P.intro.i, over: P.intro.over, only: P.intro.only } : null, gt: P.gt } : null; });
await p.click('#m_new'); await p.waitForTimeout(1500);
let s = await st(); ok(s && s.intro && s.intro.i === 0, 'a new game starts with the prologue');
await p.screenshot({ path: out + '/1_prologue.png', timeout: 120000 }).catch((e) => console.log('shot skipped', e.message.slice(0, 40)));
const P = () => window.__PLAY && window.__PLAY();   // swiftshader runs this page at a few frames a second: wait for each step to land
for (let k = 0; k < 14; k++) { s = await st(); if (!s.intro || s.intro.i >= 10) break; const i0 = s.intro.i; await p.waitForTimeout(1200); await p.mouse.click(640, 400);
  await p.waitForFunction((i) => { const Q = window.__PLAY(); return !Q.intro || Q.intro.i > i; }, i0, { timeout: 30000 }).catch(() => {}); }
await p.waitForTimeout(1200); s = await st();
ok(s.intro && s.intro.i === 10, 'clicked to the voice note line (' + (s.intro && s.intro.i) + ')');
ok(await p.evaluate(() => window.__vplaying === true), "Elf's voice note plays on its line");
await p.screenshot({ path: out + '/2_voice.png', timeout: 120000 }).catch((e) => console.log('shot skipped', e.message.slice(0, 40)));
await p.keyboard.down('Escape'); await p.waitForFunction(() => !window.__PLAY().intro, null, { timeout: 30000 }).catch(() => {}); await p.keyboard.up('Escape'); await p.waitForTimeout(800); s = await st();
ok(s && !s.intro, 'Esc skips the rest: the street'); ok(await p.evaluate(() => window.__vplaying === false), 'the voice stops');
ok(await p.evaluate(() => localStorage.getItem('sog_prologue_seen')) !== null, 'the prologue is marked as seen');
await p.screenshot({ path: out + '/3_street.png', timeout: 120000 }).catch((e) => console.log('shot skipped', e.message.slice(0, 40)));
await p.keyboard.down('Escape'); await p.waitForTimeout(700); await p.keyboard.up('Escape'); await p.waitForTimeout(500); await p.click('#p_exit'); await p.waitForTimeout(800);
await p.evaluate(() => { const m = document.getElementById('m_new'); m.click(); m.click(); }); await p.waitForTimeout(2500); s = await st();
ok(s && !s.intro, 'the next new game goes straight to the street ' + JSON.stringify(s) + ' menu=' + await p.evaluate(() => document.getElementById('menu').className));
await p.keyboard.down('Escape'); await p.waitForTimeout(700); await p.keyboard.up('Escape'); await p.waitForTimeout(500); await p.click('#p_exit'); await p.waitForTimeout(800);
const save0 = await p.evaluate(() => localStorage.getItem('sog_save'));
await p.click('#mainBtns [data-panel=p_about]'); await p.waitForTimeout(500); await p.screenshot({ path: out + '/4_about.png', timeout: 120000 }).catch((e) => console.log('shot skipped', e.message.slice(0, 40)));
await p.click('#a_prologue'); await p.waitForTimeout(1500); s = await st(); ok(s && s.intro && s.intro.only, '«Смотреть пролог» plays it alone');
await p.keyboard.down('Escape'); await p.waitForFunction(() => !window.__PLAY(), null, { timeout: 30000 }).catch(() => {}); await p.keyboard.up('Escape'); await p.waitForTimeout(500);
ok(await p.evaluate(() => document.getElementById('menu').classList.contains('on') && !(window.__PLAY && window.__PLAY())), 'and comes back to the main menu');
ok(await p.evaluate(() => localStorage.getItem('sog_save')) === save0, 'the autosave is untouched');
console.log('errors', JSON.stringify(errs.slice(0, 5))); if (errs.length) fails++;
console.log(fails ? fails + ' FAILED' : 'all ok');
await b.close(); srv.close(); process.exit(fails ? 1 : 0);
