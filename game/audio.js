// live/audio.js — all sound is synthesized with WebAudio from the sim's event bus (S.ev) and a few state changes.
// No voices yet. Night ambience (wind following the gusts, crickets, an owl), a quiet music-box loop, positional SFX
// (volume by distance to Kolya, pan by screen x). M mutes. The AudioContext starts on the first key or click.
(function () {
  const AU = (window.AUDIO = { muted: false, vol: { master: 1, music: 1, sfx: 1 } });
  let ac = null, master, comp, sfx, amb, mus, phoneBus, partyBus, NB = null, windG = null, windF = null, rainG = null;
  const seen = new WeakSet();
  let prev = { phone: null, app: null, dlg: null, light: null, hidden: null, loop: -1 }, nextCricket = 0, nextOwl = 0, nextNote = 0, noteI = 0, primed = false;
  const R = (a, b) => a + Math.random() * (b - a);
  function init() {
    if (ac) return; const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    ac = new C(); comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
    master = ac.createGain(); master.gain.value = AU.muted ? 0 : 0.85 * AU.vol.master; comp.connect(master); master.connect(ac.destination);
    sfx = bus(AU.vol.sfx); amb = bus(0.5 * AU.vol.music); mus = bus(0.16 * AU.vol.music); phoneBus = bus(AU.vol.sfx); partyBus = bus(0.42 * AU.vol.music);
    NB = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = NB.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // wind: looping noise through a moving band-pass; its level follows the sim's gusts
    const src = ac.createBufferSource(); src.buffer = NB; src.loop = true; windF = ac.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 420; windF.Q.value = 0.6;
    windG = ac.createGain(); windG.gain.value = 0.0; src.connect(windF); windF.connect(windG); windG.connect(amb); src.start();
    // v10 rain: a second noise loop, high and hissy, its level follows the sim's rain
    { const r = ac.createBufferSource(); r.buffer = NB; r.loop = true; r.playbackRate.value = 0.83; const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; rainG = ac.createGain(); rainG.gain.value = 0; r.connect(hp); hp.connect(lp); lp.connect(rainG); rainG.connect(amb); r.start(); }
    // a low drone under the music box
    for (const [f, dt] of [[55, 0], [82.4, 3], [110.3, -4]]) { const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = dt;
      lp.type = 'lowpass'; lp.frequency.value = 380; g.gain.value = 0.05; o.connect(lp); lp.connect(g); g.connect(mus); o.start(); }
  }
  const bus = (v) => { const g = ac.createGain(); g.gain.value = v; g.connect(comp); return g; };
  function unlock(e) {
    if (e && e.code === 'KeyM' && !(e.target && e.target.tagName === 'INPUT')) { AU.muted = !AU.muted; applyVol(); }
    init(); if (ac && ac.state === 'suspended') ac.resume();
  }
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);
  // volumes from the settings menu (0..1 each): master, music + ambience, effects
  function applyVol() { if (!ac) return; const V = AU.vol, t = ac.currentTime; master.gain.setTargetAtTime(AU.muted ? 0 : 0.85 * V.master, t, 0.05);
    sfx.gain.setTargetAtTime(V.sfx, t, 0.05); phoneBus.gain.setTargetAtTime(V.sfx, t, 0.05); amb.gain.setTargetAtTime(0.5 * V.music, t, 0.05); mus.gain.setTargetAtTime(0.16 * V.music * (AU.mv === undefined ? 1 : AU.mv), t, 0.05); partyBus.gain.setTargetAtTime(0.42 * V.music, t, 0.05); }
  AU.setVol = (v) => { Object.assign(AU.vol, v); applyVol(); };
  AU.unlock = () => unlock();
  // ---- building blocks ----
  function out(dest, pan) { if (pan === undefined || !ac.createStereoPanner) return dest; const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(dest); return p; }
  function tone(f, dur, { type = 'sine', vol = 0.3, at = 0, f1 = null, a = 0.005, dest = sfx, pan, q = null, lp = null, vib = 0 } = {}) {
    const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 6; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o; if (lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; if (q) fl.Q.value = q; node.connect(fl); node = fl; }
    node.connect(g); g.connect(out(dest, pan)); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, { type = 'bandpass', f = 1000, f1 = null, q = 1, vol = 0.3, at = 0, a = 0.003, dest = sfx, pan, am = 0 } = {}) {
    const t = ac.currentTime + at, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = NB; s.loop = true;
    fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (am) { const l = ac.createOscillator(), lg = ac.createGain(), mg = ac.createGain(); l.frequency.value = am; lg.gain.value = 0.5; mg.gain.value = 0.5; l.connect(lg); lg.connect(mg.gain); fl.connect(mg); mg.connect(g); l.start(t); l.stop(t + dur + 0.05); }
    else fl.connect(g);
    s.connect(fl); g.connect(out(dest, pan)); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // ---- sound effects ----
  const FX = {
    step: (v, p, surf) => { if (surf === 'puddle') { noise(0.12, { f: 1800, f1: 900, q: 1.2, vol: 0.09 * v, pan: p }); noise(0.06, { type: 'highpass', f: 4000, vol: 0.05 * v, pan: p, at: 0.02 }); return; }
      if (surf === 'grass') noise(0.09, { f: 2600, q: 0.8, vol: 0.05 * v, pan: p }); else if (surf === 'gravel') { noise(0.08, { f: 3200, q: 1.5, vol: 0.06 * v, pan: p }); noise(0.05, { f: 900, q: 2, vol: 0.04 * v, pan: p, at: 0.02 }); }
      else { noise(0.05, { f: 1400, q: 2.2, vol: 0.07 * v, pan: p }); tone(110, 0.05, { vol: 0.05 * v, pan: p }); } },
    pile: (v, p) => { noise(0.7, { f: 4200, f1: 2400, q: 0.7, vol: 0.16 * v, pan: p, am: 23 }); noise(0.35, { f: 1800, q: 1, vol: 0.08 * v, pan: p, at: 0.05, am: 31 }); },
    coin: (v, p) => { tone(1318, 0.12, { type: 'square', vol: 0.06 * v, pan: p, lp: 5000 }); tone(1976, 0.35, { type: 'square', vol: 0.06 * v, pan: p, at: 0.08, lp: 6000 }); tone(3951, 0.25, { vol: 0.03 * v, pan: p, at: 0.1 }); },
    throw: (v, p) => noise(0.28, { f: 500, f1: 2600, q: 1.2, vol: 0.12 * v, pan: p }),
    splat: (v, p) => { noise(0.04, { f: 3500, q: 3, vol: 0.18 * v, pan: p }); noise(0.25, { type: 'lowpass', f: 900, f1: 200, vol: 0.25 * v, pan: p, at: 0.02 }); tone(320, 0.18, { f1: 90, vol: 0.12 * v, pan: p, at: 0.02 }); },
    tpland: (v, p) => noise(0.5, { f: 2500, f1: 1200, q: 0.8, vol: 0.09 * v, pan: p, am: 17 }),
    bell: (v, p) => { for (const [f, at] of [[659, 0], [523, 0.45]]) { tone(f, 1.2, { vol: 0.22 * v, at, pan: p }); tone(f * 2.76, 0.5, { vol: 0.05 * v, at, pan: p }); tone(f * 5.4, 0.2, { vol: 0.02 * v, at, pan: p }); } },
    alarm: (v, p) => { for (let k = 0; k < 24; k++) tone(2300 + 200 * (k % 2), 0.07, { type: 'square', vol: 0.06 * v, at: k * 0.08, pan: p, lp: 6000 });
      const crow = [[520, 760, 0.18], [760, 700, 0.15], [700, 980, 0.2], [980, 600, 0.65]]; let at = 2.0; for (const [a, b, d] of crow) { tone(a, d, { type: 'sawtooth', f1: b, vol: 0.12 * v, at, pan: p, lp: 2400, vib: 18 }); at += d * 0.92; } },
    mailbox: (v, p) => { noise(0.12, { f: 700, q: 4, vol: 0.2 * v, pan: p }); tone(820, 0.4, { type: 'triangle', vol: 0.08 * v, pan: p, at: 0.02 }); },
    fuse: (v, p) => { for (let k = 0; k < 14; k++) noise(0.2, { f: R(4000, 7000), q: 2, vol: 0.05 * v, at: k * 0.21, pan: p, am: 40 }); },
    bang: (v, p) => { noise(1.2, { type: 'lowpass', f: 1800, f1: 120, vol: 0.9 * v, pan: p }); tone(60, 0.6, { f1: 30, vol: 0.6 * v, pan: p });
      for (let k = 0; k < 10; k++) { const at = 0.15 + k * R(0.07, 0.16); noise(0.06, { f: R(1500, 4000), q: 1, vol: 0.25 * v, at, pan: p + R(-0.3, 0.3) }); } },
    // v10 weather: thunder rolls in after the flash (farther = later and duller), the power dies with a thump, steps splash
    lightning: (v, p, e) => { const dl = e && e.dl || 1, near = e && e.near; noise(0.25, { type: 'highpass', f: 2500, vol: (near ? 0.35 : 0.12), at: dl * 0.25 });
      noise(3.2, { type: 'lowpass', f: near ? 900 : 420, f1: 60, vol: near ? 0.8 : 0.45, at: dl, am: 7 }); tone(48, 2.5, { f1: 30, vol: near ? 0.35 : 0.2, at: dl + 0.05 }); },
    costume: () => { noise(0.5, { f: 900, f1: 3500, q: 0.8, vol: 0.18 }); for (let k = 0; k < 4; k++) tone(880 * [1, 1.25, 1.5, 2][k], 0.25, { type: 'triangle', vol: 0.06, at: 0.1 + k * 0.07 }); },
    blackout: () => { tone(120, 0.4, { f1: 40, vol: 0.18, type: 'sawtooth', lp: 400 }); noise(0.08, { f: 3000, q: 2, vol: 0.12 }); },
    caralarm: (v, p) => { for (let k = 0; k < 9; k++) tone(k % 2 ? 900 : 650, 0.42, { type: 'square', vol: 0.05 * v, at: k * 0.45, pan: p, lp: 3000 }); },
    hurt: (v) => { noise(0.15, { type: 'lowpass', f: 600, vol: 0.4 * v }); tone(140, 0.2, { f1: 70, vol: 0.3 * v }); },
    splat2: (v, p) => { noise(0.08, { f: 900, q: 1.5, vol: 0.35 * v, pan: p }); tone(180, 0.12, { f1: 90, vol: 0.2 * v, pan: p }); },
    notify: () => { tone(150, 0.35, { type: 'square', vol: 0.05, dest: phoneBus, lp: 400 }); tone(1046, 0.12, { vol: 0.12, at: 0.05, dest: phoneBus }); tone(1568, 0.25, { vol: 0.12, at: 0.15, dest: phoneBus }); },
    buy: () => { tone(1568, 0.1, { type: 'square', vol: 0.05, lp: 4000 }); tone(2093, 0.4, { type: 'square', vol: 0.05, at: 0.08, lp: 5000 }); noise(0.15, { f: 6000, q: 1, vol: 0.05, at: 0.05 }); },
    spotted: () => { for (const f of [196, 207.7, 293.7]) tone(f, 0.6, { type: 'sawtooth', vol: 0.06, lp: 1600 }); },
    prank: () => { [523, 659, 784].forEach((f, i) => tone(f, 0.18, { type: 'triangle', vol: 0.08, at: i * 0.07 })); },
    housedone: () => { [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i === 5 ? 0.9 : 0.22, { type: 'triangle', vol: 0.12, at: i * 0.12 })); noise(1.2, { f: 7000, q: 0.5, vol: 0.04, at: 0.6 }); },
    candy: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, { vol: 0.08, at: i * 0.06 })); },
    slime: (v, p) => { noise(0.35, { type: 'lowpass', f: 700, f1: 250, vol: 0.25 * v, pan: p, am: 12 }); tone(260, 0.3, { f1: 120, vol: 0.1 * v, pan: p }); },
    flyeroff: (v, p) => { noise(0.3, { f: 4200, f1: 1800, q: 1.2, vol: 0.09 * v, pan: p }); noise(0.1, { f: 900, q: 3, vol: 0.05 * v, at: 0.2, pan: p }); },
    flyer: (v, p) => { noise(0.25, { f: 3000, f1: 5500, q: 1.5, vol: 0.08 * v, pan: p }); noise(0.18, { f: 1800, q: 4, vol: 0.06 * v, at: 0.22, pan: p }); },
    swap: (v, p) => { noise(0.2, { type: 'lowpass', f: 500, vol: 0.3 * v, pan: p }); noise(0.3, { type: 'lowpass', f: 900, f1: 300, vol: 0.15 * v, pan: p, at: 0.1, am: 9 }); },
    pickup: (v, p) => { tone(392, 0.08, { type: 'triangle', vol: 0.08 * v, pan: p }); tone(587, 0.15, { type: 'triangle', vol: 0.08 * v, pan: p, at: 0.06 }); },
    hide: (v, p) => noise(0.5, { f: 2200, q: 0.7, vol: 0.12 * v, pan: p, am: 19 }),
    unhide: (v, p) => noise(0.3, { f: 2600, q: 0.7, vol: 0.08 * v, pan: p, am: 23 }),
    clickmark: () => tone(880, 0.04, { vol: 0.025 }),
    lighton: () => { noise(0.02, { f: 3000, q: 4, vol: 0.12 }); tone(2000, 0.03, { vol: 0.05 }); },
    lightoff: () => noise(0.02, { f: 2000, q: 4, vol: 0.1 }),
    talk: (v, p) => tone(660, 0.06, { type: 'triangle', vol: 0.04 * v, pan: p }),
    knock: (v, p) => { for (const at of [0, 0.18, 0.5]) { noise(0.06, { type: 'lowpass', f: 380, vol: 0.4 * v, at, pan: p }); tone(95, 0.08, { vol: 0.25 * v, at, pan: p }); } },
    door: (v, p) => tone(180, 0.7, { type: 'sawtooth', f1: 260, vol: 0.03 * v, pan: p, lp: 900, vib: 30 }),
    camping: (v, p) => { tone(1760, 0.08, { type: 'square', vol: 0.04 * v, pan: p, lp: 6000 }); tone(1760, 0.08, { type: 'square', vol: 0.04 * v, pan: p, at: 0.15, lp: 6000 }); },
    // Raiva's virus: the phone suddenly shrieks
    virus_horn: () => { for (const f of [440, 554, 659]) tone(f, 1.3, { type: 'sawtooth', vol: 0.12, dest: phoneBus, lp: 3000 }); },
    virus_siren: () => { for (let k = 0; k < 4; k++) tone(700, 0.45, { type: 'square', f1: 1500, vol: 0.08, at: k * 0.45, dest: phoneBus, lp: 4000 }); },
    virus_meow: () => { tone(500, 0.7, { type: 'sawtooth', f1: 900, vol: 0.12, dest: phoneBus, lp: 2000, vib: 40 }); tone(900, 0.5, { type: 'sawtooth', f1: 420, vol: 0.12, at: 0.6, dest: phoneBus, lp: 2000, vib: 30 }); },
    virus_modem: () => { for (let k = 0; k < 18; k++) tone(R(600, 2600), 0.09, { type: 'square', vol: 0.05, at: k * 0.08, dest: phoneBus, lp: 5000 }); noise(1.4, { f: 2400, q: 0.5, vol: 0.06, dest: phoneBus, am: 50 }); },
    virus_glitch: () => { for (let k = 0; k < 8; k++) tone(R(80, 3000), 0.05, { type: 'square', vol: 0.05, at: k * 0.05, dest: phoneBus }); },
    download: () => { [523, 784, 1046].forEach((f, i) => tone(f, 0.15, { type: 'square', vol: 0.05, at: i * 0.1, dest: phoneBus, lp: 4000 })); },
    phone_open: () => noise(0.18, { f: 1200, f1: 3500, q: 1, vol: 0.05 }),
    phone_close: () => noise(0.15, { f: 3000, f1: 900, q: 1, vol: 0.04 }),
    tap: () => tone(1200, 0.03, { type: 'triangle', vol: 0.05 }),
    dlg: () => tone(520, 0.05, { type: 'triangle', vol: 0.04 }),
    // Elf: the floodlight relay, her suction-cup arrow, her phone call
    flood_on: (v, p) => { noise(0.03, { f: 2500, q: 5, vol: 0.2 * v, pan: p }); tone(100, 0.9, { type: 'sawtooth', vol: 0.025 * v, pan: p, lp: 400, a: 0.05 }); },
    flood_off: (v, p) => noise(0.03, { f: 1800, q: 5, vol: 0.12 * v, pan: p }),
    thwack: (v, p) => { tone(420, 0.12, { f1: 130, vol: 0.3 * v, pan: p }); noise(0.05, { type: 'lowpass', f: 700, vol: 0.25 * v, pan: p }); tone(900, 0.3, { type: 'triangle', f1: 600, vol: 0.05 * v, pan: p, at: 0.05, vib: 60 }); },
    elfcall: (v, p) => { [[697, 1209], [770, 1336], [852, 1477], [697, 1336], [941, 1209]].forEach(([a, b], i) => { tone(a, 0.1, { vol: 0.05 * v, at: i * 0.14, pan: p }); tone(b, 0.1, { vol: 0.05 * v, at: i * 0.14, pan: p }); });
      for (let k = 0; k < 2; k++) tone(425, 0.9, { vol: 0.05 * v, at: 1 + k * 1.6, pan: p }); },
    // the raid: sirens rolling in, whistles, car doors, radio chatter, handcuffs
    raidsiren: (v, p) => { const vv = Math.max(0.45, v); for (let k = 0; k < 9; k++) { tone(620, 0.55, { type: 'sawtooth', f1: 1300, vol: 0.06 * vv, at: k * 1.1, pan: Math.max(-0.8, Math.min(0.8, p)), lp: 2600 }); tone(1300, 0.55, { type: 'sawtooth', f1: 620, vol: 0.06 * vv, at: k * 1.1 + 0.55, pan: Math.max(-0.8, Math.min(0.8, p)), lp: 2600 }); }
      for (let k = 0; k < 6; k++) tone(k % 2 ? 960 : 720, 0.6, { type: 'square', vol: 0.03 * vv, at: 1 + k * 0.6, pan: Math.max(-0.8, Math.min(0.8, p * 1.1)), lp: 2000 }); },
    whistle: (v, p) => { const vv = Math.max(0.5, v); tone(2900, 0.22, { vol: 0.14 * vv, pan: p, vib: 120 }); tone(2900, 0.75, { vol: 0.14 * vv, pan: p, at: 0.3, vib: 140 }); },
    cardoor: (v, p) => { noise(0.12, { type: 'lowpass', f: 320, vol: 0.5 * v, pan: p }); tone(75, 0.15, { vol: 0.3 * v, pan: p }); noise(0.1, { type: 'lowpass', f: 320, vol: 0.45 * v, pan: p, at: 0.6 }); },
    radio: (v, p) => { tone(1400, 0.05, { type: 'square', vol: 0.04 * v, pan: p, lp: 3000 }); noise(0.9, { f: 1700, q: 2.5, vol: 0.07 * v, pan: p, at: 0.06, am: 27 }); tone(1100, 0.06, { type: 'square', vol: 0.04 * v, pan: p, at: 1.0, lp: 3000 }); },
    // v6: the airsoft rifle, hits on people, phone messages, the party ending
    pew: (v) => { noise(0.07, { type: 'highpass', f: 1800, vol: 0.13 }); tone(1500, 0.04, { type: 'square', f1: 700, vol: 0.025, lp: 5000 }); noise(0.05, { type: 'lowpass', f: 400, vol: 0.08 }); },
    bbhit: (v, p, on) => { if (on === 'scar' || on === 'rcar') { tone(2400, 0.12, { type: 'triangle', vol: 0.06 * v, pan: p }); tone(3600, 0.08, { vol: 0.03 * v, pan: p }); }
      else if (on) noise(0.04, { type: 'lowpass', f: 900, vol: 0.12 * v, pan: p }); else noise(0.03, { f: 4200, q: 3, vol: 0.05 * v, pan: p }); },
    ouch: (v, p) => { const f = R(380, 620); tone(f, 0.22, { type: 'sawtooth', f1: f * 1.5, vol: 0.06 * v, pan: p, lp: 1800, vib: 25 }); tone(f * 1.4, 0.25, { type: 'sawtooth', f1: f * 0.8, vol: 0.05 * v, pan: p, lp: 1600, at: 0.16 }); },
    gunon: () => { noise(0.03, { f: 2500, q: 5, vol: 0.2 }); noise(0.04, { f: 1400, q: 4, vol: 0.18, at: 0.12 }); tone(220, 0.05, { type: 'square', vol: 0.03, lp: 900, at: 0.12 }); },
    sent: () => { tone(880, 0.12, { f1: 1760, vol: 0.06, dest: phoneBus }); noise(0.12, { f: 2000, f1: 6000, q: 0.7, vol: 0.03, dest: phoneBus }); },
    slimetouch: (v, p) => { noise(0.4, { type: 'lowpass', f: 600, f1: 200, vol: 0.3 * v, pan: p, am: 14 }); const f = R(420, 560); tone(f, 0.35, { type: 'sawtooth', f1: f * 1.6, vol: 0.06 * v, pan: p, lp: 2000, vib: 30, at: 0.15 }); },
    page: () => noise(0.16, { f: 3200, f1: 1600, q: 0.8, vol: 0.05 }),
    party: () => { for (let k = 0; k < 4; k++) tone(R(500, 800), 0.7, { type: 'sawtooth', f1: R(900, 1300), vol: 0.05, at: k * 0.08, lp: 2500, vib: 30 });
      noise(1.6, { f: 1400, q: 0.6, vol: 0.12, at: 0.05, am: 9 }); noise(1.2, { f: 2600, q: 0.8, vol: 0.06, at: 0.2, am: 13 }); [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, { type: 'square', vol: 0.03, at: 0.4 + i * 0.07, lp: 4000 })); },
    // v9: pumpkins put down, kicked bins, the cat, shot-out lamps, achievements, angry passers-by
    putdown: (v, p) => { noise(0.14, { type: 'lowpass', f: 420, vol: 0.35 * v, pan: p }); tone(90, 0.16, { f1: 60, vol: 0.2 * v, pan: p }); },
    binkick: (v, p) => { noise(0.5, { type: 'lowpass', f: 1500, f1: 200, vol: 0.7 * v, pan: p }); tone(140, 0.35, { type: 'square', f1: 70, vol: 0.12 * v, pan: p, lp: 700 });
      for (let k = 0; k < 7; k++) { noise(0.07, { f: R(800, 3000), q: 2, vol: 0.18 * v, at: 0.12 + k * R(0.06, 0.13), pan: p + R(-0.2, 0.2) }); tone(R(300, 900), 0.12, { type: 'triangle', vol: 0.05 * v, at: 0.1 + k * 0.1, pan: p }); } },
    purr: (v, p) => { noise(1.4, { type: 'lowpass', f: 160, vol: 0.25 * v, pan: p, am: 24 }); tone(720, 0.5, { type: 'sawtooth', f1: 980, vol: 0.04 * v, pan: p, lp: 2400, vib: 20, at: 1.2 }); },
    meow: (v, p) => { tone(620, 0.55, { type: 'sawtooth', f1: 900, vol: 0.06 * v, pan: p, lp: 2200, vib: 25 }); tone(880, 0.35, { type: 'sawtooth', f1: 520, vol: 0.05 * v, pan: p, lp: 2200, at: 0.45 }); },
    hiss: (v, p) => { noise(0.9, { type: 'highpass', f: 3200, vol: 0.22 * Math.max(0.5, v), pan: p, a: 0.05 }); tone(240, 0.4, { type: 'sawtooth', f1: 180, vol: 0.04, pan: p, lp: 900, at: 0.3 }); },
    lampbreak: (v, p) => { noise(0.05, { f: 6000, q: 2, vol: 0.3 * v, pan: p }); for (let k = 0; k < 8; k++) tone(R(2500, 5200), 0.12, { type: 'triangle', vol: 0.05 * v, at: 0.04 + k * R(0.03, 0.08), pan: p }); noise(0.3, { type: 'lowpass', f: 400, vol: 0.1 * v, pan: p, at: 0.05 }); },
    ach: () => { [659, 880, 1046, 1318].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.25, { type: 'triangle', vol: 0.1, at: i * 0.09 })); tone(2637, 0.6, { vol: 0.04, at: 0.36 }); noise(0.8, { f: 8000, q: 0.5, vol: 0.03, at: 0.3 }); },
    nthrow: (v, p) => noise(0.28, { f: 500, f1: 2400, q: 1.2, vol: 0.1 * v, pan: p }),
    angry: (v, p) => { const f = R(240, 330); tone(f, 0.4, { type: 'sawtooth', f1: f * 0.7, vol: 0.07 * v, pan: p, lp: 1400, vib: 15 }); },
    arrest: () => { for (const at of [0, 0.12, 0.5, 0.62]) noise(0.03, { f: 5500, q: 6, vol: 0.25, at }); tone(110, 1.2, { type: 'sawtooth', f1: 55, vol: 0.12, lp: 600, at: 0.2 }); },
  };
  AU.FX = FX;
  AU.play = (k, v = 1, p = 0, extra) => { if (!ac || AU.muted || !FX[k]) return; try { FX[k](v, p, extra); } catch (e) {} };
  // ---- ambience: crickets, an owl, the music box (A minor, slow arpeggios with an echo) ----
  const MEL = [[440, 523, 659, 880], [392, 494, 587, 784], [349, 440, 523, 698], [330, 415, 494, 659]];
  function ambience(S, T) {
    const t = ac.currentTime;
    // v11: the page picks the music (AU.musicSrc: 'std' = this music box, 'none' = the author's track or silence) and ducks it under the voice message
    const mv = (AU.musicSrc === 'none' ? 0 : 1) * (AU.voiceOn ? 0.25 : 1); if (mv !== AU.mv) { AU.mv = mv; mus.gain.setTargetAtTime(0.16 * AU.vol.music * mv, t, 0.3); amb.gain.setTargetAtTime(0.5 * AU.vol.music * (AU.voiceOn ? 0.4 : 1), t, 0.3); }
    if (window.SIM && S) { const g = SIM.gustAt(T, S.x || 0), w = 0.5 + 0.3 * Math.sin(T * 0.13); windG.gain.setTargetAtTime(0.03 + 0.05 * w + 0.12 * Math.min(1, g), t, 0.4); windF.frequency.setTargetAtTime(360 + 500 * Math.min(1, g), t, 0.5); }
    else windG.gain.setTargetAtTime(0.05, t, 0.5);
    if (rainG) rainG.gain.setTargetAtTime(window.SIM && S && !S.noWeather && SIM.rainAt ? 0.22 * SIM.rainAt(S.t) : 0, t, 0.8);
    if (t > nextCricket) { nextCricket = t + R(0.25, 0.9); const f = R(4300, 5200), p = R(-0.8, 0.8); for (let k = 0; k < 3; k++) tone(f, 0.03, { vol: 0.012, at: k * 0.05, dest: amb, pan: p }); }
    if (t > nextOwl) { if (nextOwl) { const p = R(-0.9, 0.9); tone(370, 0.35, { vol: 0.05, dest: amb, pan: p, vib: 4, lp: 900 }); tone(330, 0.6, { vol: 0.05, dest: amb, pan: p, at: 0.45, vib: 4, lp: 900 }); } nextOwl = t + R(22, 45); }
    const RD = S && S.raid; if (RD && RD.st === 'search' && t > (prev.radio || 0)) { if (prev.radio) { const u = RD.units[Math.floor(Math.random() * RD.units.length)], d = Math.hypot(u.x - S.x, u.y - S.y);
      if (d < 1800) FX.radio(Math.max(0.2, 1 - d / 1800), Math.max(-1, Math.min(1, (u.x - S.x) / 1500))); } prev.radio = t + R(9, 20); }
    if (S && S.finale) { if (t > (prev.beat || 0)) { const b = prev.bi = ((prev.bi || 0) + 1) % 64, at = 0, BASS = [110, 87.3, 130.8, 98];   // a party groove: kick, hats, bass, stabs
        prev.beat = Math.max(t, (prev.beat || t)) + 0.25; const root = BASS[Math.floor(b / 16) % 4];
        if (b % 4 === 0 && S.finale.kind !== 'peace') tone(130, 0.18, { f1: 42, vol: 0.5, dest: partyBus, at });   // the kind ending: no kick, a softer groove
        if (b % 2 === 1) noise(0.05, { type: 'highpass', f: 7000, vol: 0.08, dest: partyBus, at });
        if (b % 8 === 4) noise(0.15, { f: 1800, q: 0.7, vol: 0.12, dest: partyBus, at });
        if (b % 2 === 0) tone(root * (b % 8 === 6 ? 1.5 : 1), 0.22, { type: 'square', vol: 0.12, dest: partyBus, lp: 700, at });
        if (b % 8 === 2 || b % 8 === 7) for (const m of [2, 2.52, 3]) tone(root * m * 2, 0.16, { type: 'triangle', vol: 0.05, dest: partyBus, at }); }
      return; }
    if (AU.musicSrc === 'none') { nextNote = 0; return; }
    if (t > nextNote) { const bar = MEL[Math.floor(noteI / 8) % 4], f = bar[[0, 1, 2, 3, 2, 1, 2, 3][noteI % 8]] * (noteI % 32 >= 28 ? 0.5 : 1); noteI++;
      nextNote = (nextNote || t) + 0.46; if (nextNote < t) nextNote = t + 0.46;
      for (const [m, v] of [[1, 0.18], [2, 0.05], [3.01, 0.025]]) { tone(f * m, 1.6, { vol: v, dest: mus, at: nextNote - t - 0.46 > 0 ? 0 : 0 }); }
      tone(f, 1.6, { vol: 0.06, dest: mus, at: 0.3 }); }                                                   // a soft echo
  }
  // ---- per frame: new events from the sim → positioned sounds; UI state changes ----
  function surf(x, y) { const SM = window.SIM; if (!SM) return 'hard'; if (x > SM.ALLEY[0] && x < SM.ALLEY[2] && y < SM.FACADE) return 'gravel'; if (y < SM.SWN[0] - 10 || y > SM.SWS[1] + 10) return 'grass'; return 'hard'; }
  function frame() {
    requestAnimationFrame(frame); if (!ac || ac.state !== 'running') return;
    const S = window.SCENE && SCENE.state, T = performance.now() / 1000; ambience(S, T);
    if (!S) { primed = false; return; }
    const SM = window.SIM, cam = S.cam || [0, 0];
    for (const e of S.ev) { if (seen.has(e)) continue; seen.add(e); if (!primed || S.t - e.t > 0.3) continue;
      let v = 1, p = 0; if (e.x !== undefined && SM) { const d = Math.hypot(e.x - S.x, e.y - S.y); v = Math.max(0.12, Math.min(1, 1.25 - d / 1600)); p = (SM.proj(e.x, e.y)[0] - cam[0] - 960) / 1100; }
      if (e.k === 'step') { const wet = SM && SM.rainAt && !S.noWeather && SM.rainAt(S.t) > 0.25; if (e.npc) { if (v > 0.3) AU.play('step', (e.boots ? 1.3 : 0.7) * v, p, wet ? 'puddle' : 'hard'); } else AU.play('step', e.soft ? 0.6 : 1, 0, wet ? 'puddle' : surf(e.x, e.y)); continue; }
      if (e.k === 'lightning') { AU.play('lightning', 1, p, e); continue; }
      if (e.k === 'flood') { AU.play(e.on ? 'flood_on' : 'flood_off', v, p); continue; }
      if (e.k === 'say' && e.text) { AU.play('dlg', 0.6); continue; }
      if (e.k === 'virus') { AU.play('virus_' + e.kind, 1); continue; }
      if (e.k === 'bbhit') { AU.play('bbhit', v, p, e.on); continue; }
      AU.play(e.k, v, p); }
    primed = true;
    // UI transitions
    const ph = S.phone ? S.phone.app : null; if ((prev.phone === null) !== (ph === null)) AU.play(ph ? 'phone_open' : 'phone_close'); else if (ph && ph !== prev.app) AU.play('tap');
    prev.phone = ph; prev.app = ph;
    const dw = S.dlg ? S.dlg.who : null; if (dw && dw !== prev.dlg && SM && SM.MODS && SM.MODS[dw]) AU.play('knock', 0.9);
    else if (S.dlg && !prev.dlgObj) AU.play('dlg'); if (S.dlg !== prev.dlgObj && S.dlg && prev.dlgObj) AU.play('tap'); prev.dlg = dw; prev.dlgObj = S.dlg;
  }
  requestAnimationFrame(frame);
})();
