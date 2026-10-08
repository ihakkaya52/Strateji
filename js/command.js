// Ordular (komutanlar), bölükler, cepheler ve taarruz emirleri — HOI4 tarzı
'use strict';

G.command = {};
const C = G.command;

C.MAX_UNITS = 12;
C.COLORS = ['#e8c35a', '#7fc4e0', '#e07a6a', '#9ad07a', '#c49ae0', '#e0a85a', '#5ae0c0', '#e05aa8'];

C.ordu = id => G.S.ordular.find(o => o.id === id);
C.of = tag => G.S.ordular.filter(o => o.tag === tag);
C.units = o => G.S.armies.filter(a => a.ordu === o.id);

C.create = function (tag, units, name) {
  const S = G.S;
  const id = S.nextOrduId++;
  const mine = C.of(tag).length;
  const first = units[0] && units[0].prov != null ? S.provinces[units[0].prov] : null;
  const o = {
    id, tag,
    name: name || (first ? `${(first.home || first.name)} Ordusu` : `${mine + 1}. Ordu`),
    general: G.makeLeader(tag, false),
    front: null,          // karşısına konuşlanılan ülke
    attack: false,        // taarruz emri
    target: null,         // taarruz hedefi (eyalet)
    color: C.COLORS[mine % C.COLORS.length],
  };
  S.ordular.push(o);
  for (const a of units) a.ordu = id;
  return o;
};

C.disband = function (o) {
  for (const a of C.units(o)) a.ordu = null;
  G.S.ordular.splice(G.S.ordular.indexOf(o), 1);
};

// Başlangıçta bölükleri yakınlığa göre ordulara böler
C.organize = function (tag) {
  const S = G.S;
  const free = S.armies.filter(a => a.tag === tag && a.ordu == null && a.fleet == null);
  const per = 8;
  while (free.length) {
    const seed = free.shift();
    const sp = S.provinces[seed.prov];
    free.sort((x, y) => G.distKm(S.provinces[x.prov], sp) - G.distKm(S.provinces[y.prov], sp));
    const group = [seed, ...free.splice(0, per - 1)];
    C.create(tag, group);
  }
};

// Yeni eğitilen bölüğü en yakın, dolmamış orduya katar
C.assignNew = function (a) {
  const S = G.S, p = S.provinces[a.prov];
  let best = null;
  for (const o of C.of(a.tag)) {
    const us = C.units(o);
    if (us.length >= C.MAX_UNITS) continue;
    const d = us.length ? Math.min(...us.filter(u => u.prov != null).map(u => G.distKm(S.provinces[u.prov], p)), 99999) : 99999;
    if (!best || d < best.d) best = { d, o };
  }
  if (best) a.ordu = best.o.id;
  else C.create(a.tag, [a]);
};

// Komutan etkisi
C.bonus = function (a, key) {
  if (a.ordu == null || !G.S.ordular) return 0;
  const o = C.ordu(a.ordu);
  if (!o) return 0;
  const g = o.general, t = g.trait ? G.TRAITS[g.trait] : null;
  let v = 0;
  if (key === 'atk' || key === 'def') v += 0.035 * g.skill;
  if (key === 'siege') v += 0.04 * g.skill;
  if (t && t[key]) v += t[key];
  return v;
};

// ------------------------------------------------------------ cepheler
// Cephe eyaletleri: diyarımızın elindeki, düşman diyarının eline komşu eyaletler
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
  if (!S.ordular) return;
  for (const o of S.ordular.slice()) {
    const n = S.nations[o.tag];
    if (!n || !n.alive) { S.ordular.splice(S.ordular.indexOf(o), 1); continue; }
    if (!C.units(o).length && o.tag !== S.player) { S.ordular.splice(S.ordular.indexOf(o), 1); continue; }
    if (o.tag !== S.player || !o.front) continue;   // yapay zekâ kendi mantığıyla yönetir
    if (!S.nations[o.front] || !S.nations[o.front].alive) { o.front = null; o.attack = false; o.target = null; continue; }
    C.runFront(o);
  }
  // aynı düşmana taarruz eden ordular ortak saldırır
  const fronts = new Map();
  for (const o of S.ordular) {
    if (o.tag !== S.player || !o.front || !o.attack) continue;
    if (!fronts.has(o.front)) fronts.set(o.front, []);
    fronts.get(o.front).push(o);
  }
  for (const [enemy, list] of fronts) C.attackPhase(S.player, enemy, list);
};

// Cephe boyunca taarruz: aynı eyaletteki hazır bölükler birlikte en uygun komşu düşman eyaletine saldırır
C.attackPhase = function (tag, enemy, list) {
  const S = G.S, P = S.provinces;
  if (!(G.atWar(tag, enemy) || G.realm(enemy).some(t => G.atWar(tag, t)))) return;
  const frontSet = new Set(C.frontProvinces(tag, enemy));
  const ids = new Set(list.map(o => o.id));
  const groups = new Map();
  for (const a of S.armies) {
    if (a.tag !== tag || !ids.has(a.ordu) || !C.idle(a) || a.org < 50 || !frontSet.has(a.prov)) continue;
    if (!groups.has(a.prov)) groups.set(a.prov, []);
    groups.get(a.prov).push(a);
  }
  const foe = new Map();
  for (const a of S.armies) if (a.prov != null && G.atWar(tag, a.tag)) foe.set(a.prov, (foe.get(a.prov) || 0) + a.men * a.org / 100);
  for (const [pid, grp] of groups) {
    const mine = grp.reduce((s, a) => s + a.men * a.org / 100, 0);
    // grubun çoğunluğunun bağlı olduğu ordunun hedefi
    const counts = new Map();
    for (const a of grp) counts.set(a.ordu, (counts.get(a.ordu) || 0) + 1);
    const lead = C.ordu([...counts].sort((x, y) => y[1] - x[1])[0][0]);
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
    // cephe boş kalmasın: kalabalık eyalette bir bölük geride kalır
    const go = grp.length > 2 ? grp.slice(0, grp.length - 1) : grp;
    for (const a of go) { a.path = [best.nid]; a.prog = 0; }
  }
};

C.runFront = function (o) {
  const S = G.S, P = S.provinces, tag = o.tag, enemy = o.front;
  const front = C.frontProvinces(tag, enemy);
  if (!front.length) return;
  const frontSet = new Set(front);
  const units = C.units(o).filter(a => a.fleet == null);
  if (o.target != null && G.sameRealm(P[o.target].ctrl, tag)) {
    G.log(`${o.name} taarruz hedefine ulaştı: ${P[o.target].name}.`, 'good', [tag]);
    o.target = null;
  }
  // cephe eyaletlerindeki birlik sayısı
  const load = new Map(front.map(id => [id, 0]));
  for (const a of units) {
    const dest = a.path.length ? a.path[a.path.length - 1] : a.prov;
    if (load.has(dest)) load.set(dest, load.get(dest) + 1);
  }
  const tp = o.target != null ? P[o.target] : null;

  for (const a of units) {
    if (!C.idle(a)) continue;
    if (frontSet.has(a.prov)) continue;
    // savunma: cephe boyunca dağıl
    const { dist, prev } = G.distancesFrom(tag, a.prov, 3000);
    let best = null;
    for (const id of front) {
      const d = dist.get(id);
      if (d === undefined) continue;
      let score = load.get(id) * 600 + d;
      if (tp) score += G.distKm(P[id], tp) * 0.5;
      if (!best || score < best.s) best = { s: score, id };
    }
    if (!best) continue;
    const path = G.pathFromPrev(prev, a.prov, best.id);
    if (path && path.length) {
      a.path = path; a.prog = 0;
      load.set(best.id, load.get(best.id) + 1);
    }
  }
};
