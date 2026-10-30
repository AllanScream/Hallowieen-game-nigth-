// live/scene.js — «Сладость или гадость»: isometric night street. Pure function of t and the sim state.
// ground materials (iso-affine REPEAT textures) → decals → light pools → sorted band (separating-axis on world AABBs)
// → light glows → darkness + flashlight → leaves → finish → HUD (HP, place+clock, minimap, quests, hotbar, dialog, phone).
(function () {
  const S = (window.SCENE = {}), A = window.ASSETS, AN = window.ANCH || {}, L = LIB, M = L.M, W = SIM.VIEW.W, H = SIM.VIEW.H;
  const C = SIM.C, SN = SIM.SN;
  S.REPEAT = ['asphalt_tex', 'sidewalk_tex', 'lawn_tex', 'alley_tex'];
  const has = (n) => !!A[n] && G.has(n);
  const FONT = '"Trebuchet MS", "Segoe UI", "DejaVu Sans", Verdana, sans-serif', SERIF = 'Georgia, "Times New Roman", "DejaVu Serif", serif';
  const DARK_FS = `uniform vec2 u_o, u_d; uniform float u_on, u_amt;
void main(){ float a = u_amt;
  if (u_on > 0.5) { vec2 q = v_px - u_o; float l = max(length(q), 1.0); float c = dot(q / l, u_d);
    float cone = smoothstep(0.80, 0.93, c) * smoothstep(620.0, 160.0, l) + smoothstep(110.0, 30.0, l); a *= 1.0 - clamp(cone, 0.0, 1.0) * 0.93; }
  float e = smoothstep(0.0, 0.3, v_uv.x) * smoothstep(1.0, 0.7, v_uv.x) * smoothstep(0.0, 0.2, v_uv.y) * smoothstep(1.0, 0.6, v_uv.y) * (0.85 + 0.15 * vnoise(v_px * 0.01 + u_amt));
  a *= e; o = vec4(vec3(0.02, 0.025, 0.06) * a, a); }`;
  const CONE_FS = `uniform vec2 u_o, u_d; uniform float u_amt; uniform vec3 u_col;
void main(){ vec2 q = v_px - u_o; float l = max(length(q), 1.0); float c = dot(q / l, u_d);
  float g = smoothstep(0.82, 0.95, c) * smoothstep(650.0, 120.0, l) * (0.75 + 0.25 * vnoise(v_px * 0.02)); o = vec4(u_col * g * u_amt, 0.0); }`;
  const NIGHT_FS = `uniform vec2 u_o, u_d; uniform float u_on, u_amt;
void main(){ float a = u_amt;
  if (u_on > 0.5) { vec2 q = v_px - u_o; float l = max(length(q), 1.0); float c = dot(q / l, u_d);
    float cone = smoothstep(0.80, 0.93, c) * smoothstep(640.0, 160.0, l) + smoothstep(120.0, 30.0, l); a *= 1.0 - clamp(cone, 0.0, 1.0) * 0.9; }
  a *= 0.9 + 0.1 * vnoise(v_px * 0.004 + u_amt);
  o = vec4(vec3(0.015, 0.02, 0.05) * a, a); }`;
  const BEAM_FS = `uniform vec2 u_o, u_d; uniform float u_amt, u_len, u_cos; uniform vec3 u_col;
void main(){ vec2 q = v_px - u_o; float l = max(length(q), 1.0); float c = dot(q / l, u_d);
  float g = smoothstep(u_cos, u_cos + 0.1, c) * smoothstep(u_len, u_len * 0.2, l) * smoothstep(8.0, 40.0, l) * (0.8 + 0.2 * vnoise(v_px * 0.02)); o = vec4(u_col * g * u_amt, 0.0); }`;
  S.programs = () => { L.init(W, H, { dark: DARK_FS, cone: CONE_FS, beam: BEAM_FS, night: NIGHT_FS }); L.glyphs('0123456789:%+-/'); };
  // per-moderator accent colours (minimap, phone map, porch pools)
  const MODC = { kirill: { mm: '#6a4a70', dot: ['#c890ff', '#b060ff'], star: '#ffa040', pool: '190,110,255', yard: '#1f1426', wall: ['#55386e', '#3f2953', '#2e1e3d'], roof: ['#7a4aa0', '#5a3478'], win: '190,120,255' },
    raiva: { mm: '#3d4a7a', dot: ['#8ab0ff', '#5080ff'], star: '#7ab0ff', pool: '110,150,255', yard: '#141a2a', wall: ['#35406e', '#293153', '#1e243d'], roof: ['#4a5aa0', '#344078'], win: '120,170,255' },
    elf: { mm: '#3a5a52', dot: ['#9af0d0', '#40c090'], star: '#9af0d0', pool: '150,255,220', yard: '#122420', wall: ['#3a5a55', '#2b4440', '#1f312e'], roof: ['#4a7a70', '#365a52'], win: '150,255,220' } };
  const INK = [0.07, 0.03, 0.03];
  const mat3 = (m) => [m[0], m[1], 0, m[2], m[3], 0, m[4], m[5], 1];
  let cx = 0, cy = 0, T = 0, GT = 0, ST = null;
  const P = (x, y, z = 0) => [C * (x + y) - cx, SN * (y - x) - z - cy];
  const onScreen = (q, m = 300) => q[0] > -m && q[0] < W + m && q[1] > -m && q[1] < H + m * 1.6;
  // ground quad (world rect) — textured or solid
  const gTex = (tex, x0, y0, x1, y1, tile, u = {}) => { const o = P(x0, y0); L.sprite(tex, 0, 0, { m: [C, -SN, C, SN, o[0], o[1]], w: x1 - x0, h: y1 - y0, src: [x0 / tile, y0 / tile, x1 / tile, y1 / tile], u }); };
  const gSolid = (x0, y0, x1, y1, col, a = 1) => { const o = P(x0, y0), w = x1 - x0, h = y1 - y0; G.draw(L.P.solid, { u_col: col, u_a: a }, mat3([C * w, -SN * w, C * h, SN * h, o[0], o[1]])); };
  const wallSolid = (x0, x1, y, z0, z1, col, a = 1) => { const o = P(x0, y, z1), w = x1 - x0; G.draw(L.P.solid, { u_col: col, u_a: a }, mat3([C * w, -SN * w, 0, z1 - z0, o[0], o[1]])); };
  const sideSolid = (x, y0, y1, z0, z1, col, a = 1) => { const o = P(x, y0, z1), h = y1 - y0; G.draw(L.P.solid, { u_col: col, u_a: a }, mat3([C * h, SN * h, 0, z1 - z0, o[0], o[1]])); };
  const isoBox = (x0, y0, x1, y1, z0, z1, top, front, side) => { sideSolid(x0, y0, y1, z0, z1, side); wallSolid(x0, x1, y1, z0, z1, front); const o = P(x0, y0, z1), w = x1 - x0, h = y1 - y0;
    G.draw(L.P.solid, { u_col: top, u_a: 1 }, mat3([C * w, -SN * w, C * h, SN * h, o[0], o[1]])); };
  const ell = (prog, X, Y, rx, ry, uni) => G.draw(prog, uni, G.xf(X - rx, Y - ry, 2 * rx, 2 * ry));
  const glowE = (X, Y, rx, ry, col, amt, k = 3) => { G.blend('add'); ell(L.P.glow, X, Y, rx, ry, { u_col: col, u_k: k, u_amt: amt }); G.blend(); };
  const pool = (x, y, r, col, amt) => { const q = P(x, y); glowE(q[0], q[1], r * 1.264, r * 0.632, col, amt, 2.4); };
  const shadowE = (x, y, r, amt = 0.5) => { const q = P(x, y); L.shadow(q[0], q[1], r * 1.264, r * 0.632, amt); };
  const flick = (i, s = 1) => 0.85 + 0.15 * Math.sin(T * (7 + 3 * L.rnd(i, 1)) * s + i) * Math.sin(T * (11 + 5 * L.rnd(i, 2)) * s + 2 * i);
  const WARM = [1.0, 0.62, 0.25], LAMPC = [1.0, 0.72, 0.38];
  const ALLEYBULBS = [[4494, -1050]];                                            // a weak bulb on the alley fence (x, y; 150 px up)
  const bulbF = (i) => { const n = Math.sin(T * 1.7 + i) + 0.6 * Math.sin(T * 6.1 + 2 * i); return n < -1.15 ? 0.2 : 0.85 + 0.15 * Math.sin(T * 40 + i); };
  // ---------- 2D canvases re-uploaded as textures (minimap, phone) ----------
  const CV = {};
  // hz: redraw at most this often (the minimap at 20 Hz, the phone at 30 Hz); drawn 1:1, so no mipmaps (v9)
  function cvTex(name, w, h, draw, hz = 0) { let r = CV[name]; if (!r) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; r = CV[name] = { cv, g: cv.getContext('2d'), tex: null, at: -9 }; }
    const now = performance.now() / 1000; if (r.tex && hz && now - r.at < 1 / hz && now >= r.at) return; r.at = now;
    r.g.setTransform(1, 0, 0, 1, 0, 0); r.g.clearRect(0, 0, w, h); draw(r.g);
    if (!r.tex) r.tex = G.canvasTex(name, r.cv, { mip: false }); else G.updateTex(r.tex, r.cv); }
  const MEAS = document.createElement('canvas').getContext('2d');
  const TR = (s) => (window.TR ? window.TR(s) : s);                                     // i18n.js: translate whole strings before splitting them into lines
  const WRAPC = new Map(), TWC = new Map();                                             // v9: text layout memo (cleared when it grows)
  const wrap = (str, size, maxW, weight = 'bold') => { str = TR(String(str)); const key = size + '|' + maxW + '|' + weight + '|' + str, c = WRAPC.get(key); if (c) return c;
    MEAS.font = `${weight} ${size}px ${FONT}`; const out = []; let line = '';
    for (const w of String(str).split(' ')) { const tryL = line ? line + ' ' + w : w; if (MEAS.measureText(tryL).width > maxW && line) { out.push(line); line = w; } else line = tryL; }
    if (line) out.push(line); if (WRAPC.size > 3000) WRAPC.clear(); WRAPC.set(key, out); return out; };
  const textW = (str, size, weight = 'bold') => { str = TR(String(str)); const key = size + '|' + weight + '|' + str, c = TWC.get(key); if (c !== undefined) return c;
    MEAS.font = `${weight} ${size}px ${FONT}`; const w = MEAS.measureText(str).width; if (TWC.size > 3000) TWC.clear(); TWC.set(key, w); return w; };

  // ---------- characters ----------
  const CH = { kolya: ['kolya_se', 'kolya_ne', 122], kirill: ['kirill_se', 'kirill_se', 124], npc_ghost: ['npc_ghost_se', 'npc_ghost_ne', 112], npc_witch2: ['npc_witch2_se', 'npc_witch2_ne', 116],
    npc_cloak: ['npc_cloak_se', 'npc_cloak_ne', 118], npc_devil: ['npc_devil_se', 'npc_devil_ne', 114], npc_skeleton: ['npc_skeleton_se', 'npc_skeleton_ne', 120], npc_hoodie: ['npc_hoodie_se', 'npc_hoodie_ne', 112],
    npc_witch: ['npc_witch_se', 'npc_witch_se', 116], kid: ['npc_kid_se', 'npc_kid_ne', 112], courier: ['courier_se', 'courier_ne', 120] };
  const NPCCOL = { npc_witch: [[0.32, 0.16, 0.36], [0.95, 0.55, 0.2]], npc_ghost: [[0.86, 0.82, 0.74], [0.2, 0.18, 0.2]], npc_cloak: [[0.16, 0.12, 0.12], [0.95, 0.5, 0.15]],
    npc_devil: [[0.62, 0.1, 0.08], [0.15, 0.08, 0.08]], npc_skeleton: [[0.1, 0.1, 0.12], [0.85, 0.85, 0.8]], npc_hoodie: [[0.9, 0.5, 0.12], [0.2, 0.12, 0.1]], npc_witch2: [[0.2, 0.12, 0.28], [0.85, 0.4, 0.12]],
    courier: [[0.75, 0.15, 0.1], [0.95, 0.8, 0.5]], kid: [[0.5, 0.3, 0.6], [0.95, 0.6, 0.2]] };
  // ---------- cut-out rig (rigcut parts on one canvas): foot paths + partial 2-bone IK, arms against the legs ----------
  const RG = window.RIGS || {};
  const segMap = (a0, b0, a, b) => { const v0 = [b0[0] - a0[0], b0[1] - a0[1]], v = [b[0] - a[0], b[1] - a[1]], l0 = Math.hypot(v0[0], v0[1]) || 1, l = Math.hypot(v[0], v[1]) || 1;
    const u0 = [v0[0] / l0, v0[1] / l0], n0 = [-u0[1], u0[0]], u = [v[0] / l, v[1] / l], n = [-u[1], u[0]], sg = l / l0;
    const A00 = sg * u[0] * u0[0] + n[0] * n0[0], A01 = sg * u[0] * u0[1] + n[0] * n0[1], A10 = sg * u[1] * u0[0] + n[1] * n0[0], A11 = sg * u[1] * u0[1] + n[1] * n0[1];
    return [A00, A10, A01, A11, a[0] - (A00 * a0[0] + A01 * a0[1]), a[1] - (A10 * a0[0] + A11 * a0[1])]; };
  // foot path over one gait cycle: stance (duty D) slides back linearly at body speed, swing eases forward with a lift
  const footPath = (ph, D = 0.6) => { ph = ((ph % 1) + 1) % 1; if (ph < D) return [1 - 2 * ph / D, 0]; const q = (ph - D) / (1 - D), e = q * q * (3 - 2 * q); return [-1 + 2 * e, Math.pow(Math.sin(Math.PI * q), 0.8)]; };
  // two-bone IK in the picture plane: root a, target t, lengths l1 l2; pick the bend whose joint lies on the `side` of the line
  const ik2 = (a, t, l1, l2, side) => { let dx = t[0] - a[0], dy = t[1] - a[1], d = Math.hypot(dx, dy); const mx = (l1 + l2) * 0.999; if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; }
    const ca = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * Math.max(d, 1e-3)))), at = Math.atan2(dy, dx), an = Math.acos(ca);
    const j1 = [a[0] + l1 * Math.cos(at + an), a[1] + l1 * Math.sin(at + an)], j2 = [a[0] + l1 * Math.cos(at - an), a[1] + l1 * Math.sin(at - an)];
    return (j1[0] - a[0]) * side[0] + (j1[1] - a[1]) * side[1] > (j2[0] - a[0]) * side[0] + (j2[1] - a[1]) * side[1] ? j1 : j2; };
  // overhand throw toward screen dir u, t seconds after the throw event (the sim releases at 0.2 s): [x, y, weight] in arm lengths from the shoulder
  const ease = (x) => x * x * (3 - 2 * x), mix2 = (p, q, w) => [p[0] + (q[0] - p[0]) * w, p[1] + (q[1] - p[1]) * w];
  const throwPose = (t, u, main, os = 1) => { if (t === undefined || t < 0 || t > 0.6) return null;      // os: the arm's outward side on screen (±1)
    if (!main) return [0.35 * u[0], 0.5 + 0.2 * u[1], 0.6 * Math.sin(Math.PI * Math.min(1, t / 0.6))];           // the free arm balances forward
    const W0 = [0.15 * u[0], 0.95], W1 = [0.3 * os - 0.35 * u[0], -0.85 - 0.15 * Math.max(0, u[1])], R1 = [0.95 * u[0], 0.9 * u[1] - 0.3], F1 = [0.5 * u[0], 0.6 + 0.3 * u[1]];
    const p = t < 0.15 ? mix2(W0, W1, ease(t / 0.15)) : t < 0.24 ? mix2(W1, R1, ease((t - 0.15) / 0.09)) : mix2(R1, F1, ease(Math.min(1, (t - 0.24) / 0.2)));
    return [p[0], p[1], t < 0.05 ? t / 0.05 : t > 0.45 ? Math.max(0, 1 - (t - 0.45) / 0.15) : 1]; };
  // name: rig texture base; X,Y: ground point on screen; Hd: height px; flip; ph: gait phase in cycles; g: gait amount 0..1; D: screen travel dir
  // o: stride (screen px per cycle), run 0..1, face (screen facing dir), hands { L|R: [x, y, w] } (screen dirs, arm lengths from the shoulder),
  //    throwU/throwA (throw toward screen dir), carry (both hands at the belly; o.hold(point) draws the carried thing), holdBehind (back views),
  //    arm { L|R: [x, y] } absolute rig-space override, dip (crouch), alpha, tint, id (joint trace)
  function drawRig(name, X, Y, Hd, flip, ph, g, D, o = {}) {
    const R = RG[name]; const s = Hd / R.h, fx = flip ? -1 : 1, a = o.alpha === undefined ? 1 : o.alpha, u = { alpha: a, tint: o.tint || [1, 1, 1, 0], rim: [0.3, -0.004 * fx, -0.004, 1], rimCol: o.rimCol || [1, 0.7, 0.4] };
    const gx = (R.toeL[0] + R.heelL[0] + R.toeR[0] + R.heelR[0]) / 4, gy = (R.footL[1] + R.footR[1]) / 2;
    const B = M.of(M.t(X, Y), M.s(s * fx, s), M.t(-gx, -gy)), BM = (m) => M.mul(B, m), toS = (p) => M.ap(B, p);
    const d = [D[0] * fx, D[1]]; { const dl = Math.hypot(d[0], d[1]) || 1; d[0] /= dl; d[1] /= dl; }
    const run = o.run !== undefined ? o.run : (o.duty !== undefined && o.duty < 0.5 ? 1 : 0), duty = o.duty || (0.6 - 0.22 * run);
    const legLen = (gy - (R.hipL[1] + R.hipR[1]) / 2), stride = (o.stride || 100) / s, f = duty / 2 * stride * g, lift = (0.1 + 0.08 * run) * legLen * g;
    const breath = ST && ST.neutral ? 0 : Math.sin(T * 2.1 + (o.seed || 0)) * 0.005 * R.h * (1 - g);
    const id = o.id || name, tr = (n, p) => L.joint(id, n, toS(p));
    // the painted pose may already have one foot ahead: while walking, pull both feet to their midpoint along the travel direction
    const amx = R.ankleL && R.ankleR ? [(R.ankleL[0] + R.ankleR[0]) / 2, (R.ankleL[1] + R.ankleR[1]) / 2] : null;
    const legs = {}; for (const side of ['L', 'R']) { const H0 = R['hip' + side], K0 = R['knee' + side], A0 = R['ankle' + side]; if (!H0 || !K0 || !A0) continue;
      const [fp, fl] = footPath(ph + (side === 'R' ? 0.5 : 0), duty), l1 = Math.hypot(K0[0] - H0[0], K0[1] - H0[1]), l2 = Math.hypot(A0[0] - K0[0], A0[1] - K0[1]);
      const od = amx ? ((A0[0] - amx[0]) * d[0] + (A0[1] - amx[1]) * d[1]) * 0.85 * g : 0, cx1 = -d[0] * od, cy1 = -d[1] * od;
      legs[side] = { H0, K0, A0, l1, l2, fl, cx1, cy1, A: [A0[0] + cx1 + d[0] * f * fp, A0[1] + cy1 + d[1] * f * fp - lift * fl] }; }
    if (legs.L && legs.R && !(ST && ST.neutral)) { const hw = Math.abs(legs.R.H0[0] - legs.L.H0[0]), aw = Math.abs(legs.R.A0[0] - legs.L.A0[0]), want = Math.max(aw, 1.4 * hw), ex = (want - aw) / 2 * (1 - 0.6 * g), sL = Math.sign(legs.L.A0[0] - legs.R.A0[0]) || -1;
      legs.L.A[0] += sL * ex; legs.R.A[0] -= sL * ex; legs.L.sx = sL * ex; legs.R.sx = -sL * ex; }
    // smooth hip bob: the deepest drop any leg needs over the cycle (sampled), laid on one smooth curve twice per cycle (no kinks, no limp)
    const sf = o.sf || 1; let A2 = 0, ph0 = 0; if (g > 0.01) for (let k = 0; k < 16; k++) { const pp = k / 16; let need = 0;
      for (const sd in legs) { const q = legs[sd], [fp2, fl2] = footPath(pp + (sd === 'R' ? 0.5 : 0), duty); if (fl2 > 0) continue;       // planted feet only
        const Lr = q.A0[1] - q.H0[1], dl = f * fp2 / sf; need = Math.max(need, Lr - Math.sqrt(Math.max(0, (1.03 * Lr) ** 2 - dl * dl))); }
      if (need > A2) { A2 = need; ph0 = pp % 0.5; } }
    const amp = Math.min(A2, 0.026 * R.h) + (0.01 - 0.004 * run) * R.h * Math.min(1, g * 1.5), bob = amp * (0.5 + 0.5 * Math.cos(4 * Math.PI * (ph - ph0))) + breath + (o.dip || 0) * R.h;
    const parts = [];
    for (const side in legs) { const q = legs[side], { H0, K0, A0, l1, l2 } = q; const Hh = [H0[0], H0[1] + bob]; let A = q.A;
      let dd = Math.hypot(A[0] - Hh[0], A[1] - Hh[1]); const mx = (l1 + l2) * 1.19; if (dd > mx) { A = [Hh[0] + (A[0] - Hh[0]) * mx / dd, Hh[1] + (A[1] - Hh[1]) * mx / dd]; dd = mx; }
      const kS = [Hh[0] + (A[0] - Hh[0]) * l1 / (l1 + l2), Hh[1] + (A[1] - Hh[1]) * l1 / (l1 + l2)]; let K = kS;
      if (dd < l1 + l2) { const kIK = ik2(Hh, A, l1, l2, d); K = [kS[0] + (kIK[0] - kS[0]) * 0.6, kS[1] + (kIK[1] - kS[1]) * 0.6]; }
      parts.push({ y: A[1], draw: () => { L.sprite(name + '__thigh' + side, 0, 0, { m: BM(segMap(H0, K0, Hh, K)), w: R.w, h: R.h, u });
        L.sprite(name + '__shin' + side, 0, 0, { m: BM(segMap(K0, A0, K, A)), w: R.w, h: R.h, u });
        if (has(name + '__foot' + side)) L.sprite(name + '__foot' + side, 0, 0, { m: BM(M.t(A[0] - A0[0], A[1] - A0[1])), w: R.w, h: R.h, u }); } });
      const dA = [A[0] - A0[0], A[1] - A0[1]], gA = [q.A[0] - A0[0], q.A[1] - A0[1] + lift * q.fl]; tr('ground' + side, [R['heel' + side][0] + gA[0], R['heel' + side][1] + gA[1]]); tr('hip' + side, Hh);
      tr('knee' + side, K); tr('ankle' + side, A); tr('heel' + side, [R['heel' + side][0] + dA[0], R['heel' + side][1] + dA[1]]); tr('toe' + side, [R['toe' + side][0] + dA[0], R['toe' + side][1] + dA[1]]); }
    parts.sort((p, q) => p.y - q.y).forEach((p) => p.draw());
    // arms: two-bone (upper arm + forearm) when the rig has elbows, else one piece. Walking swing against the legs, then pose layers:
    // o.hands (screen targets), the throw, carrying at the belly, o.arm (absolute)
    const sides = ['L', 'R'].filter((sd) => R['sh' + sd] && R['hand' + sd] && ((R['elbow' + sd] && has(name + '__uarm' + sd)) || has(name + '__arm' + sd)));
    const fd = o.face ? [o.face[0] * fx, o.face[1]] : d, cx0 = (R.hipL[0] + R.hipR[0]) / 2, hands = {}, arms = [];
    let thr = null; if (o.throwU && sides.length) { thr = sides.includes('R') ? 'R' : sides[0];
      if (sides.length === 2 && Math.abs(o.throwU[0]) > 0.2) thr = (toS(R.shR)[0] - toS(R.shL)[0]) * o.throwU[0] > 0 ? 'R' : 'L'; }
    let carryMid = null, shMid = 0; if (o.carry && sides.length) { const sh = sides.map((sd) => R['sh' + sd]), hd0 = R['hand' + sides[0]], al0 = Math.hypot(hd0[0] - sh[0][0], hd0[1] - sh[0][1]);
      shMid = sh.reduce((p, q) => p + q[0], 0) / sh.length; const my = sh.reduce((p, q) => p + q[1], 0) / sh.length;
      carryMid = [shMid + fd[0] * 0.2 * al0, my + bob + 0.6 * al0 + Math.max(0, fd[1]) * 0.06 * al0]; }
    for (const side of sides) { const S0 = R['sh' + side], H0 = R['hand' + side], E0 = R['elbow' + side], two = !!(E0 && has(name + '__uarm' + side));
      const [fp] = footPath(ph + (side === 'R' ? 0 : 0.5), duty), al = Math.hypot(H0[0] - S0[0], H0[1] - S0[1]), Sh = [S0[0], S0[1] + bob], swing = (0.35 + 0.15 * run) * f;
      let Ht = [H0[0] + d[0] * swing * fp, H0[1] + bob + d[1] * swing * fp - (0.03 + 0.07 * run) * al * g * (0.5 + 0.5 * Math.abs(fp))];
      const toT = (ht, w) => { const tgt = [S0[0] + ht[0] * fx * al, S0[1] + bob + ht[1] * al]; Ht = [Ht[0] + (tgt[0] - Ht[0]) * w, Ht[1] + (tgt[1] - Ht[1]) * w]; };
      const ht = o.hands && o.hands[side]; if (ht) toT(ht, ht[2] === undefined ? 1 : ht[2]);
      if (thr) { const kf = throwPose(o.throwA, o.throwU, side === thr, (Math.sign(S0[0] - cx0) || (side === 'L' ? -1 : 1)) * fx); if (kf) toT(kf, kf[2]); }
      if (carryMid) { const sg = sides.length === 2 ? Math.sign(S0[0] - shMid) : 0; Ht = [carryMid[0] + sg * 0.3 * al, carryMid[1]]; }
      if (o.arm && o.arm[side]) { const sw2 = o.arm[side]; Ht = [S0[0] + sw2[0] * al, S0[1] + bob + sw2[1] * al]; }
      const out = [Sh[0] - cx0, 0]; out[0] = Math.sign(out[0]) || (side === 'L' ? -1 : 1); const H1 = Ht;
      arms.push(() => {
        if (two) { const l1 = Math.hypot(E0[0] - S0[0], E0[1] - S0[1]), l2 = Math.hypot(H0[0] - E0[0], H0[1] - E0[1]); const bend = [out[0] * 0.8 - d[0] * 0.6, 0.15 - d[1] * 0.6];
          const E = ik2(Sh, H1, l1, l2, bend); L.sprite(name + '__uarm' + side, 0, 0, { m: BM(segMap(S0, E0, Sh, E)), w: R.w, h: R.h, u }); L.sprite(name + '__farm' + side, 0, 0, { m: BM(segMap(E0, H0, E, H1)), w: R.w, h: R.h, u }); tr('elbow' + side, E); }
        else L.sprite(name + '__arm' + side, 0, 0, { m: BM(segMap(S0, H0, Sh, H1)), w: R.w, h: R.h, u });
        tr('sh' + side, Sh); tr('hand' + side, H1); });
      hands[side] = toS(Ht); }
    const mid = hands.L && hands.R ? [(hands.L[0] + hands.R[0]) / 2, (hands.L[1] + hands.R[1]) / 2] : (hands.L || hands.R), holdPt = carryMid ? toS(carryMid) : mid;
    const behind = !!o.holdBehind;
    if (o.hold && behind && holdPt) o.hold(holdPt);                                // facing away: what the hands hold is hidden behind the body
    if (behind && o.carry) arms.forEach((f2) => f2());
    L.sprite(name + '__body', 0, 0, { m: BM(M.t(0, bob)), w: R.w, h: R.h, u });
    if (o.hold && !behind && holdPt && o.carry) o.hold(holdPt);                     // carried in front: the hands grip over it
    if (!(behind && o.carry)) arms.forEach((f2) => f2());
    if (o.hold && !behind && holdPt && !o.carry) o.hold(holdPt);
    if (o.out) { Object.assign(o.out, hands); if (thr) o.out.thr = hands[thr]; }
    const hd = [R.head[0], R.head[1] + bob]; tr('head', hd); tr('ground', [gx, gy]); tr('hip', [(R.hipL[0] + R.hipR[0]) / 2, (R.hipL[1] + R.hipR[1]) / 2 + bob]);
    return toS([R.top[0], R.top[1] + bob]);
  }
  const KA = Math.atan(0.5);
  // world → screen length factor along a screen direction (2:1 iso foreshortening of the stride)
  const scrF = (an) => { const X = Math.cos(an), Y = Math.sin(an); return 1 / Math.hypot((X / C - Y / SN) / 2, (X / C + Y / SN) / 2); };
  // the two-view sets (se / ne + mirror) by screen facing angle
  const viewOf = (tex, an) => { const set = CH[tex]; if (!set) return null; const down = Math.sin(an) >= 0, n = down || !RG[set[1]] ? set[0] : set[1];
    return [n, n === set[0] ? Math.cos(an) < 0 : Math.cos(an) > 0]; };
  // ---------- Kolya: frame-by-frame sprites (generated walk / action / carry sheets, tools/kframes.py) ----------
  const KF = window.KFR || {}, KH = 122;
  const KSEQ = { e: [0, 1, 2, 3, 5, 6] };                                       // walk loop per view (default: all 8 frames)
  const kolyaFrame = (view, kind, i, X, Y, flip, u, sy = 1) => atlasFrame('kf_' + view + '_' + kind, i, X, Y, flip, u, sy, KH);
  // legs [l, r]: seen from behind the gait reads poorly (the swing foot only shows its sole), so each leg below the hip is drawn on
  // its own and shortened from the hip by l / r of the leg length — the stepping foot rises, the other stays planted (v10)
  let AFLOW = 0;                                                               // v10 ghost costume: > 0 draws only the frame's bottom strip (shins, shoes)
  function atlasFrame(name, i, X, Y, flip, u, sy = 1, HH = KH, legs = null) {
    const m = KF[name]; if (!m || !has(name)) return null;
    const k = HH / m.h, w = m.fw * k, h = m.fh * k, ax = m.ax * k, ay = m.ay * k;
    if (AFLOW > 0) { const cut = Math.max(0, m.ay - AFLOW), v0 = i / m.n, v1 = (i + 1) / m.n;
      L.sprite(name, flip ? X - (w - ax) : X - ax, Y - ay * sy + cut * k * sy, { w, h: (m.fh - cut) * k * sy, src: [v0, cut / m.fh, v1, 1], flip, u }); }
    else if (legs && (legs[0] > 0.004 || legs[1] > 0.004)) {
      const hipF = m.ay - 0.45 * m.h, v0 = i / m.n, v1 = (i + 1) / m.n, hv = hipF / m.fh, top = Y - ay * sy, hipY = top + hipF * k * sy, legH = (m.fh - hipF) * k * sy;
      L.sprite(name, flip ? X - (w - ax) : X - ax, top, { w, h: hipF * k * sy, src: [v0, 0, v1, hv], flip, u });
      for (const [c0, c1, lf] of [[0, m.ax, legs[0]], [m.ax, m.fw, legs[1]]]) {
        const x0 = flip ? X + (m.ax - c1) * k : X + (c0 - m.ax) * k;
        L.sprite(name, x0, hipY, { w: (c1 - c0) * k, h: legH * (1 - lf), src: [v0 + c0 / m.fw / m.n, hv, v0 + c1 / m.fw / m.n, 1], flip, u }); }
    } else
    L.sprite(name, flip ? X - (w - ax) : X - ax, Y - ay * sy, { w, h: h * sy, src: [i / m.n, 0, (i + 1) / m.n, 1], flip, u });
    const led = m.led[i] ? [X + (flip ? -1 : 1) * m.led[i][0] * k, Y + m.led[i][1] * k * sy] : null;
    const hp = (window.KHEAD || {})[name], hd = hp && hp[i] ? [X + (flip ? -1 : 1) * hp[i][0] * k, Y + hp[i][1] * k * sy] : null;
    return { head: [X, Y - HH * sy], led, af: { name, i, X, Y, flip, sy, k, hd } };
  }
  // 16 walk / idle directions (atlases k16_<p|m><yaw>w: 8 walk frames + 2 idle, 9 drawn yaws, the rest mirrored).
  // b = body yaw step of 22.5° (0 = right, 4 = toward the viewer, 12 = away)
  // sets: k16 (hands free), k16t (the phone flashlight held up), k16r (the airsoft rifle at hip-ready)
  const K16 = (b, set = 'k16') => { let d = (((b * 22.5 + 180) % 360) + 360) % 360 - 180, fl = false; if (d > 90) { d = 180 - d; fl = true; } else if (d < -90) { d = -180 - d; fl = true; }
    return [set + '_' + (d >= 0 ? 'p' : 'm') + Math.floor(Math.abs(d)) + 'w', fl]; };
  const K32 = (b, set = 'k16') => { let d = (((b * 11.25 + 180) % 360) + 360) % 360 - 180, fl = false; if (d > 90) { d = 180 - d; fl = true; } else if (d < -90) { d = -180 - d; fl = true; }
    return [set + '_' + (d >= 0 ? 'p' : 'm') + Math.floor(Math.abs(d)) + 'w', fl]; };                       // 32 directions: 17 drawn yaws, the rest mirrored
  // v10 costumes from Vera's chest: the ghost sheet over the walking legs, or a pumpkin helmet / a wizard hat / devil horns on the head.
  // The view (0 front … 4 back, mirrored for the left half) comes from the drawn atlas's yaw
  const cosView = (name) => { const m = /_(p|m)(\d+)w$/.exec(name); if (!m) return 1; const yw = (m[1] === 'p' ? 1 : -1) * +m[2]; return Math.max(0, Math.min(4, Math.round((90 - yw) / 45))); };
  function costumeOver(cos0, r, a, walking) { const f = r.af, v = cosView(f.name), fl = f.flip, cos = cos0.split('_')[0], gold = /_gold$/.test(cos0), neon = /_neon$/.test(cos0);   // v12: gacha variants tint the base costume
    const u = { alpha: a, tint: ST.hp < 30 ? [1, 0.6, 0.6, 0.3] : gold ? [1, 0.8, 0.22, 0.62] : neon ? [0.35, 1, 0.95, 0.58] : [1, 1, 1, 0], rim: [0.3, fl ? 0.004 : -0.004, -0.004, 1], rimCol: gold ? [1, 0.9, 0.4] : neon ? [0.4, 1, 1] : [1, 0.7, 0.4] };
    if (neon) L.glow(f.X, f.Y - KH * 0.5, KH * 0.9, [0.3, 1, 0.95], 0.35 + 0.1 * Math.sin(T * 4), 2.5); if (gold) L.glow(f.X, f.Y - KH * 0.85, KH * 0.45, [1, 0.8, 0.3], 0.3 + 0.1 * Math.sin(T * 3), 2.5);
    if (cos === 'ghost') { const n = 'cos_ghost_' + v, md = (window.COSMETA || {}).ghost, g = md ? md[v] : { gf: 0.99, tf: 0.01, cx: 0.5 }; if (!has(n)) return;
      const Hs = KH * 1.04, sc = Hs / ((g.gf - g.tf) * A[n].h), w = A[n].w * sc, h = A[n].h * sc, gx = f.X, gy = f.Y + (walking ? -1.5 * Math.abs(Math.sin(Math.PI * 2 * ST.gph)) : 0);
      const x0 = fl ? gx - (1 - g.cx) * w : gx - g.cx * w, y0 = gy - g.gf * h, rot = walking ? 0.03 * Math.sin(Math.PI * 2 * ST.gph) : 0.012 * Math.sin(T * 1.7);
      L.sprite(n, x0, y0, { w, h, flip: fl, u, rot, pivot: [fl ? (1 - g.cx) * w : g.cx * w, g.gf * h] });
      r.head = [gx, y0 + g.tf * h];
      if (ST.carry === 'rotten' && has('rotten')) { const hh = 44, ww = L.hsz('rotten', hh); L.sprite('rotten', gx - ww / 2 + (fl ? -10 : 10), gy - KH * 0.48, { w: ww, h: hh }); }
      if (ST.gun && !(ST.hidden)) drawRifle(gx, gy);
      return; }
    const hd = f.hd; if (!hd) return; const n = 'cos_' + cos + '_' + v; if (!has(n)) return;
    const spec = { pumpkin: [0.31, 0.6, 0.0], hat: [0.42, 0.86, -0.05], horns: [0.27, 1.0, -0.035] }[cos];
    let w = KH * spec[0], h = w * A[n].h / A[n].w; if (cos === 'horns') { h = KH * 0.105; w = h * A[n].w / A[n].h; }      // the horns keep their height in every view
    L.sprite(n, hd[0] - w / 2, hd[1] + KH * spec[2] - h * spec[1], { w, h, flip: fl, u });
    if (cos === 'pumpkin' && v <= 2) { const q = [hd[0] + (fl ? -1 : 1) * w * [0, 0.12, 0.3][v], hd[1] - h * 0.12]; L.glow(q[0], q[1], 16, [1, 0.7, 0.25], 0.5 + 0.15 * Math.sin(T * 9), 2.5); }
    r.head = [hd[0], hd[1] - (cos === 'hat' ? KH * 0.3 : KH * 0.12)]; }
  const K16XF = 0.07, MZ = new WeakMap();                                     // MZ: where each BB left the drawn muzzle                                                            // crossfade between neighbouring directions (s)
  function drawKolya(X, Y, a) {
    const v = SIM.KVIEWS[ST.vi === undefined ? 1 : ST.vi], view = v[0], flip = v[2], sp = Math.hypot(ST.vx, ST.vy), moving = sp > 25 && !ST.hidden;
    const turning = !moving && !ST.hidden && (ST.turnA || 0) > 0.5;
    const mkU = (fl, al) => ({ alpha: al, tint: ST.hp < 30 ? [1, 0.6, 0.6, 0.3] : [1, 1, 1, 0], rim: [0.3, fl ? 0.004 : -0.004, -0.004, 1], rimCol: [1, 0.7, 0.4] });
    const u = mkU(flip, a);
    L.shadow(X, Y - 4, 30, 11, 0.5 * a);
    const hset = ST.gun && has('k16r_p0w') ? 'k16r' : ST.light && has('k16t_p0w') ? 'k16t' : 'k16';                // what his hands hold
    if (ST.gun && hset !== 'k16r' && !ST.hidden && Math.sin(ST.ang || 0) < -0.2) drawRifle(X, Y);   // fallback without the rifle atlases
    const ev = (ks, dur) => [...ST.ev].reverse().find((e) => ks.includes(e.k) && GT - e.t < dur && GT >= e.t);
    const th = ev(['throw'], 0.48), use = ev(['bell', 'mailbox', 'flyer', 'swap', 'fuse', 'slime'], 0.55), pick = ev(['pickup', 'putdown'], 0.5);
    let kind = 'act', i = 0, sy = 1;
    if (th) { const t = GT - th.t; i = t < 0.16 ? 1 : t < 0.3 ? 2 : 3; }
    else if (ST.hidden || pick) i = 5;
    else if (use || ST.slimeHold > 0.01) i = 4;
    else if (ST.carry === 'rotten') { if (moving) { kind = 'carry'; i = Math.floor(((ST.gph % 1) + 1) % 1 * 4) % 4; } else i = 7; }
    else if (ST.light && hset === 'k16') { if (moving) { kind = 'carry'; i = 4 + Math.floor(((ST.gph % 1) + 1) % 1 * 4) % 4; } else i = 6; }
    else if (moving || turning) { kind = 'walk'; const seq = KSEQ[view] || [0, 1, 2, 3, 4, 5, 6, 7]; i = seq[Math.floor(((ST.gph % 1) + 1) % 1 * seq.length) % seq.length]; }
    else { kind = 'idle'; sy = 1 + (ST.neutral ? 0 : 0.006 * Math.sin(T * 2.2)); }  // idle: breathing
    let r = null;
    const cos = ST.costume && !ST.hidden && has('cos_ghost_0') ? ST.costume : '';
    AFLOW = cos === 'ghost' ? 0.36 * 300 : 0;                                    // under the sheet only the shins and the shoes of the frame are drawn
    const carry = ST.carry === 'rotten' && has('k16c_p0w') && !th && !use && !pick && !ST.hidden;
    if (carry) kind = moving || turning ? 'walk' : 'idle';
    const set = carry ? 'k16c' : hset;
    if ((th || use || pick || ST.hidden || ST.slimeHold > 0.01) && has('ka_p0w') && ST.d16 !== undefined) {   // actions in 16 directions, feet planted
      const [n1, f1] = K16(ST.d16, 'ka'); r = atlasFrame(n1, Math.min(5, i), X, Y, f1, mkU(f1, a), 1); if (r) r.led = null; }
    else if ((kind === 'walk' || kind === 'idle') && has('k16_p0w') && ST.d16 !== undefined) {
      // walk: all 8 frames in the gait phase shared by every direction; a light bob (lowest at heel strike). 32 directions where the
      // in-between sheets exist (the turn steps 11.25°), else 16; while turning the next direction blends in by the yaw between them
      const N = has(set + '_p11w') && ST.d32 !== undefined ? 32 : 16, st = 2 * Math.PI / N, bin = N === 32 ? ST.d32 : ST.d16, binP = N === 32 ? ST.d32p : ST.d16p, binT = N === 32 ? ST.d32t : ST.d16t;
      const KN = (b) => (N === 32 ? K32(b, set) : K16(b, set));
      const ph8 = ((ST.gph % 1) + 1) % 1, fi = kind !== 'walk' ? 8 : turning ? [1, 2, 5, 6][Math.floor(ph8 * 4) % 4] : Math.floor(ph8 * 8) % 8, yaw = bin * st, bob = kind === 'walk' ? (1.3 + 1.4 * Math.abs(Math.sin(yaw))) * (0.5 - 0.5 * Math.cos(4 * Math.PI * ST.gph)) : 0;   // front/back: a deeper bob
      const swy = kind === 'walk' && !turning ? 3 * Math.abs(Math.sin(yaw)) * Math.sin(2 * Math.PI * ST.gph) : 0, Xs = X + swy;   // weight over the stance foot
      const [n1, f1] = KN(bin), bm = /_m(\d+)w$/.exec(n1), bw = kind === 'walk' && !turning && bm ? Math.max(0, Math.min(1, (+bm[1] - 45) / 45)) : 0;
      const gs = Math.sin(2 * Math.PI * ph8), la = (0.14 + 0.16 * Math.min(1, ST.runA || 0)) * bw, legs = bw ? [la * Math.max(0, gs), la * Math.max(0, -gs)] : null;   // walking / running away: the stepping foot rises (higher at a run, v11)
      r = atlasFrame(n1, fi, Xs, Y - bob, f1, mkU(f1, a), sy, KH, legs);
      const xf = ST.t - binT, dd = ((((ST.yaw || 0) - bin * st) / st + N / 2) % N + N) % N - N / 2;
      if (Math.abs(ST.yawV || 0) > 1.5 && Math.abs(dd) > 0.08) { const [n0, f0] = KN((bin + (dd > 0 ? 1 : N - 1)) % N); atlasFrame(n0, fi, Xs, Y - bob, f0, mkU(f0, a * Math.min(0.5, Math.abs(dd))), sy); }
      else if (xf >= 0 && xf < K16XF && binP !== bin) { const [n0, f0] = KN(binP); atlasFrame(n0, fi, Xs, Y - bob, f0, mkU(f0, a * (1 - xf / K16XF)), sy); }
      if (r && (set === 'k16' || set === 'k16c')) r.led = null;                    // the phone light / the muzzle come from the atlas
    }
    AFLOW = 0;
    if (!r) r = kolyaFrame(view, kind === 'idle' ? 'act' : kind, kind === 'idle' ? 0 : i, X, Y, flip, u, sy) || { head: [X, Y - KH], led: null };
    if (cos && r.af) costumeOver(cos, r, a, kind === 'walk' && !turning);
    if (r.led && ST.light) { L.glow(r.led[0], r.led[1], 22, [1, 0.97, 0.85], 0.9, 3); }
    if (ST.gun && hset !== 'k16r' && !ST.hidden && Math.sin(ST.ang || 0) >= -0.2) drawRifle(X, Y);
    if (ST.gun && hset === 'k16r' && r.led && GT - (ST.shotT || -9) < 0.06) { const c = Math.cos(ST.ang || 0), s2 = Math.sin(ST.ang || 0); L.star(r.led[0] + c * 10, r.led[1] + s2 * 6, 26, [1, 0.95, 0.7], 1); L.glow(r.led[0], r.led[1], 40, [1, 0.8, 0.4], 0.8, 2.5); }
    r.face = [Math.cos(ST.ang || 0), Math.sin(ST.ang || 0)];
    L.joint('kolya', 'ground', [X, Y]); L.joint('kolya', 'head', r.head);
    return r;
  }
  // o: ang (screen facing), mang (screen travel angle), gph (gait cycles), g (gait 0..1), stride (world units per cycle), view [rig, flip], k (scale)
  function drawPerson(tex, x, y, o = {}) {
    const q = P(x, y), set = CH[tex], k = o.k || 1, a = o.alpha === undefined ? 1 : o.alpha;
    if (!o.noShadow) L.shadow(q[0], q[1], 30 * k, 11 * k, 0.5 * a);
    const an = o.ang === undefined ? KA : o.ang, v = o.view || viewOf(tex, an);
    if (v && RG[v[0]] && has(v[0] + '__body')) { const mang = o.mang === undefined ? an : o.mang;
      const sf = scrF(mang); return drawRig(v[0], q[0], q[1] + 4, set[2] * k, v[1], o.gph || 0, o.g || 0, [Math.cos(mang), Math.sin(mang)], Object.assign({}, o, { stride: (o.stride || 80) * sf, sf, face: [Math.cos(an), Math.sin(an)] })); }
    if (set && has(set[0])) { const se = Math.sin(an) >= 0, n = se ? set[0] : set[1], hh = set[2] * k, w = L.hsz(n, hh), flip = se ? Math.cos(an) < 0 : Math.cos(an) > 0;
      L.sprite(n, q[0] - w / 2, q[1] - hh + 4, { w, h: hh, flip, u: { alpha: a, tint: o.tint || [1, 1, 1, 0], rim: [0.35, flip ? 0.004 : -0.004, -0.004, 1], rimCol: [1.0, 0.7, 0.4] } }); return [q[0], q[1] - hh]; }
    const col = NPCCOL[tex] || [[0.4, 0.3, 0.3], [0.8, 0.6, 0.4]];
    L.rrect(q[0] - 19 * k, q[1] - 88 * k, 38 * k, 88 * k, 14 * k, col[0].map((c) => c * 1.1), col[0].map((c) => c * 0.7), a);
    L.rrect(q[0] - 14 * k, q[1] - 112 * k, 28 * k, 28 * k, 14 * k, col[1], col[1].map((c) => c * 0.75), a);
    return [q[0], q[1] - 112 * k];
  }

  // ---------- props (code placeholders until the props kit lands) ----------
  // a flat quad in the plane spanned by screen vectors ex (across) and ey (down), sub-rect (u0, v0)–(u1, v1) of it
  const quadOn = (o, ex, ey, u0, v0, u1, v1, col, al = 1) => G.draw(L.P.solid, { u_col: col, u_a: al },
    mat3([ex[0] * (u1 - u0), ex[1] * (u1 - u0), ey[0] * (v1 - v0), ey[1] * (v1 - v0), o[0] + ex[0] * u0 + ey[0] * v0, o[1] + ex[1] * u0 + ey[1] * v0]));
  const LAMP_H = 270, LAMP_POLE = 0.336, LAMP_BULB = [0.81, 0.178];          // pole centre and bulb as fractions of the lamp sprite
  const lampHead = (q) => { const w = has('lamp') ? L.hsz('lamp', LAMP_H) : 0; return has('lamp') ? [q[0] + (LAMP_BULB[0] - LAMP_POLE) * w, q[1] - LAMP_H + 6 + LAMP_BULB[1] * LAMP_H] : [q[0] + 36, q[1] - 232]; };
  function lamp(x, y, i, flyer) { const q = P(x, y), b = has('lamp') ? 0 : 1;
    if (has('lamp')) { const w = L.hsz('lamp', LAMP_H); L.sprite('lamp', q[0] - w * LAMP_POLE, q[1] - LAMP_H + 6, { w, h: LAMP_H }); }
    else { L.rrect(q[0] - 5, q[1] - 230, 10, 232, 4, [0.12, 0.1, 0.1], [0.06, 0.05, 0.05]); L.rrect(q[0] - 4, q[1] - 236, 46, 8, 3, [0.12, 0.1, 0.1], [0.08, 0.06, 0.06]);
      L.rrect(q[0] + 26, q[1] - 236, 26, 18, 6, [1.0, 0.85, 0.55], [0.9, 0.6, 0.3]); }
    if (flyer) flyerOn(x, y, i);
    return b; }
  // a paper flyer taped round the pole, facing the street (+y face): iso parallelogram, the free bottom corner flutters in the wind
  function flyerOn(x, y, i) { const e = [...ST.ev].reverse().find((q) => q.k === 'flyer' && q.i === i), age = e ? GT - e.t : 9, sc = age < 0.25 ? 0.6 + 0.4 * ease(age / 0.25) : 1;
    const wW = 30 * sc, hh = 38 * sc, o = P(x - wW / 2, y + 2, 150 + 20 * sc), ex = [C * wW, -SN * wW], fl = Math.sin(T * 3.1 + i * 1.7) * (1.5 + 2.5 * Math.abs(SIM.windAt(T, x))), ey = [fl, hh];
    quadOn([o[0] + 2, o[1] + 2], ex, ey, 0, 0, 1, 1, [0.05, 0.03, 0.02], 0.35);                    // shadow on the pole
    quadOn(o, ex, ey, 0, 0, 1, 1, [0.93, 0.9, 0.8]); quadOn(o, ex, ey, 0, 0, 1, 0.24, [0.85, 0.32, 0.08]);
    quadOn(o, ex, ey, 0.38, 0.32, 0.62, 0.5, [0.95, 0.55, 0.1]);                                     // a pumpkin dot
    for (let j = 0; j < 3; j++) quadOn(o, ex, ey, 0.14, 0.58 + j * 0.12, 0.86 - 0.18 * (j % 2), 0.63 + j * 0.12, [0.25, 0.14, 0.1], 0.85);
    quadOn(o, ex, ey, 0.38, -0.05, 0.62, 0.06, [0.75, 0.75, 0.72], 0.8); }                          // tape
  // tall wooden fence along y at x (the alley sides): fence_side art runs along +y already
  function sideFence(x, y0, y1) { if (!has('fence_side')) { sideSolid(x, y0, y1, 0, 90, [0.16, 0.1, 0.08]); return; }
    const w = 250, h = w * A.fence_side.h / A.fence_side.w, Lw = w * 0.96 / C;
    for (let y = y0; y < y1 - 4; y += Lw * 0.96) { const fr = Math.min(1, (y1 - y) / Lw), q = P(x, y), ww = w * (0.02 + 0.96 * fr + (fr < 1 ? 0 : 0.02));
      L.sprite('fence_side', q[0] - 0.02 * w, q[1] - 0.37 * h, { w: ww, h, src: [0, 0, ww / w, 1] }); } }
  function propSprite(n, x, y, w, ay = 0.82) { const q = P(x, y); if (!has(n)) return; const h = w * A[n].h / A[n].w; L.shadow(q[0], q[1], w * 0.42, w * 0.16, 0.45); L.sprite(n, q[0] - w / 2, q[1] - h * ay, { w, h }); }
  function pizzaStack(X, Yb, hh, a = 1) { if (!has('pizza_stack')) return; const w = hh * A.pizza_stack.w / A.pizza_stack.h; L.sprite('pizza_stack', X - w / 2, Yb - hh, { w, h: hh, u: { alpha: a } }); }
  function ntree(x, y, s, i) { if (!has('tree_a')) return; const q = P(x, y), w = SIM.windAt(T, x), g = SIM.gustAt(T, x), n = i % 3 ? 'tree_b' : 'tree_a', hh = (n === 'tree_a' ? 340 : 400) * s, ww = L.hsz(n, hh), far = Math.min(1, Math.max(0, (-1500 - y) / 900));
    L.shadow(q[0] + 30, q[1] + 4, 90 * s, 30 * s, 0.3); L.sprite(n, q[0] - ww * 0.51, q[1] - hh + 10, { w: ww, h: hh, pad: 0.05, flip: i % 2 === 1, u: { tint: [0.16, 0.1, 0.18, 0.25 + 0.35 * far], sway: [0.004 + 0.003 * Math.abs(w) + 0.006 * g, 3, T * 1.3 + i, 1] } }); }   // the wood: darker further back
  function tree(x, y, s, i) { const q = P(x, y), w = SIM.windAt(T, x), g = SIM.gustAt(T, x);
    if (has('tree_a')) { const n = i % 2 ? 'tree_b' : 'tree_a', hh = (n === 'tree_a' ? 340 : 400) * s, ww = L.hsz(n, hh); L.shadow(q[0] + 30, q[1] + 4, 90 * s, 30 * s, 0.35);
      L.sprite(n, q[0] - ww * 0.51, q[1] - hh + 10, { w: ww, h: hh, pad: 0.05, u: { sway: [0.004 + 0.003 * Math.abs(w) + 0.006 * g, 3, T * 1.3 + i, 1] } });
      const r = SIM.treeRect(i); if (r) ST.marks.forEach((m) => { if (m.on === 'tree' && m.i === i) markAt(m, r.x - cx + m.u * r.w + (1 - m.v) * 6 * Math.sin(T * 1.3 + i), r.y - cy + m.v * r.h, 0.9, false); }); return; }
    L.rrect(q[0] - 9 * s, q[1] - 150 * s, 18 * s, 152 * s, 6, [0.22, 0.13, 0.08], [0.1, 0.06, 0.04]);
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, r = 70 * s, ox = Math.cos(a) * r * 0.9 + 6 * w + 10 * g * (1 - k / 7), oy = Math.sin(a) * r * 0.55;
      L.puff(q[0] + ox, q[1] - 220 * s + oy, 75 * s, [0.42 + 0.2 * L.rnd(i, k), 0.13 + 0.06 * L.rnd(k, i), 0.06], 0.95, i * 7 + k); }
    L.puff(q[0] + 4 * w, q[1] - 235 * s, 80 * s, [0.6, 0.22, 0.08], 0.9, i + 50); }
  function bush(x, y, i, hidden) { const q = P(x, y), w = SIM.windAt(T, x);
    if (has('bush')) { const h = 86, ww = L.hsz('bush', h); L.sprite('bush', q[0] - ww / 2, q[1] - h + 8, { w: ww, h, pad: 0.06, flip: i % 2 === 1, u: { sway: [0.008 + 0.005 * Math.abs(w) + (hidden ? 0.012 : 0), 4, T * 2 + i, 1] } }); return; }
    for (let k = 0; k < 4; k++) L.puff(q[0] + (k - 1.5) * 22 + 3 * w, q[1] - 34 - (k % 2) * 12, 40, [0.32 + 0.1 * L.rnd(i, k), 0.12, 0.05], 0.95, i * 5 + k); }
  function car(xc, yc, i, alarm) { const x0 = xc - 150, x1 = xc + 150, y0 = yc - 62, y1 = yc + 62;
    if (has('car_a')) { const n = i % 2 ? 'car_b' : 'car_a', ww = 360, hh = ww * A[n].h / A[n].w; const qc = P(xc, yc); L.shadow(qc[0], qc[1] + 10, 170, 50, 0.5); L.sprite(n, qc[0] - ww / 2, qc[1] - hh * 0.62, { w: ww, h: hh });
      ST.marks.forEach((m) => { if (m.on === 'scar' && m.id === i) markAt(m, m.cm ? qc[0] - ww / 2 + m.u * ww : qc[0] - 175 + m.u * 350, m.cm ? qc[1] - hh * 0.62 + m.v * hh : qc[1] - 140 + m.v * 195, 0.55, true); }); }
    else { isoBox(x0, y0, x1, y1, 18, 70, [0.1, 0.1, 0.12], [0.16, 0.14, 0.16], [0.08, 0.08, 0.09]); isoBox(x0 + 70, y0 + 10, x1 - 60, y1 - 10, 70, 112, [0.12, 0.12, 0.15], [0.22, 0.25, 0.3], [0.12, 0.13, 0.16]); }
    const on = alarm && Math.floor(GT * 4) % 2 === 0;
    if (has('car_a')) {   // v10: the lamps where the sprite draws them (px in the 720-wide image): both tail lights and the headlight flash together
      const n = i % 2 ? 'car_b' : 'car_a', ww = 360, hh = ww * A[n].h / A[n].w, qc = P(xc, yc), k = ww / A[n].w, ox = qc[0] - ww / 2, oy = qc[1] - hh * 0.62;
      const LP = i % 2 ? { tail: [[38, 300], [158, 380]], head: [[694, 132]] } : { tail: [[28, 285], [205, 360]], head: [[690, 112]] };
      LP.tail.forEach(([px, py]) => { const x = ox + px * k, y = oy + py * k; glowE(x, y, 16, 10, [1, 0.12, 0.05], 0.55 + (on ? 0.6 : 0)); if (on) glowE(x, y, 54, 28, [1, 0.5, 0.1], 0.9); });
      if (on) LP.head.forEach(([px, py]) => { const x = ox + px * k, y = oy + py * k; glowE(x, y, 46, 24, [1, 0.75, 0.3], 1.2); });
      if (on) { const q = P(xc, yc, 0); L.glow(q[0], q[1] - 20, 230, [1, 0.45, 0.12], 0.18, 2); } }                 // the orange wash on the asphalt around the car
    else { const tl = P(x0 + 5, y1 - 25, 50), tr2 = P(x0 + 5, y0 + 25, 50), hl = P(x1 - 5, y1 - 25, 50);
      [tl, tr2].forEach((q) => { glowE(q[0], q[1], 22, 12, [1, 0.12, 0.05], 0.7 + (on ? 0.8 : 0)); if (on) glowE(q[0], q[1], 60, 30, [1, 0.5, 0.1], 0.8); }); if (on) glowE(hl[0], hl[1], 40, 20, [1, 0.7, 0.2], 1.2); } }
  function bin(x, y, down = 0) { if (has('bins')) { const q = P(x, y), h = 86, w = L.hsz('bins', h); L.shadow(q[0] - 20 * down, q[1], 40 + 20 * down, 14, 0.4);
      if (down > 0) { L.sprite('bins', q[0] - w / 2, q[1] - h + 6, { w, h, rot: -1.45 * down, pivot: [w * 0.15, h * 0.95] }); return; }
      L.sprite('bins', q[0] - w / 2, q[1] - h + 6, { w, h }); return; }
    isoBox(x - 22, y - 22, x + 22, y + 22, 0, 58, [0.12, 0.16, 0.12], [0.1, 0.14, 0.1], [0.07, 0.1, 0.07]); }
  function bench(x, y) { const bn = y > 0 && has('bench_back') ? 'bench_back' : 'bench'; if (has(bn)) { const q = P(x, y), w = 150, h = w * A[bn].h / A[bn].w; L.sprite(bn, q[0] - w / 2, q[1] - h * 0.82, { w, h }); return; }
    isoBox(x - 70, y - 18, x + 70, y + 8, 22, 30, [0.3, 0.18, 0.1], [0.22, 0.13, 0.08], [0.18, 0.1, 0.06]); wallSolid(x - 70, x + 70, y + 8, 30, 60, [0.25, 0.15, 0.09]); }
  function mailbox(x, y, kir, shake) { const q = P(x, y), dx = shake ? 3 * Math.sin(GT * 60) : 0;
    if (has('mailbox')) { const h = 80, w = L.hsz('mailbox', h); L.sprite('mailbox', q[0] - w * 0.77 + dx, q[1] - h + 4, { w, h, u: { tint: kir ? [1, 0.55, 0.55, 0.5] : [1, 1, 1, 0] } }); return; }
    L.rrect(q[0] - 3 + dx, q[1] - 60, 6, 62, 2, [0.2, 0.14, 0.1], [0.1, 0.07, 0.05]); L.rrect(q[0] - 16 + dx, q[1] - 84, 32, 26, 8, kir ? [0.55, 0.12, 0.1] : [0.2, 0.22, 0.26], kir ? [0.3, 0.06, 0.05] : [0.1, 0.1, 0.12]); }
  function pumpkin(x, y, k = 1, rot = false, lit = true, i = 0) { const q = P(x, y), h = 44 * k;
    if (rot && has('rotten')) { const hh = h * 1.05, w = L.hsz('rotten', hh); L.sprite('rotten', q[0] - w / 2, q[1] - hh + 4, { w, h: hh }); for (let j = 0; j < 3; j++) { const an = T * (5 + j) + j * 2; L.rrect(q[0] + Math.cos(an) * 22 - 1.5, q[1] - hh - 6 + Math.sin(an * 1.3) * 10, 3, 3, 1.5, [0.05, 0.05, 0.05], [0.05, 0.05, 0.05]); } return; }
    if (has('probe_prop')) { const w = L.hsz('probe_prop', h); L.sprite('probe_prop', q[0] - w / 2, q[1] - h + 4, { w, h });
      if (lit && !rot) { L.glow(q[0], q[1] - h * 0.45, 46 * k, WARM, 0.35 * flick(i), 3); pool(x, y, 70 * k, WARM, 0.18 * flick(i)); } return; }
    L.rrect(q[0] - 20 * k, q[1] - 36 * k, 40 * k, 34 * k, 16 * k, [0.9, 0.42, 0.08], [0.6, 0.22, 0.04]); }
  // v9: the pickets come from one strip texture of 16 posts sheared along the street (one draw per 16 posts instead of 16)
  const FP = { n: 16, step: 26, made: false }; FP.px = C * FP.step; FP.w = Math.ceil(FP.n * FP.px + 8);
  function fenceStrip() { if (FP.made) return; FP.made = true; const cv = document.createElement('canvas'); cv.width = FP.w; cv.height = 46; const g = cv.getContext('2d');
    for (let k = 0; k < FP.n; k++) { const x = k * FP.px, gr = g.createLinearGradient(0, 1, 0, 45); gr.addColorStop(0, 'rgb(61,41,31)'); gr.addColorStop(1, 'rgb(33,23,18)'); g.fillStyle = gr;
      g.beginPath(); if (g.roundRect) g.roundRect(x, 1, 8, 44, 2); else g.rect(x, 1, 8, 44); g.fill(); }
    G.canvasTex('fencestrip', cv, { mip: false }); }
  function fence(a, b, y) { // picket fence along x at y, from a to b
    fenceStrip(); const step = FP.step, span = FP.n * step;
    for (let xs = Math.ceil(a / step) * step; xs < b; xs += span) { const q = P(xs, y), q2 = P(xs + span, y); if (!onScreen(q, 80) && !onScreen(q2, 80) && !(q[0] < 0 && q2[0] > W)) continue;   // posts on a fixed world grid
      const nPost = Math.min(FP.n, Math.ceil((b - xs) / step)), fr = (nPost * FP.px - (FP.px - 8)) / FP.w;
      L.sprite('fencestrip', 0, 0, { m: [1, -SN / C, 0, 1, q[0] - 4, q[1] - 43], w: FP.w * fr, h: 46, src: [0, 0, fr, 1] }); }
    const o1 = P(a, y, 30), w = b - a; G.draw(L.P.solid, { u_col: [0.2, 0.13, 0.1], u_a: 1 }, mat3([C * w, -SN * w, 0, 5, o1[0], o1[1]]));
    const o2 = P(a, y, 14); G.draw(L.P.solid, { u_col: [0.17, 0.11, 0.08], u_a: 1 }, mat3([C * w, -SN * w, 0, 5, o2[0], o2[1]])); }

  // ---------- houses ----------
  // the sim owns the sprite rects (aiming hit-tests the same pixels the player sees)
  function houseSprite(h) { if (!has(h.tex)) return null; const r = SIM.houseRect(h); return r ? Object.assign({}, r, { x: r.x - cx, y: r.y - cy }) : null; }
  function drawHouse(h) { const hs = houseSprite(h);
    if (hs) L.sprite(h.tex, hs.x, hs.y, { w: hs.w, h: hs.h });
    else { isoBox(h.x0, h.y0, h.x1, h.y1, 0, 170, [0.15, 0.12, 0.12], [0.3, 0.26, 0.24], [0.22, 0.19, 0.18]); }
    return hs; }
  function houseLights(h, hs, i) { if (!hs) return; const bo = ST.blackout && GT < ST.blackout.end ? 0.25 : 1;          // v10: a blackout dims the windows too
    (hs.an.lights || []).forEach(([lx, ly, n], j) => { const X = hs.x + lx * hs.k, Y = hs.y + ly * hs.k, r = Math.min(110, 18 + Math.sqrt(n) * 1.6);
    L.glow(X, Y, r, WARM, 0.22 * bo * flick(i * 10 + j, 0.6), 3.2); });
    const d = P(h.door[0], h.y1 + 70); glowE(d[0], d[1], 150, 75, WARM, 0.2 * bo * flick(i * 3, 0.5), 2.2); }

  // ---------- frame ----------
  S.render = (t) => {
    T = t; ST = S.state || SIM.at(t); GT = ST.t; const K = ST.kir, ev = ST.ev, HK = SIM.HK, MD = SIM.MODIDS.map((id) => [id, ST[SIM.MODS[id].key], SIM.MODH[id]]);
    let shk = 0; for (const e of ev) { const a = GT - e.t; if (a < 0) continue; if (e.k === 'bang' && a < 0.5) shk = Math.max(shk, 14 * (1 - a / 0.5) ** 2); if (e.k === 'hurt' && a < 0.3) shk = Math.max(shk, 6 * (1 - a / 0.3)); }
    if (window.SETTINGS && SETTINGS.shake === false) shk = 0;
    cx = ST.cam[0] + shk * Math.sin(GT * 91); cy = ST.cam[1] + shk * Math.sin(GT * 117);
    if (ST.intro) { L.beginBG([0.02, 0.01, 0.02, 1]); L.beginComp(); L.finish(t, { bloom: [0.3, 0.26], vignette: 0.84, warm: 0.5, roll: 1, dither: 1 }); hud(); return; }   // v12: the prologue draws no street under it
    // ===== ground =====
    L.beginBG([0.03, 0.02, 0.03, 1]);
    const X0 = SIM.X0 - 1500, X1 = SIM.X1 + 1500;
    gTex('lawn_tex', X0, -2600, X1, 2200, 420, { grade: [0.9, 0.62, 0, 1] });
    SIM.HOUSES.forEach((h) => gTex('lawn_tex', h.x0 - 120, h.y1, h.x1 + 120, SIM.SWN[0], 420, { grade: [1, 0.85, 0, 1] }));
    const AT = has('alley_tex') ? 'alley_tex' : 'asphalt_tex';
    gTex(AT, SIM.ALLEY[0] - 30, SIM.ALLEY[1], SIM.ALLEY[2] + 30, SIM.ALLEY[3] + 2, 300, { grade: [0.95, 0.8, 0, 1] });
    gTex(AT, SIM.ENDLOT[0] - 30, SIM.ENDLOT[1], SIM.ENDLOT[2] + 30, SIM.ENDLOT[3] + 2, 300, { grade: [0.95, 0.8, 0, 1] });
    gTex('sidewalk_tex', X0, SIM.SWN[0], X1, SIM.SWN[1], 280);
    gTex('sidewalk_tex', X0, SIM.SWS[0], X1, SIM.SWS[1], 280);
    SIM.HOUSES.forEach((h) => gTex('sidewalk_tex', h.gate - 55, h.y1 + 50, h.gate + 55, SIM.SWN[0], 220, { grade: [0.9, 0.9, 0, 1] }));
    festGround();                                                                    // v12: the festival plaza
    gTex('asphalt_tex', X0, SIM.ROAD[0], X1, SIM.ROAD[1], 520, { grade: [1, 1.05, 0, 1.05] });
    gSolid(X0, SIM.ROAD[0] - 10, X1, SIM.ROAD[0] + 4, [0.24, 0.2, 0.19]); gSolid(X0, SIM.ROAD[1] - 4, X1, SIM.ROAD[1] + 10, [0.26, 0.22, 0.2]);
    gSolid(X0, SIM.ROAD[0] + 4, X1, SIM.ROAD[0] + 12, [0.03, 0.02, 0.03], 0.6); gSolid(X0, SIM.ROAD[1] - 12, X1, SIM.ROAD[1] - 4, [0.03, 0.02, 0.03], 0.6);
    for (let x = Math.floor((cx / C) / 400) * 400 - 2400; x < (cx + W) / C + 1200; x += 400) { gSolid(x, -9, x + 230, -4, [0.78, 0.56, 0.16], 0.65); gSolid(x, 4, x + 230, 9, [0.78, 0.56, 0.16], 0.65); }
    for (let k = 0; k < 9; k++) gSolid(3120 + k * 38, -185, 3120 + k * 38 + 20, 185, [0.8, 0.78, 0.72], 0.32);
    [[2000, 70], [4400, -60], [5800, 80]].forEach(([x, y]) => { const q = P(x, y); ell(L.P.shadow, q[0], q[1], 46, 23, { u_amt: 0.75 }); L.ring(q[0], q[1], 44, 22, [0.3, 0.27, 0.25], 0.5, 0.12); });
    // v10 rain: the ground darkens, puddles appear
    const RAIN = ST.noWeather ? 0 : SIM.rainAt(GT); if (RAIN > 0.003) L.rain(GT, RAIN, [cx, cy], 'ground');
    // puddles reflecting lamps (wet road)
    SIM.LAMPS.forEach(([x, y], i) => { const ry = y < 0 ? -150 : 150, q = P(x + 60, ry); if (!onScreen(q)) return; glowE(q[0], q[1] + 30, 24, 110, LAMPC, 0.16 * flick(i, 0.3), 2); });
    // chalk drawing
    MD.forEach(([id, k, h]) => { const live = ST.chalk && ST.chalk.mod === id; if (!(k.chalk > 0) && !live) return;
      const pts = SIM.chalkShape(h), hit = live ? ST.chalk.hit : pts.map(() => 1), a = live ? 0.9 : 0.25 + 0.6 * k.chalk;
      pts.forEach((p, i) => { if (!hit[i]) return; const q = P(p[0], p[1]); L.puff(q[0], q[1], 9, [0.92, 0.9, 0.95], a, i); }); });
    // chalk drawings anywhere (v9) and the one being drawn
    (ST.drawings || []).forEach((d, j) => { if (!vis0(d.x, d.y)) return; const a = 0.25 + 0.6 * d.acc; SIM.chalkPts(d.kind, d.x, d.y).forEach((p, i) => { if (L.rnd(j * 31 + i, 3) > d.acc + 0.15) return; const q = P(p[0], p[1]); L.puff(q[0], q[1], 9, [0.92, 0.9, 0.95], a, i + j * 50); }); });
    if (ST.chalk && !ST.chalk.mod) ST.chalk.pts.forEach((p, i) => { if (!ST.chalk.hit[i]) return; const q = P(p[0], p[1]); L.puff(q[0], q[1], 9, [0.92, 0.9, 0.95], 0.9, i); });
    // trash spilled from kicked bins
    SIM.BINS.forEach(([x, y], i) => { const dn = ST.binsDown && ST.binsDown[i] !== undefined ? GT - ST.binsDown[i] : 99; if (dn > 60 || !vis0(x, y)) return;
      for (let j = 0; j < 9; j++) { const q = P(x - 30 - 70 * L.rnd(i, j), y + 20 + 60 * (L.rnd(j, i) - 0.3)), f = Math.min(1, dn / 0.4);
        L.rrect(q[0] - 6, q[1] - 4, 12 * f, 8 * f, 3, [[0.85, 0.82, 0.75], [0.35, 0.5, 0.3], [0.6, 0.35, 0.2], [0.8, 0.75, 0.3]][j % 4], [0.3, 0.28, 0.25], 0.9); } });
    // ground marks (eggs, TP rolls)
    ST.marks.forEach((m) => { if (m.on === 'ground') groundMark(m); });
    // light pools on the ground
    SIM.LAMPS.forEach(([x, y], i) => { if (SIM.lampLit(ST, i)) pool(x + (y < 0 ? 40 : -40), y + (y < 0 ? 40 : -40), 230, LAMPC, 0.42 * flick(i, 0.3) * relight(i)); });
    ALLEYBULBS.forEach(([x, y], i) => pool(x - 70, y, 190, [0.75, 0.9, 0.7], 0.3 * bulbF(i)));
    festLights(false);
    // Elf's motion-sensor floodlight on her yard; the raid cars' flashing light bars on the asphalt
    if (ST.elf.lit >= 0) { const k = Math.min(1, (GT - ST.elf.lit) / 0.12) * (0.92 + 0.08 * Math.sin(GT * 50)); pool(SIM.HE.door[0] - 30, SIM.FACADE + 165, 410, [0.9, 0.95, 1], 0.6 * k); }
    if (ST.raid && ST.raid.st !== 'wait') ST.raid.cars.forEach((c, i) => { if (c.tex === 'car_police') { const f = flashRB(GT, i); if (f.r) pool(c.x + 30, c.y + 40, 300, [1, 0.08, 0.08], 0.32); if (f.b) pool(c.x - 30, c.y + 30, 300, [0.12, 0.3, 1], 0.36); }
      else { const rot = (GT * 1.6 + i * 0.3) % 1; pool(c.x + 80 * Math.sin(rot * 6.283), c.y + 40, 260, [1, 0.5, 0.08], 0.3 * Math.max(0, Math.cos(rot * 6.283))); } });
    // Kolya's house throws a party once every moderator is dealt with: coloured light from the windows
    if (SIM.allMods(ST) && !ST.finale) { const hk = SIM.HKO, k = 0.5 + 0.5 * Math.sin(GT * 6); pool(hk.door[0], SIM.FACADE + 120, 330, [[1, 0.2, 0.7], [0.3, 0.6, 1], [1, 0.7, 0.2]][Math.floor(GT * 2) % 3], 0.35 + 0.2 * k); }
    L.beginComp();

    // ===== sorted band =====
    const B = [], add = (b, draw) => B.push({ b, draw });
    const vis = (x, y, m = 500) => onScreen(P(x, y), m);
    const hsInfo = {};
    SIM.HOUSES.forEach((h, i) => { add([h.x0, h.y0, h.x1, h.y1], () => { const hs = hsInfo[h.id] = drawHouse(h); if (h.id === 'kirill') kirillWindow(hs); drawHouseMarks(h, hs); if (h.id === 'kirill') porchPumpkin(hs); if (h.id === 'raiva') raivaPorch(hs); if (h.id === 'elf') elfPorch(hs); }); });
    // the alley: tall side fences, a back picket fence, a dumpster, crates and a weak bulb
    if (vis(SIM.ALLEY[0], -900, 1500)) { const [ax0, ay0, ax1, ay1] = SIM.ALLEY;
      for (const fx of [ax0, ax1]) { const Lw = 250 * 0.96 / C * 0.96; for (let y = ay0; y < ay1 - 4; y += Lw) { const y2 = Math.min(ay1, y + Lw); add([fx - 4, y, fx + 4, y2], () => sideFence(fx, y, y2)); } }
      add([ax0, ay0 - 6, ax1, ay0 + 6], () => fence(ax0, ax1, ay0));
      ALLEYBULBS.forEach(([x, y], i) => add([x - 4, y - 20, x + 4, y + 20], () => { const q = P(x, y, 104); L.solid(q[0] - 1, q[1] - 2, 14, 3, [0.16, 0.14, 0.12]); L.rrect(q[0] - 4, q[1] - 2, 8, 10, 4, [0.85, 1, 0.75], [0.5, 0.6, 0.45]); })); }
    (SIM.PROPS || []).forEach(([n, x, y, r]) => { if (vis(x, y)) add([x - r, y - r, x + r, y + r], () => propSprite(n, x, y, 130)); });
    // the north: backyards (walkable since v10, the clutter is solid), the back fence, lot dividers with a wicket, the wood
    (SIM.NDECOR || []).forEach((d) => { const [n, x, y, w] = d; if (vis(x, y, 600)) add(SIM.nsBox(d), () => propSprite(n, x, y, w)); });
    (SIM.NFENCE || []).forEach(([a, b, y]) => { for (let x = a; x < b; x += 900) { const x2 = Math.min(b, x + 900); if (vis(x, y, 1200) || vis(x2, y, 1200)) add([x, y - 8, x2, y + 8], () => fence(x, x2, y)); } });
    (SIM.NDIV || []).forEach((x) => { if (!vis(x, -1200, 1200)) return; const Lw = 250 * 0.96 / C * 0.96, y0 = SIM.FACADE - 430, G2 = SIM.NGATE;
      for (const [ya, yb] of [[-1420, G2[0]], [G2[1], y0]]) for (let y = ya; y < yb - 4; y += Lw) { const y2 = Math.min(yb, y + Lw); add([x - 4, y, x + 4, y2], () => sideFence(x, y, y2)); } });
    (SIM.NTREES || []).forEach(([x, y, s], i) => { if (visTree(x, y, s)) add([x - 30 * s, y - 30 * s, x + 30 * s, y + 30 * s], () => ntree(x, y, s, i)); });
    MD.forEach(([id, k, h]) => { if (!((ST.courier && (ST.courier.mod || 'kirill') === id && !['wait', 'come'].includes(ST.courier.st)) || k.pr.pizza)) return;
      const x = h.door[0] + 95, y = SIM.FACADE + 46; add([x - 14, y - 14, x + 14, y + 14], () => { const q = P(x, y); L.shadow(q[0], q[1], 20, 7, 0.45); pizzaStack(q[0], q[1] + 2, 48); }); });
    SIM.FENCES.forEach(([a, b]) => { if (vis(a, SIM.FENCE_Y, 1400) || vis(b, SIM.FENCE_Y, 1400)) add([a, SIM.FENCE_Y - 8, b, SIM.FENCE_Y + 8], () => fence(a, b, SIM.FENCE_Y)); });
    { const a = Math.max(SIM.X0, (cx / C) - 400) - 1400, b = Math.min(SIM.X1, (cx + W) / C + 2600), G0 = SIM.FEST.gate;    // v12: a gate to the festival
      if (a < G0[0]) add([SIM.X0, 390, G0[0], 410], () => fence(Math.max(SIM.X0, a), Math.min(b, G0[0]), 400)); if (b > G0[1]) add([G0[1], 390, SIM.X1, 410], () => fence(Math.max(G0[1], a), b, 400)); }
    festWorld(add, vis);
    SIM.LAMPS.forEach(([x, y], i) => { if (vis(x, y)) add([x - 14, y - 14, x + 14, y + 14], () => lamp(x, y, i, MD.some((m) => m[1].lamps.includes(i)) || (ST.flyers2 || []).includes(i))); });
    SIM.TREES.forEach(([x, y, s], i) => { if (visTree(x, y, s)) add([x - 30 * s, y - 30 * s, x + 30 * s, y + 30 * s], () => tree(x, y, s, i)); });
    SIM.BUSHES.forEach(([x, y], i) => { if (vis(x, y)) { const hid = ST.hidden && ST.hideAt && Math.hypot(ST.hideAt[0] - x, ST.hideAt[1] - y) < 5; add([x - 40, y - 30, x + 40, y + 30], () => bush(x, y, i, hid)); } });
    SIM.CARS.forEach(([x, y], i) => { if (vis(x, y, 700)) { const al = ev.some((e) => e.k === 'caralarm' && e.i === i && GT - e.t < 4.5); add([x - 150, y - 62, x + 150, y + 62], () => car(x, y, i, al)); } });
    SIM.BINS.forEach(([x, y], i) => { if (!vis(x, y)) return; const big = x > SIM.ALLEY[0] && x < SIM.ALLEY[2] && y < -1000 && has('dumpster');
      add(big ? [x - 40, y - 30, x + 40, y + 30] : [x - 24, y - 24, x + 24, y + 24], () => { if (big) { const hid = ST.hidden && ST.hideAt && Math.hypot(ST.hideAt[0] - x, ST.hideAt[1] - y) < 5; propSprite('dumpster', x, y, 150, 0.8); if (hid) { const q = P(x, y, 96); L.label('dumpeyes', '• •', q[0] + 6, q[1], { size: 18, col: '#ffe9a0', out: null, al: 0.5, a: 0.5 + 0.5 * Math.sin(T * 2.3) }); } }
        else { const dn = ST.binsDown && ST.binsDown[i] !== undefined ? GT - ST.binsDown[i] : 99; bin(x, y, dn < 60 ? Math.min(1, dn / 0.25) : 0); } }); });
    // v9: rotten pumpkins put down, alarm clocks on the ground, Vera's candy bowl, the black cat
    (ST.drops || []).forEach((d) => { if (vis(d.x, d.y)) add([d.x - 22, d.y - 22, d.x + 22, d.y + 22], () => pumpkin(d.x, d.y, 1.0, true, false)); });
    (ST.decoys || []).forEach((d) => { if (!d.house && vis(d.x, d.y)) add([d.x - 10, d.y - 10, d.x + 10, d.y + 10], () => alarmClock(d)); });
    if (vis(SIM.BOWL[0], SIM.BOWL[1])) add([SIM.BOWL[0] - 20, SIM.BOWL[1] - 20, SIM.BOWL[0] + 20, SIM.BOWL[1] + 20], () => candyBowl());
    if (ST.cat && vis(ST.cat.x, ST.cat.y)) add([ST.cat.x - 12, ST.cat.y - 12, ST.cat.x + 12, ST.cat.y + 12], () => drawCat(ST.cat));
    SIM.BENCHES.forEach(([x, y]) => { if (vis(x, y)) add([x - 70, y - 18, x + 70, y + 8], () => bench(x, y)); });
    SIM.HOUSES.forEach((h) => { const mk = SIM.MODS[h.id] ? ST[SIM.MODS[h.id].key] : null, [x, y] = h.mail, ring = mk && mk.alarm && mk.alarm.done && GT - mk.alarm.ring < 4; if (vis(x, y)) add([x - 10, y - 10, x + 10, y + 10], () => mailbox(x, y, !!mk, ring)); });
    // porch jack-o'-lanterns: Kirill's sad one (or the rotten swap)

    // leaf piles
    SIM.PILES.forEach(([x, y], i) => { if (!vis(x, y)) return; const hit = ST.piles[i] >= 0 ? GT - ST.piles[i] : 99, k = hit < 25 ? Math.min(1, Math.max(0.2, (hit - 6) / 19)) : 1;
      add([x - 40, y - 25, x + 40, y + 25], () => { const q = P(x, y); if (has('leafpile')) { const ww = 110 * (0.45 + 0.55 * k), hh = ww * A.leafpile.h / A.leafpile.w; L.sprite('leafpile', q[0] - ww / 2, q[1] - hh + 8, { w: ww, h: hh }); return; } for (let j = 0; j < 6; j++) L.puff(q[0] + (j - 2.5) * 13 * (2 - k), q[1] - 10 * k - (j % 2) * 8 * k, 26 * (0.6 + 0.4 * k), [0.55 + 0.25 * L.rnd(i, j), 0.22 + 0.1 * L.rnd(j, i), 0.06], 0.95, i * 9 + j); }); });
    // money, Vera's pumpkins, rotten pumpkin, strange lights
    SIM.MONEY.forEach(([x, y, amt, where], i) => { if (ST.got[i] >= 0 || where === 'pile' || !vis(x, y)) return; add([x - 10, y - 10, x + 10, y + 10], () => { const q = P(x, y), dark = where === 'dark' && !litBy(x, y);
      if (dark) return; const tw = 0.5 + 0.5 * Math.sin(T * 3 + i * 2); if (has('coin')) L.sprite('coin', q[0] - 13, q[1] - 22, { w: 26, h: 26 }); L.star(q[0] + 6, q[1] - 16, 16, [1, 0.95, 0.6], 0.6 * tw); }); });
    SIM.VPUMPKINS.forEach(([x, y], i) => { if (ST.vp[i] >= 0 || !vis(x, y)) return; add([x - 20, y - 20, x + 20, y + 20], () => { pumpkin(x, y, 0.85, false, true, 20 + i); if (ST.q.vera >= 1) { const q = P(x, y); L.star(q[0], q[1] - 60 - 6 * Math.sin(T * 3), 22, [1, 0.8, 0.3], 0.7); } }); });
    SIM.ROTTENS.forEach(([x, y], i) => { if (Array.isArray(ST.rottenGot) ? ST.rottenGot[i] : ST.rottenGot) return; add([x - 22, y - 22, x + 22, y + 22], () => { if (litBy(x, y) || Math.hypot(ST.x - x, ST.y - y) < 260) pumpkin(x, y, 1.0, true, false); }); });
    { const [x, y] = SIM.STRANGE; add(has('garage') && SIM.GARAGE ? SIM.GARAGE : [x - 60, y - 60, x + 60, y + 60], () => { const q = P(x, y), f = Math.max(0, Math.sin(T * 23) * Math.sin(T * 7.1) + 0.3);
      if (has('garage')) { const ww = 520, hh = ww * A.garage.h / A.garage.w, gx = q[0] - ww * 0.43, gy = q[1] - hh + 30; L.sprite('garage', gx, gy, { w: ww, h: hh }); L.glow(gx + ww * 0.65, gy + hh * 0.48, 110, [0.55, 0.85, 1.0], 0.7 * f, 3); L.star(gx + ww * 0.65, gy + hh * 0.46, 34, [0.7, 0.9, 1], f); }
      else { isoBox(x - 60, y - 70, x + 60, y + 40, 0, 90, [0.1, 0.1, 0.12], [0.17, 0.16, 0.18], [0.11, 0.1, 0.12]); L.glow(q[0] + 10, q[1] - 70, 90, [0.55, 0.85, 1.0], 0.6 * f, 3); } }); }
    // NPCs, Kirill, courier, kids, Kolya
    ST.npc.forEach((n) => { if (!vis(n.x, n.y)) return; const def = SIM.NPCS[n.i]; add([n.x - 15, n.y - 15, n.x + 15, n.y + 15], () => {
      n.head = drawPerson(def.tex, n.x, n.y, { k: def.id === 'vera' ? 1 : 0.95, ang: n.ang, gph: n.gph || 0, g: def.stat ? 0 : (n.gA || 0), stride: SIM.K.NSTRIDE, id: 'npc' + n.i, seed: n.i, tint: n.rev ? [1, 0.45, 0.4, 0.22] : undefined });
      hitOverlay(n, P(n.x, n.y), 112, 40 + n.i * 7); if ((n.stunT || -99) > GT) dizzy(n.head, n.i); if (n.rev) L.label('nang' + n.i, '!', n.head[0], n.head[1] - 24 - 4 * Math.sin(GT * 12), { size: 40, col: '#ff4a3a', out: '#300000', al: 0.5 }); }); });
    if (K.st === 'door' || K.st === 'out') { const x = HK.door[0], y = HK.y1 + 30; add([x - 15, y - 15, x + 15, y + 15], () => { S.kirHead = drawPerson('kirill', x, y, { ang: KA, id: 'kirill', arm: SCENE_KIR_ARMS() }); }); } else S.kirHead = null;
    { const R = ST.rai, HRr = SIM.HR; if (R.st === 'door' || R.st === 'out') { const x = HRr.door[0], y = HRr.y1 + 30; add([x - 15, y - 15, x + 15, y + 15], () => { S.raiHead = drawRaiva(x, y); }); } else S.raiHead = null; }
    { const E = ST.elf, he = SIM.HE; if (E.st === 'door' || E.st === 'out') { const x = he.door[0], y = he.y1 + 30; add([x - 15, y - 15, x + 15, y + 15], () => { S.elfHead = drawElf(x, y); }); } else S.elfHead = null; }
    S.raidHeads = S.raidHeads || [];
    if (ST.raid && ST.raid.st !== 'wait') { const RD = ST.raid;
      RD.cars.forEach((c, i) => { if (vis(c.x, c.y, 700)) add([c.x - 150, c.y - 62, c.x + 150, c.y + 62], () => raidCar(c, i)); });
      RD.units.forEach((u) => { if (vis(u.x, u.y, 400)) add([u.x - 15, u.y - 15, u.x + 15, u.y + 15], () => { S.raidHeads[u.i] = drawUnit(u); }); else S.raidHeads[u.i] = null; });
      S.crowdHeads = S.crowdHeads || []; RD.crowd.forEach((q, i) => { if (!vis(q.x, q.y)) { S.crowdHeads[i] = null; return; } add([q.x - 15, q.y - 15, q.x + 15, q.y + 15], () => { S.crowdHeads[i] = drawPerson(q.tex, q.x, q.y, { k: 0.93, ang: q.ang, g: 0, id: 'crowd' + i, seed: 30 + i }); hitOverlay(q, P(q.x, q.y), 108, 70 + i * 5); }); }); }
    if (ST.courier) { const c = ST.courier, carry = c.st === 'come' || c.st === 'wait', an = c.ang === undefined ? KA : c.ang, back = Math.sin(an) < 0;
      add([c.x - 15, c.y - 15, c.x + 15, c.y + 15], () => { S.courHead = drawPerson('courier', c.x, c.y, { ang: an, gph: c.gph || 0, g: c.gA || 0, stride: 95, id: 'courier',
        carry, holdBehind: back, hold: carry ? (p) => pizzaStack(p[0], p[1] + 10, 46) : null }); }); } else S.courHead = null;
    if (ST.kids && ST.kids.list) ST.kids.list.forEach((q, i) => add([q.x - 12, q.y - 12, q.x + 12, q.y + 12], () => { const hd = drawPerson('kid', q.x, q.y, { k: 0.72, ang: q.ang, gph: q.gph || 0, g: q.gA || 0, stride: 62, id: 'kid' + i, seed: i }); if (i === 0) S.kidHead = hd; }));
    if (!(ST.mg && ST.mg.k === 'stage')) add([ST.x - 16, ST.y - 16, ST.x + 16, ST.y + 16], () => { const a = ST.hidden ? 0.45 : (ST.hp <= 0 ? Math.max(0, 1 - (GT - (ST.koT || GT)) / 2) : 1);
      const q = P(ST.x, ST.y), r = drawKolya(q[0], q[1] + 4, a); S.kolHead = r.head; S.kolLed = r.led; S.kolFace = r.face; kolyaOverlays(q, r.head); });
    // separating-axis depth sort (smaller x or larger y = nearer the camera = drawn later)
    const cmp = (p, q) => { const a = p.b, b = q.b; if (a[2] <= b[0]) return 1; if (b[2] <= a[0]) return -1; if (a[3] <= b[1]) return -1; if (b[3] <= a[1]) return 1;
      return ((a[1] + a[3]) - (a[0] + a[2])) - ((b[1] + b[3]) - (b[0] + b[2])); };
    // the "drawn over" relation is only a partial order (an insertion sort can break it through a chain of far-apart items:
    // Kolya ended up over a house roof). Constrain only pairs whose screen columns overlap, then a topological sort,
    // farther first among the free items.
    { const n = B.length, sx = B.map((it) => [C * (it.b[0] + it.b[1]) - 90, C * (it.b[2] + it.b[3]) + 90]), key = B.map((it) => (it.b[1] + it.b[3]) - (it.b[0] + it.b[2]));
      const after = Array.from({ length: n }, () => []), indeg = new Int32Array(n);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { if (sx[i][1] < sx[j][0] || sx[j][1] < sx[i][0]) continue; const c = cmp(B[i], B[j]);
        if (c > 0) { after[j].push(i); indeg[i]++; } else if (c < 0) { after[i].push(j); indeg[j]++; } }
      const out = [], done = new Uint8Array(n);
      for (let k = 0; k < n; k++) { let bi = -1; for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (bi < 0 || key[i] < key[bi])) bi = i;
        if (bi < 0) { for (let i = 0; i < n; i++) if (!done[i] && (bi < 0 || key[i] < key[bi])) bi = i; }        // a cycle: take the farthest left
        done[bi] = 1; out.push(B[bi]); for (const j of after[bi]) indeg[j]--; }
      B.length = 0; out.forEach((it) => B.push(it)); }
    if (window.__DBGORDER) window.__DBGORDER = B.map((it) => it.b.map(Math.round).join(','));
    B.forEach((it) => it.draw());
    // night: darker everywhere (settings → brightness), the phone flashlight cuts through; lamps re-light their pools below
    { const ho0 = S.kolLed || P(ST.x, ST.y, 62), d0 = [Math.cos(ST.ang || 0), Math.sin(ST.ang || 0)], nAmt = (window.SETTINGS && SETTINGS.night !== undefined) ? SETTINGS.night : 0.4;
      if (RAIN > 0.003) L.solid(0, 0, W, H, [0.015, 0.02, 0.035], 0, 0, 0, 0.2 * RAIN);                                   // v10: overcast under the rain
      if (nAmt > 0.01) { G.draw(L.P.night, { u_o: ho0, u_d: d0, u_on: ST.light ? 1 : 0, u_amt: nAmt }, G.xf(0, 0, W, H));
        SIM.LAMPS.forEach(([x, y], i) => { const q = P(x, y); if (onScreen(q) && SIM.lampLit(ST, i)) pool(x + (y < 0 ? 40 : -40), y + (y < 0 ? 40 : -40), 210, LAMPC, 0.5 * nAmt * flick(i, 0.3) * relight(i)); });
        festLights(true);
        (SIM.NDECOR || []).forEach(([n, x, y], i) => { if ((n === 'greenhouse' || n === 'shed') && onScreen(P(x, y))) { pool(x, y + 30, n === 'greenhouse' ? 170 : 110, LAMPC, 0.42 * nAmt * flick(i + 7, 0.2)); const g2 = P(x, y, n === 'greenhouse' ? 60 : 70); L.glow(g2[0], g2[1], 60, [1, 0.75, 0.4], 0.35, 2.5); } }); } }

    // ===== lights =====
    festGlows(); festStrings();
    SIM.LAMPS.forEach(([x, y], i) => { const q = P(x, y); if (!onScreen(q) || !SIM.lampLit(ST, i)) return; const [hx, hy] = lampHead(q), k = relight(i);
      L.glow(hx, hy, 70, LAMPC, 0.9 * flick(i, 0.3) * k, 3); L.glow(hx, hy + 60, 190, LAMPC, 0.18 * flick(i, 0.3) * k, 2.2); });
    ALLEYBULBS.forEach(([x, y], i) => { const q = P(x, y, 100); if (!onScreen(q)) return; const f = bulbF(i); L.glow(q[0], q[1], 40, [0.85, 1, 0.75], 0.9 * f, 3); L.glow(q[0] - 40, q[1] + 60, 170, [0.6, 0.8, 0.6], 0.12 * f, 2.2); });
    SIM.HOUSES.forEach((h, i) => { const hs = hsInfo[h.id]; if (hs && !(hs.x > W || hs.x + hs.w < 0 || hs.y > H || hs.y + hs.h < 0)) houseLights(h, hs, i); });
    // projectiles in flight: screen-space arc from the hand to the aimed point (exactly where the cursor was), shadow on the ground track
    ST.proj.forEach((p) => { if (GT < p.t0) return; const u = Math.min(1, (GT - p.t0) / p.dur);
      if (p.kind === 'slipper') { const x = p.x0 + (p.x1 - p.x0) * u, y = p.y0 + (p.y1 - p.y0) * u, z = p.z0 + (p.z1 - p.z0) * u + p.arc * 4 * u * (1 - u), q = P(x, y, z), g = P(x, y);
        L.shadow(g[0], g[1], 10, 4, 0.35); L.solid(q[0] - 14, q[1] - 6, 28, 12, [0.55, 0.15, 0.4], GT * 14, 14, 6); return; }
      if (p.kind === 'negg') { const x = p.x0 + (p.x1 - p.x0) * u, y = p.y0 + (p.y1 - p.y0) * u, z = p.z0 + (p.z1 - p.z0) * u + p.arc * 4 * u * (1 - u), q = P(x, y, z), g = P(x, y);
        L.shadow(g[0], g[1], 9, 3.5, 0.3); L.solid(q[0] - 6, q[1] - 8, 12, 16, [0.97, 0.94, 0.86], GT * 9 + p.seed, 6, 8); return; }
      if (p.kind === 'bb') { if (!MZ.has(p)) MZ.set(p, S.kolLed && ST.gun ? [S.kolLed[0] + cx, S.kolLed[1] + cy] : [p.sx0, p.sy0]); const mz = MZ.get(p);   // from the rifle's muzzle
        const q = [mz[0] + (p.sx1 - mz[0]) * u - cx, mz[1] + (p.sy1 - mz[1]) * u - cy]; L.rrect(q[0] - 3, q[1] - 3, 6, 6, 3, [1, 1, 0.95], [0.85, 0.85, 0.8]); L.glow(q[0], q[1], 10, [1, 1, 0.9], 0.6, 3); return; }
      if (p.kind === 'arrow') { const at3 = (uu) => P(p.x0 + (p.x1 - p.x0) * uu, p.y0 + (p.y1 - p.y0) * uu, p.z0 + (p.z1 - p.z0) * uu + p.arc * 4 * uu * (1 - uu)), q = at3(u), q0 = at3(Math.max(0, u - 0.08)), an = Math.atan2(q[1] - q0[1], q[0] - q0[0]), g = P(p.x0 + (p.x1 - p.x0) * u, p.y0 + (p.y1 - p.y0) * u);
        L.shadow(g[0], g[1], 12, 3, 0.3); L.solid(q[0] - 34, q[1] - 1.5, 34, 3, [0.85, 0.78, 0.6], an, 34, 1.5); L.rrect(q[0] - 5, q[1] - 5, 10, 10, 5, [0.95, 0.2, 0.2], [0.6, 0.08, 0.08]);
        L.solid(q[0] - 40 * Math.cos(an) - 5, q[1] - 40 * Math.sin(an) - 4, 10, 8, [0.3, 0.9, 0.6], an, 5, 4); return; }
      const at = (uu) => [p.sx0 + (p.sx1 - p.sx0) * uu - cx, p.sy0 + (p.sy1 - p.sy0) * uu - p.arc * 4 * uu * (1 - uu) - cy], q = at(u), g = P(p.gx0 + (p.gx1 - p.gx0) * u, p.gy0 + (p.gy1 - p.gy0) * u);
      L.shadow(g[0], g[1], 10, 4, 0.3);
      if (p.kind === 'eggs') { L.solid(q[0] - 6, q[1] - 8, 12, 16, [0.97, 0.94, 0.86], GT * 9 + p.seed, 6, 8); L.rrect(q[0] - 2, q[1] - 5, 4, 4, 2, [1, 1, 1], [1, 1, 1], 0.8); }
      if (p.kind === 'firec') { L.solid(q[0] - 12, q[1] - 4, 24, 8, [0.85, 0.1, 0.08], GT * 11 + p.seed, 12, 4); L.star(q[0] + 10 * Math.cos(GT * 11), q[1] + 10 * Math.sin(GT * 11), 14, [1, 0.85, 0.3], 0.9); }
      if (p.kind === 'tp') { for (let j = 1; j < 10; j++) { const uu = Math.max(0, u - j * 0.028), qq = at(uu); L.rrect(qq[0] - 4, qq[1] - 4 + Math.sin(T * 20 + j) * 3, 8, 8, 3, [0.96, 0.95, 0.92], [0.85, 0.85, 0.8], 1 - j / 11); }
        L.solid(q[0] - 10, q[1] - 10, 20, 20, [1, 1, 0.97], GT * 12, 10, 10); L.rrect(q[0] - 3, q[1] - 3, 6, 6, 3, [0.5, 0.45, 0.4], [0.4, 0.35, 0.3]); } });
    // firecracker fuse (v9: anywhere)
    (ST.fires || []).forEach((F) => { const q = P(F.x, F.y, 6); L.rrect(q[0] - 14, q[1] - 10, 28, 12, 3, [0.8, 0.1, 0.08], [0.5, 0.05, 0.04]); for (let j = 0; j < 4; j++) L.star(q[0] + 10 + 8 * L.rnd(GT * 30 | 0, j) - 4, q[1] - 14 - 10 * L.rnd(j, GT * 30 | 0), 14, [1, 0.8, 0.3], 0.9);
      const left = Math.max(0, F.fuse - (GT - F.t0)); if (left < 1.2) L.glow(q[0], q[1] - 8, 30 + 20 * Math.sin(GT * 30), [1, 0.5, 0.1], 0.6, 3); });
    MD.forEach(([id, k]) => { const F = k.fire; if (!F || F.done) return; const q = P(F.x, F.y, 6); L.rrect(q[0] - 14, q[1] - 10, 28, 12, 3, [0.8, 0.1, 0.08], [0.5, 0.05, 0.04]); for (let j = 0; j < 4; j++) L.star(q[0] + 10 + 8 * L.rnd(GT * 30 | 0, j) - 4, q[1] - 14 - 10 * L.rnd(j, GT * 30 | 0), 14, [1, 0.8, 0.3], 0.9); });
    // event FX
    for (const e of ev) { const a = GT - e.t; if (a < 0) continue;
      if (e.k === 'step' && a < 0.5) { const q = P(e.x, e.y), u = a / 0.5, fx = q[0] + (e.foot ? 8 : -8);
        if (RAIN > 0.15) { L.ring(fx, q[1] - 2, 8 + 26 * u, 4 + 12 * u, [0.7, 0.78, 0.9], 0.55 * (1 - u) * RAIN, 0.14);          // v10: a splash in the puddles
          if (a < 0.3) for (let j = 0; j < 5; j++) { const an = -Math.PI * (0.15 + 0.7 * L.rnd(e.t * 7, j)), v = 40 + 50 * L.rnd(j, e.t * 3); L.rrect(fx + Math.cos(an) * v * a - 1.5, q[1] - 4 + Math.sin(an) * v * a + 260 * a * a - 1.5, 3, 3, 1.5, [0.75, 0.82, 0.95], [0.5, 0.6, 0.75], (1 - a / 0.3) * RAIN); } }
        else L.puff(fx, q[1] - 3 - 6 * u, 5 + 7 * u, [0.35, 0.27, 0.24], 0.25 * (1 - u), e.t * 9); }
      if (e.k === 'splat' && a < 0.5 && e.sx !== undefined) { const q = [e.sx - cx, e.sy - cy], u = a / 0.5; for (let j = 0; j < 7; j++) { const an = j / 7 * 6.28 + e.t, d = 10 + 40 * u; L.puff(q[0] + Math.cos(an) * d, q[1] + Math.sin(an) * d * 0.7 + 30 * u * u, 6 * (1 - u) + 2, [1, 0.85, 0.3], 1 - u, j + e.t); } }
      if (e.k === 'tpland' && a < 0.6 && e.sx !== undefined) { const q = [e.sx - cx, e.sy - cy], u = a / 0.6; L.ring(q[0], q[1], 20 + 40 * u, 12 + 20 * u, [1, 1, 0.95], 1 - u); }
      if (e.k === 'pile' && a < 1.2) { const q = P(e.x, e.y), u = a / 1.2; for (let j = 0; j < 14; j++) { const s = L.rnd(e.i, j), an = -Math.PI * (0.15 + 0.7 * s), v = 120 + 160 * L.rnd(j, e.i);
        const X = q[0] + Math.cos(an) * v * a + 30 * Math.sin(a * 6 + j), Y = q[1] - 20 + Math.sin(an) * v * a + 260 * a * a; L.rrect(X - 5, Y - 3, 10, 6, 2, [0.85, 0.35 + 0.2 * s, 0.08], [0.6, 0.2, 0.05], 1 - u); } }
      if (e.k === 'coin' && a < 1.3) { const q = P(e.x, e.y, 90 + 70 * a), u = a / 1.3; L.label('coin' + (Math.round(e.t * 120) % 8), '+' + e.amt + ' ₽', q[0], q[1], { size: 30, col: '#ffd76a', out: '#3a1606', al: 0.5, a: 1 - u * u }); L.star(q[0] - 30, q[1], 18, [1, 0.9, 0.5], 1 - u); }
      if (e.k === 'bang' && a < 1.6) { const q = P(e.x, e.y, 10), u = a / 1.6; if (a < 0.25) { L.glow(q[0], q[1], 420, [1, 0.8, 0.5], 1.6 * (1 - a / 0.25), 2); }
        for (let j = 0; j < 9; j++) L.puff(q[0] + (L.rnd(e.t, j) - 0.5) * 160 * (0.4 + u), q[1] - 40 - 120 * u * L.rnd(j, e.t), 40 + 60 * u, [0.32, 0.3, 0.32], 0.7 * (1 - u), j + 3);
        for (let j = 0; j < 16; j++) { const an = j / 16 * 6.28, d = 30 + 260 * Math.min(1, a / 0.4); if (a < 0.5) L.star(q[0] + Math.cos(an) * d, q[1] + Math.sin(an) * d * 0.6 - 30, 18, [1, 0.75, 0.3], 1 - a / 0.5); }
        L.ring(q[0], q[1], 60 + 380 * u, 30 + 190 * u, [1, 0.85, 0.6], (1 - u) * 0.8); }
      if (e.k === 'hide' && a < 0.6) { const q = P(e.x, e.y); for (let j = 0; j < 6; j++) L.rrect(q[0] + (L.rnd(e.t, j) - 0.5) * 80, q[1] - 50 - 60 * a + 100 * a * a + j * 4, 8, 5, 2, [0.6, 0.25, 0.08], [0.4, 0.15, 0.05], 1 - a / 0.6); }
      if (e.k === 'bbhit' && a < 0.25 && e.sx !== undefined) { const q = [e.sx - cx, e.sy - cy], u = a / 0.25; for (let j = 0; j < 5; j++) { const an = j * 1.26 + e.t * 7; L.rrect(q[0] + Math.cos(an) * 14 * u - 1.5, q[1] + Math.sin(an) * 10 * u - 1.5, 3, 3, 1.5, [1, 0.95, 0.7], [1, 0.8, 0.4], 1 - u); } }
      if (e.k === 'ouch' && a < 0.7) { const q = P(e.x, e.y, 120 + 30 * a), u = a / 0.7; L.star(q[0] - 14, q[1], 20, [1, 0.85, 0.3], 1 - u); L.star(q[0] + 16, q[1] - 8, 16, [1, 0.6, 0.3], 1 - u); }
      if (e.k === 'clickmark' && a < 0.45) { const q = P(e.x, e.y), u = a / 0.45; L.ring(q[0], q[1], 30 * (1 - u * 0.4), 15 * (1 - u * 0.4), [1, 0.75, 0.3], 1 - u, 0.15); }
      if (e.k === 'flash' && a < 0.5) { const q = P(e.x, e.y, 120), u = a / 0.5; L.glow(q[0], q[1], 160 + 300 * u, [1, 1, 1], 2.2 * (1 - u), 2); }
      if (e.k === 'spotted' && a < 1.6) { const hs = hsInfo[e.id || 'kirill']; if (hs) { const w = e.id === 'raiva' ? camPt(hs) : e.id === 'elf' ? floodPt(hs) : winPt(hs); L.label('excl', '!', w[0], w[1] - 70 - 10 * Math.sin(a * 12), { size: 70, col: '#ff4030', out: '#300000', al: 0.5, a: 1 - a / 1.6 }); } }
      if (e.k === 'housedone' && a < 4) { const q = P(e.x, e.y, 200); for (let j = 0; j < 30; j++) { const s = L.rnd(e.t, j), X = q[0] + (s - 0.5) * 900, Y = q[1] - 200 + 500 * a * (0.5 + L.rnd(j, 2)) - 120 * a; L.rrect(X, Y, 10, 6, 2, [1, 0.5 + 0.4 * s, 0.15], [0.8, 0.3, 0.1], 1 - a / 4); } }
      if (e.k === 'candy' && a < 2) { const q = P(e.x, e.y, 120); for (let j = 0; j < 10; j++) L.star(q[0] + Math.cos(j + a * 3) * 80 * a, q[1] - 60 * a + Math.sin(j) * 40, 20, [1, 0.6, 0.9], 1 - a / 2); }
      if (e.k === 'alarm' && a < 4) { const q = P(e.x, e.y, 90); L.ring(q[0], q[1], 30 + 60 * (a % 0.5) * 2, 18 + 36 * (a % 0.5) * 2, [1, 0.9, 0.6], 0.8 * (1 - (a % 0.5) * 2)); L.label('dzyn', 'ДЗЫНЬ!!', q[0] + 40, q[1] - 30 + 4 * Math.sin(a * 40), { size: 30, col: '#fff1c0', out: '#401500', al: 0, a: 1 - a / 4 }); }
      if (e.k === 'lampbreak' && a < 1.2) { const q = P(e.x, e.y), hd = lampHead(q); if (a < 0.15) L.glow(hd[0], hd[1], 120, [1, 0.9, 0.7], 2 * (1 - a / 0.15), 2.5);
        for (let j = 0; j < 10; j++) { const vx = (L.rnd(e.i, j) - 0.5) * 160, X = hd[0] + vx * a, Y = hd[1] + 40 * a + 520 * a * a * (0.6 + 0.4 * L.rnd(j, e.i)); if (Y < q[1] + 6) L.rrect(X - 2, Y - 2, 4, 4, 1, [0.85, 0.95, 1], [0.6, 0.7, 0.8], 1 - a / 1.2); } }
      if (e.k === 'binkick' && a < 1) { const q = P(e.x, e.y), u = a; for (let j = 0; j < 8; j++) L.puff(q[0] - 20 + (L.rnd(e.i, j) - 0.5) * 120 * (0.4 + u), q[1] - 20 - 50 * u * L.rnd(j, 3), 20 + 30 * u, [0.35, 0.3, 0.28], 0.5 * (1 - u), j); }
      if (e.k === 'purr' && a < 2.2) { const q = P(e.x, e.y, 40); for (let j = 0; j < 4; j++) { const aa = a - j * 0.35; if (aa < 0 || aa > 1.4) continue; L.label('heart' + j, '♥', q[0] + 18 * Math.sin(aa * 5 + j), q[1] - 60 * aa, { size: 22, col: '#ff7aa8', out: '#300010', al: 0.5, a: 1 - aa / 1.4 }); } }
      if (e.k === 'hiss' && a < 1.4) { const q = P(e.x, e.y, 50); L.label('hiss', 'Ш-Ш-Ш!', q[0], q[1] - 10 * a, { size: 22, col: '#c8ff8a', out: '#102000', al: 0.5, a: 1 - a / 1.4 }); }
      if (e.k === 'angry' && a < 0.8) { const q = P(e.x, e.y, 120); L.puff(q[0], q[1], 30 + 30 * a, [0.9, 0.2, 0.15], 0.5 * (1 - a / 0.8), 7); }
      if (e.k === 'putdown' && a < 0.5) { const q = P(e.x, e.y), u = a / 0.5; for (let j = 0; j < 5; j++) L.puff(q[0] + (j - 2) * 12 * (1 + u), q[1] - 4 - 10 * u, 8 + 10 * u, [0.35, 0.28, 0.24], 0.35 * (1 - u), j); }
      if (e.k === 'costume' && a < 0.9) { const q = P(e.x, e.y, 60), u = a / 0.9; for (let j = 0; j < 10; j++) { const an = j / 10 * 6.28 + e.t; L.puff(q[0] + Math.cos(an) * 50 * (0.3 + u), q[1] + Math.sin(an) * 30 * (0.3 + u) - 30 * u, 22 + 20 * u, [0.92, 0.9, 0.95], 0.75 * (1 - u), j + 11); }
        if (a < 0.5) for (let j = 0; j < 5; j++) L.star(q[0] + (L.rnd(e.t, j) - 0.5) * 120, q[1] - 40 - 60 * L.rnd(j, e.t), 18, [1, 0.85, 0.5], 1 - a / 0.5); }
      if (e.k === 'slime' && a < 1) { const q = P(e.x + 20, SIM.FACADE, 60); L.glow(q[0], q[1], 60, [0.3, 1, 0.3], 0.8 * (1 - a), 3); } }
    Object.keys(ST.hslime || {}).forEach((id) => { const h = SIM.HOUSES.find((q2) => q2.id === id); if (!h) return; const q = P(h.door[0] + 22, SIM.FACADE + 2, 58); ell(L.P.puff, q[0], q[1], 12, 16, { u_col: [0.35, 0.95, 0.3], u_amt: 0.95, u_seed: 5 }); });
    MD.forEach(([id, k, h]) => { if (!k.slime) return; const q = P(h.door[0] + 22, SIM.FACADE + 2, 58); ell(L.P.puff, q[0], q[1], 12, 16, { u_col: [0.35, 0.95, 0.3], u_amt: 0.95, u_seed: 4 }); L.glow(q[0], q[1], 30, [0.3, 1, 0.3], 0.25, 3); });
    // the flash of Raiva's ring light blinds the whole screen for a moment
    { const fl = ev.find((e) => e.k === 'flash' && GT - e.t < 0.45 && GT >= e.t); if (fl) S.flashA = 1 - (GT - fl.t) / 0.45; else S.flashA = 0; }
    // darkness in the alley and the end lot, cut by the flashlight
    const ho = S.kolLed || P(ST.x, ST.y, 62); let dir = [Math.cos(ST.ang || 0), Math.sin(ST.ang || 0)];
    { const l = Math.hypot(dir[0], dir[1]) || 1; dir = [dir[0] / l, dir[1] / l]; }
    S.light = { o: ho, d: dir };
    SIM.DARK.forEach((r) => { const o = P(r[0] - 150, r[1] - 120), w = r[2] - r[0] + 300, h = r[3] - r[1] + 200;
      G.draw(L.P.dark, { u_o: ho, u_d: dir, u_on: ST.light ? 1 : 0, u_amt: 0.6 }, mat3([C * w, -SN * w, C * h, SN * h, o[0], o[1]])); });
    if (ST.light) { G.blend('add'); G.draw(L.P.cone, { u_o: ho, u_d: dir, u_amt: 0.45, u_col: [1, 0.93, 0.78] }, G.xf(ho[0] - 680, ho[1] - 680, 1360, 1360)); G.blend(); }   // only the cone's reach, not the whole screen
    // the raid: flashlight beams (police torches, soldiers' weapon lights) — what they light up is what they see
    if (ST.raid && ST.raid.units.length) { G.blend('add'); ST.raid.units.forEach((u) => { if (!S.raidHeads[u.i]) return; const b = SIM.raidBeam(u), o = [b.o[0] - cx, b.o[1] - cy], len = SIM.RAID.BEAM.len;
      G.draw(L.P.beam, { u_o: o, u_d: b.d, u_amt: u.st === 'chase' ? 0.55 : 0.36, u_len: len, u_cos: SIM.RAID.BEAM.cos, u_col: u.kind === 'police' ? [1, 0.95, 0.8] : [0.85, 0.95, 1] }, G.xf(o[0] - len, o[1] - len, 2 * len, 2 * len)); }); G.blend(); }
    // falling leaves (world-anchored, wind-driven, deterministic)
    for (let i = 0; i < 46; i++) { const per = 9 + 5 * L.rnd(i, 3), ph = (T / per + L.rnd(i, 1)) % 1, k = Math.floor(T / per + L.rnd(i, 1));
      const X = ((L.rnd(i, 5 + k) * (W + 400)) - 200 + 140 * SIM.windAt(T, i * 300) * ph * 3 + 40 * Math.sin(T * 1.7 + i)), Y = -60 + ph * (H + 120);
      const s = 0.6 + 0.6 * L.rnd(i, 2), a = Math.sin(ph * Math.PI); L.solid(X, Y, 9 * s, 5 * s, [0.75, 0.32 + 0.2 * L.rnd(i, 7), 0.07], T * (2 + L.rnd(i, 9)) + i, 4.5 * s, 2.5 * s, 0.85 * a); }
    L.finish(t, { bloom: [0.3, 0.26], vignette: 0.84, warm: 0.5, roll: 1, dither: 1 });
    if (S.flashA > 0) G.draw(L.P.solid, { u_col: [1, 1, 1], u_a: 0.85 * S.flashA * S.flashA }, G.xf(0, 0, W, H));
    { const ar = ev.find((e) => e.k === 'arrest' && GT - e.t < 2.2 && GT >= e.t); if (ar) { const a = GT - ar.t, k = a < 0.25 ? a / 0.25 : a < 1.4 ? 1 : 1 - (a - 1.4) / 0.8;
      G.draw(L.P.solid, { u_col: [0.01, 0.0, 0.02], u_a: 0.92 * k }, G.xf(0, 0, W, H)); S.arrestA = k; } else S.arrestA = 0; }
    if (ST.hp > 0) { const hu = ev.find((e) => e.k === 'hurt' && GT - e.t < 0.5); if (hu) { const a = 1 - (GT - hu.t) / 0.5; G.draw(L.P.solid, { u_col: [0.6, 0.02, 0.02], u_a: 0.25 * a }, G.xf(0, 0, W, H)); } }
    else { const a = Math.min(0.7, (GT - (ST.koT || GT)) / 2); G.draw(L.P.solid, { u_col: [0, 0, 0], u_a: a }, G.xf(0, 0, W, H)); }

    // v10 rain: splashes and lit puddles, then the slanted streaks over everything; lightning flashes the whole street
    if (RAIN > 0.003) { L.rain(GT, RAIN * 1.4, [cx, cy], 'fx', { mask: noMask() }); L.rain(GT, RAIN * 1.5, [cx, cy], 'sky', { wind: 0.16 }); }
    for (const e of ev) { if (e.k !== 'lightning') continue; const a = GT - e.t; if (a < 0 || a > 0.6) continue;
      const f = (a < 0.07 ? 1 : a < 0.14 ? 0.25 : a < 0.24 ? 0.8 : Math.max(0, 1 - (a - 0.24) / 0.36) * 0.5) * (e.near ? 1 : 0.55);
      G.blend('add'); L.solid(0, 0, W, H, [0.55, 0.6, 0.8], 0, 0, 0, 0.55 * f); G.blend(); }
    // ===== world-space UI (bubbles, prompts) =====
    behindMark();
    bubbles(); festBubbles();
    hud();
  };
  let NOMASK = null; const noMask = () => { if (!NOMASK) { const cv = document.createElement('canvas'); cv.width = cv.height = 2; G.canvasTex('rain_nomask', cv, { mip: false }); NOMASK = 1; } return G.tex('rain_nomask'); };
  // v10: behind a house the roof hides Kolya completely (the house art is not see-through) — a small chevron over the roof says where he is
  function behindMark() { if (ST.finale || ST.hidden) return; const cov = (z) => { const c = [C * (ST.x + ST.y), SN * (ST.y - ST.x) - z];
      return SIM.HOUSES.some((h) => ((ST.y < h.y0 + 30 && ST.x > h.x0 - 60) || (ST.x > h.x1 - 30 && ST.y < h.y1)) && SIM.maskHit(SIM.houseRect(h), c)); };
    if (!(cov(25) && cov(70) && cov(115))) return; const q = P(ST.x, ST.y, 150), b = 4 * Math.sin(GT * 5);
    L.label('behindmk', '▼', q[0], q[1] + b, { size: 30, col: '#ffb45a', out: '#2a0a02', al: 0.5, a: 0.75 }); }
  // a lamp that was shot out comes back after 90 s with a stutter
  const relight = (i) => { const b = ST.blackout; if (b) { const a2 = GT - b.end; if (a2 >= 0 && a2 < 1.3) return Math.sin(a2 * 41 + i * 2.3) > 0 ? 1 : 0.12; }     // v10: the power comes back with a stutter
    const o = ST.lampOff && ST.lampOff[i]; if (o === undefined) return 1; const a = GT - o - 90; return a < 0 || a > 1.5 ? 1 : (Math.sin(a * 37) > 0.2 ? 1 : 0.15); };
  const vis0 = (x, y, m = 500) => onScreen(P(x, y), m);
  // a tree is drawn up from its foot: visible only while the foot is below the top edge and less than a tree height under the bottom
  const visTree = (x, y, s) => { const q = P(x, y); return q[0] > -260 * s && q[0] < W + 260 * s && q[1] > -20 && q[1] < H + 580 * s; };
  // stunned by a firecracker: stars circling the head
  function dizzy(hd, seed) { if (!hd) return; for (let k = 0; k < 3; k++) { const an = GT * 6 + k * 2.1 + seed; L.star(hd[0] + Math.cos(an) * 22, hd[1] - 10 + Math.sin(an) * 7, 15, [1, 0.9, 0.35], 0.95); } }
  function kolyaOverlays(q, hd) { if (!hd || ST.hidden) return;
    if (GT - (ST.eggd || -99) < 10) markAt({ k: 'egg', t: ST.eggd, s: 11, x: ST.x }, hd[0] + 4, hd[1] + 34, 0.42, true);
    if ((ST.wrapT || -99) > GT) { const f = Math.min(1, ((ST.wrapT || 0) - GT) / 0.3); for (let k = 0; k < 5; k++) { const y = hd[1] + 22 + k * 19, w = 46 - Math.abs(k - 2) * 4;
        L.solid(q[0] - w / 2, y, w, 9, [0.97, 0.96, 0.92], 0.18 * (k % 2 ? 1 : -1), w / 2, 4.5, 0.95 * f); }
      L.solid(q[0] + 16, hd[1] + 60, 22, 7, [0.95, 0.94, 0.9], 0.6 + 0.3 * Math.sin(GT * 9), 0, 3.5, f); }
    if ((ST.sugarT || -99) > GT && Math.hypot(ST.vx, ST.vy) > 40) for (let k = 0; k < 2; k++) { const ph = (GT * 3 + k * 0.5) % 1; L.star(q[0] + (k ? 14 : -14), q[1] - 6 - 30 * ph, 12, [1, 0.6, 0.9], 1 - ph); } }
  // an alarm clock on the ground (a decoy): it shakes while it rings
  function alarmClock(d) { const q = P(d.x, d.y), ring = d.rang && GT < d.end, dx = ring ? 2.5 * Math.sin(GT * 70) : 0; L.shadow(q[0], q[1], 14, 5, 0.4);
    L.rrect(q[0] - 9 + dx, q[1] - 22, 18, 18, 9, [0.9, 0.15, 0.1], [0.55, 0.06, 0.05]); L.rrect(q[0] - 6 + dx, q[1] - 19, 12, 12, 6, [0.98, 0.95, 0.88], [0.85, 0.82, 0.75]);
    L.rrect(q[0] - 11 + dx, q[1] - 27, 7, 7, 3.5, [0.95, 0.8, 0.3], [0.7, 0.5, 0.15]); L.rrect(q[0] + 4 + dx, q[1] - 27, 7, 7, 3.5, [0.95, 0.8, 0.3], [0.7, 0.5, 0.15]);
    if (!d.rang) { const left = Math.max(0, d.ring - GT); if (left < 2 && Math.floor(GT * 6) % 2) L.glow(q[0], q[1] - 14, 16, [1, 0.3, 0.2], 0.6, 3); } }
  // Vera's candy bowl on her path (fewer sweets each time)
  function candyBowl() { const q = P(SIM.BOWL[0], SIM.BOWL[1]), b = ST.bowl || { n: 0 }, left = GT - (b.t || -99) > 120 ? 6 : Math.max(0, 6 - 2 * (b.n || 0)); L.shadow(q[0], q[1], 26, 9, 0.45);
    for (let j = 0; j < left; j++) L.rrect(q[0] - 15 + (j % 3) * 10 + (j > 2 ? 5 : 0), q[1] - 24 - (j > 2 ? 4 : 0), 8, 6, 3, [[1, 0.4, 0.6], [0.4, 0.8, 1], [1, 0.85, 0.2], [0.6, 1, 0.4], [1, 0.55, 0.15], [0.8, 0.5, 1]][j], [0.4, 0.2, 0.2]);
    L.rrect(q[0] - 22, q[1] - 22, 44, 18, 9, [0.95, 0.5, 0.12], [0.55, 0.22, 0.05]); L.rrect(q[0] - 20, q[1] - 22, 40, 5, 2.5, [1, 0.7, 0.3], [0.8, 0.45, 0.15]);
    L.glow(q[0], q[1] - 14, 34, WARM, 0.15, 3); }
  // the black cat (procedural): walks, sits, follows; eyes glow in the dark
  function drawCat(c) { const q = P(c.x, c.y), f = Math.cos(c.ang || 0) >= 0 ? 1 : -1, mv = c.mv > 0, ph = (c.gph || 0) * Math.PI * 2, dark = [0.06, 0.05, 0.07], dk2 = [0.02, 0.02, 0.03];
    L.shadow(q[0], q[1], 24, 7, 0.45);
    if (mv) { for (let k = 0; k < 4; k++) { const lx = q[0] + (k < 2 ? 11 : -11) * f + (k % 2 ? 4 : -4), sw = Math.sin(ph + (k === 0 || k === 3 ? 0 : Math.PI)) * 4; L.rrect(lx + sw * f - 2, q[1] - 12, 4, 12, 2, dark, dk2); }
      L.rrect(q[0] - 19, q[1] - 26, 38, 15, 7.5, dark, dk2);
      for (let k = 0; k < 6; k++) L.rrect(q[0] - f * (19 + k * 3.5) - 2.5, q[1] - 22 - k * 4.5 + Math.sin(GT * 5 + k * 0.7) * 2, 5, 5, 2.5, dark, dk2);
      const hx = q[0] + f * 19; L.rrect(hx - 9, q[1] - 36, 18, 15, 7, dark, dk2); L.solid(hx - 8, q[1] - 39, 6, 6, dark, 0.785, 3, 3); L.solid(hx + 2, q[1] - 39, 6, 6, dark, 0.785, 3, 3);
      L.glow(hx + f * 4, q[1] - 30, 6, [0.8, 1, 0.3], 0.8, 3); L.rrect(hx + f * 4 - 1.5, q[1] - 31.5, 3, 3, 1.5, [0.85, 1, 0.35], [0.6, 0.8, 0.2]); }
    else { L.rrect(q[0] - 12, q[1] - 30, 24, 28, 11, dark, dk2); for (let k = 0; k < 7; k++) L.rrect(q[0] - f * (8 - k * 3) - 2.5, q[1] - 5 + Math.sin(GT * 2 + k * 0.6) * 1.2, 5, 5, 2.5, dark, dk2);
      const hx = q[0] + f * 3; L.rrect(hx - 9, q[1] - 44, 18, 16, 7, dark, dk2); L.solid(hx - 8, q[1] - 47, 6, 6, dark, 0.785, 3, 3); L.solid(hx + 2, q[1] - 47, 6, 6, dark, 0.785, 3, 3);
      const bl = Math.sin(GT * 0.9 + c.x) > 0.97 ? 0.2 : 1; for (const ex of [-4, 4]) { L.glow(hx + ex, q[1] - 38, 6, [0.8, 1, 0.3], 0.7 * bl, 3); L.rrect(hx + ex - 1.5, q[1] - 39.5, 3, 3 * bl, 1.5, [0.85, 1, 0.35], [0.6, 0.8, 0.2]); } } }
  function SCENE_KIR_ARMS() { const sayE = [...ST.ev].reverse().find((e) => e.k === 'say' && e.who === 'kirill' && GT - e.t < e.dur); if (!sayE) return null;
    const a = GT - sayE.t, w = Math.sin(a * 9) * 0.15; return { L: [-0.55, -0.55 + w], R: [0.2, 0.95] }; }
  // Kirill's own painted jack-o'-lantern: after the swap the rotten one sits over it (fraction of the house sprite)
  function porchPumpkin(hs) { const K = ST.kir; if (!hs) return; const X = hs.x + 0.752 * hs.w, Y = hs.y + 0.765 * hs.h;
    if (K.swapped && has('rotten')) { const hh = 70, w = L.hsz('rotten', hh); L.sprite('rotten', X - w / 2, Y - hh * 0.8, { w, h: hh }); for (let j = 0; j < 3; j++) { const an = T * (5 + j) + j * 2; L.rrect(X + Math.cos(an) * 26 - 1.5, Y - hh + Math.sin(an * 1.3) * 10, 3, 3, 1.5, [0.05, 0.05, 0.05], [0.05, 0.05, 0.05]); } }
    else L.glow(X, Y - 10, 50, WARM, 0.3 * flick(3), 3); }
  function litBy(x, y) { if (!ST.light || !S.light) return false; const q = P(x, y), o = S.light.o, d = S.light.d, dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy); return l < 600 && (dx * d[0] + dy * d[1]) / (l || 1) > 0.82; }
  function winPt(hs) { return [hs.x + 0.532 * hs.w, hs.y + 0.70 * hs.h]; }
  // Raiva: porch camera (red REC light while recording), a LIVE sign in the stream room window, the porch jack-o'-lantern (or the rotten swap)
  const camPt = (hs) => [hs.x + 0.553 * hs.w, hs.y + 0.605 * hs.h];
  function raivaPorch(hs) { if (!hs || hs.x > W + 50 || hs.x + hs.w < -50 || hs.y > H + 50 || hs.y + hs.h < -50) return; const inV = (q, m = 60) => q[0] > m && q[0] < W - m && q[1] > 30 && q[1] < H - 30; const R = ST.rai, rec = SIM.raivaCamT(GT), on = rec >= 0, c = camPt(hs), blink = on && Math.floor(GT * 4) % 2 === 0;
    const pan = Math.sin(GT * 0.9) * 0.35;
    L.solid(c[0] - 2, c[1] - 16, 4, 16, [0.12, 0.11, 0.12]); L.solid(c[0] - 13, c[1] - 7, 26, 15, [0.16, 0.15, 0.17], pan * 0.3, 13, 7); L.rrect(c[0] - 18 + pan * 6, c[1] - 4, 9, 9, 4.5, [0.05, 0.05, 0.08], [0.2, 0.25, 0.35]);
    L.rrect(c[0] + 6, c[1] - 5, 5, 5, 2.5, on ? [1, 0.15, 0.1] : [0.3, 0.08, 0.06], on ? [1, 0.3, 0.2] : [0.2, 0.05, 0.05]);
    if (on) { L.glow(c[0] + 8, c[1] - 2, 18, [1, 0.15, 0.1], blink ? 0.9 : 0.5, 3); if (inV(c)) L.label('rvrec', '● REC', c[0] + 18, c[1] - 22, { size: 16, col: '#ff4a3a', out: '#200000', a: blink ? 1 : 0.6 });
      const g = P(SIM.HR.door[0] - 140 + 160 * Math.sin(GT * 0.9), SIM.FACADE + 120); glowE(g[0], g[1], 190, 95, [1, 0.12, 0.08], 0.5, 1.8); }
    const lv = [hs.x + 0.79 * hs.w, hs.y + 0.555 * hs.h], pulse = 0.6 + 0.4 * Math.sin(GT * 3);
    L.glow(lv[0], lv[1] + 40, 70, [0.3, 1, 0.55], 0.22 * pulse, 3); L.rrect(lv[0] - 28, lv[1] - 10, 56, 18, 4, [0.02, 0.12, 0.06], [0.01, 0.06, 0.03], 0.92);
    for (let k = 0; k < 6; k++) L.rrect(lv[0] - 24 + k * 9, lv[1] + 12, 4, 3, 1, (Math.floor(GT * (3 + k)) + k) % 3 ? [0.2, 1, 0.4] : [1, 0.6, 0.1], [0.1, 0.5, 0.2], 0.9);
    if (inV(lv)) L.label('rvlive', '>_ root' + (Math.floor(GT * 2) % 2 ? '█' : ' '), lv[0] - 22, lv[1] - 1, { size: 12, col: '#5aff8a', out: null, al: 0, a: 0.75 + 0.25 * pulse });
    const X = hs.x + 0.582 * hs.w, Y = hs.y + 0.857 * hs.h;
    if (R.swapped && has('rotten')) { const hh = 64, w = L.hsz('rotten', hh); L.sprite('rotten', X - w / 2, Y - hh * 0.85, { w, h: hh }); for (let j = 0; j < 3; j++) { const an = T * (5 + j) + j * 2; L.rrect(X + Math.cos(an) * 24 - 1.5, Y - hh + Math.sin(an * 1.3) * 10, 3, 3, 1.5, [0.05, 0.05, 0.05], [0.05, 0.05, 0.05]); } }
    else L.glow(X, Y - 18, 46, WARM, 0.3 * flick(5), 3); }
  // Raiva at the door: pose frames (rf_se_act): 0 idle, 1 arms crossed, 2 talking, 3 streaming, 4 angry, 5 laughing, 6 facepalm, 7 waving
  function drawRaiva(x, y) { const q = P(x, y), R = ST.rai, now = (k, d) => [...ST.ev].reverse().find((e) => e.k === k && GT - e.t < d && GT >= e.t);
    const sayE = [...ST.ev].reverse().find((e) => e.k === 'say' && e.who === 'raiva' && GT - e.t < e.dur && GT >= e.t);
    let i = R.refused ? 1 : 0;
    if (R.sweet) i = GT % 4 < 2 ? 5 : 7; else if (now('flash', 1.4)) i = 3; else if (now('bang', 4) || now('alarm', 4)) i = GT % 1.6 < 0.8 ? 4 : 6;
    else if (sayE) i = /📹|📸|камер|лог/.test(sayE.text) ? 3 : (Math.floor((GT - sayE.t) * 2.5) % 3 === 2 ? 0 : 2);
    L.shadow(q[0], q[1], 30, 11, 0.5);
    const r = atlasFrame('rf_se_act', i, q[0], q[1] + 4, false, { alpha: 1, tint: [1, 1, 1, 0], rim: [0.3, -0.004, -0.004, 1], rimCol: [1, 0.7, 0.4] }, 1, 120);
    return r ? r.head : [q[0], q[1] - 120]; }
  // Elf: a floodlight with a motion sensor over the porch; the light flares when Kolya moves in her yard
  const floodPt = (hs) => [hs.x + 0.665 * hs.w, hs.y + 0.565 * hs.h];
  function elfPorch(hs) { if (!hs || hs.x > W + 50 || hs.x + hs.w < -50 || hs.y > H + 50 || hs.y + hs.h < -50) return; const E = ST.elf, on = E.lit >= 0, f = floodPt(hs), sn = [hs.x + 0.62 * hs.w, hs.y + 0.588 * hs.h];
    L.solid(f[0] - 2, f[1] - 4, 4, 12, [0.15, 0.15, 0.17]); L.solid(f[0] - 15, f[1] + 2, 30, 14, [0.2, 0.2, 0.23], -0.25, 15, 7); L.rrect(f[0] - 12, f[1] + 6, 24, 8, 3, on ? [1, 1, 0.95] : [0.35, 0.37, 0.42], on ? [0.9, 0.95, 1] : [0.2, 0.22, 0.25]);
    L.rrect(sn[0] - 7, sn[1] - 6, 14, 12, 6, [0.85, 0.85, 0.88], [0.55, 0.55, 0.6]); const arm = E.arm >= 0 || on, bl = Math.floor(GT * 2) % 2 === 0;
    L.rrect(sn[0] - 2.5, sn[1] - 2, 5, 5, 2.5, arm ? [1, 0.15, 0.1] : bl ? [0.6, 0.1, 0.08] : [0.25, 0.06, 0.05], [0.4, 0.05, 0.05]);
    if (arm || bl) L.glow(sn[0], sn[1], 10, [1, 0.15, 0.1], arm ? 0.9 : 0.4, 3);
    if (on) { const k = Math.min(1, (GT - E.lit) / 0.12); L.glow(f[0], f[1] + 10, 120, [0.9, 0.95, 1], 1.3 * k, 2.4); L.glow(f[0], f[1] + 10, 34, [1, 1, 1], 1.4 * k, 3); } }
  // Elf at the door (ef_se_act): 0 idle, 1 arms crossed, 2 talking, 3 typing, 4 angry pointing, 5 tea, 6 shading the eyes, 7 phone call
  function drawElf(x, y) { const q = P(x, y), E = ST.elf, now = (k, d) => [...ST.ev].reverse().find((e) => e.k === k && GT - e.t < d && GT >= e.t);
    const sayE = [...ST.ev].reverse().find((e) => e.k === 'say' && e.who === 'elf' && GT - e.t < e.dur && GT >= e.t);
    let i = E.refused ? 1 : 0;
    if (E.sweet) i = 5; else if (now('elfcall', 8)) i = 7; else if (now('bang', 4) || now('alarm', 4)) i = GT % 1.6 < 0.8 ? 4 : 1;
    else if (sayE) i = /🏹|Стоять/.test(sayE.text) ? 4 : /вижу|шурш|Прожектор/.test(sayE.text) ? 6 : (Math.floor((GT - sayE.t) * 2.5) % 3 === 2 ? 1 : 2);
    else if (E.done >= 0) i = 3;
    L.shadow(q[0], q[1], 30, 11, 0.5);
    const r = atlasFrame('ef_se_act', i, q[0], q[1] + 4, false, { alpha: 1, tint: [1, 1, 1, 0], rim: [0.3, -0.004, -0.004, 1], rimCol: [0.7, 1, 0.9] }, 1, 118);
    return r ? r.head : [q[0], q[1] - 118]; }
  // the raid cars: sprites + their own light bars (positions measured on the sprites), headlights while driving, egg marks
  // light positions (fraction of the sprite) per car sprite: west-facing (car_*) and east-facing (car_*_e, driving in from Kolya's end)
  const CARL = { car_police: { b: [0.453, 0.138], r: [0.558, 0.215], head: [[0.07, 0.6], [0.25, 0.73]], tail: [] },
    car_police_e: { r: [0.42, 0.13], b: [0.535, 0.225], head: [[0.94, 0.245], [0.8, 0.19]], tail: [[0.05, 0.6], [0.265, 0.735]] },
    car_army: { beacon: [0.47, 0.15], head: [[0.05, 0.63], [0.235, 0.75]], tail: [] },
    car_army_e: { beacon: [0.62, 0.115], head: [[0.965, 0.26], [0.83, 0.335]], tail: [[0.03, 0.52], [0.3, 0.71]] } };
  const flashRB = (t, i) => { const p = ((t + i * 0.37) % 0.5) / 0.5; return { r: (p < 0.1 || (p > 0.2 && p < 0.3)) ? 1 : 0, b: ((p > 0.5 && p < 0.6) || (p > 0.7 && p < 0.8)) ? 1 : 0 }; };
  const carTex = (c) => (c.dir > 0 && has(c.tex + '_e') ? c.tex + '_e' : c.tex);
  const carRect = (c) => { const n = carTex(c), q = P(c.x, c.y), ww = 380, hh = ww * ((A[n] && A[n].h) || 480) / ((A[n] && A[n].w) || 720); return { x: q[0] - ww / 2, y: q[1] - hh * 0.6, w: ww, h: hh, q }; };
  function raidCar(c, i) { const n = carTex(c), CL = CARL[n] || CARL[c.tex]; if (!has(n)) return; const R0 = carRect(c), at = (uv) => [R0.x + uv[0] * R0.w, R0.y + uv[1] * R0.h];
    L.shadow(R0.q[0], R0.q[1] + 8, 175, 52, 0.55); L.sprite(n, R0.x, R0.y, { w: R0.w, h: R0.h });
    ST.marks.forEach((m) => { if (m.on === 'rcar' && m.id === i) markAt(m, R0.x + (0.04 + 0.92 * m.u) * R0.w, R0.y + m.v * 0.9 * R0.h, 0.55, true); });
    if (c.tex === 'car_police') { const f = flashRB(GT, i), pb = at(CL.b), pr = at(CL.r);
      L.glow(pb[0], pb[1], 22, [0.3, 0.5, 1], 0.25 + 1.6 * f.b, 3); L.glow(pr[0], pr[1], 22, [1, 0.2, 0.15], 0.25 + 1.6 * f.r, 3);
      if (f.b) L.glow(pb[0], pb[1], 150, [0.15, 0.3, 1], 0.5, 2.2); if (f.r) L.glow(pr[0], pr[1], 150, [1, 0.12, 0.1], 0.5, 2.2); }
    else { const b = at(CL.beacon), rot = (GT * 1.6 + i * 0.3) % 1, f = Math.max(0, Math.cos(rot * 6.283)), side = Math.sin(rot * 6.283);
      L.rrect(b[0] - 7, b[1] - 9, 14, 11, 6, [0.95, 0.6, 0.15], [0.6, 0.3, 0.05], 0.95); L.solid(b[0] - 9, b[1] + 1, 18, 4, [0.12, 0.12, 0.1]);
      L.glow(b[0], b[1] - 4, 20, [1, 0.6, 0.15], 0.5 + 1.2 * f, 3); L.glow(b[0] + side * 60, b[1] + 10, 130, [1, 0.5, 0.1], 0.45 * f, 2.2); }
    if (!c.park) { const fw = c.dir > 0 ? 1 : -1; CL.head.forEach((uv, j) => { const h = at(uv); L.glow(h[0], h[1], 18, [1, 0.95, 0.8], j ? 0.7 : 1.2, 3); glowE(h[0] + 60 * fw, h[1] - (fw > 0 ? 30 : -30), 110, 40, [1, 0.95, 0.8], j ? 0.3 : 0.5, 2.4); });
      CL.tail.forEach((uv) => { const h = at(uv); L.glow(h[0], h[1], 14, [1, 0.15, 0.1], 0.9, 3); }); } }
  // a raid unit: 10-frame atlas per drawn yaw (0, ±45, ±90; the rest mirrored); the yaw bin comes from the sim (hysteresis)
  const U8b = (b) => { let d = ((b % 8) + 8) % 8 * 45; d = ((d + 180) % 360) - 180; let fl = false; if (d > 90) { d = 180 - d; fl = true; } else if (d < -90) { d = -180 - d; fl = true; } return [(d >= 0 ? 'p' : 'm') + Math.abs(d), fl]; };
  function hitOverlay(o, q, hg, seed) { if (!(o.hitT > 0) || GT - o.hitT > 30 || GT < o.hitT || o.hitK === 'bb') return;
    markAt({ k: o.hitK === 'tp' ? 'tp' : 'egg', t: o.hitT, s: seed, x: o.x || 0 }, q[0] + (L.rnd(seed, 1) - 0.5) * 16, q[1] - hg * (o.hitK === 'tp' ? 0.95 : 0.7), o.hitK === 'tp' ? 0.42 : 0.4, false); }
  function drawUnit(u) { const q = P(u.x, u.y), [tag, fl] = U8b(u.d8 === undefined ? 4 : u.d8), n = (u.kind === 'police' ? 'pw_' : 'sw_') + tag + 'w';
    const fi = u.moving ? Math.floor(((u.gph % 1) + 1) % 1 * 8) % 8 : (u.sus > 0.3 && u.st !== 'inspect') || u.st === 'chase' ? 9 : 8;
    L.shadow(q[0], q[1], 30, 11, 0.5);
    const r = atlasFrame(n, fi, q[0], q[1] + 4, fl, { alpha: 1, tint: [1, 1, 1, 0], rim: [0.3, fl ? 0.004 : -0.004, -0.004, 1], rimCol: u.st === 'chase' ? [1, 0.3, 0.2] : [0.6, 0.7, 1] }, 1, 128);
    let led = r && r.led; if (!led) { const b = SIM.raidBeam(u); led = [b.o[0] - cx, b.o[1] - cy]; }
    L.glow(led[0], led[1], 16, [1, 0.97, 0.85], 0.9, 3); hitOverlay(u, q, 128, 90 + u.i * 13);
    const hd = r ? r.head : [q[0], q[1] - 128]; if ((u.stunT || -99) > GT) { dizzy(hd, 20 + u.i); return hd; }
    if (u.st === 'chase') L.label('ux' + u.i, '!', hd[0], hd[1] - 26 - 4 * Math.sin(GT * 14), { size: 46, col: '#ff3a2a', out: '#300000', al: 0.5 });
    else if (u.sus > 0.08) { const f = Math.min(1, u.sus); L.label('uq' + u.i, '?', hd[0], hd[1] - 24, { size: 40, col: f > 0.6 ? '#ff9a2a' : '#ffe07a', out: '#302000', al: 0.5, a: 0.4 + 0.6 * f });
      L.rrect(hd[0] - 22, hd[1] - 8, 44, 6, 3, [0.1, 0.06, 0.06], [0.1, 0.06, 0.06], 0.8); L.rrect(hd[0] - 21, hd[1] - 7, 42 * f, 4, 2, [1, 0.6, 0.15], [1, 0.4, 0.1]); }
    return hd; }
  // Kolya's airsoft rifle (procedural): from the chest toward the aim, orange tip, a flash on each shot
  function drawRifle(X, Y) { const an = ST.ang || 0, ca = Math.cos(an), sa = Math.sin(an), bx = X + ca * 4, by = Y - 50 + sa * 5, fl = GT - (ST.shotT || -9) < 0.06;
    const pt = (d, o = 0) => [bx + ca * d - sa * o, by + sa * d + ca * o], seg = (d0, d1, th, col, o = 0) => { const a = pt(d0, o); L.solid(a[0], a[1] - th / 2, d1 - d0, th, col, an, 0, th / 2); };
    seg(-24, -8, 11, [0.16, 0.15, 0.16]); seg(-8, 40, 8, [0.2, 0.2, 0.22]); seg(-8, 40, 2, [0.46, 0.46, 0.5], -3); seg(40, 60, 4, [0.24, 0.24, 0.26]);   // stock, body, highlight, barrel
    const m = pt(10, 7); L.solid(m[0] - 3, m[1] - 2, 7, 14, [0.13, 0.13, 0.14], an, 3, 0); const g = pt(-2, 6); L.solid(g[0] - 2, g[1] - 2, 5, 10, [0.15, 0.15, 0.16], an, 2, 0);   // magazine, grip
    const t = pt(62); L.rrect(t[0] - 4, t[1] - 4, 8, 8, 3, [1, 0.5, 0.1], [0.8, 0.3, 0.05]);
    if (fl) L.star(t[0] + ca * 8, t[1] + sa * 8, 24, [1, 0.95, 0.7], 1); }
  // phone contacts (avatars and statuses)
  const CONT = { 'Модеры 🎃': ['#b4501a', 'Кирилл, Райва, Эльф · чат', '🎃'], 'Кирилл': ['#7a4aa0', 'у окна', 'К'], 'Райва': ['#3a5aa0', 'в серверной', 'Р'], 'Эльф': ['#3a8a72', 'на крыльце', 'Э'], 'Скелет': ['#555555', 'занят · не в сети', 'С'], 'Тимофей': ['#222222', 'наблюдает (⊙_⊙)', 'Т'] };
  // the ending: a visual novel over the party pictures, then the stats card
  function finaleOverlay() { const F = ST.finale; if (!F) return; const line = F.lines[Math.min(F.i, F.lines.length - 1)], cg = line ? line.cg : 'cg_party5';
    if (S.finCg !== cg) { S.finPrev = S.finCg; S.finCg = cg; S.finT = T; }
    const drawCg = (n, al, z) => { if (!n || !has(n)) return; const a = A[n], k = Math.max(W / a.w, H / a.h) * z, w = a.w * k, h = a.h * k;
      L.sprite(n, (W - w) / 2, (H - h) / 2, { w, h, u: { alpha: al } }); };
    const age = T - (S.finT || T), zoom = 1.02 + 0.025 * Math.min(1, age / 9);
    L.solid(0, 0, W, H, [0.02, 0.01, 0.02]); if (S.finPrev && age < 0.6) drawCg(S.finPrev, 1, 1.045); drawCg(cg, Math.min(1, (S.finPrev ? 0 : 0.35) + age / 0.6), zoom);
    if (!F.end && line) { vnLine(F, line, GT - (F.at || F.t0), 'fin');                       // v12: the epilogue's stream chat and donation use the same lines as the prologue
      L.label('finnext', `${F.i + 1}/${F.lines.length}  ▶ клик или пробел`, W - 60, H - 22, { size: 18, col: '#c9a27a', out: '#120806', al: 1, a: 0.6 + 0.4 * Math.sin(T * 4) }); }
    if (F.end) { L.solid(0, 0, W, H, [0.02, 0.01, 0.03], 0, 0, 0, 0.72); const st = ST.stats || {}, md = SIM.MODIDS.map((id) => ST[SIM.MODS[id].key]);
      L.label('fend', 'Конец', W / 2, 200, { size: 96, col: '#ffb45a', out: '#2a0a02', al: 0.5, font: SERIF });
      L.label('fend2', F.kind === 'peace' ? 'Добрая концовка: ни одной гадости модерам. Спасибо за игру!' : '«Сладость или гадость» — спасибо за игру!', W / 2, 290, { size: 34, col: '#f6e7c8', out: '#120806', al: 0.5 });
      const nAch = SIM.ACH.filter((a) => ST.ach && ST.ach[a.id]).length;
      const rows = [['Концовка', F.kind === 'peace' ? 'добрая (все простили)' : 'вечеринка-сюрприз'], ['Достижений за игру', nAch + ' из ' + SIM.ACH.length], ['Время на часах', SIM.clockStr(ST)], ['Домов закидано на 100 %', md.filter((k) => k.done >= 0).length + ' из 3'], ['Помирился подарком', md.filter((k) => k.sweet).length + ' из 3'],
        ['Яиц брошено', st.eggs || 0], ['Рулонов бумаги', st.tp || 0], ['Шариков выпущено', st.bb || 0], ['Попаданий в прохожих', st.hits || 0],
        ['Задержаний', ST.raid ? ST.raid.arrests : 0], ['Покупок вируса', (ST.rai.junk || []).length], ['Трусов продано на аукционе', ST.kir.auction || 0],
        ['Тыква на конкурсе', ST.fest && ST.fest.carve ? ST.fest.carve.place + '-е место' : '—'], ['Круток гачи', ST.fest ? ST.fest.gacha.pulls : 0], ['Деньги', ST.money + ' ₽']];
      const x0 = W / 2 - 330, RH = 38; panel(x0 - 30, 330, 720, rows.length * RH + 40, 16, 0.85); L.uiBox('fendp', x0 - 30, 330, 720, rows.length * RH + 40, 4);
      rows.forEach(([k, v], i) => { L.label('fr' + i, k, x0, 370 + i * RH, { size: 26, col: '#e8dcc8', out: '#120806', weight: 'normal' }); L.label('fv' + i, String(v), x0 + 660, 370 + i * RH, { size: 26, col: '#ffd76a', out: '#120806', al: 1 }); });
      L.label('fexit', 'Клик — в главное меню', W / 2, H - 70, { size: 26, col: '#c9a27a', out: '#120806', al: 0.5, a: 0.6 + 0.4 * Math.sin(T * 3) }); } }
  // the wanted panel (top, left of centre) while the raid lasts
  const inRect = (x, y, r) => x > r[0] && x < r[2] && y > r[1] && y < r[3];
  function raidHud() { const RD = ST.raid; if (!RD || RD.st === 'wait') return; let s = '🚨 Розыск: тебя ищут', col = '#ffd27a';
    const chase = RD.units.some((u) => u.st === 'chase'), sus = Math.max(0, ...RD.units.map((u) => u.sus || 0));
    if (RD.grace > GT) { s = '🚨 Отпустили. Пока не ищут…'; col = '#a0e0a0'; }
    else if (chase) { s = '🚨 ПОГОНЯ! Беги и прячься!'; col = '#ff5a4a'; }
    else if (sus > 0.3) { s = '🚨 Тебя заметили?..'; col = '#ffab4a'; }
    else if (ST.hidden) { s = '🚨 Спрятан — не найдут'; col = '#a0e0a0'; }
    else if (SIM.raidCrowd(ST) > 0 && Math.hypot(ST.vx, ST.vy) < 190) { s = '🚨 В толпе — незаметен'; col = '#a0e0a0'; }
    else if ((inRect(ST.x, ST.y, SIM.ALLEY) || inRect(ST.x, ST.y, SIM.ENDLOT)) && !ST.light) { s = '🚨 В темноте — почти не видно'; col = '#a0d0e0'; }
    else if (SIM.inLampLight(ST)) { s = '🚨 Под фонарём — тебя видно издалека'; col = '#ffd27a'; }
    const w = textW(s, 24) + 40, x = 450, y = 34; panel(x, y, w, 44, 14, 0.9, true); L.uiBox('raid', x, y, w, 44, 2); L.label('raid', s, x + 20, y + 22, { size: 24, col, out: '#120806' }); }
  // GL scissor in view px (the comp target may be smaller than the view)
  const clipOn = (x, y, w, h) => { const gl = G.gl, t = L.T.comp, k = t.w / W; gl.enable(gl.SCISSOR_TEST); gl.scissor(Math.floor(x * k), Math.floor((H - y - h) * k), Math.ceil(w * k), Math.ceil(h * k)); };
  const clipOff = () => G.gl.disable(G.gl.SCISSOR_TEST);
  // Kirill behind his window: the real rig walks in, parts the blinds, stares, walks off; the window art goes back over him as glass
  const KWIN = [0.452, 0.62, 0.613, 0.865];                                     // kwin_overlay crop (tools/winmask.py)
  function kirillWindow(hs) { const w = SIM.kirillWinT(GT); if (!hs || ST.kir.st !== 'inside' || w < 0 || !has('kirill_se__body')) return;
    const Xf = (uu) => hs.x + uu * hs.w, Yf = (vv) => hs.y + vv * hs.h, span = 0.085 * hs.w, hk = 116;
    let off, walk = 0, flip = true, arm = null, mv = 0;                          // off: px along the window from its centre (+ = right)
    if (w < 1.0) { off = span * (1 - ease(Math.min(1, w / 0.9))); walk = (span - off) / 60; mv = w < 0.9 ? 1 : 0; }
    else if (w < 3.4) { off = 0; flip = false; const r = Math.min(1, (w - 1.05) / 0.3) * Math.min(1, (3.4 - w) / 0.3); arm = r > 0 ? { R: [0.3 * r, 0.95 - 1.9 * r] } : null; }
    else { const uu = ease(Math.min(1, (w - 3.45) / 0.75)); off = -span * uu; walk = (span + span * uu) / 60; mv = w < 4.15 ? 1 : 0; }
    const X = Xf(0.532) + off, Y = Yf(0.677) + 24 + hk - off * 0.5, look = arm ? 1 : 0;
    clipOn(Xf(KWIN[0]), Yf(KWIN[1]), (KWIN[2] - KWIN[0]) * hs.w, (KWIN[3] - KWIN[1]) * hs.h);
    drawRig('kirill_se', X, Y, hk, flip, walk, mv, [-C, SN], { id: 'kirwin', stride: 60, arm: arm || undefined, tint: [0.72, 0.5, 1.0, 0.35], rimCol: [0.8, 0.5, 1], seed: 3 });
    if (look) { const e = Yf(0.677) + 30; L.glow(X + 2, e, 26, [0.75, 0.5, 1], 0.25, 3); }
    clipOff();
    if (has('kwin_overlay')) L.sprite('kwin_overlay', Xf(KWIN[0]), Yf(KWIN[1]), { w: (KWIN[2] - KWIN[0]) * hs.w, h: (KWIN[3] - KWIN[1]) * hs.h });
    const c = winPt(hs); L.glow(c[0], c[1], 70, [0.6, 0.35, 1], 0.18 + 0.12 * look, 3); }
  // egg splats and TP drapes (house walls/roofs, tree crowns, the ground): m = { k: 'egg'|'tp', s: seed, t, ... }
  function markAt(m, X, Y, k = 1, wall = true) { const age = GT - m.t;
    if (m.k === 'egg') { const n = m.s % 2 ? 'egg_splat_b' : 'egg_splat_a'; if (!has(n)) { ell(L.P.puff, X, Y, 16 * k, 13 * k, { u_col: [0.98, 0.82, 0.2], u_amt: 0.95, u_seed: m.s }); return; }
      const sc = age < 0.09 ? 0.35 + 0.65 * age / 0.09 : 1, w = 72 * k * sc * (0.85 + 0.3 * L.rnd(m.s, 5)), h = w * A[n].h / A[n].w, rot = (L.rnd(m.s, 3) - 0.5) * 1.4;
      if (wall) for (let j = 0; j < 2; j++) { const dl = Math.min(16, Math.max(0, age - 0.3 - j * 0.5) * 5) * (0.5 + L.rnd(m.s, 1 + j)) * k, dx = (L.rnd(m.s, 2 + j) - 0.5) * 14 * k;   // slow yolk runs
        if (dl > 1) { L.rrect(X + dx - 2, Y + 4, 4, dl + 2, 2, [1, 0.88, 0.5], [0.96, 0.68, 0.18], 0.85); ell(L.P.puff, X + dx, Y + 6 + dl, 3.5, 4.5, { u_col: [1, 0.75, 0.2], u_amt: 0.9, u_seed: m.s + j }); } }
      L.sprite(n, X - w / 2, Y - h / 2, { w, h, rot, pivot: [w / 2, h / 2], flip: L.rnd(m.s, 4) > 0.5 }); return; }
    if (m.k === 'tp') { const n = m.s % 2 ? 'tp_drape_b' : 'tp_drape_a'; if (!has(n)) return;
      const w = 125 * k * (0.85 + 0.3 * L.rnd(m.s, 6)), h = w * A[n].h / A[n].w, f = age < 0.5 ? ease(age / 0.5) : 1, sw = 0.012 + 0.014 * Math.abs(SIM.windAt(T, m.x || 0));
      L.sprite(n, X - w / 2, Y - h * 0.1, { w, h: h * f, src: [0, 0, 1, Math.max(0.02, f)], pad: 0.08, flip: L.rnd(m.s, 7) > 0.5, u: { sway: [sw, 3.5, T * 2.2 + m.s, 2] } }); } }
  function groundMark(m) { const X = m.sx - cx, Y = m.sy - cy; if (X < -120 || X > W + 120 || Y < -120 || Y > H + 120) return;
    if (m.k === 'egg') { const n = m.s % 2 ? 'egg_splat_b' : 'egg_splat_a'; if (!has(n)) return; const w = 70 * (0.85 + 0.3 * L.rnd(m.s, 5)), h = w * A[n].h / A[n].w * 0.5;
      L.sprite(n, X - w / 2, Y - h / 2, { w, h, flip: L.rnd(m.s, 4) > 0.5 }); return; }
    if (m.k === 'tp') { const an = L.rnd(m.s, 8) * 6.28, len = 36 + 30 * L.rnd(m.s, 9);
      for (let j = 0; j < 6; j++) { const u0 = j / 6, px = X + Math.cos(an) * len * u0, py = Y + Math.sin(an) * len * u0 * 0.5 + 2 * Math.sin(j * 1.7 + m.s); L.solid(px - 5, py - 3, 10, 6, [0.93, 0.92, 0.88], an * 0.5, 5, 3, 0.95); }
      L.rrect(X - 11, Y - 9, 22, 14, 6, [1, 1, 0.96], [0.78, 0.77, 0.72]); L.rrect(X - 4, Y - 5, 8, 6, 3, [0.55, 0.5, 0.45], [0.4, 0.36, 0.32]); } }
  function drawHouseMarks(h, hs) { if (!hs) return; ST.marks.forEach((m) => { if (m.on === 'house' && m.id === h.id) markAt(m, hs.x + m.u * hs.w, hs.y + m.v * hs.h, 1, true); }); }

  // speech bubbles above speakers
  function bubble(slot, text, X, Y, a = 1) { const lines = wrap(text, 24, 380), lw = Math.max(...lines.map((l) => textW(l, 24))), w = lw + 36, h = lines.length * 30 + 22;
    const y = Math.max(126, Y - h - 26), x = Math.max(10, Math.min((y < 380 ? W - 330 : W - 10) - w, X - w / 2));   // stay on screen, clear of the clock and minimap
    L.rrect(x, y, w, h, 14, [0.98, 0.94, 0.86], [0.88, 0.8, 0.68], a); L.uiBox(slot, x, y, w, h, 6);
    if (Y - h - 26 >= 126 && X > x + 10 && X < x + w - 10) L.solid(X - 8, y + h - 6, 16, 16, [0.9, 0.82, 0.7], Math.PI / 4, 8, 8, a);
    lines.forEach((l, i) => L.label(slot + i, l, x + 18, y + 26 + i * 30, { size: 24, col: '#2a1408', out: null, a })); }
  function bubbles() {
    ST.npc.forEach((n) => { if (GT - n.talkT < 3.4 && n.head && vis0(n.x, n.y, 200)) bubble('nb' + n.i, n.line, n.head[0], n.head[1], Math.min(1, (3.4 - (GT - n.talkT)) * 3)); });
    const says = ST.ev.filter((e) => e.k === 'say' && GT - e.t < e.dur); const last = {};
    says.forEach((e) => (last[e.who] = e));
    Object.values(last).forEach((e) => { let hd = null;
      if (e.who === 'kirill') hd = S.kirHead || P(SIM.HK.door[0], SIM.FACADE, 210);
      if (e.who === 'raiva') hd = S.raiHead || P(SIM.HR.door[0], SIM.FACADE, 210);
      if (e.who === 'elf') hd = S.elfHead || P(SIM.HE.door[0], SIM.FACADE, 210);
      if (e.who.startsWith('raid')) hd = (S.raidHeads || [])[+e.who.slice(4)] || null;
      if (e.who.startsWith('crowd:')) hd = (S.crowdHeads || [])[+e.who.slice(6)] || null;
      if (e.who === 'courier') hd = S.courHead; if (e.who === 'kid') hd = S.kidHead;
      if (e.who.startsWith('house:')) { const h = SIM.HOUSES.find((q) => 'house:' + q.id === e.who); if (h) hd = P(h.door[0], SIM.FACADE, 250); }
      const onScr = hd && hd[0] > -120 && hd[0] < W + 120 && hd[1] > -60 && hd[1] < H + 260;      // v11: a speaker off screen (a crowd at the far end) is not pinned to the edge
      if (onScr) bubble('say_' + e.who, e.text, hd[0], hd[1], Math.min(1, (e.dur - (GT - e.t)) * 3)); });
  }

  // ===== v12: the festival plaza — paving, an arch in the fence, stalls, lantern poles with strings of bulbs, a crowd, scattered jack-o'-lanterns =====
  const FCOL = [[1, 0.45, 0.1], [0.75, 0.3, 1], [0.35, 1, 0.45], [1, 0.85, 0.25], [1, 0.3, 0.55], [0.3, 0.8, 1]];
  const FPUMP = [[2290, 650, 0.9], [2300, 720, 0.7], [2972, 860, 0.9], [2425, 1070, 0.8], [2700, 1075, 0.9], [2540, 1068, 0.8], [2420, 455, 0.7], [2560, 1075, 0.75], [2300, 1010, 1.1], [2800, 1075, 0.7], [2970, 760, 0.8]];
  const FSTR = [[0, 1], [1, 4], [4, 2], [0, 3], [3, 2], [1, 2], [0, 2]];
  function festGround() { const F = SIM.FEST; if (!onScreen(P(F.cx, F.cy), 1500)) return;
    gTex('sidewalk_tex', F.x0, F.y0 + 6, F.x1, F.y1, 230, { grade: [1.05, 0.72, 0, 1] });
    gTex('sidewalk_tex', F.gate[0] + 4, SIM.SWS[1] - 6, F.gate[1] - 4, F.y0 + 8, 230, { grade: [1.0, 0.75, 0, 1] });
    for (let i = 0; i < 150; i++) { const x = F.x0 + 30 + (F.x1 - F.x0 - 60) * L.rnd(i, 3), y = F.y0 + 40 + (F.y1 - F.y0 - 60) * L.rnd(i, 5), q = P(x, y), c = FCOL[i % FCOL.length];
      L.solid(q[0], q[1], 7, 4, c, L.rnd(i, 7) * 3, 3, 2, 0.75); } }
  function festArch() { const F = SIM.FEST, a = P(F.gate[0], 400), b = P(F.gate[1], 400), hgt = 190;
    for (const q of [a, b]) L.rrect(q[0] - 9, q[1] - hgt, 18, hgt, 5, [0.42, 0.24, 0.12], [0.22, 0.12, 0.06]);
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - hgt + 10], len = Math.hypot(b[0] - a[0], b[1] - a[1]) + 30, ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    L.solid(m[0] - len / 2, m[1] - 24, len, 48, [0.42, 0.12, 0.5], ang, len / 2, 24); L.solid(m[0] - len / 2 + 6, m[1] - 18, len - 12, 36, [0.85, 0.38, 0.08], ang, len / 2 - 6, 18);
    const sw = textW('ПРАЗДНИК', 24) + 36; L.rrect(m[0] - 2, m[1] - 62, 4, 40, 2, [0.4, 0.22, 0.1], [0.3, 0.15, 0.06]); L.rrect(m[0] - sw / 2, m[1] - 106, sw, 44, 10, [0.95, 0.55, 0.12], [0.6, 0.25, 0.05]);
    L.label('festarch', 'ПРАЗДНИК', m[0], m[1] - 84, { size: 24, col: '#fff6e0', out: '#3a0a30', al: 0.5 }); L.glow(m[0], m[1] - 84, 120, [1, 0.6, 0.2], 0.25, 2.5);
    for (let i = 0; i < 7; i++) { const f = i / 6, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f - hgt + 40 + 16 * Math.sin(f * Math.PI), c = FCOL[i % FCOL.length];
      L.rrect(x - 5, y - 5, 10, 10, 5, c, c.map((v) => v * 0.6)); L.glow(x, y, 24, c, 0.5 * flick(i + 40), 3); }
    for (const [q, i] of [[a, 0], [b, 1]]) { const h = 46; if (has('probe_prop')) { const w = L.hsz('probe_prop', h); L.sprite('probe_prop', q[0] - w / 2, q[1] - hgt - h + 6, { w, h }); } L.glow(q[0], q[1] - hgt - 20, 40, WARM, 0.5 * flick(60 + i), 3); } }
  const poleTop = (x, y) => P(x, y, 205);
  function festStrings() { const F = SIM.FEST; if (!onScreen(P(F.cx, F.cy), 1300)) return;
    FSTR.forEach(([i0, i1], s) => { const a = poleTop(...SIM.FPOLES[i0]), b = poleTop(...SIM.FPOLES[i1]), n = 14, sag = 46;
      const pt = (f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f + sag * 4 * f * (1 - f)];
      for (let k = 0; k < n; k++) { const p0 = pt(k / n), p1 = pt((k + 1) / n), d = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); L.solid(p0[0], p0[1] - 1, d, 2, [0.12, 0.08, 0.06], Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), 0, 1, 0.8); }
      for (let k = 1; k < n; k++) { const [x, y] = pt(k / n), c = FCOL[(k + s) % FCOL.length], tw = 0.55 + 0.45 * Math.sin(T * 3 + k * 1.7 + s), pk = k % 3 === 0;
        if (pk) L.solid(x - 5, y + 2, 10, 10, c.map((v) => v * 0.75), Math.PI / 4 + 0.15 * Math.sin(T * 2 + k), 5, 0, 0.9);
        else { L.rrect(x - 3.5, y - 1, 7, 8, 3.5, c, c.map((v) => v * 0.55)); L.glow(x, y + 3, 20, c, 0.4 * tw, 3); } } }); }
  function festLights(night) { const F = SIM.FEST; if (!onScreen(P(F.cx, F.cy), 1200)) return; const k = night ? 0.55 : 1;
    SIM.FPOLES.forEach(([x, y], i) => pool(x + 30, y + 30, 210, FCOL[i % FCOL.length], 0.3 * k * flick(i + 20, 0.4)));
    SIM.FSTALLS.forEach((st, i) => { const c = st[1] === 'gacha' ? [1, 0.45, 0.85] : st[1] === 'stage' ? [0.85, 0.5, 1] : WARM; pool(st[2] - 40, st[3] + 70, st[1] === 'stage' ? 280 : 220, c, (st[1] === 'gacha' ? 0.3 + 0.12 * Math.sin(T * 3) : st[1] === 'stage' ? 0.28 : 0.36) * k); });
    pool(F.cx, F.cy, 520, [1, 0.6, 0.3], 0.16 * k);
    if (ST.mg && ST.mg.k === 'stage') pool(SIM.STAGEP[0], SIM.STAGEP[1], 150, [1, 0.95, 0.8], 0.6 * k); }
  function festGlows() { const F = SIM.FEST; if (!onScreen(P(F.cx, F.cy), 1200)) return;
    SIM.FPOLES.forEach(([x, y], i) => { const q = P(x, y, 150); L.glow(q[0], q[1], 70, FCOL[(i + 1) % FCOL.length], 0.45 * flick(i + 30, 0.4), 3); });
    const g = SIM.FSTALLS.find((s) => s[1] === 'gacha'), q = P(g[2], g[3], 150); L.glow(q[0], q[1], 120, [1, 0.5, 0.9], 0.35 + 0.15 * Math.sin(T * 2.6), 2.6); L.star(q[0] + 30 * Math.sin(T * 1.3), q[1] - 60, 26, [1, 0.9, 0.5], 0.6 + 0.4 * Math.sin(T * 5));
    if (ST.mg && ST.mg.k === 'stage') { const s = P(SIM.STAGEP[0], SIM.STAGEP[1], 60); L.glow(s[0], s[1] - 60, 260, [1, 0.95, 0.8], 0.3, 2); } }
  // the player's carved pumpkin: the strokes as glowing cuts (a canvas texture, redrawn only when they change)
  const CARVESIG = {};
  function carveTex(name, strokes, w, h, lw = 1) { const sig = strokes.length + ':' + strokes.reduce((a, s) => a + s.length, 0); if (CARVESIG[name] === sig) return; CARVESIG[name] = sig;
    cvTex(name, w, h, (g) => { const X = (p) => (p[0] + 1) / 2 * w, Y = (p) => (p[1] + 1) / 2 * h; g.lineCap = 'round'; g.lineJoin = 'round';
      for (const [col, wd, blur] of [['#2a0600', 30, 0], ['#3a0c00', 22, 0], ['#ff9a20', 15, 16], ['#fff1a8', 6, 6]]) { g.strokeStyle = col; g.lineWidth = wd * lw; g.shadowColor = '#ffcf50'; g.shadowBlur = blur * lw;
        for (const s of strokes) { g.beginPath(); s.forEach((p, i) => (i ? g.lineTo(X(p), Y(p)) : g.moveTo(X(p), Y(p)))); if (s.length === 1) g.lineTo(X(s[0]) + 0.5, Y(s[0])); g.stroke(); } } }); }
  function carvedPumpkin(name, strokes, cxp, cyp, rw, a = 1) { if (!has('ui_pumpkin')) return; const sw = rw * 1.08, sh = sw * A.ui_pumpkin.h / A.ui_pumpkin.w, cw = Math.round(Math.max(160, Math.min(600, rw * 1.5)));
    L.sprite('ui_pumpkin', cxp - sw / 2, cyp - sh * 0.566, { w: sw, h: sh, u: { alpha: a } }); carveTex(name, strokes, cw, Math.round(cw * 0.967), Math.max(0.45, cw / 600 * (rw < 200 ? 1.6 : 1))); const rx = rw / 2, ry = rx * 0.967;
    L.sprite(name, cxp - rx, cyp - ry, { w: rx * 2, h: ry * 2, u: { alpha: a } }); }
  function festWorld(add, vis) { const F = SIM.FEST; if (!vis(F.cx, F.cy, 1400)) return;
    add([F.gate[0] - 6, 392, F.gate[1] + 6, 408], festArch);
    SIM.FSTALLS.forEach((st) => { const [n, id, x, y, r, w] = st, box = id === 'stage' ? [2835, 505, 2985, 690] : [x - r, y - r, x + r, y + r];
      add(box, () => { propSprite(n, x, y, w, id === 'gacha' ? 0.9 : 0.8);
        if (id === 'carve' && ST.fest && ST.fest.carve) { const q = P(x + 70, y + 90); carvedPumpkin('carve_booth', ST.fest.carve.strokes, q[0], q[1] - 30, 64); L.glow(q[0], q[1] - 30, 50, WARM, 0.5 * flick(70), 3); }
        if (id === 'stage' && ST.mg && ST.mg.k === 'stage') { const q = P(ST.x, ST.y), r2 = drawKolya(q[0] - 30, q[1] - 40, 1); S.kolHead = r2.head; S.kolLed = r2.led; S.kolFace = r2.face; } }); });
    SIM.FPOLES.forEach(([x, y]) => add([x - 14, y - 14, x + 14, y + 14], () => propSprite('fest_lanterns', x, y, 230, 0.93)));
    FPUMP.forEach(([x, y, k], i) => add([x - 20, y - 20, x + 20, y + 20], () => pumpkin(x, y, k, false, true, i + 90)));
    S.festHeads = S.festHeads || [];
    SIM.FCROWD.forEach(([x, y, tex], i) => add([x - 15, y - 15, x + 15, y + 15], () => { const tgt = ST.mg && ST.mg.k === 'stage' ? SIM.STAGEP : [F.cx, F.cy], q0 = P(x, y), q1 = P(tgt[0], tgt[1]);
      S.festHeads[i] = drawPerson(tex, x, y, { k: tex === 'kid' ? 0.72 : 0.93, ang: Math.atan2(q1[1] - q0[1], q1[0] - q0[0]), g: 0, id: 'fc' + i, seed: 60 + i }); })); }
  function festBubbles() { const F = SIM.FEST; if (Math.hypot(ST.x - F.cx, ST.y - F.cy) > 950 || ST.mg) return;
    let shown = 0; SIM.FCROWD.forEach((c, i) => { const per = 11, ph = (GT + i * 3.7) % per, hd = (S.festHeads || [])[i]; if (ph > 4.2 || !hd || shown >= 2 || hd[0] > W - 520 || hd[0] < 120) return;
      const n = Math.floor((GT + i * 3.7) / per) * 7 + i * 3; shown++; bubble('fb' + i, SIM.FLINES[n % SIM.FLINES.length], hd[0], hd[1], Math.min(1, (4.2 - ph) * 3, ph * 4)); }); }
  // ===== v12: the mini-game screens =====
  const inRr = (r) => ST.ptr && ST.ptr[0] > r.x && ST.ptr[0] < r.x + r.w && ST.ptr[1] > r.y && ST.ptr[1] < r.y + r.h;
  function fbtn(id, r, text, col = [0.95, 0.5, 0.12], on = true) { const h = on && inRr(r); L.rrect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 16, [0.55, 0.3, 0.12], [0.3, 0.14, 0.06], 0.95);
    L.rrect(r.x, r.y, r.w, r.h, 14, on ? col.map((v) => Math.min(1, v * (h ? 1.18 : 1))) : [0.3, 0.25, 0.25], on ? col.map((v) => v * 0.55) : [0.18, 0.15, 0.15], 0.97);
    L.uiBox(id, r.x, r.y, r.w, r.h, 2); L.label(id, text, r.x + r.w / 2, r.y + r.h / 2, { size: 28, col: on ? '#fff6e0' : '#9a8a80', out: '#2a0a02', al: 0.5 }); }
  function mgFrame(title, sub) { const U = SIM.FUI, p = U.panel; L.solid(0, 0, W, H, [0.02, 0.01, 0.03], 0, 0, 0, 0.62); panel(p.x, p.y, p.w, p.h, 22, 0.94); L.uiBox('mgp', p.x, p.y, p.w, p.h, 6);
    L.label('mgt', title, p.x + 40, p.y + 52, { size: 40, col: '#ffb45a', out: '#120806', font: SERIF }); if (sub) L.label('mgs', sub, p.x + 42, p.y + 96, { size: 22, col: '#d8c8b0', out: '#120806', weight: 'normal' });
    const c = U.close, hv = inRr(c); L.rrect(c.x, c.y, c.w, c.h, 12, hv ? [0.8, 0.25, 0.15] : [0.4, 0.15, 0.1], [0.25, 0.08, 0.05], 0.95); L.label('mgx', '✕', c.x + c.w / 2, c.y + c.h / 2, { size: 30, col: '#ffe8d0', out: null, al: 0.5 }); }
  function timerBar(x, y, w, f) { L.rrect(x, y, w, 16, 8, [0.2, 0.12, 0.1], [0.1, 0.06, 0.05], 0.95); L.rrect(x + 2, y + 2, Math.max(0, (w - 4) * f), 12, 6, f < 0.25 ? [1, 0.35, 0.2] : [1, 0.75, 0.3], f < 0.25 ? [0.7, 0.15, 0.05] : [0.85, 0.45, 0.1]); }
  function resultCard(G2, lines, big) { const p = { x: W / 2 - 600, y: 230, w: 1200, h: 120 + lines.length * 46 + 110 }; L.solid(0, 0, W, H, [0.02, 0.01, 0.03], 0, 0, 0, 0.45);
    panel(p.x, p.y, p.w, p.h, 22, 0.97); L.uiBox('mgres', p.x, p.y, p.w, p.h, 6); L.glow(W / 2, p.y + 60, 260, big ? [1, 0.8, 0.3] : [0.9, 0.5, 0.2], 0.35, 2.5);
    L.label('mgrt', G2.res.title, W / 2, p.y + 64, { size: 48, col: big ? '#ffd76a' : '#ffb45a', out: '#2a0a02', al: 0.5, font: SERIF });
    lines.forEach((l, i) => L.label('mgrl' + i, l, W / 2, p.y + 138 + i * 46, { size: 26, col: '#f6e7c8', out: '#120806', al: 0.5, weight: 'normal' }));
    const ok = Object.assign({}, SIM.FUI.ok, { y: p.y + p.h - 96 }); fbtn('mgok', ok, 'Дальше'); }
  const RIVALSTROKES = [[[[-0.42, -0.25], [-0.3, -0.42], [-0.18, -0.25], [-0.36, -0.3], [-0.24, -0.3]], [[0.18, -0.25], [0.3, -0.42], [0.42, -0.25], [0.24, -0.3], [0.36, -0.3]], [[-0.4, 0.15], [-0.2, 0.35], [0.2, 0.35], [0.4, 0.15]], [[-0.1, -0.05], [0, 0.05], [0.1, -0.05]]],
    [[[-0.4, -0.3], [-0.2, -0.3]], [[0.2, -0.3], [0.4, -0.3]], [[-0.25, 0.05], [-0.25, 0.4], [-0.05, 0.4], [-0.05, 0.05], [-0.25, 0.05]], [[0.1, 0.05], [0.3, 0.05], [0.3, 0.4], [0.1, 0.4], [0.1, 0.22], [0.3, 0.22]]],
    [[[-0.45, -0.2], [-0.35, -0.3], [-0.25, -0.2]], [[-0.15, -0.2], [-0.05, -0.3], [0.05, -0.2]], [[0.15, -0.2], [0.25, -0.3], [0.35, -0.2]], [[-0.3, 0.2], [0, 0.32], [0.3, 0.2]]]];
  function carveOverlay(G2) { const C2 = SIM.CARVE, U = SIM.FUI, left = Math.max(0, 1 - (GT - G2.t0) / C2.dur);
    mgFrame('Конкурс резьбы по тыкве', 'Рисуй мышкой прямо на тыкве — что хочешь: лицо, вайфу, логотип. Потом «Готово».');
    L.glow(C2.cx, C2.cy, 420, [1, 0.55, 0.15], 0.25, 2.2); carvedPumpkin('carve_live', G2.strokes, C2.cx, C2.cy, C2.rx * 2);
    if (!G2.res && ST.ptr) { const u = (ST.ptr[0] - C2.cx) / C2.rx, v = (ST.ptr[1] - C2.cy) / C2.ry; if (u * u + v * v < 0.92) { L.ring(ST.ptr[0], ST.ptr[1], 12, 12, [1, 0.9, 0.6], 0.9, 0.25); } }
    const x = 1220; L.label('mgr0', 'Соперники', x, 190, { size: 30, col: '#ffb45a', out: '#120806' });
    SIM.RIVALS.forEach(([nm, sc], i) => { const y = 228 + i * 150; L.rrect(x, y, 460, 134, 14, [0.2, 0.12, 0.14], [0.12, 0.07, 0.08], 0.95); carvedPumpkin('rival' + i, RIVALSTROKES[i], x + 70, y + 72, 100);
      L.label('mgrn' + i, nm, x + 140, y + 46, { size: 22, col: '#f6e7c8', out: '#120806', weight: 'normal' }); L.label('mgrs' + i, G2.res ? '★ ' + sc.toFixed(1) : '★ ?', x + 140, y + 90, { size: 26, col: '#ffd76a', out: '#120806' }); });
    timerBar(x, 690, 460, left); L.label('mgtm', Math.ceil(left * C2.dur) + ' с', x + 470, 698, { size: 22, col: '#f6e7c8', out: '#120806' });
    fbtn('mgclear', U.clear, 'Стереть', [0.55, 0.35, 0.3], !G2.res); fbtn('mgdone', U.done, 'Готово!', [0.95, 0.5, 0.12], !G2.res);
    if (G2.res) { const R = G2.res, lines = R.judges.map(([n, s, c]) => `${n}: ${s.toFixed(1)} — «${c}»`).concat([`Итог: ${R.score.toFixed(1)} · ${R.place}-е место из 4` + (R.prize ? ` · приз ${R.prize} ₽` : ''), R.line]);
      resultCard(G2, lines, R.place === 1); } }
  function applesOverlay(G2) { const AP = SIM.APPLE, left = Math.max(0, 1 - (GT - G2.t0) / AP.dur);
    mgFrame('Яблоки из бочки', 'Кликай по яблокам, пока они над водой. Золотое — за три.');
    const ellS = (rx, ry, col, col2, step = 6, dy = 0) => { for (let y = -ry; y < ry; y += step) { const f = (y + step / 2) / ry, w = rx * Math.sqrt(Math.max(0, 1 - f * f)), k = (y + ry) / (2 * ry);
      L.solid(AP.cx - w, AP.cy + dy + y, w * 2, step + 0.5, [col[0] + (col2[0] - col[0]) * k, col[1] + (col2[1] - col[1]) * k, col[2] + (col2[2] - col[2]) * k]); } };   // pixel-stepped ellipses
    ellS(AP.rx + 70, AP.ry + 58, [0.42, 0.24, 0.11], [0.3, 0.16, 0.07], 6, 26); ellS(AP.rx + 70, AP.ry + 58, [0.62, 0.38, 0.18], [0.45, 0.26, 0.11]);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, q = [AP.cx + Math.cos(a) * (AP.rx + 36), AP.cy + Math.sin(a) * (AP.ry + 30)]; L.rrect(q[0] - 7, q[1] - 7, 14, 14, 3, [0.3, 0.3, 0.32], [0.18, 0.18, 0.2]); }
    ellS(AP.rx + 8, AP.ry + 8, [0.1, 0.3, 0.52], [0.04, 0.12, 0.3]);
    for (let i = 0; i < 6; i++) { const a = (GT * 0.4 + i / 6) % 1; L.ring(AP.cx + 200 * Math.sin(i * 2.1), AP.cy + 90 * Math.cos(i * 1.7), 60 + 160 * a, (60 + 160 * a) * 0.5, [0.6, 0.85, 1], 0.25 * (1 - a), 0.06); }
    G2.apples.forEach((a, i) => { const up = SIM.appleUp(a, GT), q = SIM.applePos(a, GT), n = a.gold ? 'ui_apple_g' : 'ui_apple_r', z = up ? 1 : 0.62, s = 92 * z, al = up ? 1 : 0.45;
      if (!has(n)) return; if (up) L.shadow(q[0], q[1] + 30, 40, 12, 0.35);
      L.sprite(n, q[0] - s / 2, q[1] - s / 2 - (up ? 18 : 0), { w: s, h: s, u: { alpha: al, tint: a.gold ? [1, 0.82, 0.2, 0.75] : up ? [1, 1, 1, 0] : [0.3, 0.55, 1, 0.5] } });
      if (a.gold && up) L.glow(q[0], q[1] - 18, 70, [1, 0.85, 0.3], 0.6, 3); });
    if (G2.pop && GT - G2.pop.t < 0.8) { const a = (GT - G2.pop.t) / 0.8; L.label('mgpop', G2.pop.gold ? '+3!' : '+1', G2.pop.x[0], G2.pop.x[1] - 40 - 60 * a, { size: 40, col: G2.pop.gold ? '#ffd76a' : '#ffffff', out: '#2a0a02', al: 0.5, a: 1 - a }); }
    timerBar(560, 920, 800, left); L.label('mgsc', 'Яблок: ' + G2.n, 1500, 190, { size: 40, col: '#ffd76a', out: '#120806', al: 1 });
    if (G2.res) { const R = G2.res; resultCard(G2, [`Выловлено яблок: ${R.n}`, `+${R.prize} ₽ и +${R.hp} HP`, `Рекорд: ${R.best}`], R.n >= 10); } }
  const ARROW = ['▲', '▶', '▼', '◀'];
  function stageOverlay(G2) { const n = G2.seq.length, x0 = W / 2 - n * 46, y = H - 230;
    panel(x0 - 30, y - 70, n * 92 + 60, 160, 20, 0.9); L.label('stt', 'Конкурс костюмов: держи позу!', W / 2, y - 40, { size: 26, col: '#ffb45a', out: '#120806', al: 0.5 });
    G2.seq.forEach((d, i) => { const cx2 = x0 + i * 92 + 46, done = i < G2.i, cur = i === G2.i && GT >= G2.at, ok = G2.log[i];
      L.rrect(cx2 - 38, y - 6, 76, 76, 14, done ? (ok ? [0.3, 0.75, 0.35] : [0.7, 0.2, 0.15]) : cur ? [1, 0.75, 0.3] : [0.25, 0.18, 0.2], done ? (ok ? [0.12, 0.4, 0.15] : [0.4, 0.08, 0.05]) : cur ? [0.8, 0.4, 0.08] : [0.12, 0.08, 0.1], 0.95);
      L.label('sta' + i, i <= G2.i || done ? ARROW[d] : '?', cx2, y + 32, { size: 40, col: '#fff6e0', out: '#2a0a02', al: 0.5 });
      if (cur) { const f = Math.max(0, 1 - (GT - G2.at) / G2.win); L.ring(cx2, y + 32, 48 + 40 * f, 48 + 40 * f, [1, 0.9, 0.5], 0.8, 0.05); } });
    if (GT < G2.at && G2.i === 0) L.label('stc', String(Math.ceil(G2.at - GT)), W / 2, H / 2 - 120, { size: 120, col: '#ffd76a', out: '#2a0a02', al: 0.5, font: SERIF });
    if (G2.flash && GT - G2.flash.t < 0.6) L.label('stf', G2.flash.ok ? 'ПОЗА!' : 'Мимо…', W / 2, H / 2 - 160 - 40 * (GT - G2.flash.t), { size: 64, col: G2.flash.ok ? '#ffd76a' : '#ff8a7a', out: '#2a0a02', al: 0.5, a: 1 - (GT - G2.flash.t) / 0.6 });
    L.label('sth', `${G2.hits}/${n} · стрелки или WASD · Esc — уйти со сцены`, W / 2, y + 108, { size: 20, col: '#d8c8b0', out: '#120806', al: 0.5, weight: 'normal' });
    if (G2.res) { const R = G2.res; resultCard(G2, [`Позы: ${R.hits} из ${n}` + (R.bonus ? ' + бонус за легендарный костюм' : ''), R.prize ? `Приз зрительских симпатий: ${R.prize} ₽` : 'Для победы нужно 6 поз из 8'], !!R.prize); } }
  const RCOL = { 3: [0.3, 0.6, 1], 4: [0.75, 0.35, 1], 5: [1, 0.8, 0.25] };
  function capsule(x, y, r, col, open = 0, a = 1) { const c2 = col.map((v) => v * 0.55);
    if (open > 0) { const k = 1 - open; L.glow(x, y, r * (2.2 + 2 * open), col, 0.75 * open * a, 2.5);                 // opened: the shell flies apart, a star of the rarity's colour
      if (k > 0.02) { L.rrect(x - r * k, y - r * k - open * r * 1.4, r * 2 * k, r * 2 * k, r * k, [0.95, 0.97, 1], [0.7, 0.75, 0.85], a * k); L.rrect(x - r * k, y - r * k + open * r * 1.2, r * 2 * k, r * 2 * k, r * k, col, c2, a * k); }
      L.star(x, y, r * (0.9 + 0.5 * open), col.map((v) => Math.min(1, v + 0.25)), a * open); L.glow(x, y, r * 0.6, [1, 1, 1], 0.6 * open * a, 3); return; }
    L.rrect(x - r, y - r, r * 2, r * 2, r, col, c2, a); clipOn(x - r - 2, y - r - 2, r * 2 + 4, r + 2); L.rrect(x - r, y - r, r * 2, r * 2, r, [0.95, 0.97, 1], [0.72, 0.78, 0.88], a * 0.92); clipOff();
    L.solid(x - r, y - 2, r * 2, 4, [0.2, 0.12, 0.15], 0, 0, 0, a * 0.8); L.glow(x - r * 0.35, y - r * 0.45, r * 0.5, [1, 1, 1], 0.35 * a, 3); }
  function gachaOverlay(G2) { const U = SIM.FUI, g = (ST.fest || {}).gacha || { pity: 0, pulls: 0 }, GA = SIM.GACHA;
    mgFrame('Гача-автомат «Тыквенный баннер»', `★5 — ${String(GA.p5 * 100).replace('.', ',')} % · ★4 — ${Math.round(GA.p4 * 100)} % · гарант ★5 на ${GA.pity}-й крутке`);
    if (has('fest_gacha')) { const h = 640, w = L.hsz('fest_gacha', h); L.glow(420, 560, 380, [1, 0.45, 0.85], 0.3 + 0.1 * Math.sin(T * 2), 2.4); L.sprite('fest_gacha', 420 - w / 2, 230, { w, h }); }
    const x = 820; L.label('gb0', 'На баннере (★5):', x, 236, { size: 28, col: '#ffd76a', out: '#120806' });
    [['pumpkin', 'Костюм «Золотая тыква»', [1, 0.78, 0.2, 0.6]], ['ghost', 'Костюм «Неоновый призрак»', [0.35, 1, 0.95, 0.6]]].forEach(([c, nm, tint], i) => { const n = 'cos_' + c + '_0', bx = x + i * 440, by = 262;
      L.rrect(bx, by, 420, 140, 16, [0.3, 0.2, 0.08], [0.16, 0.1, 0.04], 0.95); L.glow(bx + 70, by + 70, 90, tint.slice(0, 3), 0.4 + 0.2 * Math.sin(T * 3 + i), 2.5);
      if (has(n)) { const hh = 110, ww = Math.min(120, L.hsz(n, hh)); L.sprite(n, bx + 70 - ww / 2, by + 20, { w: ww, h: hh * ww / L.hsz(n, hh), u: { alpha: 1, tint } }); }
      const own = ((ST.fest || {}).cos || []).includes(c === 'pumpkin' ? 'pumpkin_gold' : 'ghost_neon');
      L.label('gbn' + i, nm, bx + 140, by + 52, { size: 22, col: '#fff3dc', out: '#120806', weight: 'normal' }); L.label('gbo' + i, own ? '✓ есть' : '★★★★★', bx + 140, by + 96, { size: 22, col: own ? '#9fe09f' : '#ffd76a', out: '#120806' }); });
    L.label('gpity', `До гаранта: ${Math.max(0, GA.pity - g.pity)} · круток всего: ${g.pulls} · деньги: ${ST.money} ₽`, x, 438, { size: 24, col: '#f6e7c8', out: '#120806', weight: 'normal' });
    const R = G2.res2, busy = R && GT - R.t < (R.n === 10 ? 2.4 : 1.7);
    if (R) { const age = GT - R.t;
      if (R.n === 1) { const it = R.items[0], col = RCOL[it.r], op = Math.max(0, Math.min(1, (age - 0.9) / 0.35)), sh = age < 0.9 ? Math.sin(age * 40) * 8 * Math.min(1, age * 3) : 0, cx2 = x + 420, cy2 = 600;
        capsule(cx2 + sh, cy2 - Math.max(0, 1 - age * 2.5) * 200, 70, col, op); if (op > 0.5) { for (let k = 0; k < it.r * 2; k++) { const an = k / (it.r * 2) * 6.283 + age; L.star(cx2 + Math.cos(an) * 150 * op, cy2 + Math.sin(an) * 90 * op, 18, col, op); }
          L.label('gr1', '★'.repeat(it.r), cx2, cy2 + 120, { size: 40, col: it.r === 5 ? '#ffd76a' : it.r === 4 ? '#d9a0ff' : '#9ac8ff', out: '#120806', al: 0.5, a: op }); L.label('gr2', it.name, cx2, cy2 + 168, { size: 30, col: '#fff3dc', out: '#120806', al: 0.5, a: op }); } }
      else R.items.forEach((it, i) => { const col = RCOL[it.r], bx = x + (i % 5) * 176, by = 470 + Math.floor(i / 5) * 156, d = i * 0.14, op = Math.max(0, Math.min(1, (age - 0.5 - d) / 0.3));
        L.rrect(bx, by, 164, 146, 14, col.map((v) => v * 0.5), col.map((v) => v * 0.2), 0.95 * Math.max(0.25, op)); capsule(bx + 82, by + 52, 34, col, op, Math.max(0.3, op));
        if (op > 0) { L.label('grs' + i, '★'.repeat(it.r), bx + 82, by + 104, { size: 20, col: it.r === 5 ? '#ffd76a' : '#e8dcff', out: '#120806', al: 0.5, a: op });
          wrap(it.name.replace(/^Костюм /, ''), 17, 150, 'normal').slice(0, 2).forEach((l, j) => L.label('grn' + i + '_' + j, l, bx + 82, by + 126 + j * 18, { size: 17, col: '#fff3dc', out: '#120806', al: 0.5, weight: 'normal', a: op })); } }); }
    else L.label('ghint', 'Крути! Выпадают яйца, бумага, петарды, слайм, деньги — и легендарные костюмы.', x, 560, { size: 24, col: '#d8c8b0', out: '#120806', weight: 'normal' });
    if (G2.warn && GT - G2.warn.t < 2) L.label('gwarn', G2.warn.text, x + 420, 780, { size: 26, col: '#ff8a7a', out: '#120806', al: 0.5 });
    fbtn('g1', U.g1, `×1 · ${GA.cost1} ₽`, [0.3, 0.55, 0.95], !busy && ST.money >= GA.cost1); fbtn('g10', U.g10, `×10 · ${GA.cost10} ₽`, [0.95, 0.65, 0.15], !busy && ST.money >= GA.cost10); }
  function mgOverlay() { const G2 = ST.mg; if (!G2) return; if (G2.k === 'carve') carveOverlay(G2); else if (G2.k === 'apples') applesOverlay(G2); else if (G2.k === 'stage') stageOverlay(G2); else if (G2.k === 'gacha') gachaOverlay(G2); }
  // ===== v12: the visual-novel lines of the prologue and the epilogue (narration, a stream chat, a donation alert, a phone notification, the mods' chat, a voice note) =====
  const CHATNICKS = ['тыквенный_кот', 'ModHater2007', 'аниме_бабушка', 'Skelet_fan', 'гача_страдалец', 'lurker_404', 'ведьма_на_минималках'], NICKC = ['#ff9a5a', '#9ad0ff', '#ff8ad8', '#a8f0a0', '#ffd76a', '#c8a8ff', '#ffb0b0'];
  function vnLine(F, line, age, id) { const k = line.k || '', pw = 1300, ph = 210, bx = W / 2 - pw / 2, by = H - ph - 40;
    if (/^cg_pro2|^cg_epi/.test(line.cg)) { L.rrect(36, 30, 330, 50, 12, [0.75, 0.1, 0.12], [0.45, 0.04, 0.06], 0.92); L.label(id + 'live', '● LIVE · КоляРеакт · ' + (312 + Math.floor(T * 0.7) % 40), 52, 55, { size: 22, col: '#ffffff', out: null }); }
    if (k === 'chat') { const msgs = line.text.split('\n'), x = W - 600, y0 = 120; panel(x, y0, 560, 70 + msgs.length * 92, 18, 0.88); L.label(id + 'ct', 'Чат трансляции', x + 24, y0 + 36, { size: 24, col: '#ffb45a', out: '#120806' });
      msgs.forEach((m, i) => { const a = Math.max(0, Math.min(1, (age - 0.15 - i * 0.45) / 0.25)); if (a <= 0) return; const ni = (i * 3 + m.length) % CHATNICKS.length, y = y0 + 80 + i * 92;
        L.label(id + 'cn' + i, CHATNICKS[ni] + ':', x + 24, y, { size: 21, col: NICKC[ni], out: '#120806', a });
        wrap(m, 24, 500, 'normal').slice(0, 2).forEach((l, j) => L.label(id + 'cm' + i + '_' + j, l, x + 24, y + 30 + j * 28, { size: 24, col: '#f6e7c8', out: '#120806', weight: 'normal', a })); }); return; }
    if (k === 'donate') { const a = Math.min(1, age / 0.3), s = 0.7 + 0.3 * ease(a) + (age < 0.6 ? 0.05 * Math.sin(age * 30) : 0), w = 900 * s, h = 230 * s, x = W / 2 - w / 2, y = 150;
      L.glow(W / 2, y + h / 2, 520, [1, 0.8, 0.3], 0.35 * a, 2.2); L.rrect(x - 4, y - 4, w + 8, h + 8, 26, [1, 0.85, 0.3], [0.8, 0.45, 0.08], a); L.rrect(x, y, w, h, 22, [0.3, 0.12, 0.35], [0.14, 0.05, 0.18], a);
      for (let i = 0; i < 10; i++) { const an = i * 0.628 + T; L.star(W / 2 + Math.cos(an) * (w / 2 + 30), y + h / 2 + Math.sin(an) * (h / 2 + 24), 20, [1, 0.9, 0.5], 0.7 * a); }
      L.label(id + 'dh', '💸 ' + line.who, W / 2, y + 70 * s, { size: 46 * s, col: '#ffd76a', out: '#2a0a02', al: 0.5, a });
      L.label(id + 'dt', line.text, W / 2, y + 150 * s, { size: 38 * s, col: '#ffffff', out: '#2a0a02', al: 0.5, a }); return; }
    if (k === 'notify') { const a = Math.min(1, age / 0.35), y = -140 + 200 * ease(a), w = Math.max(820, textW(line.text, 28) + 170), x = W / 2 - w / 2; L.rrect(x, y, w, 120, 24, [0.96, 0.94, 0.98], [0.82, 0.8, 0.86], 0.97);
      L.rrect(x + 22, y + 22, 76, 76, 18, [1, 0.55, 0.15], [0.8, 0.3, 0.05]); L.label(id + 'ni', '🎃', x + 60, y + 60, { size: 40, col: '#ffffff', out: null, al: 0.5 });
      L.label(id + 'nh', line.who + ' · сейчас', x + 120, y + 42, { size: 22, col: '#555060', out: null, weight: 'normal' }); L.label(id + 'nt', line.text, x + 120, y + 80, { size: 28, col: '#1a1420', out: null }); return; }
    if (k === 'group') { const msgs = line.text.split('\n'), x = W - 700, y0 = 150; panel(x, y0, 640, 90 + msgs.length * 104, 22, 0.92); L.label(id + 'gt', line.who, x + 26, y0 + 40, { size: 28, col: '#ffb45a', out: '#120806' });
      msgs.forEach((m, i) => { const a = Math.max(0, Math.min(1, (age - 0.2 - i * 0.7) / 0.25)); if (a <= 0) return; const j = m.indexOf(': '), nm = m.slice(0, j), tx = m.slice(j + 2), y = y0 + 84 + i * 104;
        const col = { 'Кирилл': [0.48, 0.29, 0.63], 'Райва': [0.23, 0.35, 0.63], 'Эльф': [0.23, 0.54, 0.45] }[nm] || [0.3, 0.3, 0.3];
        L.rrect(x + 22, y, 596, 92, 16, col, col.map((v) => v * 0.6), 0.95 * a); L.label(id + 'gn' + i, nm, x + 40, y + 26, { size: 21, col: '#ffe0b0', out: null, a });
        wrap(tx, 23, 560, 'normal').slice(0, 2).forEach((l, q) => L.label(id + 'gm' + i + '_' + q, l, x + 40, y + 56 + q * 26, { size: 23, col: '#ffffff', out: null, weight: 'normal', a })); }); return; }
    if (k === 'voice') { const w = 980, x = W / 2 - w / 2, y = 120, pr = window.__vprog || 0, playing = window.__vplaying; panel(x, y, w, 150, 75, 0.94);
      L.rrect(x + 26, y + 26, 98, 98, 49, [0.23, 0.54, 0.45], [0.1, 0.3, 0.25]); L.label(id + 'va', 'Э', x + 75, y + 75, { size: 48, col: '#ffffff', out: null, al: 0.5, font: SERIF });
      for (let i = 0; i < 40; i++) { const hgt = 10 + 46 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)), on = i / 40 < pr; L.rrect(x + 150 + i * 17, y + 75 - hgt / 2, 9, hgt, 4, on ? [1, 0.7, 0.3] : [0.55, 0.45, 0.4], on ? [0.9, 0.45, 0.1] : [0.35, 0.28, 0.25]); }
      L.label(id + 'vn', line.who + (playing ? '  ▶ играет' : ''), x + 150, y + 22, { size: 20, col: '#ffb45a', out: '#120806' });
      L.label(id + 'vd', '0:' + String(Math.floor(16 * (playing ? pr : 1))).padStart(2, '0'), x + w - 40, y + 75, { size: 24, col: '#f6e7c8', out: '#120806', al: 1 }); }
    if (!line.who) { L.solid(0, H - 230, W, 170, [0.02, 0.01, 0.03], 0, 0, 0, 0.72); wrap(line.text, 34, 1500, 'normal').slice(0, 2).forEach((l, i) => L.label(id + 'nar' + i, l, W / 2, H - 170 + i * 46, { size: 34, col: '#f6e7c8', out: '#120806', al: 0.5, weight: 'normal', font: SERIF })); return; }
    panel(bx, by, pw, ph, 18, 0.9); L.uiBox(id, bx, by, pw, ph, 6); L.label(id + 'who', k === 'voice' ? 'Эльф (голосовое)' : line.who, bx + 34, by + 38, { size: 32, col: '#ffb45a', out: '#120806' });
    wrap(line.text, 30, pw - 80, 'normal').slice(0, 3).forEach((l, i) => L.label(id + 't' + i, l, bx + 34, by + 92 + i * 40, { size: 30, col: '#f6e7c8', out: '#120806', weight: 'normal' })); }
  function introOverlay() { const I = ST.intro; if (!I) return; const line = I.lines[Math.min(I.i, I.lines.length - 1)], cg = line ? line.cg : 'cg_pro6';
    if (S.inCg !== cg) { S.inPrev = S.inCg; S.inCg = cg; S.inT = T; } const age = T - (S.inT || T), lage = GT - (I.at || 0);
    const drawCg = (n, al, z, dx) => { if (!n || !has(n)) return; const a = A[n], k = Math.max(W / a.w, H / a.h) * z, w = a.w * k, h = a.h * k; L.sprite(n, (W - w) / 2 + dx, (H - h) / 2, { w, h, u: { alpha: al } }); };
    L.solid(0, 0, W, H, [0.02, 0.01, 0.02]); const z = 1.03 + 0.03 * Math.min(1, age / 10), dx = -14 * Math.min(1, age / 10);
    if (S.inPrev && age < 0.7) drawCg(S.inPrev, 1, 1.06, -14); drawCg(cg, Math.min(1, (S.inPrev ? 0 : 0.2) + age / 0.7), z, dx);
    if (!has(cg)) L.label('inload', 'Загрузка…', W / 2, H / 2, { size: 30, col: '#c9a27a', out: '#120806', al: 0.5 });
    if (line && !I.over) vnLine(I, line, lage, 'in');
    if (line && line.k && line.k !== 'voice' && line.k !== 'notify' && line.k !== 'donate') {}
    if (!I.over) { const sk = SIM.INTRO_SKIP, hv = inRr(sk); L.rrect(sk.x, sk.y, sk.w, sk.h, 14, hv ? [0.5, 0.3, 0.15] : [0.18, 0.1, 0.08], [0.08, 0.04, 0.03], 0.85); L.uiBox('inskip', sk.x, sk.y, sk.w, sk.h, 2);
      L.label('inskip', 'Пропустить ▸▸ Esc', sk.x + sk.w / 2, sk.y + sk.h / 2, { size: 22, col: '#f6e7c8', out: null, al: 0.5 });
      L.label('innext', `${I.i + 1}/${I.lines.length}  ▶ клик или пробел`, W - 60, H - 22, { size: 18, col: '#c9a27a', out: '#120806', al: 1, a: 0.6 + 0.4 * Math.sin(T * 4) }); } }
  // ===== HUD =====
  const HUDT = { orange: [0.95, 0.5, 0.12], dark: [0.07, 0.05, 0.06] };
  function panel(x, y, w, h, r = 12, a = 0.88, border = true) { if (border) L.rrect(x - 2, y - 2, w + 4, h + 4, r + 2, [0.55, 0.3, 0.12], [0.3, 0.14, 0.06], a); L.rrect(x, y, w, h, r, [0.11, 0.07, 0.07], [0.05, 0.03, 0.04], a); }
  function hud() {
    if (ST.intro) { introOverlay(); return; }                                      // v12: the prologue replaces the whole HUD
    if (ST.finale) { finaleOverlay(); return; }                                     // the ending replaces the whole HUD
    const lay = SIM.HUD, K = ST.kir;
    // HP (top-left)
    { const x = 30, y = 26; if (has('probe_prop')) L.sprite('probe_prop', x, y, { w: 92, h: 92 }); L.glow(x + 46, y + 56, 60, WARM, 0.25, 3);
      panel(x + 98, y + 28, 300, 40, 18); const f = Math.max(0, ST.hp) / 100; L.rrect(x + 104, y + 34, 288 * f, 28, 14, [1, 0.62, 0.2], [0.75, 0.25, 0.05]);
      L.uiBox('hp', x + 98, y + 28, 300, 40, 2); L.label('hp', Math.round(ST.hp) + ' HP', x + 248, y + 48, { size: 26, col: '#fff3dc', out: '#3a1204', al: 0.5, font: SERIF }); }
    // money
    { const x = 132, y = 82; const s = ST.money + ' ₽', w = textW(s, 26) + 30; panel(x, y + 4, w, 36, 14, 0.75); L.uiBox('money', x, y + 4, w, 36, 2); L.label('money', s, x + 15, y + 22, { size: 26, col: ST.money < 0 ? '#ff6a5a' : '#ffd76a', out: '#3a1606' }); }
    // place + clock (top-right) and minimap
    L.label('place', 'Тыквенный переулок', W - 36, 40, { size: 30, col: '#f6e7c8', out: '#1a0c08', al: 1 });
    L.label('clock', SIM.clockStr(ST), W - 36, 80, { size: 30, col: '#f6e7c8', out: '#1a0c08', al: 1 });
    L.label('ver', 'версия ' + (SIM.VERSION || ''), W - 36, 104, { size: 16, col: '#a08a70', out: '#1a0c08', al: 1 });
    L.uiBox('place', W - 420, 16, 404, 102, 0);
    minimap(W - 170, 240, 120);
    quests(W - 410, 400);
    // hotbar
    if (!ST.dlg && !ST.mg) { lay.slots.forEach((r, i) => { const n = SIM.SLOTS[i], act = ST.slot === i + 1, cnt = slotCount(n);
        L.rrect(r.x - (act ? 4 : 2), r.y - (act ? 4 : 2), r.w + (act ? 8 : 4), r.h + (act ? 8 : 4), 12, act ? [1, 0.7, 0.25] : [0.45, 0.25, 0.1], act ? [0.9, 0.4, 0.08] : [0.25, 0.12, 0.05], 0.95);
        L.rrect(r.x, r.y, r.w, r.h, 10, [0.14, 0.09, 0.09], [0.06, 0.04, 0.05], 0.95); L.uiBox('slot' + i, r.x, r.y, r.w, r.h, 2);
        if (has('icon_' + n)) { const tn = 'icon_' + n, k = Math.min((r.w - 14) / A[tn].w, (r.h - 14) / A[tn].h), iw = A[tn].w * k, ih = A[tn].h * k;
          L.sprite(tn, r.x + (r.w - iw) / 2, r.y + (r.h - ih) / 2, { w: iw, h: ih, u: { alpha: cnt === 0 ? 0.35 : 1, grade: cnt === 0 ? [0.2, 0.8, 0, 1] : [1, 1, 0, 1] } }); }
        else L.label('sln' + i, SHORT[n], r.x + r.w / 2, r.y + r.h / 2 + 2, { size: 17, col: cnt === 0 ? '#7c6a60' : '#f6e7c8', out: '#120806', al: 0.5 });
        L.label('slk' + i, String((i + 1) % 10), r.x + 8, r.y + 14, { size: 16, col: '#c9a27a', out: '#120806' });
        if (cnt !== null) L.label('slc' + i, cnt === Infinity ? '∞' : String(cnt), r.x + r.w - 8, r.y + r.h - 14, { size: 18, col: '#ffd76a', out: '#120806', al: 1 }); });
      if (ST.hasGun) { const r0 = lay.slots[lay.slots.length - 1], r = { x: r0.x + r0.w + 22, y: r0.y, w: r0.w, h: r0.h }, on = ST.gun;
        L.rrect(r.x - (on ? 4 : 2), r.y - (on ? 4 : 2), r.w + (on ? 8 : 4), r.h + (on ? 8 : 4), 12, on ? [0.4, 1, 0.5] : [0.3, 0.35, 0.3], on ? [0.2, 0.7, 0.3] : [0.15, 0.2, 0.15], 0.95);
        L.rrect(r.x, r.y, r.w, r.h, 10, [0.1, 0.12, 0.1], [0.05, 0.06, 0.05], 0.95); L.uiBox('gunbox', r.x, r.y, r.w, r.h, 2);
        if (has('icon_rifle')) { const k = Math.min((r.w - 10) / A.icon_rifle.w, (r.h - 10) / A.icon_rifle.h), iw = A.icon_rifle.w * k, ih = A.icon_rifle.h * k; L.sprite('icon_rifle', r.x + (r.w - iw) / 2, r.y + (r.h - ih) / 2, { w: iw, h: ih, u: { alpha: on ? 1 : 0.6 } }); }
        L.label('gunk', 'F', r.x + 8, r.y + 14, { size: 16, col: '#c9e2a0', out: '#120806' }); L.label('gunc', String(ST.inv.bb), r.x + r.w - 8, r.y + r.h - 14, { size: 18, col: '#d8ffb0', out: '#120806', al: 1 }); }
      const n = SIM.SLOTS[ST.slot - 1], hint = ST.gun ? 'ПКМ — стрелять шариками, F — убрать' : (SLOTHINT[n] || ''), str = ST.gun ? `Страйкбольный автомат — ${hint}` : `${SIM.SLOT_NAME[n]} — ${hint}`, w = textW(str, 22) + 36, x = W / 2 - w / 2, y = lay.slots[0].y - 50;
      if (!(window.SETTINGS && SETTINGS.hints === false)) { panel(x, y, w, 38, 12, 0.7, false); L.uiBox('slothint', x, y, w, 38, 2); L.label('slothint', str, W / 2, y + 19, { size: 22, col: '#f6e7c8', out: '#120806', al: 0.5 }); } }
    // phone button with unread badge
    { const r = lay.phoneBtn, unread = ST.msgs.filter((m) => !m.read).length, nt = ST.ev.find((e) => e.k === 'notify' && GT - e.t < 0.8), sh = nt ? 6 * Math.sin((GT - nt.t) * 60) : 0;
      if (has('phone_icon')) { const k = Math.min(r.w / A.phone_icon.w, r.h / A.phone_icon.h), iw = A.phone_icon.w * k, ih = A.phone_icon.h * k; L.glow(r.x + r.w / 2, r.y + r.h / 2, 70, [0.6, 0.3, 1], 0.25, 3);
        L.sprite('phone_icon', r.x + (r.w - iw) / 2 + sh, r.y + (r.h - ih) / 2, { w: iw, h: ih }); L.label('tel', 'Tab', r.x + r.w / 2 + sh, r.y + r.h - 8, { size: 18, col: '#c9a27a', out: '#120806', al: 0.5 }); }
      else { panel(r.x + 22 + sh, r.y + 6, 72, 104, 14, 0.95); L.rrect(r.x + 30 + sh, r.y + 16, 56, 80, 6, [0.25, 0.16, 0.35], [0.1, 0.06, 0.16]); L.label('tel', 'Tab', r.x + 58 + sh, r.y + 58, { size: 20, col: '#f6e7c8', out: '#120806', al: 0.5 }); }
      L.uiBox('phonebtn', r.x, r.y, r.w, r.h, 0);
      if (unread) { L.rrect(r.x + 78, r.y - 4, 34, 34, 17, [0.95, 0.15, 0.1], [0.7, 0.05, 0.05]); L.uiBox('badge', r.x + 78, r.y - 4, 34, 34, 0); L.label('badge', String(unread), r.x + 95, r.y + 13, { size: 20, col: '#ffffff', out: '#400000', al: 0.5 }); } }
    // notification card (latest message within 4.5 s)
    { const n = [...ST.ev].reverse().find((e) => e.k === 'notify' && GT - e.t < 4.5); if (n) { const m = [...ST.msgs].reverse().find((q) => q.from === n.from); if (m) { const a = Math.min(1, (4.5 - (GT - n.t)) * 3, (GT - n.t) * 6);
      const lines = wrap(m.text, 22, 520).slice(0, 3), w = 600, h = 56 + lines.length * 28, x = W / 2 - w / 2, y = 18; panel(x, y, w, h, 16, 0.92 * a); L.uiBox('notif', x, y, w, h, 4);
      L.label('nfrom', '💬 ' + m.from, x + 20, y + 26, { size: 22, col: '#ffb45a', out: '#120806', a }); lines.forEach((l, i) => L.label('nl' + i, l, x + 20, y + 58 + i * 28, { size: 21, col: '#f6e7c8', out: '#120806', a })); } } }
    // toasts
    { const list = ST.toasts.slice(-3); list.forEach((q, i) => { const big = q.kind === 'big', sz = big ? 28 : 22, w = textW(q.text, sz) + 44, x = W / 2 - w / 2, y = 190 + i * (big ? 58 : 50), a = Math.min(1, (GT - q.t) * 6, ((big ? 5 : 4) - (GT - q.t)) * 2);
      panel(x, y, w, big ? 50 : 42, 14, 0.85 * a, big); L.uiBox('toast' + i, x, y, w, big ? 50 : 42, 2); L.label('toast' + i, q.text, W / 2, y + (big ? 25 : 21), { size: sz, col: big ? '#ffc56a' : '#f6e7c8', out: '#120806', al: 0.5, a }); }); }
    // prank progress over Kirill's house when refused
    // chalk minigame overlay
    if (ST.chalk) { const c = ST.chalk; c.pts.forEach((p, i) => { const q = P(p[0], p[1]); L.rrect(q[0] - 7, q[1] - 7, 14, 14, 7, c.hit[i] ? [1, 1, 1] : [1, 0.7, 0.3], c.hit[i] ? [0.8, 0.8, 0.9] : [0.8, 0.4, 0.1], c.hit[i] ? 0.5 : 0.95); });
      const left = Math.max(0, 12 - (GT - c.t0)), w = 420, x = W / 2 - w / 2, y = 250; panel(x, y, w, 40, 14); L.rrect(x + 6, y + 6, (w - 12) * left / 12, 28, 12, [1, 0.7, 0.3], [0.8, 0.4, 0.1]); L.uiBox('chalk', x, y, w, 40, 0);
      L.label('chalk', 'Обведи рисунок: ' + Math.round(c.hit.filter(Boolean).length / c.hit.length * 100) + ' %', W / 2, y + 20, { size: 22, col: '#fff', out: '#120806', al: 0.5 }); }
    // charge (TP) and slime hold rings above Kolya
    const kh = S.kolHead || P(ST.x, ST.y, 130);
    if (ST.charge >= 0) { const f = Math.min(1, (GT - ST.charge) / 1.0); L.rrect(kh[0] - 50, kh[1] - 36, 100, 14, 7, [0.1, 0.06, 0.06], [0.1, 0.06, 0.06], 0.8); L.rrect(kh[0] - 48, kh[1] - 34, 96 * f, 10, 5, [1, 1, 0.95], [0.8, 0.8, 0.75]); }
    if (ST.slimeHold > 0.0001) { const f = Math.min(1, ST.slimeHold / 2.5), wt = ST.slimeWait; L.rrect(kh[0] - 50, kh[1] - 36, 100, 14, 7, [0.1, 0.06, 0.06], [0.1, 0.06, 0.06], 0.8); L.rrect(kh[0] - 48, kh[1] - 34, Math.max(6, 96 * f), 10, 5, wt ? [1, 0.75, 0.2] : [0.4, 1, 0.3], wt ? [0.8, 0.5, 0.1] : [0.2, 0.7, 0.1]);
      L.label('slimel', wt ? 'замри, смотрят…' : 'слайм на ручку…', kh[0], kh[1] - 52, { size: 18, col: wt ? '#ffc56a' : '#b8ff9a', out: '#0a1406', al: 0.5 }); }
    if (ST.hidden) L.label('hid', 'спрятался', kh[0], kh[1] - 20, { size: 20, col: '#cfe8c0', out: '#0a1406', al: 0.5 });
    raidHud();
    // hover hint under the cursor
    if (S.state && ST.ptr && !ST.dlg && !ST.phone && !ST.chalk && !ST.mg) { const c = [ST.ptr[0] + cx, ST.ptr[1] + cy], hit = SIM.pick(ST, c); if (hit) { const s = hit.k === 'fest' ? (SIM.FSTALLS.find((q) => q[1] === hit.id) || [])[6] || '' : HOVER[hit.k] || ''; if (s) { const w = textW(s, 20) + 26; L.rrect(ST.ptr[0] + 18, ST.ptr[1] + 14, w, 32, 10, [0.1, 0.06, 0.06], [0.05, 0.03, 0.03], 0.85); L.uiBox('hover', ST.ptr[0] + 18, ST.ptr[1] + 14, w, 32, 2); L.label('hover', s, ST.ptr[0] + 31, ST.ptr[1] + 30, { size: 20, col: '#ffd9a0', out: '#120806' }); } } }
    mgOverlay();
    if (ST.dlg) dialog();
    if (ST.phone) phone();
    achPopups();
    if (ST.hp <= 0) L.label('ko', 'Коля без сил… Идёт домой пить чай', W / 2, H / 2, { size: 44, col: '#ffc56a', out: '#200800', al: 0.5 });
    if (S.arrestA > 0.05) L.label('arrest', 'ЗАДЕРЖАН 🚓', W / 2, H / 2, { size: 64, col: '#ff5a4a', out: '#200000', al: 0.5, a: S.arrestA });
  }
  // Steam-like achievement cards, bottom right above the phone button: slide in, hold, slide out
  const TIERC = { 3: [[1, 0.8, 0.3], '#ffd76a', 'золото'], 2: [[0.8, 0.85, 0.95], '#dfe6f2', 'серебро'], 1: [[0.85, 0.55, 0.3], '#e8a070', 'бронза'] };
  function achIcon(id, x, y, sz, a = 1, grey = false) { const i = SIM.ACH.findIndex((q) => q.id === id); if (i < 0 || !has('ach_icons')) return;
    if (i >= 15) { if (has('ach_icons2')) L.sprite('ach_icons2', x, y, { w: sz, h: sz, src: [(i - 15) / 5, 0, (i - 14) / 5, 1], u: { alpha: a, grade: grey ? [0.15, 0.7, 0, 1] : [1, 1, 0, 1] } }); return; }
    L.sprite('ach_icons', x, y, { w: sz, h: sz, src: [(i % 5) / 5, Math.floor(i / 5) / 3, (i % 5 + 1) / 5, (Math.floor(i / 5) + 1) / 3], u: { alpha: a, grade: grey ? [0.15, 0.7, 0, 1] : [1, 1, 0, 1] } }); }
  function achPopups() { const list = ST.ev.filter((e) => e.k === 'ach' && GT - e.t < 5.6 && GT >= e.t).slice(-3);
    list.forEach((e, k) => { const a = GT - e.t, d = SIM.ACHI[e.id]; if (!d) return; const sl = a < 0.35 ? 1 - ease(a / 0.35) : a > 5.1 ? ease((a - 5.1) / 0.5) : 0, al = 1 - sl;
      const w = 460, h = 104, x = ST.phone ? SIM.HUD.phone.x - w - 24 : W - w - 26, y = H - 300 - (list.length - 1 - k) * (h + 12) + sl * 80, tc = TIERC[d.tier] || TIERC[1];
      L.rrect(x - 2, y - 2, w + 4, h + 4, 14, tc[0], tc[0].map((c) => c * 0.5), 0.95 * al); L.rrect(x, y, w, h, 12, [0.1, 0.07, 0.11], [0.04, 0.03, 0.05], 0.96 * al); L.uiBox('ach' + k, x, y, w, h, 4);
      achIcon(e.id, x + 14, y + 14, 76, al); if (a < 0.9) L.glow(x + 52, y + 52, 70, tc[0], 0.8 * (1 - a / 0.9) * al, 2.5);
      L.label('acht' + k, 'Достижение получено', x + 106, y + 22, { size: 16, col: '#c9a27a', out: '#120806', a: al });
      L.label('achn' + k, d.name, x + 106, y + 48, { size: 23, col: tc[1], out: '#120806', a: al });
      wrap(d.desc, 15, w - 126, 'normal').slice(0, 2).forEach((l, i) => L.label('achd' + k + '_' + i, l, x + 106, y + 72 + i * 18, { size: 15, col: '#e8dcc8', out: '#120806', weight: 'normal', a: al })); }); }
  const SHORT = { eggs: 'Яйца', tp: 'Бумага', bell: 'Звонок', rotten: 'Тыква', alarm: 'Будил.', chalk: 'Мел', fire: 'Петард.', slime: 'Слайм', pizza: 'Пицца', flyers: 'Флаеры' };
  const SLOTHINT = { eggs: 'ПКМ по дому: бросить', tp: 'держи ПКМ и отпусти: бросок на крышу', bell: 'E у любой двери: позвонить и убежать', rotten: 'E у крыльца модера: подменить, G — положить', alarm: 'E у ящика или где угодно: приманка',
    chalk: 'E: рисовать где угодно (у калитки модера — гадость)', fire: 'ПКМ — бросить, E — поджечь под ногами', slime: 'держи E у любой двери', pizza: 'ПКМ/E: заказать в телефоне', flyers: 'E у фонаря: приклеить, у фонаря с флаером — снять' };
  const HOVER = { npc: 'Поговорить', door: 'Постучать: «Сладость или гадость?»', door2: 'Постучать', money: 'Подобрать', vp: 'Подобрать тыкву', rotten: 'Взять гнилую тыкву', drop: 'Поднять гнилую тыкву',
    cat: 'Погладить кота', bowl: 'Взять конфету из миски', bin: 'Пнуть мусорный бак' };
  const ICON = {};
  function slotCount(n) { const I = ST.inv; return { eggs: I.eggs, tp: I.tp, bell: null, rotten: ST.carry === 'rotten' ? 1 : 0, alarm: I.alarm, chalk: I.chalk, fire: I.fire, slime: I.slime, pizza: !ST.target || ST[SIM.MODS[ST.target].key].pr.pizza || ST.courier ? 0 : null, flyers: I.flyers }[n]; }
  function quests(x, y) {
    const K = ST.kir, RV = ST.rai, items = [];
    items.push(['★', 'Сладость или гадость?', true]);
    items.push(['', `Поговорить с жителями (${Math.min(5, ST.q.talk)}/5)`, ST.q.talk >= 5]);
    SIM.MODIDS.forEach((id) => { const k = ST[SIM.MODS[id].key], md = SIM.MODS[id];
      if (!k.refused && !k.sweet) items.push(['', `Постучать к ${md.dat}`, false]);
      else if (k.sweet) items.push(['', `${md.name}: конфеты получены 🍬`, true]);
      else items.push(['', k.done >= 0 ? `Дом ${md.gen} закидан!` : `Закидать дом ${md.gen} (${Math.round(k.p)} %)`, k.done >= 0, k.done >= 0 ? null : k.p / 100]); });
    items.push(['★', 'Украшения для двора', true]);
    items.push(['', ST.q.vera === 0 ? 'Поговорить с Верой' : ST.q.vera === 1 ? `Найти пропавшие тыквы (${ST.vp.filter((v) => v >= 0).length}/3)` : 'Тыквы вернулись к Вере', ST.q.vera === 2]);
    if (ST.q.vera === 2) items.push(['', 'Костюм из сундука Веры (по желанию)', !!ST.costume]);
    { const F = ST.fest || {}, n = [F.carves, F.apples, F.stage, F.gacha && F.gacha.pulls].filter(Boolean).length;           // v12
      items.push(['☆', 'Праздник на площади', true]); items.push(['', !F.seen ? 'Найти праздник: ворота в южном заборе' : `Мини-игры: ${n}/4 (тыква, яблоки, сцена, гача)`, n >= 4]); }
    items.push(['☆', 'Странные огни', true]);
    items.push(['', 'Осмотреть источник света на окраине района', ST.q.strange > 0]);
    if (K.done >= 0 && (K.auction > 0 || K.revengeAt < 0)) { items.push(['☠', 'Месть Кирилла', true]); items.push(['', `Трусы на аукционе: продано лотов ${K.auction}`, false]); }
    if (RV.virus) { items.push(['☠', 'Месть Райвы', true]); const v = RV.virus;
      items.push(['', v.st === 'pending' ? 'Райва прислал «мем» в чат…' : v.st === 'download' ? 'Что-то скачивается в телефон…' : `Вирус «КотоМем»: покупок ${RV.junk.length}, списано ${RV.junk.reduce((a, j) => a + j.price, 0)} ₽`, false]); }
    if (ST.q.home) { items.push(['⌂', 'Домой', true]); items.push(['', 'Все модеры обойдены. Вернуться домой — там что-то происходит…', false]); }
    for (const who of Object.keys(ST.loans || {})) { const Ln = ST.loans[who]; if (Ln.paid) continue; items.push(['', Ln.over ? `${who} помогает модерам (долг ${Ln.amt} ₽ не вернул)` : `Вернуть ${who === 'Скелет' ? 'Скелету' : 'Тимофею'} ${Ln.amt} ₽ до 01:00`, false]); }
    if (ST.raid) { const RD = ST.raid; items.push(['☠', 'Месть Эльфа', true]);
      items.push(['', RD.st === 'search' ? `Полиция и военные ищут тебя. Прячься в толпе, в кустах, в мусорке или в тёмном переулке (задержаний: ${RD.arrests})` : 'Сирены всё ближе…', false]); }
    L.label('qhead', 'Задания', x + 8, y, { size: 30, col: '#f6e7c8', out: '#120806' }); L.solid(x + 8, y + 22, 380, 2, [0.6, 0.4, 0.2], 0, 0, 0, 0.8);
    let yy = y + 56;
    items.forEach(([ic, s, done, bar], i) => { if (ic) { L.label('qi' + i, ic, x + 8, yy, { size: 24, col: '#ffb030', out: '#120806' }); L.label('qt' + i, s, x + 40, yy, { size: 22, col: '#ffc56a', out: '#120806' }); }
      else { L.rrect(x + 14, yy - 9, 18, 18, 3, done ? [0.9, 0.6, 0.2] : [0.2, 0.15, 0.13], done ? [0.7, 0.4, 0.1] : [0.12, 0.09, 0.08], 0.95); if (done) L.label('qc' + i, '✓', x + 23, yy, { size: 18, col: '#200a00', out: null, al: 0.5 });
        const lines = wrap(s, 20, 340, 'normal'); lines.forEach((l, j) => L.label('qt' + i + '_' + j, l, x + 42, yy + j * 26, { size: 20, col: done ? '#a08a70' : '#e8dcc8', out: '#120806', weight: 'normal' })); yy += (lines.length - 1) * 26;
        if (bar !== undefined && bar !== null) { yy += 22; L.rrect(x + 42, yy - 7, 300, 12, 6, [0.15, 0.1, 0.1], [0.15, 0.1, 0.1], 0.9); L.rrect(x + 43, yy - 6, 298 * bar, 10, 5, [1, 0.62, 0.2], [0.85, 0.3, 0.05]); } }
      yy += 34; });
    L.uiBox('quests', x - 10, y - 26, 420, yy - y + 10, 0);
  }
  function minimap(X, Y, R) {
    const cam = [ST.x, ST.y], sc = 0.085;
    cvTex('minimap', 2 * R + 20, 2 * R + 20, (g) => { const c = R + 10; g.save(); g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.clip();
      g.fillStyle = '#1a1416'; g.fillRect(0, 0, 2 * c, 2 * c);
      const mp = (x, y) => { const a = SIM.proj(x, y), b = SIM.proj(cam[0], cam[1]); return [c + (a[0] - b[0]) * sc, c + (a[1] - b[1]) * sc]; };
      const quad = (x0, y0, x1, y1, col) => { const p = [mp(x0, y0), mp(x1, y0), mp(x1, y1), mp(x0, y1)]; g.fillStyle = col; g.beginPath(); g.moveTo(...p[0]); p.slice(1).forEach((q) => g.lineTo(...q)); g.fill(); };
      quad(SIM.X0 - 2000, -2600, SIM.X1 + 2000, 2200, '#241a14');
      SIM.HOUSES.forEach((h) => quad(h.x0 - 120, h.y1, h.x1 + 120, SIM.SWN[0], '#2b2414'));
      quad(SIM.X0 - 2000, SIM.SWN[0], SIM.X1 + 2000, SIM.SWS[1], '#4a3f3a'); quad(SIM.X0 - 2000, SIM.ROAD[0], SIM.X1 + 2000, SIM.ROAD[1], '#2c2a30');
      quad(...SIM.ALLEY, '#1d1b20'); quad(...SIM.ENDLOT, '#1d1b20');
      SIM.HOUSES.forEach((h) => { const md = SIM.MODS[h.id], home = h.id === 'kolya'; quad(h.x0, h.y0, h.x1, h.y1, md ? MODC[h.id].mm : home ? '#2e5a7a' : '#5a4636'); const q = mp((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2);
        g.fillStyle = md ? '#ff8c2a' : home ? (ST.q.home && Math.floor(GT * 3) % 2 ? '#ffffff' : '#8ad0ff') : '#e8a050'; g.font = 'bold 15px ' + FONT; g.textAlign = 'center'; g.fillText(md ? '★' : '⌂', q[0], q[1] + 5); });
      SIM.LAMPS.forEach(([x, y]) => { const q = mp(x, y); g.fillStyle = '#ffcf80'; g.fillRect(q[0] - 1.5, q[1] - 1.5, 3, 3); });
      if (ST.q.vera === 1) SIM.VPUMPKINS.forEach((p, i) => { if (ST.vp[i] < 0) { const q = mp(...p); g.fillStyle = '#ff9a2a'; g.beginPath(); g.arc(q[0], q[1], 3.5, 0, 6.3); g.fill(); } });
      ST.npc.forEach((n) => { const q = mp(n.x, n.y); g.fillStyle = '#e0d0b0'; g.beginPath(); g.arc(q[0], q[1], 2.5, 0, 6.3); g.fill(); });
      if (ST.raid && ST.raid.st !== 'wait') { const fl = Math.floor(GT * 4) % 2; ST.raid.cars.forEach((c) => { const q = mp(c.x, c.y); g.fillStyle = fl ? '#ff3030' : '#3070ff'; g.fillRect(q[0] - 5, q[1] - 3, 10, 6); });
        ST.raid.units.forEach((u) => { const q = mp(u.x, u.y); g.fillStyle = u.st === 'chase' ? '#ff2a2a' : u.kind === 'police' ? '#5a8aff' : '#8aa060'; g.beginPath(); g.arc(q[0], q[1], 4, 0, 6.3); g.fill(); }); }
      const k = mp(cam[0], cam[1]); g.translate(k[0], k[1]); g.rotate(ST.ang || 0); g.fillStyle = '#5aa0ff'; g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -6); g.lineTo(-3, 0); g.lineTo(-6, 6); g.closePath(); g.fill();
      if (virusGlitch()) glitchCanvas(g, 2 * c, 2 * c, 0.8);
      g.restore(); g.strokeStyle = '#8a5a2a'; g.lineWidth = 6; g.beginPath(); g.arc(c, c, R - 2, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#2a1408'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, R - 6, 0, Math.PI * 2); g.stroke(); }, 20);
    L.sprite('minimap', X - R - 10, Y - R - 10, { w: 2 * R + 20, h: 2 * R + 20 }); L.uiBox('minimap', X - R - 10, Y - R - 10, 2 * R + 20, 2 * R + 20, 0);
  }
  function dialog() {
    const d = ST.dlg, lay = SIM.dlgLayout(ST), p = lay.panel, name = SIM.MODS[d.who] ? SIM.MODS[d.who].name : d.who === 'vera' ? 'Вера' : d.who;
    if (d.cg && has(d.cg)) { if (S.cgDlg !== d) { S.cgDlg = d; S.cgT0 = T; } const a = A[d.cg], f = Math.min(1, 0.3 + (T - S.cgT0) / 0.3), hh = 600 + 30 * f, ww = hh * a.w / a.h, x = W / 2 - ww / 2, y = p.y - hh - 26;   // forgiven: the picture over the dialog
      panel(x - 10, y - 10, ww + 20, hh + 20, 18, 0.95 * f); L.sprite(d.cg, x, y, { w: ww, h: hh, u: { alpha: f } }); }
    panel(p.x, p.y, p.w, p.h, 18, 0.94); L.uiBox('dlg', p.x, p.y, p.w, p.h, 6);
    const por = d.who === 'kirill' ? 'kirill_se' : d.who === 'vera' ? 'npc_witch_se' : null; L.rrect(p.x + 20, p.y + 20, 120, 120, 14, [0.2, 0.14, 0.2], [0.08, 0.05, 0.08]);
    const pf = { raiva: ['rf_se_act', ST.rai.refused ? 1 : 0], elf: ['ef_se_act', ST.elf.sweet ? 5 : ST.elf.refused ? 1 : 0] }[d.who];
    if (pf && has(pf[0])) { const m = KF[pf[0]], ch = 0.34 * m.fh, cw = ch * 100 / 110, cx0 = pf[1] * m.fw + m.ax - cw / 2, tw = m.n * m.fw;
      L.sprite(pf[0], p.x + 30, p.y + 26, { w: 100, h: 110, src: [cx0 / tw, 0.02, (cx0 + cw) / tw, 0.02 + ch / m.fh] }); }
    else if (por && has(por)) L.sprite(por, p.x + 30, p.y + 26, { w: 100, h: 110, src: por === 'npc_witch_se' ? [0.14, 0.0, 0.86, 0.335] : [0.12, 0.0, 0.88, 0.3] }); else drawPortrait(p.x + 80, p.y + 80);
    L.label('dlgname', name, p.x + 160, p.y + 36, { size: 28, col: '#ffb45a', out: '#120806' });
    wrap(d.text, 25, p.w - 200, 'normal').slice(0, 3).forEach((l, i) => L.label('dlgt' + i, l, p.x + 160, p.y + 76 + i * 32, { size: 25, col: '#f6e7c8', out: '#120806', weight: 'normal' }));
    lay.choices.forEach((r, i) => { const hov = ST.ptr && ST.ptr[0] > r.x && ST.ptr[0] < r.x + r.w && ST.ptr[1] > r.y && ST.ptr[1] < r.y + r.h;
      L.rrect(r.x, r.y, r.w, r.h, 14, hov ? [1, 0.65, 0.25] : [0.55, 0.3, 0.12], hov ? [0.85, 0.35, 0.08] : [0.32, 0.15, 0.06], 0.95); L.uiBox('ch' + i, r.x, r.y, r.w, r.h, 4);
      L.label('ch' + i, (i + 1) + '. ' + TR(d.choices[i][0]), r.x + r.w / 2, r.y + r.h / 2, { size: 22, col: '#fff3dc', out: '#200a00', al: 0.5 }); });
  }
  function drawPortrait(X, Y) { L.rrect(X - 30, Y - 10, 60, 60, 26, [0.32, 0.16, 0.36], [0.2, 0.1, 0.22]); L.rrect(X - 22, Y - 44, 44, 44, 22, [0.95, 0.75, 0.6], [0.8, 0.55, 0.45]); L.solid(X - 40, Y - 52, 80, 10, [0.15, 0.08, 0.2]); L.solid(X - 14, Y - 90, 28, 40, [0.15, 0.08, 0.2], 0.1); }
  // Raiva's virus: the map (and now and then the whole phone) glitches — shifted slices, colour fringes, error text
  const virusGlitch = () => { const v = ST.rai && ST.rai.virus; if (!v || v.st !== 'active') return false; const a = GT - v.t1; return a < 2 || a % 7 < 1.1 || (a % 13 > 6 && a % 13 < 6.25); };
  function glitchCanvas(g, w, h, amt) { const seed = Math.floor(GT * 12);
    for (let k = 0; k < 7; k++) { const y = Math.floor(L.rnd(seed, k) * h), hh = 6 + Math.floor(L.rnd(k, seed) * 40 * amt), dx = Math.round((L.rnd(seed + 3, k) - 0.5) * 70 * amt);
      try { g.drawImage(g.canvas, 0, y, w, hh, dx, y, w, hh); } catch (e) {} }
    g.globalCompositeOperation = 'lighter'; g.fillStyle = `rgba(255,0,80,${0.08 * amt})`; g.fillRect(3, 0, w, h); g.fillStyle = `rgba(0,200,255,${0.08 * amt})`; g.fillRect(-3, 0, w, h); g.globalCompositeOperation = 'source-over';
    if (L.rnd(seed, 9) < 0.6) { g.font = 'bold 22px ' + FONT; g.fillStyle = '#ff3a6a'; g.textAlign = 'center'; g.fillText(['ОШИБКА 0x7F', 'КОТ.EXE', 'MEOW_OVERFLOW', 'ГЕОЛОКАЦИЯ???'][seed % 4], w / 2 + (L.rnd(seed, 5) - 0.5) * 60, h * (0.3 + 0.4 * L.rnd(seed, 6))); } }
  function phone() {
    const p = SIM.HUD.phone, ph = ST.phone, items = SIM.phoneLayout(ST), sl = Math.max(0, 1 - (GT - ph.t) / 0.18), ox = sl * 500;
    cvTex('phone', p.w, p.h, (g) => {
      const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
      g.fillStyle = '#2a2226'; rr(0, 0, p.w, p.h, 46); g.fill(); g.fillStyle = '#0e0b10'; rr(12, 12, p.w - 24, p.h - 24, 38); g.fill();
      const grd = g.createLinearGradient(0, 0, 0, p.h); grd.addColorStop(0, '#2b1638'); grd.addColorStop(1, '#0b0610'); g.fillStyle = grd; rr(18, 18, p.w - 36, p.h - 36, 34); g.fill();
      g.fillStyle = '#000'; rr(p.w / 2 - 60, 22, 120, 26, 13); g.fill();
      g.font = 'bold 19px ' + FONT; g.fillStyle = '#f0e6ff'; g.textAlign = 'left'; g.fillText(SIM.clockStr(ST), 44, 42); g.textAlign = 'right'; g.fillText('31.10  ▮▮▮', p.w - 44, 42);
      const T2 = (s, x, y, size = 20, col = '#f6e7c8', al = 'left', w = 'bold') => { g.font = `${w} ${size}px ${FONT}`; g.fillStyle = col; g.textAlign = al; g.fillText(s, x, y); };
      const btn = (id, label, col = '#ff8c2a') => { const b = items.find((q) => q.id === id); if (!b) return; const x = b.x - p.x, y = b.y - p.y; g.fillStyle = col; rr(x, y, b.w, b.h, 12); g.fill();
        g.font = 'bold 19px ' + FONT; const fs = Math.max(12, Math.min(19, 19 * (b.w - 24) / Math.max(1, g.measureText(label).width))); T2(label, x + b.w / 2, y + b.h / 2 + fs * 0.37, fs, '#1a0a02', 'center'); };   // the label shrinks to fit
      btn('close', '✕', '#5a3a4a'); if (ph.app !== 'home') btn('home', '‹ Назад', '#5a3a4a');
      if (ph.app === 'home') { T2(SIM.clockStr(ST), p.w / 2, 170, 58, '#ffffff', 'center'); T2('пятница, 31 октября', p.w / 2, 202, 18, '#c8b8e0', 'center', 'normal');
        const AP = { map: ['Карта', '#3a7a5a'], chats: ['Чаты', '#3a5aa0'], light: [ST.light ? 'Фонарик: вкл' : 'Фонарик', ST.light ? '#e0b030' : '#6a6060'], shop: ['Магазин', '#c05a20'], pizza: ['Пицца', '#b03030'], orders: ['Покупки', '#6a4a9a'],
          contacts: ['Контакты', '#2a8a7a'], ach: ['Достижения', '#9a7420'], dev: ['Консоль', '#2a2a30'] };
        items.filter((b) => AP[b.id]).forEach((b) => { const x = b.x - p.x, y = b.y - p.y, [lab, col] = AP[b.id]; g.fillStyle = col; rr(x + 10, y, 90, 90, 22); g.fill();
          g.fillStyle = b.id === 'dev' ? '#5aff8a' : 'rgba(255,255,255,0.85)'; g.font = 'bold ' + (b.id === 'dev' ? 32 : 40) + 'px ' + FONT; g.textAlign = 'center'; g.fillText({ map: '⌖', chats: '✉', light: '☀', shop: '₽', pizza: '◔', orders: '☰', contacts: '☎', ach: '★', dev: '>_' }[b.id], x + 55, y + 60);
          T2(lab, x + 55, y + 120, 17, '#f0e6ff', 'center');
          if (b.id === 'chats') { const u = ST.msgs.filter((m) => !m.read).length; if (u) { g.fillStyle = '#e02020'; g.beginPath(); g.arc(x + 96, y + 6, 15, 0, 6.3); g.fill(); T2(String(u), x + 96, y + 13, 17, '#fff', 'center'); } } });
        T2('Совет: на Хэллоуин все модеры дома 🎃', p.w / 2, p.h - 60, 17, '#c8b8e0', 'center', 'normal'); }
      const field = (ph2) => { g.fillStyle = 'rgba(0,0,0,0.55)'; rr(30, p.h - 128, p.w - 60, 46, 14); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.5; rr(30, p.h - 128, p.w - 60, 46, 14); g.stroke();
        if (!window.__typing) T2(ph2, 46, p.h - 98, 16, '#8a7aa0', 'left', 'normal'); };
      if (ph.app === 'contacts') { T2('Контакты', p.w / 2, 150, 26, '#fff', 'center');
        SIM.CONTACTS.forEach((n, i) => { const b = items.find((q) => q.id === 'dm_' + n); if (!b) return; const x = b.x - p.x, y = b.y - p.y, c = CONT[n], Ln = (ST.loans || {})[n];
          g.fillStyle = i % 2 ? '#22182a' : '#2a1e32'; rr(x, y, b.w, b.h, 14); g.fill(); g.fillStyle = c[0]; g.beginPath(); g.arc(x + 44, y + b.h / 2, 28, 0, 6.3); g.fill();
          T2(c[2], x + 44, y + b.h / 2 + 9, 26, '#fff', 'center'); T2(n, x + 86, y + 34, 21, '#f6e7c8'); T2(c[1], x + 86, y + 60, 15, '#a898c0', 'left', 'normal');
          if (SIM.LOANS[n]) T2(Ln ? (Ln.paid ? 'долг вернул ✓' : Ln.over ? 'помогает модерам!' : `долг ${Ln.amt} ₽ до 01:00`) : 'даст в долг 1 раз', x + b.w - 14, y + 34, 14, Ln && !Ln.paid ? '#ff9a6a' : '#9ad08a', 'right', 'normal');
          const un = ST.msgs.filter((m) => !m.read && (n === SIM.CONTACTS[0] ? m.group : m.from === n && !m.group)).length; if (un) { g.fillStyle = '#e02020'; g.beginPath(); g.arc(x + b.w - 22, y + 62, 12, 0, 6.3); g.fill(); T2(String(un), x + b.w - 22, y + 68, 15, '#fff', 'center'); } }); }
      if (ph.app === 'dm') { const n = ph.who, c = CONT[n] || ['#444', '', '?'], list = (ST.dm || {})[n] || [];
        g.fillStyle = c[0]; g.beginPath(); g.arc(p.w / 2 - 70, 148, 20, 0, 6.3); g.fill(); T2(c[2], p.w / 2 - 70, 155, 18, '#fff', 'center'); T2(n, p.w / 2 - 40, 156, 24, '#fff'); T2(c[1], p.w / 2 - 40, 178, 14, '#a898c0', 'left', 'normal');
        const lim = items.some((q) => q.id === 'loan' || q.id === 'repay' || q.id === 'vplay') ? p.h - 202 : p.h - 142; let y = lim;
        const FC = { 'Кирилл': '#ffb45a', 'Райва': '#7ab0ff', 'Эльф': '#9af0d0', 'Скелет': '#c8c8c8', 'Тимофей': '#d0a0ff' };
        for (const m of [...list].reverse().slice(Math.min(Math.max(0, list.length - 3), Math.floor((ph.scroll || 0) / 3)))) { const nm = !m.me && m.from ? 20 : 0, lines = wrap(m.text, 17, p.w - 150, 'normal'), h = 18 + nm + lines.length * 21, w = Math.min(p.w - 110, Math.max(nm ? textW(m.from, 15) : 0, ...lines.map((l) => textW(l, 17))) + 30); y -= h + 8; if (y < 196) break;
          const x = m.me ? p.w - 36 - w : 36; g.fillStyle = m.me ? '#3a6a4a' : '#2e2440'; rr(x, y, w, h, 14); g.fill(); if (nm) T2(m.from, x + 15, y + 22, 15, FC[m.from] || '#ffb45a');   // the group chat: who said it
          lines.forEach((l, i) => T2(l, x + 15, y + 26 + nm + i * 21, 17, '#f0e6ff', 'left', 'normal')); }
        if (!list.length) T2(SIM.LOANS[n] ? 'Можно написать или попросить в долг' : 'Напиши что-нибудь…', p.w / 2, 320, 16, '#8a7aa0', 'center', 'normal');
        btn('vplay', window.__vplaying ? '❚❚ Голосовое Эльфа играет…' : '▶ Голосовое Эльфа · 0:16', '#9af0d0');   // v12: the voice note from the prologue
        btn('loan', `Попросить в долг ${SIM.LOANS[n] || 0} ₽`, '#ffb45a'); const Ln = (ST.loans || {})[n]; if (Ln) btn('repay', `Вернуть долг ${Ln.amt} ₽`, ST.money >= Ln.amt ? '#8ad06a' : '#5a4a4a');
        field('Напиши сообщение и нажми Enter…'); }
      if (ph.app === 'dev') { g.fillStyle = '#05080a'; rr(24, 116, p.w - 48, p.h - 260, 18); g.fill(); T2('>_ консоль разработчика', 44, 146, 18, '#5aff8a', 'left', 'bold');
        let y = p.h - 170; const L2 = []; g.font = `14px ui-monospace, Menlo, Consolas, monospace`;
        const mwrap = (str, maxW) => { const out = []; let line = ''; for (const w of str.split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = '  ' + w; } else line = t; } out.push(line); return out; };   // wrap in the monospace font it is drawn with
        for (const m of [...(ST.devLog || [])].reverse()) { const lines = mwrap((m.me ? '> ' : '') + (m.me ? m.text : TR(m.text)), p.w - 96); for (let i = lines.length - 1; i >= 0; i--) L2.push([lines[i], m.me]); }
        const off = Math.min(Math.max(0, L2.length - 8), ph.scroll || 0);                    // v12: the wheel scrolls back through the log (every command of help fits)
        for (const [l, me] of L2.slice(off)) { if (y < 170) break; g.fillStyle = me ? '#ffd76a' : '#9affb4'; g.textAlign = 'left'; g.fillText(l, 42, y); y -= 19; }
        if (L2.length > 24) { g.fillStyle = '#4a7a5a'; g.textAlign = 'right'; g.fillText(off ? TR('↓ колесо вниз — к новым') : TR('↑ колесо вверх — к старым'), p.w - 44, 146); }
        field('команда, например: money 5000 · help'); }
      if (ph.app === 'map') phoneMap(g, p, ph, rr, T2);
      if (ph.app === 'ach') phoneAch(g, p, ph, rr, T2);
      if (ph.app === 'chats') { T2('Чаты', p.w / 2, 150, 26, '#fff', 'center');                   // v12: a list of conversations, each opens its own thread
        const dm = ST.dm || {}, rows = items.filter((q) => q.id.startsWith('dm_'));
        if (!rows.length) T2('Пока никто не писал', p.w / 2, 320, 16, '#8a7aa0', 'center', 'normal');
        rows.forEach((b, i) => { const n = b.id.slice(3), x = b.x - p.x, y = b.y - p.y, c = CONT[n] || ['#4a3a5a', '', n.slice(0, 1)], th = dm[n] || [], last = th[th.length - 1];
          g.fillStyle = i % 2 ? '#22182a' : '#2a1e32'; rr(x, y, b.w, b.h, 14); g.fill(); g.fillStyle = c[0]; g.beginPath(); g.arc(x + 40, y + b.h / 2, 26, 0, 6.3); g.fill();
          T2(c[2], x + 40, y + b.h / 2 + 9, 24, '#fff', 'center'); T2(n, x + 80, y + 30, 20, '#f6e7c8');
          if (last) { const pre = (last.me ? TR('Вы: ') : n === SIM.CONTACTS[0] && last.from ? TR(last.from) + ': ' : '') + TR(last.text); let s2 = pre; g.font = 'normal 15px ' + FONT;
            while (s2.length > 4 && g.measureText(s2).width > b.w - 130) s2 = s2.slice(0, -2); if (s2 !== pre) s2 = s2.trimEnd() + '…'; T2(s2, x + 80, y + 56, 15, '#b8a8d0', 'left', 'normal');
            T2(SIM.clockStr({ gt: last.gt || 0 }), x + b.w - 14, y + 30, 13, '#8a7aa0', 'right', 'normal'); }
          const un = ST.msgs.filter((m) => !m.read && (n === SIM.CONTACTS[0] ? m.group : m.from === n && !m.group)).length; if (un) { g.fillStyle = '#e02020'; g.beginPath(); g.arc(x + b.w - 22, y + 56, 12, 0, 6.3); g.fill(); T2(String(un), x + b.w - 22, y + 62, 15, '#fff', 'center'); } });
        const tot = SIM.chatList(ST).length; if (tot > 7) T2(TR('колесо — ещё чаты') + ` (${Math.min(tot, (ph.scroll || 0) + 7)}/${tot})`, p.w / 2, p.h - 150, 13, '#8a7aa0', 'center', 'normal');
        const v = ST.rai.virus; if (v && v.st === 'download') { const f = Math.min(1, (GT - v.t0) / 3.2); g.fillStyle = 'rgba(10,6,16,0.92)'; rr(40, 300, p.w - 80, 190, 18); g.fill();
          T2('Загрузка «КотоМем.apk»', p.w / 2, 350, 21, '#ffffff', 'center'); T2('(=^･ω･^=) ' + Math.round(f * 100) + ' %', p.w / 2, 392, 26, '#9ad0ff', 'center');
          g.fillStyle = '#2a2a3a'; rr(70, 420, p.w - 140, 22, 11); g.fill(); g.fillStyle = '#5ac0ff'; rr(70, 420, (p.w - 140) * f, 22, 11); g.fill(); T2('не выключайте телефон', p.w / 2, 470, 14, '#a090b0', 'center', 'normal'); } }
      if (ph.app === 'shop') { T2('«Неожиданные находки»', p.w / 2, 140, 22, '#ffb45a', 'center'); T2('Баланс: ' + ST.money + ' ₽', p.w / 2, 168, 18, '#f0e6ff', 'center', 'normal');
        SIM.SHOP.forEach((it, i) => { const y = 182 + i * 47; g.fillStyle = i % 2 ? '#22182a' : '#2a1e32'; rr(30, y - 3, p.w - 60, 44, 10); g.fill();
          T2(it.name, 46, y + 15, 16, it.kind === 'gift' ? '#ffd0f0' : it.kind === 'ammo' ? '#c9f0a0' : '#f6e7c8'); T2((it.kind === 'gift' ? 'подарок · ' : it.kind === 'ammo' ? 'для автомата · ' : '') + it.price + ' ₽', 46, y + 33, 14, '#c8b8a0', 'left', 'normal');
          btn('buy_' + it.id, 'Купить', ST.money >= it.price ? '#ff8c2a' : '#5a4a4a'); }); }
      if (ph.app === 'pizza') { T2('Пиццерия «Тыква»', p.w / 2, 170, 26, '#ffb45a', 'center');
        const tg = ST.target ? SIM.MODS[ST.target] : null, tk = tg ? ST[tg.key] : null;
        ['Доставка за 15 минут или пицца бесплатно (почти).', '', 'Адрес: Тыквенный пер., ' + (tg ? 'дом ' + tg.gen : '— сначала постучи к модеру'), 'Заказ: 10 × «Пепперони»', 'Оплата: при получении (￢‿￢)'].flatMap((l) => l ? wrap(l, 19, p.w - 90, 'normal') : ['']).forEach((l, i) => T2(l, p.w / 2, 260 + i * 34, 19, '#f0e6ff', 'center', 'normal'));
        const done = !tg || tk.pr.pizza || ST.courier || tk.done >= 0; btn('order_pizza', !tg ? 'Нет адреса' : done ? 'Заказ уже в пути / доставлен' : 'Заказать 10 пицц: ' + tg.dat, done ? '#5a4a4a' : '#ff8c2a'); }
      if (ph.app === 'orders') { T2('Мои покупки', p.w / 2, 156, 26, '#fff', 'center'); const J = ST.rai.junk;
        if (!J.length) T2('Покупок пока нет (^_^)', p.w / 2, 300, 19, '#c8b8e0', 'center', 'normal');
        else { J.slice(-9).reverse().forEach((j, i) => { const y = 200 + i * 58; g.fillStyle = i % 2 ? '#22182a' : '#2a1e32'; rr(30, y - 4, p.w - 60, 50, 10); g.fill();
            wrap(j.name, 16, p.w - 170, 'bold').slice(0, 2).forEach((l, k2) => T2(l, 46, y + 18 + k2 * 18, 15, '#f6e7c8')); T2('−' + j.price + ' ₽', p.w - 46, y + 26, 16, '#ff7a6a', 'right'); });
          T2('Итого списано: ' + J.reduce((a, j) => a + j.price, 0) + ' ₽', p.w / 2, p.h - 64, 18, '#ffb45a', 'center'); T2('(я этого не заказывал…)', p.w / 2, p.h - 40, 14, '#a090b0', 'center', 'normal'); } }
      if (virusGlitch() && ph.app !== 'map') glitchCanvas(g, p.w, p.h, 0.5);
    }, 30);
    L.sprite('phone', p.x + ox, p.y, { w: p.w, h: p.h }); L.uiBox('phone', p.x, p.y, p.w, p.h, 0);
  }

  // phone «Достижения»: 15 achievements, hardest first; got this game (✓), got in an earlier game (ранее), progress for counters
  const assetUrl = (n) => (window.ASSET_URL ? window.ASSET_URL(n) : 'assets/' + n + '.png');
  const ACHIMG = new Image(); ACHIMG.src = assetUrl('ach_icons');                     // the phone draws on a 2D canvas: its own copy of the icon atlas
  function phoneAch(g, p, ph, rr, T2) {
    const G0 = window.ACHG || {}, got = (id) => (ST.ach && ST.ach[id]) ? 1 : G0[id] ? 2 : 0, n = SIM.ACH.filter((a) => got(a.id)).length, sc = Math.max(0, Math.min(SIM.ACH.length - 7, ph.scroll || 0));
    T2('Достижения', p.w / 2, 148, 26, '#fff', 'center'); T2(`Получено ${n} из ${SIM.ACH.length}`, p.w / 2, 176, 16, '#c8b8e0', 'center', 'normal');
    const TC = { 3: '#ffd76a', 2: '#dfe6f2', 1: '#e8a070' };
    for (let r = 0; r < 7; r++) { const i = r + sc, a = SIM.ACH[i]; if (!a) break; const y = 194 + r * 84, st = got(a.id);
      g.fillStyle = st ? '#2e2240' : '#1a1520'; rr(28, y, p.w - 56, 78, 12); g.fill(); g.fillStyle = TC[a.tier]; g.globalAlpha = st ? 0.9 : 0.3; rr(28, y, 5, 78, 2); g.fill(); g.globalAlpha = 1;
      if (ACHIMG.complete && ACHIMG.naturalWidth) { const cw = ACHIMG.naturalWidth / 5, ch = ACHIMG.naturalHeight / 3; g.save(); if (!st) { g.globalAlpha = 0.4; g.filter = 'grayscale(1) brightness(0.7)'; }
        g.drawImage(ACHIMG, (i % 5) * cw, Math.floor(i / 5) * ch, cw, ch, 40, y + 8, 62, 62); g.restore(); }
      g.font = 'bold 17px ' + FONT; const nw = g.measureText(a.name).width, fs = Math.max(12, Math.min(17, 17 * 250 / Math.max(1, nw)));
      T2(a.name, 112, y + 25, fs, st ? TC[a.tier] : '#9a8aa8', 'left', 'bold');
      wrap(a.desc, 13, 262, 'normal').slice(0, 2).forEach((l, k) => T2(l, 112, y + 45 + k * 16, 13, st ? '#e8dcc8' : '#8a7a98', 'left', 'normal'));
      if (st === 1) T2('✓', p.w - 42, y + 28, 22, '#8ad06a', 'right'); else if (st === 2) T2('ранее', p.w - 40, y + 25, 12, '#a0c890', 'right', 'normal');
      else { const pr = SIM.achProgress(ST, a.id); if (pr) T2(pr[0] + '/' + pr[1], p.w - 40, y + 25, 14, '#ffb45a', 'right'); } }
    if (sc < SIM.ACH.length - 7) T2('▼ колесо мыши — ещё', p.w / 2, p.h - 26, 13, '#8a7aa0', 'center', 'normal'); else if (sc > 0) T2('▲ колесо мыши — назад', p.w / 2, p.h - 26, 13, '#8a7aa0', 'center', 'normal'); }
  // phone «Карта»: a tilted 3D night map of the street (perspective camera over Kolya): houses extrude and rise when the app opens,
  // windows flicker, lamps pool light, people move live, quest markers bob, the camera drifts a little
  function phoneMap(g, p, ph, rr, T2) {
    const X0 = 24, Y0 = 116, MW = p.w - 48, MH = p.h - 196, age = ph.at === undefined ? 9 : GT - ph.at, intro = ease(Math.min(1, age / 0.9)), K = ST.kir;
    g.save(); rr(X0, Y0, MW, MH, 24); g.clip();
    const bg = g.createLinearGradient(0, Y0, 0, Y0 + MH); bg.addColorStop(0, '#05030a'); bg.addColorStop(1, '#170c1d'); g.fillStyle = bg; g.fillRect(X0, Y0, MW, MH);
    const pitch = (82 - 34 * intro) * Math.PI / 180, dist = 5400 - 2200 * intro, yaw = -0.42 * intro + 0.05 * Math.sin(T * 0.27), fo = 700;
    const tx = Math.max(SIM.X0 + 600, Math.min(SIM.X1 - 900, ST.x + 250)), ty = -380;
    const F = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), -Math.sin(pitch)], Rv = [-Math.sin(yaw), Math.cos(yaw), 0];
    const U = [F[1] * Rv[2] - F[2] * Rv[1], F[2] * Rv[0] - F[0] * Rv[2], F[0] * Rv[1] - F[1] * Rv[0]], cam = [tx - F[0] * dist, ty - F[1] * dist, -F[2] * dist];
    const ccx = X0 + MW / 2, ccy = Y0 + MH * 0.5, camX = cam[0];
    const pr = (x, y, z = 0) => { const r = [x - cam[0], y - cam[1], z - cam[2]], d = r[0] * F[0] + r[1] * F[1] + r[2] * F[2];
      return [ccx + fo * (r[0] * Rv[0] + r[1] * Rv[1]) / d, ccy - fo * (r[0] * U[0] + r[1] * U[1] + r[2] * U[2]) / d, d]; };
    const path = (pts) => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); };
    const poly = (P3, fill, stroke, lw = 1) => { const q = P3.map((v) => pr(v[0], v[1], v[2] || 0)); if (q.some((v) => v[2] < 60)) return null; path(q); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } return q; };
    const gq = (x0, y0, x1, y1, fill, z = 0) => { x0 = Math.max(x0, camX + 260); if (x1 <= x0) return; poly([[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill); };
    const vis = (n, c) => n[0] * (cam[0] - c[0]) + n[1] * (cam[1] - c[1]) + n[2] * (cam[2] - c[2]) > 0;
    const XA = SIM.X0 - 2500, XB = SIM.X1 + 2500;
    // ground
    gq(XA, -1700, XB, 900, '#100a10');
    SIM.HOUSES.forEach((h) => gq(h.x0 - 120, h.y0 - 60, h.x1 + 120, SIM.SWN[0], MODC[h.id] ? MODC[h.id].yard : '#1a1612'));
    gq(SIM.ALLEY[0], SIM.ALLEY[1], SIM.ALLEY[2], SIM.ALLEY[3], '#0b0a12'); gq(SIM.ENDLOT[0], SIM.ENDLOT[1], SIM.ENDLOT[2], SIM.ENDLOT[3], '#0b0a12');
    gq(XA, SIM.SWN[0], XB, SIM.SWN[1], '#3a3038'); gq(XA, SIM.SWS[0], XB, SIM.SWS[1], '#3a3038'); gq(XA, SIM.ROAD[0], XB, SIM.ROAD[1], '#1d1b25');
    for (let x = Math.floor((camX + 300) / 400) * 400; x < camX + 9000; x += 400) gq(x, -8, x + 220, 8, 'rgba(230,160,50,0.75)');
    gq(XA, 392, XB, 408, '#3b2618');
    // a faint tech grid
    g.strokeStyle = 'rgba(140,200,255,0.05)'; g.lineWidth = 1;
    for (let x = Math.ceil((camX + 300) / 500) * 500; x < camX + 9000; x += 500) { const a = pr(x, -1700), b = pr(x, 900); if (a[2] > 60 && b[2] > 60) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); } }
    // light pools (lamps, porches, the strange lights), additive
    g.globalCompositeOperation = 'lighter';
    const poolAt = (x, y, r, col, a) => { const q = pr(x, y); if (q[2] < 60) return; const R = r * fo / q[2], k = Math.abs(F[2]) * 0.9 + 0.1;
      g.save(); g.translate(q[0], q[1]); g.scale(1, k); const gr = g.createRadialGradient(0, 0, 0, 0, 0, R); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, 6.3); g.fill(); g.restore(); };
    SIM.LAMPS.forEach(([x, y], i) => poolAt(x, y, 260, '255,180,90', 0.32 * flick(i, 0.3)));
    SIM.HOUSES.forEach((h, i) => poolAt(h.door[0], SIM.FACADE + 90, 200, MODC[h.id] ? MODC[h.id].pool : '255,160,70', 0.22 * flick(i * 3, 0.5)));
    if (ST.elf.lit >= 0) poolAt(SIM.HE.door[0], SIM.FACADE + 160, 420, '220,240,255', 0.5);
    if (ST.raid && ST.raid.st !== 'wait') ST.raid.cars.forEach((c, i) => poolAt(c.x, c.y, 360, i === 0 ? (Math.floor(GT * 3) % 2 ? '255,40,40' : '40,90,255') : '255,140,30', 0.45));
    { const f = Math.max(0, Math.sin(T * 23) * Math.sin(T * 7.1) + 0.3); poolAt(SIM.STRANGE[0], SIM.STRANGE[1], 330, '120,210,255', 0.4 * f); }
    g.globalCompositeOperation = 'source-over';
    // trees (canopies as lit discs) and houses, far to near
    const items = [];
    SIM.TREES.forEach(([x, y, sc]) => items.push({ d: pr(x, y)[2], draw: () => { const tr = pr(x, y, 0), cr = pr(x, y, 230 * sc); if (cr[2] < 60 || tr[2] < 60) return; const R = 95 * sc * fo / cr[2];
      g.strokeStyle = '#2a1408'; g.lineWidth = Math.max(1, 14 * fo / tr[2]); g.beginPath(); g.moveTo(tr[0], tr[1]); g.lineTo(cr[0], cr[1]); g.stroke();
      const gr = g.createRadialGradient(cr[0] - R * 0.3, cr[1] - R * 0.4, R * 0.1, cr[0], cr[1], R); gr.addColorStop(0, '#c4561a'); gr.addColorStop(1, '#4a1a08'); g.fillStyle = gr; g.beginPath(); g.ellipse(cr[0], cr[1], R, R * 0.8, 0, 0, 6.3); g.fill(); } }));
    const nMarks = (id) => ST.marks.filter((m) => m.on === 'house' && m.id === id).length;
    SIM.HOUSES.forEach((h, hi) => { const q0 = pr((h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2); items.push({ d: q0[2], draw: () => {
      const rise = ease(Math.max(0, Math.min(1, (age - 0.15 - hi * 0.07) / 0.5))), Hh = 170 * rise + 2, Rh = 140 * rise, ym = (h.y0 + h.y1) / 2, kir = !!SIM.MODS[h.id], mc = MODC[h.id];
      const wall = mc ? mc.wall : ['#5a463a', '#46362e', '#33271f'], roof = mc ? mc.roof : ['#5b2e22', '#41201a'];
      const faces = [[[0, 1, 0], [[h.x0, h.y1, 0], [h.x1, h.y1, 0], [h.x1, h.y1, Hh], [h.x0, h.y1, Hh]], wall[0]], [[0, -1, 0], [[h.x0, h.y0, 0], [h.x1, h.y0, 0], [h.x1, h.y0, Hh], [h.x0, h.y0, Hh]], wall[2]],
        [[-1, 0, 0], [[h.x0, h.y0, 0], [h.x0, h.y1, 0], [h.x0, h.y1, Hh], [h.x0, h.y0, Hh]], wall[1]], [[1, 0, 0], [[h.x1, h.y0, 0], [h.x1, h.y1, 0], [h.x1, h.y1, Hh], [h.x1, h.y0, Hh]], wall[1]]];
      const rs = [[[0, Rh, h.y1 - ym], [[h.x0, h.y1, Hh], [h.x1, h.y1, Hh], [h.x1, ym, Hh + Rh], [h.x0, ym, Hh + Rh]], roof[0]], [[0, -Rh, ym - h.y0], [[h.x0, h.y0, Hh], [h.x1, h.y0, Hh], [h.x1, ym, Hh + Rh], [h.x0, ym, Hh + Rh]], roof[1]],
        [[-1, 0, 0], [[h.x0, h.y0, Hh], [h.x0, h.y1, Hh], [h.x0, ym, Hh + Rh]], wall[1]], [[1, 0, 0], [[h.x1, h.y0, Hh], [h.x1, h.y1, Hh], [h.x1, ym, Hh + Rh]], wall[1]]];
      for (const [n, pts, col] of [...faces, ...rs]) { const c = pts.reduce((a, v) => [a[0] + v[0] / pts.length, a[1] + v[1] / pts.length, a[2] + v[2] / pts.length], [0, 0, 0]); if (!vis(n, c)) continue;
        poly(pts, col, 'rgba(0,0,0,0.35)', 1); }
      if (rise > 0.6) { // glowing windows and the door on the street face
        for (let k = 0; k < 4; k++) { if (k === 2) continue; const x0 = h.x0 + (h.x1 - h.x0) * (0.1 + 0.22 * k), fl = flick(hi * 7 + k, 0.6), col = mc ? `rgba(${mc.win},${0.75 * fl})` : `rgba(255,190,90,${0.75 * fl})`;
          const q = poly([[x0, h.y1 + 1, Hh * 0.38], [x0 + 70, h.y1 + 1, Hh * 0.38], [x0 + 70, h.y1 + 1, Hh * 0.72], [x0, h.y1 + 1, Hh * 0.72]], col);
          if (q) { g.globalCompositeOperation = 'lighter'; g.shadowColor = col; g.shadowBlur = 10; path(q); g.fill(); g.shadowBlur = 0; g.globalCompositeOperation = 'source-over'; } }
        poly([[h.door[0] - 25, h.y1 + 1, 0], [h.door[0] + 25, h.y1 + 1, 0], [h.door[0] + 25, h.y1 + 1, Hh * 0.6], [h.door[0] - 25, h.y1 + 1, Hh * 0.6]], '#1a0d08'); }
      if (kir && rise > 0.9) { const pu = 0.5 + 0.5 * Math.sin(T * 3); poly([[h.x0, h.y1, Hh], [h.x1, h.y1, Hh], [h.x1, ym, Hh + Rh], [h.x0, ym, Hh + Rh]], null, `rgba(255,150,60,${0.35 + 0.5 * pu})`, 2);
        for (let k = 0; k < Math.min(14, nMarks(h.id)); k++) { const fx = h.x0 + 40 + ((k * 137) % (h.x1 - h.x0 - 80)), a = pr(fx, h.y1 - 10, Hh + 8), b = pr(fx + 30, ym, Hh + Rh - 4);
          if (a[2] > 60) { g.strokeStyle = 'rgba(245,240,230,0.85)'; g.lineWidth = 2; g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo((a[0] + b[0]) / 2 + 4, (a[1] + b[1]) / 2 + 6, b[0], b[1]); g.stroke(); } } }
      const lq = pr((h.x0 + h.x1) / 2, ym, Hh + Rh + 60); if (lq[2] > 60 && rise > 0.8) { const fs = Math.max(10, Math.min(17, 9000 / lq[2])), nm = h.name.replace('Дом ', ''); g.font = `bold ${fs}px ${FONT}`; g.textAlign = 'center';
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(nm, lq[0] + 1, lq[1] + 1); g.fillStyle = kir ? '#ffb45a' : '#e8d8c0'; g.fillText(nm, lq[0], lq[1]); } } }); });
    items.sort((a, b) => b.d - a.d).forEach((it) => it.draw());
    // lamps
    SIM.LAMPS.forEach(([x, y], i) => { const q = pr(x, y, 230); if (q[2] < 60) return; g.globalCompositeOperation = 'lighter'; const R = 60 * fo / q[2];
      const gr = g.createRadialGradient(q[0], q[1], 0, q[0], q[1], R); gr.addColorStop(0, `rgba(255,210,140,${0.9 * flick(i, 0.3)})`); gr.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = gr; g.beginPath(); g.arc(q[0], q[1], R, 0, 6.3); g.fill(); g.globalCompositeOperation = 'source-over'; });
    // people
    const dot = (x, y, r, col, glow) => { const q = pr(x, y, 20); if (q[2] < 60) return; const R = Math.max(2, r * fo / q[2]); g.shadowColor = glow || col; g.shadowBlur = 8; g.fillStyle = col; g.beginPath(); g.arc(q[0], q[1], R, 0, 6.3); g.fill(); g.shadowBlur = 0; };
    ST.npc.forEach((n) => dot(n.x, n.y, 26, '#efe2c8', '#ffcf80'));
    SIM.MODIDS.forEach((id) => { const k = ST[SIM.MODS[id].key], h = SIM.MODH[id]; if (k.st === 'door' || k.st === 'out') dot(h.door[0], h.y1 + 30, 30, MODC[id].dot[0], MODC[id].dot[1]); });
    if (ST.raid && ST.raid.st !== 'wait') { ST.raid.units.forEach((u) => dot(u.x, u.y, 30, u.st === 'chase' ? '#ff3030' : u.kind === 'police' ? '#6a9aff' : '#a0c070', u.st === 'chase' ? '#ff0000' : '#3050ff'));
      ST.raid.cars.forEach((c) => dot(c.x, c.y, 50, Math.floor(GT * 4) % 2 ? '#ff3a3a' : '#3a6aff')); }
    if (ST.courier) dot(ST.courier.x, ST.courier.y, 28, '#ff6a50'); if (ST.kids && ST.kids.list) ST.kids.list.forEach((q) => dot(q.x, q.y, 20, '#ffb050'));
    // quest markers (bobbing, with a stem down to the ground)
    const marker = (x, y, sym, col, z0 = 360) => { const b = Math.sin(T * 2.6 + x * 0.01) * 22, top = pr(x, y, z0 + b), gp = pr(x, y, 0); if (top[2] < 60 || gp[2] < 60) return;
      g.strokeStyle = col; g.globalAlpha = 0.45; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(gp[0], gp[1]); g.lineTo(top[0], top[1]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      const fs = Math.max(14, Math.min(30, 15000 / top[2])); g.font = `bold ${fs}px ${FONT}`; g.textAlign = 'center'; g.shadowColor = col; g.shadowBlur = 14; g.fillStyle = col; g.fillText(sym, top[0], top[1]); g.shadowBlur = 0; };
    SIM.MODIDS.forEach((id) => { const k = ST[SIM.MODS[id].key], h = SIM.MODH[id]; if (k.done < 0 && !k.sweet) marker(h.door[0], h.y1 - 120, '★', MODC[id].star, 420); });
    marker(SIM.STRANGE[0], SIM.STRANGE[1], '☆', ST.q.strange ? '#6a8aa0' : '#8fd8ff', 300);
    if (ST.q.home) marker(SIM.HKO.door[0], SIM.HKO.y1 - 120, '⌂', '#8ad0ff', 460);
    if (ST.q.vera === 0) marker(SIM.NPCS[0].stat[0], SIM.NPCS[0].stat[1], '!', '#ffd060', 260);
    if (ST.q.vera === 1) SIM.VPUMPKINS.forEach((v, i) => { if (ST.vp[i] < 0) marker(v[0], v[1], '●', '#ff8a20', 200); });
    // Kolya: a pulsing ring and a heading arrow on the ground
    { const pu = (T * 0.8) % 1, ring = []; for (let k = 0; k < 24; k++) { const an = k / 24 * 6.283, r = 60 + 120 * pu; ring.push(pr(ST.x + Math.cos(an) * r, ST.y + Math.sin(an) * r)); }
      if (ring.every((q) => q[2] > 60)) { path(ring); g.strokeStyle = `rgba(90,160,255,${0.8 * (1 - pu)})`; g.lineWidth = 2; g.stroke(); }
      const gl = virusGlitch(), jx = gl ? (L.rnd(Math.floor(GT * 3), 1) - 0.5) * 2200 : 0, jy = gl ? (L.rnd(Math.floor(GT * 3), 2) - 0.5) * 900 : 0, KX = ST.x + jx, KY = ST.y + jy;
      const an = gl ? GT * 7 : (ST.ang || 0), X = Math.cos(an), Y = Math.sin(an), wd = [(X / C - Y / SN) / 2, (X / C + Y / SN) / 2], wl = Math.hypot(wd[0], wd[1]), f = [wd[0] / wl, wd[1] / wl], sd = [-f[1], f[0]];
      const tri = [[KX + f[0] * 85, KY + f[1] * 85, 6], [KX - f[0] * 45 + sd[0] * 50, KY - f[1] * 45 + sd[1] * 50, 6], [KX - f[0] * 20, KY - f[1] * 20, 6], [KX - f[0] * 45 - sd[0] * 50, KY - f[1] * 45 - sd[1] * 50, 6]];
      g.shadowColor = '#5aa0ff'; g.shadowBlur = 14; poly(tri, '#6ab0ff', '#e0f0ff', 1.5); g.shadowBlur = 0; }
    // far fog and a slow light sweep
    const fog = g.createLinearGradient(0, Y0, 0, Y0 + MH * 0.4); fog.addColorStop(0, 'rgba(14,6,20,0.95)'); fog.addColorStop(1, 'rgba(14,6,20,0)'); g.fillStyle = fog; g.fillRect(X0, Y0, MW, MH * 0.4);
    { const sw = ((T * 0.22) % 1.6) - 0.3, gx = X0 + sw * MW, sg = g.createLinearGradient(gx - 60, Y0, gx + 60, Y0 + 120); sg.addColorStop(0, 'rgba(160,120,255,0)'); sg.addColorStop(0.5, 'rgba(160,120,255,0.06)'); sg.addColorStop(1, 'rgba(160,120,255,0)');
      g.fillStyle = sg; g.fillRect(X0, Y0, MW, MH); }
    // off-screen pointer to the nearest moderator still to visit or prank
    { const open = SIM.MODIDS.filter((id) => { const k = ST[SIM.MODS[id].key]; return k.done < 0 && !k.sweet; }).sort((a, b) => Math.abs(SIM.MODH[a].door[0] - ST.x) - Math.abs(SIM.MODH[b].door[0] - ST.x));
      const id = ST.target && open.includes(ST.target) ? ST.target : open[0];
      if (id) { const h = SIM.MODH[id], q = pr(h.door[0], h.y1, 0); if (q[2] < 60 || q[1] > Y0 + MH - 20 || q[1] < Y0 + 30) { const down = q[2] < 60 || q[1] > Y0 + MH - 20, y = down ? Y0 + MH - 34 : Y0 + 58, m = Math.round(Math.abs(h.door[0] - ST.x) / 55);
        g.fillStyle = 'rgba(20,10,24,0.8)'; rr(ccx - 85, y - 18, 170, 30, 12); g.fill(); T2((down ? '▼ ' : '▲ ') + '★ ' + SIM.MODS[id].name + ' ' + m + ' м', ccx, y + 3, 15, '#ffb45a', 'center'); } } }
    if (virusGlitch()) glitchCanvas(g, p.w, p.h, 1);
    g.restore();
    g.strokeStyle = 'rgba(160,120,220,0.35)'; g.lineWidth = 2; rr(X0, Y0, MW, MH, 24); g.stroke();
    // compass: north (the houses' side, −y) as the map shows it
    { const a = pr(ST.x, ST.y), b = pr(ST.x, ST.y - 400), an = Math.atan2(b[1] - a[1], b[0] - a[0]), cx2 = X0 + MW - 38, cy2 = Y0 + MH - 40;
      g.fillStyle = 'rgba(15,8,20,0.75)'; g.beginPath(); g.arc(cx2, cy2, 22, 0, 6.3); g.fill(); g.save(); g.translate(cx2, cy2); g.rotate(an); g.fillStyle = '#ff7050'; g.beginPath(); g.moveTo(16, 0); g.lineTo(-4, -6); g.lineTo(-4, 6); g.closePath(); g.fill(); g.restore();
      T2(window.LANG === 'en' ? 'N' : 'С', cx2 + Math.cos(an) * 32, cy2 + Math.sin(an) * 32 + 5, 13, '#ffd0c0', 'center'); }
    T2('Карта района', p.w / 2, 104, 22, '#ffffff', 'center');
    T2('★ модеры   ☆ странные огни   ▲ ты', p.w / 2, Y0 + MH + 34, 15, '#c8b8e0', 'center', 'normal');
  }

  // QA hooks (qa.mjs): HUD screens with worst-case values, and the reference composition (match)
  S.QA = () => {
    const base = (f) => { const s = SIM.spawn(0); for (let i = 0; i < 60; i++) SIM.step(s, {}); if (f) f(s); return s; };
    const near = (s) => { s.x = 2620; s.y = -420; for (let i = 0; i < 240; i++) SIM.step(s, {}); };
    const states = [
      ['start', base()],
      ['dialog', base((s) => { near(s); s.dlg = { who: 'kirill', text: '«Сладость или гадость?» Конфеты только для подписчиков с бустом. Ты не подписчик, и вообще уже очень поздно, иди домой.', choices: [['Подарить подарок', 'gift'], ['Тогда гадость! (¬‿¬)ψ', 'prank'], ['Уйти', 'close']] }; })],
      ['phone_home', base((s) => { s.phone = { app: 'home', t: -9 }; })], ['phone_shop', base((s) => { s.money = 99999; s.phone = { app: 'shop', t: -9 }; })],
      ['phone_chats', base((s) => { for (let i = 0; i < 6; i++) s.msgs.push({ from: 'Кирилл', text: 'Лот №' + i + ': трусы Коли с надписью «Пятница» — проданы за 4999 ₽ ( ˘ ▽˘) Деньги, конечно, оставлю себе.', gt: 0, read: false }); s.phone = { app: 'chats', t: -9 }; })],
      ['phone_map', base((s) => { s.phone = { app: 'map', t: -9 }; })],
      ['dialog_raiva', base((s) => { s.x = SIM.HR.door[0]; s.y = SIM.FACADE + 70; for (let i = 0; i < 240; i++) SIM.step(s, {}); s.rai.st = 'door'; s.dlg = { who: 'raiva', text: '«Сладость или гадость?» У меня сервер упал, логи сами себя не прочитают. Иди домой, Коля, и вообще уже поздно.', choices: [['Подарить подарок', 'gift'], ['Тогда гадость! (¬‿¬)ψ', 'prank'], ['Уйти', 'close']] }; })],
      ['phone_orders', base((s) => { s.money = -12345; s.rai.virus = { st: 'active', t1: -100 }; SIM.JUNK.forEach((j) => s.rai.junk.push({ name: j[0], price: j[1], gt: 0 })); s.phone = { app: 'orders', t: -9 }; })],
      ['dialog_elf', base((s) => { s.x = SIM.HE.door[0]; s.y = SIM.FACADE + 70; for (let i = 0; i < 240; i++) SIM.step(s, {}); s.elf.st = 'door'; s.dlg = { who: 'elf', text: '«Сладость или гадость?» Нет. Конфеты для тех, кто не спамит в чате. Иди домой, Коля, и вообще уже поздно.', choices: [['Подарить подарок', 'gift'], ['Тогда гадость! (¬‿¬)ψ', 'prank'], ['Уйти', 'close']] }; })],
      ['elf_flood', base((s) => { s.elf.refused = true; s.x = SIM.HE.door[0] - 250; s.y = -380; for (let i = 0; i < 90; i++) SIM.step(s, { up: 1 }); for (let i = 0; i < 30; i++) SIM.step(s, {}); })],
      ['raid', base((s) => { s.elf.done = 0; s.raid = SIM.newRaid(s); s.raid.t0 = s.t; s.x = 4000; s.y = -60; for (let i = 0; i < 120 * 12; i++) SIM.step(s, {}); s.raid.grace = 0; s.x = 3900; s.y = 0;
        s.raid.units.forEach((u, i) => { u.x = 3500 + i * 120; u.y = [-262, 232, 0, -300][i]; u.wa = 0; }); for (let i = 0; i < 100; i++) SIM.step(s, {}); s.money = 99999; })],
      ['phone_download', base((s) => { s.rai.virus = { st: 'download', t0: s.t - 1.5 }; s.phone = { app: 'chats', t: -9 }; })], ['phone_pizza', base((s) => { s.phone = { app: 'pizza', t: -9 }; })],
      ['pranks', base((s) => { near(s); s.kir.refused = true; s.kir.p = 99; s.money = 99999; s.inv.eggs = 99; s.slot = 2; s.hp = 7;
        for (let i = 0; i < 3; i++) s.toasts.push({ text: 'Флаер «Кирилл раздаёт конфеты БЕСПЛАТНО!» (5/5) — очень длинное сообщение', t: s.t, kind: i ? 'info' : 'big' }); })],
      ['phone_dev', base((s) => { SIM.runDev(s, 'help'); SIM.runDev(s, 'money 5000'); s.phone = { app: 'dev', t: -9 }; })],
      ['phone_contacts', base((s) => { s.loans = { 'Скелет': { amt: 1500, over: true } }; s.phone = { app: 'contacts', t: -9 }; })],
      ['phone_dm', base((s) => { s.dm['Тимофей'] = [{ me: true, text: 'Тимофей, привет! Ты где вообще?', gt: 0 }, { text: 'Я везде. Вижу тебя у дома Райвы. Сзади камера, кстати (◉_◉) Очень длинный ответ, чтобы проверить перенос строк в пузыре.', gt: 0 }]; s.phone = { app: 'dm', who: 'Тимофей', t: -9 }; })],
      ['finale', base((s) => { SIM.runDev(s, 'finale'); s.finale.i = 4; })],
      ['finale_end', base((s) => { SIM.runDev(s, 'finale'); s.finale.end = true; s.finale.i = s.finale.lines.length; s.stats = { eggs: 99999, tp: 999, bb: 99999, hits: 999 }; s.money = -99999; })],
      ['match', base((s) => { s.x = 2150; s.y = -230; s.gt = 14 * 60; s.face = [1, 1]; const hp = SIM.proj(s.x, s.y); s.cam = [hp[0] - W / 2 + 120, hp[1] - H / 2 - 60]; })],
    ];
    // Kolya: one walk cycle per drawn view (gait phase = distance / stride, facing = the view's screen angle)
    const KS = SIM.K.STRIDE, KV = SIM.K.WALK, wdir = (an) => { const X = Math.cos(an), Y = Math.sin(an), w = [(X / C - Y / SN) / 2, (X / C + Y / SN) / 2], l = Math.hypot(w[0], w[1]); return [w[0] / l, w[1] / l]; };
    const walk = (vi, n = 8, still = false, an = SIM.KVIEWS[vi][1]) => { const s0 = base(); s0.x = 2150; s0.y = -40; s0.npc = []; const dw = wdir(an), out = [];
      for (let i = 0; i < n; i++) { const st = JSON.parse(JSON.stringify(s0)), d = still ? 0 : KS * i / n; st.x = s0.x + dw[0] * d; st.y = s0.y + dw[1] * d; st.vx = still ? 0 : dw[0] * KV; st.vy = still ? 0 : dw[1] * KV;
        st.ang = an; st.vi = vi; st.gph = d / KS; st.d16 = st.d16p = ((Math.round(Math.atan2(2 * Math.sin(an), Math.cos(an)) / (Math.PI / 8)) % 16) + 16) % 16; st.d16t = -9; st.turnA = 0; st.stride = KS; st.runA = 0; st.lockAng = an; st.faceLock = -1; if (still) st.neutral = true;
        const hp = SIM.proj(st.x, st.y); st.cam = [hp[0] - W / 2, hp[1] - H / 2 - 50]; out.push(st); } return out; };
    const parts = (n) => ['body', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR', 'armL', 'armR', 'uarmL', 'uarmR', 'farmL', 'farmR'].map((k) => n + '__' + k).filter((k) => has(k));
    const cycles = {}, sprites = {}, subject = {}, cycleT = {}, restS = {};
    // Kolya walks on generated frames (no rig joints): his cycles feed the pixel limb-motion check and the cycle sheets only
    // 16 directions (body yaw b·22.5°): the 9 drawn yaws and their 7 mirrors
    for (let b = 0; b < 16; b++) { const ph = b * Math.PI / 8, an = Math.atan2(0.5 * Math.sin(ph), Math.cos(ph)), nm = 'kolya_d' + b; cycles[nm] = walk(1, 8, false, an); sprites[nm] = [K16(b)[0]]; }
    // NPC walkers: one cycle per type and view (stride K.NSTRIDE)
    const NS = SIM.K.NSTRIDE;
    const npcWalk = (i, an, n = 8, neutral = false) => { const out = []; const s0 = base(); const dw = wdir(an);
      for (let k = 0; k < n; k++) { const st = JSON.parse(JSON.stringify(s0)), d = neutral ? 0 : NS * k / n, q = Object.assign({}, st.npc[i]); q.x = 2150 + dw[0] * d; q.y = -60 + dw[1] * d; q.walk = d; q.gph = d / NS; q.gA = neutral ? 0 : 1; q.ang = an; q.pause = neutral ? 9 : 0; q.talkT = -99;
        st.npc = [q]; const hp = SIM.proj(2150, -60); st.cam = [hp[0] - W / 2, hp[1] - H / 2 - 50]; if (neutral) st.neutral = true; out.push(st); } return out; };
    SIM.NPCS.forEach((def, i) => { if (def.stat || i > 6) return; const base2 = def.tex;
      for (const [v, an] of [['se', KA], ['ne', -(Math.PI - KA)]]) { const nm = base2 + '_' + v, rig = nm; if (!RG[rig]) continue;
        cycles[nm] = npcWalk(i, an); sprites[nm] = parts(rig); subject[nm] = 'npc' + i; cycleT[nm] = NS / def.v; restS[nm] = npcWalk(i, an, 1, true)[0]; } });
    return { states, cycles, sprites, subject, cycleT, rest: restS, actors: Object.keys(cycles),
      box: (name, st) => { const a = name.startsWith('kolya') ? [st.x, st.y] : [st.npc[0].x, st.npc[0].y], q = SIM.proj(a[0], a[1]); return [q[0] - st.cam[0] - 70, q[1] - st.cam[1] - 150, 140, 165]; } };
  };
})();
