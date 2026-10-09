// Oyun durumu: eyaletler, ülkeler, ordular ve temel sorgular
'use strict';

const ARMY_MEN = 3000;          // kuşatma ve hesaplarda temel birim (bir bölük grubu)
const BOLUK = 1000;             // bir bölüğün tam mevcudu
const RECRUIT_COST = 8000;      // yeni ordu (8B asker) için insan gücü
const RECRUIT_DAYS = 60;        // eğitim süresi
const TRUCE_DAYS = 5 * 365;     // barış sonrası ateşkes
// Tarihî duruma göre ek başlangıç orduları
const START_BONUS = { SEL: 5, BYZ: 4, FAT: 2, SNG: 4, LIA: 3, KIE: 2 };

G.ARMY_MEN = ARMY_MEN;
G.BOLUK = BOLUK;
G.RECRUIT_COST = RECRUIT_COST;
G.RECRUIT_DAYS = RECRUIT_DAYS;

G.initState = function (playerTag) {
  const W = window.WORLD;
  G.usedNames = {};
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
    wars: [], nextWarId: 0,
    rel: new Map(),         // "A|B" -> ilişki puanı
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

  S.marshals = [];
  S.nextMarshalId = 1;
  // Başlangıç orduları: toplam asker, her biri bir komutanın yönettiği 8B-15B'lik ordulara bölünür
  for (const n of Object.values(S.nations)) {
    const provs = S.provinces.filter(p => p.owner === n.tag);
    const cities = provs.filter(p => p.kind !== 'rural');
    let count = Math.round(provs.length / 5) + (n.major ? 4 : 1);
    count = (G.clamp(count, 1, n.major ? 22 : 9) + (START_BONUS[n.tag] || 0)) * 2;
    let total = count * 3000;
    let i = 0;
    while (total >= 4000 || i === 0) {
      const p = i === 0 ? S.provinces[n.capital] : G.pick(cities.length ? cities : provs);
      const a = G.createArmy(n.tag, p.id, 0);
      a.men = Math.min(a.maxMen, Math.max(4000, total), Math.round(a.maxMen * G.rand(0.8, 1)));
      total -= a.men;
      i++;
    }
    n.armyTarget = i;
  }

  // 1040: Dandanakan'ın ardından Selçuklu-Gazneli savaşı sürüyor; Gazneli ordusu dağınık
  G.declareWar('SEL', 'GAZ', true);
  for (const a of S.armies) if (a.tag === 'GAZ') { a.org = 65; a.men *= 0.8; }
  // orduları mareşallere bağla, donanmaları kur
  for (const n of Object.values(S.nations)) G.command.organize(n.tag);
  G.econ.init();
  G.navy.init();
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
    // diplomasi
    allies: new Set(), guarantees: new Set(), accessGranted: new Set(),
    envoys: def.major ? 3 : 2, envoyTo: new Set(), claims: new Set(), justify: null,
    siegeMult: 1, speedMult: 1, orgMult: 1, navalMult: 1, capBonus: 0,
    // ekonomi
    stock: { kilic: 0, yay: 0, zirh: 0, at: 0 },
    lines: { kilic: { f: 0, eff: 0.5 }, yay: { f: 0, eff: 0.5 }, zirh: { f: 0, eff: 0.5 }, at: { f: 0, eff: 0.5 } },
    build: [], civTotal: 0, milTotal: 0, milFree: 0, gold: 50, buildCiv: 0, tradeIncome: 0, ironBonus: 0,
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
    G.sameRealm(tag, p.ctrl) || (G.dip ? G.dip.hasAccess(tag, p.ctrl) : false);
};

G.armiesIn = pid => G.S.armies.filter(a => a.prov === pid);
G.hostileArmiesIn = (pid, tag) => G.S.armies.filter(a => a.prov === pid && G.atWar(tag, a.tag));

G.ordinal = n => `${n}.`;

// Ordu: bir ordu komutanının yönettiği, haritada tek başına hareket eden birlik
G.createArmy = function (tag, pid, men = 8000) {
  const S = G.S, n = S.nations[tag];
  n.armyNo++;
  const general = G.makeLeader(tag, false);
  general.xp = 0;
  const maxMen = G.command.capFor(general.skill) + (n.capBonus || 0);
  const a = {
    id: S.nextArmyId++, tag, name: `${G.ordinal(n.armyNo)} Ordu`,
    general,
    bolukCmdrs: Array.from({ length: 15 }, () => G.nameFor(tag)),   // bölük komutanları
    prov: pid, men: Math.min(men, maxMen), maxMen, org: 100,
    cav: n.cav, path: [], prog: 0, attacking: null, besieging: false,
    sel: false, aiTarget: null,
    marshal: null,          // bağlı olduğu mareşal
    fleet: null,            // gemideyse donanma kimliği
  };
  S.armies.push(a);
  return a;
};

G.removeArmy = function (a) {
  const S = G.S;
  const i = S.armies.indexOf(a);
  if (i >= 0) S.armies.splice(i, 1);
  if (G.selected) G.selected.delete(a);
  if (a.fleet != null) G.navy.unloadDead(a);
};

G.armySpeed = a => (3.2 + 3.2 * a.cav) * (1 + G.command.bonus(a, 'speed')) * (G.S.nations[a.tag].speedMult || 1);   // km/saat

// Ordunun asker dağılımı (gösterim için)
G.composition = a => {
  const cav = Math.round(a.men * a.cav), rest = a.men - cav;
  const arch = Math.round(rest * 0.3);
  return { piyade: rest - arch, okcu: arch, suvari: cav };
};

// Ordunun bölükleri: tam kadroda her bölük 1.000 kişi; kayıplar bölüklere eşit dağılır
G.bolukler = a => {
  const slots = Math.max(1, Math.round(a.maxMen / BOLUK));
  const fill = a.men / (slots * BOLUK);
  const nCav = Math.round(slots * a.cav), rest = slots - nCav, nArch = Math.round(rest * 0.3);
  const out = [];
  for (let i = 0; i < slots; i++) {
    const type = i < rest - nArch ? 'Piyade' : i < rest ? 'Okçu' : 'Süvari';
    out.push({ name: `${i + 1}. ${type} Bölüğü`, type, men: Math.round(BOLUK * fill), cmdr: a.bolukCmdrs[i % a.bolukCmdrs.length] });
  }
  return out;
};

G.monthlyManpower = function (tag) {
  let m = 0;
  for (const p of G.S.provinces) {
    if (p.owner === tag && p.ctrl === tag) {
      m += (p.kind === 'capital' ? 900 : p.kind === 'city' ? 380 : 140) *
        (1 + (p.farm || 0) * 0.25 * (p.res === 'tahil' ? 1.5 : 1));
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
// ------------------------------------------------------------ savaşlar (koalisyonlar)
G.findWar = (a, b) => (G.S.wars || []).find(w => (w.att.has(a) && w.def.has(b)) || (w.def.has(a) && w.att.has(b)));

// a'nın b'ye karşı savaştaki tarafı
G.warSide = (a, b) => {
  const w = G.findWar(a, b);
  if (w) return [...(w.att.has(a) ? w.att : w.def)];
  return G.realm(a).filter(t => t === a || G.atWar(t, b));
};

// Savaş: saldıranın diyarı ve istekli müttefikleri ile savunanın diyarı, müttefikleri ve garantörleri
G.declareWar = function (a, b, silent) {
  const S = G.S, na = S.nations[a], nb = S.nations[b];
  if (!na || !nb || a === b || na.enemies.has(b)) return;
  if (G.sameRealm(a, b)) return;   // efendi ile vasal birbirine bu yolla savaş açamaz
  const A = new Set(G.realm(a)), B = new Set(G.realm(b));
  const dip = G.dip;
  if (dip) {
    for (const t of [...B]) for (const x of dip.defenders(t)) if (!A.has(x)) B.add(x);
    for (const x of dip.allies(a)) if (!B.has(x) && dip.opinion(x, a) >= 80 && !dip.allies(x).some(y => B.has(y))) A.add(x);
    for (const t of [...A]) for (const r of G.realm(t)) if (!B.has(r)) A.add(r);
    for (const t of [...B]) for (const r of G.realm(t)) if (!A.has(r)) B.add(r);
  }
  for (const t of [...A]) if (B.has(t)) { A.delete(t); B.delete(t); }
  A.add(a); B.add(b);
  S.wars ||= [];
  const war = { id: (S.nextWarId = (S.nextWarId || 0) + 1), a, b, att: A, def: B, start: S.hour };
  S.wars.push(war);
  for (const x of A) for (const y of B) {
    const nx = S.nations[x], ny = S.nations[y];
    if (!nx.alive || !ny.alive || nx.enemies.has(y)) continue;
    nx.enemies.add(y); ny.enemies.add(x);
    nx.warStart[y] = ny.warStart[x] = S.hour;
  }
  if (dip) dip.onWar(a, b, A, B);
  if (!silent) {
    const joined = [...A, ...B].filter(t => t !== a && t !== b).map(t => S.nations[t].name);
    G.log(`${na.name}, ${nb.name}'a savaş ilan etti!` + (joined.length ? ` (${joined.join(', ')} da savaşa girdi)` : ''),
      'war', [...A, ...B]);
  }
  G.mapDirty = true; G.labelsDirty = true;
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

// İki ülke arasında tekil barış (başka bir savaşta hâlâ karşı karşıyalarsa düşmanlık sürer)
function peacePair(a, b, transfer, skipWar) {
  const S = G.S, na = S.nations[a], nb = S.nations[b];
  if (!na || !nb || !na.enemies.has(b)) return 0;
  const other = (S.wars || []).some(w => w !== skipWar &&
    ((w.att.has(a) && w.def.has(b)) || (w.def.has(a) && w.att.has(b))));
  if (!other) { na.enemies.delete(b); nb.enemies.delete(a); }
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

// Barış: transfer=true ise işgal edilen topraklar işgalciye geçer. Bütün koalisyon birlikte barışır.
G.makePeace = function (a, b, transfer, msg) {
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
  const war = G.findWar(a, b);
  const A = G.warSide(a, b), B = G.warSide(b, a);
  let moved = 0;
  for (const x of A) for (const y of B) moved += peacePair(x, y, transfer, war);
  if (war) S.wars.splice(S.wars.indexOf(war), 1);
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
  G.log(msg || (transfer
    ? `${na.name} ile ${nb.name} barış imzaladı. ${moved} eyalet el değiştirdi.`
    : `${na.name} ile ${nb.name} beyaz barış yaptı.`), 'info', [a, b]);
  G.checkElimination();
};

// Barış masası: seçilen işgal altındaki iller işgalcilere geçer, gerisi sahiplerine döner;
// istenirse düşman lideri vasal olur ve hazinesinin yarısını tazminat olarak öder.
G.peaceCost = function (me, tag) {
  // düşman tarafının toplam il ağırlığına göre her ilin "barış puanı" bedeli
  const B = new Set(G.warSide(tag, me));
  let tot = 0;
  for (const p of G.S.provinces) if (B.has(p.owner)) tot += G.provinceWeight(p);
  return p => (tot ? G.provinceWeight(p) / tot * 100 : 100);
};
G.peaceTerms = function (me, tag, terms) {
  const S = G.S, A = new Set(G.warSide(me, tag)), nb = S.nations[tag], nm = S.nations[me];
  let n = 0;
  for (const id of terms.provs || []) {
    const p = S.provinces[id];
    if (!A.has(p.ctrl) || A.has(p.owner)) continue;
    p.owner = p.ctrl; p.siege = null; n++;
    p.conquered = S.hour;
  }
  let gold = 0;
  if (terms.gold && nb.gold > 0) { gold = Math.floor(nb.gold / 2); nb.gold -= gold; nm.gold += gold; }
  const parts = [];
  if (n) parts.push(`${n} il ${nm.name}'a geçti`);
  if (gold) parts.push(`${gold} altın tazminat ödendi`);
  if (terms.vassal) parts.push(`${nb.name} ${nm.name} tacının vasalı oldu`);
  G.makePeace(me, tag, false, `${nm.name} ile ${nb.name} barış imzaladı${parts.length ? ': ' + parts.join(', ') : ''}.`);
  if (terms.vassal && nb.alive) {
    nb.overlord = me; nb.tribute = 0.25; nb.rebelFrom = null;
    for (const t of [...nb.allies]) { nb.allies.delete(t); if (S.nations[t]) S.nations[t].allies.delete(tag); }
    G.labelsDirty = true; G.mapDirty = true;
  }
  return { n, gold };
};

// Ülke savaş koalisyonlarından çıkarılır (teslimiyet, yok olma)
G.leaveWars = function (tag) {
  const S = G.S;
  for (const w of (S.wars || []).slice()) {
    w.att.delete(tag); w.def.delete(tag);
    if (!w.att.size || !w.def.size || !w.att.has(w.a) || !w.def.has(w.b)) {
      // lider düştüyse savaş biter
      if (!w.att.has(w.a) || !w.def.has(w.b)) {
        for (const x of w.att) for (const y of w.def) peacePair(x, y, false, w);
        S.wars.splice(S.wars.indexOf(w), 1);
      }
    }
  }
};

// Artık girilemeyen topraklardaki orduları en yakın kendi toprağına çeker
G.evacuateArmies = function () {
  const S = G.S;
  for (const a of S.armies.slice()) {
    if (a.fleet != null) continue;
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

// Teslim olma (HOI4 gibi): işgal altındaki topraklar işgalcilere geçer, ülke kalan topraklarıyla barış imzalar.
// Hiç toprağı kalmazsa tarihten silinir.
G.capitulate = function (tag) {
  const S = G.S, n = S.nations[tag];
  if (!n.alive) return;
  const enemies = [...n.enemies];
  let lost = 0;
  for (const p of S.provinces) {
    if (p.owner === tag && p.ctrl !== tag && n.enemies.has(p.ctrl)) { p.owner = p.ctrl; p.siege = null; lost++; }
    else if (p.ctrl === tag && p.owner !== tag) { p.ctrl = p.owner; }
    if (p.siege && (p.siege.by === tag || (p.owner === tag && n.enemies.has(p.siege.by)))) p.siege = null;
  }
  // teslim olan ülkenin bütün savaşları biter
  for (const w of (S.wars || []).slice()) {
    if (!w.att.has(tag) && !w.def.has(tag)) continue;
    const mySide = w.att.has(tag) ? w.att : w.def, other = w.att.has(tag) ? w.def : w.att;
    if (w.a === tag || w.b === tag) {
      for (const x of mySide) for (const y of other) peacePair(x, y, false, w);
      S.wars.splice(S.wars.indexOf(w), 1);
    } else {
      for (const y of other) peacePair(tag, y, false, w);
      mySide.delete(tag);
    }
  }
  for (const e of [...n.enemies]) { S.nations[e].enemies.delete(tag); n.enemies.delete(e); }
  for (const t of [tag, ...enemies]) {
    const nt = S.nations[t];
    if (nt.alive && (nt.capital == null || S.provinces[nt.capital].owner !== t)) G.relocateCapital(t);
  }
  G.evacuateArmies();
  G.labelsDirty = true; G.mapDirty = true;
  G.log(`${n.name} teslim oldu ve barış istedi: ${lost} eyaletini kaybetti.`, 'war', [tag, ...enemies]);
  G.checkElimination();
  if (tag === S.player && n.alive) G.ui.notify(`Ülkemiz teslim oldu. İşgal edilen ${lost} eyalet düşmana geçti, ama krallık yaşıyor.`);
  else if (enemies.includes(S.player)) {
    G.ui.notify(n.alive ? `Zafer! ${n.name} teslim oldu, işgal ettiğimiz topraklar artık bizim.`
      : `Mutlak zafer! ${n.name} bütünüyle fethedildi; bütün toprakları artık bizim.`);
  }
};

G.checkElimination = function () {
  const S = G.S;
  const owned = {};
  for (const p of S.provinces) if (p.owner) owned[p.owner] = (owned[p.owner] || 0) + 1;
  for (const n of Object.values(S.nations)) {
    if (n.alive && !owned[n.tag]) {
      n.alive = false;
      for (const v of G.vassalsOf(n.tag)) S.nations[v].overlord = null;
      G.leaveWars(n.tag);
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
