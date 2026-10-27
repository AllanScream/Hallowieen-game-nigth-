import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const { chromium } = createRequire('/home/claude/halloween/tools/x.mjs')('/root/.cache/ref2game/claude/scripts/node_modules/playwright');
const dir = 'live', out = 'frames/gh';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const srv = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0])); fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
for (const lang of ['ru', 'en']) {
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.addInitScript((l) => { localStorage.setItem('sog_settings', JSON.stringify({ lang: l })); }, lang);
  await p.goto(`http://127.0.0.1:${srv.address().port}/index.html`, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => window.__ready, null, { timeout: 120000 }); await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}/menu_${lang}.png` }); await p.close(); }
await b.close(); srv.close();
