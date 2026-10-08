// Donanmalar: gemi türleri, tersaneler, deniz bölgeleri, deniz savaşı ve çıkarma
'use strict';

G.navy = {};
const N = G.navy;

const ALL = '*';
// hp: dayanıklılık, atk: saldırı, speed: km/saat, range: limandan uzaklaşabileceği deniz bölgesi sayısı,
// cap: taşıyabileceği asker, crew: mürettebat (denizci), days: inşa süresi,
// marines: geminin kendi savaşçıları (deniz piyadesi); filo düşman kıyısına saldırınca kendiliğinden çıkarma yapar
G.SHIP_TYPES = {
  sandal: { name: 'Çektiri', role: 'Hafif kürekli', hp: 30, atk: 3, marines: 60, speed: 9, range: 2, cap: 300, crew: 40, days: 25,
    groups: ALL, desc: 'Ucuz, hızlı, kıyıdan uzaklaşamaz.' },
  nakliye: { name: 'Nakliye Gemisi', role: 'Nakliye', hp: 40, atk: 0, marines: 0, speed: 6, range: 4, cap: 1200, crew: 30, days: 35,
    groups: ALL, desc: 'Her ülkenin yapabildiği basit yük gemisi.' },
  drakkar: { name: 'Drakkar', role: 'Akın gemisi', hp: 55, atk: 6, marines: 150, speed: 10, range: 5, cap: 500, crew: 60, days: 45,
    groups: ['iskandinav', 'anglosakson', 'kelt'], desc: 'Vikinglerin uzun gemisi: hızlı, sığ sularda bile yol alır.' },
  knarr: { name: 'Knarr', role: 'Okyanus nakliyesi', hp: 45, atk: 1, marines: 0, speed: 7, range: 7, cap: 1400, crew: 25, days: 40,
    groups: ['iskandinav', 'anglosakson', 'kelt'], desc: 'İzlanda\'ya kadar giden sağlam yük gemisi.' },
  koga: { name: 'Koga', role: 'Ağır nakliye', hp: 75, atk: 2, marines: 0, speed: 6, range: 6, cap: 2200, crew: 30, days: 60,
    groups: ['latin', 'slav', 'iskandinav', 'anglosakson'], desc: 'Yüksek bordalı, geniş ambarlı kuzey gemisi.' },
  kadirga: { name: 'Kadırga', role: 'Savaş gemisi', hp: 85, atk: 8, marines: 250, speed: 8, range: 3, cap: 500, crew: 150, days: 70,
    groups: ['latin', 'arap', 'berberi', 'bizans', 'kafkas', 'turk_yerlesik', 'iran', 'turk_bozkir'],
    desc: 'Akdeniz\'in kürekli savaş gemisi.' },
  dromon: { name: 'Dromon', role: 'Ağır savaş gemisi', hp: 120, atk: 12, marines: 300, speed: 7.5, range: 3, cap: 400, crew: 200, days: 90,
    groups: ['bizans'], desc: 'Bizans\'ın Rum ateşi püskürten savaş kadırgası.' },
  sini: { name: 'Şînî', role: 'Ağır savaş gemisi', hp: 100, atk: 10, marines: 280, speed: 7.5, range: 4, cap: 400, crew: 180, days: 80,
    groups: ['arap', 'berberi'], desc: 'Fâtımî ve Mağrib donanmalarının büyük kadırgası.' },
  sambuk: { name: 'Sambuk', role: 'Uzun yol yelkenlisi', hp: 50, atk: 2, marines: 0, speed: 8, range: 9, cap: 1100, crew: 30, days: 45,
    groups: ['arap', 'iran', 'hint', 'gdasya', 'afrika', 'berberi'], desc: 'Muson rüzgârlarıyla okyanus aşan Arap yelkenlisi.' },
  cunk: { name: 'Cünk', role: 'Okyanus devi', hp: 160, atk: 6, marines: 300, speed: 6.5, range: 10, cap: 3000, crew: 120, days: 120,
    groups: ['cin', 'dogu_asya', 'gdasya'], desc: 'Bölmeli gövdesiyle en uzağa gidebilen dev Çin gemisi.' },
};

N.MARITIME = {
  DEN: 3, NOR: 3, ENG: 2, SWE: 2, ISL: 1, DUB: 1, SCO: 1, BYZ: 3, VEN: 3, GEN: 2, PIS: 2, FAT: 3, SIC: 2, ZIR: 2,
  SNG: 2, JAP: 1, GOR: 1, CHO: 3, SRI: 3, OMA: 2, JAV: 2, FRA: 1, LEO: 1, SEV: 1, DNY: 2, KIE: 1, SAL: 1, NAP: 1,
  QAR: 1, BUY: 1, CHM: 1, DAI: 1, GUC: 1, MRY: 1, BLN: 1, HRE: 1, CHA: 1, NAJ: 1, HAM: 1,
};
N.DOCK_COST = 3000;
N.DOCK_DAYS = 120;

N.isPort = p => !!(p.sea && p.sea.length && (p.kind === 'city' || p.kind === 'capital'));
N.fleet = id => G.S.fleets.find(f => f.id === id);
N.fleetsOf = tag => G.S.fleets.filter(f => f.tag === tag);

N.types = function (tag) {
  const g = G.S.nations[tag].group;
  return Object.entries(G.SHIP_TYPES).filter(([, t]) => t.groups === ALL || t.groups.includes(g)).map(([k]) => k);
};
N.bestWar = tag => N.types(tag).filter(k => G.SHIP_TYPES[k].atk >= 3).sort((a, b) => G.SHIP_TYPES[b].atk - G.SHIP_TYPES[a].atk)[0];
N.bestTransport = tag => N.types(tag).sort((a, b) => G.SHIP_TYPES[b].cap - G.SHIP_TYPES[a].cap)[0];

N.addShip = function (f, type, withMarines = true) {
  const S = G.S, t = G.SHIP_TYPES[type];
  f.ships.push({ id: S.nextShipId++, type, name: G.nameFor(f.tag, 'ship'), hp: t.hp });
  if (withMarines) f.marines = (f.marines || 0) + (t.marines || 0);
};

N.createFleet = function (tag, prov, name) {
  const S = G.S, p = S.provinces[prov];
  const f = {
    id: S.nextFleetId++, tag,
    name: name || `${p.name} Filosu`,
    admiral: G.makeLeader(tag, true),
    ships: [], zone: p.sea[0], docked: prov,
    path: [], prog: 0, order: null, cargo: [], landing: null, landTimer: 0,
    retreating: false, battleHp: null,
    marines: 0,             // gemilerin kendi deniz piyadeleri
    plan: null,             // nakliye planı: ordular limanda bindirilip hedefe çıkarılır
  };
  S.fleets.push(f);
  return f;
};

N.init = function () {
  const S = G.S, W = window.WORLD;
  S.seas = W.seas.map(z => ({ ...z, nbDist: z.nb.map(n => G.distKm(z, W.seas[n])) }));
  S.fleets = []; S.dockyards = []; S.dockBuild = [];
  S.nextFleetId = 1; S.nextShipId = 1; S.nextDockId = 1;
  S.navalBattles = new Map();
  for (const n of Object.values(S.nations)) {
    const ports = S.provinces.filter(p => p.owner === n.tag && N.isPort(p))
      .sort((a, b) => (b.kind === 'capital') - (a.kind === 'capital') || b.area - a.area);
    if (!ports.length) continue;
    const m = N.MARITIME[n.tag] || 0;
    const count = Math.max(1, m);
    for (let i = 0; i < Math.min(count, ports.length); i++) {
      S.dockyards.push({ id: S.nextDockId++, tag: n.tag, prov: ports[i].id, queue: [] });
    }
    if (m > 0) {
      const f = N.createFleet(n.tag, ports[0].id, m >= 3 ? 'Ana Donanma' : null);
      const war = N.bestWar(n.tag), tr = N.bestTransport(n.tag);
      for (let i = 0; i < m * 3; i++) N.addShip(f, war);
      for (let i = 0; i < m * 3; i++) N.addShip(f, tr);
    }
  }
};

// ------------------------------------------------------------ özellikler
N.cap = f => f.ships.reduce((s, sh) => s + G.SHIP_TYPES[sh.type].cap, 0);
N.cargoMen = f => f.cargo.reduce((s, id) => { const a = G.S.armies.find(x => x.id === id); return s + (a ? a.men : 0); }, 0);
N.range = f => f.ships.length ? Math.min(...f.ships.map(sh => G.SHIP_TYPES[sh.type].range)) : 0;
N.speed = f => f.ships.length ? Math.min(...f.ships.map(sh => G.SHIP_TYPES[sh.type].speed)) *
  (1 + (f.admiral.trait === 'korsan' ? 0.15 : 0)) : 0;
N.hp = f => f.ships.reduce((s, sh) => s + sh.hp, 0);
N.maxHp = f => f.ships.reduce((s, sh) => s + G.SHIP_TYPES[sh.type].hp, 0);
N.crew = f => f.ships.reduce((s, sh) => s + G.SHIP_TYPES[sh.type].crew, 0);
N.maxMarines = f => f.ships.reduce((s, sh) => s + (G.SHIP_TYPES[sh.type].marines || 0), 0);
N.MIN_MARINES = 300;   // bundan az deniz piyadesiyle çıkarma yapılmaz
N.power = f => f.ships.reduce((s, sh) => s + G.SHIP_TYPES[sh.type].atk * (sh.type === 'dromon' ? 1.3 : 1), 0) *
  (1 + 0.05 * f.admiral.skill + (f.admiral.trait === 'denizci' ? 0.15 : 0)) * (G.S.nations[f.tag].navalMult || 1);

N.friendlyPort = (tag, p) => N.isPort(p) && G.sameRealm(p.ctrl, tag);

// Dost limanlardan deniz bölgesi uzaklığı (adım)
N.rangeMap = function (tag) {
  const S = G.S;
  N._rc ||= new Map();
  const key = tag + '|' + S.hour;
  if (N._rc.has(key)) return N._rc.get(key);
  const dist = new Map(), q = [];
  for (const p of S.provinces) {
    if (!N.friendlyPort(tag, p)) continue;
    for (const z of p.sea) if (!dist.has(z)) { dist.set(z, 0); q.push(z); }
  }
  for (let i = 0; i < q.length; i++) {
    const z = q[i], d = dist.get(z);
    for (const n of S.seas[z].nb) if (!dist.has(n)) { dist.set(n, d + 1); q.push(n); }
  }
  if (N._rc.size > 400) N._rc.clear();
  N._rc.set(key, dist);
  return dist;
};

N.reachable = (f, z) => {
  const d = N.rangeMap(f.tag).get(z);
  return d !== undefined && d <= N.range(f);
};

N.findPath = function (f, to, fromZone) {
  const S = G.S, from = fromZone ?? f.zone;
  if (from === to) return [];
  if (!N.reachable(f, to)) return null;
  const dist = new Map([[from, 0]]), prev = new Map(), h = new G.Heap();
  h.push(0, from);
  while (h.size) {
    const [d, z] = h.pop();
    if (z === to) break;
    if (d > dist.get(z)) continue;
    const zz = S.seas[z];
    for (let i = 0; i < zz.nb.length; i++) {
      const n = zz.nb[i];
      if (n !== to && !N.reachable(f, n)) continue;
      const nd = d + zz.nbDist[i];
      if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, z); h.push(nd, n); }
    }
  }
  if (!prev.has(to)) return null;
  const path = [];
  for (let c = to; c !== from; c = prev.get(c)) path.push(c);
  return path.reverse();
};

// Bir eyalete ulaşmak için en iyi deniz bölgesi
N.bestZoneFor = function (f, prov, fromZone) {
  const p = G.S.provinces[prov];
  let best = null;
  for (const z of p.sea || []) {
    const path = N.findPath(f, z, fromZone);
    if (!path) continue;
    if (!best || path.length < best.path.length) best = { z, path };
  }
  return best;
};

// ------------------------------------------------------------ emirler
N.leavePort = f => { if (f.docked != null) f.docked = null; };
// Filo çıkarmadan vazgeçince gemideki ordular da kıyıdaki muharebeden çekilir
N.abortLanding = function (f) {
  for (const id of f.cargo) { const a = G.S.armies.find(x => x.id === id); if (a) a.attacking = null; }
  f.landing = null; f.harbor = null; f.harborWon = false; f.landTimer = 0;
};

N.orderZone = function (f, z) {
  const path = N.findPath(f, z);
  if (!path) return 'Bu deniz bölgesi filonun menzili dışında.';
  N.leavePort(f);
  N.abortLanding(f);
  f.path = path; f.prog = 0; f.order = { kind: 'move' }; f.landing = null; f.retreating = false;
  return null;
};

N.orderDock = function (f, prov) {
  const p = G.S.provinces[prov];
  if (!N.friendlyPort(f.tag, p)) return 'Burası dost bir liman değil.';
  if (f.docked === prov) return null;
  const b = N.bestZoneFor(f, prov);
  if (!b) return 'Liman filonun menzili dışında.';
  N.leavePort(f);
  N.abortLanding(f);
  f.path = b.path; f.prog = 0; f.order = { kind: 'dock', prov }; f.landing = null;
  return null;
};

// Çıkarma emri: gemideki ordular ya da (ordu yoksa) geminin kendi deniz piyadeleri karaya çıkar
N.orderLand = function (f, prov) {
  const S = G.S, p = S.provinces[prov];
  if (!p.sea || !p.sea.length) return 'Bu eyaletin kıyısı yok.';
  if (!G.canEnter(f.tag, p)) return p.owner ? `${S.nations[p.owner].name} ile savaşta değilsiniz.` : 'Buraya çıkarma yapılamaz.';
  const marines = !f.cargo.length;
  if (marines && f.marines < N.MIN_MARINES) {
    return N.maxMarines(f) ? `Gemilerdeki deniz piyadesi yetersiz (${G.fmtNum(f.marines)} / ${N.MIN_MARINES}). Dost bir limanda tamamlanır ya da gemiye ordu bindirin.`
      : 'Bu filoda ne asker ne deniz piyadesi var. Savaş gemisi ekleyin ya da gemiye ordu bindirin.';
  }
  const b = N.bestZoneFor(f, prov);
  if (!b) return 'Bu kıyı filonun menzili dışında.';
  N.leavePort(f);
  f.path = b.path; f.prog = 0; f.order = { kind: 'land', prov, marines }; f.landing = null; f.retreating = false;
  return null;
};

// Deniz piyadelerinden karaya çıkacak bir ordu kurar ve gemiye koyar
N.formMarines = function (f) {
  const S = G.S, n = S.nations[f.tag];
  const men = Math.floor(f.marines);
  if (men < N.MIN_MARINES) return null;
  const a = G.createArmy(f.tag, null, men);
  n.armyNo--;   // ordu numarası harcanmasın
  a.name = `${f.name} Deniz Piyadeleri`;
  a.marine = true;
  a.men = men; a.maxMen = Math.max(men, a.maxMen);
  a.gear = G.econ.need(a);       // gemide silahlanmış olarak gelirler
  a.fleet = f.id;
  f.cargo.push(a.id);
  f.marines -= men;
  return a;
};

N.embark = function (f, units) {
  if (f.docked == null) return 'Filo limanda değil.';
  let free = N.cap(f) - N.cargoMen(f), n = 0;
  for (const a of units) {
    if (a.prov !== f.docked || a.fleet != null || a.attacking != null || a.retreating || a.men > free) continue;
    free -= a.men;
    a.fleet = f.id; a.prov = null; a.path = []; a.besieging = false; a.sel = false;
    f.cargo.push(a.id);
    G.selected && G.selected.delete(a);
    n++;
  }
  return n ? null : 'Bindirilecek uygun bölük yok ya da gemilerde yer kalmadı.';
};

N.disembark = function (f, prov) {
  const S = G.S;
  for (const id of f.cargo) {
    const a = S.armies.find(x => x.id === id);
    if (!a) continue;
    a.fleet = null; a.prov = prov; a.attacking = null; a.path = []; a.prog = 0;
    a.marine = false;   // karaya çıkan deniz piyadeleri artık sıradan bir ordudur
    a.besieging = G.atWar(a.tag, S.provinces[prov].ctrl);
  }
  f.cargo = [];
};

// Gemideki deniz piyadesi orduları limana dönünce yeniden gemilere dağıtılır
N.absorbMarines = function (f) {
  const S = G.S;
  for (const id of f.cargo.slice()) {
    const a = S.armies.find(x => x.id === id);
    if (!a || !a.marine) continue;
    const room = Math.max(0, N.maxMarines(f) - f.marines);
    if (a.men > room + 50) continue;   // gemilere sığmayan deniz piyadeleri ordu olarak kalır
    f.marines += Math.min(room, a.men);
    f.cargo = f.cargo.filter(x => x !== id);
    a.fleet = null;
    G.removeArmy(a);
  }
};

N.unloadDead = function (a) {
  const f = N.fleet(a.fleet);
  if (f) f.cargo = f.cargo.filter(id => id !== a.id);
};

N.queueShip = function (dock, type) {
  const S = G.S, n = S.nations[dock.tag], t = G.SHIP_TYPES[type];
  const gold = Math.ceil(t.crew / 20);
  if (n.manpower < t.crew || n.gold < gold) return false;
  n.manpower -= t.crew; n.gold -= gold;
  const start = dock.queue.length ? dock.queue[dock.queue.length - 1].done : S.hour;
  dock.queue.push({ type, done: start + t.days * 24, start });
  return true;
};

N.buildDockyard = function (tag, prov) {
  const S = G.S, n = S.nations[tag];
  if (n.manpower < N.DOCK_COST) return false;
  if (S.dockyards.some(d => d.prov === prov) || S.dockBuild.some(d => d.prov === prov)) return false;
  n.manpower -= N.DOCK_COST;
  S.dockBuild.push({ tag, prov, done: S.hour + N.DOCK_DAYS * 24 });
  return true;
};

// ------------------------------------------------------------ nakliye planı
// Ordular en uygun limana yürür, filo oraya gelir, ordular biner; hedef verilmişse filo çıkarma yapar.
N.planTransport = function (armies, target) {
  const S = G.S, P = S.provinces;
  armies = armies.filter(a => a.fleet == null && !a.retreating && a.attacking == null);
  if (!armies.length) return 'Gemiye bindirilecek uygun ordu yok (muharebedeki ya da bozgundaki ordular binemez).';
  const tag = armies[0].tag;
  if (target != null) {
    const p = P[target];
    if (!p.sea || !p.sea.length) return `${p.name} kıyıda değil; denizden çıkarma yapılamaz.`;
    if (!G.canEnter(tag, p)) return p.owner ? `${S.nations[p.owner].name} ile savaşta değilsiniz.` : 'Buraya çıkarma yapılamaz.';
  }
  const smallest = Math.min(...armies.map(a => a.men));
  const fleets = N.fleetsOf(tag).filter(f => !f.plan && !f.retreating && !f.cargo.length &&
    !(f.order && f.order.kind === 'land') && N.cap(f) >= smallest);
  if (!fleets.length) {
    const all = N.fleetsOf(tag);
    if (!all.length) return 'Hiç filonuz yok. Donanma arayüzünden (N) tersanede gemi yaptırın.';
    const idle = all.filter(f => !f.plan && !f.retreating && !f.cargo.length && !(f.order && f.order.kind === 'land'));
    if (!idle.length) return 'Bütün filolarınız meşgul (çıkarma, nakliye ya da geri çekilme).';
    const big = Math.max(...idle.map(N.cap));
    return `Gemilerinizin kapasitesi yetmiyor: en büyük boştaki filo ${G.fmtNum(big)} asker taşıyabilir, ordunuz ${G.fmtNum(smallest)} kişi. ` +
      'Orduyu bölün (Böl) ya da nakliye gemisi yaptırın.';
  }
  const men = armies.reduce((t, a) => t + a.men, 0);
  const { dist } = G.distancesFrom(tag, armies[0].prov, 4000);
  let best = null;
  for (const [pid, d] of dist) {
    const p = P[pid];
    if (!N.friendlyPort(tag, p)) continue;
    for (const f of fleets) {
      const toPort = f.docked === pid ? { path: [] } : N.bestZoneFor(f, pid);
      if (!toPort) continue;
      let sea = 0;
      if (target != null) {
        let ok = null;
        for (const z of p.sea) {
          const b = N.bestZoneFor(f, target, z);
          if (b && (!ok || b.path.length < ok.path.length)) ok = b;
        }
        if (!ok) continue;
        sea = ok.path.length;
      }
      const score = d / 120 + toPort.path.length * 2 + sea * 3 + (N.cap(f) >= men ? 0 : 25);
      if (!best || score < best.s) best = { s: score, f, port: pid };
    }
  }
  if (!best) return target != null ? 'Hedefe deniz yolu yok ya da filolarınızın menzili yetmiyor.' : 'Ordunun ulaşabileceği bir liman ve filo yok.';
  const f = best.f;
  let free = N.cap(f);
  const go = [];
  for (const a of armies.slice().sort((x, y) => y.men - x.men)) if (a.men <= free) { go.push(a); free -= a.men; }
  f.plan = { armies: go.map(a => a.id), port: best.port, target, since: S.hour };
  for (const a of go) {
    a.transport = f.id;
    if (a.prov !== best.port) G.orderMove(a, best.port); else { a.path = []; a.besieging = false; }
  }
  if (f.docked !== best.port) N.orderDock(f, best.port);
  return { fleet: f, port: best.port, n: go.length, left: armies.length - go.length };
};

N.endPlan = function (f, unload) {
  const S = G.S, pl = f.plan;
  if (!pl) return;
  for (const id of pl.armies) { const a = S.armies.find(x => x.id === id); if (a && a.transport === f.id) a.transport = null; }
  if (unload && f.cargo.length && f.docked != null && N.friendlyPort(f.tag, S.provinces[f.docked])) N.disembark(f, f.docked);
  f.plan = null;
};

N.stepPlan = function (f) {
  const S = G.S, pl = f.plan, P = S.provinces;
  const mine = f.tag === S.player;
  const days = (S.hour - pl.since) / 24;
  if (!N.friendlyPort(f.tag, P[pl.port]) || days > 90 || f.retreating) {
    if (mine) G.log(`${f.name}: nakliye planı iptal edildi.`, 'war', [f.tag]);
    N.endPlan(f, true); return;
  }
  // planı bırakan ya da ölen ordular çıkarılır
  const wait = [];
  for (const id of pl.armies) {
    const a = S.armies.find(x => x.id === id);
    if (!a || a.fleet === f.id) continue;
    if (a.transport !== f.id || a.fleet != null) continue;
    wait.push(a);
  }
  if (f.docked !== pl.port) {
    if (!f.path.length && !(f.order && f.order.kind === 'dock')) N.orderDock(f, pl.port);
    return;
  }
  for (const a of wait) {
    if (a.retreating || a.attacking != null) continue;
    if (a.prov === pl.port && !a.path.length) N.embark(f, [a]);
    else if (!a.path.length) G.orderMove(a, pl.port);
  }
  const still = wait.filter(a => a.fleet == null);
  if (still.length && days < 45) return;
  if (!f.cargo.length) { N.endPlan(f, false); return; }
  const target = pl.target;
  N.endPlan(f, false);
  for (const id of f.cargo) { const a = S.armies.find(x => x.id === id); if (a) a.transport = null; }
  if (target == null) {
    if (mine) G.log(`Ordularımız ${P[f.docked].name} limanında ${f.name} gemilerine bindi. Filoyu seçip düşman kıyısına sağ tıklayın.`, 'good', [f.tag]);
    return;
  }
  const err = N.orderLand(f, target);
  if (err) { if (mine) G.log(`${f.name}: ${err}`, 'war', [f.tag]); return; }
  if (mine) G.log(`${f.name} ordularımızla ${P[target].name} kıyısına çıkarma için yola çıktı.`, 'good', [f.tag]);
};

// ------------------------------------------------------------ simülasyon
N.zonePos = (f) => G.S.seas[f.zone];

N.step = function () {
  const S = G.S;
  if (!S.fleets) return;
  // savaştaki bölgeler
  const hostileIn = (f) => S.fleets.some(o => o !== f && o.zone === f.zone && o.docked == null && f.docked == null &&
    G.atWar(f.tag, o.tag));
  for (const f of S.fleets.slice()) if (f.plan) N.stepPlan(f);
  for (const f of S.fleets.slice()) {
    if (!S.fleets.includes(f) || f.docked != null) continue;
    if (f.path.length) {
      if (hostileIn(f) && !f.retreating) continue;   // muharebe sürüyor
      const cur = S.seas[f.zone], next = f.path[0];
      const i = cur.nb.indexOf(next);
      const d = i >= 0 ? cur.nbDist[i] : 300;
      f.prog += N.speed(f);
      if (f.prog >= d) { f.zone = next; f.path.shift(); f.prog = 0; }
      continue;
    }
    if (!f.order) continue;
    if (f.order.kind === 'dock') {
      const p = S.provinces[f.order.prov];
      if (N.friendlyPort(f.tag, p) && p.sea.includes(f.zone)) {
        f.docked = p.id; f.retreating = false;
        N.absorbMarines(f);
        if (f.tag === S.player) G.log(`${f.name} ${p.name} limanına demirledi.`, 'info', [f.tag]);
      }
      f.order = null;
    } else if (f.order.kind === 'land') {
      N.stepLanding(f);
    } else f.order = null;
  }
  N.stepBattles();
};

// Liman savunması: kaleli liman şehirleri önce bir liman muharebesiyle düşürülmeli
N.harborDef = p => p.kind === 'capital' ? { hp: 500, atk: 9 } : { hp: 240, atk: 5 };
N.isHostilePort = (tag, p) => N.isPort(p) && G.atWar(tag, p.ctrl);

N.stepLanding = function (f) {
  const S = G.S, prov = f.order.prov, p = S.provinces[prov];
  if (!G.canEnter(f.tag, p)) { N.abortLanding(f); f.order = null; return; }
  if (f.order.marines && !f.cargo.length && f.landing !== prov) N.formMarines(f);
  const units = f.cargo.map(id => S.armies.find(a => a.id === id)).filter(Boolean);
  if (!units.length) { f.order = null; return; }
  if (hostileFleetHere(f)) return;
  const enemyPort = N.isHostilePort(f.tag, p);
  if (f.landing !== prov) {
    f.landing = prov; f.landTimer = enemyPort ? 0 : 12;
    f.harbor = enemyPort ? { ...N.harborDef(p), max: N.harborDef(p).hp } : null;
    if (f.tag === S.player || G.atWar(S.player, f.tag)) {
      G.log(enemyPort ? `${S.nations[f.tag].name} donanması ${p.name} limanına saldırıyor!`
        : `${S.nations[f.tag].name} ${p.name} kıyısına çıkarma yapıyor!`, f.tag === S.player ? 'good' : 'war', [f.tag, p.ctrl]);
    }
  }
  // 1) liman muharebesi: kale ve limandaki düşman gemileri
  if (f.harbor && f.harbor.hp > 0) {
    if (!N.isHostilePort(f.tag, p)) { f.harbor = null; }
    else {
      const docked = S.fleets.filter(o => o.docked === prov && G.atWar(f.tag, o.tag));
      const defShips = docked.flatMap(o => o.ships.map(sh => [o, sh]));
      let dmg = N.power(f) * G.rand(0.6, 1.4) * 0.12;
      // önce limandaki gemiler, sonra surlar
      while (dmg > 0 && defShips.length) {
        const k = Math.floor(G.rng() * defShips.length), [, sh] = defShips[k];
        const hit = Math.min(dmg, 6 + G.rand(0, 8));
        sh.hp -= hit; dmg -= hit;
        if (sh.hp <= 0) defShips.splice(k, 1);
      }
      if (dmg > 0) f.harbor.hp -= dmg;
      // savunmanın karşılığı
      let back = (f.harbor.atk + docked.reduce((t, o) => t + N.power(o), 0) * 0.12) * G.rand(0.6, 1.4);
      // surlar önce kendilerine saldıran savaş gemilerini döver; nakliye gemileri geride bekler
      const warships = f.ships.filter(sh => G.SHIP_TYPES[sh.type].atk >= 3);
      while (back > 0 && f.ships.length) {
        const pool = warships.length && G.rng() < 0.85 ? warships : f.ships;
        const sh = pool[Math.floor(G.rng() * pool.length)];
        const hit = Math.min(back, 5 + G.rand(0, 6));
        sh.hp -= hit; back -= hit;
      }
      for (const o of docked) N.applyLosses(o);
      N.applyLosses(f);
      if (!S.fleets.includes(f)) return;
      if (f.harbor.hp > 0) return;
      if (f.tag === S.player || G.atWar(S.player, f.tag)) {
        G.log(`${p.name} limanı düştü! Askerler karaya çıkıyor.`, f.tag === S.player ? 'good' : 'war', [f.tag, p.ctrl]);
      }
      f.harborWon = true;
    }
  }
  // 2) karaya çıkış: kıyıda düşman varsa denizden saldırılır
  const foes = G.hostileArmiesIn(prov, f.tag);
  if (foes.length) {
    const fit = units.filter(a => a.org > 5);
    if (!fit.length) {
      for (const a of units) a.attacking = null;
      f.order = null; f.landing = null; f.landTimer = 0; f.harbor = null; f.harborWon = false;
      G.log(`${p.name} çıkarması püskürtüldü.`, 'war', [f.tag, p.ctrl]);
      return;
    }
    for (const a of fit) a.attacking = prov;
    return;
  }
  for (const a of units) a.attacking = null;
  if (f.landTimer > 0 && --f.landTimer > 0) return;
  N.disembark(f, prov);
  f.order = null; f.landing = null; f.landTimer = 0; f.harbor = null; f.harborWon = false;
  G.mapDirty = true;
  if (f.tag === S.player) G.log(`Askerlerimiz ${p.name} kıyısına çıktı.`, 'good', [f.tag]);
};

function hostileFleetHere(f) {
  return G.S.fleets.some(o => o !== f && o.zone === f.zone && o.docked == null && G.atWar(f.tag, o.tag));
}

N.stepBattles = function () {
  const S = G.S;
  const byZone = new Map();
  for (const f of S.fleets) {
    if (f.docked != null || !f.ships.length) continue;
    if (!byZone.has(f.zone)) byZone.set(f.zone, []);
    byZone.get(f.zone).push(f);
  }
  const live = new Set();
  for (const [z, fl] of byZone) {
    if (fl.length < 2) continue;
    let any = false;
    for (const f of fl) {
      const foes = fl.filter(o => o !== f && G.atWar(f.tag, o.tag));
      if (!foes.length || f.retreating) continue;
      any = true;
      if (f.battleHp == null) f.battleHp = N.hp(f);
      const targets = foes.flatMap(o => o.ships.map(sh => [o, sh]));
      let dmg = N.power(f) * G.rand(0.6, 1.4) * 0.12;
      while (dmg > 0 && targets.length) {
        const [o, sh] = targets[Math.floor(G.rng() * targets.length)];
        const hit = Math.min(dmg, 6 + G.rand(0, 8));
        sh.hp -= hit; dmg -= hit;
      }
    }
    if (!any) continue;
    live.add(z);
    if (!S.navalBattles.has(z)) {
      S.navalBattles.set(z, { zone: z, start: S.hour });
      const tags = [...new Set(fl.map(f => f.tag))];
      if (tags.includes(S.player)) G.log(`${S.seas[z].name} deniz muharebesi başladı!`, 'war', tags);
    }
    for (const f of fl) N.applyLosses(f);
  }
  for (const f of S.fleets.slice()) {
    if (f.battleHp != null && !live.has(f.zone)) f.battleHp = null;
  }
  for (const k of [...S.navalBattles.keys()]) if (!live.has(k)) S.navalBattles.delete(k);
};

N.applyLosses = function (f) {
  const S = G.S;
  const capBefore = N.cap(f);
  const sunk = f.ships.filter(sh => sh.hp <= 0);
  if (sunk.length) {
    f.ships = f.ships.filter(sh => sh.hp > 0);
    const mx = N.maxMarines(f);
    if (f.marines > mx) { G.war.record(f.tag, f.marines - mx, null); f.marines = mx; }
    const lostFrac = capBefore ? (capBefore - N.cap(f)) / capBefore : 1;
    if (f.cargo.length && lostFrac > 0) {
      for (const id of f.cargo.slice()) {
        const a = S.armies.find(x => x.id === id);
        if (!a) continue;
        G.war.kill(a, a.men * lostFrac, null);
        if (a.men < 200) G.destroyArmy(a, `${a.name} (${S.nations[a.tag].name}) gemileriyle birlikte boğuldu.`, null);
      }
    }
    if (f.tag === S.player) G.log(`${f.name}: ${sunk.map(s => s.name).join(', ')} battı.`, 'war', [f.tag]);
  }
  if (!f.ships.length) {
    for (const id of f.cargo.slice()) { const a = S.armies.find(x => x.id === id); if (a) G.destroyArmy(a, `${a.name} (${S.nations[a.tag].name}) denizde boğuldu.`, null); }
    if (f.plan) N.endPlan(f, false);
    S.fleets.splice(S.fleets.indexOf(f), 1);
    if (G.selFleet === f) G.selFleet = null;
    G.log(`${f.name} (${S.nations[f.tag].name}) tamamen batırıldı!`, 'war', [f.tag]);
    return;
  }
  if (!f.retreating && f.battleHp && N.hp(f) < f.battleHp * 0.4) N.retreat(f);
};

N.retreat = function (f) {
  const S = G.S;
  f.retreating = true; f.battleHp = null;
  N.abortLanding(f);
  let best = null;
  for (const p of S.provinces) {
    if (!N.friendlyPort(f.tag, p)) continue;
    const b = N.bestZoneFor(f, p.id);
    if (b && (!best || b.path.length < best.path.length)) best = { ...b, prov: p.id };
  }
  if (best) { f.path = best.path; f.prog = 0; f.order = { kind: 'dock', prov: best.prov }; f.landing = null; }
  if (f.tag === S.player) G.log(`${f.name} geri çekiliyor.`, 'war', [f.tag]);
};

N.daily = function () {
  const S = G.S;
  if (!S.fleets) return;
  for (const f of S.fleets.slice()) {
    if (!S.nations[f.tag] || !S.nations[f.tag].alive) {
      if (f.plan) N.endPlan(f, false);
      for (const id of f.cargo) { const a = S.armies.find(x => x.id === id); if (a) G.removeArmy(a); }
      S.fleets.splice(S.fleets.indexOf(f), 1);
      continue;
    }
    if (f.docked != null) {
      const p = S.provinces[f.docked];
      if (!N.friendlyPort(f.tag, p)) {
        // liman düştü: en yakın dost limana kaç
        f.docked = null; N.retreat(f);
        continue;
      }
      for (const sh of f.ships) sh.hp = Math.min(G.SHIP_TYPES[sh.type].hp, sh.hp + G.SHIP_TYPES[sh.type].hp * 0.05);
      // deniz piyadeleri limanda insan gücünden tamamlanır
      const n = S.nations[f.tag], mx = N.maxMarines(f);
      if (f.marines < mx) {
        const add = Math.min(mx - f.marines, Math.max(30, mx * 0.08), n.manpower);
        f.marines += add; n.manpower -= add;
      }
    }
  }
  // tersaneler
  for (const d of S.dockyards.slice()) {
    const p = S.provinces[d.prov];
    if (p.owner !== d.tag) { d.tag = p.owner; d.queue = []; }
    if (!S.nations[d.tag] || p.ctrl !== d.tag) continue;
    while (d.queue.length && d.queue[0].done <= S.hour) {
      const item = d.queue.shift();
      let f = S.fleets.find(x => x.tag === d.tag && x.docked === d.prov && !x.cargo.length);
      if (!f) f = N.createFleet(d.tag, d.prov);
      N.addShip(f, item.type, false);   // deniz piyadeleri limanda insan gücünden tamamlanır
      if (d.tag === S.player) G.log(`${p.name} tersanesinde yeni bir ${G.SHIP_TYPES[item.type].name} denize indirildi.`, 'good', [d.tag]);
    }
  }
  for (const b of S.dockBuild.slice()) {
    if (b.done > S.hour) continue;
    S.dockBuild.splice(S.dockBuild.indexOf(b), 1);
    const p = S.provinces[b.prov];
    if (p.owner !== b.tag) continue;
    S.dockyards.push({ id: S.nextDockId++, tag: b.tag, prov: b.prov, queue: [] });
    if (b.tag === S.player) G.log(`${p.name} tersanesi tamamlandı.`, 'good', [b.tag]);
  }
  N.ai();
};

// ------------------------------------------------------------ yapay zekâ
N.ai = function () {
  const S = G.S;
  for (const n of Object.values(S.nations)) {
    if (!n.alive || n.tag === S.player) continue;
    const docks = S.dockyards.filter(d => d.tag === n.tag);
    if (!docks.length) continue;
    // ayda bir gemi inşası
    if (S.time.d === 1) {
      const m = N.MARITIME[n.tag] || 0;
      const ships = N.fleetsOf(n.tag).reduce((s, f) => s + f.ships.length, 0);
      const want = m * 8 + (n.enemies.size ? 4 : 0);
      for (const d of docks) {
        if (ships >= want || d.queue.length || n.manpower < 8000) break;
        N.queueShip(d, G.rng() < 0.5 ? N.bestWar(n.tag) : N.bestTransport(n.tag));
      }
    }
    if (n.enemies.size) { N.aiInvasion(n); N.aiHunt(n); }
    else if (n.aiNaval) N.cancelPlan(n);
  }
};

// Düşman donanmalarını avla
N.aiHunt = function (n) {
  const S = G.S;
  for (const f of N.fleetsOf(n.tag)) {
    if (f.cargo.length || f.path.length || f.retreating || (n.aiNaval && n.aiNaval.fleet === f.id)) continue;
    if (N.hp(f) < N.maxHp(f) * 0.7) continue;
    let best = null;
    for (const o of S.fleets) {
      if (o.docked != null || !G.atWar(n.tag, o.tag) || !N.reachable(f, o.zone)) continue;
      if (N.power(f) * N.hp(f) < N.power(o) * N.hp(o) * 1.3) continue;
      const s = N.power(o) + (o.cargo.length ? 50 : 0);
      if (!best || s > best.s) best = { s, z: o.zone };
    }
    if (best) N.orderZone(f, best.z);
    else if (f.docked == null && !f.order) {
      const home = S.provinces.find(p => N.friendlyPort(n.tag, p) && p.sea.includes(f.zone));
      if (home) N.orderDock(f, home.id); else N.retreat(f);
    }
  }
};

N.cancelPlan = function (n) {
  const f = N.fleet(n.aiNaval.fleet);
  if (f && f.cargo.length && f.docked != null) N.disembark(f, f.docked);
  n.aiNaval = null;
};

// Karadan ulaşılamayan düşmana çıkarma
N.aiInvasion = function (n) {
  const S = G.S, P = S.provinces, tag = n.tag;
  const plan = n.aiNaval;
  if (plan) {
    const f = N.fleet(plan.fleet);
    const days = (S.hour - plan.since) / 24;
    if (!f || days > 120) { if (f) N.cancelPlan(n); else n.aiNaval = null; return; }
    if (plan.stage === 'gather') {
      if (f.docked !== plan.port) { if (!f.path.length && !f.order) N.orderDock(f, plan.port); return; }
      const here = S.armies.filter(a => a.tag === tag && a.prov === plan.port && a.fleet == null && a.attacking == null);
      const need = Math.max(1, Math.floor(N.cap(f) / 11000));
      if (here.length >= need || (days > 25 && here.length)) {
        N.embark(f, here);
        if (!f.cargo.length) return;
        const err = N.orderLand(f, plan.target);
        if (err) { N.cancelPlan(n); return; }
        plan.stage = 'sail';
      } else {
        // bölükleri limana çağır
        const free = S.armies.filter(a => a.tag === tag && a.fleet == null && G.ai.idle(a) && a.prov !== plan.port && a.men <= N.cap(f));
        free.sort((x, y) => G.distKm(P[x.prov], P[plan.port]) - G.distKm(P[y.prov], P[plan.port]));
        for (const a of free.slice(0, need - here.length)) G.orderMove(a, plan.port);
      }
      return;
    }
    if (plan.stage === 'sail' && !f.cargo.length) n.aiNaval = null;
    else if (plan.stage === 'sail' && !f.order && !f.path.length) {
      if (N.orderLand(f, plan.target)) N.cancelPlan(n);
    }
    return;
  }
  if (S.time.d % 5) return;
  // karadan düşmana ulaşılabiliyor mu?
  const unit = S.armies.find(a => a.tag === tag && a.fleet == null);
  if (!unit) return;
  const { dist } = G.distancesFrom(tag, unit.prov, 6000);
  for (const [pid] of dist) if (G.atWar(tag, P[pid].ctrl)) return;
  const fleets = N.fleetsOf(tag).filter(f => f.docked != null && N.cap(f) >= 8000);
  if (!fleets.length) return;
  const f = fleets.sort((a, b) => N.cap(b) - N.cap(a))[0];
  let best = null;
  for (const p of P) {
    if (!p.sea || !G.atWar(tag, p.ctrl)) continue;
    const b = N.bestZoneFor(f, p.id);
    if (!b) continue;
    const foe = G.hostileArmiesIn(p.id, tag).reduce((s, a) => s + a.men, 0);
    const score = -foe / 500 - b.path.length * 3 + (p.kind === 'capital' ? 8 : p.kind === 'city' ? 3 : 0) + G.rand(0, 3);
    if (!best || score > best.s) best = { s: score, p: p.id };
  }
  if (!best) return;
  n.aiNaval = { fleet: f.id, port: f.docked, target: best.p, stage: 'gather', since: S.hour };
};
