// Simülasyon: zaman, hareket, muharebe, kuşatma, insan gücü
'use strict';

const SIEGE_NEED = { capital: 420, city: 160, rural: 36 };  // "ordu-saat" cinsinden

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
  G.stepBattles();
  G.stepSieges();
  if (newDay) G.daily();
  if (newMonth) G.monthly();
  if (t.h % 12 === 0) G.ai.update(t.h === 0);
};

G.stepArmies = function () {
  const S = G.S, P = S.provinces;
  for (const a of S.armies) {
    if (!a.path.length) continue;
    const next = a.path[0], np = P[next];
    if (!G.canEnter(a.tag, np)) { a.path = []; a.prog = 0; continue; }
    const cur = P[a.prov];
    // kuşatma sürerken ordu yerinde kalır
    if (a.besieging && G.atWar(a.tag, cur.ctrl)) continue;
    a.besieging = false;
    if (G.hostileArmiesIn(next, a.tag).length) {
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
    }
  }
};

G.fortMod = p => p.kind === 'capital' ? 1.45 : p.kind === 'city' ? 1.2 : 1.0;

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
  for (const [k, atk] of groups) {
    const target = atk[0].attacking, tag = atk[0].tag;
    const def = G.hostileArmiesIn(target, tag);
    if (!def.length) { for (const a of atk) a.attacking = null; continue; }
    live.add(k);
    const tp = P[target];
    const power = (arr, att) => arr.reduce((s, a) => s + a.men / 1000 * (0.35 + 0.65 * a.org / 100) *
      (att ? 1 + 0.55 * a.cav : 1 + 0.25 * (1 - a.cav)), 0);
    const ap = power(atk, true);
    const dp = power(def, false) * G.fortMod(tp) * (tp.owner === def[0].tag ? 1.1 : 1);
    const ratio = G.clamp(ap / Math.max(0.01, dp), 0.2, 5);
    for (const d of def) {
      d.org -= 2.6 * ratio * G.rand(0.7, 1.3);
      d.men -= d.men * 0.0022 * ratio * G.rand(0.6, 1.4);
      d.inCombat = S.hour;
    }
    for (const a of atk) {
      a.org -= 2.6 / ratio * G.rand(0.7, 1.3);
      a.men -= a.men * 0.0022 / ratio * G.rand(0.6, 1.4);
      a.inCombat = S.hour;
    }
    let b = S.battles.get(k);
    if (!b) {
      const from = atk[0].prov;
      b = { target, from, tag, defTag: def[0].tag, start: S.hour };
      S.battles.set(k, b);
      if (tag === S.player || def[0].tag === S.player) {
        G.log(`${tp.name} muharebesi başladı (${S.nations[tag].name} – ${S.nations[def[0].tag].name}).`, 'war', [tag, def[0].tag]);
      }
    }
    b.ratio = ratio; b.from = atk[0].prov;
    // sonuçlar
    for (const d of def) {
      if (d.men < 400) { G.destroyArmy(d, `${d.name} (${S.nations[d.tag].name}) ${tp.name}'da yok edildi.`); continue; }
      if (d.org <= 0) G.retreat(d);
    }
    for (const a of atk) {
      if (a.men < 400) { G.destroyArmy(a, `${a.name} (${S.nations[a.tag].name}) saldırıda yok edildi.`); continue; }
      if (a.org <= 3) { a.attacking = null; a.path = []; }
    }
    if (!G.hostileArmiesIn(target, tag).length) {
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

G.destroyArmy = function (a, msg) {
  G.removeArmy(a);
  G.log(msg, 'war', [a.tag]);
};

G.retreat = function (a) {
  const S = G.S, P = S.provinces, p = P[a.prov];
  let best = null;
  for (const n of p.nb) {
    const np = P[n];
    if (!G.canEnter(a.tag, np) || G.hostileArmiesIn(n, a.tag).length) continue;
    const score = (np.ctrl === a.tag ? 10 : 0) + G.rand();
    if (!best || score > best.s) best = { s: score, n };
  }
  a.org = Math.max(a.org, 0);
  a.attacking = null; a.path = []; a.prog = 0;
  if (!best) {
    G.destroyArmy(a, `${a.name} (${S.nations[a.tag].name}) kuşatıldı ve imha edildi.`);
    return;
  }
  a.prov = best.n;
  a.besieging = G.atWar(a.tag, P[best.n].ctrl);
};

G.stepSieges = function () {
  const S = G.S, P = S.provinces;
  const besiegers = new Map();
  for (const a of S.armies) {
    const p = P[a.prov];
    if (a.attacking != null) continue;
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
    let need = SIEGE_NEED[p.kind] || 40;
    if (p.owner === tag) need /= 3;   // kendi toprağını kurtarmak kolaydır
    if (!p.siege || p.siege.by !== tag) p.siege = { by: tag, progress: 0, need };
    const power = arr.reduce((s, a) => s + a.men / ARMY_MEN_OR(a), 0);
    p.siege.progress += power;
    if (p.siege.progress >= p.siege.need) {
      const old = p.ctrl;
      p.ctrl = tag; p.siege = null;
      G.mapDirty = true;
      for (const a of arr) a.besieging = false;
      if (p.kind !== 'rural' || tag === S.player || old === S.player) {
        const verb = p.owner === tag ? 'geri aldı' : 'ele geçirdi';
        G.log(`${S.nations[tag].name} ${p.name}'ı ${verb}.`, tag === S.player ? 'good' : 'war', [tag, old]);
      }
      if (p.kind === 'capital' && p.owner === old) G.checkCapitulation(old);
    }
  }
};
function ARMY_MEN_OR(a) { return a.maxMen || G.ARMY_MEN; }

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
  if (ratio < 0.2) { G.capitulate(tag); return; }
  if (capLost && ratio < 0.4) {
    // ordusu hâlâ güçlüyse direnmeye devam eder
    const mine = G.nationStats(tag).men;
    let foes = 0;
    for (const e of n.enemies) foes += G.nationStats(e).men;
    if (mine < foes * 0.4) G.capitulate(tag);
  }
};

G.daily = function () {
  const S = G.S, P = S.provinces;
  // örgütlenme ve takviye
  for (const a of S.armies) {
    const recent = a.inCombat != null && S.hour - a.inCombat < 2;
    if (!recent) {
      const home = P[a.prov].ctrl === a.tag;
      a.org = Math.min(100, a.org + (home ? 14 : 7));
      if (home && a.men < a.maxMen) {
        const n = S.nations[a.tag];
        const add = Math.min(a.maxMen - a.men, a.maxMen * 0.03, n.manpower);
        a.men += add; n.manpower -= add;
      }
    }
  }
  // eğitim kuyrukları
  for (const n of Object.values(S.nations)) {
    if (!n.alive || !n.queue.length) continue;
    while (n.queue.length && n.queue[0].done <= S.hour) {
      n.queue.shift();
      const spawn = G.spawnPoint(n.tag);
      if (spawn == null) { n.manpower += G.RECRUIT_COST; continue; }
      const a = G.createArmy(n.tag, spawn);
      if (n.tag === S.player) G.log(`${a.name} eğitimini tamamladı (${P[spawn].name}).`, 'good', [n.tag]);
    }
  }
  // teslimiyet kontrolü
  for (const n of Object.values(S.nations)) if (n.alive && n.enemies.size) G.checkCapitulation(n.tag);
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
  if (n.manpower < G.RECRUIT_COST) return false;
  n.manpower -= G.RECRUIT_COST;
  n.queue.push({ done: S.hour + G.RECRUIT_DAYS * 24 });
  return true;
};

G.monthly = function () {
  const S = G.S;
  for (const n of Object.values(S.nations)) {
    if (!n.alive) continue;
    n.manpower += G.monthlyManpower(n.tag);
    const cap = G.monthlyManpower(n.tag) * 24 + 20000;
    if (n.manpower > cap) n.manpower = cap;
  }
  G.ai.monthly();
};
