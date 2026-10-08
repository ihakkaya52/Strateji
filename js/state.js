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
  for (const [vassal, lord] of Object.entries(W.vassals || {})) S.nations[vassal].overlord = lord;
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
    overlord: null,         // vasalsa efendisi
    tribute: 0.25,          // vasalın efendisine verdiği insan gücü payı
    rebelFrom: null,        // bağımsızlık savaşı verdiği eski efendi
    atkMult: 1, defMult: 1, mpMult: 1,
    focus: { cur: null, prog: 0, done: new Set() },
    armyNo: 0,
    armyTarget: 3,
    alive: true,
  };
  G.labelsDirty = true;
  return S.nations[tag];
};

G.nation = tag => G.S.nations[tag];
G.atWar = (a, b) => !!(a && b && a !== b && G.S.nations[a] && G.S.nations[a].enemies.has(b));

// Vasallık: bir ülkenin en üstteki efendisi ve onun tüm diyarı
G.topLord = tag => {
  let t = tag, n = G.S.nations[t], guard = 0;
  while (n && n.overlord && guard++ < 8) { t = n.overlord; n = G.S.nations[t]; }
  return t;
};
G.sameRealm = (a, b) => !!(a && b && G.topLord(a) === G.topLord(b));
G.vassalsOf = tag => Object.values(G.S.nations).filter(n => n.alive && n.overlord === tag).map(n => n.tag);
G.realm = tag => {
  const top = G.topLord(tag);
  return Object.values(G.S.nations).filter(n => n.alive && G.topLord(n.tag) === top).map(n => n.tag);
};

// Bir ülke bu eyalete girebilir mi? Kendi diyarı ve düşman toprağı serbest; diğer ülkelere geçiş hakkı yok.
G.canEnter = (tag, p) => {
  if (p.kind === 'waste') return false;
  return p.ctrl === tag || p.owner === tag || G.atWar(tag, p.ctrl) || G.atWar(tag, p.owner) ||
    G.sameRealm(tag, p.ctrl);
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
  return m * (G.S.nations[tag] ? G.S.nations[tag].mpMult : 1);
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
  const A = new Set(G.warSide(a, b)), B = new Set(G.warSide(b, a));
  let wa = 0, ta = 0, wb = 0, tb = 0;
  for (const p of G.S.provinces) {
    const w = G.provinceWeight(p);
    if (B.has(p.owner)) { tb += w; if (A.has(p.ctrl)) wa += w; }
    if (A.has(p.owner)) { ta += w; if (B.has(p.ctrl)) wb += w; }
  }
  const sa = tb ? wa / tb * 100 : 0;
  const sb = ta ? wb / ta * 100 : 0;
  return Math.round(G.clamp(sa - sb, -100, 100));
};

// a'nın b'ye karşı savaştaki tarafı: a ve a'nın diyarında b ile savaşta olanlar
G.warSide = (a, b) => G.realm(a).filter(t => t === a || G.atWar(t, b) || G.realm(b).some(x => G.atWar(t, x)));

G.declareWar = function (a, b, silent) {
  const S = G.S, na = S.nations[a], nb = S.nations[b];
  if (!na || !nb || a === b || na.enemies.has(b)) return;
  if (G.sameRealm(a, b)) return;   // efendi ile vasal birbirine bu yolla savaş açamaz
  const A = G.realm(a), B = G.realm(b);
  for (const x of A) for (const y of B) {
    const nx = S.nations[x], ny = S.nations[y];
    if (nx.enemies.has(y)) continue;
    nx.enemies.add(y); ny.enemies.add(x);
    nx.warStart[y] = ny.warStart[x] = S.hour;
  }
  if (!silent) {
    const allies = [...A, ...B].filter(t => t !== a && t !== b).map(t => S.nations[t].name);
    G.log(`${na.name}, ${nb.name}'a savaş ilan etti!` + (allies.length ? ` (${allies.join(', ')} da savaşa girdi)` : ''),
      'war', [...A, ...B]);
  }
  G.mapDirty = true;
};

// Vasal efendisine karşı bağımsızlık ilan eder
G.declareIndependence = function (tag) {
  const S = G.S, n = S.nations[tag], lord = n.overlord;
  if (!lord) return;
  n.overlord = null;
  n.rebelFrom = lord;
  // vasalın kendi vasalları onunla kalır; efendinin ordusu vasalın topraklarından çekilir
  G.evacuateArmies();
  G.labelsDirty = true;
  G.declareWar(tag, lord, true);
  G.log(`${n.name}, ${S.nations[lord].name} tacına karşı bağımsızlığını ilan etti!`, 'war', [tag, lord]);
};

// İki ülke arasında tekil barış
function peacePair(a, b, transfer) {
  const S = G.S, na = S.nations[a], nb = S.nations[b];
  if (!na.enemies.has(b)) return 0;
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
  return moved;
}

// Barış: transfer=true ise işgal edilen topraklar işgalciye geçer. Diyarlar birlikte barışır.
G.makePeace = function (a, b, transfer) {
  const S = G.S, na = S.nations[a], nb = S.nations[b];
  if (!na.enemies.has(b)) return;
  // bağımsızlık savaşı sonucu
  let indep = null;
  for (const [rebel, lord] of [[a, b], [b, a]]) {
    if (S.nations[rebel].rebelFrom === lord) {
      const score = G.warScore(rebel, lord);
      indep = { rebel, lord, won: score >= 0 || !transfer };
    }
  }
  const A = G.warSide(a, b), B = G.warSide(b, a);
  let moved = 0;
  for (const x of A) for (const y of B) moved += peacePair(x, y, transfer);
  if (indep) {
    const nr = S.nations[indep.rebel];
    nr.rebelFrom = null;
    if (indep.won) {
      G.log(`${nr.name} bağımsızlığını kazandı!`, 'good', [indep.rebel, indep.lord]);
    } else {
      nr.overlord = indep.lord;
      G.log(`${nr.name} yeniden ${S.nations[indep.lord].name} tacına boyun eğdi.`, 'war', [indep.rebel, indep.lord]);
    }
  }
  for (const tag of [...A, ...B]) {
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
  for (const v of G.vassalsOf(tag)) S.nations[v].overlord = null;
  n.overlord = null;
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
      for (const v of G.vassalsOf(n.tag)) S.nations[v].overlord = null;
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
