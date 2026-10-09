// Yapay zekâ: savaş ilanı, ordu yönetimi, barış, asker toplama
'use strict';

G.ai = {};

G.ai.isAI = tag => tag !== G.S.player;

// Her 12 saatte bir çalışır
G.ai.update = function (dayStart) {
  const S = G.S;
  for (const n of Object.values(S.nations)) {
    if (!n.alive || !G.ai.isAI(n.tag)) continue;
    if (n.enemies.size) G.ai.manageWar(n);
  }
  if (dayStart) G.ai.peaceTalks();
};

G.ai.idle = a => a.fleet == null && (a.transport == null || !G.navy.fleet(a.transport)) && !a.path.length && a.attacking == null &&
  !(a.besieging && G.atWar(a.tag, G.S.provinces[a.prov].ctrl));

G.ai.manageWar = function (n) {
  const S = G.S, P = S.provinces, tag = n.tag;
  const port = n.aiNaval && n.aiNaval.stage === 'gather' ? n.aiNaval.port : null;
  const idle = S.armies.filter(a => a.tag === tag && G.ai.idle(a) && a.org >= 45 && a.prov !== port);
  if (!idle.length) return;

  // hedefler
  const targets = new Map();  // pid -> öncelik
  const enemyMen = new Map();
  for (const a of S.armies) {
    if (a.prov != null && G.atWar(tag, a.tag)) enemyMen.set(a.prov, (enemyMen.get(a.prov) || 0) + a.men);
  }
  for (const p of P) {
    if (p.kind === 'waste') continue;
    if (p.owner === tag && p.ctrl !== tag) targets.set(p.id, 4);
    else if (p.ctrl === tag && enemyMen.has(p.id)) targets.set(p.id, 4.5);
    else if (G.atWar(tag, p.ctrl)) {
      let border = false;
      for (const nb of p.nb) if (P[nb].ctrl === tag) { border = true; break; }
      if (border) targets.set(p.id, 1 + (p.kind === 'capital' ? 3 : p.kind === 'city' ? 1 : 0));
    }
  }
  // komşu düşman ordularını da hedef al
  for (const [pid] of enemyMen) {
    if (!targets.has(pid) && G.canEnter(tag, P[pid])) {
      for (const nb of P[pid].nb) if (P[nb].ctrl === tag) { targets.set(pid, 2); break; }
    }
  }
  if (!targets.size) return;

  const assigned = new Map();
  for (const a of S.armies) {
    if (a.tag === tag && a.path.length && a.fleet == null) {
      const t = a.path[a.path.length - 1];
      assigned.set(t, (assigned.get(t) || 0) + 1);
    }
  }
  for (const a of idle) {
    const { dist, prev } = G.distancesFrom(tag, a.prov, 2200);
    let best = null;
    for (const [pid, prio] of targets) {
      if (pid === a.prov) continue;
      const d = dist.get(pid);
      if (d === undefined) continue;
      const foe = enemyMen.get(pid) || 0;
      if (foe > a.men * 1.6 && prio < 4) continue;
      const crowd = assigned.get(pid) || 0;
      const score = prio * 100 / (d + 150) / (1 + crowd * 0.8) * (foe ? 1 : 1.2);
      if (!best || score > best.s) best = { s: score, pid };
    }
    if (!best) continue;
    const path = G.pathFromPrev(prev, a.prov, best.pid);
    if (!path || !path.length) continue;
    a.path = path; a.prog = 0; a.besieging = false;
    assigned.set(best.pid, (assigned.get(best.pid) || 0) + 1);
  }
};

G.ai.peaceTalks = function () {
  const S = G.S;
  for (const w of (S.wars || []).slice()) {
    const a = w.a, b = w.b;
    if (!S.wars.includes(w) || !G.atWar(a, b)) continue;
    if (w.att.has(S.player) || w.def.has(S.player)) {
      // oyuncu koalisyonun lideri değilse, liderler kendi aralarında barışabilir
      if (a === S.player || b === S.player) continue;
    }
    const days = (S.hour - w.start) / 24;
    const s = G.warScore(a, b);
    if (days > 60 && Math.abs(s) >= 30 && G.rng() < 0.12) G.makePeace(a, b, true);
    else if (days > 3 * 365 && Math.abs(s) < 15 && G.rng() < 0.05) G.makePeace(a, b, false);
  }
};

// Oyuncunun barış teklifine yapay zekânın cevabı
G.ai.considerPeace = function (aiTag, playerTag, transfer) {
  const S = G.S;
  const s = G.warScore(playerTag, aiTag);
  const days = (S.hour - (S.nations[playerTag].warStart[aiTag] || 0)) / 24;
  const mine = G.nationStats(aiTag).men, theirs = G.nationStats(playerTag).men;
  if (transfer) return s >= 25 || (s >= 10 && mine < theirs * 0.5);
  return s > 0 || (days > 180 && s >= -10) || (days > 720 && s >= -25);
};

G.ai.neighbors = function () {
  const P = G.S.provinces, map = {};
  for (const p of P) {
    if (!p.owner) continue;
    for (const nb of p.nb) {
      const o = P[nb].owner;
      if (o && o !== p.owner) (map[p.owner] ||= new Set()).add(o);
    }
  }
  return map;
};

G.ai.strength = tag => G.realm(tag).reduce((sum, t) => {
  const st = G.nationStats(t);
  return sum + st.men + G.S.nations[t].manpower * 0.4;
}, 0);

G.ai.monthly = function () {
  const S = G.S;
  // asker toplama
  for (const n of Object.values(S.nations)) {
    if (!n.alive || !G.ai.isAI(n.tag)) continue;
    const st = G.nationStats(n.tag);
    const want = Math.ceil(n.armyTarget * (n.enemies.size ? 1.4 : 1));
    if (st.armies + n.queue.length < want && n.queue.length < 3 && n.gold > G.econ.RECRUIT_GOLD + 40) G.recruit(n.tag);
  }
  // savaş: önce gerekçe hazırlanır, gerekçe hazır olunca hâlâ üstünse savaş ilan edilir
  const nbs = G.ai.neighbors();
  const grace = S.time.y < 1041;
  const defPower = o => D_power(o) + G.dip.defenders(o).reduce((t, x) => t + D_power(x) * 0.7, 0) + 1;
  for (const n of Object.values(S.nations)) {
    if (!n.alive || !G.ai.isAI(n.tag) || n.overlord) continue;
    const mine = G.ai.strength(n.tag) + G.dip.allies(n.tag).reduce((t, x) => t + D_power(x) * 0.3, 0);
    // hazır gerekçe varsa
    for (const t of [...n.claims]) {
      if (n.enemies.size) break;
      const [ok] = G.dip.canDeclare(n.tag, t);
      if (!ok) continue;
      const need = G.realm(t).includes(S.player) ? 2.2 : 1.7;
      if (mine >= defPower(t) * need && G.rng() < 0.25) {
        G.dip.declare(n.tag, t);
        if (G.realm(t).includes(S.player) || G.dip.defenders(t).includes(S.player)) G.ui.warDeclaredOnPlayer(n.tag);
      } else if (G.rng() < 0.05) n.claims.delete(t);   // fırsat kaçtı
      break;
    }
    if (n.enemies.size || n.justify || n.claims.size) continue;
    const chance = n.major ? 0.015 : 0.004;
    if (G.rng() > chance) continue;
    let best = null;
    for (const o of nbs[n.tag] || []) {
      const on = S.nations[o];
      if (!on || !on.alive || (n.truces[o] || 0) > S.hour || G.sameRealm(n.tag, o) || G.dip.allied(n.tag, o)) continue;
      if (G.realm(o).includes(S.player) && grace) continue;
      // Katolik hükümdarlar Papa'ya kendiliğinden saldırmaz (yalnızca odak ağaçlarından gelen gerekçeyle)
      if (o === 'PAP' && n.religion === 'katolik') continue;
      const theirs = defPower(o);
      const need = G.realm(o).includes(S.player) ? 2.2 : 1.7;
      if (mine < theirs * need) continue;
      const rel = on.religion !== n.religion ? 1.4 : 1;
      const op = Math.max(0.3, 1 - G.dip.opinion(n.tag, o) / 150);
      const score = mine / theirs * rel * op * G.rand(0.7, 1.3);
      if (!best || score > best.s) best = { s: score, o };
    }
    if (best) {
      G.dip.startJustify(n.tag, best.o);
      if (best.o === S.player) G.ui.addLog(G.fmtDate(S.time, false), `${n.name} bize karşı savaş gerekçesi hazırlıyor!`, 'war');
    }
  }
};

function D_power(t) { return G.dip.power(t); }
