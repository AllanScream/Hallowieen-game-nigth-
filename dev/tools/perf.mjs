// Frame cost profile (headless, swiftshader): node tools/perf.mjs [scenario] — JS time per SCENE.render / SIM.step, draw calls, top functions
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('/root/.cache/ref2game/claude/scripts/node_modules/playwright');
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const dir = process.argv[3] || 'live';
await p.goto(`http://127.0.0.1:${srv.address().port}/${dir}/index.html?render=1`);
await p.waitForFunction(() => window.__ready, null, { timeout: 90000 });
const scen = process.argv[2] || 'street';
const cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await p.evaluate((scen) => { const S = SIM.spawn(0); window.__S = S; for (let i = 0; i < 60; i++) SIM.step(S, {});
  if (scen === 'raid') { SIM.runDev(S, 'raid'); for (let i = 0; i < 120 * 14; i++) SIM.step(S, {}); S.x = 2500; S.y = 0; }
  if (scen === 'phone') { S.phone = { app: 'map', t: S.t - 2, at: S.t - 2, scroll: 0 }; }
  if (scen === 'north') { S.x = 2500; S.y = -560; }
  SCENE.state = S; }, scen);
await cdp.send('Profiler.start');
const r = await p.evaluate(() => { const S = window.__S, gl = document.getElementById('c').getContext('webgl2'); let tr = 0, ts = 0, calls = 0, sprites = 0; const od = G.draw;
  G.draw = function () { calls++; return od.apply(this, arguments); }; const LL = window.LIB; const os = LL.sprite; LL.sprite = function () { sprites++; return os.apply(this, arguments); };
  const N = 60; for (let k = 0; k < N; k++) { const t0 = performance.now(); SIM.step(S, { right: k % 40 < 20 ? 1 : 0, left: k % 40 >= 20 ? 1 : 0, px: 900, py: 500 }); SIM.step(S, {}); const t1 = performance.now(); SCENE.state = S; SCENE.render(S.t); const t2 = performance.now(); gl.finish(); ts += t1 - t0; tr += t2 - t1; }
  G.draw = od; LL.sprite = os; return { stepMs: (ts / N / 2).toFixed(3), renderMs: (tr / N).toFixed(2), drawsPerFrame: Math.round(calls / N), spritesPerFrame: Math.round(sprites / N) }; });
const { profile } = await cdp.send('Profiler.stop');
const self = {}, byId = {}; profile.nodes.forEach((n) => (byId[n.id] = n)); const dt = {}; for (let i = 0; i < profile.samples.length; i++) dt[profile.samples[i]] = (dt[profile.samples[i]] || 0) + (profile.timeDeltas[i] || 0);
profile.nodes.forEach((n) => { const k = n.callFrame.functionName + ' ' + (n.callFrame.url.split('/').pop() || '') + ':' + n.callFrame.lineNumber; self[k] = (self[k] || 0) + (dt[n.id] || 0); });
const tot = Object.values(self).reduce((a, b) => a + b, 0);
console.log(scen, JSON.stringify(r)); Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 22).forEach(([k, v]) => console.log((100 * v / tot).toFixed(1).padStart(5) + '%  ' + k));
await b.close(); srv.close();
