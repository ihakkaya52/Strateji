// Komuta zinciri: Mareşal → en fazla 3 ordu komutanı → her komutanın ordusu (8B–15B asker)
// Cepheler ve taarruz emirleri mareşale verilir (HOI4 tarzı).
'use strict';

G.command = {};
const C = G.command;

C.MAX_ARMIES = 3;                 // bir mareşalin yönetebileceği ordu sayısı
C.capFor = skill => 8000 + (G.clamp(skill, 1, 5) - 1) * 1750;   // 1 yıldız 8B ... 5 yıldız 15B
C.COLORS = ['#e8c35a', '#7fc4e0', '#e07a6a', '#9ad07a', '#c49ae0', '#e0a85a', '#5ae0c0', '#e05aa8'];

C.marshal = id => G.S.marshals.find(m => m.id === id);
C.of = tag => G.S.marshals.filter(m => m.tag === tag);
C.armies = m => G.S.armies.filter(a => a.marshal === m.id);
C.freeArmies = tag => G.S.armies.filter(a => a.tag === tag && a.marshal == null);

C.createMarshal = function (tag, armies) {
  const S = G.S;
  const mine = C.of(tag).length;
  const leader = G.makeLeader(tag, false);
  leader.skill = Math.max(leader.skill, 2);
  const m = {
    id: S.nextMarshalId++, tag, leader,
    front: null, attack: false, target: null,
    color: C.COLORS[mine % C.COLORS.length],
  };
  S.marshals.push(m);
  for (const a of armies.slice(0, C.MAX_ARMIES)) a.marshal = m.id;
  return m;
};

C.removeMarshal = function (m) {
  for (const a of C.armies(m)) a.marshal = null;
  G.S.marshals.splice(G.S.marshals.indexOf(m), 1);
};

C.attach = function (a, m) {
  if (C.armies(m).length >= C.MAX_ARMIES && a.marshal !== m.id) return false;
  a.marshal = m.id;
  return true;
};

// Başlangıç: orduları yakınlığa göre üçerli mareşal gruplarına böler
C.organize = function (tag) {
  const S = G.S;
  const free = C.freeArmies(tag).filter(a => a.fleet == null);
  while (free.length) {
    const seed = free.shift();
    const sp = S.provinces[seed.prov];
    free.sort((x, y) => G.distKm(S.provinces[x.prov], sp) - G.distKm(S.provinces[y.prov], sp));
    C.createMarshal(tag, [seed, ...free.splice(0, C.MAX_ARMIES - 1)]);
  }
};

// Komutan etkisi: ordu komutanı + bağlı olduğu mareşal
C.bonus = function (a, key) {
  let v = 0;
  const add = (g, w) => {
    if (!g) return;
    if (key === 'atk' || key === 'def') v += 0.03 * g.skill * w;
    if (key === 'siege') v += 0.04 * g.skill * w;
    const t = g.trait ? G.TRAITS[g.trait] : null;
    if (t && t[key]) v += t[key] * w;
  };
  add(a.general, 1);
  if (a.marshal != null && G.S.marshals) {
    const m = C.marshal(a.marshal);
    if (m) add(m.leader, 0.5);
  }
  return v;
};

// Komutan tecrübesi: savaştıkça artar, yıldız yükselince ordunun kapasitesi büyür
C.gainXp = function (a, amount) {
  const g = a.general;
  if (!g || g.skill >= 5) return;
  g.xp = (g.xp || 0) + amount;
  const need = 60 * g.skill;
  if (g.xp >= need) {
    g.xp -= need;
    g.skill++;
    a.maxMen = C.capFor(g.skill) + (G.S.nations[a.tag].capBonus || 0);
    if (a.tag === G.S.player) G.log(`${g.name} terfi etti (${g.skill} yıldız). Ordusu artık ${G.fmtK(a.maxMen)} asker alabilir.`, 'good', [a.tag]);
  }
};

// ------------------------------------------------------------ bölme / birleştirme
C.split = function (a) {
  const S = G.S;
  if (a.men < 4000 || a.fleet != null || a.attacking != null) return null;
  const half = Math.floor(a.men / 2);
  const b = G.createArmy(a.tag, a.prov, half);
  a.men -= half;
  b.org = a.org; b.path = []; b.besieging = a.besieging;
  if (a.marshal != null) {
    const m = C.marshal(a.marshal);
    if (m && C.armies(m).length < C.MAX_ARMIES) b.marshal = m.id;
  }
  return b;
};

// Aynı eyaletteki orduları birleştirir; kapasiteyi aşan asker yerinde kalır
C.merge = function (armies) {
  const list = armies.filter(a => a.fleet == null && a.attacking == null);
  if (list.length < 2) return 'Birleştirmek için aynı eyalette en az iki ordu seçin.';
  const prov = list[0].prov;
  if (!list.every(a => a.prov === prov)) return 'Ordular aynı eyalette olmalı.';
  list.sort((x, y) => y.maxMen - x.maxMen);
  const main = list[0];
  for (const o of list.slice(1)) {
    const room = main.maxMen - main.men;
    if (room <= 0) break;
    const move = Math.min(room, o.men);
    main.org = (main.org * main.men + o.org * move) / (main.men + move);
    main.men += move; o.men -= move;
    if (o.men < 500) { main.men += o.men; G.removeArmy(o); }
  }
  return null;
};

// ------------------------------------------------------------ cepheler
C.frontProvinces = function (tag, enemy) {
  const P = G.S.provinces, out = [];
  for (const p of P) {
    if (p.kind === 'waste' || !G.sameRealm(p.ctrl, tag)) continue;
    for (const n of p.nb) {
      const q = P[n];
      if (q.kind !== 'waste' && G.sameRealm(q.ctrl, enemy) && !G.sameRealm(q.ctrl, tag)) { out.push(p.id); break; }
    }
  }
  return out;
};

C.frontEdges = function (tag, enemy) {
  const P = G.S.provinces, out = [];
  for (const id of C.frontProvinces(tag, enemy)) {
    for (const n of P[id].nb) if (P[n].kind !== 'waste' && G.sameRealm(P[n].ctrl, enemy)) out.push([id, n]);
  }
  return out;
};

C.idle = a => a.fleet == null && !a.path.length && a.attacking == null &&
  !(a.besieging && G.atWar(a.tag, G.S.provinces[a.prov].ctrl));

C.update = function () {
  const S = G.S;
  if (!S.marshals) return;
  for (const m of S.marshals.slice()) {
    const n = S.nations[m.tag];
    if (!n || !n.alive) { S.marshals.splice(S.marshals.indexOf(m), 1); continue; }
    if (m.tag !== S.player || !m.front) continue;   // yapay zekâ kendi mantığıyla yönetir
    if (!S.nations[m.front] || !S.nations[m.front].alive) { m.front = null; m.attack = false; m.target = null; continue; }
    C.deploy(m);
  }
  const fronts = new Map();
  for (const m of S.marshals) {
    if (m.tag !== S.player || !m.front || !m.attack) continue;
    if (!fronts.has(m.front)) fronts.set(m.front, []);
    fronts.get(m.front).push(m);
  }
  for (const [enemy, list] of fronts) C.attackPhase(S.player, enemy, list);
};

// Savunma: mareşalin orduları cephe boyunca dağılır
C.deploy = function (m) {
  const S = G.S, P = S.provinces, tag = m.tag;
  const front = C.frontProvinces(tag, m.front);
  if (!front.length) return;
  const frontSet = new Set(front);
  if (m.target != null && G.sameRealm(P[m.target].ctrl, tag)) {
    G.log(`${m.leader.name} taarruz hedefine ulaştı: ${P[m.target].name}.`, 'good', [tag]);
    m.target = null;
  }
  const armies = C.armies(m).filter(a => a.fleet == null);
  const load = new Map(front.map(id => [id, 0]));
  for (const a of S.armies) {
    if (a.tag !== tag || a.fleet != null) continue;
    const dest = a.path.length ? a.path[a.path.length - 1] : a.prov;
    if (load.has(dest)) load.set(dest, load.get(dest) + 1);
  }
  const tp = m.target != null ? P[m.target] : null;
  for (const a of armies) {
    if (!C.idle(a) || frontSet.has(a.prov)) continue;
    const { dist, prev } = G.distancesFrom(tag, a.prov, 3000);
    let best = null;
    for (const id of front) {
      const d = dist.get(id);
      if (d === undefined) continue;
      let score = load.get(id) * 700 + d;
      if (tp) score += G.distKm(P[id], tp) * 0.6;
      if (!best || score < best.s) best = { s: score, id };
    }
    if (!best) continue;
    const path = G.pathFromPrev(prev, a.prov, best.id);
    if (path && path.length) { a.path = path; a.prog = 0; load.set(best.id, load.get(best.id) + 1); }
  }
};

// Taarruz: aynı eyaletteki hazır ordular birlikte en uygun komşu düşman eyaletine saldırır
C.attackPhase = function (tag, enemy, list) {
  const S = G.S, P = S.provinces;
  if (!(G.atWar(tag, enemy) || G.realm(enemy).some(t => G.atWar(tag, t)))) return;
  const frontSet = new Set(C.frontProvinces(tag, enemy));
  const ids = new Set(list.map(m => m.id));
  const groups = new Map();
  for (const a of S.armies) {
    if (a.tag !== tag || !ids.has(a.marshal) || !C.idle(a) || a.org < 50 || !frontSet.has(a.prov)) continue;
    if (!groups.has(a.prov)) groups.set(a.prov, []);
    groups.get(a.prov).push(a);
  }
  const foe = new Map();
  for (const a of S.armies) if (a.prov != null && G.atWar(tag, a.tag)) foe.set(a.prov, (foe.get(a.prov) || 0) + a.men * a.org / 100);
  for (const [pid, grp] of groups) {
    const mine = grp.reduce((s, a) => s + a.men * a.org / 100, 0);
    const lead = C.marshal(grp[0].marshal);
    const tp = lead && lead.target != null ? P[lead.target] : null;
    let best = null;
    for (const nid of P[pid].nb) {
      const q = P[nid];
      if (q.kind === 'waste' || !G.sameRealm(q.ctrl, enemy) || !G.canEnter(tag, q)) continue;
      const f = foe.get(nid) || 0;
      if (f > mine * 1.5) continue;
      let score = 100 - f / Math.max(1, mine) * 40 + (q.kind === 'capital' ? 25 : q.kind === 'city' ? 8 : 0) + G.rand(0, 5);
      if (tp) score -= G.distKm(q, tp) / 15;
      if (!best || score > best.s) best = { s: score, nid };
    }
    if (!best) continue;
    const go = grp.length > 1 && foe.get(best.nid) < mine * 0.5 ? grp.slice(0, grp.length - 1) : grp;
    for (const a of go) { a.path = [best.nid]; a.prog = 0; }
  }
};
