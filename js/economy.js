// Ekonomi: atölyeler (inşaat), silahhaneler (teçhizat üretimi), teçhizat deposu, kaleler ve garnizonlar
'use strict';

G.econ = {};
const EC = G.econ;

// Teçhizat türleri: cost = bir takımın üretim puanı
G.EQUIP = {
  kilic: { name: 'Kılıç ve Mızrak', short: 'Kılıç', icon: '⚔', cost: 1 },
  yay: { name: 'Yay ve Ok', short: 'Yay', icon: '➶', cost: 1 },
  zirh: { name: 'Zırh ve Kalkan', short: 'Zırh', icon: '⛨', cost: 2 },
  at: { name: 'Savaş Atı', short: 'At', icon: '♞', cost: 3 },
};
EC.TYPES = Object.keys(G.EQUIP);

EC.MIL_OUTPUT = 40;        // bir silahhanenin %100 verimle günlük üretim puanı
EC.CIV_POINTS = 5;         // bir atölyenin günlük inşaat puanı
EC.MAX_PER_PROJECT = 10;   // bir inşaata en fazla bu kadar atölye çalışır
EC.BUILD = {
  civ: { name: 'Atölye', cost: 2400, icon: '⚒' },
  mil: { name: 'Silahhane', cost: 2800, icon: '⚔' },
  fort: { name: 'Kale', cost: 1800, icon: '♜' },
};
EC.MAX_FORT = 5;
EC.slots = p => (p.kind === 'rural' ? 2 : 6) + (G.econ.isCapital(p) ? 6 : 0);

EC.isCapital = p => !!(G.S && G.S.nations[p.owner] && G.S.nations[p.owner].capital === p.id);
EC.maxGarrison = p => p.fort * 1000 + (EC.isCapital(p) && p.fort ? 500 : 0);

// ------------------------------------------------------------ başlangıç
EC.init = function () {
  const S = G.S;
  for (const p of S.provinces) {
    p.civ = 0; p.mil = 0; p.fort = 0; p.garrison = 0;
    if (!p.owner || p.kind === 'waste') continue;
    const n = S.nations[p.owner];
    if (p.kind === 'capital') {
      p.civ = n.major ? 4 : 2; p.mil = n.major ? 3 : 1; p.fort = n.major ? 4 : 3;
    } else if (p.kind === 'city') {
      p.civ = G.rng() < 0.6 ? 1 : 0;
      p.mil = G.rng() < (n.major ? 0.45 : 0.3) ? 1 : 0;
      const r = G.rng();
      p.fort = r < 0.15 ? 2 : r < 0.55 ? 1 : 0;
    }
    p.garrison = EC.maxGarrison(p);
  }
  for (const n of Object.values(S.nations)) {
    n.stock = { kilic: 0, yay: 0, zirh: 0, at: 0 };
    n.lines = {};
    for (const t of EC.TYPES) n.lines[t] = { f: 0, eff: 0.5 };
    n.build = [];
    EC.totals(n);
  }
  for (const a of S.armies) a.gear = EC.need(a);   // başlangıçta ordular tam teçhizatlı
  for (const n of Object.values(S.nations)) {
    const need = EC.nationNeed(n.tag);
    for (const t of EC.TYPES) n.stock[t] = Math.round(need[t] * 0.25);
    EC.autoLines(n);
  }
};

// ------------------------------------------------------------ teçhizat ihtiyacı
EC.need = function (a) {
  const c = G.composition(a);
  return {
    kilic: c.piyade + c.suvari,
    yay: c.okcu,
    zirh: Math.round((c.piyade + c.suvari) * 0.6),
    at: c.suvari,
  };
};
EC.ratio = function (a) {
  if (!a.gear) return 1;
  const need = EC.need(a);
  let r = 1;
  for (const t of EC.TYPES) if (need[t] > 0) r = Math.min(r, (a.gear[t] || 0) / need[t]);
  return G.clamp(r, 0, 1);
};
EC.combatFactor = a => 0.4 + 0.6 * EC.ratio(a);

EC.nationNeed = function (tag) {
  const out = { kilic: 0, yay: 0, zirh: 0, at: 0 };
  for (const a of G.S.armies) {
    if (a.tag !== tag) continue;
    const n = EC.need(a);
    for (const t of EC.TYPES) out[t] += n[t];
  }
  return out;
};
EC.deficit = function (tag) {
  const out = { kilic: 0, yay: 0, zirh: 0, at: 0 };
  for (const a of G.S.armies) {
    if (a.tag !== tag) continue;
    const n = EC.need(a);
    for (const t of EC.TYPES) out[t] += Math.max(0, n[t] - (a.gear ? a.gear[t] : 0));
  }
  return out;
};

// ------------------------------------------------------------ toplamlar
EC.totals = function (n, pre) {
  if (pre) { n.civTotal = pre.civ; n.milTotal = pre.mil; }
  else {
    let civ = 0, mil = 0;
    for (const p of G.S.provinces) {
      if (p.owner === n.tag && p.ctrl === n.tag) { civ += p.civ || 0; mil += p.mil || 0; }
    }
    n.civTotal = civ; n.milTotal = mil;
  }
  // kaybedilen silahhaneler üretim hatlarından düşer
  const mil = n.milTotal;
  let used = EC.TYPES.reduce((s, t) => s + n.lines[t].f, 0);
  while (used > mil) {
    const t = EC.TYPES.filter(x => n.lines[x].f > 0).sort((x, y) => n.lines[y].f - n.lines[x].f)[0];
    n.lines[t].f--; used--;
  }
  n.milFree = mil - used;
};

EC.setLine = function (n, t, delta) {
  const L = n.lines[t];
  if (delta > 0 && n.milFree <= 0) return;
  if (delta < 0 && L.f <= 0) return;
  L.f += delta; n.milFree -= delta;
  if (delta > 0) L.eff = Math.min(L.eff, 0.6);   // yeni hat verimsiz başlar
};

// Silahhaneleri ihtiyaca göre dağıt (yapay zekâ ve başlangıç)
EC.autoLines = function (n) {
  EC.totals(n);
  const def = EC.deficit(n.tag), base = EC.nationNeed(n.tag);
  const w = {};
  let sum = 0;
  for (const t of EC.TYPES) {
    w[t] = (def[t] + base[t] * 0.15 - n.stock[t] * 0.5 + 1) * G.EQUIP[t].cost;
    if (w[t] < 0) w[t] = 0;
    sum += w[t];
  }
  for (const t of EC.TYPES) { const old = n.lines[t].f; n.lines[t].f = 0; n.lines[t].eff = old ? n.lines[t].eff : 0.5; }
  let left = n.milTotal;
  const order = EC.TYPES.slice().sort((a, b) => w[b] - w[a]);
  for (const t of order) {
    const k = sum ? Math.floor(n.milTotal * w[t] / sum) : 0;
    n.lines[t].f = Math.min(k, left); left -= n.lines[t].f;
  }
  for (const t of order) { if (left <= 0) break; n.lines[t].f++; left--; }
  n.milFree = 0;
};

// ------------------------------------------------------------ inşaat
EC.canBuild = function (tag, p, kind) {
  if (!p || p.owner !== tag || p.ctrl !== tag || p.kind === 'waste') return [false, 'Bu ilde inşaat yapamazsınız.'];
  const n = G.S.nations[tag];
  const queued = n.build.filter(b => b.prov === p.id && b.kind === kind).length;
  if (kind === 'fort') {
    if (p.fort + queued >= EC.MAX_FORT) return [false, 'Kale en üst seviyede.'];
    return [true, ''];
  }
  const used = p.civ + p.mil + n.build.filter(b => b.prov === p.id && b.kind !== 'fort').length;
  if (used >= EC.slots(p)) return [false, `Bu ilde yer yok (${EC.slots(p)} bina).`];
  return [true, ''];
};

EC.queue = function (tag, pid, kind) {
  const n = G.S.nations[tag], p = G.S.provinces[pid];
  const [ok] = EC.canBuild(tag, p, kind);
  if (!ok) return false;
  n.build.push({ kind, prov: pid, progress: 0, cost: EC.BUILD[kind].cost });
  return true;
};

EC.dailyNation = function (n, pre, armies) {
  const S = G.S, P = S.provinces;
  EC.totals(n, pre);
  // inşaat
  let points = n.civTotal * EC.CIV_POINTS;
  for (const b of n.build.slice()) {
    const p = P[b.prov];
    if (p.owner !== n.tag) { n.build.splice(n.build.indexOf(b), 1); continue; }
    if (p.ctrl !== n.tag) continue;          // işgal altında: durur
    if (points <= 0) break;
    const use = Math.min(points, EC.MAX_PER_PROJECT * EC.CIV_POINTS, b.cost - b.progress);
    b.progress += use; points -= use;
    if (b.progress >= b.cost) {
      n.build.splice(n.build.indexOf(b), 1);
      if (b.kind === 'fort') p.fort = Math.min(EC.MAX_FORT, p.fort + 1);
      else p[b.kind]++;
      if (n.tag === S.player) G.log(`${p.name}: yeni ${EC.BUILD[b.kind].name.toLowerCase()} tamamlandı.`, 'good', [n.tag]);
    }
  }
  // üretim
  for (const t of EC.TYPES) {
    const L = n.lines[t];
    if (!L.f) continue;
    n.stock[t] += L.f * EC.MIL_OUTPUT * L.eff / G.EQUIP[t].cost;
    L.eff = Math.min(1, L.eff + 0.02);
  }
  // orduları donat: en eksik olandan başla
  armies.sort((x, y) => EC.ratio(x) - EC.ratio(y));
  for (const a of armies) {
    a.gear ||= { kilic: 0, yay: 0, zirh: 0, at: 0 };
    const need = EC.need(a);
    for (const t of EC.TYPES) {
      if (a.gear[t] > need[t]) a.gear[t] = need[t];   // ölen askerlerin teçhizatı kaybolur
      const give = Math.min(need[t] - a.gear[t], n.stock[t]);
      if (give > 0) { a.gear[t] += give; n.stock[t] -= give; }
    }
  }
};

EC.daily = function () {
  const S = G.S;
  // tek geçişte: fabrika toplamları ve garnizon takviyesi
  const pre = {};
  for (const p of S.provinces) {
    if (!p.ctrl) continue;
    if (p.owner === p.ctrl && (p.civ || p.mil)) {
      const t = (pre[p.ctrl] ||= { civ: 0, mil: 0 });
      t.civ += p.civ; t.mil += p.mil;
    }
    if (p.fort && !p.siege) {
      const max = EC.maxGarrison(p), n = S.nations[p.ctrl];
      if (n && p.garrison < max) {
        const add = Math.min(max - p.garrison, max * 0.08, n.manpower);
        p.garrison += add; n.manpower -= add;
      }
    }
  }
  const byTag = {};
  for (const a of S.armies) (byTag[a.tag] ||= []).push(a);
  for (const n of Object.values(S.nations)) {
    if (n.alive) EC.dailyNation(n, pre[n.tag] || { civ: 0, mil: 0 }, byTag[n.tag] || []);
  }
  if (S.time.d % 10 === 0) EC.ai();
};

// ------------------------------------------------------------ yapay zekâ
EC.ai = function () {
  const S = G.S, P = S.provinces;
  const nbs = G.ai.neighbors();
  for (const n of Object.values(S.nations)) {
    if (!n.alive || n.tag === S.player) continue;
    EC.autoLines(n);
    const maxProjects = 1 + Math.floor(n.civTotal / 20);
    if (n.build.length >= maxProjects) continue;
    const mine = P.filter(p => p.owner === n.tag && p.ctrl === n.tag && p.kind !== 'waste');
    const r = G.rng();
    let kind = n.civTotal < 30 && r < 0.45 ? 'civ' : r < 0.8 ? 'mil' : 'fort';
    let cand;
    if (kind === 'fort') {
      // sınırdaki şehirler
      cand = mine.filter(p => p.kind !== 'rural' && p.nb.some(id => P[id].owner && P[id].owner !== n.tag && (nbs[n.tag] || new Set()).has(P[id].owner)));
      if (!cand.length) { kind = 'civ'; }
    }
    if (kind !== 'fort') cand = mine.filter(p => p.kind !== 'rural').sort((a, b) => (EC.isCapital(b) - EC.isCapital(a)));
    const p = (cand || []).find(q => EC.canBuild(n.tag, q, kind)[0]);
    if (p) EC.queue(n.tag, p.id, kind);
  }
};

// ------------------------------------------------------------ kuşatma ve kale
EC.siegeNeed = p => (p.kind === 'rural' ? 30 : 70) + p.fort * 110;
EC.fortMod = (p, defTag) => (p.ctrl === defTag || G.sameRealm(p.ctrl, defTag) ? 1 + 0.12 * (p.fort || 0) : 1);
