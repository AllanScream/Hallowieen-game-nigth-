// Frame strips of Kolya around a scripted input sequence (turning on the spot, walking a circle): node tools/seq.mjs OUT.png turn|circle
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT || '/root/.cache/ref2game/claude/scripts/node_modules/playwright');
const [out = 'frames/seq.png', kind = 'turn'] = process.argv.slice(2);
const root = process.cwd(), types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.stat(f, (e) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('pageerror', (e) => console.log('PAGEERR', e.message));
await p.goto(`http://127.0.0.1:${srv.address().port}/live/index.html?render=1`);
await p.waitForFunction(() => window.__ready, null, { timeout: 30000 });
const url = await p.evaluate((kind) => {
  const S = SIM.spawn(0); S.x = 2150; S.y = -60; S.npc = []; for (let i = 0; i < 60; i++) SIM.step(S, {});
  const c = document.getElementById('c'), N = 24, cw = 150, ch = 190, sheet = document.createElement('canvas'); sheet.width = cw * 12; sheet.height = ch * 2; const g = sheet.getContext('2d');
  let prev = SIM.snap(S);
  for (let f = 0; f < N; f++) {
    for (let k = 0; k < 6; k++) { prev = SIM.snap(S); const a = (f * 6 + k) / (N * 6) * Math.PI * 2;
      if (kind === 'turn') { const hp = SIM.proj(S.x, S.y, 60); SIM.step(S, { px: hp[0] - S.cam[0] + 300 * Math.cos(a), py: hp[1] - S.cam[1] + 300 * Math.sin(a) }); }
      else if (kind === 'down' || kind === 'up') { if (f === 0 && k === 0) { S.x = 2150; S.y = kind === 'down' ? -200 : 300; } SIM.step(S, { [kind]: 1 }); if (k > 3) break; }
      else { const X = Math.cos(a + Math.PI / 2), Y = Math.sin(a + Math.PI / 2); SIM.step(S, { right: X > 0.38 ? 1 : 0, left: X < -0.38 ? 1 : 0, down: Y > 0.38 ? 1 : 0, up: Y < -0.38 ? 1 : 0 }); } }
    const st = SIM.lerpState(prev, S, 0.5); SCENE.state = st; SCENE.render(st.t);
    const q = SIM.proj(st.x, st.y); const X = q[0] - st.cam[0], Y = q[1] - st.cam[1];
    g.drawImage(c, (X - cw / 2) * c.width / 1920, (Y - ch + 30) * c.height / 1080, cw * c.width / 1920, ch * c.height / 1080, (f % 12) * cw, Math.floor(f / 12) * ch, cw, ch);
    g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(`d${st.d16} ${(st.turnA || 0).toFixed(1)}`, (f % 12) * cw + 4, Math.floor(f / 12) * ch + 14);
  }
  return sheet.toDataURL('image/png'); }, kind);
fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64')); console.log(out);
await b.close(); srv.close();
