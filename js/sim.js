// Simülasyon: zaman, hareket, muharebe, kuşatma, insan gücü
'use strict';


// Bir ordu için en kısa yol (Dijkstra). Hedefe ulaşılamazsa null.
G.findPath = function (tag, from, to) {
  const S = G.S, P = S.provinces;
  if (from === to) return [];
  if (!G.canEnter(tag, P[to])) return null;
  const dist = new Map([[from, 0]]), prev = new Map();
  const h = new G.Heap();
  h.push(0, from);
  while (h.size) {
    const [d, id] = h.pop();
    if (id === to) break;
    if (d > dist.get(id)) continue;
    const p = P[id];
    for (let i = 0; i < p.nb.length; i++) {
      const n = p.nb[i];
      if (!G.canEnter(tag, P[n])) continue;
      const nd = d + p.nbDist[i];
      if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, id); h.push(nd, n); }
    }
  }
  if (!prev.has(to)) return null;
  const path = [];
  for (let c = to; c !== from; c = prev.get(c)) path.push(c);
  return path.reverse();
};

// Tüm erişilebilir eyaletlere mesafe (yapay zekâ hedef seçimi için)
G.distancesFrom = function (tag, from, maxKm = 2500) {
  const P = G.S.provinces, dist = new Map([[from, 0]]), prev = new Map();
  const h = new G.Heap();
  h.push(0, from);
  while (h.size) {
    const [d, id] = h.pop();
    if (d > dist.get(id) || d > maxKm) continue;
    const p = P[id];
    for (let i = 0; i < p.nb.length; i++) {
      const n = p.nb[i];
      if (!G.canEnter(tag, P[n])) continue;
      const nd = d + p.nbDist[i];
      if (nd < (dist.get(n) ?? Infinity)) { dist.set(n, nd); prev.set(n, id); h.push(nd, n); }
    }
  }
  return { dist, prev };
};

G.pathFromPrev = (prev, from, to) => {
  const path = [];
  for (let c = to; c !== from; c = prev.get(c)) { if (c === undefined) return null; path.push(c); }
  return path.reverse();
};

G.orderMove = function (a, to) {
  if (a.retreating) return false;   // bozgundaki ordu emir dinlemez
  const path = G.findPath(a.tag, a.prov, to);
  if (!path) return false;
  a.path = path; a.prog = 0; a.attacking = null; a.besieging = false;
  return true;
};

G.nbIndex = (p, n) => p.nb.indexOf(n);

// ------------------------------------------------------------------ zaman
G.tick = function () {
  const S = G.S, t = S.time;
  S.hour++;
  t.h++;
  let newDay = false, newMonth = false;
  if (t.h >= 24) {
    t.h = 0; t.d++; newDay = true;
    if (t.d > G.daysInMonth(t.y, t.m)) {
      t.d = 1; t.m++; newMonth = true;
      if (t.m >= 12) { t.m = 0; t.y++; }
    }
  }
  G.stepArmies();
  G.command.stepJoins();
  G.navy.step();
  G.stepBattles();
  G.stepSieges();
  if (newDay) G.daily();
  if (newMonth) G.monthly();
  if (t.h % 12 === 0) { G.ai.update(t.h === 0); G.command.update(); }
};

G.stepArmies = function () {
  const S = G.S, P = S.provinces;
  for (const a of S.armies.slice()) {
    if (!S.armies.includes(a)) continue;
    if (!a.path.length || a.fleet != null) { a.retreating = false; continue; }
    const next = a.path[0], np = P[next];
    if (!G.canEnter(a.tag, np)) { a.path = []; a.prog = 0; a.retreating = false; continue; }
    const cur = P[a.prov];
    if (a.retreating) {
      // çekilme yolu kesildiyse yeni yol ara; bulunamazsa ordu imha olur
      if (G.hostileArmiesIn(next, a.tag).some(e => !e.retreating)) {
        const np2 = G.war.escapePath(a);
        if (!np2) { G.war.trapped.push(a); continue; }
        a.path = np2; a.prog = 0;
        continue;
      }
      a.prog += G.armySpeed(a) * 0.8;
      const i = G.nbIndex(cur, a.path[0]);
      if (a.prog >= (i >= 0 ? cur.nbDist[i] : 200)) {
        a.prov = a.path.shift(); a.prog = 0;
        if (!a.path.length) a.retreating = false;
      }
      continue;
    }
    // kuşatma sürerken ordu yerinde kalır
    if (a.besieging && G.atWar(a.tag, cur.ctrl)) continue;
    a.besieging = false;
    if (G.hostileArmiesIn(next, a.tag).some(e => !e.retreating)) {
      if (a.org > 10) a.attacking = next; else { a.path = []; a.attacking = null; }
      continue;
    }
    a.attacking = null;
    a.prog += G.armySpeed(a) * (0.6 + 0.4 * a.org / 100) * G.terrainOf(np).move;
    const i = G.nbIndex(cur, next);
    const d = i >= 0 ? cur.nbDist[i] : 200;
    if (a.prog >= d) {
      a.prov = next; a.path.shift(); a.prog = 0;
      if (G.atWar(a.tag, np.ctrl)) a.besieging = true;
      G.war.overrun(a);
    }
  }
  for (const a of G.war.trapped.splice(0)) {
    if (S.armies.includes(a)) G.destroyArmy(a, `${a.name} (${S.nations[a.tag].name}) çekilirken kuşatıldı ve imha edildi.`, null);
  }
};

G.fortMod = (p, defTag) => G.econ.fortMod(p, defTag);

// ------------------------------------------------------------ muharebe
// Ortaçağ muharebesi: cephe genişliği (yalnızca ön saftakiler savaşır, gerisi yedekte bekler),
// evreler (ok yağmuru → süvari hücumu → göğüs göğüse), her evrede iki tarafın zarı ve komutan becerisi.
G.BATTLE = {
  WIDTH: 14000,           // her taraftan aynı anda çarpışabilecek en fazla asker
  PHASE_HOURS: 8,
  PHASES: [
    { key: 'ok', name: 'Ok yağmuru', inf: 0.5, arch: 2.0, cav: 0.5 },
    { key: 'hucum', name: 'Süvari hücumu', inf: 0.8, arch: 0.5, cav: 2.2 },
    { key: 'yakin', name: 'Göğüs göğüse', inf: 1.4, arch: 0.7, cav: 1.0 },
  ],
  LOSS: 0.0034,           // ön saftaki askerlerin saatlik kayıp oranı (oran 1'de)
};

// Ordunun bir evredeki etkinliği (piyade / okçu / süvari karışımına göre)
G.phaseMult = (a, ph) => {
  const cav = a.cav, rest = 1 - cav, arch = rest * 0.3, inf = rest - arch;
  return inf * ph.inf + arch * ph.arch + cav * ph.cav;
};

G.armyPower = function (a, att, ph, frac) {
  const S = G.S, n = S.nations[a.tag];
  let v = a.men * frac / 1000 * (0.35 + 0.65 * a.org / 100) * G.econ.combatFactor(a) * G.phaseMult(a, ph);
  if (att) {
    // süvari, saldırıda hareket üstünlüğü sağlar; piyade savunmada sağlamdır
    v *= (1 + 0.45 * a.cav) * n.atkMult * (1 + G.command.bonus(a, 'atk'));
    if (a.fleet != null) v *= (G.navy.fleet(a.fleet) || {}).harborWon ? 0.9 : 0.55;   // denizden çıkarma
  } else v *= (1 + 0.2 * (1 - a.cav)) * n.defMult * (1 + G.command.bonus(a, 'def'));
  return v;
};

G.bestSkill = arr => Math.max(1, ...arr.map(a => (a.general ? a.general.skill : 1) + (a.marshal != null && G.command.marshal(a.marshal) ? 1 : 0)));

G.stepBattles = function () {
  const S = G.S, P = S.provinces, B = G.BATTLE;
  const groups = new Map();
  for (const a of S.armies) {
    if (a.attacking == null) continue;
    const k = a.attacking + '|' + a.tag;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(a);
  }
  const live = new Set();
  for (const [k, grp] of groups) {
    // aynı saatte başka bir muharebede bozguna uğrayan ya da yok olan ordular saldırıdan düşer
    const atk = grp.filter(a => S.armies.includes(a) && a.attacking != null && !a.retreating);
    if (!atk.length) continue;
    const target = atk[0].attacking, tag = atk[0].tag;
    const def = G.hostileArmiesIn(target, tag).filter(d => !d.retreating);
    if (!def.length) { for (const a of atk) a.attacking = null; continue; }
    live.add(k);
    const tp = P[target];
    let b = S.battles.get(k);
    if (!b) {
      const from = atk[0].fleet != null ? target : atk[0].prov;
      b = { key: k, target, from, tag, defTag: def[0].tag, start: S.hour, casA: 0, casD: 0, phase: 0, hour: 0,
        diceA: 1 + Math.floor(G.rng() * 6), diceD: 1 + Math.floor(G.rng() * 6), atkIds: [], defIds: [] };
      S.battles.set(k, b);
      if (tag === S.player || def[0].tag === S.player) {
        G.log(`${tp.name} muharebesi başladı (${S.nations[tag].name} – ${S.nations[def[0].tag].name}).`, 'war', [tag, def[0].tag]);
      }
    }
    // evre ve zar: her evre başında yeniden atılır
    if (b.hour > 0 && b.hour % B.PHASE_HOURS === 0) {
      b.phase = (b.phase + 1) % B.PHASES.length;
      b.diceA = 1 + Math.floor(G.rng() * 6); b.diceD = 1 + Math.floor(G.rng() * 6);
    }
    b.hour++;
    const ph = B.PHASES[b.phase];
    const menA = atk.reduce((t, a) => t + a.men, 0), menD = def.reduce((t, a) => t + a.men, 0);
    const fA = Math.min(1, B.WIDTH / Math.max(1, menA)), fD = Math.min(1, B.WIDTH / Math.max(1, menD));
    const skA = G.bestSkill(atk), skD = G.bestSkill(def);
    const terr = G.terrainOf(tp);
    const fort = G.fortMod(tp, def[0].tag) * (tp.owner === def[0].tag ? 1.1 : 1) * terr.def;
    // nehir / dağ yok; bunun yerine saldıranın süvari üstünlüğü hücum evresinde kanat sarar
    const cavA = atk.reduce((t, a) => t + a.men * a.cav, 0), cavD = def.reduce((t, a) => t + a.men * a.cav, 0);
    const flank = terr.noFlank ? 1 : ph.key === 'hucum' && cavA > cavD * 1.5 ? 1.2 : ph.key === 'hucum' && cavD > cavA * 1.5 ? 0.85 : 1;
    const ap = atk.reduce((t, a) => t + G.armyPower(a, true, ph, fA), 0) * (0.7 + b.diceA * 0.06 + skA * 0.04) * flank;
    const dp = def.reduce((t, a) => t + G.armyPower(a, false, ph, fD), 0) * (0.7 + b.diceD * 0.06 + skD * 0.04) * fort;
    const ratio = G.clamp(ap / Math.max(0.01, dp), 0.2, 5);
    b.ratio = ratio; b.from = atk[0].fleet != null ? target : atk[0].prov;
    b.menA = menA; b.menD = menD; b.engA = menA * fA; b.engD = menD * fD; b.skA = skA; b.skD = skD; b.flank = flank;
    b.atkIds = atk.map(a => a.id); b.defIds = def.map(a => a.id);
    for (const d of def) {
      d.org -= 2.6 * ratio * G.rand(0.7, 1.3);
      const l = d.men * fD * B.LOSS * ratio * G.rand(0.6, 1.4);
      G.war.kill(d, l, tag); b.casD += l;
      d.inCombat = S.hour;
      G.command.gainXp(d, 0.08);
    }
    for (const a of atk) {
      G.command.gainXp(a, 0.08 * Math.min(2, ratio));
      a.org -= 2.6 / ratio * G.rand(0.7, 1.3);
      const l = a.men * fA * B.LOSS / ratio * G.rand(0.6, 1.4);
      G.war.kill(a, l, def[0].tag); b.casA += l;
      a.inCombat = S.hour;
    }
    // sonuçlar
    for (const d of def) {
      if (d.men < 500) { G.destroyArmy(d, `${d.name} (${S.nations[d.tag].name}) ${tp.name}'da yok edildi.`, tag); continue; }
      if (d.org <= 0) G.retreat(d, tag);
    }
    for (const a of atk) {
      if (a.men < 500) { G.destroyArmy(a, `${a.name} (${S.nations[a.tag].name}) saldırıda yok edildi.`, def[0].tag); continue; }
      if (a.org <= 3) { a.attacking = null; a.path = []; }
    }
    let winner = null;
    if (!G.hostileArmiesIn(target, tag).some(d => !d.retreating)) winner = tag;
    else if (!atk.some(a => S.armies.includes(a) && a.attacking === target)) winner = b.defTag;
    if (winner) { live.delete(k); G.endBattle(b, winner); }
  }
  for (const [k, b] of [...S.battles]) if (!live.has(k)) { S.battles.delete(k); if (!b.over) G.endBattle(b, null); }
};

G.endBattle = function (b, winner) {
  const S = G.S, tp = S.provinces[b.target];
  if (b.over) return;
  b.over = true;
  S.battles.delete(b.key);
  if (b.tag !== S.player && b.defTag !== S.player) return;
  const days = Math.max(1, Math.round((S.hour - b.start) / 24));
  const cas = `kayıplar: ${S.nations[b.tag].name} ${G.fmtNum(b.casA)}, ${S.nations[b.defTag].name} ${G.fmtNum(b.casD)}`;
  if (winner) {
    G.log(`${tp.name} muharebesini ${S.nations[winner].name} kazandı (${days} gün; ${cas}).`, winner === S.player ? 'good' : 'war', [b.tag, b.defTag]);
  }
  S.lastBattles ||= [];
  S.lastBattles.unshift({ ...b, winner, end: S.hour });
  S.lastBattles.length = Math.min(S.lastBattles.length, 12);
};

// Ordu yok edilir: geride kalan askerler ölür ya da esir düşer
G.destroyArmy = function (a, msg, byTag) {
  G.war.kill(a, a.men, byTag);
  G.removeArmy(a);
  G.log(msg, 'war', [a.tag]);
};

// Bozguna uğrayan ordu: dost toprağa yürüyerek çekilir (ışınlanmaz). Kaçacak yer yoksa imha olur.
G.retreat = function (a, byTag) {
  const S = G.S, P = S.provinces;
  if (a.retreating) return;
  a.org = Math.max(a.org, 0);
  a.attacking = null; a.besieging = false; a.prog = 0;
  // takip sırasında verilen kayıplar
  G.war.kill(a, a.men * G.rand(0.05, 0.1), byTag);
  const path = a.encircled ? null : G.war.escapePath(a);
  if (!path) {
    G.destroyArmy(a, `${a.name} (${S.nations[a.tag].name}) kuşatıldı ve imha edildi: ${G.fmtNum(a.men)} asker öldü ya da esir düştü.`, byTag);
    return;
  }
  a.path = path;
  a.retreating = true;
};

// Kuşatmalar. Kalesiz yerlerde basit ilerleme; kalelerde sur yıkımı, erzak, açlık ve hücum.
G.SIEGE = {
  WALL_DMG: 0.03,         // ordu-saat başına sur hasarı (kale seviyesine bölünür)
  FOOD_BASE: 40,          // garnizonun erzakı (gün) = 40 + 20 × kale seviyesi
  FOOD_PER_LEVEL: 20,
  STARVE: 0.0015,         // erzak bitince garnizonun saatlik kaybı
};

G.stepSieges = function () {
  const S = G.S, P = S.provinces;
  const besiegers = new Map();
  for (const a of S.armies) {
    if (a.attacking != null || a.fleet != null || a.retreating) continue;
    const p = P[a.prov];
    if (G.atWar(a.tag, p.ctrl)) {
      if (!besiegers.has(p.id)) besiegers.set(p.id, []);
      besiegers.get(p.id).push(a);
    }
  }
  for (const p of P) {
    if (p.siege && !besiegers.has(p.id)) {
      // kuşatma kalktı: kalesiz yerde ilerleme söner, kalede erzak yeniden toplanır
      if (p.siege.fort) { p.siege = null; G.mapDirty = true; continue; }
      p.siege.progress -= 2;
      if (p.siege.progress <= 0) { p.siege = null; G.mapDirty = true; }
    }
  }
  for (const [pid, arr] of besiegers) {
    const p = P[pid];
    const tag = arr.reduce((b, a) => (a.men > b.men ? a : b)).tag;
    if (p.fort) { G.stepFortSiege(p, tag, arr); continue; }
    let need = G.econ.siegeNeed(p);
    if (p.owner === tag) need /= 3;   // kendi toprağını kurtarmak kolaydır
    if (!p.siege || p.siege.by !== tag) p.siege = { by: tag, progress: 0, need };
    const power = arr.reduce((s, a) => s + a.men / G.ARMY_MEN * (1 + G.command.bonus(a, 'siege')) * (S.nations[a.tag].siegeMult || 1), 0);
    p.siege.progress += power;
    if (p.siege.progress >= p.siege.need) G.captureProvince(p, tag, arr);
  }
};

G.siegePower = (arr) => arr.reduce((s, a) => s + a.men / G.ARMY_MEN * (1 + G.command.bonus(a, 'siege')) * (G.S.nations[a.tag].siegeMult || 1), 0);

// Kale kuşatması: abluka, sur yıkımı, açlık; isteğe bağlı hücum
G.stepFortSiege = function (p, tag, arr) {
  const S = G.S, SG = G.SIEGE;
  if (p.walls == null) p.walls = 100;
  if (!p.siege || p.siege.by !== tag || !p.siege.fort) {
    const food = SG.FOOD_BASE + SG.FOOD_PER_LEVEL * p.fort;
    p.siege = { by: tag, fort: true, food, foodMax: food, start: S.hour, assault: null, cas: 0, gcas: 0 };
    if (tag === S.player || p.ctrl === S.player) {
      G.log(`${p.name} kalesi kuşatıldı (${S.nations[tag].name}). Surlar %${Math.round(p.walls)}, garnizon ${G.fmtNum(p.garrison)}.`, tag === S.player ? 'good' : 'war', [tag, p.ctrl]);
    }
  }
  const sg = p.siege, def = p.ctrl;
  const men = arr.reduce((s, a) => s + a.men, 0);
  // kendi kalesini kurtaran ordu: içeride dost kalmadığı için hızla alır
  if (p.owner === tag && p.garrison <= 0) { G.captureProvince(p, tag, arr); return; }
  // hücum sürüyor
  if (sg.assault) {
    const wallF = p.walls / 100;
    const aLoss = 0.004 * (0.5 + wallF) * (1 + 0.15 * p.fort);
    let lost = 0;
    for (const a of arr) {
      const l = a.men * aLoss * G.rand(0.7, 1.3);
      G.war.kill(a, l, def); lost += l;
      a.org = Math.max(0, a.org - 1.2 * G.rand(0.6, 1.4));
      a.inCombat = S.hour;
    }
    const gLoss = Math.min(p.garrison, men / 1000 * 6 * (1.6 - wallF) / Math.sqrt(p.fort) * G.rand(0.7, 1.3) *
      (S.nations[tag].atkMult || 1));
    p.garrison -= gLoss;
    G.war.record(def, gLoss, tag);
    sg.cas += lost; sg.gcas += gLoss; sg.assault.hours++;
    if (p.garrison <= 1) {
      if (tag === S.player || def === S.player) G.log(`${p.name} kalesine hücum başarılı! Kale düştü (kaybımız ${G.fmtNum(sg.cas)}).`, tag === S.player ? 'good' : 'war', [tag, def]);
      G.captureProvince(p, tag, arr);
      return;
    }
    const org = arr.reduce((s, a) => s + a.org * a.men, 0) / Math.max(1, men);
    if (org < 12) {
      sg.assault = null;
      if (tag === S.player || def === S.player) G.log(`${p.name} kalesine hücum püskürtüldü. Kuşatanlar ${G.fmtNum(sg.cas)} kayıp verdi.`, def === S.player ? 'good' : 'war', [tag, def]);
    }
    return;
  }
  // abluka: garnizonun en az bir buçuk katı asker gerekir
  const blockade = men >= Math.max(1500, p.garrison * 1.5);
  sg.stalled = !blockade;
  // çıkış baskınları: garnizon kuşatanları hırpalar
  if (p.garrison > 0) {
    for (const a of arr) G.war.kill(a, a.men * 0.00015 * Math.min(3, p.garrison / 1000), def);
    const gl = Math.min(p.garrison, Math.min(men, p.garrison * 6) * 0.00003);
    p.garrison -= gl; G.war.record(def, gl, tag);
  }
  if (!blockade) return;
  // mancınıklar surları döver
  p.walls = Math.max(0, p.walls - G.siegePower(arr) * SG.WALL_DMG / p.fort);
  // erzak tükenir, sonra açlık başlar
  sg.food = Math.max(0, sg.food - 1 / 24);
  if (sg.food <= 0 && p.garrison > 0) {
    const l = Math.max(2, p.garrison * SG.STARVE);
    p.garrison = Math.max(0, p.garrison - l); G.war.record(def, l, tag);
  }
  if (p.garrison <= 1) {
    if (tag === S.player || def === S.player) G.log(`${p.name} garnizonu açlıktan teslim oldu.`, tag === S.player ? 'good' : 'war', [tag, def]);
    G.captureProvince(p, tag, arr); return;
  }
  if (p.walls <= 0) {
    // gedik açıldı: kale düşer, son savunucular kılıçtan geçirilir ama saldırana da pahalıya patlar
    for (const a of arr) G.war.kill(a, p.garrison * 0.6 * a.men / men, def);
    G.war.record(def, p.garrison, tag);
    if (tag === S.player || def === S.player) G.log(`${p.name} surlarında gedik açıldı, kale düştü!`, tag === S.player ? 'good' : 'war', [tag, def]);
    G.captureProvince(p, tag, arr); return;
  }
  // yapay zekâ hücuma karar verir
  if (tag !== S.player && S.hour % 24 === 0 && G.siegeShouldAssault(p, men)) G.startAssault(p);
};

G.siegeShouldAssault = (p, men) => (p.walls < 35 && men > p.garrison * 4) || (p.walls < 15 && men > p.garrison * 2) ||
  (men > p.garrison * 10 && p.walls < 70);

G.startAssault = function (p) {
  const S = G.S, sg = p.siege;
  if (!sg || !sg.fort || sg.assault) return false;
  const arr = S.armies.filter(a => a.prov === p.id && a.tag === sg.by && a.fleet == null && !a.retreating);
  if (!arr.length || arr.reduce((s, a) => s + a.org * a.men, 0) / arr.reduce((s, a) => s + a.men, 0) < 30) return false;
  sg.assault = { hours: 0, start: S.hour };
  if (sg.by === S.player || p.ctrl === S.player) G.log(`${S.nations[sg.by].name}, ${p.name} kalesine hücum ediyor!`, sg.by === S.player ? 'good' : 'war', [sg.by, p.ctrl]);
  return true;
};

// Hücumun kabaca bedeli (oyuncuya gösterilir)
G.assaultEstimate = function (p) {
  const S = G.S, sg = p.siege;
  const arr = S.armies.filter(a => a.prov === p.id && a.tag === sg.by && a.fleet == null);
  const men = arr.reduce((s, a) => s + a.men, 0);
  if (!men) return null;
  const wallF = p.walls / 100;
  const gPerH = men / 1000 * 6 * (1.6 - wallF) / Math.sqrt(p.fort);
  const hours = p.garrison / Math.max(1, gPerH);
  return { hours, loss: Math.min(men, men * 0.004 * (0.5 + wallF) * (1 + 0.15 * p.fort) * hours) };
};

G.captureProvince = function (p, tag, arr) {
  const S = G.S, old = p.ctrl;
  const wasCapital = G.econ.isCapital(p) && p.owner === old;
  p.ctrl = tag; p.siege = null; p.garrison = 0;
  G.mapDirty = true;
  for (const a of arr) a.besieging = false;
  if (p.kind !== 'rural' || tag === S.player || old === S.player) {
    const verb = p.owner === tag ? 'geri aldı' : 'ele geçirdi';
    G.log(`${S.nations[tag].name} ${p.fort ? `${p.name} kalesini` : `${p.name}'ı`} ${verb}.`, tag === S.player ? 'good' : 'war', [tag, old]);
  }
  if (wasCapital) G.checkCapitulation(old);
};

G.checkCapitulation = function (tag) {
  const S = G.S, n = S.nations[tag];
  if (!n || !n.alive || !n.enemies.size) return;
  let total = 0, held = 0;
  for (const p of S.provinces) {
    if (p.owner !== tag) continue;
    const w = G.provinceWeight(p);
    total += w;
    if (p.ctrl === tag) held += w;
  }
  const capLost = n.capital == null || S.provinces[n.capital].ctrl !== tag;
  const ratio = total ? held / total : 0;
  n.capRatio = ratio;
  let ready = ratio < 0.2;
  if (!ready && capLost && ratio < 0.4) {
    // ordusu hâlâ güçlüyse direnmeye devam eder
    const mine = G.nationStats(tag).men;
    let foes = 0;
    for (const e of n.enemies) foes += G.nationStats(e).men;
    ready = mine < foes * 0.4;
  }
  // oyuncuya karşı savaşan ülke: teslimiyet oyuncunun onayına sunulur
  if (tag !== S.player && n.enemies.has(S.player)) {
    if (held <= 0) { G.capitulate(tag); return; }        // bütün toprakları işgal edildi: hepsi işgalcilere geçer
    if (ready && !n.surrenderRefused && !n.surrenderAsked) G.war.offerSurrender(tag);
    return;
  }
  if (ready) G.capitulate(tag);
};

G.daily = function () {
  const S = G.S, P = S.provinces;
  // örgütlenme ve takviye
  G.war.daily();
  for (const a of S.armies) {
    const recent = a.inCombat != null && S.hour - a.inCombat < 2;
    if (a.fleet != null) { a.org = Math.max(30, a.org - 2); continue; }   // gemide yorulur
    if (a.encircled) continue;   // kuşatılmış ordu toparlanamaz ve takviye alamaz
    if (!recent) {
      const home = G.sameRealm(P[a.prov].ctrl, a.tag);
      a.org = Math.min(100, a.org + (home ? 14 : 7) * (1 + G.command.bonus(a, 'org')) * (S.nations[a.tag].orgMult || 1));
      if (home && a.men < a.maxMen) {
        const n = S.nations[a.tag];
        const add = Math.min(a.maxMen - a.men, a.maxMen * 0.03, n.manpower);
        a.men += add; n.manpower -= add;
      }
    }
  }
  G.econ.daily();
  // eğitim kuyrukları
  for (const n of Object.values(S.nations)) {
    if (!n.alive || !n.queue.length) continue;
    while (n.queue.length && n.queue[0].done <= S.hour) {
      n.queue.shift();
      const spawn = G.spawnPoint(n.tag);
      if (spawn == null) { n.manpower += G.RECRUIT_COST; continue; }
      const a = G.createArmy(n.tag, spawn, G.RECRUIT_COST);
      // boş yeri olan bir mareşale bağla
      const m = G.command.of(n.tag).find(m => G.command.armies(m).length < G.command.MAX_ARMIES);
      if (m) a.marshal = m.id;
      if (n.tag === S.player) G.log(`${a.name} eğitimini tamamladı (${P[spawn].name}).`, 'good', [n.tag]);
    }
  }
  // teslimiyet kontrolü
  for (const n of Object.values(S.nations)) if (n.alive && n.enemies.size) G.checkCapitulation(n.tag);
  G.focus.daily();
  G.dip.daily();
  G.navy.daily();
  G.events.check();
};

G.spawnPoint = function (tag) {
  const S = G.S, n = S.nations[tag];
  const ok = p => p.ctrl === tag && p.owner === tag && !G.hostileArmiesIn(p.id, tag).length;
  if (n.capital != null && ok(S.provinces[n.capital])) return n.capital;
  const c = S.provinces.find(p => ok(p) && p.kind !== 'rural') || S.provinces.find(ok);
  return c ? c.id : null;
};

G.recruit = function (tag) {
  const S = G.S, n = S.nations[tag];
  if (n.manpower < G.RECRUIT_COST || n.gold < G.econ.RECRUIT_GOLD) return false;
  n.manpower -= G.RECRUIT_COST;
  n.gold -= G.econ.RECRUIT_GOLD;
  n.queue.push({ done: S.hour + G.RECRUIT_DAYS * 24 });
  return true;
};

G.monthly = function () {
  const S = G.S;
  for (const n of Object.values(S.nations)) {
    if (!n.alive) continue;
    const mp = G.monthlyManpower(n.tag);
    if (n.overlord && S.nations[n.overlord] && S.nations[n.overlord].alive) {
      n.manpower += mp * (1 - n.tribute);
      S.nations[n.overlord].manpower += mp * n.tribute;
    } else n.manpower += mp;
    const cap = mp * 24 + 20000;
    if (n.manpower > cap) n.manpower = cap;
  }
  G.econ.monthly();
  G.ai.monthly();
  G.dip.monthly();
};
