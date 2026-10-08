// Oyun durumu: eyaletler, ülkeler, ordular ve temel sorgular
'use strict';

const ARMY_MEN = 6000;          // standart ordu mevcudu
const RECRUIT_COST = 6000;      // yeni ordu için insan gücü
const RECRUIT_DAYS = 60;        // eğitim süresi
const TRUCE_DAYS = 5 * 365;     // barış sonrası ateşkes
// Tarihî duruma göre ek başlangıç orduları
const START_BONUS = { SEL: 5, BYZ: 4, FAT: 2, SNG: 4, LIA: 3, KIE: 2 };

G.ARMY_MEN = ARMY_MEN;
G.RECRUIT_COST = RECRUIT_COST;
G.RECRUIT_DAYS = RECRUIT_DAYS;

G.initState = function (playerTag) {
  const W = window.WORLD;
  const S = G.S = {
    time: { y: 1040, m: 0, d: 1, h: 0 },
    hour: 0,                // başlangıçtan beri geçen saat
    speed: 3,
    paused: true,
    player: playerTag,
    provinces: [],
    nations: {},
    armies: [],
    nextArmyId: 1,
    battles: new Map(),     // "hedef|saldıran" -> savaş bilgisi
    firedEvents: new Set(),
    over: false,
  };

  for (const p of W.provinces) {
    S.provinces.push({
      ...p,
      ctrl: p.owner,
      siege: null,          // {by, progress, need}
      nbDist: p.nb.map(n => G.distKm(p, W.provinces[n])),
    });
  }

  for (const [tag, n] of Object.entries(W.nations)) G.addNation(tag, n);
  for (const p of S.provinces) {
    if (p.kind === 'capital') S.nations[p.owner].capital = p.id;
  }
  for (const n of Object.values(S.nations)) {
    n.manpower = Math.round(G.monthlyManpower(n.tag) * 8 + 4000);
  }

  // Başlangıç orduları
  for (const n of Object.values(S.nations)) {
    const provs = S.provinces.filter(p => p.owner === n.tag);
    const cities = provs.filter(p => p.kind !== 'rural');
    let count = Math.round(provs.length / 5) + (n.major ? 4 : 1);
    count = G.clamp(count, 1, n.major ? 22 : 9) + (START_BONUS[n.tag] || 0);
    n.armyTarget = count;
    for (let i = 0; i < count; i++) {
      const p = i === 0 ? S.provinces[n.capital] : G.pick(cities.length ? cities : provs);
      G.createArmy(n.tag, p.id);
    }
  }

  // 1040: Dandanakan'ın ardından Selçuklu-Gazneli savaşı sürüyor; Gazneli ordusu dağınık
  G.declareWar('SEL', 'GAZ', true);
  for (const a of S.armies) if (a.tag === 'GAZ') { a.org = 65; a.men = ARMY_MEN * 0.8; }
  return S;
};

G.addNation = function (tag, def) {
  const S = G.S;
  S.nations[tag] = {
    tag,
    name: def.name, color: def.color, major: !!def.major, ruler: def.ruler,
    religion: def.religion, group: def.group,
    cav: G.GROUP_CAV[def.group] ?? 0.25,
    capital: def.capital ?? null,
    manpower: def.manpower ?? 0,
    enemies: new Set(),
    warStart: {},           // düşman -> başlangıç saati
    truces: {},             // ülke -> bitiş saati
    queue: [],              // eğitimdeki ordular: {done}
    armyNo: 0,
    armyTarget: 3,
    alive: true,
  };
  G.labelsDirty = true;
  return S.nations[tag];
};

G.nation = tag => G.S.nations[tag];
G.atWar = (a, b) => !!(a && b && a !== b && G.S.nations[a] && G.S.nations[a].enemies.has(b));

// Bir ülke bu eyalete girebilir mi? (askeri geçiş hakkı yok: yalnızca kendi ve düşman toprağı)
G.canEnter = (tag, p) => {
  if (p.kind === 'waste') return false;
  return p.ctrl === tag || p.owner === tag || G.atWar(tag, p.ctrl) || G.atWar(tag, p.owner);
};

G.armiesIn = pid => G.S.armies.filter(a => a.prov === pid);
G.hostileArmiesIn = (pid, tag) => G.S.armies.filter(a => a.prov === pid && G.atWar(tag, a.tag));

G.ordinal = n => `${n}.`;

G.createArmy = function (tag, pid, men = ARMY_MEN) {
  const S = G.S, n = S.nations[tag];
  n.armyNo++;
  const a = {
    id: S.nextArmyId++, tag, name: `${G.ordinal(n.armyNo)} Ordu`,
    prov: pid, men, maxMen: ARMY_MEN, org: 100,
    cav: n.cav, path: [], prog: 0, attacking: null, besieging: false,
    sel: false, aiTarget: null,
  };
  S.armies.push(a);
  return a;
};

G.removeArmy = function (a) {
  const S = G.S;
  const i = S.armies.indexOf(a);
  if (i >= 0) S.armies.splice(i, 1);
  if (G.selected) G.selected.delete(a);
};

G.armySpeed = a => 3.2 + 3.2 * a.cav;   // km/saat

G.monthlyManpower = function (tag) {
  let m = 0;
  for (const p of G.S.provinces) {
    if (p.owner === tag && p.ctrl === tag) {
      m += p.kind === 'capital' ? 900 : p.kind === 'city' ? 380 : 140;
    }
  }
  return m;
};

G.nationStats = function (tag) {
  const S = G.S;
  let provs = 0, cities = 0, occupied = 0;
  for (const p of S.provinces) {
    if (p.owner === tag) {
      provs++;
      if (p.kind !== 'rural') cities++;
      if (p.ctrl !== tag) occupied++;
    }
  }
  let armies = 0, men = 0;
  for (const a of S.armies) if (a.tag === tag) { armies++; men += a.men; }
  return { provs, cities, occupied, armies, men };
};

G.provinceWeight = p => p.kind === 'capital' ? 6 : p.kind === 'city' ? 2 : 1;

// a'nın b'ye karşı savaş skoru (-100..100)
G.warScore = function (a, b) {
  let wa = 0, ta = 0, wb = 0, tb = 0;
  for (const p of G.S.provinces) {
    const w = G.provinceWeight(p);
    if (p.owner === b) { tb += w; if (p.ctrl === a) wa += w; }
    if (p.owner === a) { ta += w; if (p.ctrl === b) wb += w; }
  }
  const sa = tb ? wa / tb * 100 : 0;
  const sb = ta ? wb / ta * 100 : 0;
  return Math.round(G.clamp(sa - sb, -100, 100));
};

G.declareWar = function (a, b, silent) {
  const S = G.S, na = S.nations[a], nb = S.nations[b];
  if (!na || !nb || a === b || na.enemies.has(b)) return;
  na.enemies.add(b); nb.enemies.add(a);
  na.warStart[b] = nb.warStart[a] = S.hour;
  if (!silent) G.log(`${na.name}, ${nb.name}'a savaş ilan etti!`, 'war', [a, b]);
  G.mapDirty = true;
};

// Barış: transfer=true ise işgal edilen topraklar işgalciye geçer
G.makePeace = function (a, b, transfer) {
  const S = G.S, na = S.nations[a], nb = S.nations[b];
  if (!na.enemies.has(b)) return;
  na.enemies.delete(b); nb.enemies.delete(a);
  const until = S.hour + TRUCE_DAYS * 24;
  na.truces[b] = nb.truces[a] = until;
  let moved = 0;
  for (const p of S.provinces) {
    if ((p.owner === a && p.ctrl === b) || (p.owner === b && p.ctrl === a)) {
      if (transfer) { p.owner = p.ctrl; moved++; } else p.ctrl = p.owner;
    }
    if (p.siege && ((p.siege.by === a && (p.ctrl === b)) || (p.siege.by === b && p.ctrl === a))) p.siege = null;
  }
  for (const tag of [a, b]) {
    const n = S.nations[tag];
    if (n.capital != null && S.provinces[n.capital].owner !== tag) G.relocateCapital(tag);
  }
  G.evacuateArmies();
  G.labelsDirty = true; G.mapDirty = true;
  G.log(transfer
    ? `${na.name} ile ${nb.name} barış imzaladı. ${moved} eyalet el değiştirdi.`
    : `${na.name} ile ${nb.name} beyaz barış yaptı.`, 'info', [a, b]);
  G.checkElimination();
};

// Artık girilemeyen topraklardaki orduları en yakın kendi toprağına çeker
G.evacuateArmies = function () {
  const S = G.S;
  for (const a of S.armies.slice()) {
    const p = S.provinces[a.prov];
    if (G.canEnter(a.tag, p)) continue;
    const dest = G.nearestOwn(a.tag, a.prov);
    if (dest == null) G.removeArmy(a);
    else { a.prov = dest; a.path = []; a.attacking = null; a.besieging = false; a.prog = 0; }
  }
};

// Genişlik öncelikli arama: en yakın kendi kontrolündeki eyalet
G.nearestOwn = function (tag, start) {
  const S = G.S, seen = new Set([start]), q = [start];
  while (q.length) {
    const id = q.shift(), p = S.provinces[id];
    if (p.ctrl === tag && p.owner === tag) return id;
    for (const n of p.nb) if (!seen.has(n)) { seen.add(n); q.push(n); }
  }
  for (const p of S.provinces) if (p.ctrl === tag) return p.id;
  return null;
};

G.relocateCapital = function (tag) {
  const S = G.S, n = S.nations[tag];
  let best = null;
  for (const p of S.provinces) {
    if (p.owner !== tag) continue;
    const score = (p.kind === 'capital' ? 3 : p.kind === 'city' ? 2 : 1) + (p.ctrl === tag ? 3 : 0);
    if (!best || score > best.s) best = { s: score, p };
  }
  n.capital = best ? best.p.id : null;
};

// Teslim olma: ülke ortadan kalkar, toprakları işgalcilere / galip tarafa geçer
G.capitulate = function (tag) {
  const S = G.S, n = S.nations[tag];
  if (!n.alive) return;
  const enemies = [...n.enemies];
  const occ = {};
  for (const p of S.provinces) if (p.owner === tag && p.ctrl !== tag && n.enemies.has(p.ctrl)) occ[p.ctrl] = (occ[p.ctrl] || 0) + 1;
  const winner = enemies.sort((x, y) => (occ[y] || 0) - (occ[x] || 0))[0];
  for (const p of S.provinces) {
    if (p.owner === tag) {
      p.owner = (p.ctrl !== tag && n.enemies.has(p.ctrl)) ? p.ctrl : winner;
      p.ctrl = p.owner; p.siege = null;
    } else if (p.ctrl === tag) {
      p.ctrl = p.owner;
    }
  }
  for (const e of [...n.enemies]) {
    S.nations[e].enemies.delete(tag);
  }
  n.enemies.clear();
  for (const a of S.armies.slice()) if (a.tag === tag) G.removeArmy(a);
  n.alive = false;
  for (const e of enemies) {
    const ne = S.nations[e];
    if (ne.capital == null || S.provinces[ne.capital].owner !== e) G.relocateCapital(e);
  }
  G.labelsDirty = true; G.mapDirty = true;
  G.log(`${n.name} teslim oldu! Toprakları ${S.nations[winner].name} ve müttefiklerine geçti.`, 'war', [tag, ...enemies]);
  if (tag === S.player) G.ui.gameOver(false);
  else if (enemies.includes(S.player)) G.ui.notify(`Zafer! ${n.name} teslim oldu.`);
};

G.checkElimination = function () {
  const S = G.S;
  const owned = {};
  for (const p of S.provinces) if (p.owner) owned[p.owner] = (owned[p.owner] || 0) + 1;
  for (const n of Object.values(S.nations)) {
    if (n.alive && !owned[n.tag]) {
      n.alive = false;
      for (const e of n.enemies) S.nations[e].enemies.delete(n.tag);
      n.enemies.clear();
      for (const a of S.armies.slice()) if (a.tag === n.tag) G.removeArmy(a);
      G.log(`${n.name} tarih sahnesinden silindi.`, 'war', [n.tag]);
      if (n.tag === S.player) G.ui.gameOver(false);
    }
  }
};

// Eyalet sahipliğini değiştir (olaylar için)
G.transferProvince = function (pid, tag) {
  const p = G.S.provinces[pid];
  p.owner = tag; p.ctrl = tag; p.siege = null;
  G.labelsDirty = true; G.mapDirty = true;
};

// Bir şehir ve ona bağlı kırsal eyaletler
G.cityAndRural = function (cityName) {
  return G.S.provinces.filter(p => p.name === cityName || p.home === cityName);
};

G.log = function (text, cls = 'info', tags = null) {
  const S = G.S;
  // Oyuncuyla ilgisi olmayan olayları büyük güç değilse gösterme
  if (tags && !tags.includes(S.player)) {
    const important = tags.some(t => S.nations[t] && S.nations[t].major);
    if (!important) return;
  }
  G.ui && G.ui.addLog(G.fmtDate(S.time, false), text, tags && tags.includes(S.player) ? cls : 'info');
};
