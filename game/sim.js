// live/sim.js — «Сладость или гадость»: deterministic isometric ARPG slice, fixed 120 Hz.
// World: x along the street (screen up-right), y across toward the viewer (screen down-right). Units ≈ 1/55 m.
// Everything that happens lives here (movement, NPCs, Kirill, pranks, phone, quests, money, camera); the scene only draws.
(function (root) {
  const DT = 1 / 120, L = 26.0, VERSION = 'v12';
  const VIEW = { W: 1920, H: 1080 };
  const C = 0.894, SN = 0.447;
  const proj = (x, y, z = 0) => [C * (x + y), SN * (y - x) - z];
  const unproj = (X, Y) => [(X / C - Y / SN) / 2, (X / C + Y / SN) / 2];
  const CLOCK = 6;                       // game seconds per real second (22:00 start)
  const K = { WALK: 150, RUN: 240, WALK_CARRY: 0.62, R: 18, TALK: 150, USE: 130, TURN: 7.5, TURNY: 13, NSTRIDE: 46, STRIDE: 78, RSTRIDE: 112 };
  const HINT = 'ЛКМ — идти / говорить / взять · WASD — ходьба · Shift — бег · ПКМ — гадость в цель · 1–0 — выбор · E — действие · G — положить тыкву · Tab — телефон · Space — спрятаться · F — страйкбол · M — звук';

  // ---------------- level data ----------------
  const ROAD = [-200, 200], SWN = [-340, -200], SWS = [200, 340], X0 = -1400, X1 = 6700;
  const FACADE = -540, HD = 430, HW = 620;            // house front line, house depth, house width
  const HOUSES = [
    { id: 'vera', name: 'Дом Веры', x0: 600, tex: 'house_vera' },
    { id: 'a', name: 'Дом Петровых', x0: 1500, tex: 'house_a' },
    { id: 'kirill', name: 'Дом Кирилла', x0: 2500, tex: 'house_kirill' },
    { id: 'b', name: 'Дом Смирновых', x0: 3500, tex: 'house_b' },
    { id: 'raiva', name: 'Дом Райвы', x0: 4700, tex: 'house_raiva' },
    { id: 'elf', name: 'Дом Эльфа', x0: 5650, tex: 'house_elf' },
    { id: 'kolya', name: 'Дом Коли', x0: -900, tex: 'house_kolya' },
  ].map((h) => Object.assign(h, { x1: h.x0 + HW, df: { vera: 0.47, a: 0.47, kirill: 0.55, b: 0.39, raiva: 0.33, elf: 0.55, kolya: 0.65 }[h.id] }))       // df: the painted door, fraction of the width
    .map((h) => Object.assign(h, { y0: FACADE - HD, y1: FACADE, door: [h.x0 + HW * h.df, FACADE + 40], gate: h.x0 + HW * h.df,
    porch: [h.x0 + HW * (h.df - 0.1), FACADE, h.x0 + HW * (h.df + 0.17), FACADE + 70], mail: [h.x0 + HW * h.df + 149, SWN[0] + 22], yard: [h.x0 - 120, FACADE, h.x1 + 120, SWN[0]] }));
  const HK = HOUSES.find((h) => h.id === 'kirill'), HR = HOUSES.find((h) => h.id === 'raiva'), HE = HOUSES.find((h) => h.id === 'elf'), HKO = HOUSES.find((h) => h.id === 'kolya');
  // the moderators whose houses take the full «сладость или гадость» cycle; each one's state lives in S[key]
  const MODS = { kirill: { id: 'kirill', name: 'Кирилл', gen: 'Кирилла', dat: 'Кириллу', acc: 'Кирилла', ins: 'Кириллом', fav: 'energy', key: 'kir' },
    raiva: { id: 'raiva', name: 'Райва', gen: 'Райвы', dat: 'Райве', acc: 'Райву', ins: 'Райвой', fav: 'solder', key: 'rai' },
    elf: { id: 'elf', name: 'Эльф', gen: 'Эльфа', dat: 'Эльфу', acc: 'Эльфа', ins: 'Эльфом', fav: 'latte', key: 'elf' } };
  const MODIDS = Object.keys(MODS), MODH = { kirill: HK, raiva: HR, elf: HE };
  const ALLEY = [4220, -1380, 4500, FACADE];          // dark alley between Смирновы and Райва
  const ENDLOT = [6420, -1200, 6700, FACADE];         // «странные огни»
  const DARK = [ALLEY, ENDLOT];
  const LAMPS = [[-350, -300], [-760, 300], [250, -300], [1150, -300], [2050, -300], [2950, -300], [3850, -300], [4600, -300], [5450, -300], [6300, -300],
    [700, 300], [1700, 300], [2700, 300], [3700, 300], [4800, 300], [5800, 300]];
  const TREES = [[480, 560, 1.1], [1250, 600, 1.0], [2150, 540, 1.2], [3050, 590, 1.0], [3950, 560, 1.15], [4900, 600, 1.05], [5900, 560, 1.2], [6600, 580, 1.0],
    [430, -455, 0.9], [2330, -470, 0.85], [4580, -470, 0.9], [5540, -455, 0.95], [3350, -1100, 0.8], [-1180, -455, 0.9], [-300, 580, 1.0], [-1150, 600, 1.1]];
  const CARS = [[1000, 130, 'car_a'], [3250, 130, 'car_b'], [5200, 130, 'car_a']];            // centre x, y; 300 × 130
  const BINS = [[4180, -760], [4540, -760], [4385, -1295], [2950, -370], [5480, -370]];
  const BENCHES = [[2000, 345], [4050, 345], [6000, 345]];
  const PROPS = [['crates', 4458, -880, 34], ['crates', 6640, -700, 34]];
  // the north of the map: backyards behind the houses (walkable since v10) with their clutter, a back fence and a wood beyond it
  const NDECOR = [['trampoline', -640, -1170, 210], ['clothesline', -380, -1300, 190], ['pumpkin_patch', 800, -1140, 170], ['greenhouse', 1080, -1260, 200],
    ['swingset', 1700, -1170, 190], ['shed', 2000, -1290, 190], ['shed', 2700, -1260, 190], ['trampoline', 2980, -1150, 210], ['clothesline', 3700, -1160, 190],
    ['pumpkin_patch', 3990, -1280, 170], ['greenhouse', 5000, -1230, 200], ['swingset', 5850, -1160, 190], ['pumpkin_patch', 6150, -1290, 170]];
  const NFENCE = [[X0, ALLEY[0], -1420], [ALLEY[2], X1, -1420]], NDIV = [-140, 460, 1360, 2360, 3360, 5560];   // back fence; lot dividers (x) from the houses' backs to it
  const NGATE = [-1275, -1165];                                                                             // v10: an open wicket in every lot divider
  // v10: the backyard clutter is solid — footprints relative to the prop's spot: ['c', dx, dy, r] or ['b', x0, y0, x1, y1]
  const NSOLID = { trampoline: ['c', 34, -34, 66], clothesline: ['b', -75, -26, 109, -8], pumpkin_patch: ['b', -22, -78, 90, 10], greenhouse: ['b', -39, -67, 89, 17], swingset: ['b', -55, -45, 105, -5], shed: ['b', -52, -46, 52, 46] };
  const nsBox = ([n, x, y]) => { const f = NSOLID[n]; return f[0] === 'c' ? [x + f[1] - f[3] * 0.75, y + f[2] - f[3] * 0.75, x + f[1] + f[3] * 0.75, y + f[2] + f[3] * 0.75] : [x + f[1], y + f[2], x + f[3], y + f[4]]; };
  const NTREES = [], hh0 = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }; for (let r = 0; r < 4; r++) for (let x = X0 - 200 + (r % 2) * 95; x < X1 + 300; x += 190) {
    const j = hh0(x * 0.013 + r * 7.7); NTREES.push([x + (j - 0.5) * 90, -1560 - r * 230 - hh0(x * 0.07 + r) * 90, 0.95 + 0.4 * hh0(x * 0.031 + r * 3.1)]); }
  const YTREES = [[150, -1150], [420, -1330], [1250, -1320], [2250, -1180], [3250, -1320], [5440, -1340], [6350, -1280]].map(([x, y], i) => [x, y, 1.05 + 0.15 * (i % 3)]); YTREES.forEach((t) => NTREES.push(t));   // trees between the yards          // decorative clutter in the alley and the end lot: [tex, x, y, r]
  const BUSHES = [[HK.x0 - 50, -470], [HK.x1 + 60, -480], [HK.x0 + 60, -395], [1450, -420], [3450, -420], [4650, -400], [4760, -395], [5380, -480], [5600, -480], [800, -400], [6150, -420], [-1040, -470], [-240, -420]];
  const PILES = [[350, -260, 1], [1600, 260, 0], [2300, -420, 1], [2850, -250, 0], [3600, 270, 1], [4350, -900, 1], [5000, -270, 0], [5850, -430, 1], [6250, 250, 0]];
  const FENCE_Y = SWN[0] - 12;
  const FENCES = []; HOUSES.forEach((h) => { FENCES.push([h.x0 - 140, h.gate - 70], [h.gate + 70, h.x1 + 140]); });
  const SFENCE = [X0, X1];                             // south picket fence along y = 390 (south yards are not walkable)
  // money: [x, y, ₽, where]
  const MONEY = [[1180, 330, 20, 'bench'], [2000, 360, 50, 'bench'], [4050, 360, 30, 'bench'], [4300, -1200, 100, 'dark'], [4420, -1000, 50, 'dark'],
    [6550, -1000, 80, 'dark'], [350, -260, 30, 'pile'], [2300, -420, 40, 'pile'], [3600, 270, 25, 'pile'], [4350, -900, 35, 'pile'], [5850, -430, 30, 'pile'], [2650, 120, 10, 'street'], [5100, -120, 15, 'street'],
    [-560, -1360, 40, 'dark'], [2560, -1370, 60, 'dark'], [5240, -1360, 50, 'dark'], [1820, -1000, 30, 'dark']];   // v10: coins in the backyards
  const VPUMPKINS = [[4440, -1260], [3180, 300], [5640, -430]];   // Вера's missing pumpkins
  const ROTTENS = [[4300, -1120], [6600, -820]], ROTTEN = ROTTENS[0];                    // rotten pumpkins: the alley, the end lot
  const STRANGE = [6560, -950];
  // v9 interactive bits: Vera's candy bowl on her path, the black cat's haunts, the lamp heads (BB targets: shoot a lamp out)
  const BOWL = [HOUSES[0].door[0] + 62, FACADE + 42];
  // v10: costumes from Vera's chest (after her quest): [id, the choice label, what she says]
  const COSTUMES = [['ghost', '👻 Призрак', 'Бу-у! Простыня внука. Модеры тебя не узнают. Ну, почти.'], ['pumpkin', '🎃 Тыква', 'Тыква-шлем! Внутри фонарик, чтобы не врезаться в забор.'],
    ['hat', '🧙 Колдун', 'Шляпа колдуна. Говорят, в ней яйца летят точнее. Врут, конечно.'], ['horns', 'ψ(｀∇´)ψ Чертёнок', 'Рожки! Тебе идёт. Подозрительно идёт.']];
  const CATSPOTS = [[300, -280], [900, 280], [1800, -300], [2600, 300], [3300, -290], [4100, 270], [4900, -300], [5600, 290], [6200, -290], [-500, -290], [-200, 300], [1300, -280], [3800, 290]];
  const LAMPHEAD = (() => { const a = (root.ASSETS || {}).lamp, w = a ? 270 * a.w / a.h : 200; return [(0.81 - 0.336) * w, 216]; })();   // screen offset of the bulb from the pole's foot
  // v10: rain and thunderstorms on a fixed evening schedule (s of play, faded in and out); during the heavy part lightning strikes now and
  // then and blacks the street lamps out for a while (darker: the patrol sees less), then the power comes back
  const RAINW = [[150, 380], [780, 1030], [1440, 1680], [2120, 2400], [2950, 3200], [3700, 3950]];
  const rainAt = (t) => { let a = 0; for (const [s0, s1] of RAINW) a = Math.max(a, Math.min(1, (t - s0) / 25, (s1 - t) / 25)); return Math.max(0, a); };
  const STRIKES = []; RAINW.forEach(([s0, s1], w) => { let t = s0 + 45 + 20 * hh0(w * 3.3); while (t < s1 - 35) { STRIKES.push([t, w]); t += 24 + 26 * hh0(t * 0.37 + w); } });
  const dark = (S) => !!(S.blackout && S.t < S.blackout.end);
  const lampLit = (S, i) => !dark(S) && !(S.lampOff && S.lampOff[i] !== undefined && S.t - S.lampOff[i] < 90);
  function weatherStep(S) { if (S.noWeather) return; const t = S.t;
    if (S.si === undefined) { S.si = STRIKES.findIndex((q) => q[0] > t); if (S.si < 0) S.si = STRIKES.length; }
    while (S.si < STRIKES.length && STRIKES[S.si][0] <= t) { const [t0, w] = STRIKES[S.si++]; if (t - t0 > 1) continue;
      const fl = hh0(t0 * 1.7), x = S.x + (fl - 0.5) * 3000, y = -1800 - 600 * hh0(t0 * 2.9), dur = 9 + 7 * hh0(t0 * 0.53);
      ev(S, { k: 'lightning', x, y, near: fl < 0.35 ? 1 : 0, dl: 0.4 + 1.8 * hh0(t0 * 4.1) });
      if (fl < 0.75) { const was = dark(S); S.blackout = { t0: t, end: t + dur }; ev(S, { k: 'blackout', x: S.x, y: S.y });
        if (!was && S.stormW !== w) { S.stormW = w; toast(S, 'Молния! На улице погас свет — патрулю хуже видно'); } } } }
  // achievements, hardest first (tier 3 gold, 2 silver, 1 bronze); n: a counter to reach
  const ACH = [
    { id: 'saint', tier: 3, name: 'Святой Коля', desc: 'Помириться со всеми тремя модерами, не сделав им ни одной гадости' },
    { id: 'apocalypse', tier: 3, name: 'Апокалипсис районного масштаба', desc: 'Закидать все три дома модеров на 100 %' },
    { id: 'master', tier: 3, name: 'Мастер гадостей', desc: 'Применить все 10 гадостей', n: 10 },
    { id: 'elusive', tier: 3, name: 'Неуловимый', desc: 'Трижды уйти от погони патруля', n: 3 },
    { id: 'rotten_hunter', tier: 2, name: 'Тухлый охотник', desc: 'Попасть 10 яйцами в один дом', n: 10 },
    { id: 'boom', tier: 2, name: 'Бабах-бабах', desc: 'Оглушить петардами троих', n: 3 },
    { id: 'ninja', tier: 2, name: 'Ниндзя у двери', desc: 'Дважды позвонить модеру в дверь и убежать незамеченным', n: 2 },
    { id: 'pizza', tier: 2, name: 'Пицца-террорист', desc: 'Отправить модеру 10 пицц' },
    { id: 'mummy', tier: 2, name: 'Мумификатор', desc: 'Обмотать туалетной бумагой троих прохожих', n: 3 },
    { id: 'picasso', tier: 1, name: 'Пикассо с района', desc: 'Нарисовать мелом с точностью 90 % и выше' },
    { id: 'grandson', tier: 1, name: 'Внучок', desc: 'Вернуть Вере три тыквы' },
    { id: 'payback', tier: 1, name: 'Получил сдачи', desc: 'Довести прохожего до мести' },
    { id: 'sweet', tier: 1, name: 'Сладкоежка', desc: 'Получить конфеты от модера' },
    { id: 'social', tier: 1, name: 'Душа компании', desc: 'Поговорить с пятью жителями', n: 5 },
    { id: 'first_egg', tier: 1, name: 'Первый желток', desc: 'Бросить первое яйцо' },
    { id: 'binge', tier: 1, name: 'Ещё одну серию', desc: 'Посмотреть пролог до конца, не пропуская' },          // v12: the prologue and the festival
    { id: 'carver', tier: 2, name: 'Пятизвёздочная тыква', desc: 'Победить в конкурсе резьбы по тыкве' },
    { id: 'apples', tier: 1, name: 'Зубастик', desc: 'Выловить 10 яблок из бочки за один заход', n: 10 },
    { id: 'catwalk', tier: 2, name: 'Звезда подиума', desc: 'Победить в конкурсе костюмов' },
    { id: 'gacha5', tier: 2, name: 'Легендарный дроп', desc: 'Выбить ★5 в гача-автомате' }];
  const ACHI = Object.fromEntries(ACH.map((a) => [a.id, a]));
  function achieve(S, id) { S.ach = S.ach || {}; if (S.ach[id] || !ACHI[id]) return; S.ach[id] = Math.max(0.001, S.gt); ev(S, { k: 'ach', id, x: S.x, y: S.y }); }
  function achAdd(S, id, n = 1, key = id) { S.achv = S.achv || {}; S.achv[key] = (S.achv[key] || 0) + n; const a = ACHI[id]; if (a && S.achv[key] >= (a.n || 1)) achieve(S, id); }
  function achKind(S, kind) { S.achv = S.achv || {}; const k = S.achv.kinds = S.achv.kinds || []; if (!k.includes(kind)) { k.push(kind); S.achv.master = k.length; if (k.length >= 10) achieve(S, 'master'); } }

  // ---------------- shop & items ----------------
  const SHOP = [
    { id: 'eggs', name: 'Яйца, 12 шт', price: 120, give: ['eggs', 12], kind: 'prank' },
    { id: 'tp', name: 'Туалетная бумага, 4 рулона', price: 80, give: ['tp', 4], kind: 'prank' },
    { id: 'alarm', name: 'Будильник «Петух»', price: 150, give: ['alarm', 1], kind: 'prank' },
    { id: 'fire', name: 'Петарды «Бабах»', price: 200, give: ['fire', 1], kind: 'prank' },
    { id: 'slime', name: 'Слайм «Сопля»', price: 90, give: ['slime', 1], kind: 'prank' },
    { id: 'chalk', name: 'Мелки', price: 50, give: ['chalk', 1], kind: 'prank' },
    { id: 'flyers', name: 'Флаеры, 5 шт', price: 60, give: ['flyers', 5], kind: 'prank' },
    { id: 'energy', name: 'Энергетик «Бан-хаммер»', price: 150, give: ['energy', 1], kind: 'gift' },
    { id: 'candle', name: 'Свеча «Запах бана»', price: 100, give: ['candle', 1], kind: 'gift' },
    { id: 'hoodie', name: 'Худи «Я ♥ модерацию»', price: 300, give: ['hoodie', 1], kind: 'gift' },
    { id: 'solder', name: 'Паяльник «Огонёк»', price: 180, give: ['solder', 1], kind: 'gift' },
    { id: 'latte', name: 'Латте «Карамельный эльф»', price: 160, give: ['latte', 1], kind: 'gift' },
    { id: 'bb', name: 'Шарики 6 мм, 500 шт', price: 100, give: ['bb', 500], kind: 'ammo' },
  ];
  const GIFTS = { energy: 'Энергетик «Бан-хаммер»', candle: 'Свеча «Запах бана»', hoodie: 'Худи «Я ♥ модерацию»', solder: 'Паяльник «Огонёк»', latte: 'Латте «Карамельный эльф»' };
  // Raiva's revenge: the «КотоМем» virus buys junk every 3 game minutes
  const JUNK = [['Цепь. Просто цепь, 3 метра', 450], ['Лапша быстрого приготовления, 5 кг', 350], ['Поездка в Северную Корею (невозвратная)', 9990], ['Чучело совы «Совет»', 1200],
    ['Курс «Модератор за 3 дня»', 2990], ['Надувной фламинго, 2 м', 800], ['Подписка «Котики Premium» на 10 лет', 2990], ['Лопата (б/у)', 700], ['Пупырчатая плёнка, 30 м', 400],
    ['Шапочка из фольги, размер XXL', 150], ['Билет на концерт баяниста', 600], ['Гиря 32 кг с доставкой', 1800]];
  const VNOISE = { horn: '📱 ТЕЛЕФОН ОРЁТ ГУДКОМ НА ВСЮ УЛИЦУ!', siren: '📱 Из кармана воет сирена!', meow: '📱 Телефон истошно мяукает!', modem: '📱 Телефон пищит как модем из 90-х!' };
  // hotbar slots 1..10 → prank
  const SLOTS = ['eggs', 'tp', 'bell', 'rotten', 'alarm', 'chalk', 'fire', 'slime', 'pizza', 'flyers'];
  const SLOT_NAME = { airsoft: 'Страйкбол', eggs: 'Яйца', tp: 'Туалетная бумага', bell: 'Звонок-и-беги', rotten: 'Гнилая тыква', alarm: 'Будильник', chalk: 'Мелки', fire: 'Петарды', slime: 'Слайм', pizza: '10 пицц', flyers: 'Флаеры' };
  const PRANK = { airsoft: [1, 10], eggs: [3, 30], tp: [6, 24], bell: [8, 16], rotten: [10, 10], alarm: [8, 8], chalk: [10, 10], fire: [10, 10], slime: [7, 7], pizza: [10, 10], flyers: [2.4, 12] };

  // ---------------- NPCs ----------------
  const NPCS = [
    { id: 'vera', name: 'Вера', tex: 'npc_witch', stat: [HOUSES.find((h) => h.id === 'vera').door[0] - 40, FACADE + 60], lines: null },
    { id: 'ghost', name: 'Призрак Аня', tex: 'npc_ghost', route: [[300, -262], [2400, -262]], v: 58,
      lines: ['Бу! …Ладно, не страшно, да?', 'Кирилл всегда выглядывает в окно. Каждые пару минут, как часы.', 'Говорят, Кирилл без ума от энергетика «Бан-хаммер».'] },
    { id: 'pumpkinboy', name: 'Тыквенный Лёша', tex: 'npc_cloak', route: [[1400, 268], [4400, 268]], v: 66,
      lines: ['В переулке за мусорками валяется гнилая тыква. Воняет — жуть.', 'Если пнуть кучу листьев, иногда находишь мелочь.'] },
    { id: 'devil', name: 'Чертёнок Маша', tex: 'npc_devil', route: [[2600, -252], [5200, -252]], v: 62,
      lines: ['Флаеры отлично клеятся на фонари. Просто к сведению (｀∀´)Ψ', 'В тёмном переулке без фонарика ничего не видно. Он у тебя в телефоне.', 'Райва вечно что-то паяет. Говорят, мечтает о паяльнике «Огонёк».',
        'У Эльфа во дворе датчик движения. Замри — и прожектор погаснет.'] },
    { id: 'skeleton', name: 'Скелет Дэн', tex: 'npc_skeleton', route: [[5900, 262], [3000, 262]], v: 60,
      lines: ['Видел свет в конце улицы? Там кто-то по ночам что-то паяет.', 'Эльф жить не может без латте. Говорят, «Карамельный эльф» — её любимый. В телефоне продаётся.', 'Кирилл не открывает, если звонят и убегают. Ну… пробует.'] },
    { id: 'pumpkinhood', name: 'Тыковка Лиза', tex: 'npc_hoodie', route: [[800, 258], [3200, 258]], v: 54,
      lines: ['Бабушка… то есть Вера потеряла три тыквы. Помоги ей!', 'Под лавками иногда лежат деньги. Проверь!'] },
    { id: 'shy', name: 'Ведьмочка', tex: 'npc_witch2', route: [[4600, -258], [6300, -258]], v: 50, silent: true,
      lines: ['…', '*делает вид, что не слышит*', 'У Райвы на крыльце камера. Она пишет, когда горит красный огонёк.'] },
    { id: 'emo', name: 'Мрачный тип', tex: 'npc_skeleton', route: [[200, 305], [1500, 305]], v: 46, silent: true,
      lines: ['*молча смотрит в телефон*', '…', 'Отстань.'] },
  ];

  // ---------------- collision ----------------
  const BOX = [];     // [x0, y0, x1, y1] blocked
  HOUSES.forEach((h) => BOX.push([h.x0, h.y0, h.x1, h.y1]));
  FENCES.forEach(([a, b]) => BOX.push([a, FENCE_Y - 8, b, FENCE_Y + 8]));
  BOX.push([X0, 390, 2540, 410], [2700, 390, X1, 410]);                                                    // south fence, v12: a gate to the festival plaza
  BOX.push([X0, 410, 2240, 2400], [2980, 410, X1, 2400], [2240, 1090, 2980, 2400], [2835, 505, 2985, 690]);     // the south yards stay closed; the stage
  CARS.forEach(([x, y]) => BOX.push([x - 150, y - 62, x + 150, y + 62]));
  BENCHES.forEach(([x, y]) => BOX.push([x - 68, y - 18, x + 68, y + 20]));                                       // benches are solid
  BOX.push([X0 - 100, -1500, X0, 500], [X1, -1500, X1 + 100, 500]);                                        // street ends
  // v10: the backyards are open — only the back fence (and the wood beyond it) stops him; lot dividers with a wicket, solid clutter
  BOX.push([X0, -1500, X1, -1420]);
  NDIV.forEach((x) => { BOX.push([x - 6, NGATE[1], x + 6, FACADE - HD], [x - 6, -1420, x + 6, NGATE[0]]); });
  NDECOR.forEach((d) => { if (NSOLID[d[0]][0] === 'b') BOX.push(nsBox(d)); });
  // the alley's tall side fences and back fence are solid (thick enough that Kolya never overlaps their sprites)
  BOX.push([ALLEY[0] - 14, ALLEY[1], ALLEY[0] + 16, FACADE], [ALLEY[2] - 16, ALLEY[1], ALLEY[2] + 14, FACADE], [ALLEY[0], ALLEY[1] - 6, ALLEY[2], ALLEY[1] + 16]);
  // the garage in the end lot (its sprite's footprint: front corner by the strange lights, walls along +x and −y) is solid
  const GARAGE = [6585, -1199, 6852, -940]; BOX.push([GARAGE[0], GARAGE[1], X1, GARAGE[3]]);
  const FSOLID = () => [[2330, 560, 92], [2760, 470, 46], [2370, 915, 82], [2905, 1040, 92], [2268, 445, 14], [2490, 470, 14], [2965, 1078, 14], [2262, 1065, 14], [2968, 470, 14],
    [2480, 620, 20], [2560, 690, 16], [2690, 610, 20], [2760, 780, 20], [2690, 860, 20], [2810, 860, 20], [2600, 900, 16], [2830, 760, 20], [2420, 760, 20], [2650, 780, 20], [2520, 990, 16]];
  const CIRC = [...FSOLID(), ...LAMPS.map(([x, y]) => [x, y, 14]), ...TREES.filter((t) => t[1] < 0).map(([x, y, s]) => [x, y, 30 * s]), ...BINS.map(([x, y]) => [x, y, 26]),
    ...BENCHES.map(([x, y]) => [x, y, 0]), ...PROPS.map(([, x, y, r]) => [x, y, r]), ...YTREES.map(([x, y, s]) => [x, y, 24 * s]),
    ...NDECOR.filter((d) => NSOLID[d[0]][0] === 'c').map(([n, x, y]) => [x + NSOLID[n][1], y + NSOLID[n][2], NSOLID[n][3]])];
  const inBox = (x, y, b, m = 0) => x > b[0] - m && x < b[2] + m && y > b[1] - m && y < b[3] + m;
  const blocked = (x, y, r = K.R) => BOX.some((b) => inBox(x, y, b, r)) || CIRC.some(([cx, cy, cr]) => cr > 0 && Math.hypot(x - cx, (y - cy)) < cr + r);
  function collide(S) {
    for (const b of BOX) { if (!inBox(S.x, S.y, b, K.R)) continue;
      const dl = S.x - (b[0] - K.R), dr = (b[2] + K.R) - S.x, du = S.y - (b[1] - K.R), dd = (b[3] + K.R) - S.y, m = Math.min(dl, dr, du, dd);
      if (m === dl) S.x = b[0] - K.R; else if (m === dr) S.x = b[2] + K.R; else if (m === du) S.y = b[1] - K.R; else S.y = b[3] + K.R; }
    for (const [cx, cy, cr] of CIRC) { if (cr <= 0) continue; const dx = S.x - cx, dy = S.y - cy, d = Math.hypot(dx, dy), r = cr + K.R;
      if (d < r && d > 0) { S.x = cx + dx / d * r; S.y = cy + dy / d * r; } }
    if (S.raid) for (const c of S.raid.cars) { const b = [c.x - 150, c.y - 62, c.x + 150, c.y + 62]; if (!inBox(S.x, S.y, b, K.R)) continue;
      const dl = S.x - (b[0] - K.R), dr = (b[2] + K.R) - S.x, du = S.y - (b[1] - K.R), dd = (b[3] + K.R) - S.y, m = Math.min(dl, dr, du, dd);
      if (m === dl) S.x = b[0] - K.R; else if (m === dr) S.x = b[2] + K.R; else if (m === du) S.y = b[1] - K.R; else S.y = b[3] + K.R; }
  }

  // ---------------- path grid (A*) ----------------
  const G = { cs: 40, x0: X0, y0: -1500, nx: Math.ceil((X1 - X0) / 40), ny: Math.ceil(2640 / 40) };
  let GRID = null;
  const grid = () => { if (GRID) return GRID; GRID = new Uint8Array(G.nx * G.ny);
    for (let j = 0; j < G.ny; j++) for (let i = 0; i < G.nx; i++) GRID[j * G.nx + i] = blocked(G.x0 + (i + 0.5) * G.cs, G.y0 + (j + 0.5) * G.cs, K.R + 6) ? 1 : 0; return GRID; };
  const cellOf = (x, y) => [Math.floor((x - G.x0) / G.cs), Math.floor((y - G.y0) / G.cs)];
  const DYN = [];                                   // moving obstacles this step (the raid's cars): paths go around them
  const free = (i, j) => i >= 0 && j >= 0 && i < G.nx && j < G.ny && !grid()[j * G.nx + i] && !(DYN.length && DYN.some((b) => inBox(G.x0 + (i + 0.5) * G.cs, G.y0 + (j + 0.5) * G.cs, b, K.R + 6)));
  function los(a, b) { const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 15);
    for (let k = 1; k <= n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n;
      const [i, j] = cellOf(x, y); if (!free(i, j) && (blocked(x, y, K.R + 2) || DYN.some((q) => inBox(x, y, q, K.R + 2)))) return false; } return true; }        // the grid first (cheap), exact test only in blocked cells
  // sight lines (the raid): only walls, fences, houses and cars stop a look, not lamp posts or bins
  function seeLine(a, b) { const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(d / 25);
    for (let k = 1; k < n; k++) { const x = a[0] + (b[0] - a[0]) * k / n, y = a[1] + (b[1] - a[1]) * k / n; if (BOX.some((q) => inBox(x, y, q))) return false; } return true; }
  function findPath(a, b) {
    if (los(a, b)) return [b];
    let [si, sj] = cellOf(a[0], a[1]), [ti, tj] = cellOf(b[0], b[1]);
    if (!free(ti, tj)) { let best = null, bd = 1e9; for (let r = 1; r < 8 && !best; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (free(ti + di, tj + dj)) { const d = di * di + dj * dj; if (d < bd) { bd = d; best = [ti + di, tj + dj]; } }
      if (!best) return []; [ti, tj] = best; b = [G.x0 + (ti + 0.5) * G.cs, G.y0 + (tj + 0.5) * G.cs]; }
    const N = G.nx * G.ny, gS = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const id = (i, j) => j * G.nx + i, hh = (i, j) => Math.hypot(i - ti, j - tj);
    const hp = [], push = (f, c) => { hp.push([f, c]); let k = hp.length - 1; while (k > 0) { const q = (k - 1) >> 1; if (hp[q][0] <= hp[k][0]) break; [hp[q], hp[k]] = [hp[k], hp[q]]; k = q; } };
    const pop = () => { const top = hp[0], last = hp.pop(); if (hp.length) { hp[0] = last; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let m = k;
      if (a < hp.length && hp[a][0] < hp[m][0]) m = a; if (b < hp.length && hp[b][0] < hp[m][0]) m = b; if (m === k) break; [hp[m], hp[k]] = [hp[k], hp[m]]; k = m; } } return top; };
    const s = id(si, sj); gS[s] = 0; push(hh(si, sj), s);
    let found = false, iter = 0;
    while (hp.length && iter++ < 20000) {
      const [, c] = pop(); if (closed[c]) continue; closed[c] = 1;
      const ci = c % G.nx, cj = (c - ci) / G.nx; if (ci === ti && cj === tj) { found = true; break; }
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { if (!di && !dj) continue; const ni = ci + di, nj = cj + dj; if (!free(ni, nj)) continue;
        if (di && dj && (!free(ci + di, cj) || !free(ci, cj + dj))) continue;
        const n = id(ni, nj), g = gS[c] + (di && dj ? 1.414 : 1); if (g < gS[n]) { gS[n] = g; from[n] = c; push(g + hh(ni, nj), n); } } }
    if (!found) return [];
    const cells = []; for (let c = id(ti, tj); c !== -1 && c !== s; c = from[c]) cells.push(c);
    const pts = cells.reverse().map((c) => { const i = c % G.nx, j = (c - i) / G.nx; return [G.x0 + (i + 0.5) * G.cs, G.y0 + (j + 0.5) * G.cs]; });
    pts.push(b);
    const out = []; let cur = a;                                        // string pulling
    for (let k = 0; k < pts.length; k++) { if (k === pts.length - 1 || !los(cur, pts[k + 1])) { out.push(pts[k]); cur = pts[k]; } }
    return out;
  }

  // ---------------- helpers ----------------
  // Kolya's drawn views by screen facing angle (0 = right, +π/2 = down): [rig, angle, mirrored]
  // Kolya's drawn views (frame atlases kf_<view>_*) by screen facing angle (0 = right, +π/2 = down): [view, angle, mirrored]
  const KA = Math.atan(0.5), KVIEWS = [['e', 0, false], ['se', KA, false], ['s', Math.PI / 2, false], ['se', Math.PI - KA, true], ['e', Math.PI, true],
    ['ne', -(Math.PI - KA), true], ['n', -Math.PI / 2, false], ['ne', -KA, false]];
  const turnTo = (a, target, mx) => { const d = ((target - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + Math.max(-mx, Math.min(mx, d)); };
  const scrAng = (wx, wy) => Math.atan2(SN * (wy - wx), C * (wx + wy));
  const h1 = (n) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const windAt = (t, x) => 0.3 * Math.sin(0.5 * t + 0.0011 * x) + 0.15 * Math.sin(1.37 * t + 0.0031 * x + 1.3) + gustAt(t, x);
  const GUST = 17, GUST_V = 700;
  const gustAt = (t, x) => { const k = Math.floor(t / GUST); let g = 0;
    for (const kk of [k - 1, k]) { const t0 = kk * GUST + 3 + 7 * h1(kk); if (t < t0) continue; const front = X0 - 800 + GUST_V * (t - t0), d = x - front;
      g += (0.6 + 0.6 * h1(kk + 0.5)) * Math.exp(-((d / (d > 0 ? 300 : 900)) ** 2)); } return g; };
  const clockStr = (S) => { const m = Math.floor((22 * 60) + S.gt / 60) % (24 * 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  // Kirill at the window: 4 s windows every ~11–15 s (deterministic schedule)
  const kirillWinT = (t, b = false) => { const per = b ? 8.5 : 13; const k = Math.floor(t / per), t0 = k * per + (b ? 1.5 : 4) + 3 * h1(k * 3.1); return t >= t0 && t < t0 + (b ? 5.5 : 4.2) ? t - t0 : -1; };
  const kirillWindow = (t) => kirillWinT(t) >= 0;
  // Raiva's porch camera records (red light) for 3.6 s every ~11 s
  const raivaCamT = (t, b = false) => { const per = b ? 7 : 11; const k = Math.floor(t / per), t0 = k * per + (b ? 1 : 2) + (b ? 1 : 3) * h1(k * 5.7 + 1); return t >= t0 && t < t0 + (b ? 5 : 3.6) ? t - t0 : -1; };
  // Elf's porch floodlight: a motion sensor (Kolya moving in her yard) switches it on; it goes out 4 s after the last motion
  const boosted = (S) => !!(S.boost && S.boost.skel);
  const watchOn = (S, id, t = S.t) => (id === 'raiva' ? raivaCamT(t, boosted(S)) >= 0 : id === 'elf' ? S.elf.lit >= 0 : kirillWinT(t, boosted(S)) >= 0);
  const M = (S, id) => S[MODS[id].key];
  // the moderator whose house Kolya stands at (yard, gate or the sidewalk in front), nearest door first
  const modNear = (S) => { let best = null, bd = 1e9; for (const id of MODIDS) { const h = MODH[id], d = Math.abs(S.x - h.door[0]);
    if (S.x > h.yard[0] - 150 && S.x < h.yard[2] + 150 && S.y < ROAD[0] + 160 && d < bd) { bd = d; best = id; } } return best; };
  const inYard = (x, y, h = HK) => x > h.yard[0] && x < h.yard[2] && y > h.yard[1] - 10 && y < h.yard[3] + 40;
  const nearHidingSpot = (x, y, S) => { for (const [bx, by] of BUSHES) if (Math.hypot(x - bx, y - by) < 85) return ['bush', bx, by];
    for (let i = 0; i < BINS.length; i++) { const [bx, by] = BINS[i]; if (S && S.binsDown && S.t - (S.binsDown[i] ?? -99) < 60) continue; if (Math.hypot(x - bx, y - by) < 75) return ['bin', bx, by]; } return null; };
  const lampNear = (x, y) => LAMPS.findIndex(([lx, ly]) => Math.hypot(x - lx, y - ly) < 110);

  const newMod = (extra) => Object.assign({ st: 'inside', t0: 0, refused: false, done: -1, sweet: false, p: 0, pr: {}, bell: null, alarm: null, fire: null, slime: 0,
    swapped: false, lamps: [], chalk: 0, revengeAt: -1 }, extra);
  function create() {
    return { t: 0, steps: 0, wt0: 0, gt: 0, x: HKO.door[0], y: FACADE + 110, vx: 0, vy: 0, face: [1, 1], ang: 0.46, gph: 0, turnA: 0, runA: 0, stride: 78, faceLock: -1, lockAng: 0, dist: 0, hp: 100, money: 100, ev: [],
      cam: [0, 0], camV: [0, 0], path: [], pathGoal: null, act: null, hidden: false, carry: null, light: false, slot: 1,
      inv: { eggs: 6, tp: 0, alarm: 0, fire: 0, slime: 0, chalk: 0, flyers: 0, energy: 0, candle: 0, hoodie: 0, solder: 0, latte: 0, bb: 0 },
      hasGun: false, gun: false, gunNext: 0, shotT: -9, ghost: false, stats: { eggs: 0, tp: 0, bb: 0, hits: 0 },
      dm: { 'Модеры 🎃': [{ me: false, from: 'Кирилл', text: 'Народ, с Хэллоуином! Сидим по домам, раздаём конфеты 🎃 Колю не зовём — он всё равно в своих реакциях.', gt: 0 }, { me: false, from: 'Эльф', text: '🎤 Голосовое сообщение · 0:16', gt: 0, voice: 1 }] }, dmq: [], fest: newFest(), intro: null, mg: null, gq: [], gacc: {}, glast: {}, gany: -99, loans: {}, boost: {}, timNext: 0, devLog: [{ me: false, text: 'Консоль разработчика. help — список команд.' }], finale: null,
      got: MONEY.map(() => -1), piles: PILES.map(() => -1), vp: VPUMPKINS.map(() => -1), rottenGot: ROTTENS.map(() => false), strange: -1, target: null,
      talked: {}, q: { talk: 0, vera: 0, strange: 0 },
      kir: newMod({ auction: 0, nextAuction: -1, sold: 0 }), rai: newMod({ virus: null, junk: [], nextBuy: -1, nextNoise: -1 }),
      elf: newMod({ lit: -1, arm: -1, last: -99, sayT: -99 }), raid: null,
      marks: [], proj: [], chalk: null, dlg: null, phone: null, toasts: [], msgs: [
        { from: 'Кирилл', text: 'Народ, с Хэллоуином! Сидим по домам, раздаём конфеты 🎃 Колю не зовём — он всё равно в своих реакциях.', gt: 0, read: false, group: true },
        { from: 'Эльф', text: '🎤 Голосовое сообщение · 0:16', gt: 0, read: false, group: true, voice: 1 },
        { from: 'Эльф', text: 'Только попробуй закидать мой дом, красавчик. Я серьёзно (* ^ ω ^)♡', gt: 0, read: false }],
      npc: NPCS.map((n, i) => ({ id: n.id, x: n.stat ? n.stat[0] : n.route[0][0], y: n.stat ? n.stat[1] : n.route[0][1], k: 0, face: [1, 1], ang: 0.46, walk: 0, talkT: -9, line: '', pause: 0, i })),
      courier: null, kids: null, charge: -1, slimeHold: 0, prev: {},
      // v9: pumpkins put down, firecrackers / alarm clocks / chalk drawings anywhere, neighbours' doors, lamps shot out, kicked bins, the cat, achievements
      drops: [], fires: [], decoys: [], drawings: [], hslime: {}, hbell: {}, flyers2: [], lampOff: {}, binsDown: {}, bowl: { n: 0, t: -99 }, sugarT: -99, wrapT: -99, eggd: -99,
      cat: { x: CATSPOTS[0][0], y: CATSPOTS[0][1], ang: 0.46, k: 0, st: 'walk', pause: 2, follow: -99, purr: -99, hiss: -99, gph: 0, mv: 0 }, ach: {}, achv: {} };
  }
  const spawn = (worldT) => { const S = Object.assign(create(), { wt0: worldT }), hp = proj(S.x, S.y); S.cam = [hp[0] - VIEW.W / 2, hp[1] - VIEW.H / 2 - 50]; return S; };   // camera on Kolya from the first frame
  const respawn = (S, worldT) => { const R = spawn(worldT); Object.assign(R, { money: Math.floor(S.money * 0.8), inv: S.inv, kir: S.kir, rai: S.rai, elf: S.elf, raid: S.raid, hasGun: S.hasGun, dm: S.dm, loans: S.loans, boost: S.boost, stats: S.stats, devLog: S.devLog, target: S.target, q: S.q, talked: S.talked, got: S.got, piles: S.piles, vp: S.vp, msgs: S.msgs, marks: S.marks, rottenGot: S.rottenGot, gt: S.gt,
      drops: S.drops || [], drawings: S.drawings || [], flyers2: S.flyers2 || [], ach: S.ach || {}, achv: S.achv || {}, bowl: S.bowl || { n: 0, t: -99 }, costume: S.costume || '', fest: S.fest || newFest(), dmc: S.dmc || {}, introDone: S.introDone || 0, dmv2: S.dmv2 });
    if (S.carry === 'rotten') R.drops.push({ x: S.x, y: S.y, kind: 'rotten', t: 0 });                           // the pumpkin stays where he fell
    R.toasts = [{ text: 'Коля сходил домой, выпил чаю и вернулся (−20 % денег)', t: 0 }]; R.ang = 0.46; return R; };
  const outOfPlay = (S) => S.hp <= 0 && S.t - (S.koT || S.t) > 2.5;

  const toast = (S, text, kind = 'info') => { S.toasts.push({ text, t: S.t, kind }); if (S.toasts.length > 4) S.toasts.shift(); };
  const ev = (S, e) => { e.t = S.t; S.ev.push(e); if (S.ev.length > 96) S.ev.splice(0, S.ev.length - 96); };
  const msg = (S, from, text) => { S.msgs.push({ from, text, gt: S.gt, read: false }); S.dm = S.dm || {}; (S.dm[from] = S.dm[from] || []).push({ me: false, text, gt: S.gt }); ev(S, { k: 'notify', from, x: S.x, y: S.y }); };   // v12: every contact has its own thread
  const say = (S, who, text, dur = 3.2) => { ev(S, { k: 'say', who, text, dur, x: 0, y: 0 }); };

  function addPrank(S, id, kind, label) {
    const k = M(S, id), md = MODS[id], h = MODH[id]; k.dirty = 1;                   // v10: any prank on a moderator (even before knocking, even after the gift) rules out the kind ending
    if (k.done >= 0 || k.sweet) return false;
    if (!k.refused) { toast(S, `Сначала постучи к ${md.dat}: вдруг будет сладость?`); return false; }
    const [amt, cap] = PRANK[kind], had = k.pr[kind] || 0, add = Math.max(0, Math.min(amt, cap - had));
    if (add <= 0) { toast(S, `«${SLOT_NAME[kind]}» больше не действует на ${md.acc}`); return false; }
    k.pr[kind] = had + add; k.p = Math.min(100, k.p + add); if (S.gacc) gnote(S, id, kind); if (kind !== 'airsoft') achKind(S, kind);
    ev(S, { k: 'prank', id, kind, add, x: S.x, y: S.y, label });
    if (k.p >= 100 && k.done < 0) { k.done = S.t; k.revengeAt = S.gt + (id === 'elf' ? 180 : 60); ev(S, { k: 'housedone', id, x: h.door[0], y: h.door[1] });
      if (MODIDS.every((m) => M(S, m).done >= 0)) achieve(S, 'apocalypse');
      toast(S, `Дом ${md.gen} закидан на 100 %!`, 'big'); if (S.gq) { delete S.gacc[id]; gthread(S, id, { kirill: 'Всё. Мой дом закидан полностью. Коля, готовься к аукциону ( ˘ ▽˘)', raiva: 'Мой дом закидан на 100 %. Коля, проверь телефон. Скоро (=^･ω･^=)', elf: 'Мой дом. Полностью. Коля, тебе пиздец, зайка. Я уже звоню (´ ε ` )♡🚓' }[id]); } }
    return true;
  }
  function spotted(S, id) {            // Kirill at his window / Raiva's recording porch camera sees a prank in the yard
    if (!watchOn(S, id) || S.hidden || !inYard(S.x, S.y, MODH[id])) return false;
    const k = M(S, id); k.p = Math.max(0, k.p - 5); ev(S, { k: 'spotted', id, x: S.x, y: S.y });
    if (id === 'raiva') { say(S, 'raiva', 'Есть! Коля в кадре, пишу в лог 📹', 2.6); toast(S, 'Камера Райвы засняла тебя: −5 %'); }
    else if (id === 'elf') { say(S, 'elf', 'Прожектор всё видит, Коля 💡', 2.6); toast(S, 'Эльф заметила тебя в свете прожектора: −5 %'); }
    else { say(S, 'kirill', 'Я ТЕБЯ ВИЖУ, КОЛЯ!', 2.6); toast(S, 'Кирилл заметил тебя в окно: −5 %'); }
    return true;
  }
  const hurt = (S, n, why) => { if (S.hp <= 0) return; S.hp = Math.max(0, S.hp - n); ev(S, { k: 'hurt', n, x: S.x, y: S.y }); toast(S, `${why}: −${n} HP`); if (S.hp <= 0) { S.koT = S.t; toast(S, 'Коля без сил…', 'big'); } };

  // dialog helpers ------------------------------------------------------------------
  const DLG = {
    kirill: { sweet: 'Конфеты я тебе уже дал. Иди уже.', done: 'Ты. Мне. Весь. Дом. Испортил. Жди.', first: '«Сладость или гадость?» Конфеты только для подписчиков с бустом. Ты не подписчик.',
      again: 'Опять ты? Я же сказал — нет.', prank: 'Гадость? Ха. Попробуй. Я всё вижу из окна.', warn: 'Даже не думай. У меня камера на крыльце (нет).',
      empty: 'Подарок? У тебя ничего нет. Магазин в телефоне, гений.', ask: 'Ну и что ты принёс?',
      gift: { energy: 'О-о-о, «Бан-хаммер»! Ладно, ты не безнадёжен. Держи конфеты 🍬', candle: 'Свеча. «Запах бана». Очень смешно. Уходи.', hoodie: 'Худи? Серьёзно? Я такое не ношу. Уходи.',
        solder: 'Паяльник? Я модерирую, а не паяю. Уходи.', latte: 'Латте? С пенкой? Я пью только «Бан-хаммер». Уходи.' } },
    raiva: { sweet: 'Конфеты у тебя. Не мешай, у меня деплой.', done: 'Ты закидал мне дом. Я знаю твой IP и пароль от вайфая. Жди подарочек (=^‥^=)',
      first: '«Сладость или гадость?» Нет. У меня сервер упал, а ты мне пинг поднимаешь. И вообще уже поздно.',
      again: 'Опять ты? Закрыл тикет «Коля у двери» как «не баг, а фича».', prank: 'Гадость? Давай. Камера на крыльце пишет всё в лог, а логи я храню вечно 📹',
      warn: 'Камера на крыльце пишет, когда горит красный. Логи храню вечно. Бэкапы — тоже.',
      empty: 'Подарок? У тебя пусто. Магазин в телефоне, кстати. Без регистрации и SMS.', ask: 'Ну, показывай. Только без вирусов.',
      gift: { solder: 'Паяльник «Огонёк»?! Это лучший патч за сегодня. Держи конфеты 🍬', energy: 'Энергетик? Я не Кирилл. Я на чистом кофеине из сервера.', candle: '«Запах бана»… Смешно. Добавил в чёрный список.',
        hoodie: 'Худи «Я ♥ модерацию»? Это даже не повод для коммита.', latte: 'Латте? Это Эльфу. Я пью то, что капает из кофемашины в серверной.' } },
    elf: { sweet: 'Конфеты у тебя. Латте остывает, иди уже.', done: 'Мой дом. Весь. В яйцах. Ну всё, Коля, ты даже не представляешь…', first: '«Сладость или гадость?» Нет. Конфеты для тех, кто не спамит в чате. Иди домой.',
      again: 'Опять ты. Прожектор с датчиком, если что, работает.', prank: 'Гадость? Попробуй. У меня датчик движения и очень хорошая память.', warn: 'Двинешься у меня во дворе — включится прожектор. И я всё увижу. Каждую твою мышцу ( ˘ ▽˘)',
      empty: 'Подарок? У тебя пусто. Даже фантазии нет.', ask: 'Ну? Что принёс?',
      gift: { latte: 'Латте «Карамельный эльф»?! …Ладно. Ты прощён. Держи конфеты 🍬', energy: 'Энергетик? Это Кириллу. Мимо.', candle: '«Запах бана»? Я сама баню, мне не нужно напоминание.',
        hoodie: 'Худи «Я ♥ модерацию»? Я лучше в своём.', solder: 'Паяльник — это к Райве. Я таким не пользуюсь.' } },
  };
  function openMod(S, id) {
    const k = M(S, id), D = DLG[id];
    if (k.sweet) { S.dlg = { who: id, text: D.sweet, cg: 'cg_gift_' + id, choices: [['Пока!', 'close']] }; return; }
    if (k.done >= 0) { S.dlg = { who: id, text: D.done, choices: [['Хе-хе', 'close']] }; return; }
    k.st = 'door'; k.t0 = S.t;
    if (!k.refused) { S.dlg = { who: id, text: D.first, choices: [['Подарить подарок', 'gift'], ['Тогда гадость! (¬‿¬)ψ', 'prank'], ['Уйти', 'close']] }; return; }
    S.dlg = { who: id, text: D.again, choices: [['Подарить подарок', 'gift'], ['Уйти', 'close']] };
  }
  function choose(S, c) {
    const id = S.dlg && MODS[S.dlg.who] ? S.dlg.who : null, k = id ? M(S, id) : null, D = id ? DLG[id] : null;
    if (c === 'close') { S.dlg = null; if (k && k.st === 'door') { k.st = 'inside'; k.t0 = S.t; } return; }
    if (festChoose(S, c)) return;
    if (c === 'prank' && k) { k.refused = true; S.target = id; S.dlg = { who: id, text: D.prank, choices: [['Ну держись', 'close']] }; msg(S, MODS[id].name, D.warn); return; }
    if (c === 'gift' && k) { const g = Object.keys(GIFTS).filter((n) => S.inv[n] > 0);
      if (!g.length) { S.dlg = { who: id, text: D.empty, choices: [['Ладно…', 'close']] }; k.refused = true; S.target = S.target || id; return; }
      S.dlg = { who: id, text: D.ask, choices: g.map((n) => [GIFTS[n], 'give_' + n]) }; return; }
    if (c.startsWith('give_') && k) { const n = c.slice(5); S.inv[n]--; const h = MODH[id];
      if (n === MODS[id].fav) { k.sweet = true; S.dlg = { who: id, text: D.gift[n], cg: 'cg_gift_' + id, cgT: S.t, choices: [['Спасибо!', 'close']] };
        if (S.gq) gthread(S, id, { kirill: 'Коля принёс мне «Бан-хаммер». Ладно. Прощаю. Почти (˘ω˘)', raiva: 'Коля подарил паяльник «Огонёк». Я растроган. Он прощён 🔥', elf: 'Коля принёс карамельный латте. …Я его простила. И, кажется, немного влюбилась. Не смейтесь (˘ ³˘)♡' }[id]);
        if (S.target === id) S.target = MODIDS.find((m) => m !== id && M(S, m).refused && M(S, m).done < 0 && !M(S, m).sweet) || null;
        ev(S, { k: 'candy', x: h.door[0], y: h.door[1] }); toast(S, `Сладость! ${MODS[id].name} — конфеты 🍬`, 'big'); achieve(S, 'sweet'); return; }
      k.refused = true; S.target = S.target || id; S.dlg = { who: id, text: D.gift[n], choices: [['Ну всё…', 'close']] }; return; }
    if (c === 'vera_take') { S.q.vera = 1; S.dlg = { who: 'vera', text: 'Спасибо! Одна укатилась в переулок, одна у лавки, а одну утащили к Эльфу во двор.', choices: [['Найду!', 'close']] }; return; }
    if (c === 'vera_give') { S.q.vera = 2; S.money += 150; S.hasGun = true; S.inv.bb += 300;
      S.dlg = { who: 'vera', text: 'Все три! Держи 150 ₽ и… вот, внук оставил: страйкбольный автомат и 300 шариков. В окна не стреляй. Ну… разве что модерам. (F — достать) А ещё заходи переодеться: у меня сундук его костюмов.', choices: [['Ура!', 'close']] };
      ev(S, { k: 'coin', amt: 150, x: S.x, y: S.y }); ev(S, { k: 'gunon', x: S.x, y: S.y }); toast(S, 'Получен страйкбольный автомат! F — достать, ПКМ — стрелять', 'big'); achieve(S, 'grandson'); return; }
    if (c === 'vera_wardrobe') { S.dlg = { who: 'vera', text: 'Выбирай! Только не порви — внук расстроится.', choices: allCostumes(S).map(([id, name]) => [name, 'cos_' + id]).concat(S.costume ? [['Свой худи', 'cos_none']] : []) }; return; }
    if (c.startsWith('cos_') && S.q.vera === 2) { const id = c.slice(4), cs = allCostumes(S).find((q) => q[0] === id); S.costume = cs ? id : '';
      S.dlg = { who: 'vera', text: cs ? cs[2] : 'И правильно. Худи — это классика.', choices: [['Спасибо!', 'close']] }; ev(S, { k: 'costume', id: S.costume, x: S.x, y: S.y });
      toast(S, cs ? `Костюм: ${cs[1].replace(/^\S+ /, '')}. Патруль узнаёт тебя медленнее` : 'Снова в худи'); return; }
    if (c === 'vera_take' || c === 'vera_give') return;
  }
  function talkNpc(S, n) {
    const def = NPCS[n.i];
    if (def.id === 'vera') {
      if (S.q.vera === 0) S.dlg = { who: 'vera', text: 'Коля! Кто-то утащил три мои тыквы. Найдёшь — отблагодарю.', choices: [['Конечно', 'vera_take'], ['Потом', 'close']] };
      else if (S.q.vera === 1) { const n3 = S.vp.filter((v) => v >= 0).length; S.dlg = n3 >= 3 ? { who: 'vera', text: 'Ты нашёл все три?!', choices: [['Держи!', 'vera_give']] } : { who: 'vera', text: `Нашёл ${n3} из 3. Ищи ещё!`, choices: [['Ищу', 'close']] }; }
      else S.dlg = { who: 'vera', text: 'Тыквы на месте, спасибо тебе! Хочешь переодеться? У внука целый сундук костюмов.', choices: [['Сменить костюм', 'vera_wardrobe'], ['Пока', 'close']] };
      if (!S.talked.vera) { S.talked.vera = 1; S.q.talk++; }
      return;
    }
    const k = (S.talked[def.id] || 0); const line = def.lines[k % def.lines.length];
    n.talkT = S.t; n.line = line; n.pause = 3.4; S.talked[def.id] = k + 1;
    if (!def.silent && k === 0) { S.q.talk++; if (S.q.talk === 5) { S.money += 50; toast(S, 'Квест: поговорил с 5 жителями (+50 ₽)', 'big'); } }
    if (S.q.talk >= 5) achieve(S, 'social');
    ev(S, { k: 'talk', id: def.id, x: n.x, y: n.y });
  }


  // ---------------- HUD layout (shared by the sim's hit tests and the scene's drawing) ----------------
  const HUD = (() => { const W = VIEW.W, H = VIEW.H, n = 10, sw = 78, gap = 8, x0 = W / 2 - (n * sw + (n - 1) * gap) / 2;
    return { slots: Array.from({ length: n }, (_, i) => ({ x: x0 + i * (sw + gap), y: H - 104, w: sw, h: sw })),
      phoneBtn: { x: W - 150, y: H - 150, w: 116, h: 116 }, phone: { x: W - 600, y: 120, w: 440, h: 840 } }; })();
  function dlgLayout(S) { const W = VIEW.W, H = VIEW.H, n = S.dlg ? S.dlg.choices.length : 0, gap = 20, bw = n > 3 ? Math.floor((1100 - (n - 1) * gap) / n) : 360;
    const x0 = W / 2 - (n * bw + (n - 1) * gap) / 2;
    return { panel: { x: W / 2 - 560, y: H - 330, w: 1120, h: 250 }, choices: Array.from({ length: n }, (_, i) => ({ x: x0 + i * (bw + gap), y: H - 160, w: bw, h: 58 })) }; }
  // v12: «Чаты» is a list of conversations (the moderators' group chat and every contact apart), newest first
  const chatList = (S) => { const dm = S.dm || {}, last = (n) => { const l = dm[n] || []; return l.length ? (l[l.length - 1].gt || 0) : -1; }; return [GROUP].concat(Object.keys(dm).filter((n) => n !== GROUP && dm[n] && dm[n].length)).sort((a, b) => { const la = last(a), lb = last(b); return lb - la || CONTACTS.indexOf(a) - CONTACTS.indexOf(b); }); };
  function dmMigrate(S) { if (S.dmv2) return; S.dmv2 = 1; S.dm = S.dm || {};          // saves before v12: contacts' messages lived only in the shared feed
    for (const m of S.msgs) { if (m.group) continue; const th = S.dm[m.from] = S.dm[m.from] || []; if (!th.some((q) => !q.me && q.text === m.text)) th.push({ me: false, text: m.text, gt: m.gt || 0 }); }
    for (const k of Object.keys(S.dm)) S.dm[k].sort((a, b) => (a.gt || 0) - (b.gt || 0)); }
  function phoneLayout(S) { const p = HUD.phone, out = [{ id: 'close', x: p.x + p.w - 84, y: p.y + 64, w: 52, h: 46 }];
    if (!S.phone) return [];
    if (S.phone.app !== 'home') out.push({ id: 'home', x: p.x + 32, y: p.y + 64, w: 120, h: 46 });
    if (S.phone.app === 'home') { const apps = ['map', 'chats', 'light', 'shop', 'pizza', 'orders', 'contacts', 'ach', 'dev'];
      apps.forEach((a, i) => out.push({ id: a, x: p.x + 40 + (i % 3) * 126, y: p.y + 230 + Math.floor(i / 3) * 170, w: 110, h: 150 })); }
    if (S.phone.app === 'shop') SHOP.forEach((it, i) => out.push({ id: 'buy_' + it.id, x: p.x + p.w - 152, y: p.y + 182 + i * 47, w: 112, h: 38 }));
    if (S.phone.app === 'contacts') CONTACTS.forEach((n, i) => out.push({ id: 'dm_' + n, x: p.x + 30, y: p.y + 166 + i * 92, w: p.w - 60, h: 82 }));
    if (S.phone.app === 'chats') chatList(S).slice(S.phone.scroll || 0, (S.phone.scroll || 0) + 7).forEach((n, i) => out.push({ id: 'dm_' + n, x: p.x + 30, y: p.y + 172 + i * 86, w: p.w - 60, h: 78 }));
    if (S.phone.app === 'dm' && LOANS[S.phone.who]) { const L = S.loans[S.phone.who]; if (!L) out.push({ id: 'loan', x: p.x + 40, y: p.y + p.h - 190, w: p.w - 80, h: 48 });
      else if (!L.paid) out.push({ id: 'repay', x: p.x + 40, y: p.y + p.h - 190, w: p.w - 80, h: 48 }); }
    if (S.phone.app === 'dm' && S.phone.who === GROUP && (S.dm[GROUP] || []).some((m) => m.voice)) out.push({ id: 'vplay', x: p.x + 40, y: p.y + p.h - 190, w: p.w - 80, h: 48 });
    if (S.phone.app === 'pizza') out.push({ id: 'order_pizza', x: p.x + 50, y: p.y + 600, w: p.w - 100, h: 80 });
    return out; }

  // ---------------- people, cars and the airsoft rifle as targets ----------------
  const OUCH = { egg: ['Эй! Моё платье!', 'Это было яйцо?!', 'Фу-у-у!', 'Я всё маме расскажу!', 'Ну ты и тыква!', 'Это мой костюм за 3000 ₽!', 'Полиция! Тут хулиган!', 'Я теперь омлет?!'],
    bb: ['Ай!', 'Ой! Это что, пулька?!', 'Эй, не в лицо!', 'Ай-ай-ай!', 'Ты в своём уме?!', 'Полиция! В меня стреляют шариками!'],
    tp: ['Я теперь мумия?!', 'Ну и зачем?..', 'Хоть бы двухслойная была…', 'Эй! Распутай меня!'],
    vera: ['Коля! Я же тебе тыквы доверила!', 'Ах ты ж… Ну, Коля!', 'Я всё бабушкам у подъезда расскажу!'] };
  function personHit(S, n, kind) {
    const key = kind === 'bb' ? 'bb' : kind === 'tp' ? 'tp' : 'egg', pool = n.id === 'vera' ? OUCH.vera : OUCH[key];
    n.hitT = S.t; n.hitK = kind; n.talkT = S.t; n.pause = Math.max(n.pause || 0, 2.6); n.line = pool[Math.floor(h1(S.steps * 0.13 + (n.i || 0)) * pool.length) % pool.length];
    S.stats.hits++; ev(S, { k: 'ouch', x: n.x, y: n.y });
    if (S.raid && S.raid.st === 'search' && /Полиция/.test(n.line)) raidTip(S, n.x, n.y);
    if (kind === 'tp') { S.achv = S.achv || {}; const m = S.achv.mumIds = S.achv.mumIds || []; if (!m.includes(n.id)) { m.push(n.id); achAdd(S, 'mummy'); } }
    anger(S, n, kind === 'bb' ? 0.6 : 1);
  }
  // ---- passers-by remember: hit one three times and he takes revenge (chases you, throws eggs back, grabs money or wraps you in TP) ----
  const REV = { start: ['Ну всё, Коля! Сейчас получишь!', 'Ах так?! Держись!', 'Сам напросился!', 'Я тебе сейчас устрою гадость!', 'Стой! Моя очередь!'],
    throw: ['Лови!', 'Получай!', 'Это тебе за костюм!', 'Сладость или гадость? ГАДОСТЬ!'], hit: ['Попал! Ха!', 'Вкусно, да?', 'Теперь мы квиты… почти.'],
    miss: ['Мимо…', 'Вёрткий!', 'Стой ровно!'], quit: ['Ладно… В следующий раз!', 'Убежал… Ну и ладно.', 'Я тебя запомнил!'],
    grab: ['Это за моральный ущерб!', 'Деньги на химчистку!', 'Компенсация!'], wrap: ['Теперь ты мумия!', 'Посмотрим, как тебе!', 'Бумага у меня тоже есть!'],
    vera: ['Ну, Коля, держи тапок!', 'Я тебе покажу, как старших обижать!'] };
  function anger(S, n, amt) { const def = NPCS[n.i]; if (!def || n.rev || (n.calmT || 0) > S.t) return;
    n.anger = Math.max(0, (n.anger || 0) - 0.06 * (S.t - (n.angerT || S.t))) + amt; n.angerT = S.t;
    if (n.anger < 2.8 || S.hp <= 0) return;
    n.rev = { st: def.stat ? 'vera' : 'chase', t0: S.t, n: 0, next: S.t + 0.6, path: [], replan: 0, hit: 0 }; n.pause = 0; n.anger = 0;
    npcSay(S, n, def.id === 'vera' ? pickL(REV.vera, S.steps * 0.31) : pickL(REV.start, S.steps * 0.31 + n.i)); ev(S, { k: 'angry', id: n.id, x: n.x, y: n.y });
    toast(S, `${def.name} в ярости и идёт мстить!`); }
  const npcSay = (S, n, text) => { n.talkT = S.t; n.line = text; };
  // walk a passer-by toward g around walls (A* when no straight line), true on arrival
  function npcMove(S, n, g, v) { const t = S.t;
    if (!n.mpath || !n.mpath.length || t > (n.mrep || 0) || !n.mgoal || Math.hypot(n.mgoal[0] - g[0], n.mgoal[1] - g[1]) > 120) { n.mgoal = g.slice(); n.mpath = los([n.x, n.y], g) ? [g] : findPath([n.x, n.y], g); if (!n.mpath.length) n.mpath = [g]; n.mrep = t + 0.8; }
    if (n.mpath.length === 1) n.mpath[0] = g;
    let tg = n.mpath[0], dx = tg[0] - n.x, dy = tg[1] - n.y, d = Math.hypot(dx, dy);
    if (d < 12 && n.mpath.length > 1) { n.mpath.shift(); tg = n.mpath[0]; dx = tg[0] - n.x; dy = tg[1] - n.y; d = Math.hypot(dx, dy); }
    if (d < 6) return n.mpath.length <= 1;
    const st = Math.min(d, v * DT), nx = n.x + dx / d * st, ny = n.y + dy / d * st;
    if (!blocked(nx, ny, 8)) { n.x = nx; n.y = ny; } else n.mrep = 0;
    n.ang = turnTo(n.ang, scrAng(dx, dy), 9 * DT); n.face = [Math.cos(n.ang) >= 0 ? 1 : -1, Math.sin(n.ang) >= 0 ? 1 : -1]; n.gph = (n.gph || 0) + st / K.NSTRIDE; n.walk = (n.walk || 0) + st; n.mv = 1;
    return false; }
  function npcRevenge(S, n, def) {
    const R = n.rev, t = S.t, dK = Math.hypot(S.x - n.x, S.y - n.y), nm = def.name;
    const faceK = () => { const hp = proj(n.x, n.y), kp = proj(S.x, S.y); n.ang = turnTo(n.ang, Math.atan2(kp[1] - hp[1], kp[0] - hp[0]), 8 * DT); n.face = [Math.cos(n.ang) >= 0 ? 1 : -1, Math.sin(n.ang) >= 0 ? 1 : -1]; };
    const calm = (line) => { if (line) npcSay(S, n, line); n.rev = null; n.calmT = t + 30; n.pause = 1.4; n.anger = 0; if (!def.stat) n.back = 1; };
    if (S.finale || S.hp <= 0) { calm(); return; }
    if (R.st === 'vera') { faceK(); if (dK > 700) { if (t - R.t0 > 6) calm(pickL(REV.quit, t)); return; }
      if (t >= R.next && R.n < 2) { R.n++; R.next = t + 1.3; S.proj.push({ kind: 'slipper', x0: n.x, y0: n.y, z0: 80, x1: S.x + S.vx * 0.45, y1: S.y + S.vy * 0.45, z1: 20, t0: t, dur: 0.6, arc: 80, seed: S.steps, from: n.id }); }
      if (R.n >= 2 && t > R.next) calm(); return; }
    if (S.hidden) { R.lostT = R.lostT || t; if (t - R.lostT > 3) { calm(pickL(REV.quit, t * 1.3)); return; } } else R.lostT = 0;
    if (t - R.t0 > 18 || dK > 1700) { calm(pickL(REV.quit, t * 1.7)); return; }
    if (R.st === 'chase') {
      if (dK < 52 && !S.hidden) {                                                             // caught him: money or a TP mummy
        if (S.money > 0 && h1(S.steps * 0.61 + n.i) < 0.5) { const amt = Math.min(S.money, 40 + Math.floor(h1(S.steps * 0.37) * 9) * 10); S.money -= amt; npcSay(S, n, pickL(REV.grab, t)); toast(S, `${nm} отжал${def.id === 'ghost' || def.id === 'devil' || def.id === 'pumpkinhood' || def.id === 'shy' ? 'а' : ''} ${amt} ₽ «за моральный ущерб»`); ev(S, { k: 'buy', x: S.x, y: S.y }); }
        else { S.wrapT = t + 1.6; npcSay(S, n, pickL(REV.wrap, t)); toast(S, `${nm}: «Теперь ты мумия!» — Коля обмотан бумагой`); ev(S, { k: 'tpland', x: S.x, y: S.y, sx: proj(S.x, S.y, 60)[0], sy: proj(S.x, S.y, 60)[1] }); }
        achieve(S, 'payback'); calm(); return; }
      if (dK < 380 && R.n < 3 && !S.hidden && seeLine([n.x, n.y], [S.x, S.y])) { R.st = 'throw'; R.next = Math.max(R.next, t + 0.35); }
      else npcMove(S, n, [S.x, S.y], 205); return; }
    if (R.st === 'throw') { faceK();
      if (dK > 520 || !seeLine([n.x, n.y], [S.x, S.y])) { R.st = 'chase'; return; }
      if (t >= R.next && R.n < 3) { R.n++; R.next = t + 1.15; const x1 = S.x + S.vx * 0.5, y1 = S.y + S.vy * 0.5, d = Math.hypot(x1 - n.x, y1 - n.y);
        S.proj.push({ kind: 'negg', x0: n.x, y0: n.y, z0: 95, x1, y1, z1: 40, t0: t, dur: 0.45 + d / 1400, arc: 50 + d * 0.12, seed: S.steps, from: n.id }); npcSay(S, n, pickL(REV.throw, t + n.i)); ev(S, { k: 'nthrow', x: n.x, y: n.y }); }
      if (R.n >= 3 && t > R.next) { if (dK < 220) { R.st = 'chase'; R.n = 99; } else calm(R.hit ? pickL(REV.hit, t) : pickL(REV.miss, t)); } } }
  // what a thrown egg / TP roll / BB does to whatever it hit (houses are handled by the caller)
  function hitTarget(S, tg, kind) {
    if (tg.kind === 'npc') { const n = S.npc.find((q) => q.id === tg.id); if (n) personHit(S, n, kind); }
    else if (tg.kind === 'courier' && S.courier) { S.courier.hitT = S.t; say(S, 'courier', kind === 'bb' ? 'Ай! Я на работе вообще-то!' : 'Эй! Пицца не пострадала, а я — да!', 2.2); S.stats.hits++; }
    else if (tg.kind === 'crowd' && S.raid) { const q = S.raid.crowd[tg.id]; if (q) { q.hitT = S.t; q.hitK = kind; S.stats.hits++;
      say(S, 'crowd:' + tg.id, (kind === 'bb' ? OUCH.bb : kind === 'tp' ? OUCH.tp : OUCH.egg)[Math.floor(h1(S.steps * 0.17 + tg.id) * 4)], 2.2);
      if (h1(S.steps * 0.9) < 0.4) raidTip(S, q.x, q.y); } }
    else if (tg.kind === 'unit' && S.raid) { const u = S.raid.units[tg.id]; if (u) { S.stats.hits++; raidHit(S, u, kind); } }
    else if (tg.kind === 'rcar' && S.raid) { const c = S.raid.cars[tg.id]; if (c) carHit(S, c); }
    else if (tg.kind === 'scar') ev(S, { k: 'caralarm', i: tg.id, x: CARS[tg.id][0], y: CARS[tg.id][1] });
  }
  // the airsoft rifle: a BB flies straight to the cursor (a little spread), 6–7 shots per second while RMB is held
  function fireBB(S, c) {
    if (S.inv.bb <= 0) { if (!(S.t - (S.bbWarn || -9) < 2)) { S.bbWarn = S.t; toast(S, 'Шарики кончились. Магазин в телефоне (Tab)'); } return; }
    const cc = [c[0] + (h1(S.steps * 0.77) - 0.5) * 16, c[1] + (h1(S.steps * 1.31) - 0.5) * 16];
    let tg = aimTarget(S, cc); if (tg.dist > 1100) tg = { kind: 'ground', ground: unproj(cc[0], cc[1]), dist: tg.dist, far: 1 };
    const h0 = proj(S.x, S.y, 80); S.inv.bb--; S.stats.bb++; S.lockAng = Math.atan2(c[1] - h0[1], c[0] - h0[0]); S.faceLock = S.t + 0.45; S.shotT = S.t;
    S.proj.push({ kind: 'bb', sx0: h0[0], sy0: h0[1], sx1: cc[0], sy1: cc[1], gx0: S.x, gy0: S.y, gx1: tg.ground[0], gy1: tg.ground[1], t0: S.t, dur: 0.04 + Math.min(1100, tg.dist) / 4500,
      arc: 4, tg: { kind: tg.kind, id: tg.id, i: tg.i, u: tg.u, v: tg.v, far: tg.far }, seed: S.steps });
    ev(S, { k: 'pew', x: S.x, y: S.y });
    if (tg.kind === 'house' && MODS[tg.id] && !(S.t - (S.gunSpot || -9) < 2.5)) { if (spotted(S, tg.id)) S.gunSpot = S.t; }
  }
  function landBB(S, p) {
    const tg = p.tg; ev(S, { k: 'bbhit', x: p.gx1, y: p.gy1, sx: p.sx1, sy: p.sy1, on: tg.kind });
    if (tg.far) return;
    if (tg.kind === 'lamp') { if (lampLit(S, tg.i)) { S.lampOff = S.lampOff || {}; S.lampOff[tg.i] = S.t; ev(S, { k: 'lampbreak', i: tg.i, x: LAMPS[tg.i][0], y: LAMPS[tg.i][1] });
        toast(S, 'Дзынь! Фонарь погас — здесь теперь темно (патруль видит хуже)'); } return; }
    if (tg.kind === 'house') { if (MODS[tg.id]) addPrank(S, tg.id, 'airsoft');
      else { S.yell = S.yell || {}; if (!(S.t - (S.yell[tg.id] || -99) < 12) && tg.id !== 'kolya') { S.yell[tg.id] = S.t; say(S, 'house:' + tg.id, ['Кто стреляет по окнам?!', 'Ай! Стекло!', 'Я вызываю полицию!'][Math.floor(h1(S.steps) * 3)], 2.4); } } }
    else hitTarget(S, tg, 'bb');
  }

  // ---------------- phone: contacts (three moderators + Скелет and Тимофей), loans ----------------
  const GROUP = 'Модеры 🎃', CONTACTS = [GROUP, 'Кирилл', 'Райва', 'Эльф', 'Скелет', 'Тимофей'];
  const LOANS = { 'Скелет': 1500, 'Тимофей': 2500 }, LOAN_DUE = 3 * 3600;          // due at 01:00 on the game clock
  const PLACE = { kolya: 'у своего дома', vera: 'у дома Веры', a: 'у дома Петровых', kirill: 'у дома Кирилла', b: 'у дома Смирновых', raiva: 'у дома Райвы', elf: 'у дома Эльфа' };
  function whereIs(S) { if (S.hidden) return 'в кустах. Да, я вижу'; if (S.x > ALLEY[0] && S.x < ALLEY[2] && S.y < FACADE) return 'в тёмном переулке';
    if (S.x > ENDLOT[0] && S.y < FACADE) return 'у гаража в конце улицы'; if (S.y < FACADE - HD + 10) return 'на задних дворах'; let best = HOUSES[0], bd = 1e9; HOUSES.forEach((h) => { const d = Math.abs(h.door[0] - S.x); if (d < bd) { bd = d; best = h; } }); return PLACE[best.id]; }
  // v11: the contacts answer what you wrote: the intent from keywords (Russian and English), the line by the contact's mood toward Kolya
  // DMT-BEGIN
  const DMT = {"Кирилл":{"greet":{"def":["Ну привет. Чего надо?","О, Коля. Я тебя в окно уже видел.","Чё надо, Коля? Я на посту.","Привет. У тебя три секунды, потом бан."],"war":["Привет?! Ты мне дом засрал, а теперь «привет»?","Иди нахуй со своим «привет» (╬ Ò﹏Ó)","Ещё раз «привет» — и я выложу твои трусы на аукцион дважды.","Привет, преступник. Отмывать будешь сам?"],"done":["Привет, вандал. Аукцион уже открыт ( ˘ ▽˘)"],"sweet":["Здарова, бро (^_^)/","О, мой любимый даритель бан-хаммеров!","О, Коля! Заходи на энергетик (b ᵔ▽ᵔ)b"]},"how":{"def":["Нормально. Модерирую улицу через окно.","Сижу, баню голубей на подоконнике.","Сижу у окна, считаю детей в костюмах. 14 ведьм, 3 тыквы, 1 ты.","Дела? Модерация. Без выходных, без зарплаты."],"war":["Как дела? Отмываю дом от твоих яиц, спасибо.","Хуёво. Угадай почему.","Отлично! Мою крыльцо. Обожаю мыть крыльцо в 23:00 (╬ Ò﹏Ó)"],"done":["Отлично. Считаю ставки на твои трусы (￢ω￢)","Дела отлично. Ставки на твои трусы растут (￢ω￢)"],"sweet":["Отлично! «Бан-хаммер» ещё действует ⚡"]},"candy":{"def":["Конфеты только для подписчиков с бустом.","Нет конфет. Есть бан. Хочешь?"],"sweet":["Держи виртуальную конфету 🍬 Настоящие кончились."]},"sorry":{"def":["Извинения принимаются в виде энергетика.","«Сорян» в чат не считается. Неси «Бан-хаммер».","Извинения приняты. Бан — нет."],"war":["Поздно, бро. Аукцион уже готовлю.","Прощу, если принесёшь «Бан-хаммер». Может быть.","Извинения в чате не принимаются. Принимаются энергетиком.","Сорри не отмоет мне окна, Коля."],"sweet":["Да ладно, проехали (＾▽＾)b"]},"prank":{"def":["Только попробуй. Я у окна. Всегда.","Гадость? Ха. Камеры у меня нет, но память хорошая."],"war":["Ещё одно яйцо — и твои трусы уйдут с молотка (¬‿¬ )","Блять, Коля, хватит уже!"],"done":["Куда больше? Дом и так в яйцах на 100 %.","Всё, ты победил. Теперь моя очередь ψ(｀∇´)ψ"]},"insult":{"def":["Сам такой. Бан на 24 часа.","Пиши в тикет, хамло.","Ты чё, охуел? Мут на сутки.","Мут на 10 минут. Остынь.","Записал в лог нарушений. У тебя там уже роман."],"war":["Сам такой. Бан на 24 часа.","Пиши в тикет, хамло.","Ты чё, охуел? Мут на сутки.","Сам такой. И дом мой ты засрал, а не я твой.","Пиздец ты смелый в переписке. Подойди к окну, скажи в лицо."]},"love":["Эм. Бро. Я модер, а не свидание.","Это что, подкат? Спасибо, но нет (・_・)","Коля, я модератор, а не твоя вайфу.","Мне тоже ты нравишься. Как источник контента для бана."],"gift":{"def":["Я принимаю только «Бан-хаммер». Энергетик такой, знаешь.","Подарок? Ну неси. Посмотрим."],"sweet":["Ты уже подарил. Я до сих пор под впечатлением ⚡"]},"police":["Полицию у нас Эльф вызывает. Не я.","Ментов не люблю. Но тебя меньше."],"money":["Денег нет. Есть трусы на аукционе. Твои.","Займи у Скелета, он богатый."],"where":["Я у окна. Как всегда.","Дома я. Где же ещё в Хэллоуин."],"costume":{"ghost":["Простыня? Серьёзно? Я тебя по кроссовкам узнал."],"pumpkin":["Тыква на голове тебе идёт больше, чем лицо."],"hat":["Колдун хренов. Шляпу сними, тут модерация."],"horns":["Рожки?! Ну хоть честно."],"none":["Опять это чёрное худи. Тебя за километр видно."]},"thanks":["Не за что. Хотя за что?","Обращайся. Но не часто."],"bye":["Давай. И мимо моего дома — быстро.","Пока. Не стучи."],"halloween":["Хэллоуин — праздник банов. Мой любимый.","С Хэллоуином. Только без гадостей, ок?"],"question":["Хороший вопрос. Ответ — нет.","Не знаю. Спроси Райву, он всё гуглит.","«{0}»? Не знаю. Спроси у Райвы, она всё гуглит.","Вопрос «{0}» отклонён модерацией."],"maid":["Костюм горничной? Эльф до сих пор этим голосовым всех мучает (≧▽≦)","Если придёшь в костюме горничной — пущу без бана. Один раз.","Горничная… Коля, это ты должен был ей костюм. Не я."],"ppl":{"Райва":["Райва опять в серверной. По-моему, она там живёт.","Не трогай Райву, она тебе телефон взломает."],"Эльф":["Эльф? Не ведись. Она со всеми так флиртует. Почти со всеми.","Эльф с этим своим латте… Лучше не стой у неё во дворе, там прожектор."],"Скелет":["Скелет? Он с 2021 года в катке. Не жди."],"Тимофей":["Тимофей меня пугает. Он знает, сколько у меня энергетиков в холодильнике."],"Вера":["Вера нормальная. Конфеты у неё, кстати, лучше моих."],"Кирилл":["Да, это я. Чего?"]},"gacha":["Я вчера 90 круток слил. Выпала тряпка. Не говори со мной о гаче.","На площади гача-автомат поставили. Гарант на 20-й крутке. Я проверял (￢_￢;)","Пятизвёздочный скин? Покажешь — может, разбаню."],"anime":["Что смотришь? Только не говори, что опять «Магическую Тыковку» на 1.5x.","Аниме после 23:00 — бан. Шучу. Кидай ссылку."],"stream":["Твой стрим сегодня? Я модерить не буду, у меня выходной (вру).","Твой чат опять спамит «КОЛЯ ГДЕ РЕАКЦИЯ». Я всех замутил."],"fest":["На площади конкурс тыкв. Я вырезал бан-хаммер. Судьи не поняли.","Яблоки из бочки? Я пас, у меня очки."],"weather":["Дождь. Хоть яйца с окон смоет.","Гроза. Если свет вырубит — я не виноват. Это Райва."],"food":["Пиццу заказывал не ты? Мне привезли десять. Подозрительно.","Есть энергетик и печенье. Это ужин модератора."],"help":["Ладно, подскажу. Только никому.","Модератор не обязан помогать. Но держи."],"time":["Сейчас {n}. Тебе пора домой, а мне — банить.","{n}. Почему ты спрашиваешь у меня, у тебя телефон в руках."],"yes":["«Да» — это не ответ. Пиши развёрнуто, по правилам чата.","Ок. Записал."],"no":["«Нет» засчитано. Бан не отменяется.","Ну и не надо."],"laugh":["Чего ржёшь? Я серьёзно.","Смешно ему. Мне вот не смешно (￣_￣)"],"bored":["Скучно? Иди с Верой поговори. Или со мной не говори.","Скука — лучшее время для модерации."],"sleep":["Спать в Хэллоуин? Ты точно Коля?","Я не сплю. Модераторы не спят. Мы бдим."],"who":["Я Кирилл. Модератор. Твой ночной кошмар с бан-хаммером."],"kao":["Опять смайлики… (￣_￣) Вот тебе в ответ.","(￢_￢) — это я сейчас."],"repeat":["Ты это уже писал. Мут за флуд.","Копипаста? Серьёзно? (￢_￢;)"],"other":["«{0}»… Я не понял, но звучит как спам.","«{0}» — это ты мне? Я занят, у меня окно.","Перевожу с колиного: «{0}» = «дай конфет». Нет.","Окей, «{0}». Записал. Ответ — нет."]},"Райва":{"greet":{"def":["ping → pong. Привет.","Привет. Пишу код, говори быстро.","Ping получен. Pong.","Привет. Тикет №666 открыт. Тема: Коля."],"war":["Привет. Твой IP уже в чёрном списке (=^‥^=)","Ну здравствуй, вредитель. Логи всё помнят.","Привет. Твой IP уже в бане. Вообще везде."],"done":["Привет. Проверь телефон. Там сюрприз (=^‥^=)"],"sweet":["Привет, друг! Паяльник огонь 🔥","Привет, Коля! Паяльник греется, заходи (=^･ω･^=)"]},"how":{"def":["Прод не лежит — уже хорошо.","Нормально. Кот спит на сервере, я тоже скоро.","Сервер пингуется, кофе варится. Жить можно.","Пишу скрипт, который сам отвечает тебе «нет»."],"war":["Как дела? Пишу вирус. Для одного Коли (=^‥^=)","Хреново. Камера всё записала, сижу смотрю.","Восстанавливаю логи после твоих гадостей. Сколько можно (╬ Ò﹏Ó)"],"done":["Отлично. Логи твоих покупок восхитительны (=^‥^=)"],"sweet":["Отлично! Припаял кофеварку к серверу ☕"]},"candy":["Конфеты в доступе по подписке. Подписки нет.","sudo дай конфету → Permission denied."],"sorry":{"def":["Извинение залогировано. Рассмотрим в порядке очереди.","Баг-репорт на извинение принят. Статус: won't fix."],"war":["Извини — не патч. Патч — это паяльник «Огонёк».","«Сорян» не откатывает изменения, Коля.","Извинения приняты в очередь. Позиция: 9999.","Сорри не откатывает изменения. Нужен бэкап. Или паяльник."],"sweet":["Всё ок, merge прошёл (=^･ω･^=)"]},"prank":{"def":["У меня камера на крыльце и запись в облако 📹","Гадость — это фича? Тогда я сделаю фичу в ответ."],"war":["Ещё раз — и «КотоМем» прилетит тебе в телефон (=^･ω･^=)","Блядь, Коля, у меня прод, а ты с яйцами."],"done":["Дом закидан на 100 %. Красиво, сука. Проверь телефон (=^‥^=)"]},"insult":{"def":["Ошибка 403: хамство запрещено.","Сам ты баг. Неисправимый.","Иди нахуй, но вежливо, через прокси.","Оскорбление сохранено в /var/log/kolya. Размер: 3 ГБ.","Синтаксическая ошибка в твоём мозге. Строка 1."],"war":["Ошибка 403: хамство запрещено.","Сам ты баг. Неисправимый.","Иди нахуй, но вежливо, через прокси.","Ещё слово — и твой телефон закажет тебе 40 кг гречки.","Иди нахуй, но через прокси. Чтобы я не видела."]},"love":["Я женат на сервере, извини.","Это сообщение похоже на спам. Отправил в фильтр (￣_￣)","Ошибка 418: я чайник, а не твоя девушка.","Твоё признание помечено как спам. Сорри (=^‥^=)"],"gift":{"def":["Принимаю паяльники. Только «Огонёк».","Подарок без паяльника — это просто железо."],"sweet":["Паяльник уже в деле. Спасибо, бро 🔥"]},"police":["Полиция? Это к Эльф, у неё прямой номер.","Если что — я тебя не знаю. Логи удалю. Не все."],"money":["Деньги в крипте. Крипта упала.","Займи у Тимофея. Он всё равно всё знает."],"where":["В серверной. Тут тепло и пахнет пылью.","За тремя мониторами. Как всегда."],"costume":{"ghost":["Призрак? Хороший костюм. Камера всё равно видит кроссовки (=^･ω･^=)"],"pumpkin":["Тыквоголовый? Определил тебя по походке."],"hat":["Шляпа колдуна. Кастуешь sudo?"],"horns":["Рожки. Права root тебе всё равно не дам."],"none":["Чёрное худи — дефолтный скин. Скучно."]},"thanks":["Не за что. 200 OK."],"bye":["exit 0. Пока.","Отключаюсь. Не шали."],"halloween":["Хэллоуин — день, когда все ломают мой прод.","С праздником! Резервную копию дома уже сделал."],"question":["42.","Это зависит от конфигурации. Шучу, не знаю.","«{0}»? Гугл знает. Я — тоже, но не скажу.","Вопрос «{0}» передан в поддержку. Срок ответа — никогда."],"maid":["Голосовое Эльфа про горничную я заархивировала. С тремя бэкапами (≧▽≦)","Костюм горничной — тоже баг-репорт. На твою жизнь."],"ppl":{"Кирилл":["Кирилл опять смотрит в окно. У него там, видимо, второй монитор.","Кирилл банит голубей. Я его не останавливаю."],"Эльф":["Эльф флиртует со всем, что движется. И с датчиком движения тоже.","Эльф попросила меня взломать твой телефон. Я подумаю (=^･ω･^=)"],"Скелет":["Скелет у меня в контактах как «процесс завис»."],"Тимофей":["Тимофей подключился к моей камере. Я не давала доступ. Никто не давал."],"Вера":["Вера починила мне роутер в 2019. С тех пор я ей доверяю."],"Райва":["Да, Райва на связи. Говори быстрее, у меня билд."]},"gacha":["Я посчитала шансы. 5★ — 0,6 %. Дальше считай сам (￢_￢;)","Гача-автомат на площади работает на моём старом сервере. Не спрашивай.","Если выбьешь золотую капсулу — скинь скрин. Для статистики."],"anime":["Смотрю «Сисадмина из другого мира». 12 серий про перезагрузку. Шедевр.","Аниме — это рендер эмоций. Твои реакции — это лаги."],"stream":["Твой стрим лагает. Это не я. Скорее всего.","Донат на 100 ₽ с подписью «закидай модеров» — от кого был, а? (￢‿￢)"],"fest":["На площади конкурс тыкв. Я вырезала QR-код. Он даже работает.","Сцена на площади на моих удлинителях. Если упадёт — не моя вина."],"weather":["Гроза. Сервер на ИБП. Ты — нет.","Молния ударит в фонарь — свет вырубит. Темнота — твой друг, кстати."],"food":["Пицца? Я питаюсь кофе и логами.","Голодный? Закажи пиццу. Только не на мой адрес."],"help":["Ладно, держи подсказку. Бесплатно, как open source.","Запрос на помощь принят. Обработка…"],"time":["{n}. Синхронизировано с атомными часами. Ну, почти.","Сейчас {n}. Uptime твоей наглости — весь вечер."],"yes":["Ок. 200 OK.","Подтверждение получено."],"no":["403. Понятно.","Отказ принят. Логирую."],"laugh":["Ржёшь? Значит, вирус ещё не сработал (￢‿￢)","lol. Записала как положительный отзыв."],"bored":["Скучно? Перезагрузи себя. Мне помогает.","Иди на площадь, там гача. Скука пройдёт, деньги тоже."],"sleep":["Спать — это режим гибернации. Не советую, потом долго грузиться.","Я сплю 4 часа. Остальное — кофе."],"who":["Райва. Сисадмин улицы. Твой телефон — тоже моя зона ответственности."],"kao":["Каомодзи распознан. Ответ: (=^･ω･^=)","(・_・) ← это мой статус «занята»."],"repeat":["Дубликат сообщения. Дедуплицирую.","Ты зациклился. Ctrl+C."],"other":["Получено: «{0}». Распарсить не удалось.","«{0}» — это команда? В моей консоли такой нет.","«{0}»… Добавлю в датасет «странное от Коли».","Сообщение «{0}» доставлено. Прочитано. Проигнорировано (=^‥^=)"]},"Эльф":{"greet":{"def":["Приветик, Коля (˘ ³˘)♡","О, кто это мне пишет? Сам Коля… (￣ー￣)","Приветик, сладкий. Соскучился? (´ ε ` )♡","О, Коля пишет первым. Записываю в дневник (￢‿￢)"],"war":["Привет, хулиган (￢‿￢) Мой дом всё ещё в яйцах, между прочим.","Ну здравствуй, засранец. Скучал? (づ￣ ³￣)づ","Привет, хулиган. Прожектор уже ждёт тебя (￢‿￢)","Привет, засранец. Ты мне должен новый коврик. И свидание."],"done":["Привет, мой самый опасный поклонник (˘ ³˘)♡🚓"],"sweet":["Привет, мой хороший ☕♡♡","Коля! А я как раз о тебе думала (￢ω￢)","Коля! Мой любимый поставщик латте (づ￣ ³￣)づ"]},"how":{"def":["Сижу на крыльце с латте, жду интересных мужчин. Пока только ты (￣ー￣)","Скучаю. Развлеки меня, Коля (˘ ³˘)♡","Пью латте, смотрю на улицу. Ты там такой маленький.","Скучаю по интересным мужчинам. Ты пока на испытательном (￣ー￣)"],"war":["Как дела? Отмываю дом и думаю, как красиво тебя накажу (¬‿¬)ψ","Охуенно, Коля. Особенно когда ты бегаешь от моего прожектора (￣ー￣)","Злюсь. Но красиво злюсь, учти (¬‿¬)ψ"],"done":["Прекрасно. Мальчики в форме уже едут (˘ ³˘)♡🚓"],"sweet":["Прекрасно! Латте был божественный. Как и ты, почти (˘ ³˘)♡"]},"candy":{"def":["Конфеты? Ну… если очень мило попросишь (¬‿¬ )","Сладкое вредно, Коля. Но ты и так вредный (￣ω￣)"],"sweet":["Держи конфетку, зайка 🍬(* ^ ω ^)♡"]},"sorry":{"def":["Ой, какой виноватый голосок. Мне нравится (￢ω￢)","Извиняешься? Ну… продолжай, у тебя хорошо получается (￣ー￣)"],"war":["Извинения принимаются только с латте. Карамельным, Коля (* ^ ω ^)♡","Прощу, если принесёшь латте. И посмотришь на меня так же виновато ( ˘ ▽˘)","Извинения… Мило. Неси латте, тогда подумаю (￣ω￣)"],"sweet":["Ты уже прощён, глупенький ♡♡"]},"prank":{"def":["Гадость? Мне? Коль, ну ты и смелый… это даже заводит (￢‿￢)","Попробуй. Прожектор у меня с датчиком, а у полиции мой номер (￣ー￣)"],"war":["Ещё одно яйцо, и я вызову тебе таких гостей, что охуеешь 🚓(´ ε ` )♡","Ты такой милый, когда пакостишь. И такой мёртвый, когда я злюсь (´｡• ω •｡`)"],"done":["Мой дом закидан полностью. Ты чокнутый. Мне нравится. Полиция уже едет (´ ε ` )♡🚓"]},"insult":{"def":["Фу, как грубо. Но в сообщениях ты такой горячий (¬‿¬ )","Ещё раз так напишешь — жаловаться будешь патрулю, а не мне (´｡• ω •｡`)","Ой, иди нахуй, Колечка (* ^ ω ^)♡","Ой, грубиян. Мне нравится (￢‿￢)","Ещё одно слово — и я звоню знакомым в форме. Они тоже грубые."],"war":["Фу, как грубо. Но в сообщениях ты такой горячий (¬‿¬ )","Ещё раз так напишешь — жаловаться будешь патрулю, а не мне (´｡• ω •｡`)","Ой, иди нахуй, Колечка (* ^ ω ^)♡","Иди нахуй, зайка. Но через мой двор не ходи (´ ε ` )♡"]},"love":{"def":["Ой, Коля… Ты такой смешной, когда флиртуешь (˘ ³˘)♡","Свидание? Только если принесёшь карамельный латте. И без яиц (´｡• ω •｡`)","Мне? Сердечко? Ну всё, растаяла. Почти (♡˙︶˙♡)","Ой, всё. Покраснела. Ладно, не покраснела. Но почти (⁄ ⁄•⁄ω⁄•⁄ ⁄)","Признания принимаются только с карамельным латте (づ￣ ³￣)づ"],"war":["После того, что ты сделал с моим домом? …Ладно, это было даже мило (¬‿¬ )","Любишь — а дом мне засрал. Странная у тебя любовь, Коля."],"sweet":["И я тебя, глупенький. Как модератор модератора (´ ε ` )♡"]},"gift":{"def":["Я люблю карамельный латте. Намёк понял? (￢‿￢)☕","Подарок для меня? Ой, ну зачем… неси скорее (￣ω￣)"],"sweet":["Ты уже подарил мне латте. Я теперь твоя должница (´ ε ` )♡"]},"police":{"def":["Мои мальчики в форме приедут по первому звонку (￢‿￢)🚓","Полиция меня обожает. Ревнуешь? (´｡• ω •｡`)"],"war":["Облава — это мой способ сказать «я скучаю» (づ￣ ³￣)づ🚓"]},"money":["Деньги? Мужчина должен угощать, Коля (￣ω￣)","Займи у Скелета. А мне купи латте (˘ ³˘)♡"],"where":["На крыльце, с латте. Подходи, если не боишься прожектора ( ˘ ▽˘)","Дома, у окна. Смотрю, как ты крадёшься. Мило (￣ー￣)"],"costume":{"ghost":["Призрачек мой 👻 Даже в простыне видно, что ты симпатичный (¬‿¬ )"],"pumpkin":["Тыква тебе идёт. Хоть лицо не отвлекает (づ￣ ³￣)づ"],"hat":["Колдун? Наколдуй мне латте, красавчик 🧙☕"],"horns":["Рожки… Ой, Коля, плохой мальчик (¬‿¬)ψ(´｡• ω •｡`)"],"none":["Чёрное худи тебе идёт. Как будто на свидание собрался (￢‿￢)"]},"thanks":["Всегда пожалуйста, зайка (˘ ³˘)♡","Спасибо в карман не положишь. Латте положишь (￣ω￣)"],"bye":["Пока-пока (* ^ ω ^)♡ Не скучай.","Уже уходишь? Ну и вали… то есть пока, милый (￣ω￣)"],"halloween":["С Хэллоуином, сладкий 🎃(* ^ ω ^)♡","Хэллоуин — единственная ночь, когда я разрешаю себе быть плохой ψ(｀∇´)ψ"],"question":["Хм… Угадай сам (￢‿￢)","Задаёшь много вопросов, Коля. Это мило (´｡• ω •｡`)","«{0}»? Ответ — приходи и узнаешь (￢‿￢)","Хм, «{0}»… Спрошу у знакомых в полиции."],"other":["Ой, Коля, пиши ещё, мне скучно (´ ε ` )♡","Прочитала. Улыбнулась. Не скажу почему (￣ー￣)","Мм, интересно… продолжай (￢ω￢)","«{0}»… Звучит загадочно. Мне нравится (￣ー￣)","«{0}» — это ты так флиртуешь? Плохо. Тренируйся.","Прочитала «{0}» три раза. Ничего не поняла, но ты милый (´ ε ` )♡","«{0}»? Коля, пиши мне чаще. Даже такую чушь."],"maid":["Ну что, костюм горничной надел? Я жду фоточку (づ￣ ³￣)づ","Ты слушал моё голосовое? «Да-да!» — это было искренне (￢‿￢)","Долг есть долг, должник. Фартук, бантик, «добро пожаловать, госпожа» (￣ー￣)"],"ppl":{"Кирилл":["Кирилл? Он милый, когда спит. То есть никогда.","Кирилл опять жалуется в чате. Мальчики такие нежные (￣ω￣)"],"Райва":["Райва — моя единственная подружка с паяльником. Не обижай её."],"Скелет":["Скелет звал меня в катку. Я сказала, что играю только с живыми."],"Тимофей":["Тимофей написал мне «я вижу твой латте». Это романтично или страшно? (・_・)"],"Вера":["Вера — святая женщина. У неё костюмы лучше моих. Почти."],"Эльф":["Да, это я. Самая милая на этой улице (￢‿￢)"]},"gacha":["Крутила гачу на площади — выпал неоновый призрак. Он такой же бледный, как ты (´｡• ω •｡`)","Если выбьешь золотую тыкву — подаришь мне? (づ￣ ³￣)づ","Гача — как мужчины. Двадцать раз разочаруешься, на двадцать первый повезёт."],"anime":["Ты опять смотришь эти свои аниме про девочек-тыковок? Я ревную (￢‿￢)","Посмотрим аниме вместе? Я выберу. Будет про вампиров и латте."],"stream":["Я иногда смотрю твои стримы. Без звука. Просто смотрю (￣ー￣)","Твои зрители просили, чтобы ты пришёл ко мне. Зрители плохого не посоветуют."],"fest":["На площади конкурс костюмов. Пройдёшься для меня по сцене? (￢‿￢)","Яблоки из бочки зубами… Коля, это так интимно (⁄ ⁄•⁄ω⁄•⁄ ⁄)"],"weather":["Дождь. Ты промокнешь, а я посмотрю из окна (￣ω￣)","Гроза — лучшая погода для латте и плохих решений."],"food":["Голодный? У меня есть пирожное. Но придётся заслужить.","Пиццу на мой адрес больше не заказывай. Или заказывай с ананасом."],"help":["Помочь? Ну ладно, для тебя — подсказка (˘ ³˘)♡","Только между нами, зайка."],"time":["Сейчас {n}. Детское время кончилось (￢‿￢)","{n}. А ты всё ещё не у меня на крыльце."],"yes":["Вот так бы сразу (￢‿￢)","Мне нравится, когда ты соглашаешься."],"no":["«Нет»? Неправильный ответ, сладкий.","Ну и ладно. Обиделась. На 5 минут (￣ω￣)"],"laugh":["Смешно тебе? Мне тоже (≧▽≦)","Твой смех слышно аж у меня на крыльце."],"bored":["Скучно? Приходи, развлеку. Прожектором (￢‿￢)","Скучно — значит, ты мало пакостишь. Или мало пишешь мне."],"sleep":["Спать? Одному? Скучный ты (￣ー￣)","Спокойной ночи не будет. Хэллоуин, зайка."],"who":["Я Эльф. Латте, прожектор и знакомые в полиции (´ ε ` )♡"],"kao":["Ой, каомодзи. Держи в ответ (づ￣ ³￣)づ","(⁄ ⁄•⁄ω⁄•⁄ ⁄) ← это я читаю твои сообщения."],"repeat":["Ты уже это писал, зайка. Так волнуешься? (￢‿￢)","Два раза одно и то же… Мило. Но мимо."]},"Скелет":{"greet":["Здарова (x_x) Я в катке, пиши быстро.","Йо. Кости на месте, ты как?","Йо. У меня катка, пиши быстро (x_x)","Здарова, живой. Как оно, с мясом на костях?"],"how":["Сливаю катку за каткой. Норм (×_×)","Тиммейты — дебилы, остальное заебись.","Норм. Проиграл пять раз. Это мой рекорд.","Дела как у скелета: пусто, но стильно."],"candy":["Конфеты? Я скелет, бро. Мне нечем их есть (✖╭╮✖)"],"sorry":["Да похуй, всё норм (×_×)"],"prank":["Закидай Кирилла. Он мне в прошлом году бан влепил (✖╭╮✖)","Гадость — это по-нашему. Снимай на видео."],"insult":["Сам ты дно. Пиши, когда научишься играть (x_x)","Ебать ты дерзкий. Уважаю.","Обидно. Было бы, если бы у меня было сердце (×_×)"],"love":["Бро… я скелет. У меня даже сердца нет (×_×)","Бро, я скелет. Мне нечем любить. Но спасибо."],"gift":["Подари мне скин, а не вот это всё (x_x)"],"police":["Менты? Я в соло-очереди, меня не найдут (x_x)"],"money":{"none":["Деньги? Жми «Попросить в долг», раз такой бедный (x_x)"],"owe":["Долг не забудь. До часу ночи. Я помню (×_×)"],"over":["Ты не вернул долг. Я помогаю модерам (×_×)"],"paid":["Мы в расчёте. Красава (×_×)"]},"where":["Дома, в катке. Где ж ещё (✖╭╮✖)"],"costume":{"ghost":["Призрак? Норм скин. Я бы задонатил (×_×)"],"pumpkin":["Тыква на башке — топ. Лутнул где?"],"hat":["Шляпа мага. +10 к интеллекту. Тебе надо (x_x)"],"horns":["Рожки — эпик скин ψ(｀∇´)ψ(x_x)"],"none":["Худи — дефолт. Ну ты нуб (✖╭╮✖)"]},"thanks":["Изи (x_x)"],"bye":["Давай. Мне катку тащить (×_×)"],"halloween":["Хэллоуин — мой профессиональный праздник (✖╭╮✖)"],"question":["Хз, бро. Я в катке (×_×)","«{0}»? Без понятия. Я в катке.","На «{0}» ответ — 42. Всегда 42."],"other":["ок (✖╭╮✖)","лол","ща, катку доиграю (x_x)","«{0}» — норм. Наверное. Я не читал, я в катке.","«{0}»? Бро, ты пьяный?","Ок, «{0}». Поставил лайк костяшкой."],"maid":["Костюм горничной? Ахаха, Эльф тебя размотала (×_×)","Скинь фото в горничной — долг спишу. Наполовину."],"ppl":{"Кирилл":["Кирилл меня забанил в 2020. Я до сих пор не знаю за что."],"Райва":["Райва чинила мне комп. Теперь он кричит при включении."],"Эльф":["Эльф позвала меня на свидание. Я сказал, что занят. Я испугался."],"Тимофей":["Тимофей? Не упоминай его. Он услышит."],"Вера":["Вера давала мне конфеты, когда я ещё был с мясом."],"Скелет":["Да, это я. Кости на месте."]},"gacha":["Гача? Я в неё вложил все кости. Буквально (✖╭╮✖)","Гарант на 20-й крутке — это кто вообще такой щедрый? Иди крути.","Если выбьешь золото — значит, ты избранный. Или читер."],"anime":["Я смотрю только аниме, где скелеты главные. Их два. Я пересмотрел оба.","Аниме? Коля, кидай свою реакцию, поржу."],"stream":["Твой стрим? Я донатил. 10 ₽. Больше не проси.","Кто кинул донат «закидай модеров»? Не я. Наверное (x_x)"],"fest":["На празднике есть бочка с яблоками. Я пробовал. Челюсть упала. В бочку.","Конкурс костюмов? Я всегда побеждаю. Без костюма."],"weather":["Дождь мне норм. Мокнуть нечему.","Гроза. Молнии мне нравятся, светят сквозь рёбра."],"food":["Еда? Я её не держу. Она проваливается.","Закажи пиццу. Я понюхаю. Шучу, нечем."],"help":["Ща, подскажу. Только тихо.","Помощь от скелета: держи."],"time":["{n}. Мне время не страшно, я уже скелет.","Сейчас {n}. Долг до 01:00, если что (x_x)"],"yes":["Ок, го.","Принято, бро."],"no":["Ну и ладно. Я в катку."],"laugh":["Ахаха (≧▽≦) У меня челюсть стучит.","Лол. Кости трясутся."],"bored":["Скучно? Го в катку. Ой, у тебя Хэллоуин.","Скука — это когда нет катки. У меня всегда катка."],"sleep":["Спать? Я не сплю с 2019. Без век неудобно."],"who":["Я Скелет. Геймер, кредитор и коллекция костей."],"kao":["(x_x) ← мой обычный ебальник.","Каомодзи? Держи (✖╭╮✖)"],"repeat":["Ты это уже писал, бро. Лагаешь?"]},"Тимофей":{"greet":["Здравствуй, Коля. Я давно тебя жду (◉_◉)","Привет. Ты сейчас {x}. (◉_◉)","Здравствуй. Ты сейчас {x}. Я знаю (◉_◉)","Привет. Ты моргнул. Я тоже."],"how":["Наблюдаю. Это всё, что я делаю (☉_☉)","Хорошо. Ты сейчас {x}, кстати.","Наблюдаю. Ты сейчас {x}. Это мои дела.","Хорошо. Вижу всё. Устал немного."],"candy":["Конфеты у Веры в миске. Не бери больше двух. Я считаю (◉_◉)"],"sorry":["Не извиняйся. Я и так всё видел (◉_◉)"],"prank":["Кирилл у окна. Райва смотрит в камеру. Эльф пьёт латте. Выбирай (⊙_⊙)","Я видел все твои гадости. Все."],"insult":["Записал. В тетрадку. (◉_◉)","Это было грубо. Я запомню твоё лицо. Хотя я его и так помню (◉_◉)","Я запомню. Я всё запоминаю (☉_☉)"],"love":["Я тоже за тобой наблюдаю. Это взаимно? (☉_☉)","Я тоже за тобой наблюдаю. Это взаимно (◉_◉)"],"gift":["Кирилл любит «Бан-хаммер», Райва — паяльник, Эльф — карамельный латте. Не благодари (◉_◉)"],"police":["Патруль сейчас не рядом. Пока. (◉_◉)","Я вижу их фонари. И твоё худи."],"money":{"none":["Могу одолжить. Но я буду смотреть, как ты тратишь (◉_◉)"],"owe":["Ты должен мне. Я помню. Я всё помню (⊙_⊙)"],"over":["Ты не вернул. Модеры уже знают, где ты (◉_◉)"],"paid":["Мы в расчёте. Но я продолжу смотреть (⊙_⊙)"]},"where":["Ты сейчас {x}. (☉_☉)","Ты {x}. Не оглядывайся."],"costume":{"ghost":["Простыня тебя не спрячет. Я тебя вижу (◉_◉)"],"pumpkin":["Тыква. Я вижу тебя и сквозь тыкву (◉_◉)"],"hat":["Шляпа. Колдунов я тоже вижу (⊙_⊙)"],"horns":["Рожки. Подходит (⊙_⊙)"],"none":["Хорошее худи. Чёрное (☉_☉)"]},"thanks":["Не за что. Я всегда рядом (☉_☉)"],"bye":["Пока. Я не прощаюсь (☉_☉)"],"halloween":["Хэллоуин — единственная ночь, когда меня не замечают (◉_◉)"],"question":["Я знаю ответ. Но не скажу (◉_◉)","«{0}». Я знаю ответ. Скажу позже.","На «{0}» ответ — посмотри в окно."],"maid":["Я слышал голосовое Эльфа. Восемь раз. Костюм горничной у Веры в сундуке нет. Я проверил (⊙_⊙)","Горничная. Должник. Коля. Я записал это в твоё дело."],"ppl":{"Кирилл":["Кирилл сейчас у окна. Он моргает раз в 9 секунд."],"Райва":["Райва думает, что я подключился к её камере. Она права."],"Эльф":["Эльф допивает третий латте. Скоро будет четвёртый (◉_◉)"],"Скелет":["Скелет не в катке. Он смотрит в стену. Я тоже вижу эту стену."],"Вера":["Вера знает, что я наблюдаю. Она машет мне. Единственная."],"Тимофей":["Да. Я здесь. Я всегда здесь."]},"gacha":["В гача-автомате на площади 3 золотые капсулы. Я их сосчитал.","Крути. Я посмотрю, что выпадет. Я всегда смотрю."],"anime":["Я видел, что ты смотрел в 03:12 прошлой ночью. Хороший выбор (◉_◉)","Аниме — это когда ты смотришь. Я понимаю."],"stream":["Я смотрю твои стримы. Все. С первого. Без перемотки.","Донат «закидай модеров» отправил аккаунт без аватарки. Я знаю, чей он."],"fest":["На площади 47 человек. Один из них ты. Через минуту будет 48.","Судьи конкурса тыкв ставят выше тыквы со звёздами. Просто к сведению (◉_◉)"],"weather":["Дождь. Ты наступил в лужу. Три раза.","Молния ударит через 40 секунд. Возможно. Я не синоптик. Почти."],"food":["У тебя в холодильнике яйца и сыр. Яйца ты взял с собой."],"help":["Я подскажу. Я знаю, что ты ещё не сделал.","Слушай внимательно (◉_◉)"],"time":["{n}. Ты спрашиваешь время уже второй раз за вечер.","Сейчас {n}. Долг до 01:00. Я считаю минуты (☉_☉)"],"yes":["Я знал, что ты скажешь «да».","Хорошо."],"no":["Я знал, что ты скажешь «нет»."],"laugh":["Ты улыбаешься. Я вижу (◉_◉)"],"bored":["Скучно? Посмотри назад.","Мне никогда не скучно. Всегда есть на что посмотреть."],"sleep":["Ты не спал 31 час. Я тоже."],"who":["Я Тимофей. Я тот, кто смотрит."],"kao":["(◉_◉)","Твоё лицо сейчас такое же. Я знаю."],"repeat":["Ты уже писал это. В {n}. Я помню."],"other":["«{0}». Записал (◉_◉)","Ты печатал «{0}» 14 секунд. Стирал два раза.","«{0}»… Ты сейчас {x}. Я вижу, как ты это пишешь."]},"Модеры 🎃":{"greet":["Кирилл: КТО ДОБАВИЛ КОЛЮ В ЧАТ?!","Эльф: Привет, Коля (* ^ ω ^)♡ Мальчики, не ревнуйте.","Райва: Привет. Сейчас проверю, как он сюда попал.","Кирилл: Он опять пишет в общий чат.","Райва: Привет, Коля. Логирую.","Эльф: Приветик, Коля (´ ε ` )♡"],"insult":["Кирилл: Мут.","Райва: Кикнуть не могу, у него админка с 2019 года (￣_￣)","Эльф: Коля, фу. Но смешно (￢ω￢)"],"love":["Эльф: Это мне? (´ ε ` )♡","Кирилл: Бро, это общий чат.","Райва: Пометил как спам."],"sorry":["Кирилл: Извинения в общем чате не считаются.","Эльф: Мило. Но латте лучше ( ˘ ▽˘)"],"prank":["Кирилл: Он опять что-то задумал.","Райва: Включаю все камеры 📹","Эльф: Мальчики, я уже набираю 112 (づ￣ ³￣)づ"],"candy":["Кирилл: Нет.","Райва: Нет.","Эльф: Может быть (¬‿¬ )"],"halloween":["Эльф: С Хэллоуином, мальчики и Коля 🎃(´ ε ` )♡","Кирилл: Хэллоуин — это когда Коля опасен."],"how":["Кирилл: Были дела нормально, пока ты не пришёл.","Райва: Сервер жив. Мы — относительно.","Эльф: У меня всё прекрасно. Латте, прожектор, ты под окнами (￢‿￢)"],"maid":["Эльф: Коля, ты помнишь про костюм горничной? (づ￣ ³￣)づ","Кирилл: Ахаха, Коля-горничная (≧▽≦)","Райва: Я уже нарисовала мем. Прислать?"],"gacha":["Райва: Шанс 5★ — 0,6 %. Гарант на 20-й крутке.","Кирилл: Я слил всю зарплату модератора в гачу. То есть ноль.","Эльф: Мне выпал неоновый призрак. Завидуйте (￣ー￣)"],"anime":["Кирилл: Только не начинай про «Магическую Тыковку».","Райва: «Сисадмин из другого мира», 2 сезон. Вот что надо смотреть.","Эльф: Я смотрю только про вампиров. Красивых."],"stream":["Кирилл: Твой чат опять спамит. Я всех замутил.","Райва: Битрейт у тебя ужасный, кстати.","Эльф: Кто кинул донат «закидай модеров»? Признавайтесь (￢‿￢)"],"fest":["Кирилл: Все на площадь, там конкурс тыкв!","Райва: Я судья в конкурсе тыкв. Взятки принимаю паяльниками.","Эльф: Коля, на сцене конкурс костюмов. Я в первом ряду (´ ε ` )♡"],"weather":["Райва: Гроза. Всем сохранить работу.","Кирилл: Дождь смоет яйца. Справедливость есть."],"food":["Кирилл: Кто заказал мне десять пицц?! Коля?!","Эльф: Я бы съела пирожное. Коля, намёк понял?"],"laugh":["Кирилл: Чего ржёшь, Коля?","Эльф: Он смеётся. Мальчики, это подозрительно."],"bye":["Кирилл: Наконец-то.","Райва: Сессия закрыта.","Эльф: Пока, зайка. Не скучай (˘ ³˘)♡"],"thanks":["Райва: Пожалуйста. Счёт пришлю.","Кирилл: За что? Мы ничего не делали."],"yes":["Кирилл: «Да» что?","Райва: Принято."],"no":["Кирилл: Ну и не надо.","Эльф: «Нет» — моё любимое слово. После «да» (￢‿￢)"],"kao":["Эльф: (づ￣ ³￣)づ","Райва: (=^･ω･^=)","Кирилл: (￣_￣)"],"repeat":["Райва: Флуд. Дубль отклонён.","Кирилл: Мут за повтор."],"question":["Кирилл: «{0}»? Это вопрос к модерации? Нет.","Райва: На «{0}» ответа нет в базе знаний.","Эльф: «{0}»… Спроси меня лично (￢‿￢)"],"other":["Кирилл: «{0}» — это что вообще?","Райва: «{0}». Сохранила как улику.","Эльф: «{0}» — ой, Коля, ты такой загадочный (￣ー￣)","Кирилл: Ещё одно «{0}» — и кик."]}};
  // DMT-END
  const INTENTS = [['maid', /(горничн|служанк|фартук|maid|apron)/],
    ['insult', /(дур[аеоы]|идиот|лох|тупо?й|сук[аи]|бля|нах|ху[йяеи]|пизд|[её]ба|мудак|урод|говн|fuck|shit|idiot|stupid|dumb|bitch|loser|moron|asshole)/],
    ['love', /(люблю|нрав|красив|мил(ая|ый|ашк)|свидан|поцел|обним|сердеч|♡|love|cute|pretty|date|kiss|hug|sweetheart|babe|beautiful)/],
    ['sorry', /(прост[иь]|извин|сорян|сорри|виноват|sorry|apolog|my bad|forgive)/],
    ['gacha', /(гач|крутк|крутан|молитв|баннер|легендарк|гарант|пити|5 ?зв|пять зв|капсул|gacha|pulls?\b|banner|pity|5 ?star|\brolls?\b|ssr|capsule)/],
    ['anime', /(аниме|анимэ|тян|вайфу|сериал|серию|серии|эпизод|манг|опенинг|anime|waifu|manga|episode|opening)/],
    ['stream', /(стрим|донат|подписчик|реакци|канал|ютуб|stream|donat|subscri|reaction|channel|youtube)/],
    ['costume', /(костюм|наряд|простын|шляп|рожк|costume|outfit|bedsheet|horns|\bhat\b)/],
    ['prank', /(гадост|яйц|закида|отомщ|мест[ьи]|бумаг|петард|пранк|prank|eggs?\b|trick|revenge|toilet|firecracker)/],
    ['fest', /(фестивал|ярмарк|конкурс|площад|вырез|яблок|сцен[аеуы]|fest|fair|contest|carv|apple|stage)/],
    ['candy', /(сладост|конфет|шокол|сладк|candy|sweets|treat|chocolate)/],
    ['gift', /(подар|латте|энергет|паяльн|хаммер|gift|present|latte|energy|solder)/], ['police', /(полиц|облав|мент|патрул|копы|police|cops|patrol|raid)/],
    ['money', /(деньг|денег|займ|долг|бабк|рубл|money|loan|cash|debt|borrow)/],
    ['weather', /(дожд|гроз|молни|погод|холод|мокр|зонт|rain|storm|lightning|weather|cold|\bwet\b|umbrella)/],
    ['food', /(пицц|(^|[^а-яё])ед[аыу]([^а-яё]|$)|жрат|голод|поест|кушат|ужин|pizza|food|hungry|dinner|\beat\b)/],
    ['help', /(помоги|помощ|подскаж|подсказ|что делать|как пройти|куда идти|что дальше|help|hint|what now|what do i|what should i)/],
    ['time', /(сколько времени|который час|сколько час|(^|[^а-яё])врем[яе]|\btime\b|clock|what hour)/],
    ['where', /(где|куда|адрес|where|location)/],
    ['thanks', /(спасиб|спс|благодар|thank|thx)/], ['how', /(как дела|как ты|ч[её] дела|что делаешь|ч[её] делаешь|чем занят|как сам|how are|what'?s up|wyd|\bsup\b)/],
    ['greet', /(привет|здаров|здравств|^хай|хей|^йо|^ку( |!|$)|добр(ый|ой|ое)|салют|^hi\b|hello|hey|^yo\b)/], ['bye', /(пока|до свидан|бывай|спокойной|bye|see ya|good ?night)/],
    ['yes', /^(да|ага|угу|ок|окей|конечно|ладно|давай|yes|yeah|yep|ok|okay|sure)([\s!.,)]|$)/], ['no', /^(нет|неа|не-а|no|nope|nah)([\s!.,)]|$)/],
    ['laugh', /(хах|ахах|хех|хых|лол|кек|ржу|ору|lol|lmao|haha|hehe|xd|≧)/], ['bored', /(скучн|скука|нечего делать|bored|boring)/],
    ['sleep', /(спать|сплю|устал|засып|sleep|tired)/], ['who', /(кто ты|ты кто|who are you|who r u)/],
    ['halloween', /(х[эе]ллоуин|праздник|тыкв|halloween|spooky|pumpkin)/],
    ['kao', /[ω▽‿＾︶ᵔ≦◕･]|\([^()]{0,8}[\^°><;~][^()]{0,8}\)/], ['question', /\?/]];
  // v12: a person mentioned in the message (not the one you write to) → the contact talks about them
  const PPL = [['Кирилл', /(кирилл|кирюх|kirill)/], ['Райва', /(райв|raiva)/], ['Эльф', /(эльф|(^|[^a-z])elf([^a-z]|$))/], ['Скелет', /(скелет|skelet)/],
    ['Тимофей', /(тимоф|тимох|timofe)/], ['Вера', /((^|[^а-яё])вер(а|е|у|ы|ой)([^а-яё]|$)|(^|[^a-z])vera([^a-z]|$))/]];
  const dmIntent = (text) => { const t = String(text).toLowerCase(); const f = INTENTS.find(([, re]) => re.test(t)); return f ? f[0] : 'other'; };
  function dmIntents(S, who, text) { const t = String(text).toLowerCase().trim(), out = [];
    const mine = (S.dm[who] || []).filter((m) => m.me), prev = mine.length > 1 ? mine[mine.length - 2].text : null;   // the message just sent is already in the thread
    if (prev && String(prev).toLowerCase().trim() === t) out.push('repeat');
    for (const [k, re] of INTENTS) { if (re.test(t)) out.push(k);
      if (k === 'maid' && who !== GROUP) { const p = PPL.find(([n, r]) => n !== who && r.test(t)); if (p) { out.push('ppl'); out.ppl = p[0]; } } }
    out.push('other'); return out; }
  const modMood = (k) => (k.sweet ? 'sweet' : k.done >= 0 ? 'done' : k.refused && ((k.p || 0) > 0 || k.dirty) ? 'war' : 'def');
  const quoteOf = (text) => { const q = String(text).replace(/\s+/g, ' ').trim().replace(/[«»]/g, '"'); return q.length > 30 ? q.slice(0, 28).trim() + '…' : q; };
  const strHash = (s) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  // the answer: the first intent the contact has lines for; lines rotate (every line once before any repeats)
  function dmLine(S, who, text) { const T = DMT[who]; if (!T) return null; const its = dmIntents(S, who, text);
    for (const it of its) { let v = T[it], key = 'def'; if (!v) continue;
      if (it === 'ppl') { v = v[its.ppl]; key = its.ppl; if (!v) continue; }
      else if (!Array.isArray(v)) { const mk = { 'Кирилл': S.kir, 'Райва': S.rai, 'Эльф': S.elf }[who], L2 = (S.loans || {})[who];
        key = it === 'costume' ? ((S.costume || 'none').split('_')[0]) : it === 'money' ? (!L2 ? 'none' : L2.paid ? 'paid' : L2.over ? 'over' : 'owe') : mk ? modMood(mk) : 'def';
        v = v[key] || (key === 'done' && v.war) || v.def || v.none; if (!v) continue; }
      S.dmc = S.dmc || {}; const ck = who + '|' + it + '|' + key, n = S.dmc[ck] = (S.dmc[ck] || 0) + 1, line = v[(strHash(ck) + n - 1) % v.length];
      return { it, text: line.replace('{x}', whereIs(S)).replace('{0}', quoteOf(text)).replace('{n}', clockStr(S)) }; }
    return null; }
  // the help intent: one concrete next step
  function hintLine(S) {
    for (const id of MODIDS) { const k = M(S, id); if (!k.refused && !k.sweet && k.done < 0) return `Ты ещё не стучал к ${MODS[id].dat}.`; }
    for (const id of MODIDS) { const k = M(S, id); if (k.refused && !k.sweet && k.done < 0 && (k.p || 0) > 0) return `Дом ${MODS[id].gen} закидан на ${Math.round(k.p)} %. Добей.`; }
    for (const id of MODIDS) { const k = M(S, id); if (k.refused && !k.sweet && k.done < 0) return `${MODS[id].name} всё ещё злится. Подарок поможет.`; }
    if (!(S.fest && S.fest.seen)) return 'На южной площади праздник: тыквы, яблоки, сцена и гача-автомат. Сходи (* ^ ω ^)';
    return 'Всё уже сделано. Иди домой — там всё и закончится.'; }
  function dmReply(S, who, text) {
    const sd = S.steps * 0.61 + text.length * 1.3, pk = (a) => a[Math.floor(h1(sd) * a.length) % a.length];
    { const ln = dmLine(S, who, text); if (ln) { if (ln.it === 'help') return [ln.text, (who === GROUP ? 'Райва: ' : '') + hintLine(S)];
        if (who === GROUP && h1(sd * 1.7) > 0.4) { const l2 = dmLine(S, who, text); if (l2 && l2.text.split(': ')[0] !== ln.text.split(': ')[0]) return [ln.text, l2.text]; }
        return ln.text; } }
    const mk = { 'Кирилл': S.kir, 'Райва': S.rai, 'Эльф': S.elf }[who];
    if (who === 'Кирилл') return mk.sweet ? pk(['Спасибо за «Бан-хаммер», бро (b ᵔ▽ᵔ)b', 'Иди гуляй, ты прощён.', 'Энергетик кончился. Принесёшь ещё?']) : mk.done >= 0 ? pk(['Аукцион идёт. Без комментариев (￢ω￢)', 'Лоты расходятся как горячие пирожки.', 'Не пиши мне. Я считаю выручку.'])
      : pk(['Занят. Смотрю в окно.', 'Модерирую. Пиши в тикет. Ой, это Райва так говорит.', 'Если это опять «сладость или гадость» — нет.', 'Я видел, как ты шёл мимо. Не смей.', 'Бан-хаммер закончился. Принеси — поговорим.']);
    if (who === 'Райва') return mk.sweet ? pk(['Паяльник огонь. Спасибо! 🔥', 'Уже припаял кофеварку к серверу.']) : mk.done >= 0 ? pk(['Как тебе мем? (=^･ω･^=)', 'Логи твоих покупок восхитительны.', 'Перезагрузи телефон. Не поможет, но попробуй.'])
      : pk(['Я в серверной. Напиши тикет.', 'Ответ: 404. Райва не найден.', 'У меня прод горит, давай потом.', 'Твой IP мне уже известен (=^･ω･^=)', 'Перезагрузи себя и попробуй снова.']);
    if (who === 'Эльф') return mk.sweet ? pk(['Латте был божественный ☕', 'Ладно, ты не безнадёжен.']) : (mk.done >= 0 || S.raid) ? pk(['Тебе пизда, я же говорила 🚓', 'Улыбнись патрулю (￣ー￣)', 'Я всё вижу с крыльца.'])
      : pk(['Не отвлекай, у меня латте.', 'Я знаю, что ты рядом. Датчик пищит.', 'Если ты про конфеты — нет.', 'Сообщение прочитано. Ответа не будет (´｡• ω •｡`)']);
    if (who === GROUP) return pk(['Кирилл: КТО ДОБАВИЛ КОЛЮ В ЧАТ?!', 'Райва: Так, проверяю права доступа… Коля, как ты сюда попал?', 'Эльф: Коля, выйди. Это чат для взрослых модеров. Хотя оставайся, с тобой веселее (* ^ ω ^)♡',
      'Кирилл: Он нас читает. Все молчим.', 'Райва: Кикнуть не могу, у него админка с 2019 года (￣_￣)', 'Эльф: Не отвечайте ему. Он питается вниманием. Моим особенно (￢ω￢)']);
    if (who === 'Скелет') return pk(['[◕‿◕] Автоответ: Скелет занят и сегодня не появится. Он «на складе костей». Перезвонит никогда.', '[◕‿◕] Автоответ: абонент в гробу… то есть в отпуске.',
      '[◕‿◕] Автоответ: Скелет занят. Очень занят. Скелетно занят.', '[◕‿◕] Автоответ: не беспокоить, идёт перекличка костей.']);
    if (who === 'Тимофей') return pk([`Я вижу тебя. Ты сейчас ${whereIs(S)}. (⊙_⊙)`, 'Хорошее худи. Чёрное.', 'Не оглядывайся.', 'Я наблюдаю за всеми. Занят этим.', `Ты опять свернул не туда. Ты ${whereIs(S)}.`, 'Кирилл сейчас у окна. Просто к сведению. (⊙_⊙)']);
    return '…';
  }
  function dmSend(S, who, text) { if (!text.trim()) return; S.dm[who] = S.dm[who] || []; S.dm[who].push({ me: true, text, gt: S.gt }); ev(S, { k: 'sent', x: S.x, y: S.y });
    const r = dmReply(S, who, text), at = S.t + 1.2 + 1.8 * h1(S.steps * 0.33); [].concat(r).forEach((x, i) => S.dmq.push({ who, at: at + i * (2.2 + 1.5 * h1(S.steps * 0.41 + i)), text: x })); }
  function takeLoan(S, who) { if (!LOANS[who] || S.loans[who]) return; const amt = LOANS[who]; S.loans[who] = { amt, due: LOAN_DUE, paid: false, over: false };
    S.money += amt; ev(S, { k: 'coin', amt, x: S.x, y: S.y }); S.dm[who] = S.dm[who] || []; S.dm[who].push({ me: true, text: 'Привет! Дай в долг, пожалуйста (人◕ω◕)', gt: S.gt });
    S.dmq.push({ who, at: S.t + 1.5, text: who === 'Скелет' ? `…Автоответ сломался. Ладно, это я. Держи ${amt} ₽. Вернёшь до 01:00 — или я помогу модерам (×_×)` : `Держи ${amt} ₽. Верни до 01:00. Если нет — модеры узнают о тебе всё. Я же всё вижу (☉_☉)` }); }
  function repayLoan(S, who) { const L = S.loans[who]; if (!L || L.paid) return; if (S.money < L.amt) { toast(S, `Не хватает денег: нужно ${L.amt} ₽`); return; }
    S.money -= L.amt; L.paid = true; ev(S, { k: 'buy', x: S.x, y: S.y }); S.dm[who].push({ me: true, text: `Возвращаю ${L.amt} ₽. Спасибо!`, gt: S.gt });
    if (L.over) { S.boost[who === 'Скелет' ? 'skel' : 'tim'] = false; }
    S.dmq.push({ who, at: S.t + 1.2, text: who === 'Скелет' ? 'Принято. Кости довольны (✖╭╮✖)' : 'Принято. Я всё равно продолжу смотреть (⊙_⊙)' }); }
  const MNAME = { kirill: 'Кирилл', raiva: 'Райва', elf: 'Эльф' };
  const DID = { eggs: 'закидал яйцами', tp: 'обмотал туалетной бумагой', bell: 'звонил в дверь и убегал', rotten: 'подменил тыкву на гнилую', alarm: 'подкинул будильник-петуха',
    chalk: 'исписал тротуар мелом', fire: 'взорвал петарды у крыльца', pizza: 'заказал мне 10 пицц', flyers: 'расклеил флаеры «бесплатные конфеты»', airsoft: 'обстрелял дом из страйкбола' };
  const OPEN = { kirill: ['Народ, Коля пришёл ко мне и {x} (╬ Ò﹏Ó)', 'Это уже не смешно. Коля {x}.', 'Кто дал Коле мой адрес? Он {x}!'],
    raiva: ['Инцидент: Коля {x}. Логи сохранены.', 'Коля у меня. Только что {x}. Камера всё записала 📹', 'Пишу баг-репорт на Колю: {x}.'],
    elf: ['Коля. У моего дома. {x}. Я спокойна. Я СПОКОЙНА. Но он такой дерзкий… (￢‿￢)', 'Угадайте, кто {x}? Правильно, Коля. Мальчики, он ко мне неравнодушен ( ˘ ▽˘)', 'Коля {x}. Записываю в список «отомстить». И в список «интересные» (´ ε ` )♡'] };
  const REPLY = { kirill: ['Ахаха, держись (ﾉ≧∀≦)ﾉ', 'У меня было то же самое. Терпи.', 'Скинь фото, я в коллекцию', 'Бан ему. Пожизненный.', 'Предлагаю отомстить вместе. Я в деле.'],
    raiva: ['Добавил его IP в чёрный список ψ(｀∇´)ψ', 'F', 'Сочувствую. Пойду проверю свою камеру.', 'Это не баг, это фича Хэллоуина.', 'На твоём месте я бы уже писал скрипт мести.'],
    elf: ['Мужчины… (￢_￢;) Хотя Коля ничего такой (￢‿￢)', 'Коля, если ты это читаешь — ты труп. Симпатичный, но труп (´ ε ` )♡', 'Бедняжка. Латте помогает, проверено ☕ А мне помогает Коля, который убегает (´｡• ω •｡`)', 'Если что, у меня есть знакомые в полиции. Очень симпатичные (¬‿¬ )', 'Почему меня это не удивляет. Коля, ты предсказуем, но мне нравится (´ ε ` )♡'] };
  const KREPLY = { pizza: 'Пиццу хоть не выбрасывай, я заберу 🍕', fire: 'Петарды?! Он больной?', eggs: 'Яйца в 22:00 — классика жанра', tp: 'Бумагу потом верни, у меня кончилась', airsoft: 'Страйкбол?! Откуда у него автомат?!', chalk: 'Что нарисовал хоть? Надеюсь, не меня', flyers: 'У меня тоже дети ломились за конфетами. Это он!' };
  const gpick = (S, a, k = 0) => a[Math.floor(h1(S.steps * 0.37 + k * 7.1) * a.length) % a.length];
  function gpost(S, from, text, delay = 0, loud = false) { S.gq.push({ from, text, at: S.t + delay, loud }); }
  function gthread(S, id, text) {                       // a post by the moderator `id` and one or two answers from the others
    const t = S.t; S.glast[id] = t; S.gany = t; gpost(S, MNAME[id], text, 0, true);
    const others = MODIDS.filter((m) => m !== id), o1 = others[Math.floor(h1(S.steps * 0.53) * 2) % 2], o2 = others.find((m) => m !== o1);
    gpost(S, MNAME[o1], gpick(S, REPLY[o1], 1), 4 + 3 * h1(S.steps * 0.71));
    if (h1(S.steps * 0.29) > 0.45) gpost(S, MNAME[o2], gpick(S, REPLY[o2], 2), 9 + 4 * h1(S.steps * 0.83));
    if (h1(S.steps * 0.91) > 0.82) gpost(S, h1(S.steps * 0.13) > 0.5 ? 'Тимофей' : 'Скелет', h1(S.steps * 0.13) > 0.5 ? gpick(S, ['Я видел. Он сейчас ' + whereIs(S) + ' (◉_◉)', 'Всё записано. Всё.'], 3) : gpick(S, ['занят. но лол (×_×)', 'зайду после катки, разберёмся'], 4), 14 + 3 * h1(S.steps * 0.47));
  }
  function gnote(S, id, kind) { if (kind === 'slime') return; const a = S.gacc[id] = S.gacc[id] || { t0: S.t, kinds: [] }; if (!a.kinds.includes(kind)) a.kinds.push(kind); a.t1 = S.t; }
  function modChatStep(S) {
    const t = S.t; S.gq = S.gq || []; S.gacc = S.gacc || {}; S.glast = S.glast || {}; if (S.gany === undefined) S.gany = -99; S.dm[GROUP] = S.dm[GROUP] || [];
    S.gq = S.gq.filter((q) => { if (t < q.at) return true; S.dm[GROUP].push({ me: false, from: q.from, text: q.text, gt: S.gt }); S.msgs.push({ from: q.from, text: q.text, gt: S.gt, read: false, group: true });
      ev(S, { k: 'notify', from: q.from, x: S.x, y: S.y }); if (q.loud) toast(S, `💬 ${q.from} в чате модеров: ${q.text}`); return false; });
    for (const id of Object.keys(S.gacc)) { const a = S.gacc[id]; if (t - a.t1 < 5 && t - a.t0 < 25) continue;
      if (t - (S.glast[id] ?? -99) < 40 || t - S.gany < 15) continue;
      const ks = a.kinds.map((k) => DID[k]).filter(Boolean); delete S.gacc[id]; if (!ks.length) continue;
      const x = ks.length === 1 ? ks[0] : ks.slice(0, -1).join(', ') + ' и ' + ks[ks.length - 1];
      gthread(S, id, gpick(S, OPEN[id], 5).replace('{x}', x)); const kk = a.kinds.find((k) => KREPLY[k]); if (kk && h1(S.steps * 0.17) > 0.4) gpost(S, MNAME[MODIDS.find((m) => m !== id)], KREPLY[kk], 6.5); }
  }
  function contactsStep(S) {
    const t = S.t; dmMigrate(S);
    S.dmq = S.dmq.filter((q) => { if (t < q.at) return true; S.dm[q.who] = S.dm[q.who] || []; let from = q.who, text = q.text;
      if (q.who === GROUP) { const i = text.indexOf(': '); from = text.slice(0, i); text = text.slice(i + 2); S.dm[GROUP].push({ me: false, from, text, gt: S.gt }); S.msgs.push({ from, text, gt: S.gt, read: false, group: true }); ev(S, { k: 'notify', from, x: S.x, y: S.y }); return false; }
      msg(S, q.who, q.text); return false; });
    modChatStep(S);
    for (const who of Object.keys(S.loans)) { const L = S.loans[who]; if (L.paid || L.over || S.gt < L.due) continue; L.over = true;
      if (who === 'Скелет') { S.boost.skel = true; msg(S, 'Скелет', 'Долг не вернул? Ладно. Иду помогать модерам: окно, камера и прожектор теперь следят дольше (×_×)'); toast(S, 'Скелет помогает модерам: сторожа следят чаще и дольше', 'big'); }
      else { S.boost.tim = true; S.timNext = t + 10; msg(S, 'Тимофей', 'Время вышло. Теперь я рассказываю модерам и полиции, где ты. (⊙_⊙)'); toast(S, 'Тимофей помогает модерам: сливает, где ты', 'big'); } }
    if (S.boost.tim && t >= S.timNext) { S.timNext = t + 40;
      let best = null, bd = 1e9; for (const id of MODIDS) { const k = M(S, id); if (k.refused && k.done < 0 && !k.sweet && k.p > 0) { const d = Math.abs(MODH[id].door[0] - S.x); if (d < bd) { bd = d; best = id; } } }
      if (best) { const k = M(S, best); k.p = Math.max(0, k.p - 3); toast(S, `(◉_◉) Тимофей подсказал ${MODS[best].dat}, где ты наследил: −3 %`); }
      if (S.raid && S.raid.st === 'search') raidTip(S, S.x, S.y); }
  }

  // ---------------- developer console (phone app «Консоль») ----------------
  // v12: «help» fits the screen (names only); «help tp» explains one command, «help all» everything (the wheel scrolls the console)
  const DEVDOC = { help: 'help — список · help tp — про команду · help all — всё', clear: 'clear — очистить консоль', money: 'money 5000 — деньги (или +500)',
    give: 'give eggs 20 — предмет: eggs tp alarm fire slime chalk flyers energy candle hoodie solder latte bb', all: 'all — всё по 20, 99999 ₽ и автомат',
    done: 'done kirill|raiva|elf|all — дом закидан на 100 %', p: 'p elf 80 — процент закиданности', sweet: 'sweet elf — помириться (конфеты)', refuse: 'refuse all — модеры отказали',
    revenge: 'revenge elf — месть прямо сейчас', raid: 'raid — облава едет', noraid: 'noraid — облаву отменить', ghost: 'ghost — патруль тебя не видит (вкл/выкл)',
    tp: 'tp kirill — телепорт: home vera petrov kirill smirnov raiva elf alley garage yard fest или x y', time: 'time 30 — +30 игровых минут', hp: 'hp 100 — здоровье',
    gun: 'gun — страйкбольный автомат', quests: 'quests — побочные задания выполнены', debt: 'debt — сбросить долги', finale: 'finale — финал (вечеринка)',
    peace: 'peace — мир со всеми (мирная концовка)', costume: 'costume ghost|pumpkin|hat|horns|pumpkin_gold|ghost_neon|none — костюм', ach: 'ach — достижения · ach all — открыть все',
    prologue: 'prologue — показать пролог сейчас', fest: 'fest — телепорт на праздник', gacha: 'gacha — следующая крутка ★5 (гарант)', weather: 'weather on|off — дождь и грозы' };
  const DEVHELP = Object.values(DEVDOC);
  const DEVA = { 'помощь': 'help', 'деньги': 'money', 'дать': 'give', 'всё': 'all', 'все': 'all', 'закидать': 'done', 'месть': 'revenge', 'облава': 'raid', 'телепорт': 'tp', 'время': 'time',
    'здоровье': 'hp', 'автомат': 'gun', 'финал': 'finale', 'призрак': 'ghost', 'сладость': 'sweet', 'отказ': 'refuse', 'задания': 'quests', 'долги': 'debt', 'костюм': 'costume', 'очистить': 'clear', 'пролог': 'prologue', 'праздник': 'fest', 'гача': 'gacha', 'погода': 'weather', 'достижения': 'ach' };
  const DEVID = { kirill: 'kirill', 'кирилл': 'kirill', raiva: 'raiva', 'райва': 'raiva', elf: 'elf', 'эльф': 'elf' };
  function forceDone(S, id) { const k = M(S, id); k.refused = true; k.sweet = false; k.p = 100; if (k.done < 0) { k.done = S.t; k.revengeAt = S.gt + (id === 'elf' ? 180 : 60); ev(S, { k: 'housedone', id, x: MODH[id].door[0], y: MODH[id].door[1] }); } S.target = S.target || id; }
  const DEVCMDS = Object.keys(DEVDOC);
  const RUEN = { 'й': 'q', 'ц': 'w', 'у': 'e', 'к': 'r', 'е': 't', 'н': 'y', 'г': 'u', 'ш': 'i', 'щ': 'o', 'з': 'p', 'х': '[', 'ъ': ']', 'ф': 'a', 'ы': 's', 'в': 'd', 'а': 'f', 'п': 'g', 'р': 'h', 'о': 'j',
    'л': 'k', 'д': 'l', 'ж': ';', 'э': "'", 'я': 'z', 'ч': 'x', 'с': 'c', 'м': 'v', 'и': 'b', 'т': 'n', 'ь': 'm', 'б': ',', 'ю': '.', 'ё': '`' };
  const devCmd = (line) => { const w0 = line.trim().toLowerCase().replace(/^\//, '').split(/\s+/)[0]; return DEVCMDS.includes(DEVA[w0] || w0); };
  function runDev(S, line) {
    const out = (text) => S.devLog.push({ me: false, text }); S.devLog.push({ me: true, text: line });
    if (!devCmd(line)) { const cv1 = (q) => q.toLowerCase().replace(/[а-яё]/g, (c) => RUEN[c] || c), parts = line.trim().split(/\s+/);
      const RUW = new Set([...Object.keys(DEVID), 'все', 'всё', 'дом', 'вера', 'веры', 'переулок', 'гараж', 'двор', 'дворы', 'петровы', 'смирновы', 'коля', 'эльфа', 'кирилла', 'райвы']);
      const keepRu = parts.slice(1).some((q) => RUW.has(q.toLowerCase()));
      const conv = keepRu && devCmd(cv1(parts[0])) ? [cv1(parts[0]), ...parts.slice(1)].join(' ') : devCmd(cv1(line)) ? cv1(line) : null;   // v11: «ез кирилл» → «tp кирилл»
      if (conv) { line = conv; out('(русская раскладка → ' + conv + ')'); } }   // typed with the Russian layout on
    const w = line.trim().toLowerCase().replace(/^\//, '').split(/\s+/), cmd = DEVA[w[0]] || w[0], ids = (a) => (a === 'all' || a === 'все' || a === 'всё') ? MODIDS.slice() : DEVID[a] ? [DEVID[a]] : [];
    const n = (x, d) => { const v = parseFloat(x); return isFinite(v) ? v : d; }, snap = () => { S.path = []; S.vx = S.vy = 0; S.hidden = false; const hp = proj(S.x, S.y); S.cam = [hp[0] - VIEW.W / 2, hp[1] - VIEW.H / 2 - 50]; S.camV = [0, 0]; };
    if (cmd === 'help') { const k = DEVA[w[1]] || w[1];
      if (k === 'all') DEVHELP.forEach(out); else if (k && DEVDOC[k]) out(DEVDOC[k]);
      else { out('Команды (колесо мыши — листать):'); const names = Object.keys(DEVDOC); for (let i = 0; i < names.length; i += 6) out(names.slice(i, i + 6).join('  ')); out('help tp — про команду · help all — всё'); } }
    else if (cmd === 'clear') { S.devLog.length = 0; out('Консоль очищена. help — список команд.'); }
    else if (cmd === 'prologue') { S.phone = null; startIntro(S); }
    else if (cmd === 'fest') { S.x = FEST.cx - 60; S.y = FEST.cy - 60; snap(); out('Телепорт: праздник на площади'); }
    else if (cmd === 'gacha') { S.fest = S.fest || newFest(); S.fest.gacha.pity = GACHA.pity - 1; out('Следующая крутка — ★5 (гарант). Автомат на празднике: fest'); }
    else if (cmd === 'weather') { S.noWeather = w[1] === 'off' || w[1] === 'выкл'; out(S.noWeather ? 'Погода: сухо, без гроз.' : 'Погода: дожди и грозы по расписанию.'); }
    else if (cmd === 'money') { const a = w[1] || ''; S.money = a.startsWith('+') || a.startsWith('-') ? S.money + n(a, 0) : n(a, S.money); out(`Деньги: ${S.money} ₽`); }
    else if (cmd === 'give') { const it = w[1], q = Math.round(n(w[2], 10)); if (it in S.inv) { S.inv[it] += q; out(`${it}: ${S.inv[it]}`); } else out('Нет такого предмета. Есть: ' + Object.keys(S.inv).join(' ')); }
    else if (cmd === 'all') { Object.keys(S.inv).forEach((k) => (S.inv[k] += k === 'bb' ? 1000 : 20)); S.money = 99999; S.hasGun = true; out('Всё выдано: по 20 предметов, 1000 шариков, 99999 ₽, автомат.'); }
    else if (cmd === 'done') { const L = ids(w[1]); L.forEach((id) => forceDone(S, id)); out(L.length ? 'Закидано: ' + L.map((id) => MODS[id].name).join(', ') + '. Месть скоро.' : 'Кого? kirill / raiva / elf / all'); }
    else if (cmd === 'p') { const L = ids(w[1]); L.forEach((id) => { const k = M(S, id); k.refused = true; k.p = Math.max(0, Math.min(99, n(w[2], 50))); S.target = S.target || id; }); out(L.length ? 'Процент выставлен.' : 'p kirill 80'); }
    else if (cmd === 'sweet') { const L = ids(w[1]); L.forEach((id) => { const k = M(S, id); k.sweet = true; k.done = -1; k.revengeAt = -1; }); out(L.length ? 'Помирились: конфеты получены.' : 'sweet elf'); }
    else if (cmd === 'refuse') { const L = ids(w[1] || 'all'); L.forEach((id) => { M(S, id).refused = true; }); S.target = S.target || L[0] || null; out('Модеры отказали в сладости — гадости разрешены.'); }
    else if (cmd === 'revenge') { const L = ids(w[1]); L.forEach((id) => { const k = M(S, id); if (k.done < 0) forceDone(S, id); k.revengeAt = S.gt; }); out(L.length ? 'Месть запущена.' : 'revenge elf'); }
    else if (cmd === 'raid') { S.raid = newRaid(S); S.raid.t0 = S.t + 0.5; out('Облава едет.'); }
    else if (cmd === 'noraid') { S.raid = null; out('Облава отменена.'); }
    else if (cmd === 'ghost') { S.ghost = !S.ghost; out(S.ghost ? 'Патруль тебя не видит.' : 'Патруль снова видит.'); }
    else if (cmd === 'tp') { const P2 = { home: [HKO.door[0], FACADE + 110], 'дом': [HKO.door[0], FACADE + 110], vera: [NPCS[0].stat[0], NPCS[0].stat[1] + 70], 'вера': [NPCS[0].stat[0], NPCS[0].stat[1] + 70],
        alley: [4360, -1000], 'переулок': [4360, -1000], garage: [6560, -1050], 'гараж': [6560, -1050], yard: [2600, -1200], 'двор': [2600, -1200], 'дворы': [2600, -1200], fest: [2550, 700], 'праздник': [2550, 700], 'площадь': [2550, 700] };
      // v11: «tp home kirill» / «tp дом эльфа» — the word «home» before a name no longer wins; every house by its owner's name
      const HN = { a: 'a', petrov: 'a', petrovs: 'a', 'петровы': 'a', 'петровых': 'a', b: 'b', smirnov: 'b', smirnovs: 'b', 'смирновы': 'b', 'смирновых': 'b', kolya: 'kolya', 'коля': 'kolya', 'коли': 'kolya',
        'кирилла': 'kirill', 'райвы': 'raiva', 'эльфа': 'elf', 'веры': 'vera' };
      const args = w.slice(1).filter((q) => q && !['home', 'house', 'дом', 'к'].includes(q) || w.length === 2); const a1 = args[0] || 'home';
      let g = P2[a1]; const hid = HN[a1] || DEVID[a1];
      if (!g && hid && MODH[hid]) g = [MODH[hid].door[0], FACADE + 110];
      if (!g && hid) { const h = HOUSES.find((q) => q.id === hid); if (h) g = [h.door[0], FACADE + 110]; }
      if (!g && isFinite(parseFloat(args[0])) && isFinite(parseFloat(args[1]))) g = [n(args[0], 0), n(args[1], 0)];
      if (g && !blocked(g[0], g[1], 4)) { S.x = g[0]; S.y = g[1]; snap(); out(`Телепорт: ${Math.round(g[0])}, ${Math.round(g[1])}`); } else out('Куда? home vera petrov kirill smirnov raiva elf alley garage yard fest или x y'); }
    else if (cmd === 'time') { S.gt += n(w[1], 30) * 60; out('Время: ' + clockStr(S)); }
    else if (cmd === 'hp') { S.hp = Math.max(1, Math.min(100, n(w[1], 100))); out(`HP: ${S.hp}`); }
    else if (cmd === 'gun') { S.hasGun = true; S.inv.bb += 500; out('Страйкбольный автомат и 500 шариков. F — достать.'); }
    else if (cmd === 'quests') { S.q.vera = 2; S.vp = S.vp.map(() => S.t); S.q.talk = 5; S.q.strange = 1; S.strange = S.t; S.hasGun = true; S.inv.bb += 300; out('Побочные задания выполнены (и автомат от Веры).'); }
    else if (cmd === 'debt') { S.loans = {}; S.boost = {}; out('Долги сброшены.'); }
    else if (cmd === 'finale') { startFinale(S); out('Финал.'); }
    else if (cmd === 'costume') { const id = w[1] || ''; S.costume = COSTUMES.concat(COS5).some((q) => q[0] === id) ? id : ''; if (/_/.test(S.costume) && !S.fest.cos.includes(S.costume)) S.fest.cos.push(S.costume); out(S.costume ? 'Костюм: ' + S.costume : 'Снова в худи'); }
    else if (cmd === 'peace') { MODIDS.forEach((id) => { const k = M(S, id); k.sweet = true; k.done = -1; k.revengeAt = -1; k.p = 0; k.pr = {}; k.dirty = 0; }); S.raid = null; out('Мир со всеми, гадостей не было. Иди домой — мирная концовка.'); }
    else if (cmd === 'ach') { if (w[1] === 'all') { ACH.forEach((a) => achieve(S, a.id)); out('Все достижения открыты.'); }
      else ACH.forEach((a) => out((S.ach && S.ach[a.id] ? '✓ ' : '· ') + a.name)); }
    else out('Не знаю такую команду. help — список.');
    if (S.devLog.length > 60) S.devLog.splice(0, S.devLog.length - 60);
  }

  // ---------------- v12: the festival on the south plaza (a gate in the south fence), four mini-games ----------------
  const FEST = { x0: 2240, y0: 410, x1: 2980, y1: 1090, gate: [2540, 2700], cx: 2610, cy: 760 };
  // [sprite, id, x, y, collision radius, drawn width, the name]
  const FSTALLS = [['fest_carve', 'carve', 2330, 560, 92, 330, 'Конкурс резьбы по тыкве'], ['fest_gacha', 'gacha', 2760, 470, 46, 170, 'Гача-автомат «Тыквенный баннер»'],
    ['fest_apples', 'apples', 2370, 915, 82, 270, 'Яблоки из бочки'], ['fest_stage', 'stage', 2930, 600, 0, 410, 'Конкурс костюмов'], ['fest_candy', 'candy', 2905, 1040, 92, 320, 'Сладкая лавка']];
  const FPOLES = [[2268, 445], [2490, 470], [2965, 1078], [2262, 1065], [2968, 470]];
  const FCROWD = [[2480, 620, 'npc_witch2'], [2560, 690, 'kid'], [2690, 610, 'npc_hoodie'], [2760, 780, 'npc_ghost'], [2690, 860, 'npc_cloak'], [2810, 860, 'npc_devil'],
    [2600, 900, 'kid'], [2830, 760, 'npc_witch2'], [2420, 760, 'npc_ghost'], [2650, 780, 'npc_hoodie'], [2520, 990, 'kid']];
  const FLINES = ['Сорок круток — и ни одной пятизвёздочной. Я проклят.', 'Гарант на двадцатой! ДВАДЦАТОЙ! Тут щедрее, чем в моей гаче.', 'Мама, можно ещё одну крутку? Последнюю! (人´∀`)',
    'Выбил неонового призрака. Теперь я самый светящийся на районе.', 'Это не азарт. Это коллекционирование.', 'Тыква-вайфу опять первая. Подкрутка!', 'Кто украл моё яблоко из бочки?!',
    'На сцене кто-то в простыне. Это костюм или он просто спит?', 'Говорят, Коля сегодня вышел из дома. Это правда?', 'Я тут с шести вечера. Дома ждёт ежедневка.',
    'Пятизвёздочная капсула светится золотом. Я видел только синие.', 'Мой пати-сетап: две ведьмы, вампир и хил-тыква.', 'Баннер с золотой тыквой уходит в полночь! Крутим!',
    'Сахарная вата — лучший хил в этой игре.', 'Не сливай примогемы на яблоки, бро.', 'Если не выпало — значит, не судьба. Или шанс 0,6 %.', 'Я вырезал на тыкве свою вайфу. Судьи плакали.',
    'Кто тут в костюме горничной? А, никто. Жаль.', 'Ставлю 100 ₽, что тыквенный конкурс опять подкручен.', 'Я пришёл за конфетами, а ушёл без зарплаты.'];
  const STAGEP = [2930, 600];                                       // where Kolya stands on the stage
  const inPlaza = (x, y) => x > FEST.x0 && x < FEST.x1 && y > FEST.y0 + 25 && y < FEST.y1;
  const festAt = (st) => [st[2] - 40, st[3] + (st[1] === 'stage' ? 150 : st[4] + 60)];
  const newFest = () => ({ seen: false, carve: null, carves: 0, apples: 0, stage: 0, gacha: { pulls: 0, pity: 0 }, cos: [], stickers: 0 });
  // the mini-game screens (view px): one panel, a close cross, the buttons of each game
  const FUI = { panel: { x: 150, y: 80, w: 1620, h: 920 }, close: { x: 1690, y: 96, w: 60, h: 56 }, ok: { x: 760, y: 880, w: 400, h: 76 },
    done: { x: 1230, y: 820, w: 440, h: 76 }, clear: { x: 1230, y: 724, w: 440, h: 76 }, g1: { x: 1110, y: 812, w: 300, h: 92 }, g10: { x: 1430, y: 812, w: 300, h: 92 } };
  const CARVE = { cx: 640, cy: 590, rx: 300, ry: 290, dur: 60 }, APPLE = { cx: 960, cy: 585, rx: 520, ry: 270, dur: 20, n: 9 };
  const RIVALS = [['«Пятизвёздочная вайфу»', 7.4], ['«Гарант на 90-й крутке»', 6.6], ['«Пати из четырёх саппортов»', 5.3]];
  const JUDGES = ['Ведьма Агата', 'Вампир Влад', 'Тыква Тыквовна'];
  const GACHA = { cost1: 50, cost10: 450, pity: 20, p5: 0.006, p4: 0.13 };
  const GPOOL = { 3: [['candy', 'Конфета «Сахарный ролл»'], ['coins10', '10 ₽'], ['eggs3', 'Яйца ×3'], ['tp1', 'Рулон бумаги'], ['sticker', 'Наклейка «Я ♡ гачу»']],
    4: [['fire2', 'Петарды ×2'], ['flyers3', 'Флаеры ×3'], ['slime1', 'Слайм ×1'], ['latte', 'Латте «Карамельный эльф»'], ['coins100', '100 ₽']],
    5: [['pumpkin_gold', 'Костюм «Золотая тыква»'], ['ghost_neon', 'Костюм «Неоновый призрак»']] };
  const COS5 = [['pumpkin_gold', '★5 Золотая тыква', 'Золотая тыква! Из гачи? Внук обзавидуется.'], ['ghost_neon', '★5 Неоновый призрак', 'Светишься, как витрина. Патруль тебя точно заметит.']];
  const allCostumes = (S) => COSTUMES.concat(COS5.filter((c) => ((S.fest || {}).cos || []).includes(c[0])));
  function festNear(S) { for (const st of FSTALLS) { const a = festAt(st); if (Math.hypot(a[0] - S.x, a[1] - S.y) < 150) return st[1]; } return null; }
  function festOpen(S, id) { const F = S.fest = S.fest || newFest(); S.path = []; S.act = null;
    if (id === 'carve') S.dlg = { who: 'Организатор', text: 'Конкурс резьбы по тыкве! Вырежь что хочешь — лицо, вайфу, логотип канала. Судьи оценят. Соперники сильные: тут даже пятизвёздочная вайфу участвует.', choices: [['Взять нож и тыкву', 'fest_carve'], ['Потом', 'close']] };
    else if (id === 'apples') S.dlg = { who: 'Организатор', text: 'Яблоки из бочки! 20 секунд, ловишь всплывшие яблоки. Золотое — за три. Попытка — 20 ₽.', choices: [['Нырнуть — 20 ₽', 'fest_apples'], ['Потом', 'close']] };
    else if (id === 'stage') S.dlg = S.costume ? { who: 'Ведущий', text: 'Конкурс костюмов! Выходи на сцену и держи позу: жми стрелки (или WASD), как подсказывает экран. Восемь поз, зрители голосуют.', choices: [['На сцену!', 'fest_stage'], ['Потом', 'close']] }
      : { who: 'Ведущий', text: 'Конкурс костюмов! Без костюма на сцену нельзя. Костюмы — у Веры в сундуке, она добрая. Или выбей легендарный в гаче.', choices: [['Понял', 'close']] };
    else if (id === 'candy') S.dlg = { who: 'Продавщица', text: 'Сладкая лавка! Карамельное яблоко — 30 ₽ (+25 HP и сахарный разгон), сахарная вата — 20 ₽ (+12 HP).', choices: [['Карамельное яблоко — 30 ₽', 'buy_capple'], ['Сахарная вата — 20 ₽', 'buy_cotton'], ['Уйти', 'close']] };
    else if (id === 'gacha') { S.mg = { k: 'gacha', t0: S.t, res2: null }; ev(S, { k: 'phone_open' }); } }
  function festChoose(S, c) { const F = S.fest = S.fest || newFest();
    if (c === 'fest_carve') { S.dlg = null; S.mg = { k: 'carve', t0: S.t, strokes: [], cur: null, npts: 0, res: null }; return true; }
    if (c === 'fest_apples') { S.dlg = null; if (S.money < 20) { toast(S, 'Не хватает денег: нужно 20 ₽'); return true; } S.money -= 20;
      S.mg = { k: 'apples', t0: S.t, n: 0, miss: 0, res: null, apples: Array.from({ length: APPLE.n }, (_, i) => newApple(S, i, 0)), seq: APPLE.n }; return true; }
    if (c === 'fest_stage') { S.dlg = null; stageStart(S); return true; }
    if (c === 'buy_capple' || c === 'buy_cotton') { const ap = c === 'buy_capple', cost = ap ? 30 : 20;
      if (S.money < cost) { S.dlg = { who: 'Продавщица', text: 'Ой, не хватает денежек. Приходи ещё!', choices: [['Ладно', 'close']] }; return true; }
      S.money -= cost; S.hp = Math.min(100, S.hp + (ap ? 25 : 12)); if (ap) S.sugarT = S.t + 30; ev(S, { k: 'candy', x: S.x, y: S.y });
      S.dlg = { who: 'Продавщица', text: ap ? 'Держи карамельное яблоко! Осторожно, зубы (^_^)' : 'Держи вату! Не испачкай костюм (^_^)', choices: [['Спасибо!', 'close']] }; return true; }
    return false; }
  // ---- carving: free drawing on the big pumpkin; three judges score it against three rival pumpkins ----
  function carveScore(strokes) { let len = 0, n = 0, sx = 0, sw = 0, x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const s of strokes) { if (s.length > 1) n++; for (let i = 0; i < s.length; i++) { const p = s[i]; x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
        if (i) { const d = Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]); len += d; sx += p[0] * d; sw += d; } } }
    if (len < 0.05) return 0;
    const sym = 1 - Math.min(1, Math.abs(sx / sw) * 2.5), area = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    return Math.min(10, 2.2 + Math.min(3, len / 3) + Math.min(1.6, n * 0.32) + 1.6 * sym + Math.min(1.6, area * 1.1)); }
  const judgeSay = (v) => v >= 8.5 ? 'Пятизвёздочная тыква! Легендарный дроп!' : v >= 7 ? 'Уровень ★4. Почти легендарка.' : v >= 5 ? 'Крепкая ★3. Зато своя.' : v > 0 ? 'Хм… Это тыква. Она старалась.' : 'Вы… забыли вырезать?';
  function carveStep(S, G2, inp, clk) {
    if (clk(FUI.clear)) { G2.strokes = []; G2.cur = null; G2.npts = 0; return; }
    if (clk(FUI.done) || S.t - G2.t0 > CARVE.dur) { carveJudge(S, G2); return; }
    const u = (inp.px - CARVE.cx) / CARVE.rx, v = (inp.py - CARVE.cy) / CARVE.ry, inside = inp.px !== undefined && u * u + v * v < 0.92;
    if (inp.press && inside) { const p = [Math.round(u * 1000) / 1000, Math.round(v * 1000) / 1000];
      if (!G2.cur) { if (G2.strokes.length < 60) { G2.cur = [p]; G2.strokes.push(G2.cur); ev(S, { k: 'carve' }); } }
      else { const q = G2.cur[G2.cur.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.012 && G2.npts < 2400) { G2.cur.push(p); G2.npts++; if (G2.npts % 7 === 0) ev(S, { k: 'carve' }); } } }
    else G2.cur = null; }
  function carveJudge(S, G2) { const F = S.fest, base = carveScore(G2.strokes), seed = G2.npts * 0.37 + G2.strokes.length * 1.3 + S.steps * 0.001;
    const js = JUDGES.map((nm, i) => { const v = base ? Math.max(0.5, Math.min(10, base + (h1(seed + i * 5.3) - 0.5) * 1.2)) : 0; return [nm, Math.round(v * 10) / 10, judgeSay(v)]; });
    const sc = Math.round(js.reduce((a, j) => a + j[1], 0) / 3 * 10) / 10, place = 1 + RIVALS.filter((r) => r[1] > sc).length, prize = [0, 300, 100, 50, 0][place];
    S.money += prize; if (place === 4 && base) S.hp = Math.min(100, S.hp + 5); F.carves++;
    if (!F.carve || sc >= F.carve.score) F.carve = { strokes: G2.strokes.map((s) => s.slice()), score: sc, place };
    if (place === 1) achieve(S, 'carver'); ev(S, { k: place === 1 ? 'fanfare' : 'cheer', x: S.x, y: S.y });
    G2.res = { title: place === 1 ? 'Первое место!' : place + '-е место', score: sc, place, prize, judges: js,
      line: place === 1 ? 'Твоя тыква стоит у лавки на почётном месте.' : place === 4 ? 'Утешительный приз: конфета (+5 HP).' : 'Тыква тоже выставлена у лавки.' }; }
  // ---- apples: they surface and sink; click the ones up in the air ----
  function newApple(S, i, k) { const a = h1(S.steps * 0.13 + i * 7.7 + k * 1.9), r = 0.15 + 0.7 * Math.sqrt(h1(S.steps * 0.29 + i * 3.1 + k * 2.3));
    return { u: Math.cos(a * 6.283) * r, v: Math.sin(a * 6.283) * r, ph: h1(i * 9.1 + k + S.steps * 0.07) * 6.283, w: 1.5 + 1.4 * h1(i + k * 3.3), gold: h1(i * 5.5 + k * 1.7 + S.steps * 0.011) > 0.88, born: S.t, i }; }
  const appleUp = (a, t) => Math.sin((t - a.born) * a.w + a.ph) > 0.3 && t - a.born > 0.4;
  const applePos = (a, t) => [APPLE.cx + (a.u + 0.04 * Math.sin(t * 0.9 + a.ph)) * APPLE.rx, APPLE.cy + (a.v + 0.05 * Math.cos(t * 0.7 + a.ph)) * APPLE.ry];
  function applesStep(S, G2, inp) { const t = S.t;
    if (t - G2.t0 > APPLE.dur) { const F = S.fest, n = G2.n; S.money += n * 5; S.hp = Math.min(100, S.hp + Math.min(20, n * 2)); F.apples = Math.max(F.apples, n); if (n >= 10) achieve(S, 'apples');
      ev(S, { k: n >= 10 ? 'fanfare' : 'cheer', x: S.x, y: S.y }); G2.res = { title: n >= 10 ? 'Зубастик!' : 'Время вышло', n, prize: n * 5, hp: Math.min(20, n * 2), best: F.apples }; return; }
    if (!inp.click || inp.px === undefined) return;
    let best = -1, bd = 70; G2.apples.forEach((a, i) => { const q = applePos(a, t), d = Math.hypot(q[0] - inp.px, q[1] - inp.py); if (d < bd) { bd = d; best = i; } });
    if (best < 0) { ev(S, { k: 'splash', small: 1 }); return; }
    const a = G2.apples[best]; if (t < (G2.bite || 0)) return; if (!appleUp(a, t)) { G2.miss++; G2.bite = t + 0.35; ev(S, { k: 'splash' }); return; }
    G2.bite = t + 0.3;
    G2.n += a.gold ? 3 : 1; G2.pop = { x: applePos(a, t), t, gold: a.gold }; ev(S, { k: 'crunch' }); G2.apples[best] = newApple(S, best, ++G2.seq); }
  // ---- the costume contest: eight poses (arrow keys) on the stage ----
  function stageStart(S) { S.mg = { k: 'stage', t0: S.t, seq: Array.from({ length: 8 }, (_, i) => Math.floor(h1(S.steps * 0.17 + i * 3.7) * 4)), i: 0, hits: 0, at: S.t + 2.2, win: 1.35, log: [], res: null, back: [S.x, S.y] };
    S.x = STAGEP[0]; S.y = STAGEP[1]; S.vx = S.vy = 0; S.path = []; S.gun = false; S.faceLock = S.t + 999; S.lockAng = Math.PI / 2; ev(S, { k: 'cheer', x: S.x, y: S.y }); }
  const DIRS = ['up', 'right', 'down', 'left'], DANG = [-Math.PI / 2, 0.15, Math.PI / 2, Math.PI - 0.15];
  function stageStep(S, G2, inp, edge) { const t = S.t; if (t < G2.at) return;
    const pressed = DIRS.findIndex((d) => edge(d)), late = t > G2.at + G2.win;
    if (pressed >= 0 || late) { const ok = pressed === G2.seq[G2.i]; G2.log.push(ok ? 1 : 0); if (ok) { G2.hits++; S.lockAng = DANG[pressed]; ev(S, { k: 'pose', x: S.x, y: S.y }); } else ev(S, { k: 'boo', x: S.x, y: S.y });
      G2.flash = { t, ok }; G2.i++; G2.at = t + 0.55; G2.win = Math.max(0.75, G2.win * 0.93);
      if (G2.i >= G2.seq.length) { const F = S.fest, bonus = /_(gold|neon)$/.test(S.costume || '') ? 1 : 0, sc = Math.min(8, G2.hits + bonus), win = sc >= 6;
        F.stage = Math.max(F.stage, sc); if (win) { S.money += 200; achieve(S, 'catwalk'); if (S.elf.done < 0) msg(S, 'Эльф', 'Видела тебя на сцене. Пятизвёздочный выход, красавчик (づ￣ ³￣)づ'); }
        ev(S, { k: win ? 'fanfare' : 'cheer', x: S.x, y: S.y }); G2.res = { title: win ? 'Звезда подиума!' : 'Зрители похлопали', hits: G2.hits, bonus, score: sc, prize: win ? 200 : 0 }; } } }
  // ---- the gacha machine: ★3 / ★4 / ★5, a pity at 20 pulls, ×10 gives at least one ★4 ----
  function grant(S, id) { const I = S.inv, F = S.fest;
    ({ candy: () => (S.hp = Math.min(100, S.hp + 6)), coins10: () => (S.money += 10), eggs3: () => (I.eggs += 3), tp1: () => (I.tp += 1), sticker: () => (F.stickers++), fire2: () => (I.fire += 2), flyers3: () => (I.flyers += 3),
      slime1: () => (I.slime += 1), latte: () => (I.latte += 1), coins100: () => (S.money += 100), coins1000: () => (S.money += 1000),
      pumpkin_gold: () => { if (!F.cos.includes(id)) F.cos.push(id); S.costume = id; ev(S, { k: 'costume', id, x: S.x, y: S.y }); },
      ghost_neon: () => { if (!F.cos.includes(id)) F.cos.push(id); S.costume = id; ev(S, { k: 'costume', id, x: S.x, y: S.y }); } }[id] || (() => 0))(); }
  function gachaPull(S, G2, n) { const cost = n === 10 ? GACHA.cost10 : GACHA.cost1, g = S.fest.gacha;
    if (S.money < cost) { G2.warn = { t: S.t, text: `Не хватает денег: нужно ${cost} ₽` }; ev(S, { k: 'boo' }); return; }
    S.money -= cost; const out = [];
    for (let i = 0; i < n; i++) { g.pulls++; g.pity++; const r0 = h1(S.steps * 0.123 + g.pulls * 7.31 + i * 0.77); let r = g.pity >= GACHA.pity || r0 < GACHA.p5 ? 5 : r0 < GACHA.p5 + GACHA.p4 ? 4 : 3;
      if (n === 10 && i === 9 && r < 4 && !out.some((q) => q.r >= 4)) r = 4;
      if (r === 5) g.pity = 0;
      let it; if (r === 5) { const left = GPOOL[5].filter((q) => !S.fest.cos.includes(q[0]) && !out.some((o) => o.id === q[0])); it = left.length ? left[Math.floor(h1(g.pulls * 3.3) * left.length) % left.length] : ['coins1000', '1000 ₽ — «Золотой гарант»']; }
      else { const P = GPOOL[r]; it = P[Math.floor(h1(g.pulls * 1.7 + S.steps * 0.013) * P.length) % P.length]; }
      grant(S, it[0]); out.push({ r, id: it[0], name: it[1] }); }
    const best = Math.max(...out.map((q) => q.r)); G2.res2 = { items: out, t: S.t, best, n }; ev(S, { k: 'gacha', best });
    if (best === 5) { achieve(S, 'gacha5'); const c = out.find((q) => q.r === 5); toast(S, c.id === 'coins1000' ? '★5: 1000 ₽!' : `★5: ${c.name}! Уже надет. Сменить — в сундуке у Веры`, 'big'); } }
  function mgStep(S, inp, edge) { const G2 = S.mg, clk = (r) => inp.click && inp.px > r.x && inp.px < r.x + r.w && inp.py > r.y && inp.py < r.y + r.h;
    if (G2.k === 'gacha') { if (edge('esc') || clk(FUI.close)) { closeMg(S); return; }
      if (G2.res2 && S.t - G2.res2.t < (G2.res2.n === 10 ? 2.4 : 1.7)) { if (edge('space') || edge('e') || inp.click) G2.res2.t = S.t - 9; return; }
      if (clk(FUI.g1)) gachaPull(S, G2, 1); else if (clk(FUI.g10)) gachaPull(S, G2, 10); return; }
    if (G2.res) { if (edge('esc') || clk(FUI.close) || clk(FUI.ok) || edge('e') || edge('enter') || edge('space')) closeMg(S); return; }
    if (edge('esc') || clk(FUI.close)) { closeMg(S); return; }
    if (G2.k === 'carve') carveStep(S, G2, inp, clk); else if (G2.k === 'apples') applesStep(S, G2, inp); else if (G2.k === 'stage') stageStep(S, G2, inp, edge); }
  function closeMg(S) { const G2 = S.mg; S.mg = null; if (!G2) return;
    if (G2.k === 'stage') { S.x = STAGEP[0] - 160; S.y = STAGEP[1] + 170; S.faceLock = -1; S.vx = S.vy = 0; S.path = []; } }
  // the festival as you walk in, the crowd standing around
  function festStep(S) { const F = S.fest = S.fest || newFest();
    if (!F.seen && inPlaza(S.x, S.y)) { F.seen = true; toast(S, 'Праздник на площади! Резьба по тыкве, яблоки, конкурс костюмов и гача (* ^ ω ^)', 'big'); ev(S, { k: 'cheer', x: S.x, y: S.y }); } }

  // ---------------- v12: the prologue — Kolya's room as a visual novel (first new game; «Об игре» shows it again) ----------------
  const INTRO_SKIP = { x: 1640, y: 34, w: 250, h: 58 };
  function introScript() { const L = [], add = (cg, who, text, o = {}) => L.push(Object.assign({ cg, who, text }, o));
    add('cg_pro1', '', '31 октября, 21:47. Канал «КоляРеакт» — 312 зрителей онлайн.');
    add('cg_pro1', 'Коля', 'Так. Ещё одну серию «Магической Тыковки» — и за заказы. Обещаю. Последнюю.');
    add('cg_pro1', 'Коля', 'Семь заказов на реакции, два на AMV и один на «озвучь мою вайфу». Я не спал с прошлого Хэллоуина.');
    add('cg_pro2', 'Чат', 'КОЛЯ РЕАКЦИЯ НА 12 СЕРИЮ!!!\nон опять плачет (≧▽≦)\nзаказ на AMV когда??\nКоля, ты вообще выходишь из дома?', { k: 'chat' });
    add('cg_pro2', 'Коля', 'Я не плачу. Это аллергия на хороший сюжет. И да, выхожу. В 2019 выходил.');
    add('cg_pro2', 'Донат · 100 ₽', 'Закидай модеров, слабо? (￢‿￢)', { k: 'donate' });
    add('cg_pro2', 'Коля', 'Модеров? Кирилла, Райву и Эльфа? Ха. Я занят. Я в жизни не…');
    add('cg_pro3', 'Телефон', 'Напоминание: сегодня Хэллоуин! 🎃 Не забудьте костюм.', { k: 'notify' });
    add('cg_pro3', 'Коля', 'Хэллоуин?.. Сегодня?! Я с этими заказами даже не заметил, что октябрь кончился.');
    add('cg_pro3', 'Модеры 🎃', 'Кирилл: Народ, с Хэллоуином! Сидим по домам, раздаём конфеты.\nРайва: Колю не пингуем, он в своих реакциях.\nЭльф: А я ему кое-что записала (￢‿￢)', { k: 'group' });
    add('cg_pro3', 'Эльф · голосовое', '«Жалкий Коля, в день Хэллоуина записывает реакции или свои долги, вместо того чтобы праздновать. Слышь, должник, не забудь свой костюм горничной надеть. Да-да!»', { k: 'voice', voice: 1 });
    add('cg_pro4', 'Коля', '…Жалкий? Должник? Костюм горничной?!');
    add('cg_pro4', 'Коля', 'Ладно. Ладно-ладно. Чат, вы просили — вы получите. Сегодня модерам будет не сладость. Сегодня будет ГАДОСТЬ.');
    add('cg_pro5', 'Коля', 'Яйца. Туалетная бумага. Худи. Фонарик. Стрим — на паузу.');
    add('cg_pro5', 'Чат', 'ОН ВСТАЛ СО СТУЛА\nвпервые за три дня\nКоля, мы с тобой (b ᵔ▽ᵔ)b\nснимай всё на телефон!!', { k: 'chat' });
    add('cg_pro6', 'Коля', 'Сладость или гадость? Для модеров сегодня — только второе.');
    add('cg_pro6', '', 'Тыквенный переулок. 22:00. Модеры ещё не знают, что их ждёт.');
    return L; }
  function startIntro(S, only = false) { S.intro = { i: 0, t0: S.t, at: S.t, lines: introScript(), only, skipped: false, over: false }; S.dlg = null; S.phone = null; }
  function endIntro(S) { const I = S.intro; if (!I) return; if (!I.skipped) achieve(S, 'binge'); S.introDone = 1;
    if (I.only) { I.over = true; return; }
    S.intro = null; toast(S, 'Ночь начинается. Постучи модерам: «Сладость или гадость?»', 'big'); }
  function introStep(S, inp) { const I = S.intro, P2 = S.prev, ed = (k) => inp[k] && !P2[k]; S.t += DT; S.steps++;
    if (!I.over) { const sk = INTRO_SKIP, onSkip = inp.click && inp.px > sk.x && inp.px < sk.x + sk.w && inp.py > sk.y && inp.py < sk.y + sk.h;
      if (ed('esc') || onSkip) { I.skipped = true; endIntro(S); }
      else if ((ed('click') || ed('space') || ed('e') || ed('enter')) && S.t - I.at > 0.05) { I.i++; I.at = S.t; ev(S, { k: 'page' });
        const ln = I.lines[I.i]; if (ln && ln.k) ev(S, { k: 'intro_' + ln.k }); if (I.i >= I.lines.length) endIntro(S); } }
    for (const kk of ['esc', 'space', 'e', 'click', 'enter']) P2[kk] = inp[kk]; return S; }

  // ---------------- home: the way back, and the party (a visual-novel ending) ----------------
  const allMods = (S) => MODIDS.every((id) => M(S, id).done >= 0 || M(S, id).sweet);
  function homeDoor(S) {
    if (allMods(S)) { startFinale(S); return; }
    const left = MODIDS.filter((id) => !(M(S, id).done >= 0 || M(S, id).sweet)).map((id) => MODS[id].ins).join(', ');
    if (S.hp < 100) { S.hp = 100; ev(S, { k: 'candy', x: S.x, y: S.y }); toast(S, 'Забежал домой, выпил чаю: HP 100'); }
    else toast(S, `Дома тихо. Рано возвращаться: ещё не разобрался с ${left}`);
  }
  const timesWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'раз' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'раза' : 'раз');
  // the kind ending: all three forgiven (gifts) and not a single prank on any of them
  const peaceful = (S) => MODIDS.every((id) => { const k = M(S, id); return k.sweet && !k.dirty && k.done < 0 && (k.p || 0) <= 0 && !Object.keys(k.pr || {}).length; });
  function peaceScript(S) { const L = [], add = (cg, who, text) => L.push({ cg, who, text });
    add('cg_peace1', 'Коля', '…Почему у моего порога все трое? И… с пирогом?');
    add('cg_peace1', 'Кирилл', 'Ты единственный, кто сегодня ничего не закидал. Мы проверили по камерам. Даже по Райвиным.');
    add('cg_peace1', 'Райва', 'Логи чистые. Ни одного яйца. Я три раза перезапустил систему — думал, это баг.');
    add('cg_peace1', 'Эльф', 'Полицию я сегодня не вызывала. Впервые за пять лет. Непривычно.');
    add('cg_peace2', 'Кирилл', 'Короче. Совет модераторов постановил: ты — почётный модератор района. Вот корона.');
    add('cg_peace2', 'Райва', 'Права я тебе выдал. Только на чтение. Не радуйся.');
    add('cg_peace2', 'Эльф', 'И латте по пятницам. Если не начнёшь спамить.');
    add('cg_peace2', 'Коля', 'А… вечеринка? С полицией, пиццей, аукционом?');
    add('cg_peace2', 'Кирилл', 'Какой аукцион? Твои трусы в безопасности. Пока.');
    if (S.hasGun) add('cg_peace3', 'Вера', 'Коля, автомат-то внуку верни. И спасибо за тыквы!');
    if ((S.ach || {}).payback) add('cg_peace3', 'Райва', 'Правда, прохожие на тебя жаловались. Но это не к нам, это к Тимофею.');
    add('cg_peace3', 'Эльф', 'Пошли раздавать конфеты детям. Теперь это твоя работа, модератор.');
    add('cg_peace3', 'Коля', 'Самый странный Хэллоуин в моей жизни. И, кажется, самый лучший.');
    add('cg_peace3', 'Все', '«На следующий год — опять без гадостей!»');
    epilogue(S, L, 'peace');
    return L; }
  // v12: the epilogue — back in his room, the stream is live again and the chat reacts to the night
  function epilogue(S, L, kind) { const st = S.stats || {}, F = S.fest || {}, cg = kind === 'peace' ? 'cg_epi_peace' : 'cg_epi_party', add = (who, text, o = {}) => L.push(Object.assign({ cg, who, text }, o));
    add('', kind === 'peace' ? 'Утро. Комната Коли. Стрим снова в эфире.' : 'Три часа ночи. Комната Коли. Стрим снова в эфире.');
    const chat = kind === 'peace' ? ['КОЛЯ ПОМИРИЛСЯ СО ВСЕМИ??', 'святой Коля (人´∀`)', 'где гадости, я донатил за гадости'] : [`ЯИЦ БРОШЕНО: ${st.eggs || 0}!!!`, 'модеры в шоке (≧▽≦)', 'донатер с сотней — легенда'];
    if (F.carve && F.carve.place === 1) chat.push('тыква Коли победила вайфу!!!'); else if (F.carves) chat.push('видели его тыкву? это шедевр или крик о помощи?');
    if ((F.cos || []).length) chat.push('ОН ВЫБИЛ ЛЕГЕНДАРКУ'); else if (F.gacha && F.gacha.pulls) chat.push(`${F.gacha.pulls} круток и ни одной легендарки F`);
    if (S.raid && S.raid.arrests) chat.push(`его задерживали ${S.raid.arrests} раз, это контент`);
    add('Чат', chat.slice(0, 5).join('\n'), { k: 'chat' });
    add('Коля', kind === 'peace' ? 'Чат, я сегодня никого не закидал. Мне дали конфеты, латте и бан-хаммер. Это тоже контент.' : 'Чат, это был лучший стрим в моей жизни. Модеры живы. Почти.');
    add('Донат · 100 ₽', kind === 'peace' ? 'А костюм горничной где? (￢‿￢)' : 'Окупилось. Беру на следующий год ещё (b ᵔ▽ᵔ)b', { k: 'donate' });
    add('Коля', 'Ладно. Ещё одну серию — и спать. Последнюю. Честно.'); }
  function finaleScript(S) {
    if (peaceful(S)) return peaceScript(S);
    const K = S.kir, Rv = S.rai, E = S.elf, RD = S.raid, L = [], add = (cg, who, text) => L.push({ cg, who, text });
    add('menu_art', 'Коля', '…Почему у меня дома горит свет? И… музыка?');
    add('cg_party1', 'Все', '«СЮРПРИЗ!!!»');
    add('cg_party1', 'Кирилл', K.done >= 0 ? 'С Хэллоуином, Коля! Да, мой дом всё ещё в яйцах. Но вечеринка важнее.' : K.sweet ? 'С Хэллоуином! Спасибо за «Бан-хаммер». Он уже кончился, кстати.' : 'С Хэллоуином, Коля!');
    add('cg_party1', 'Райва', 'Мы тут с обеда. Пароль от твоего вайфая — «kolya123». Серьёзно?');
    add('cg_party2', 'Эльф', E.done >= 0 ? 'Не смотри так. Полицию я вызвала… ну, чтобы пригласить. Они милые.' : E.sweet ? 'Латте был божественный. Ты прощён. Почти.' : 'Привет, Коля. Костюм привидения. Нравится?');
    if (E.done >= 0) add('cg_party2', 'Эльф', 'Мой дом до сих пор в яйцах. Завтра отмываешь. Это не обсуждается.');
    add('cg_party3', 'Кирилл', K.auction > 0 ? `Лот №${K.auction}: трусы с черепами! Итого выручка — ${K.sold} ₽. Ты — хит сезона.` : K.done >= 0 ? 'Аукцион твоих трусов только стартовал. Ставки принимаются до утра (￢ω￢)' : 'Я хотел продать твои трусы на аукционе. Но ты был паинькой. Почти.');
    if (Rv.junk && Rv.junk.length) add('cg_party3', 'Райва', `Вирус я удалил. А вот «${Rv.junk[Rv.junk.length - 1].name}» уже едет к тебе. Возврату не подлежит (=^‥^=)`);
    else add('cg_party3', 'Райва', Rv.done >= 0 ? 'Мем хоть посмотрел? Котики же.' : Rv.sweet ? 'Паяльник — огонь. Уже припаял кофеварку к серверу.' : 'Я, кстати, починил тебе роутер. Пока ты гулял.');
    add('cg_party3', 'Коля', '…');
    const ar = RD ? RD.arrests : 0;
    add('cg_party4', 'Полицейский', RD ? (ar ? `Гражданин Коля, сегодня мы задерживали вас ${ar} ${timesWord(ar)}. Сейчас — только на вечеринку.` : 'Гражданин Коля, мы вас весь вечер искали. Хорошо прятались.') : 'Мы просто зашли на огонёк. Нам сказали, тут пицца.');
    add('cg_party4', 'Солдат', (K.pr.pizza || Rv.pr.pizza || E.pr.pizza) ? 'Кто-то заказал десять пицц «Пепперони». Мы решили, что это улики. Съели улики.' : 'Пиццу будешь? Улики надо уничтожить.');
    if (RD && RD.anger) add('cg_party4', 'Полицейский', 'И да. Яйцо на машине — это было смело. Глупо, но смело.');
    for (const who of Object.keys(S.loans || {})) { const Ln = S.loans[who]; if (Ln.over && !Ln.paid) add('cg_party4', '💬 ' + who, who === 'Скелет' ? 'Долг можешь не возвращать. Я уже отыгрался — помог модерам (x_x) С праздником.' : 'Я всё видел. Весь вечер. Долг прощаю. С Хэллоуином (⊙_⊙)'); }
    if (S.hasGun) add('cg_party5', 'Вера', 'Коля, автомат-то внуку верни. Он без него не может.');
    add('cg_party5', 'Коля', 'Ладно. Признаю. Это был лучший Хэллоуин.');
    add('cg_party5', 'Все', '«На следующий год — мы к тебе!»');
    epilogue(S, L, 'party');
    return L;
  }
  function startFinale(S) { const kind = peaceful(S) ? 'peace' : 'party'; if (kind === 'peace') achieve(S, 'saint');
    S.finale = { t0: S.t, i: 0, lines: finaleScript(S), end: false, over: false, kind }; S.dlg = null; S.phone = null; S.chalk = null; S.path = []; S.act = null; S.vx = S.vy = 0; S.gun = false; ev(S, { k: 'party', x: S.x, y: S.y }); }

  // ---------------- step ----------------
  function step(S, inp) {
    inp = inp || {};
    if (S.intro) return introStep(S, inp);
    const t = S.t + DT; S.t = t; S.steps++; S.gt += DT * CLOCK; if (inp.px !== undefined) S.ptr = [inp.px, inp.py];
    const P = S.prev, edge = (k) => inp[k] && !P[k];
    if (inp.setup) { S.kir.refused = true; S.target = 'kirill'; S.inv.eggs = 12; }
    if (inp.aimS) throwAt(S, 'eggs', inp.aimS);
    const cur = inp.px !== undefined ? unproj(inp.px + S.cam[0], inp.py + S.cam[1]) : null;
    const curS = inp.px !== undefined ? [inp.px + S.cam[0], inp.py + S.cam[1]] : null;     // cursor in projected (screen+cam) space
    if (S.finale) { const F = S.finale; if (edge('click') || edge('space') || edge('e') || edge('enter')) { if (F.end) F.over = true; else if (++F.i >= F.lines.length) F.end = true; F.at = S.t; ev(S, { k: 'page' }); const ln = F.lines[F.i]; if (ln && ln.k) ev(S, { k: 'intro_' + ln.k }); }
      for (const kk of ['tab', 'esc', 'space', 'e', 'rpress', 'click', 'f', 'enter', 'g']) P[kk] = inp[kk]; return S; }
    const k = S.kir;                                    // Kirill (the auction revenge below)
    if (inp.slot) S.slot = inp.slot;
    if (inp.wheel) { if (S.phone && S.phone.app === 'ach') S.phone.scroll = Math.max(0, Math.min(ACH.length - 7, (S.phone.scroll || 0) + inp.wheel));
      else if (S.phone && S.phone.app === 'chats') S.phone.scroll = Math.max(0, Math.min(chatList(S).length - 7, (S.phone.scroll || 0) + inp.wheel));
      else if (S.phone && (S.phone.app === 'dev' || S.phone.app === 'dm')) S.phone.scroll = Math.max(0, (S.phone.scroll || 0) - inp.wheel * 3);   /* v12: scroll the console / a thread back (wheel up = older) */ else S.slot = ((S.slot - 1 + inp.wheel + 10) % 10) + 1; }
    const ko = S.hp <= 0;

    // ---- UI layers: dialog, phone, chalk minigame swallow the pointer ----
    let pointerFree = !ko;
    const inR = (r) => inp.click && inp.px > r.x && inp.px < r.x + r.w && inp.py > r.y && inp.py < r.y + r.h;
    if (S.mg) { pointerFree = false; mgStep(S, inp, edge); }
    else if (S.dlg) { pointerFree = false; const lay = dlgLayout(S);
      let ci = lay.choices.findIndex(inR); if (ci < 0 && inp.slot && inp.slot <= lay.choices.length) ci = inp.slot - 1;
      if (inp.choose !== undefined) ci = inp.choose;
      if (ci >= 0 && S.dlg.choices[ci]) choose(S, S.dlg.choices[ci][1]);
      else if (edge('esc')) choose(S, 'close'); }
    else {
      if (edge('tab') || (inp.click && inR(HUD.phoneBtn))) { S.phone = S.phone ? null : { app: 'home', t: S.t, scroll: 0 }; inp = Object.assign({}, inp, { click: 0 }); }
      if (S.phone) { pointerFree = false; if (edge('esc')) S.phone = null;
        else if (inp.click) { const b = phoneLayout(S).find(inR); if (b) phoneAction(S, b.id); else if (!inR(HUD.phone)) S.phone = null; }
        if (inp.phone) phoneAction(S, inp.phone);
        if (inp.text && S.phone && S.phone.app === 'dev') { S.phone.scroll = 0; runDev(S, String(inp.text).slice(0, 200)); }
        else if (inp.text && S.phone && S.phone.app === 'dm') { S.phone.scroll = 0; dmSend(S, S.phone.who, String(inp.text).slice(0, 200)); } }
      else if (inp.click) { const si = HUD.slots.findIndex(inR); if (si >= 0) { S.slot = si + 1; pointerFree = false; } }
    }
    if (S.phone) { const ph = S.phone; if (ph.app === 'dm') { const w = ph.who; for (const m of S.msgs) if (w === GROUP ? m.group : (m.from === w && !m.group)) m.read = true; } }
    if (S.chalk) { pointerFree = false; const c = S.chalk;
      if (inp.press && curS) c.pts.forEach((p, i) => { const q = proj(p[0], p[1]); if (!c.hit[i] && Math.hypot(q[0] - curS[0], q[1] - curS[1]) < 26) c.hit[i] = 1; });
      if (t - c.t0 > 12 || c.hit.every((v) => v) || edge('esc')) { const acc = c.hit.filter(Boolean).length / c.hit.length; S.chalk = null;
        if (c.mod) { M(S, c.mod).chalk = Math.max(M(S, c.mod).chalk, acc);
          if (acc > 0.15) { PRANK.chalk[0] = Math.round(4 + 6 * acc); addPrank(S, c.mod, 'chalk'); toast(S, `Рисунок мелом: точность ${Math.round(acc * 100)} %`); }
          else toast(S, 'Рисунок не получился'); }
        else if (acc > 0.15) { S.drawings = S.drawings || []; S.drawings.push({ x: c.at[0], y: c.at[1], kind: c.kind, acc, t }); if (S.drawings.length > 12) S.drawings.shift(); achKind(S, 'chalk');
          toast(S, `Рисунок мелом: точность ${Math.round(acc * 100)} %. Прохожие оценят`); }
        else toast(S, 'Рисунок не получился');
        if (acc >= 0.9) achieve(S, 'picasso'); } }

    // ---- input → intent ----
    const ix = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), iy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    // WASD in screen directions → world: screen right = (+x,+y)/√2·…, screen down = (−x,+y)
    let wx = 0, wy = 0; if ((ix || iy) && !ko && !S.dlg && !S.chalk && !S.mg) { wx = ix * 0.5 / C - iy * 0.5 / SN; wy = ix * 0.5 / C + iy * 0.5 / SN; const l = Math.hypot(wx, wy); wx /= l; wy /= l; S.path = []; S.act = null; }
    if (inp.goto && !ko) { S.path = findPath([S.x, S.y], inp.goto); S.act = inp.gotoAct || null; }
    if (pointerFree && inp.click && cur) {
      const hit = pick(S, curS);
      if (hit) { S.act = hit; const g = hit.at; S.path = Math.hypot(g[0] - S.x, g[1] - S.y) < (hit.r || K.USE) ? [] : findPath([S.x, S.y], g); }
      else { S.act = null; const g = cur; S.path = findPath([S.x, S.y], g); ev(S, { k: 'clickmark', x: g[0], y: g[1] }); }
    }
    // ---- F: the airsoft rifle (Vera's reward) ----
    if (edge('f') && !ko && !S.dlg && !S.phone && !S.chalk) { if (!S.hasGun) toast(S, 'Автомата нет. Говорят, Вера что-то дарит за найденные тыквы…');
      else if (S.carry) toast(S, 'Руки заняты тыквой'); else { S.gun = !S.gun; ev(S, { k: S.gun ? 'gunon' : 'gunoff', x: S.x, y: S.y }); toast(S, S.gun ? 'Автомат в руках: ПКМ — стрелять, F — убрать' : 'Автомат убран'); } }
    if (S.carry) S.gun = false;
    if (edge('g') && !ko && !S.dlg && !S.phone && !S.chalk) { if (S.carry) dropCarry(S); else toast(S, 'G — положить гнилую тыкву (сейчас в руках ничего нет)'); }
    // ---- RMB / E: use the active slot ----
    const slotName = SLOTS[S.slot - 1];
    if (pointerFree && !S.chalk) {
      if (S.gun) { if (inp.rpress && curS && t >= S.gunNext) { S.gunNext = t + 0.13; fireBB(S, curS); } }
      else if (slotName === 'tp') {
        if (inp.rpress && S.charge < 0 && S.inv.tp > 0) S.charge = t;
        if (!inp.rpress && S.charge >= 0) { const pw = Math.min(1, (t - S.charge) / 1.0); S.charge = -1; if (curS) throwAt(S, 'tp', curS, pw); }
      } else if (edge('rpress') && cur) useSlot(S, slotName, cur, curS);
      const fn = edge('e') && !S.mg && !S.dlg ? festNear(S) : null;
      if (fn) festOpen(S, fn); else if (edge('e')) useSlot(S, slotName, (slotName === 'eggs' || slotName === 'tp') ? cur : null, (slotName === 'eggs' || slotName === 'tp') ? curS : null);   // E throws at the cursor too
    }
    // slime: hold E / RMB at the door
    if (S.slimeHold > 0) { const sid = S.slimeHouse || S.slimeMod || 'kirill', sh = HOUSES.find((q) => q.id === sid) || HK, isMod = !!MODS[sid], near = Math.hypot(S.x - sh.door[0], S.y - sh.door[1]) < K.USE;
      if ((inp.e || inp.rpress) && near) { const watched = isMod && watchOn(S, sid) && inYard(S.x, S.y, MODH[sid]);
        if (watched) { S.slimeWait = 1; if (!(t - (S.slimeWarnT || -9) < 3)) { S.slimeWarnT = t; toast(S, { kirill: 'Кирилл в окне — держи E и жди, пока отойдёт', raiva: 'Камера пишет — держи E и жди, пока погаснет красный', elf: 'Прожектор горит — замри и держи E, пока не погаснет' }[sid]); } }
        else { S.slimeWait = 0; S.slimeHold += DT; }
        if (S.slimeHold > 2.5) { S.slimeHold = 0; S.inv.slime--; achKind(S, 'slime'); ev(S, { k: 'slime', id: sid, x: sh.door[0], y: sh.door[1] }); toast(S, 'Ручка двери в слайме 🟢');
          if (isMod) { M(S, sid).slime = 1; M(S, sid).slimeAt = t + 7 + 5 * h1(S.steps * 0.41); addPrank(S, sid, 'slime'); }
          else { S.hslime = S.hslime || {}; S.hslime[sid] = 1; hsay(S, sid, NB.slime[sid] || 'Фу! Ручка липкая!', t + 6 + 4 * h1(S.steps * 0.41), 'slimetouch'); } } }
      else { S.slimeHold = 0; S.slimeWait = 0; } }
    if (edge('space') && !ko) { const hs = nearHidingSpot(S.x, S.y, S); if (hs) { S.hidden = !S.hidden; S.hideAt = [hs[1], hs[2], hs[0]]; ev(S, { k: S.hidden ? 'hide' : 'unhide', x: hs[1], y: hs[2] }); if (S.hidden) { S.path = []; } } else toast(S, 'Спрятаться можно в кустах или за мусорным баком'); }

    // ---- movement ----
    let mvx = 0, mvy = 0; S.runA += ((inp.run && !S.carry ? 1 : 0) - S.runA) * Math.min(1, 6 * DT); const sp = (K.WALK + (K.RUN - K.WALK) * S.runA) * (S.carry === 'rotten' ? K.WALK_CARRY : 1) * ((S.sugarT || -99) > t ? 1.25 : 1);
    if (ko || S.dlg || S.mg || (S.wrapT || -99) > t) { S.path = []; wx = wy = 0; }                                // wrapped in TP by an angry passer-by: stuck for a moment
    if (wx || wy) { mvx = wx * sp; mvy = wy * sp; S.hidden = false; }
    else if (S.path.length) { const [gx, gy] = S.path[0], dx = gx - S.x, dy = gy - S.y, d = Math.hypot(dx, dy);
      if (d < 8) S.path.shift(); else { mvx = dx / d * sp; mvy = dy / d * sp; S.hidden = false; } }
    const a = Math.min(1, 14 * DT); S.vx += (mvx - S.vx) * a; S.vy += (mvy - S.vy) * a;
    if (S.hidden) { S.vx = 0; S.vy = 0; }
    const ox = S.x, oy = S.y; S.x += S.vx * DT; S.y += S.vy * DT; if (!(S.mg && S.mg.k === 'stage')) collide(S);
    const moved = Math.hypot(S.x - ox, S.y - oy);
    if (moved > 0.02) { const spd = Math.hypot(S.vx, S.vy), stride = K.STRIDE + (K.RSTRIDE - K.STRIDE) * Math.max(0, Math.min(1, (spd - K.WALK) / (K.RUN - K.WALK))); S.stride = stride;
      const b = Math.floor(S.gph * 2); S.dist += moved; S.gph += moved / stride; if (Math.floor(S.gph * 2) !== b) ev(S, { k: 'step', x: S.x, y: S.y, foot: Math.floor(S.gph * 2) & 1 }); }
    // facing: a smoothed screen angle — toward the motion, else toward the mouse (play), locked toward a throw target for a moment
    { let tgt = null; const spd = Math.hypot(S.vx, S.vy), a0 = S.ang;
      if (S.faceLock > t) tgt = S.lockAng; else if (spd > 30) tgt = scrAng(S.vx, S.vy); else if (inp.px !== undefined && !S.dlg && !S.phone && !S.chalk) { const hp = proj(S.x, S.y, 60); tgt = Math.atan2(inp.py + S.cam[1] - hp[1], inp.px + S.cam[0] - hp[0]); }
      // the body turns at a constant rate in its own yaw on the ground (2:1 iso: tan(screen angle) = tan(yaw) / 2), so the 16 drawn
      // directions go by evenly (turning in screen angle made the front / back views crawl at ~10 changes per second)
      if (S.yaw === undefined) S.yaw = Math.atan2(2 * Math.sin(S.ang), Math.cos(S.ang));
      const yaw0 = S.yaw;
      if (tgt !== null) { S.yaw = turnTo(S.yaw, Math.atan2(2 * Math.sin(tgt), Math.cos(tgt)), K.TURNY * DT); S.ang = Math.atan2(Math.sin(S.yaw), 2 * Math.cos(S.yaw)); }
      S.face = [Math.cos(S.ang) >= 0 ? 1 : -1, Math.sin(S.ang) >= 0 ? 1 : -1];
      const dist = (i) => Math.abs(((S.ang - KVIEWS[i][1] + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
      let bi = 0; for (let i = 1; i < KVIEWS.length; i++) if (dist(i) < dist(bi)) bi = i; if (S.vi === undefined || dist(bi) + 0.1 < dist(S.vi)) S.vi = bi;
      // 16 walk / idle directions by the body's yaw on the ground (2:1 iso: tan(screen angle) = tan(yaw) / 2), with hysteresis;
      // d16p + d16t let the renderer crossfade the previous direction for a moment
      const phi = S.yaw, st = Math.PI / 8, wrap = (x) => ((x + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      const nb = ((Math.round(phi / st) % 16) + 16) % 16;
      if (S.d16 === undefined) { S.d16 = nb; S.d16p = nb; S.d16t = -9; }
      else if (nb !== S.d16 && Math.abs(wrap(phi - S.d16 * st)) > st / 2 + 0.06) { S.d16p = S.d16; S.d16 = nb; S.d16t = t; }
      { const s2 = Math.PI / 16, n2 = ((Math.round(phi / s2) % 32) + 32) % 32;                // 32 directions (where the in-between sheets exist)
        if (S.d32 === undefined) { S.d32 = n2; S.d32p = n2; S.d32t = -9; } else if (n2 !== S.d32 && Math.abs(wrap(phi - S.d32 * s2)) > s2 / 2 + 0.03) { S.d32p = S.d32; S.d32 = n2; S.d32t = t; } }
      // turning on the spot: the feet step around (a quarter turn = one step) instead of the body spinning on frozen legs
      const dA = Math.abs(wrap(S.yaw - yaw0)); S.yawV = wrap(S.yaw - yaw0) / DT;
      if (spd < 30 && !S.hidden && !ko) { S.turnA += ((dA / DT > 1.2 ? 1 : 0) - S.turnA) * Math.min(1, 12 * DT);
        if (S.turnA > 0.05) { const b = Math.floor(S.gph * 2); S.gph += dA / Math.PI + (S.turnA > 0.5 ? 0.6 * DT : 0); if (Math.floor(S.gph * 2) !== b) ev(S, { k: 'step', x: S.x, y: S.y, foot: Math.floor(S.gph * 2) & 1, soft: 1 }); } }
      else S.turnA = 0; }
    if (S.path.length === 0 && S.act) doAct(S);

    // ---- pickups by walking ----
    MONEY.forEach(([mx, my, amt, where], i) => { if (S.got[i] >= 0 || where === 'pile') return; if (Math.hypot(mx - S.x, my - S.y) < (where === 'bench' ? 70 : 50)) { S.got[i] = t; S.money += amt; ev(S, { k: 'coin', amt, x: mx, y: my }); } });
    PILES.forEach(([px, py], i) => { if (Math.hypot(px - S.x, py - S.y) < 55 && Math.hypot(S.vx, S.vy) > 60 && (S.piles[i] < 0 || t - S.piles[i] > 25)) { S.piles[i] = t; ev(S, { k: 'pile', i, x: px, y: py });
      const mi = MONEY.findIndex(([mx, my, , w]) => w === 'pile' && mx === px && my === py); if (mi >= 0 && S.got[mi] < 0) { S.got[mi] = t; S.money += MONEY[mi][2]; ev(S, { k: 'coin', amt: MONEY[mi][2], x: px, y: py }); } } });
    VPUMPKINS.forEach(([vx, vy], i) => { if (S.vp[i] < 0 && S.q.vera >= 1 && Math.hypot(vx - S.x, vy - S.y) < 60) { S.vp[i] = t; ev(S, { k: 'pickup', x: vx, y: vy }); toast(S, `Тыква Веры найдена (${S.vp.filter((v) => v >= 0).length}/3)`); } });
    if (S.strange < 0 && Math.hypot(STRANGE[0] - S.x, STRANGE[1] - S.y) < 170) { S.strange = t; S.q.strange = 1; S.money += 100; S.inv.flyers += 0;
      toast(S, 'Странные огни: старая гирлянда и паяльник… Тут явно бывает Райва. (+100 ₽)', 'big'); msg(S, 'Райва', 'Ты что, у моего гаража шаришься? (･_･ )'); }

    // ---- NPCs ----
    S.npc.forEach((n) => { const def = NPCS[n.i];
      n.gA = (n.gA || 0) + ((n.mv ? 1 : 0) - (n.gA || 0)) * Math.min(1, 7 * DT); n.mv = 0;                 // gait amount eases in/out (no pops)
      if ((n.stunT || -99) > t) { n.ang += DT * 7 * Math.sin(t * 8 + n.i); n.face = [Math.cos(n.ang) >= 0 ? 1 : -1, Math.sin(n.ang) >= 0 ? 1 : -1]; return; }   // deafened by a firecracker
      if (n.rev) { npcRevenge(S, n, def); return; }
      if (def.stat) { const hp = proj(n.x, n.y), kp = proj(S.x, S.y); n.ang = turnTo(n.ang, Math.atan2(kp[1] - hp[1], kp[0] - hp[0]), 3 * DT); n.face = [Math.cos(n.ang) >= 0 ? 1 : -1, Math.sin(n.ang) >= 0 ? 1 : -1]; return; }
      if (S.act && S.act.k === 'npc' && S.act.id === n.id) { n.pause = Math.max(n.pause, 0.6); if (S.path.length) S.path[S.path.length - 1] = [n.x, n.y + 50]; }
      const setFace = () => { n.face = [Math.cos(n.ang) >= 0 ? 1 : -1, Math.sin(n.ang) >= 0 ? 1 : -1]; };
      if (n.pause > 0) { n.pause -= DT; if (t - n.talkT < 3.4) { const hp = proj(n.x, n.y), kp = proj(S.x, S.y); n.ang = turnTo(n.ang, Math.atan2(kp[1] - hp[1], kp[0] - hp[0]), 6 * DT); }
        else { const r = def.route, g = r[n.k]; n.ang = turnTo(n.ang, scrAng(g[0] - n.x, g[1] - n.y), 4 * DT); } setFace(); return; }
      if (n.back) { if (npcMove(S, n, def.route[n.k], def.v * 1.4)) n.back = 0; return; }                 // back to the route after a revenge (around walls)
      const r = def.route, g = r[n.k], dx = g[0] - n.x, dy = g[1] - n.y, d = Math.hypot(dx, dy);
      if (d < 6) { n.k = (n.k + 1) % r.length; n.pause = 1.2 + 2 * h1(n.i + n.k + Math.floor(t / 9)); return; }
      const want = scrAng(dx, dy), da = Math.abs(((want - n.ang + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI);
      n.ang = turnTo(n.ang, want, 5 * DT); setFace(); if (da > 0.6) return;                                   // turn on the spot first
      const v = def.v; n.x += dx / d * v * DT; n.y += dy / d * v * DT; n.walk += v * DT; n.gph = (n.gph || 0) + v * DT / K.NSTRIDE; n.mv = 1;
      PILES.forEach(([px, py], i) => { if (Math.hypot(px - n.x, py - n.y) < 45 && (S.piles[i] < 0 || t - S.piles[i] > 6)) { S.piles[i] = t; ev(S, { k: 'pile', i, x: px, y: py, npc: 1 }); } }); });

    // ---- moderators ----
    for (const id of MODIDS) modStep(S, id);
    elfSensor(S);
    // ---- revenge: Elf calls the police and the army; they search the street till the end of the night ----
    const ef = S.elf;
    if (ef.revengeAt >= 0 && S.gt >= ef.revengeAt) { ef.revengeAt = -1; ef.st = 'out'; ef.t0 = t + 4; msg(S, 'Эльф', 'Коля, тебе пизда, зайка (づ￣ ³￣)づ🚓'); ev(S, { k: 'elfcall', x: HE.door[0], y: HE.door[1] });
      toast(S, 'Месть Эльфа началась…', 'big'); S.raid = newRaid(S); }
    if (!S.raid) DYN.length = 0; raidStep(S);
    contactsStep(S); festStep(S);
    if (!S.q.home && allMods(S)) { S.q.home = 1; if (peaceful(S)) msg(S, 'Эльф', 'Коля, зайди домой. Мы тебя ждём. Без подвоха, честно. Ну, почти (´ ε ` )♡'); else msg(S, 'Неизвестный номер', 'Коля, зайди домой. Срочно. 🎃'); toast(S, 'Все модеры обойдены! Возвращайся домой', 'big'); }
    // ---- projectiles ----
    S.proj = S.proj.filter((p) => { const u = (t - p.t0) / p.dur; if (u < 1) return true; landProj(S, p); return false; });
    // ---- courier (pizza) and kids (flyers) ----
    courierStep(S); kidsStep(S); fireStep(S); decoyStep(S); houseStep(S); catStep(S); weatherStep(S);
    if (S.q.talk >= 5) achieve(S, 'social'); if (S.q.vera === 2) achieve(S, 'grandson');
    // ---- revenge: Kirill's auction ----
    if (k.revengeAt >= 0 && S.gt >= k.revengeAt) { k.revengeAt = -1; msg(S, 'Кирилл', 'Я украл ВСЕ твои трусы 🩲 и запускаю онлайн-аукцион среди своих подписчиков. Ставки открыты ( ˘ ▽˘)'); k.nextAuction = S.gt + 600; toast(S, 'Месть Кирилла началась…', 'big'); }
    if (k.nextAuction >= 0 && S.gt >= k.nextAuction) { k.auction++; k.nextAuction = S.gt + 600; const lot = ['с черепами', 'в горошек', 'с котиками', 'любимые, счастливые', 'новогодние', 'с надписью «Пятница»', 'дырявые'][k.auction % 7];
      const price = 300 + Math.floor(h1(k.auction * 3.3) * 4700); k.sold += price;
      msg(S, 'Кирилл', `Лот №${k.auction}: трусы Коли ${lot} — проданы за ${price} ₽ ( ˘ ▽˘) Деньги, конечно, оставлю себе.`); }
    // ---- revenge: Raiva's «КотоМем» virus (opened from the chat → downloads → glitches, shrieks, buys junk) ----
    const r = S.rai;
    if (r.revengeAt >= 0 && S.gt >= r.revengeAt) { r.revengeAt = -1; r.virus = { st: 'pending' }; msg(S, 'Райва', 'Ты закидал мой дом, а я сисадмин. Держи мем в знак примирения (=^･ω･^=) [КотоМем.apk]'); toast(S, 'Месть Райвы началась… (проверь чаты)', 'big'); }
    if (r.virus) { const v = r.virus;
      if (v.st === 'download' && t - v.t0 > 3.2) { v.st = 'active'; v.t1 = t; r.nextBuy = S.gt + 180; r.nextNoise = t + 18 + 12 * h1(S.steps * 0.37); ev(S, { k: 'virus', kind: 'glitch', x: S.x, y: S.y });
        msg(S, 'КотоМем 2.0', 'Установка завершена! Теперь ваш телефон под защитой котиков (=^‥^=)(=^‥^=)(=^‥^=)'); }
      if (v.st === 'active') {
        if (S.gt >= r.nextBuy) { r.nextBuy = S.gt + 180; const it = JUNK[Math.floor(h1(r.junk.length * 7.31 + 2) * JUNK.length)]; S.money -= it[1]; r.junk.push({ name: it[0], price: it[1], gt: S.gt });
          msg(S, 'Неожиданные находки', `Спасибо за покупку! «${it[0]}» — списано ${it[1]} ₽ (=^･ω･^=)`); ev(S, { k: 'buy', x: S.x, y: S.y }); }
        if (t >= r.nextNoise) { const kinds = ['horn', 'siren', 'meow', 'modem'], kind = kinds[Math.floor(h1(S.steps * 0.71) * 4)]; r.nextNoise = t + 25 + 30 * h1(S.steps * 1.3);
          ev(S, { k: 'virus', kind, x: S.x, y: S.y }); toast(S, VNOISE[kind]);
          for (const id of MODIDS) { const mk = M(S, id); if (inYard(S.x, S.y, MODH[id]) && !S.hidden && mk.refused && mk.done < 0) { mk.p = Math.max(0, mk.p - 5); toast(S, `${MODS[id].name} услышал телефон из-за двери: −5 %`); } }
          S.npc.forEach((n) => { if (Math.hypot(n.x - S.x, n.y - S.y) < 500 && !NPCS[n.i].stat) { n.talkT = t; n.line = ['Это что сейчас было?!', 'У тебя телефон орёт!', 'Выключи это!'][n.i % 3]; n.pause = 2.4; } }); } } }
    // ---- camera: follow Kolya (projected), slight look-ahead ----
    const hp = proj(S.x, S.y), tx = hp[0] - VIEW.W / 2 + S.vx * 0.25, ty = hp[1] - VIEW.H / 2 - 50 + S.vy * 0.15;
    S.camV[0] += (28 * (tx - S.cam[0]) - 10.5 * S.camV[0]) * DT; S.cam[0] += S.camV[0] * DT;
    S.camV[1] += (28 * (ty - S.cam[1]) - 10.5 * S.camV[1]) * DT; S.cam[1] += S.camV[1] * DT;
    S.toasts = S.toasts.filter((q) => t - q.t < (q.kind === 'big' ? 5 : 4));
    for (const kk of ['tab', 'esc', 'space', 'e', 'rpress', 'click', 'f', 'enter', 'g', 'up', 'down', 'left', 'right']) P[kk] = inp[kk];
    return S;
  }

  // render interpolation (index.html): snapshot before a step, then draw between the last two steps (no judder at any refresh rate)
  const angD = (d) => ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const snap = (S) => ({ steps: S.steps, t: S.t, gt: S.gt, cam: S.cam.slice(), x: S.x, y: S.y, gph: S.gph, ang: S.ang, yaw: S.yaw || 0, dist: S.dist,
    npc: S.npc.map((n) => [n.x, n.y, n.gph || 0, n.ang, n.gA || 0]), cour: S.courier ? [S.courier.x, S.courier.y, S.courier.gph || 0, S.courier.ang || 0] : null,
    kids: S.kids && S.kids.list ? S.kids.list.map((q) => [q.x, q.y, q.gph, q.ang]) : null,
    raid: S.raid ? { u: S.raid.units.map((q) => [q.x, q.y, q.gph, q.ang, q.wa]), c: S.raid.cars.map((c) => c.x) } : null });
  function lerpState(P0, S, a) {
    if (!P0 || P0.steps !== S.steps - 1) return S; a = Math.max(0, Math.min(1, a)); const l = (p, q) => p + (q - p) * a, la = (p, q) => p + angD(q - p) * a;
    const R = Object.assign({}, S, { t: l(P0.t, S.t), gt: l(P0.gt, S.gt), cam: [l(P0.cam[0], S.cam[0]), l(P0.cam[1], S.cam[1])], x: l(P0.x, S.x), y: l(P0.y, S.y), gph: l(P0.gph, S.gph), ang: la(P0.ang, S.ang), yaw: la(P0.yaw, S.yaw || 0), dist: l(P0.dist, S.dist) });
    R.npc = S.npc.map((n, i) => { const p = P0.npc[i]; return p ? Object.assign({}, n, { x: l(p[0], n.x), y: l(p[1], n.y), gph: l(p[2], n.gph || 0), ang: la(p[3], n.ang), gA: l(p[4], n.gA || 0) }) : n; });
    if (S.courier && P0.cour) { const c = S.courier, p = P0.cour; R.courier = Object.assign({}, c, { x: l(p[0], c.x), y: l(p[1], c.y), gph: l(p[2], c.gph || 0), ang: la(p[3], c.ang || 0) }); }
    if (S.kids && S.kids.list && P0.kids && P0.kids.length === S.kids.list.length) R.kids = Object.assign({}, S.kids, { list: S.kids.list.map((q, i) => { const p = P0.kids[i]; return Object.assign({}, q, { x: l(p[0], q.x), y: l(p[1], q.y), gph: l(p[2], q.gph), ang: la(p[3], q.ang) }); }) });
    if (S.raid && P0.raid && P0.raid.u.length === S.raid.units.length) R.raid = Object.assign({}, S.raid, {
      units: S.raid.units.map((q, i) => { const p = P0.raid.u[i]; return Object.assign({}, q, { x: l(p[0], q.x), y: l(p[1], q.y), gph: l(p[2], q.gph), ang: la(p[3], q.ang), wa: la(p[4], q.wa) }); }),
      cars: S.raid.cars.map((c, i) => Object.assign({}, c, { x: l(P0.raid.c[i], c.x) })) });
    return R; }

  // what is under the cursor (screen-space hit boxes on projected positions)
  function pick(S, c) {
    const hitPt = (x, y, w, h, z = 0) => { const q = proj(x, y); return c[0] > q[0] - w / 2 && c[0] < q[0] + w / 2 && c[1] > q[1] - h - z && c[1] < q[1] + 10 - z; };
    for (const n of S.npc) if (hitPt(n.x, n.y, 70, 130)) return { k: 'npc', id: n.id, at: [n.x, n.y + 50], r: K.TALK };
    for (const id of MODIDS) { const h = MODH[id]; if (hitPt(h.door[0], FACADE, 120, 200)) return { k: 'door', id, at: [h.door[0], FACADE + 60], r: K.USE }; }
    for (const h of HOUSES) if (!MODS[h.id] && hitPt(h.door[0], FACADE, 110, 190)) return { k: 'door2', id: h.id, at: [h.door[0], FACADE + 60], r: K.USE };
    for (let i = 0; i < MONEY.length; i++) { const [mx, my, , w] = MONEY[i]; if (S.got[i] < 0 && w !== 'pile' && hitPt(mx, my, 70, 60)) return { k: 'money', i, at: [mx, my], r: 40 }; }
    for (let i = 0; i < VPUMPKINS.length; i++) if (S.vp[i] < 0 && S.q.vera >= 1 && hitPt(VPUMPKINS[i][0], VPUMPKINS[i][1], 70, 70)) return { k: 'vp', i, at: VPUMPKINS[i], r: 50 };
    for (let i = 0; i < ROTTENS.length; i++) if (!S.rottenGot[i] && hitPt(ROTTENS[i][0], ROTTENS[i][1], 80, 70)) return { k: 'rotten', i, at: ROTTENS[i], r: 70 };
    for (let i = 0; i < (S.drops || []).length; i++) { const d = S.drops[i]; if (hitPt(d.x, d.y, 80, 70)) return { k: 'drop', i, at: [d.x, d.y], r: 70 }; }
    if (S.cat && hitPt(S.cat.x, S.cat.y, 70, 60)) return { k: 'cat', at: [S.cat.x, S.cat.y], r: 80 };
    for (const st of FSTALLS) if (hitPt(st[2], st[3], st[5] * 0.8, st[5] * (st[1] === 'gacha' ? 1.5 : 0.85))) return { k: 'fest', id: st[1], at: festAt(st), r: 120 };
    if (hitPt(BOWL[0], BOWL[1], 70, 60)) return { k: 'bowl', at: [BOWL[0], BOWL[1] + 40], r: 90 };
    for (let i = 0; i < BINS.length; i++) { const [bx, by] = BINS[i]; if (bx > ALLEY[0] && bx < ALLEY[2] && by < -1000) continue; if (hitPt(bx, by, 70, 90)) return { k: 'bin', i, at: [bx, by + 45], r: 85 }; }
    return null;
  }
  function doAct(S) {
    const a = S.act; S.act = null; if (S.hp <= 0) return;
    const d = Math.hypot(a.at[0] - S.x, a.at[1] - S.y);
    if (d > (a.r || K.USE) + 40) return;
    if (a.k === 'npc') { const n = S.npc.find((q) => q.id === a.id); if (n) talkNpc(S, n); }
    else if (a.k === 'door') openMod(S, a.id || 'kirill');
    else if (a.k === 'door2' && a.id === 'kolya') homeDoor(S);
    else if (a.k === 'door2') { const h = HOUSES.find((q) => q.id === a.id), r = { vera: 'Вера на крыльце, постучи ей лично.', a: 'Петровы дают по одной ириске. Ну, хоть так.', b: 'Смирновы спят. Свет не горит… почти.' }[a.id];
      toast(S, `${h.name}: ${r}`); if (a.id === 'a') { S.money += 5; ev(S, { k: 'coin', amt: 5, x: S.x, y: S.y }); } }
    else if (a.k === 'money') { if (S.got[a.i] < 0) { S.got[a.i] = S.t; S.money += MONEY[a.i][2]; ev(S, { k: 'coin', amt: MONEY[a.i][2], x: a.at[0], y: a.at[1] }); } }
    else if (a.k === 'vp') { if (S.vp[a.i] < 0) { S.vp[a.i] = S.t; ev(S, { k: 'pickup', x: a.at[0], y: a.at[1] }); } }
    else if (a.k === 'rotten') { if (S.carry) { toast(S, 'Руки заняты: одна гнилая тыква за раз'); return; } S.rottenGot[a.i || 0] = true; S.carry = 'rotten'; S.slot = 4; ev(S, { k: 'pickup', x: a.at[0], y: a.at[1] });
      toast(S, 'Гнилая тыква в руках. Тяжёлая и вонючая. Неси на крыльцо модеру. (G — положить)'); }
    else if (a.k === 'drop') { const d = (S.drops || [])[a.i]; if (!d) return; if (S.carry) { toast(S, 'Руки заняты: одна гнилая тыква за раз'); return; }
      S.drops.splice(a.i, 1); S.carry = 'rotten'; S.slot = 4; S.gun = false; ev(S, { k: 'pickup', x: d.x, y: d.y }); toast(S, 'Снова гнилая тыква в руках (G — положить)'); }
    else if (a.k === 'cat') petCat(S);
    else if (a.k === 'bowl') takeCandy(S);
    else if (a.k === 'fest') festOpen(S, a.id);
    else if (a.k === 'bin') kickBin(S, a.i);
  }
  // ---- Vera's candy bowl: a sweet takes the edge off (+8 HP, 15 s of a sugar rush); greed annoys Vera ----
  function takeCandy(S) { const b = S.bowl = S.bowl || { n: 0, t: -99 }, t = S.t, vera = S.npc.find((q) => q.id === 'vera'); if (t - b.t > 120) b.n = 0; b.n++; b.t = t;
    if (b.n <= 2) { S.hp = Math.min(100, S.hp + 8); S.sugarT = t + 15; ev(S, { k: 'candy', x: BOWL[0], y: BOWL[1] }); toast(S, 'Конфета из миски Веры: +8 HP и сахарный разгон на 15 с 🍬');
      if (vera) npcSay(S, vera, b.n === 1 ? 'Бери-бери, Коля! Только одну.' : 'Ещё одну? Ну ладно, праздник же…'); return; }
    if (vera) { npcSay(S, vera, b.n === 3 ? 'Коля! Совесть есть? Это для детей!' : 'Миска пустая. И это всё ты!'); anger(S, vera, 1.5); }
    toast(S, b.n === 3 ? 'Вера смотрит очень строго…' : 'Миска пуста. Вера в гневе'); }
  // ---- kick a garbage bin over: a crash the patrol hears (and you can't hide in it for a while) ----
  function kickBin(S, i) { S.binsDown = S.binsDown || {}; const t = S.t, [bx, by] = BINS[i];
    if (t - (S.binsDown[i] ?? -99) < 60) { toast(S, 'Бак и так лежит'); return; }
    S.binsDown[i] = t; ev(S, { k: 'binkick', i, x: bx, y: by }); toast(S, 'БАБАМ! Бак с грохотом опрокинут');
    S.npc.forEach((n) => { if (Math.hypot(n.x - bx, n.y - by) < 520 && !NPCS[n.i].stat) npcSay(S, n, pickL(['Кто мусорку уронил?!', 'Фу, ну и запах!', 'Хулиганьё!'], t + n.i)); });
    if (S.raid && S.raid.st === 'search') S.raid.units.forEach((u) => { if (u.st !== 'chase' && Math.hypot(u.x - bx, u.y - by) < 1000) { u.st = 'alert'; u.alertAt = [bx, by + 40]; u.goal = null; } });
    if (S.cat && Math.hypot(S.cat.x - bx, S.cat.y - by) < 500) catScare(S, bx, by); }
  // ---- the black cat: wanders between its haunts; pet it and it follows you for 40 s, hissing when the patrol comes near ----
  function petCat(S) { const c = S.cat; if (!c) return; c.purr = S.t; c.follow = S.t + 40; c.st = 'follow'; ev(S, { k: 'purr', x: c.x, y: c.y }); toast(S, 'Кот мурлычет и идёт за тобой. Он чует патруль раньше тебя 🐈‍⬛'); }
  function catScare(S, x, y) { const c = S.cat; c.st = 'flee'; c.fx = x; c.fy = y; c.t0 = S.t; c.follow = -99; ev(S, { k: 'meow', x: c.x, y: c.y }); }
  function catStep(S) { const c = S.cat; if (!c) return; const t = S.t; c.mv = 0;
    const go = (g, v) => { const dx = g[0] - c.x, dy = g[1] - c.y, d = Math.hypot(dx, dy); if (d < 6) return true; const st = Math.min(d, v * DT); c.x += dx / d * st; c.y += dy / d * st;
      c.ang = turnTo(c.ang, scrAng(dx, dy), 10 * DT); c.gph += st / 34; c.mv = v > 150 ? 2 : 1; return false; };
    if (c.st === 'flee') { const dx = c.x - c.fx, dy = c.y - c.fy, d = Math.hypot(dx, dy) || 1; go([c.x + dx / d * 80, Math.max(-330, Math.min(330, c.y + dy / d * 80))], 300); if (t - c.t0 > 1.8) { c.st = 'walk'; c.pause = 0; } return; }
    if (c.follow > t) { c.st = 'follow'; const back = fwd(S, -60), d = Math.hypot(back[0] - c.x, back[1] - c.y);
      if (d > 50) go(back, Math.min(260, 60 + d * 1.6)); else { const hp = proj(c.x, c.y), kp = proj(S.x, S.y); c.ang = turnTo(c.ang, Math.atan2(kp[1] - hp[1], kp[0] - hp[0]), 4 * DT); }
      if (S.raid && S.raid.st === 'search' && t - c.hiss > 7 && S.raid.units.some((u) => u.st !== 'chase' && Math.hypot(u.x - S.x, u.y - S.y) < 650)) { c.hiss = t; ev(S, { k: 'hiss', x: c.x, y: c.y }); toast(S, 'Кот шипит: патруль где-то рядом!'); }
      return; }
    if (c.st === 'follow') { c.st = 'walk'; c.pause = 1; ev(S, { k: 'meow', x: c.x, y: c.y }); }
    if (c.pause > 0) { c.pause -= DT; return; }
    if (go(CATSPOTS[c.k % CATSPOTS.length], 95)) { c.k = (c.k * 7 + 3) % CATSPOTS.length; c.pause = 2 + 5 * h1(t * 0.13 + c.k); } }
  // ---- aiming: houses and trees are hit-tested on their sprites' coarse alpha masks (anchors.js), else the ground ----
  if (typeof module !== 'undefined' && !root.ANCH) { try { require('./anchors.js'); } catch (e) {} }
  const AN = () => root.ANCH || {};
  function houseRect(h) { const an = AN()[h.tex]; if (!an || !an.gw) return null; const k = 405 / an.gw, c = proj(h.x0, h.y1); return { x: c[0] - an.cx * k, y: c[1] - an.cy * k + 6, w: an.w * k, h: an.h * k, k, an }; }
  function treeRect(i) { const [x, y, s] = TREES[i], n = i % 2 ? 'tree_b' : 'tree_a', an = AN()[n]; if (!an || !an.w) return null; const hh = (n === 'tree_a' ? 340 : 400) * s, ww = hh * an.w / an.h, q = proj(x, y);
    return { x: q[0] - ww * 0.51, y: q[1] - hh + 10, w: ww, h: hh, an, n }; }
  const carRect = (i) => { const an = AN()[i % 2 ? 'car_b' : 'car_a']; if (!an || !an.mask) return null; const q = proj(CARS[i][0], CARS[i][1]), hh = 360 * an.h / an.w; return { x: q[0] - 180, y: q[1] - hh * 0.62, w: 360, h: hh, an }; };
  const maskHit = (r, c) => { if (!r || c[0] < r.x || c[1] < r.y || c[0] > r.x + r.w || c[1] > r.y + r.h) return null; const u = (c[0] - r.x) / r.w, v = (c[1] - r.y) / r.h, m = r.an.mask;
    if (!m) return [u, v]; const row = m.rows[Math.floor(v * m.h / m.cell)]; return row && row[Math.floor(u * m.w / m.cell)] === '1' ? [u, v] : null; };
  const THROW_R = 1350;
  // the scene's draw order (separating axis on world AABBs): > 0 when a is drawn over b
  const nearer = (a, b) => { if (a[2] <= b[0]) return 1; if (b[2] <= a[0]) return -1; if (a[3] <= b[1]) return -1; if (b[3] <= a[1]) return 1; return ((a[1] + a[3]) - (a[0] + a[2])) - ((b[1] + b[3]) - (b[0] + b[2])); };
  function aimTarget(S, c) {                        // c: a point in projected (screen + camera) space; the topmost drawn sprite under it wins
    let best = null; const take = (cand) => { if (!best || nearer(cand.box, best.box) > 0) best = cand; };
    TREES.forEach((t, i) => { const hit = maskHit(treeRect(i), c); if (hit) take({ kind: 'tree', i, u: hit[0], v: hit[1], box: [t[0] - 30 * t[2], t[1] - 30 * t[2], t[0] + 30 * t[2], t[1] + 30 * t[2]], ground: [t[0], t[1]] }); });
    HOUSES.forEach((h) => { const hit = maskHit(houseRect(h), c); if (hit) { const xf = Math.max(h.x0, Math.min(h.x1, c[0] / C - h.y1));
      take({ kind: 'house', id: h.id, u: hit[0], v: hit[1], box: [h.x0, h.y0, h.x1, h.y1], ground: [xf, h.y1] }); } });
    const person = (kind, id, x, y, hg = 125) => { const q = proj(x, y); if (c[0] > q[0] - 30 && c[0] < q[0] + 30 && c[1] > q[1] - hg && c[1] < q[1] + 8)
      take({ kind, id, box: [x - 15, y - 15, x + 15, y + 15], ground: [x, y], u: (c[0] - q[0] + 30) / 60, v: (c[1] - q[1] + hg) / (hg + 8) }); };
    S.npc.forEach((n) => person('npc', n.id, n.x, n.y));
    if (S.courier) person('courier', 0, S.courier.x, S.courier.y);
    const vcar = (kind, id, x, y) => { const q = proj(x, y); if (c[0] > q[0] - 175 && c[0] < q[0] + 175 && c[1] > q[1] - 140 && c[1] < q[1] + 55)
      take({ kind, id, box: [x - 150, y - 62, x + 150, y + 62], ground: [x, y], u: (c[0] - q[0] + 175) / 350, v: (c[1] - q[1] + 140) / 195 }); };
    CARS.forEach(([x, y], i) => { const r = carRect(i); if (!r) { vcar('scar', i, x, y); return; } const hit = maskHit(r, c);          // v10: the whole painted body counts (rear and front alike)
      if (hit) take({ kind: 'scar', id: i, box: [x - 150, y - 62, x + 150, y + 62], ground: [x, y], u: hit[0], v: hit[1], mask: 1 }); });
    if (S.gun) LAMPS.forEach(([x, y], i) => { const q = proj(x, y); if (Math.hypot(c[0] - q[0] - LAMPHEAD[0], c[1] - q[1] + LAMPHEAD[1]) < 26) take({ kind: 'lamp', i, box: [x - 14, y - 14, x + 14, y + 14], ground: [x, y] }); });   // shoot a lamp out
    if (S.raid && S.raid.st !== 'wait') { S.raid.units.forEach((u) => person('unit', u.i, u.x, u.y, 132)); S.raid.crowd.forEach((q, i) => person('crowd', i, q.x, q.y)); S.raid.cars.forEach((cr, i) => vcar('rcar', i, cr.x, cr.y)); }
    if (!best) best = { kind: 'ground', ground: unproj(c[0], c[1]) };
    best.c = c; best.dist = Math.hypot(best.ground[0] - S.x, best.ground[1] - S.y); best.ok = best.dist <= THROW_R; return best;
  }
  // throw an egg or a TP roll exactly at the projected point c (the cursor): it lands where the cursor is
  function throwAt(S, kind, c, pw = 1) {
    if (kind === 'eggs' && S.inv.eggs <= 0) { toast(S, 'Яйца закончились. Магазин в телефоне (Tab)'); return; }
    if (kind === 'tp' && S.inv.tp <= 0) { toast(S, 'Нет туалетной бумаги. Магазин в телефоне (Tab)'); return; }
    const tg = aimTarget(S, c); if (!tg.ok) { toast(S, 'Слишком далеко — подойди ближе'); return; }
    const h0 = proj(S.x, S.y, 95); S.inv[kind]--; S.stats[kind] = (S.stats[kind] || 0) + 1; achKind(S, kind); if (kind === 'eggs') achieve(S, 'first_egg');
    S.lockAng = Math.atan2(c[1] - h0[1], c[0] - h0[0]); S.faceLock = S.t + 0.7;
    const d = tg.dist, dur = kind === 'tp' ? 0.7 + 0.15 * pw + d / 4000 : 0.4 + d / 2000;
    S.proj.push({ kind, sx0: h0[0], sy0: h0[1], sx1: c[0], sy1: c[1], gx0: S.x, gy0: S.y, gx1: tg.ground[0], gy1: tg.ground[1], t0: S.t + 0.2, dur,
      arc: kind === 'tp' ? 200 + 120 * pw + d * 0.1 : 60 + d * 0.12, tg: { kind: tg.kind, id: tg.id, i: tg.i, u: tg.u, v: tg.v }, seed: S.steps });
    ev(S, { k: 'throw', kind, x: S.x, y: S.y });
    if (tg.kind === 'house' && MODS[tg.id]) spotted(S, tg.id);
  }
  function landProj(S, p) {
    if (p.kind === 'bb') { landBB(S, p); return; }
    if (p.kind === 'slipper') { if (Math.hypot(S.x - p.x1, S.y - p.y1) < 70) { hurt(S, 10, p.from ? 'Тапок Веры' : 'Тапок Кирилла'); if (p.from) achieve(S, 'payback'); } ev(S, { k: 'splat2', x: p.x1, y: p.y1 }); return; }
    if (p.kind === 'negg') { const n = S.npc.find((q) => q.id === p.from), q = proj(p.x1, p.y1);
      if (Math.hypot(S.x - p.x1, S.y - p.y1) < 62 && !S.hidden) { hurt(S, 5, 'Ответное яйцо — ' + (n ? NPCS[n.i].name : 'прохожий')); S.eggd = S.t; if (n && n.rev) n.rev.hit = 1; achieve(S, 'payback'); ev(S, { k: 'splat', x: S.x, y: S.y, sx: q[0], sy: q[1] - 80 }); }
      else { S.marks.push({ k: 'egg', on: 'ground', x: p.x1, y: p.y1, sx: q[0], sy: q[1], t: S.t, s: p.seed }); if (S.marks.length > 90) S.marks.shift(); ev(S, { k: 'splat', x: p.x1, y: p.y1, sx: q[0], sy: q[1] }); } return; }
    if (p.kind === 'firec') { S.fires = S.fires || []; S.fires.push({ x: p.gx1, y: p.gy1, t0: S.t, fuse: 1.4 }); ev(S, { k: 'fuse', x: p.gx1, y: p.gy1 }); return; }
    if (p.kind === 'arrow') { if (Math.hypot(S.x - p.x1, S.y - p.y1) < 70 && !S.hidden) { hurt(S, 8, 'Стрела-присоска Эльфа'); S.stuck = S.t; } ev(S, { k: 'thwack', x: p.x1, y: p.y1 }); return; }
    const tg = p.tg, m = { k: p.kind === 'eggs' ? 'egg' : 'tp', on: tg.kind, id: tg.id, i: tg.i, u: tg.u, v: tg.v, cm: tg.mask ? 1 : 0, x: p.gx1, y: p.gy1, sx: p.sx1, sy: p.sy1, t: S.t, s: p.seed };
    if (!['npc', 'courier', 'unit', 'crowd'].includes(tg.kind)) { S.marks.push(m); if (S.marks.length > 90) S.marks.splice(0, S.marks.length - 90); }
    hitTarget(S, tg, p.kind);
    ev(S, { k: p.kind === 'eggs' ? 'splat' : 'tpland', x: p.gx1, y: p.gy1, sx: p.sx1, sy: p.sy1 });
    if (tg.kind === 'house') { if (p.kind === 'eggs') achAdd(S, 'rotten_hunter', 1, 'eggs_' + tg.id);
      if (MODS[tg.id]) addPrank(S, tg.id, p.kind);
      else { S.yell = S.yell || {}; if (!(S.t - (S.yell[tg.id] || -99) < 10)) { S.yell[tg.id] = S.t; const L1 = ['Эй! Хулиганьё!', 'Я всё вижу! Я позвоню твоей маме!', 'Это что, яйцо?!', 'Иди к модерам, их закидывай!'];
        if (tg.id === 'kolya') toast(S, 'Это же твой собственный дом… Зачем?'); else say(S, 'house:' + tg.id, L1[Math.floor(h1(S.steps) * L1.length)], 2.6); } } }
  }
  // the house whose door Kolya stands at (any house: moderators for pranks that count, neighbours just for fun)
  function houseNear(S, r = K.USE + 20) { let best = null, bd = r; for (const h of HOUSES) { const d = Math.hypot(S.x - h.door[0], S.y - h.door[1]); if (d < bd) { bd = d; best = h; } } return best; }
  // the neighbours (not moderators) answer pranks at their doors; the moderators' lines are in LN
  const NB = { bell: { vera: 'Коля, я же тут, на крыльце стою! Чего звонишь?', a: 'Кто там?.. Никого. Опять дети балуются!', b: 'Мы СПИМ!!! Третий звонок за вечер!', kolya: 'Дома никого. Только кот, а он не открывает.' },
    slime: { vera: 'Ой! Ручка липкая… Коля, это ты?!', a: 'Фу-у! Кто намазал ручку?! Петров, это ты?', b: 'Что за гадость на ручке?! Спать не дают!' },
    alarm: { vera: 'Кукареку?! В почтовом ящике?! Ну дети…', a: 'КУКАРЕКУ?! Петров, выключи петуха!', b: 'Будильник?! В полночь?! Мы же спим!', kolya: 'Будильник в твоём же ящике. Сам себе подложил, молодец.' },
    rotten: { vera: 'Кто подкинул мне гнилую тыкву?! Фу, мухи!', a: 'Петров, у нас на крыльце гнилая тыква. Опять твои шутки?', b: 'Гнилая тыква… Ну хоть не яйца.', kolya: 'Гнилая тыква у твоего собственного крыльца. Смело.' },
    fire: ['Кто тут взрывает?!', 'Я звоню в полицию!', 'Дети, прекратите!', 'У меня собака спала!'] };
  const hsay = (S, id, text, at = S.t, fx = null) => { S.hq = S.hq || []; S.hq.push({ id, text, at, fx }); };
  const fwd = (S, d = 40) => { const X = Math.cos(S.ang || 0), Y = Math.sin(S.ang || 0), w = [(X / C - Y / SN) / 2, (X / C + Y / SN) / 2], l = Math.hypot(w[0], w[1]) || 1;
    const p = [S.x + w[0] / l * d, S.y + w[1] / l * d]; return blocked(p[0], p[1], 6) ? [S.x, S.y] : p; };
  // put the rotten pumpkin down at his feet (G, or E away from a moderator's porch); a click picks it up again
  function dropCarry(S) { if (S.carry !== 'rotten') return; const p = fwd(S, 38); S.drops = S.drops || []; S.drops.push({ x: p[0], y: p[1], kind: 'rotten', t: S.t }); S.carry = null;
    ev(S, { k: 'putdown', x: p[0], y: p[1] }); const hn = houseNear(S, 200);
    if (hn && !MODS[hn.id] && NB.rotten[hn.id]) { hsay(S, hn.id, NB.rotten[hn.id], S.t + 4); achKind(S, 'rotten'); toast(S, 'Гнилая тыква подкинута соседям'); }
    else toast(S, 'Гнилая тыква на земле. Клик по ней — поднять снова'); }
  function useSlot(S, name, cur, curS) {
    const id = modNear(S), k = id ? M(S, id) : null, h = id ? MODH[id] : null, md = id ? MODS[id] : null, dDoor = h ? Math.hypot(S.x - h.door[0], S.y - h.door[1]) : 1e9;
    const tgtId = S.target && M(S, S.target).done < 0 && !M(S, S.target).sweet ? S.target : (id || 'kirill');
    const readyM = (mid) => { const kk = M(S, mid), dd = MODS[mid]; if (!kk.refused) { toast(S, `Сначала постучи к ${dd.dat}: вдруг будет сладость?`); return false; }
      if (kk.done >= 0) { toast(S, `Дом ${dd.gen} уже закидан на 100 %`); return false; } if (kk.sweet) { toast(S, 'Тут уже мир: конфеты получены 🍬'); return false; } return true; };
    const ready = () => readyM(id);
    const canMod = (mid) => { const kk = M(S, mid); return kk.refused && kk.done < 0 && !kk.sweet; };
    if (name === 'eggs') { throwAt(S, 'eggs', curS || proj(MODH[tgtId].door[0] + 60, FACADE, 120)); return; }
    if (name === 'tp') { if (!curS) throwAt(S, 'tp', proj(MODH[tgtId].door[0], FACADE, 220), 0.8); else if (S.charge < 0) throwAt(S, 'tp', curS, 0.8); return; }
    if (name === 'bell') { const hn = houseNear(S); if (!hn) { toast(S, 'Подойди к любой двери: модеру — гадость, соседям — просто так'); return; }
      if (MODS[hn.id]) { const mid = hn.id, kk = M(S, mid); if (!readyM(mid)) return; if (kk.bell && S.t - kk.bell.t0 < 20) { toast(S, 'Слишком часто — подожди'); return; }
        kk.bell = { t0: S.t, done: false }; ev(S, { k: 'bell', id: mid, x: hn.door[0], y: hn.door[1] }); toast(S, 'ДИНЬ-ДОН! Беги или прячься! (Space в кустах)'); return; }
      S.hbell = S.hbell || {}; if (S.t - (S.hbell[hn.id] ?? -99) < 15) { toast(S, 'Слишком часто — подожди'); return; }
      S.hbell[hn.id] = S.t; ev(S, { k: 'bell', id: hn.id, x: hn.door[0], y: hn.door[1] }); achKind(S, 'bell'); hsay(S, hn.id, NB.bell[hn.id], S.t + 3); toast(S, 'ДИНЬ-ДОН! Это соседи, не модер — просто шалость'); return; }
    if (name === 'rotten') { if (S.carry !== 'rotten') { toast(S, (S.drops || []).length ? 'Гнилая тыква лежит там, где ты её оставил — подними кликом' : S.rottenGot.every(Boolean) ? 'Гнилых тыкв больше нет' : 'Гнилую тыкву ещё надо найти (говорят, в переулке и у гаража)'); return; }
      if (!id || Math.hypot(S.x - h.door[0] - 60, S.y - h.door[1]) > K.USE + 40) { dropCarry(S); return; }
      if (!ready()) return; if (k.swapped) { toast(S, 'Тут тыква уже подменена'); return; }
      if (spotted(S, id)) return; S.carry = null; k.swapped = true; addPrank(S, id, 'rotten'); ev(S, { k: 'swap', id, x: h.door[0] + 60, y: h.door[1] }); toast(S, 'Тыква подменена. Пахнет победой.'); return; }
    if (name === 'alarm') { if (S.inv.alarm <= 0) { toast(S, 'Нет будильника. Магазин в телефоне (Tab)'); return; }
      if (id && Math.hypot(S.x - h.mail[0], S.y - h.mail[1]) <= K.USE) { if (!ready()) return; if (k.alarm) { toast(S, 'В этом ящике уже был будильник'); return; }
        S.inv.alarm--; k.alarm = { t0: S.t, ring: S.t + 8, done: false }; ev(S, { k: 'mailbox', id, x: h.mail[0], y: h.mail[1] }); toast(S, 'Будильник в почтовом ящике. Зазвонит через несколько секунд…'); return; }
      const hm = HOUSES.find((q) => !MODS[q.id] && Math.hypot(S.x - q.mail[0], S.y - q.mail[1]) <= K.USE);
      S.inv.alarm--; achKind(S, 'alarm'); S.decoys = S.decoys || [];
      if (hm) { S.decoys.push({ x: hm.mail[0], y: hm.mail[1], ring: S.t + 8, end: S.t + 12, house: hm.id }); ev(S, { k: 'mailbox', id: hm.id, x: hm.mail[0], y: hm.mail[1] }); toast(S, 'Будильник у соседей в ящике. Зазвонит через несколько секунд…'); return; }
      const p = fwd(S, 30); S.decoys.push({ x: p[0], y: p[1], ring: S.t + 6, end: S.t + 12 }); ev(S, { k: 'putdown', x: p[0], y: p[1] });
      toast(S, 'Будильник на земле: зазвонит через 6 с и отвлечёт всех вокруг'); return; }
    if (name === 'chalk') { if (S.inv.chalk <= 0) { toast(S, 'Нет мелков. Магазин в телефоне (Tab)'); return; }
      if (id && Math.abs(S.x - h.gate) < 320 && S.y > SWN[0] - 30 && S.y < ROAD[0] + 140 && canMod(id)) {
        S.inv.chalk--; S.chalk = { t0: S.t, mod: id, pts: chalkShape(h), hit: [] }; S.chalk.hit = S.chalk.pts.map(() => 0); S.path = []; toast(S, 'Обведи рисунок: зажми ЛКМ и веди по точкам (12 с)'); return; }
      const kinds = ['ghost', 'cat', 'pumpkin', 'heart'], kind = kinds[Math.floor(h1(S.steps * 0.29) * kinds.length) % kinds.length], c = fwd(S, 120), pts = chalkPts(kind, c[0], c[1]);
      S.inv.chalk--; S.chalk = { t0: S.t, mod: null, kind, at: c, pts, hit: pts.map(() => 0) }; S.path = []; toast(S, 'Рисуем где угодно: зажми ЛКМ и веди по точкам (12 с)'); return; }
    if (name === 'fire') { if (S.inv.fire <= 0) { toast(S, 'Нет петард. Магазин в телефоне (Tab)'); return; }
      if (curS) { throwFire(S, curS); return; }
      const p = fwd(S, 30); S.inv.fire--; S.fires = S.fires || []; S.fires.push({ x: p[0], y: p[1], t0: S.t, fuse: 3.0 }); ev(S, { k: 'fuse', x: p[0], y: p[1] }); toast(S, 'Фитиль горит! БЕГИ! (3 с)'); return; }
    if (name === 'slime') { if (S.inv.slime <= 0) { toast(S, 'Нет слайма. Магазин в телефоне (Tab)'); return; }
      const hn = houseNear(S, K.USE); if (!hn) { toast(S, 'Слайм — на дверную ручку: подойди к любой двери'); return; }
      if (MODS[hn.id]) { const mid = hn.id, kk = M(S, mid); if (!readyM(mid)) return; if (kk.slime) { toast(S, 'Ручка уже в слайме'); return; }
        S.slimeMod = mid; S.slimeHouse = mid; S.slimeHold = 0.0001; toast(S, `Держи E (или ПКМ) 2.5 с, пока ${LN[mid].slime}`); return; }
      if (hn.id === 'kolya') { toast(S, 'Это твоя же дверь… Не надо.'); return; }
      S.hslime = S.hslime || {}; if (S.hslime[hn.id]) { toast(S, 'Ручка уже в слайме'); return; }
      S.slimeMod = null; S.slimeHouse = hn.id; S.slimeHold = 0.0001; toast(S, 'Держи E (или ПКМ) 2.5 с: слайм на ручку соседям'); return; }
    if (name === 'pizza') { S.phone = { app: 'pizza', t: S.t, at: S.t, scroll: 0 }; return; }
    if (name === 'flyers') { const li = lampNear(S.x, S.y);
      // v11: a flyer can be taken down again (back into the pocket) — otherwise the posts run out
      if (li >= 0) { const om = MODIDS.find((m) => M(S, m).lamps.includes(li)); if (om || (S.flyers2 || []).includes(li)) {
        if (om) M(S, om).lamps.splice(M(S, om).lamps.indexOf(li), 1); else S.flyers2.splice(S.flyers2.indexOf(li), 1);
        S.inv.flyers++; ev(S, { k: 'flyeroff', i: li, x: LAMPS[li][0], y: LAMPS[li][1] }); toast(S, 'Флаер снят и снова в кармане — столб свободен'); return; } }
      if (S.inv.flyers <= 0) { toast(S, 'Нет флаеров. Магазин в телефоне (Tab)'); return; }
      if (li < 0) { toast(S, 'Флаер клеится на фонарный столб'); return; }
      const fid = S.target && M(S, S.target).done < 0 && !M(S, S.target).sweet ? S.target : null;
      if (!fid) { S.inv.flyers--; S.flyers2 = S.flyers2 || []; S.flyers2.push(li); achKind(S, 'flyers'); ev(S, { k: 'flyer', id: null, i: li, x: LAMPS[li][0], y: LAMPS[li][1] });
        toast(S, 'Флаер «Пропал кот. Откликается на „Модератор“» приклеен'); return; }
      const fk = M(S, fid); S.inv.flyers--; fk.lamps.push(li); addPrank(S, fid, 'flyers'); ev(S, { k: 'flyer', id: fid, i: li, x: LAMPS[li][0], y: LAMPS[li][1] });
      toast(S, `Флаер «${MODS[fid].name} раздаёт конфеты БЕСПЛАТНО!» (${fk.lamps.length}/5)`);
      if (fk.lamps.length >= 5 && !S.kids) S.kids = { t0: S.t, st: 'come', mod: fid }; return; }
  }
  // a firecracker thrown at the cursor (RMB): it lands, the fuse burns 1.4 s
  function throwFire(S, c) { const tg = aimTarget(S, c); if (tg.dist > 760) { toast(S, 'Слишком далеко — петарду так не докинуть'); return; }
    const h0 = proj(S.x, S.y, 95); S.inv.fire--; S.lockAng = Math.atan2(c[1] - h0[1], c[0] - h0[0]); S.faceLock = S.t + 0.7;
    S.proj.push({ kind: 'firec', sx0: h0[0], sy0: h0[1], sx1: c[0], sy1: c[1], gx0: S.x, gy0: S.y, gx1: tg.ground[0], gy1: tg.ground[1], t0: S.t + 0.2, dur: 0.45 + tg.dist / 1800, arc: 70 + tg.dist * 0.12, tg: { kind: 'ground' }, seed: S.steps });
    ev(S, { k: 'throw', kind: 'fire', x: S.x, y: S.y }); }
  // firecrackers anywhere: the bang stuns passers-by and the patrol within 260 for 1.5 s, sets off car alarms; at a moderator's porch it counts as the prank
  function fireStep(S) { const t = S.t; if (!S.fires || !S.fires.length) return;
    S.fires = S.fires.filter((f) => { if (t - f.t0 < f.fuse) return true; bang(S, f); return false; }); }
  function bang(S, f) { const t = S.t, near = (x, y, r) => Math.hypot(x - f.x, y - f.y) < r; let stun = 0; achKind(S, 'fire');
    ev(S, { k: 'bang', x: f.x, y: f.y });
    if (near(S.x, S.y, 170)) hurt(S, 15, 'Петарды рядом');
    S.npc.forEach((n) => { if (!near(n.x, n.y, 260)) return; n.stunT = t + 1.5; n.pause = Math.max(n.pause || 0, 1.6); stun++; npcSay(S, n, pickL(['Ай! Мои уши!', 'Что это было?!', 'А-а-а! Бомба!', 'Я ничего не слышу!'], t * 3.1 + n.i)); anger(S, n, 1); });
    if (S.raid && S.raid.st !== 'wait') { S.raid.units.forEach((u) => { if (near(u.x, u.y, 260)) { u.stunT = t + 1.5; stun++; say(S, 'raid' + u.i, pickL(['Контузия! Ничего не вижу!', 'Ай! Петарды!', 'Уши!..'], t + u.i), 1.8); }
        else if (near(u.x, u.y, 1500) && u.st !== 'chase') { u.st = 'alert'; u.alertAt = [f.x, f.y]; u.goal = null; } });
      S.raid.crowd.forEach((q, i) => { if (near(q.x, q.y, 260)) { q.hitT = t; q.hitK = 'bang'; say(S, 'crowd:' + i, 'Ай! Мои уши!', 1.8); } }); }
    if (S.courier && near(S.courier.x, S.courier.y, 260)) say(S, 'courier', 'Пиццу чуть не уронил!', 2);
    if (stun) achAdd(S, 'boom', stun);
    for (const id of MODIDS) { const h = MODH[id], k = M(S, id); if (!near(h.door[0], h.door[1], 240)) continue;
      k.dirty = 1; if (k.refused && k.done < 0 && !k.sweet && !k.pr.fire) addPrank(S, id, 'fire'); k.st = 'out'; k.t0 = t + 0.6; say(S, id, LN[id].fire, 2.6); }
    HOUSES.forEach((h) => { if (MODS[h.id] || !near(h.door[0], h.door[1], 300)) return; S.yell = S.yell || {}; if (S.t - (S.yell[h.id] || -99) < 8) return; S.yell[h.id] = S.t; say(S, 'house:' + h.id, pickL(NB.fire, t * 1.7), 2.4); });
    CARS.forEach(([cx, cy], i) => { if (near(cx, cy, 1200)) ev(S, { k: 'caralarm', i, x: cx, y: cy }); });
    if (S.cat && near(S.cat.x, S.cat.y, 500)) catScare(S, f.x, f.y); }
  // alarm clocks: in a moderator's mailbox (the prank), in a neighbour's, or on the ground as a decoy that draws the patrol and passers-by
  function decoyStep(S) { if (!S.decoys || !S.decoys.length) return; const t = S.t;
    S.decoys = S.decoys.filter((d) => { if (!d.rang && t >= d.ring) { d.rang = true; ev(S, { k: 'alarm', id: d.house || null, x: d.x, y: d.y });
        if (d.house) say(S, 'house:' + d.house, NB.alarm[d.house] || 'КУКАРЕКУ?!', 3);
        S.npc.forEach((n) => { if (!n.rev && !NPCS[n.i].stat && Math.hypot(n.x - d.x, n.y - d.y) < 600) { npcSay(S, n, pickL(['Чей это будильник?!', 'Кукареку?! Ночью?!', 'Выключите петуха!'], t + n.i)); n.pause = Math.max(n.pause || 0, 2.5); } });
        if (S.raid && S.raid.st === 'search') S.raid.units.forEach((u) => { if (u.st !== 'chase' && Math.hypot(u.x - d.x, u.y - d.y) < 1500) { u.st = 'alert'; u.alertAt = [d.x, d.y + 30]; u.goal = null; } });
        if (S.cat && Math.hypot(S.cat.x - d.x, S.cat.y - d.y) < 500) catScare(S, d.x, d.y); }
      return t < d.end + 6; }); }
  // the neighbours answer a moment later (bells, slime on the handle, a rotten pumpkin on the porch)
  function houseStep(S) { if (!S.hq || !S.hq.length) return; const t = S.t;
    S.hq = S.hq.filter((q) => { if (t < q.at) return true; say(S, 'house:' + q.id, q.text, 2.8); const h = HOUSES.find((x) => x.id === q.id); if (q.fx && h) ev(S, { k: q.fx, id: q.id, x: h.door[0], y: h.door[1] }); return false; }); }
  // free chalk drawings (screen-upright shapes in px around a ground point)
  function chalkPts(kind, cx, cy) { const pts = [], add = (u, v) => pts.push([cx + (u / C - v / SN) / 2, cy + (u / C + v / SN) / 2]);
    const arc = (x0, y0, r, a0, a1, n, ry = r) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; add(x0 + r * Math.cos(a), y0 + ry * Math.sin(a)); } };
    if (kind === 'ghost') { arc(0, -20, 55, Math.PI, 2 * Math.PI, 9); for (let i = 1; i <= 3; i++) { add(55, -20 + i * 22); add(-55, -20 + i * 22); }
      for (let i = 0; i <= 6; i++) add(55 - i * 110 / 6, 50 + (i % 2 ? -14 : 0)); add(-20, -25); add(20, -25); add(0, 10); }
    else if (kind === 'cat') { arc(0, 0, 55, 0, 2 * Math.PI, 16); add(-48, -40); add(-40, -75); add(-20, -55); add(20, -55); add(40, -75); add(48, -40); add(-20, -10); add(20, -10); add(0, 10); add(-70, 8); add(70, 8); add(-68, 22); add(68, 22); }
    else if (kind === 'pumpkin') { arc(0, 0, 75, 0, 2 * Math.PI, 18, 52); add(0, -58); add(6, -76); add(-30, -15); add(-18, -28); add(-8, -12); add(8, -12); add(18, -28); add(30, -15); for (let i = 0; i <= 6; i++) add(-36 + i * 12, 22 + (i % 2 ? 8 : 0)); }
    else { for (let i = 0; i <= 18; i++) { const a = i / 18 * 2 * Math.PI, x = 16 * Math.sin(a) ** 3, y = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)); add(x * 4, y * 4); } }
    return pts; }
  function chalkShape(h = HK) {   // a crude grinning face with horns on the sidewalk in front of a moderator's gate (world points)
    const cx = h.gate - 40, cy = -265, pts = [];
    for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2; pts.push([cx + 95 * Math.cos(a), cy + 50 * Math.sin(a)]); }
    for (let i = 0; i <= 8; i++) { const a = Math.PI * (0.2 + 0.6 * i / 8); pts.push([cx + 55 * Math.cos(a) * -1 + 0, cy + 22 * Math.sin(a) + 2]); }
    pts.push([cx - 35, cy - 18], [cx - 25, cy - 18], [cx + 25, cy - 18], [cx + 35, cy - 18]);
    pts.push([cx - 70, cy - 40], [cx - 95, cy - 70], [cx - 60, cy - 50], [cx + 70, cy - 40], [cx + 95, cy - 70], [cx + 60, cy - 50]);
    return pts;
  }
  // what each moderator shouts back at a prank
  const LN = {
    kirill: { bellSeen: 'АГА! Попался!', bellMiss: 'Опять эти дети…', alarm: 'КУ-КА-РЕ-КУ?! Кто это сделал?!', fire: 'МОИ УШИ!!!', pizza1: 'Я НЕ ЗАКАЗЫВАЛ!!!', pizza2: '…Да вы издеваетесь.', kids: 'КАКИЕ ЕЩЁ КОНФЕТЫ?!', slime: 'Кирилла нет в окне', slimeTouch: ['ФУ-У-У! Что это на ручке?! Это сопля?!', 'Мои руки… Я модер, а не уборщик!'] },
    raiva: { bellSeen: 'Попался! Улыбнись на камеру 📸', bellMiss: 'Опять дети… Закрываю как дубликат.', alarm: 'КУ-КА-РЕ-КУ?! Это что, новый алерт мониторинга?!', fire: 'МОЙ СЕРВЕР!!! Там же аптайм 300 дней!', pizza1: 'Это НЕ мой заказ! Кто взломал мой аккаунт?!', pizza2: '…Ладно. Пиццу в серверную.', kids: 'Конфеты? Только по заявке в тикет-системе!', slime: 'камера не пишет', slimeTouch: ['Что за… Ручка в слизи! Это баг или фича?!', 'Фу. Заношу в инциденты: «слизь на ручке», приоритет — критический.'] },
    elf: { bellSeen: 'Стоять! Лови стрелу-присоску! 🏹', bellMiss: 'Звонят и убегают… Детский сад.', alarm: 'КУ-КА-РЕ-КУ?! Ну всё, я кого-то найду.', fire: 'ВЫ С УМА СОШЛИ?!', pizza1: 'Я не заказывала! Мне бы латте, а не это!', pizza2: '…Пепперони. Ненавижу пепперони.', kids: 'Бесплатные конфеты? Тут только латте, и то не вам.', slime: 'прожектор не горит', slimeTouch: ['ФУ! Ручка… липкая… КОЛЯ!!!', 'Мой маникюр! Ну всё, Коля, ты попал.'] } };
  function modStep(S, id) {
    const k = M(S, id), h = MODH[id], t = S.t, who = id, ln = LN[id];
    if (k.bell && !k.bell.done && t - k.bell.t0 > 3.0) { k.bell.done = true; k.st = 'out'; k.t0 = t;
      const seen = inYard(S.x, S.y, h) && !S.hidden && Math.hypot(S.x - h.door[0], S.y - h.door[1]) < 520;
      if (seen && id === 'kirill') { say(S, who, ln.bellSeen, 2.4); S.proj.push({ kind: 'slipper', x0: h.door[0], y0: h.door[1], z0: 80, x1: S.x, y1: S.y, z1: 20, t0: t, dur: 0.55, arc: 70, seed: S.steps }); }
      else if (seen && id === 'elf') { say(S, who, ln.bellSeen, 2.4); S.proj.push({ kind: 'arrow', x0: h.door[0], y0: h.door[1], z0: 95, x1: S.x, y1: S.y, z1: 60, t0: t + 0.5, dur: 0.35, arc: 25, seed: S.steps }); }
      else if (seen) { say(S, who, ln.bellSeen, 2.4); ev(S, { k: 'flash', id, x: h.door[0], y: h.door[1] }); hurt(S, 10, 'Вспышка прожектора камеры Райвы'); }
      else { say(S, who, ln.bellMiss, 2.4); addPrank(S, id, 'bell'); achAdd(S, 'ninja'); } }
    if (k.alarm && !k.alarm.done && t > k.alarm.ring) { k.alarm.done = true; k.st = 'out'; k.t0 = t; ev(S, { k: 'alarm', id, x: h.mail[0], y: h.mail[1] });
      say(S, who, ln.alarm, 3); addPrank(S, id, 'alarm'); }
    if (k.fire && !k.fire.done && t - k.fire.t0 > 3.0) { k.fire.done = true; ev(S, { k: 'bang', id, x: k.fire.x, y: k.fire.y });
      if (Math.hypot(S.x - k.fire.x, S.y - k.fire.y) < 170) hurt(S, 15, 'Петарды рядом'); addPrank(S, id, 'fire'); k.st = 'out'; k.t0 = t + 0.6; say(S, who, ln.fire, 2.6);
      CARS.forEach(([cx, cy], i) => { if (Math.hypot(cx - k.fire.x, cy - k.fire.y) < 1200) ev(S, { k: 'caralarm', i, x: cx, y: cy }); }); }
    if (k.slime === 1 && t > (k.slimeAt || 0) && k.st === 'inside' && !(S.dlg && S.dlg.who === id)) { k.slime = 2; k.st = 'out'; k.t0 = t;
      ev(S, { k: 'slimetouch', id, x: h.door[0], y: h.door[1] }); say(S, who, ln.slimeTouch[Math.floor(h1(S.steps * 0.23) * 2) % 2], 3.2);
      if (inYard(S.x, S.y, h) && !S.hidden) say(S, who, 'КОЛЯ! Я ТЕБЯ ВИЖУ! Это ТВОИ сопли?!', 2.6);
      if (S.gq) gthread(S, id, { kirill: 'Взялся за ручку двери. Она в соплях. Я знаю, кто это. КОЛЯ.', raiva: 'Новый инцидент: ручка двери покрыта слизью. Подозреваемый — Коля (＞﹏＜)', elf: 'Ручка. В слизи. Мой маникюр. Коля, ты покойник (￣ー￣)' }[id]); }
    if (k.st === 'out' && t - k.t0 > 4.0) { k.st = 'inside'; k.t0 = t; }
    if (k.st === 'door' && !(S.dlg && S.dlg.who === id) && t - k.t0 > 1) { k.st = 'inside'; k.t0 = t; }
  }
  // ---- Elf's motion-sensor floodlight ----
  function elfSensor(S) {
    const e = S.elf, t = S.t, moving = Math.hypot(S.vx, S.vy) > 35;
    if (inYard(S.x, S.y, HE) && !S.hidden && S.hp > 0 && moving) { e.last = t; if (e.lit < 0 && e.arm < 0) e.arm = t; }
    if (e.arm >= 0 && t - e.arm > 0.35) { e.arm = -1;
      if (e.lit < 0) { e.lit = t; ev(S, { k: 'flood', on: 1, x: HE.door[0], y: HE.door[1] });
        if (e.refused && e.done < 0 && !e.sweet && t - e.sayT > 14 && e.st === 'inside') { e.sayT = t; e.st = 'out'; e.t0 = t; e.peek = 1;
          say(S, 'elf', ['Кто там шуршит?..', 'Коля, я тебя вижу. Датчик не врёт.', 'Ещё шаг — и я звоню куда надо.'][Math.floor(h1(t) * 3)], 2.6); } } }
    if (e.lit >= 0 && t - e.last > (boosted(S) ? 7 : 4.0) && t - e.lit > 2.0) { e.lit = -1; ev(S, { k: 'flood', on: 0, x: HE.door[0], y: HE.door[1] }); }
  }
  // ---- Elf's revenge: police + soldiers patrol the street and question passers-by; their FLASHLIGHT BEAMS are their eyes ----
  const RAID = { V: 92, ALERT: 150, RUN: { police: 200, soldier: 210 }, TIRED: 165, CATCH: 46, ACC: 420,
    BEAM: { len: 620, cos: 0.86, z: 58, tip: 24 },                              // the beam the scene draws (screen space) = what they see
    cars: [[-150, -125, 'car_police'], [-560, -120, 'car_army']],                 // they drive in from Kolya's end of the street and park by his house
    units: [{ kind: 'police', car: 0, route: [[300, -262], [1600, -262], [3700, -262], [5850, -262], [3700, -262], [1600, -262]] },
      { kind: 'police', car: 0, route: [[-300, 232], [800, 232], [2000, 232], [4200, 232], [5850, 232], [3000, 232]] },
      { kind: 'soldier', car: 1, route: [[-600, 0], [600, 0], [2500, 20], [4300, 10], [6200, -10], [3500, -10]] },
      { kind: 'soldier', car: 1, route: [[-700, -300], [1200, -300], [2900, -310], [4360, -320], [4360, -640], [4360, -320], [6250, -300], [2900, -310]] }],
    say: { police: { chase: ['Стоять! Полиция!', 'Эй, ты, в худи! Стой!', 'Не двигаться!', 'Держи его!', 'Именем Хэллоуина — стоять!', 'Гражданин, остановитесь!'],
        hmm: ['Эй, ты! А ну стой…', 'Кто там шуршит?', 'Мне показалось?..', 'Покажись!', 'Тут кто-то есть…'],
        lost: ['Ушёл… Продолжаем патруль.', 'Растворился, как привидение.', 'Ладно, далеко не уйдёт.', 'Куда он делся?!'],
        ask: [['Полиция. Проверка документов.', 'Ищем парня в чёрной худи. Не видели?'], ['Добрый вечер. Что в пакете?', 'Конфеты? Ладно, проходите.'],
          ['Ваш костюм подозрительно настоящий.', 'Шучу. Парня с яйцами не видели?'], ['Стоять. Вы не Коля?', 'Хм. Коля лохматее. Свободны.']],
        hit: ['Нападение на полицию!', 'Моя фуражка!', 'Это было яйцо?! В ПОЛИЦИЮ?!', 'Ну всё, гражданин…'] },
      soldier: { chase: ['Стоять! Цель обнаружена!', 'Контакт! Парень в худи!', 'Цель на шесть часов!', 'Перехватываю!', 'Беглец, стой!'],
        hmm: ['Движение на два часа…', 'Вижу тень.', 'Проверю.', 'Что-то шевельнулось.'],
        lost: ['Цель потеряна. Прочёсываем.', 'Ушёл в тень. Возвращаюсь на маршрут.', 'Хитрый. Уважаю.', 'Пусто. Продолжаем.'],
        ask: [['Военный патруль. Стоять.', 'Лохматый, чёрное худи. Видели?'], ['Проверка. Руки, где я их вижу.', 'Ага, это конфета. Свободны.'],
          ['Стой. Ты не Коля?', '…Нет, Коля выше. Свободен.'], ['Документы, пожалуйста.', 'Справка от мамы? Сойдёт.']],
        hit: ['Обстрел! Яйцами!', 'Броник в желтке!', 'Под огнём! Кондитерским!', 'Вот это ты зря.'] } },
    reply: ['Я тыква. У тыкв нет документов.', 'Парень в худи? Тут все в худи.', 'Коля? Не видела. Честно-честно.', 'Он побежал туда! …Или туда.', 'У меня только конфеты, товарищ.',
      'Я призрак, меня вообще не существует.', 'Документы дома, я в костюме скелета!', 'Я ничего не видел. Я вообще ведьма.', 'Видел лохматого с яйцами у дома Кирилла.',
      'А вы правда полиция или это костюм?', 'Хотите конфетку? Только не арестовывайте.', 'Он за мусорками прятался. Наверное.'],
    quips: ['Попался, мститель на полставки!', 'Яйца — в вещдоки. Тебя — в машину.', 'Гражданин, ваш Хэллоуин окончен.', 'Это тебе не в дверь звонить и убегать.',
      'Бегать надо было лучше. Или вообще не бегать.', 'Улыбнись, это для протокола 📸', 'Туалетную бумагу изымаем. Как улику.', 'Ну что, сладость или статья?'],
    released: ['Через час отпустили…', 'Отпустили под честное слово…', 'Отпустили, но запомнили…', 'Отпустили с лекцией о вреде яиц…'],
    elfMsg: ['Ну что, понравилось, сладкий? Наручники тебе идут (づ￣ ³￣)づ', 'Говорят, в отделении бесплатный чай. Не латте, конечно. Принесёшь мне потом? (￣ω￣)', 'Я всё видела с крыльца. Красиво бежал. Ещё раз пробежишься для меня? (￣ー￣)', 'Счёт: полиция {n}, Коля 0. Но ты всё равно милый (づ￣ ³￣)づ',
      'Это только начало, зайка. Ночь длинная (¬‿¬)ψ', 'Передай им привет. Хотя ты им уже передал. Яйцом. Ну ты и засранец (´ ε ` )♡'],
    crowd: [[1900, 318, 'kid'], [2100, 322, 'npc_ghost'], [1960, 296, 'npc_hoodie'], [2045, 300, 'npc_witch2'], [3950, 316, 'npc_devil'], [4150, 320, 'npc_witch2'], [4010, 294, 'npc_cloak'], [4095, 298, 'kid']] };
  const pickL = (arr, seed) => arr[Math.floor(h1(seed) * arr.length) % arr.length];
  const newUnit = (S, i, kind, route, x, y, st = 'patrol') => ({ i, kind, route, x, y, wa: Math.PI, ang: scrAng(-1, 0), gph: 0, gA: 0, mv: 0, v: 0, moving: 0, run: 0,
    st, k: 0, pause: 0.6 * (i % 4), sus: 0, lost: 0, path: [], goal: null, replan: 0, lastInsp: S.t, look: 0, stareT: -9, hmm: 0, chT: 0 });
  function newRaid(S) {
    return { st: 'wait', t0: S.t + 4.5, arrests: 0, grace: 0, lastSeen: null, seenT: -99, insp: {}, extra: 0, reinfAt: -1, anger: 0,
      cars: RAID.cars.map(([x, y, tex], i) => ({ x: X0 - 1500 - i * 420, y, tx: x, dir: 1, tex, v: 0, park: false, vmax: 450 })),
      units: [], crowd: RAID.crowd.map(([x, y, tex], i) => ({ x, y, tex, hitT: -9, ang: scrAng(0.25 * (i % 3 - 1) + (x % 2000 > 1000 ? 0.4 : -0.4), -1) })) };
  }
  const angW = (d) => ((d + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  const smooth = (a, b, x) => { const q = Math.max(0, Math.min(1, (x - a) / (b - a))); return q * q * (3 - 2 * q); };
  // the flashlight beam in projected space: from the torch, along the unit's screen facing (the scene draws exactly this)
  const raidBeam = (u) => { const o = proj(u.x, u.y, RAID.BEAM.z), ca = Math.cos(u.ang || 0), sa = Math.sin(u.ang || 0); return { o: [o[0] + ca * RAID.BEAM.tip, o[1] + sa * RAID.BEAM.tip], d: [ca, sa] }; };
  function beamLit(u, x, y) { const b = raidBeam(u); let best = 0;
    for (const z of [12, 70]) { const k = proj(x, y, z), dx = k[0] - b.o[0], dy = k[1] - b.o[1], l = Math.hypot(dx, dy); if (l < 30) return 1;
      best = Math.max(best, smooth(RAID.BEAM.cos, RAID.BEAM.cos + 0.1, (dx * b.d[0] + dy * b.d[1]) / l) * smooth(RAID.BEAM.len, RAID.BEAM.len * 0.2, l)); }
    return best; }
  // walk a raid unit toward g (A* when there is no straight line); speed and facing ease (no jerks); true on arrival
  // a body (unit) pushed out of the raid cars' boxes, sliding along them
  function pushOut(o, r) { for (const b of DYN) { if (!inBox(o.x, o.y, b, r)) continue; const dl = o.x - (b[0] - r), dr = (b[2] + r) - o.x, du = o.y - (b[1] - r), dd = (b[3] + r) - o.y, m = Math.min(dl, dr, du, dd);
      if (m === dl) o.x = b[0] - r; else if (m === dr) o.x = b[2] + r; else if (m === du) o.y = b[1] - r; else o.y = b[3] + r; } }
  function uGo(S, u, g, v) {
    if (Math.hypot(g[0] - u.x, g[1] - u.y) < 14) return true;
    if (!u.goal || Math.hypot(u.goal[0] - g[0], u.goal[1] - g[1]) > (u.st === 'chase' ? 220 : 40) || S.t > u.replan) { u.goal = g.slice(); u.path = los([u.x, u.y], g) ? [g] : findPath([u.x, u.y], g); if (!u.path.length) u.path = [g]; u.replan = S.t + (u.st === 'chase' ? 0.8 : 6); }
    if (u.path.length === 1) u.path[0] = g;
    let tg = u.path[0], dx = tg[0] - u.x, dy = tg[1] - u.y, d = Math.hypot(dx, dy);
    if (d < 14 && u.path.length > 1) { u.path.shift(); tg = u.path[0]; dx = tg[0] - u.x; dy = tg[1] - u.y; d = Math.hypot(dx, dy); }
    if (d < 1) return true;
    const want = Math.atan2(dy, dx), da = Math.abs(angW(want - u.wa)); u.wa = turnTo(u.wa, want, 5.5 * DT);
    u.v = Math.min(u.v + RAID.ACC * DT, v * (da > 1.3 ? 0.35 : 1)); const st = Math.min(d, u.v * DT); u.x += dx / d * st; u.y += dy / d * st; pushOut(u, 22);
    u.gph += st / (u.v > 150 ? 108 : 82); u.mv = 1; u.run = u.v > 150 ? 1 : 0; return false;
  }
  // how well a unit sees Kolya now: inside the drawn flashlight beam (0..1), unless hidden, in a crowd, or behind a wall
  function raidSees(S, u) {
    const R = S.raid; if (S.hidden || S.hp <= 0 || R.grace > S.t || S.ghost) return 0;
    const d = Math.hypot(S.x - u.x, S.y - u.y), sp = Math.hypot(S.vx, S.vy);
    const inCrowd = sp < 190 && raidCrowd(S) > 0;
    if (d < (inCrowd ? 34 : 60)) return 1;                                                  // bumped into him (in a crowd only face to face)
    let lit = beamLit(u, S.x, S.y);
    if (inCrowd && d > 70) lit = 0;                                                          // blending in with passers-by
    if (S.light && d < 480 && Math.abs(angW(Math.atan2(S.y - u.y, S.x - u.x) - u.wa)) < 1.1) lit = Math.max(lit, 0.6);   // his own phone light gives him away
    if (!inCrowd && d < 700 && Math.abs(angW(Math.atan2(S.y - u.y, S.x - u.x) - u.wa)) < 1.0 && inLampLight(S)) lit = Math.max(lit, 0.45);   // standing in a street lamp's pool
    if (lit < 0.12) return 0;
    if (!seeLine([u.x, u.y], [S.x, S.y])) return 0;
    return lit;
  }
  const inLampLight = (S) => LAMPS.some(([x, y], i) => lampLit(S, i) && Math.hypot(S.x - x - (y < 0 ? 40 : -40), S.y - y - (y < 0 ? 40 : -40)) < 190);
  const raidCrowd = (S) => { let n = 0; S.npc.forEach((q) => { if (!NPCS[q.i].stat && Math.hypot(q.x - S.x, q.y - S.y) < 105) n++; });
    if (S.raid) S.raid.crowd.forEach((q) => { if (Math.hypot(q.x - S.x, q.y - S.y) < 95) n++; }); return n; };
  function raidChase(S, u) { const R = S.raid; if (u.st === 'chase') return; u.st = 'chase'; u.lost = 0; u.chT = 0; u.goal = null; R.lastSeen = [S.x, S.y]; R.seenT = S.t;
    ev(S, { k: 'whistle', x: u.x, y: u.y }); say(S, 'raid' + u.i, pickL(RAID.say[u.kind].chase, S.steps * 0.37 + u.i), 2.2);
    R.units.forEach((o) => { if (o !== u && o.st !== 'chase' && Math.hypot(o.x - S.x, o.y - S.y) < 2200) { o.st = 'alert'; o.goal = null; } }); }
  function raidTip(S, x, y) { const R = S.raid; if (!R || R.st !== 'search') return; R.lastSeen = [S.x, S.y]; let best = null, bd = 1400;
    R.units.forEach((o) => { const d = Math.hypot(o.x - x, o.y - y); if (o.st !== 'chase' && d < bd) { bd = d; best = o; } }); if (best) { best.st = 'alert'; best.goal = null; } }
  // an egg / TP / BB on a cop or a soldier: if he can see where it came from — a chase and a reinforcement car out for revenge
  function raidHit(S, u, kind) { const R = S.raid; R.anger++; u.hitT = S.t; u.hitK = kind; say(S, 'raid' + u.i, pickL(RAID.say[u.kind].hit, S.steps * 0.53), 2.2);
    u.wa = Math.atan2(S.y - u.y, S.x - u.x); u.ang = scrAng(Math.cos(u.wa), Math.sin(u.wa));
    const sees = !S.hidden && R.grace <= S.t && !S.ghost && Math.hypot(S.x - u.x, S.y - u.y) < 900 && seeLine([u.x, u.y], [S.x, S.y]);
    if (sees) { raidChase(S, u); if (R.extra < 2 && R.reinfAt < 0) R.reinfAt = S.t + 5; }
    else { R.lastSeen = [S.x, S.y]; if (u.st !== 'chase') { u.st = 'search'; u.t1 = S.t; u.goal = null; } } }
  function carHit(S, c) { const R = S.raid; R.anger++; c.hitT = S.t; ev(S, { k: 'caralarm', i: -1, x: c.x, y: c.y });
    let best = null, bd = 900; R.units.forEach((o) => { const d = Math.hypot(o.x - S.x, o.y - S.y); if (d < bd && seeLine([o.x, o.y], [S.x, S.y])) { bd = d; best = o; } });
    if (best && !S.hidden && !S.ghost && R.grace <= S.t) { say(S, 'raid' + best.i, best.kind === 'police' ? 'Ты что, нашу машину?! Ну всё!' : 'Броневик в яйцах! Взять его!', 2.4); raidChase(S, best); if (R.extra < 2 && R.reinfAt < 0) R.reinfAt = S.t + 5; }
    else raidTip(S, c.x, c.y); }
  function raidArrest(S, u) {
    const R = S.raid; R.arrests++; const fine = Math.max(100, Math.round(Math.max(0, S.money) * 0.3)); S.money -= fine;
    ev(S, { k: 'arrest', x: S.x, y: S.y }); say(S, 'raid' + u.i, pickL(RAID.quips, S.steps * 0.29 + R.arrests), 2.8);
    toast(S, `Колю задержали! Штраф ${fine} ₽. ${pickL(RAID.released, S.steps * 0.71)} — у дома Эльфа`, 'big');
    msg(S, 'Эльф', pickL(RAID.elfMsg, R.arrests * 1.7 + S.steps * 0.01).replace('{n}', R.arrests));
    if (S.carry === 'rotten') { S.drops = S.drops || []; S.drops.push({ x: S.x, y: S.y, kind: 'rotten', t: S.t }); }        // the pumpkin stays where he was caught
    S.x = HE.door[0] + 170; S.y = -270; S.vx = S.vy = 0; S.path = []; S.act = null; S.hidden = false; S.carry = null; S.dlg = null; S.phone = null; S.gun = false; R.grace = S.t + 15; R.lastSeen = null; R.wasChase = false;   // released by Elf's house
    const hp = proj(S.x, S.y); S.cam = [hp[0] - VIEW.W / 2, hp[1] - VIEW.H / 2 - 50]; S.camV = [0, 0];
    R.units.forEach((q) => { q.st = 'patrol'; q.sus = 0; q.lost = 0; q.goal = null; });
  }
  function raidStep(S) {
    const R = S.raid; if (!R) return; const t = S.t;
    DYN.length = 0; R.cars.forEach((c) => DYN.push([c.x - 150, c.y - 62, c.x + 150, c.y + 62]));   // the cars block paths (and bodies)
    if (R.st === 'wait') { if (t >= R.t0) { R.st = 'coming'; ev(S, { k: 'raidsiren', x: R.cars[0].tx, y: R.cars[0].y }); toast(S, '🚨 Сирены! Со стороны дома Коли въезжают полиция и военные…', 'big'); } return; }
    R.cars.forEach((c) => { if (c.park) return; const dir = c.dir || -1, d = (c.tx - c.x) * dir; c.v = Math.min(c.vmax, Math.max(60, d * 1.5)); c.x += dir * Math.min(d, c.v * DT);
      if ((c.tx - c.x) * dir < 0.5) { c.x = c.tx; c.park = true; c.v = 0; ev(S, { k: 'cardoor', x: c.x, y: c.y });
        if (c.extra) { for (let k = 0; k < 2; k++) { const u = newUnit(S, R.units.length, 'police', k, c.x - 60 + 120 * k, c.y + 90, 'alert'); u.wa = Math.PI * 0.75; R.units.push(u); }
          say(S, 'raid' + (R.units.length - 1), 'Где этот яичный террорист?!', 2.6); } } });
    if (R.st === 'coming' && R.cars.every((c) => c.park)) { R.st = 'search';
      R.units = RAID.units.map((d, i) => { const c = R.cars[d.car]; return newUnit(S, i, d.kind, i, c.x - 40 + 80 * (i % 2), c.y + 110 + 60 * (i % 2)); });
      say(S, 'raid2', 'Рассредоточиться! Ищем парня в чёрной худи.', 3); }
    if (R.reinfAt >= 0 && t >= R.reinfAt) { R.reinfAt = -1; R.extra++; const lx = R.lastSeen ? R.lastSeen[0] : S.x;
      R.cars.push({ x: X0 - 1500, y: 0, tx: freeSpot(S, lx - 350), dir: 1, tex: 'car_police', v: 0, park: false, vmax: 1100, extra: true });
      ev(S, { k: 'raidsiren', x: X0, y: 0 }); toast(S, '🚨 Подкрепление! Ещё одна машина едет мстить за яйца', 'big'); }
    R.units.forEach((u) => {
      u.mv = 0; u.run = 0;
      if ((u.stunT || -99) > t) { u.v = 0; u.wa += DT * 6 * Math.sin(t * 7 + u.i); u.ang = scrAng(Math.cos(u.wa), Math.sin(u.wa)); u.moving = 0; u.gA = (u.gA || 0) * (1 - Math.min(1, 8 * DT)); return; }   // deafened by a firecracker
      const sp = RAID.say[u.kind], vis = raidSees(S, u), dK = Math.hypot(S.x - u.x, S.y - u.y);
      if (u.st !== 'chase') { u.sus = Math.max(0, Math.min(1, u.sus + (vis > 0 ? DT * (0.8 + 2.5 * vis) * (S.costume ? 0.7 : 1) : -DT * 0.35)));   // v10: they look for a boy in a hoodie — a costume buys time
        if (vis > 0 && dK < 75) u.sus = 1;
        if (u.sus >= 1) raidChase(S, u);
        else if (u.sus > 0.3 && vis > 0) { u.stareT = t + 1.2; if (!u.hmm) { u.hmm = 1; say(S, 'raid' + u.i, pickL(sp.hmm, S.steps * 0.41 + u.i), 1.8); } }
        if (u.sus < 0.05) u.hmm = 0; }
      if (u.st === 'chase') {
        if (vis > 0) { u.lost = 0; R.lastSeen = [S.x, S.y]; R.seenT = t; } else u.lost += DT;
        const tgt = S.hidden && u.lost < 1.2 && S.hideAt ? [S.hideAt[0], S.hideAt[1] + 40] : (u.lost < 0.6 ? [S.x, S.y] : R.lastSeen);
        if (S.hidden && u.lost < 1.2 && S.hideAt) u.lost = 0;                                          // hid right in front of him: he goes to look
        u.chT += DT; uGo(S, u, tgt, u.chT > 6 ? RAID.TIRED : RAID.RUN[u.kind]);                         // out of breath after 6 s
        if (R.grace <= t && S.hp > 0 && !S.finale && (dK < RAID.CATCH || (S.hidden && S.hideAt && Math.hypot(u.x - S.hideAt[0], u.y - S.hideAt[1] - 40) < 60 && u.lost < 1.2))) { raidArrest(S, u); return; }
        if (u.lost > 2.6) { u.st = 'search'; u.t1 = t; u.goal = null; u.sus = 0.3; } }
      else if (u.st === 'alert') { const g = u.alertAt || R.lastSeen; if (!g || uGo(S, u, g, RAID.ALERT)) { u.st = 'search'; u.t1 = t; u.alertAt = null; } }
      else if (u.st === 'search') { const g = R.lastSeen;
        if (g && Math.hypot(g[0] - u.x, g[1] - u.y) > 30 && t - u.t1 < 6) uGo(S, u, g, RAID.ALERT);
        else { if (!u.look) u.look = t; u.wa += DT * 1.5 * Math.cos((t - u.look) * 0.9); }
        if (t - u.t1 > 9) { u.st = 'patrol'; u.look = 0; u.goal = null; say(S, 'raid' + u.i, pickL(sp.lost, S.steps * 0.23 + u.i), 2.2); R.lastSeen = null; } }
      else if (u.st === 'inspect') { const n = S.npc.find((q) => q.id === u.npc);
        if (!n) { u.st = 'patrol'; return; }
        n.pause = Math.max(n.pause, 0.5); const pair = sp.ask[u.askI % sp.ask.length];
        if (!u.t1) { if (uGo(S, u, [n.x + (u.x < n.x ? -70 : 70), n.y + 10], RAID.V * 1.2) || Math.hypot(n.x - u.x, n.y - u.y) < 85) { u.t1 = t; say(S, 'raid' + u.i, pair[0], 2.2); } }
        else { u.wa = turnTo(u.wa, Math.atan2(n.y - u.y, n.x - u.x), 4 * DT); const a = t - u.t1;
          if (a >= 1.9 && a - DT < 1.9) { n.talkT = t; n.line = pickL(RAID.reply, t * 1.7 + n.i); n.pause = 3; }
          if (a >= 3.8 && a - DT < 3.8) say(S, 'raid' + u.i, pair[1], 2.2);
          if (a > 6) { u.st = 'patrol'; u.t1 = 0; u.lastInsp = t; R.insp[n.id] = t; } } }
      else {                                                                                   // patrol: route legs, a look around at each point
        if (t < u.stareT && u.sus > 0.05) u.wa = turnTo(u.wa, Math.atan2(S.y - u.y, S.x - u.x), 2.5 * DT);  // something moved: stop and stare
        else if (u.pause > 0) { u.pause -= DT; u.wa += DT * 1.1 * Math.sin(t * 1.2 + u.i); }
        else { const route = RAID.units[u.route % RAID.units.length].route, g = route[u.k % route.length];
          if (uGo(S, u, g, RAID.V)) { u.k = (u.k + 1) % route.length; u.pause = 1.4 + 1.2 * h1(u.i + u.k); u.goal = null; }
          if (t - u.lastInsp > 16) { const n = S.npc.find((q) => !NPCS[q.i].stat && !(t - (R.insp[q.id] || -99) < 50) && Math.hypot(q.x - u.x, q.y - u.y) < 280
              && !R.units.some((o) => o.st === 'inspect' && o.npc === q.id));
            if (n) { u.st = 'inspect'; u.npc = n.id; u.t1 = 0; u.goal = null; u.askI = Math.floor(h1(t * 0.7 + u.i) * 8); } } } }
      if (!u.mv) u.v = Math.max(0, u.v - RAID.ACC * 1.6 * DT);
      u.moving = u.v > 35 ? 1 : u.v < 12 ? 0 : (u.moving || 0);
      u.ang = scrAng(Math.cos(u.wa), Math.sin(u.wa)); u.gA = (u.gA || 0) + ((u.moving ? 1 : 0) - (u.gA || 0)) * Math.min(1, 8 * DT);
      // drawn direction (8 yaws) with hysteresis: no flicker between two neighbouring views
      { const ph = Math.atan2(2 * Math.sin(u.ang), Math.cos(u.ang)), s8 = Math.PI / 4, nb = ((Math.round(ph / s8) % 8) + 8) % 8;
        if (u.d8 === undefined) u.d8 = nb; else if (nb !== u.d8 && Math.abs(angW(ph - u.d8 * s8)) > s8 / 2 + 0.12) u.d8 = nb; }
      { const sb = Math.floor(u.gph * 2); if (u.stepB !== undefined && sb !== u.stepB && dK < 900) ev(S, { k: 'step', x: u.x, y: u.y, foot: sb & 1, npc: 1, boots: 1 }); u.stepB = sb; } });
    // a chase that ends without an arrest counts as an escape (the «Неуловимый» achievement)
    if (R.units.some((u) => u.st === 'chase')) R.wasChase = true; else if (R.wasChase) { R.wasChase = false; achAdd(S, 'elusive'); toast(S, 'Ушёл от погони!'); }
    // they don't walk through each other: pairs closer than 46 are pushed apart (never into a wall or a car)
    const U = R.units; U.forEach((u) => pushOut(u, 22)); for (let a = 0; a < U.length; a++) for (let b = a + 1; b < U.length; b++) { const p = U[a], q = U[b], dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
      if (d >= 46) continue; const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0, k = (46 - d) / 2;
      for (const [o, sgn] of [[p, -1], [q, 1]]) { const ox = o.x, oy = o.y; o.x += nx * k * sgn; o.y += ny * k * sgn; pushOut(o, 22); if (blocked(o.x, o.y, 12)) { o.x = ox; o.y = oy; } } }
  }
  // a parking spot for a reinforcement car: in the middle lane, at least a car and a gap away from every other car
  function freeSpot(S, x) { const cars = S.raid.cars.map((c) => [c.tx === undefined ? c.x : c.tx, c.y]).concat(CARS.map(([cx, cy]) => [cx, cy]));
    for (let k = 0; k < 24; k++) { const tx = Math.max(-200, Math.min(5600, x + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 230)); if (cars.every(([cx, cy]) => Math.abs(cx - tx) > 430 || Math.abs(cy) > 200)) return tx; }
    return Math.max(-200, Math.min(5600, x)); }
  function courierStep(S) {
    const c = S.courier; if (!c) return; const t = S.t, id = c.mod || 'kirill', h = MODH[id], mk = M(S, id), d = [h.door[0] + 30, FACADE + 70];
    c.gA = (c.gA || 0) + ((c.mv ? 1 : 0) - (c.gA || 0)) * Math.min(1, 7 * DT); c.mv = 0; if (c.ang === undefined) { c.ang = KA; c.gph = 0; }
    const go = (g, v) => { const dx = g[0] - c.x, dy = g[1] - c.y, l = Math.hypot(dx, dy); if (l < 6) return true; c.x += dx / l * v * DT; c.y += dy / l * v * DT; c.walk += v * DT;
      c.ang = turnTo(c.ang, scrAng(dx, dy), 8 * DT); c.gph += v * DT / 95; c.mv = 1; c.face = [Math.cos(c.ang) >= 0 ? 1 : -1, Math.sin(c.ang) >= 0 ? 1 : -1]; return false; };
    if (c.st === 'wait') { if (t > c.t0) c.st = 'come'; return; }
    if (c.st === 'come') { const wp = c.leg ? d : [h.gate, SWN[0] + 30]; if (go(wp, 170)) { if (c.leg) { c.st = 'argue'; c.t1 = t; } else c.leg = 1; } }
    if (c.st === 'argue') { c.ang = turnTo(c.ang, scrAng(h.door[0] - c.x, h.door[1] - 10 - c.y), 6 * DT); const a = t - c.t1, lines = [[0, 'courier', `10 пицц «Пепперони» для ${MODS[id].gen}!`],
        [2.6, id, LN[id].pizza1], [5.2, 'courier', 'Оплата при получении: 4990 ₽.'], [7.8, id, LN[id].pizza2]];
      if (a < 0.02) { mk.st = 'out'; mk.t0 = t; }
      for (const [tt, who, text] of lines) if (a >= tt && a - DT < tt) say(S, who, text, 2.5);
      if (a > 3) { mk.st = 'out'; mk.t0 = t - 1; }
      if (a > 10.4) { c.st = 'leave'; addPrank(S, id, 'pizza'); achieve(S, 'pizza'); } }
    if (c.st === 'leave') { if (go([h.gate - 1600, 120], 190)) S.courier = null; }
  }
  function kidsStep(S) {
    const c = S.kids; if (!c) return; const t = S.t, id = c.mod || 'kirill', h = MODH[id], mk = M(S, id);
    if (!c.list) c.list = [0, 1, 2].map((i) => ({ x: h.gate - 900 + i * 60, y: 260 + i * 25, walk: 0, face: [1, 1], i, ang: KA, gph: 0.3 * i, gA: 0 }));
    const tgt = (i) => [h.door[0] - 60 + i * 55, FACADE + 110 + (i % 2) * 30];
    c.list.forEach((q) => { const g = c.st === 'leave' ? (q.leg === 2 ? [h.gate + 1400, 280] : [h.gate + 30 - q.i * 30, SWN[0] + 40]) : (q.leg ? tgt(q.i) : [h.gate - 30 + q.i * 30, SWN[0] + 40]);
      const dx = g[0] - q.x, dy = g[1] - q.y, l = Math.hypot(dx, dy);
      q.gA += ((q.mv ? 1 : 0) - q.gA) * Math.min(1, 7 * DT);
      if (l > 5) { q.x += dx / l * 120 * DT; q.y += dy / l * 120 * DT; q.walk += 120 * DT; q.gph += 120 * DT / 62; q.ang = turnTo(q.ang, scrAng(dx, dy), 8 * DT); q.face = [Math.cos(q.ang) >= 0 ? 1 : -1, Math.sin(q.ang) >= 0 ? 1 : -1]; q.mv = 1; }
      else { q.mv = 0; q.ang = turnTo(q.ang, scrAng(h.door[0] - q.x, h.door[1] - q.y), 5 * DT); if (c.st !== 'leave' && !q.leg) q.leg = 1; if (c.st === 'leave') q.leg = 2; } });
    const a = t - c.t0;
    if (c.st === 'come' && a > 10) { c.st = 'knock'; c.t1 = t; }
    if (c.st === 'knock') { const b = t - c.t1; [[0, 'kid', 'Где бесплатные конфеты?!'], [2.5, id, LN[id].kids], [5, 'kid', 'На фонарях написано!']].forEach(([tt, who, text]) => { if (b >= tt && b - DT < tt) say(S, who, text, 2.3); });
      if (b < 0.02) { mk.st = 'out'; mk.t0 = t; } if (b > 3) { mk.st = 'out'; mk.t0 = t - 1; } if (b > 8) { c.st = 'leave'; c.t2 = t; } }
    if (c.st === 'leave' && t - c.t2 > 14) S.kids = null;
  }
  // phone UI actions (the scene sends the clicked control as inp.phone)
  function phoneAction(S, a) {
    const p = S.phone;
    if (a === 'home') { p.app = p.app === 'dm' ? (p.back || 'contacts') : 'home'; p.at = S.t; p.scroll = 0; return; }
    if (a === 'close') { S.phone = null; return; }
    if (a.startsWith('dm_')) { p.back = p.app === 'chats' ? 'chats' : 'contacts'; p.app = 'dm'; p.who = a.slice(3); p.at = S.t; p.scroll = 0; S.dm[p.who] = S.dm[p.who] || []; S.msgs.forEach((m) => { if (p.who === GROUP ? m.group : (m.from === p.who && !m.group)) m.read = true; }); return; }
    if (a === 'loan') { takeLoan(S, p.who); return; }
    if (a === 'vplay') { S.vplayReq = S.t; return; }                                   // v12: the page plays Elf's voice note
    if (a === 'repay') { repayLoan(S, p.who); return; }
    if (['map', 'chats', 'shop', 'pizza', 'light', 'orders', 'contacts', 'dev', 'ach'].includes(a)) {
      if (a === 'chats' && S.rai.virus && S.rai.virus.st === 'pending') { S.rai.virus = { st: 'download', t0: S.t }; ev(S, { k: 'download', x: S.x, y: S.y }); } if (a === 'light') { S.light = !S.light; ev(S, { k: S.light ? 'lighton' : 'lightoff', x: S.x, y: S.y }); return; } p.app = a; p.at = S.t; p.scroll = 0; if (a === 'chats') S.msgs.forEach((m) => (m.read = true)); return; }
    if (a.startsWith('buy_')) { const it = SHOP.find((s) => s.id === a.slice(4)); if (!it) return; if (S.money < it.price) { toast(S, 'Не хватает денег'); return; }
      S.money -= it.price; S.inv[it.give[0]] += it.give[1]; ev(S, { k: 'buy', id: it.id, x: S.x, y: S.y }); toast(S, `Куплено: ${it.name}`); return; }
    if (a === 'order_pizza') { const id = S.target; if (!id) { toast(S, 'Пиццерия: «А адрес какой?» (сначала постучи к модеру)'); return; }
      const mk = M(S, id); if (S.courier || mk.pr.pizza) { toast(S, 'Пиццерия: «Заказ на этот адрес уже был»'); return; }
      if (mk.done >= 0 || mk.sweet) { toast(S, `Пиццерия: к ${MODS[id].dat} больше не повезём`); return; }
      S.courier = { st: 'wait', t0: S.t + 4, x: MODH[id].gate - 1500, y: 140, walk: 0, face: [1, 1], mod: id }; toast(S, `Пиццерия «Тыква»: 10 пицц на адрес ${MODS[id].gen}. Курьер уже едет 🍕`); S.phone = null; return; }
    if (a === 'scroll_up') p.scroll = Math.max(0, p.scroll - 1);
    if (a === 'scroll_down') p.scroll = p.scroll + 1;
  }

  // ---------------- attract demo ----------------
  // goto/aim in world units; the demo state starts with Kirill already refusing (so pranks count) and eggs in hand
  const SCRIPT = [[0, { goto: [2350, -150] }], [3.4, { goto: [2700, -160] }], [5.8, { throwAt: [2780, 120] }], [6.9, { throwAt: [2900, 90] }], [8.0, { throwAt: [2650, 150] }],
    [9.5, { goto: [2700, 120] }], [12.5, { goto: [2300, 250] }], [15.0, { goto: [1650, 255] }], [18.5, { goto: [1900, -40] }]];
  const scriptInput = (t, S) => { const inp = {}; if (S.steps === 0) inp.setup = 1; for (const [tt, a] of SCRIPT) if (t >= tt && t - DT < tt) {
      if (a.goto) inp.goto = a.goto;
      if (a.throwAt) { const [x, z] = a.throwAt; const sc = proj(x, FACADE, z); inp.aimS = sc; } }
    return inp; };
  let cache = null;
  function demoCreate(loop) { const S = Object.assign(create(), { wt0: loop * L }); S.kir.refused = true; S.inv.eggs = 12; S.x = 1900; S.y = -40;
    const hp = proj(S.x, S.y); S.cam = [hp[0] - VIEW.W / 2, hp[1] - VIEW.H / 2 - 50]; return S; }
  function demoStep(S) { step(S, scriptInput(S.t, S)); }
  function at(t) {
    const loop = Math.floor(t / L), q = t - loop * L, f = q / DT, n = Math.floor(f);
    if (!cache || cache.loop !== loop || cache.S.steps > n) cache = { loop, S: demoCreate(loop), P: null };
    const S = cache.S; while (S.steps < n) { cache.P = snap(S); demoStep(S); }
    return Object.assign({}, lerpState(cache.P, S, f - n), { loop, phase: q });
  }
  const demoCheck = (S) => S.kir.p >= 6;
  function selfCheck() { const out = []; grid();
    const pts = [[HKO.door[0], FACADE + 110], HK.door, HR.door, ...NPCS.filter((n) => n.route).map((n) => n.route[0]), ...ROTTENS, STRANGE, ...VPUMPKINS, ...MONEY.map((m) => [m[0], m[1]])];
    pts.forEach((p) => { if (blocked(p[0], p[1], 4)) out.push('blocked point ' + p); });
    [HK.door, HR.door, HR.mail, HE.door, HE.mail, HKO.door, ...RAID.units.flatMap((u) => u.route), ...ROTTENS, STRANGE, VPUMPKINS[0], VPUMPKINS[2], [6560, -1000]].forEach((p) => { if (!findPath([1900, -40], p).length) out.push('unreachable ' + p); });
    return out; }

  function achProgress(S, id) { const v = S.achv || {}, n = (ACHI[id] || {}).n;
    if (id === 'social') return [Math.min(5, S.q.talk), 5]; if (id === 'grandson') return [S.vp.filter((x) => x >= 0).length, 3];
    if (id === 'master') return [(v.kinds || []).length, 10];
    if (id === 'rotten_hunter') return [Math.min(10, Math.max(0, ...Object.keys(v).filter((k) => k.startsWith('eggs_')).map((k) => v[k]))), 10];
    return n ? [Math.min(n, v[id] || 0), n] : null; }
  root.SIM = { VERSION, chatList, FEST, FSTALLS, FPOLES, FCROWD, FLINES, STAGEP, FUI, CARVE, APPLE, RIVALS, JUDGES, GACHA, GPOOL, COS5, allCostumes, appleUp, applePos, carveScore, INTRO_SKIP, startIntro, inPlaza, festAt, newFest, introScript, festNear, hintLine, COSTUMES, rainAt, RAINW, ACH, ACHI, achProgress, chalkPts, BOWL, CATSPOTS, LAMPHEAD, lampLit, GARAGE, peaceful, inLampLight, houseNear, HKO, CONTACTS, LOANS, LOAN_DUE, allMods, raidBeam, runDev, DEVHELP, kirillWinT, DT, L, K, VIEW, HINT, C, SN, proj, unproj, ROAD, SWN, SWS, X0, X1, FACADE, HOUSES, HK, ALLEY, ENDLOT, DARK, LAMPS, TREES, CARS, BINS, BENCHES, BUSHES, PILES, FENCES,
    FENCE_Y, MONEY, VPUMPKINS, ROTTEN, ROTTENS, STRANGE, HR, HE, RAID, raidSees, raidCrowd, newRaid, MODS, MODIDS, MODH, GIFTS, JUNK, raivaCamT, watchOn, boosted, modNear, SHOP, SLOTS, SLOT_NAME, PRANK, NPCS, BOX, CIRC, maskHit, windAt, gustAt, clockStr, kirillWindow, KVIEWS, inYard, nearHidingSpot, lampNear,
    create, spawn, respawn, outOfPlay, step, at, pick, snap, lerpState, PROPS, NDECOR, NFENCE, NDIV, NGATE, NSOLID, nsBox, YTREES, NTREES, HUD, houseRect, treeRect, aimTarget, THROW_R, dlgLayout, phoneLayout, scriptInput, demoCheck, selfCheck, findPath, chalkShape, toast };
  if (typeof module !== 'undefined') module.exports = root.SIM;
})(typeof window !== 'undefined' ? window : globalThis);
