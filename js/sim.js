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
    a.prog += G.armySpeed(a) * (0.6 + 0.4 * a.org / 100);
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

G.stepBattles = function () {
  const S = G.S, P = S.provinces;
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
    const power = (arr, att) => arr.reduce((s, a) => s + a.men / 1000 * (0.35 + 0.65 * a.org / 100) * G.econ.combatFactor(a) *
      (att ? (1 + 0.55 * a.cav) * S.nations[a.tag].atkMult * (1 + G.command.bonus(a, 'atk')) * (a.fleet != null ? ((G.navy.fleet(a.fleet) || {}).harborWon ? 0.9 : 0.55) : 1)
        : (1 + 0.25 * (1 - a.cav)) * S.nations[a.tag].defMult * (1 + G.command.bonus(a, 'def'))), 0);
    const ap = power(atk, true);
    const dp = power(def, false) * G.fortMod(tp, def[0].tag) * (tp.owner === def[0].tag ? 1.1 : 1);
    const ratio = G.clamp(ap / Math.max(0.01, dp), 0.2, 5);
    for (const d of def) {
      d.org -= 2.6 * ratio * G.rand(0.7, 1.3);
      G.war.kill(d, d.men * 0.0022 * ratio * G.rand(0.6, 1.4), tag);
      d.inCombat = S.hour;
    }
    for (const d of def) G.command.gainXp(d, 0.08);
    for (const a of atk) {
      G.command.gainXp(a, 0.08 * Math.min(2, ratio));
      a.org -= 2.6 / ratio * G.rand(0.7, 1.3);
      G.war.kill(a, a.men * 0.0022 / ratio * G.rand(0.6, 1.4), def[0].tag);
      a.inCombat = S.hour;
    }
    let b = S.battles.get(k);
    if (!b) {
      const from = atk[0].fleet != null ? target : atk[0].prov;
      b = { target, from, tag, defTag: def[0].tag, start: S.hour };
      S.battles.set(k, b);
      if (tag === S.player || def[0].tag === S.player) {
        G.log(`${tp.name} muharebesi başladı (${S.nations[tag].name} – ${S.nations[def[0].tag].name}).`, 'war', [tag, def[0].tag]);
      }
    }
    b.ratio = ratio; b.from = atk[0].fleet != null ? target : atk[0].prov;
    // sonuçlar
    for (const d of def) {
      if (d.men < 500) { G.destroyArmy(d, `${d.name} (${S.nations[d.tag].name}) ${tp.name}'da yok edildi.`, tag); continue; }
      if (d.org <= 0) G.retreat(d, tag);
    }
    for (const a of atk) {
      if (a.men < 500) { G.destroyArmy(a, `${a.name} (${S.nations[a.tag].name}) saldırıda yok edildi.`, def[0].tag); continue; }
      if (a.org <= 3) { a.attacking = null; a.path = []; }
    }
    if (!G.hostileArmiesIn(target, tag).some(d => !d.retreating)) {
      live.delete(k);
      if (tag === S.player || b.defTag === S.player) {
        G.log(`${tp.name} muharebesini ${S.nations[tag].name} kazandı.`, tag === S.player ? 'good' : 'war', [tag, b.defTag]);
      }
    } else if (!atk.some(a => a.attacking === target)) {
      live.delete(k);
      if (tag === S.player || b.defTag === S.player) {
        G.log(`${tp.name} muharebesini ${S.nations[b.defTag].name} kazandı.`, b.defTag === S.player ? 'good' : 'war', [tag, b.defTag]);
      }
    }
  }
  for (const k of [...S.battles.keys()]) if (!live.has(k)) S.battles.delete(k);
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

G.stepSieges = function () {
  const S = G.S, P = S.provinces;
  const besiegers = new Map();
  for (const a of S.armies) {
    if (a.attacking != null || a.fleet != null) continue;
    const p = P[a.prov];
    if (G.atWar(a.tag, p.ctrl)) {
      if (!besiegers.has(p.id)) besiegers.set(p.id, []);
      besiegers.get(p.id).push(a);
    }
  }
  for (const p of P) {
    if (p.siege && !besiegers.has(p.id)) {
      p.siege.progress -= 2;
      if (p.siege.progress <= 0) { p.siege = null; G.mapDirty = true; }
    }
  }
  for (const [pid, arr] of besiegers) {
    const p = P[pid];
    const tag = arr.reduce((b, a) => (a.men > b.men ? a : b)).tag;
    let need = G.econ.siegeNeed(p);
    if (p.owner === tag) need /= 3;   // kendi toprağını kurtarmak kolaydır
    if (!p.siege || p.siege.by !== tag) p.siege = { by: tag, progress: 0, need };
    const men = arr.reduce((s, a) => s + a.men, 0);
    const maxG = G.econ.maxGarrison(p);
    // garnizon kuşatanlara kayıp verdirir, kuşatanlar da garnizonu eritir
    if (p.garrison > 0) {
      for (const a of arr) G.war.kill(a, a.men * 0.0004 * (p.garrison / 1000), p.ctrl);
      const gl = Math.min(p.garrison, men * 0.0006);
      p.garrison -= gl;
      G.war.record(p.ctrl, gl, tag);
    }
    // garnizonun iki katından az askerle kuşatma ilerlemez
    if (p.garrison > 0 && men < p.garrison * 2) { p.siege.stalled = true; continue; }
    p.siege.stalled = false;
    const power = arr.reduce((s, a) => s + a.men / G.ARMY_MEN * (1 + G.command.bonus(a, 'siege')) * (S.nations[a.tag].siegeMult || 1), 0);
    p.siege.progress += power * (maxG ? 1 - 0.5 * p.garrison / maxG : 1);
    if (p.siege.progress >= p.siege.need) {
      const old = p.ctrl;
      const wasCapital = G.econ.isCapital(p) && p.owner === old;
      p.ctrl = tag; p.siege = null; p.garrison = 0;
      G.mapDirty = true;
      for (const a of arr) a.besieging = false;
      if (p.kind !== 'rural' || tag === S.player || old === S.player) {
        const verb = p.owner === tag ? 'geri aldı' : 'ele geçirdi';
        G.log(`${S.nations[tag].name} ${p.fort ? `${p.name} kalesini` : `${p.name}'ı`} ${verb}.`, tag === S.player ? 'good' : 'war', [tag, old]);
      }
      if (wasCapital) G.checkCapitulation(old);
    }
  }
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
