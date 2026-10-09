// Ekonomi: hazine (altın), il bazında atölyeler (inşaat / ticari ürün) ve silahhaneler (teçhizat),
// madenler, tarım, teçhizat deposu, kaleler ve garnizonlar
'use strict';

G.econ = {};
const EC = G.econ;

// ------------------------------------------------------------ tanımlar
G.EQUIP = {
  kilic: { name: 'Kılıç ve Mızrak', short: 'Kılıç', icon: '⚔', cost: 1 },
  yay: { name: 'Yay ve Ok', short: 'Yay', icon: '➶', cost: 1 },
  zirh: { name: 'Zırh ve Kalkan', short: 'Zırh', icon: '⛨', cost: 2 },
  at: { name: 'Savaş Atı', short: 'At', icon: '♞', cost: 3 },
};
EC.TYPES = Object.keys(G.EQUIP);

// Atölye ürünleri: insaat inşaat puanı verir, diğerleri ayda altın getirir
G.GOODS = {
  insaat: { name: 'İnşaat ustaları', icon: '⚒', gold: 0, desc: 'Günde 5 inşaat puanı.' },
  kumas: { name: 'Kumaş', icon: '🧵', gold: 1.0, res: 'kurk' },
  sarap: { name: 'Şarap', icon: '🍷', gold: 1.0, res: 'sarap' },
  cam: { name: 'Cam ve Çanak', icon: '🏺', gold: 1.0, res: 'tuz' },
  deri: { name: 'Deri ve Eyer', icon: '👢', gold: 0.9, res: 'at' },
  ipek: { name: 'İpekli', icon: '🎐', gold: 1.3, res: 'ipek' },
  baharat: { name: 'Baharat Ticareti', icon: '🌶', gold: 1.3, res: 'baharat' },
};
EC.GOOD_KEYS = Object.keys(G.GOODS);

// Doğal kaynaklar (her ilde bir tane)
G.RESOURCES = {
  tahil: { name: 'Tahıl', icon: '🌾', farm: 1.5 },
  sarap: { name: 'Üzüm bağları', icon: '🍇' },
  kereste: { name: 'Kereste', icon: '🌲' },
  kurk: { name: 'Kürk ve Yün', icon: '🐑' },
  at: { name: 'At sürüleri', icon: '🐎' },
  balik: { name: 'Balık', icon: '🐟' },
  ipek: { name: 'İpek böceği', icon: '🐛' },
  baharat: { name: 'Baharat', icon: '🌶' },
  tuz: { name: 'Tuz', icon: '🧂', mine: 1.5 },
  demir: { name: 'Demir', icon: '⛏', mine: 0 },
  gumus: { name: 'Gümüş', icon: '🥈', mine: 2.5 },
  altin: { name: 'Altın', icon: '🥇', mine: 4 },
};
EC.MINEABLE = ['tuz', 'demir', 'gumus', 'altin'];

EC.MIL_OUTPUT = 40;        // bir silahhanenin %100 verimle günlük üretim puanı
EC.CIV_POINTS = 5;         // inşaata ayrılmış bir atölyenin günlük puanı
EC.MAX_PER_PROJECT = 10;
EC.BUILD = {
  civ: { name: 'Atölye', cost: 2400, gold: 60, icon: '⚒' },
  mil: { name: 'Silahhane', cost: 2800, gold: 80, icon: '⚔' },
  fort: { name: 'Kale', cost: 1800, gold: 50, icon: '♜' },
  mine: { name: 'Maden', cost: 2000, gold: 60, icon: '⛏' },
  farm: { name: 'Çiftlik', cost: 1200, gold: 30, icon: '🌾' },
};
EC.MAX_FORT = 5;
EC.MAX_MINE = 3;
EC.MAX_FARM = 3;
EC.RECRUIT_GOLD = 50;
EC.slots = p => (p.kind === 'rural' ? 2 : 6) + (EC.isCapital(p) ? 6 : 0);

EC.isCapital = p => !!(G.S && G.S.nations[p.owner] && G.S.nations[p.owner].capital === p.id);
EC.maxGarrison = p => p.fort * 1000 + (EC.isCapital(p) && p.fort ? 500 : 0);
EC.garrisonTarget = p => Math.round(EC.maxGarrison(p) * (p.garTarget ?? 1));

// ------------------------------------------------------------ başlangıç
EC.pickResource = function (p, n) {
  const lat = G.unprojLat(p.y), r = G.rng(), g = n ? n.group : 'latin';
  if (r < 0.06) return 'demir';
  if (r < 0.085) return 'gumus';
  if (r < 0.095) return 'altin';
  if (r < 0.13) return 'tuz';
  if (p.sea && p.sea.length && G.rng() < 0.3) return 'balik';
  if (g === 'turk_bozkir' || g === 'afrika') return G.rng() < 0.6 ? 'at' : 'kurk';
  if (lat > 55) return G.rng() < 0.5 ? 'kurk' : 'kereste';
  if (g === 'cin' || g === 'dogu_asya') return G.rng() < 0.4 ? 'ipek' : 'tahil';
  if (g === 'hint' || g === 'gdasya') return G.rng() < 0.4 ? 'baharat' : 'tahil';
  if (lat < 45 && (g === 'latin' || g === 'bizans' || g === 'arap' || g === 'berberi' || g === 'iran')) return G.rng() < 0.35 ? 'sarap' : 'tahil';
  return G.rng() < 0.5 ? 'tahil' : 'kereste';
};

EC.blank = () => ({ kilic: 0, yay: 0, zirh: 0, at: 0 });

EC.init = function () {
  const S = G.S;
  for (const p of S.provinces) {
    p.civ = 0; p.mil = 0; p.fort = 0; p.garrison = 0; p.garTarget = 1;
    p.mine = 0; p.farm = 0; p.res = null;
    p.milLines = EC.blank(); p.milEff = { kilic: 0.6, yay: 0.6, zirh: 0.6, at: 0.6 };
    p.civLines = { insaat: 0 };
    if (!p.owner || p.kind === 'waste') continue;
    const n = S.nations[p.owner];
    p.res = EC.pickResource(p, n);
    if (p.kind === 'capital') {
      p.civ = n.major ? 4 : 2; p.mil = n.major ? 3 : 1; p.fort = n.major ? 4 : 3; p.farm = 1;
    } else if (p.kind === 'city') {
      p.civ = G.rng() < 0.6 ? 1 : 0;
      p.mil = G.rng() < (n.major ? 0.45 : 0.3) ? 1 : 0;
      const r = G.rng();
      p.fort = r < 0.15 ? 2 : r < 0.55 ? 1 : 0;
      if (EC.MINEABLE.includes(p.res) && G.rng() < 0.5) p.mine = 1;
    } else if (p.res === 'tahil' && G.rng() < 0.3) p.farm = 1;
    p.civLines.insaat = p.civ;
    // başkentin bir atölyesi ticaretle uğraşır
    if (p.kind === 'capital' && p.civ > 1) { p.civLines.insaat--; p.civLines[EC.localGood(p)] = 1; }
    p.garrison = EC.maxGarrison(p);
  }
  for (const n of Object.values(S.nations)) {
    n.gold = n.major ? 300 : 80;
    EC.totals(n);
  }
  for (const a of S.armies) a.gear = EC.need(a);   // başlangıçta ordular tam teçhizatlı
  for (const n of Object.values(S.nations)) {
    const need = EC.nationNeed(n.tag);
    for (const t of EC.TYPES) n.stock[t] = Math.round(need[t] * 0.25);
    EC.autoLines(n);
  }
};

// İlin kaynağına uyan ticari ürün (yoksa kumaş)
EC.localGood = p => EC.GOOD_KEYS.find(k => k !== 'insaat' && G.GOODS[k].res === p.res) || 'kumas';

// ------------------------------------------------------------ teçhizat ihtiyacı
EC.need = function (a) {
  const c = G.composition(a);
  return { kilic: c.piyade + c.suvari, yay: c.okcu, zirh: Math.round((c.piyade + c.suvari) * 0.6), at: c.suvari };
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
  const out = EC.blank();
  for (const a of G.S.armies) {
    if (a.tag !== tag) continue;
    const n = EC.need(a);
    for (const t of EC.TYPES) out[t] += n[t];
  }
  return out;
};
EC.deficit = function (tag) {
  const out = EC.blank();
  for (const a of G.S.armies) {
    if (a.tag !== tag) continue;
    const n = EC.need(a);
    for (const t of EC.TYPES) out[t] += Math.max(0, n[t] - (a.gear ? a.gear[t] : 0));
  }
  return out;
};

// ------------------------------------------------------------ il bazında hatlar
EC.milFreeIn = p => p.mil - EC.TYPES.reduce((s, t) => s + (p.milLines[t] || 0), 0);
EC.civFreeIn = p => p.civ - Object.values(p.civLines).reduce((s, v) => s + v, 0);

EC.setMil = function (p, t, delta) {
  if (delta > 0 && EC.milFreeIn(p) <= 0) {
    // boşta yoksa en kalabalık başka hattan al
    const from = EC.TYPES.filter(x => x !== t && p.milLines[x] > 0).sort((a, b) => p.milLines[b] - p.milLines[a])[0];
    if (!from) return false;
    p.milLines[from]--;
  }
  if (delta < 0 && !(p.milLines[t] > 0)) return false;
  p.milLines[t] += delta;
  if (delta > 0) p.milEff[t] = Math.min(p.milEff[t], 0.5);   // yeni hat verimsiz başlar
  return true;
};
EC.setCiv = function (p, g, delta) {
  p.civLines[g] ||= 0;
  if (delta > 0 && EC.civFreeIn(p) <= 0) {
    const from = Object.keys(p.civLines).filter(x => x !== g && p.civLines[x] > 0).sort((a, b) => p.civLines[b] - p.civLines[a])[0];
    if (!from) return false;
    p.civLines[from]--;
  }
  if (delta < 0 && !(p.civLines[g] > 0)) return false;
  p.civLines[g] += delta;
  return true;
};

// Yeni ya da boşta kalan fabrikaları dağıt
EC.fixProvince = function (p) {
  let free = EC.milFreeIn(p);
  if (free < 0) {
    for (const t of EC.TYPES) while (free < 0 && p.milLines[t] > 0) { p.milLines[t]--; free++; }
  }
  let cf = EC.civFreeIn(p);
  if (cf < 0) for (const g of Object.keys(p.civLines)) while (cf < 0 && p.civLines[g] > 0) { p.civLines[g]--; cf++; }
  if (cf > 0) p.civLines.insaat = (p.civLines.insaat || 0) + cf;
};

// Ülke başına elindeki iller (tek geçişte)
EC.index = function () {
  const out = {};
  for (const p of G.S.provinces) if (p.owner && p.owner === p.ctrl) (out[p.owner] ||= []).push(p);
  return out;
};

// ------------------------------------------------------------ toplamlar
EC.totals = function (n, provs) {
  const t = { civ: 0, mil: 0, build: 0, trade: 0, iron: 0, mines: 0, farms: 0, lines: EC.blank() };
  for (const p of provs || G.S.provinces) {
    if (p.owner !== n.tag || p.ctrl !== n.tag) continue;
    t.civ += p.civ; t.mil += p.mil;
    t.build += p.civLines.insaat || 0;
    for (const g of EC.GOOD_KEYS) if (g !== 'insaat') t.trade += (p.civLines[g] || 0) * G.GOODS[g].gold * (G.GOODS[g].res === p.res ? 1.5 : 1);
    for (const ty of EC.TYPES) t.lines[ty] += p.milLines[ty] || 0;
    if (p.res === 'demir') t.iron += p.mine;
    t.mines += p.mine; t.farms += p.farm;
  }
  n.civTotal = t.civ; n.milTotal = t.mil; n.buildCiv = t.build; n.tradeIncome = t.trade;
  n.ironBonus = Math.min(0.5, t.iron * 0.06);
  n.lineTotals = t.lines;
  n.milFree = t.mil - EC.TYPES.reduce((s, x) => s + t.lines[x], 0);
  return t;
};

// Aylık gelir ve gider dökümü
EC.budget = function (n, provs, armies) {
  const S = G.S;
  let tax = 0, trade = 0, mines = 0, farms = 0, garrison = 0;
  for (const p of provs || S.provinces) {
    if (p.owner === n.tag && p.ctrl === n.tag) {
      tax += (EC.isCapital(p) ? 3 : p.kind === 'city' ? 1 : 0.3) * G.unrestMult(p);
      for (const g of EC.GOOD_KEYS) if (g !== 'insaat') trade += (p.civLines[g] || 0) * G.GOODS[g].gold * (G.GOODS[g].res === p.res ? 1.5 : 1);
      if (p.mine && p.res && G.RESOURCES[p.res].mine) mines += p.mine * G.RESOURCES[p.res].mine;
      farms += p.farm * 0.5;
    }
    if (p.ctrl === n.tag && p.fort) garrison += p.garrison / 1000 * 0.3;
  }
  let army = 0;
  for (const a of armies || S.armies) if (a.tag === n.tag) army += a.men / 1000 * 0.2;
  tax *= (G.rulerMod ? G.rulerMod(n.tag, 'adm') : 1) * (n.taxMult ?? 1);
  trade *= n.tradeMult ?? 1; farms *= n.farmMult ?? 1; mines *= n.mineMult ?? 1;
  const income = tax + trade + mines + farms;
  const expense = army + garrison;
  return { tax, trade, mines, farms, army, garrison, income, expense, net: income - expense };
};

// Silahhaneleri ihtiyaca göre dağıt (yapay zekâ ve otomatik düğme)
EC.autoLines = function (n, owned) {
  EC.totals(n, owned);
  const def = EC.deficit(n.tag), base = EC.nationNeed(n.tag);
  const w = {};
  let sum = 0;
  for (const t of EC.TYPES) {
    w[t] = Math.max(0, (def[t] + base[t] * 0.15 - n.stock[t] * 0.5 + 1) * G.EQUIP[t].cost);
    sum += w[t];
  }
  // hedef sayılar
  const target = {};
  let left = n.milTotal;
  const order = EC.TYPES.slice().sort((a, b) => w[b] - w[a]);
  for (const t of order) { target[t] = Math.min(left, sum ? Math.floor(n.milTotal * w[t] / sum) : 0); left -= target[t]; }
  for (const t of order) { if (left <= 0) break; target[t]++; left--; }
  // illere dağıt
  const provs = (owned || G.S.provinces).filter(p => p.owner === n.tag && p.ctrl === n.tag && p.mil > 0);
  const lines = {};
  for (const p of provs) { lines[p.id] = { ...p.milLines }; for (const t of EC.TYPES) p.milLines[t] = 0; }
  const want = { ...target };
  for (const p of provs) {
    for (let k = 0; k < p.mil; k++) {
      const t = EC.TYPES.filter(x => want[x] > 0).sort((a, b) => (want[b] - want[a]) || ((lines[p.id][b] || 0) - (lines[p.id][a] || 0)))[0];
      if (!t) break;
      p.milLines[t]++; want[t]--;
      if (!(lines[p.id][t] > 0)) p.milEff[t] = Math.min(p.milEff[t], 0.5);
    }
  }
  EC.totals(n, owned);
};

// ------------------------------------------------------------ inşaat
EC.canBuild = function (tag, p, kind) {
  if (!p || p.owner !== tag || p.ctrl !== tag || p.kind === 'waste') return [false, 'Bu ilde inşaat yapamazsınız.'];
  const n = G.S.nations[tag];
  const queued = n.build.filter(b => b.prov === p.id && b.kind === kind).length;
  if (kind === 'fort') return p.fort + queued >= EC.MAX_FORT ? [false, 'Kale en üst seviyede.'] : [true, ''];
  if (kind === 'mine') {
    if (!EC.MINEABLE.includes(p.res)) return [false, 'Bu ilde işletilecek maden yok.'];
    return p.mine + queued >= EC.MAX_MINE ? [false, 'Maden en üst seviyede.'] : [true, ''];
  }
  if (kind === 'farm') return p.farm + queued >= EC.MAX_FARM ? [false, 'Çiftlikler en üst seviyede.'] : [true, ''];
  const used = p.civ + p.mil + n.build.filter(b => b.prov === p.id && (b.kind === 'civ' || b.kind === 'mil')).length;
  if (used >= EC.slots(p)) return [false, `Bu ilde yer yok (${EC.slots(p)} bina).`];
  return [true, ''];
};

EC.queue = function (tag, pid, kind) {
  const n = G.S.nations[tag], p = G.S.provinces[pid], B = EC.BUILD[kind];
  const [ok] = EC.canBuild(tag, p, kind);
  if (!ok || n.gold < B.gold) return false;
  n.gold -= B.gold;
  n.build.push({ kind, prov: pid, progress: 0, cost: B.cost });
  return true;
};

// ------------------------------------------------------------ günlük
EC.dailyNation = function (n, armies) {
  const S = G.S, P = S.provinces;
  // inşaat: yalnızca inşaata ayrılmış atölyeler çalışır
  let points = n.buildCiv * EC.CIV_POINTS * (n.buildMult ?? 1);
  for (const b of n.build.slice()) {
    const p = P[b.prov];
    if (p.owner !== n.tag) { n.build.splice(n.build.indexOf(b), 1); continue; }
    if (p.ctrl !== n.tag) continue;
    if (points <= 0) break;
    const use = Math.min(points, EC.MAX_PER_PROJECT * EC.CIV_POINTS, b.cost - b.progress);
    b.progress += use; points -= use;
    if (b.progress >= b.cost) {
      n.build.splice(n.build.indexOf(b), 1);
      if (b.kind === 'fort') p.fort = Math.min(EC.MAX_FORT, p.fort + 1);
      else p[b.kind]++;
      if (b.kind === 'civ') p.civLines.insaat = (p.civLines.insaat || 0) + 1;
      if (b.kind === 'mil') {
        const t = EC.TYPES.slice().sort((x, y) => (n.stock[x] / G.EQUIP[x].cost) - (n.stock[y] / G.EQUIP[y].cost))[0];
        p.milLines[t]++;
      }
      if (n.tag === S.player) G.log(`${p.name}: yeni ${EC.BUILD[b.kind].name.toLowerCase()} tamamlandı.`, 'good', [n.tag]);
    }
  }
  // armies sırala: en eksik olandan başla
  armies.sort((x, y) => EC.ratio(x) - EC.ratio(y));
  for (const a of armies) {
    a.gear ||= EC.blank();
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
  const totals = {};
  // tek geçiş: il üretimi, garnizon
  for (const p of S.provinces) {
    if (!p.ctrl || p.kind === 'waste') continue;
    const n = S.nations[p.ctrl];
    if (!n) continue;
    if (p.owner === p.ctrl && p.mil) {
      const bonus = (1 + (n.ironBonus || 0)) * (n.prodMult ?? 1);
      for (const t of EC.TYPES) {
        const k = p.milLines[t];
        if (!k) continue;
        n.stock[t] += k * EC.MIL_OUTPUT * p.milEff[t] * bonus / G.EQUIP[t].cost;
        p.milEff[t] = Math.min(1, p.milEff[t] + 0.02);
      }
    }
    if (p.fort && !p.siege && p.walls != null && p.walls < 100) p.walls = Math.min(100, p.walls + 2);   // surlar onarılır
    if (p.fort && !p.siege) {
      const target = EC.garrisonTarget(p);
      if (p.garrison < target) {
        const add = Math.min(target - p.garrison, EC.maxGarrison(p) * 0.08, n.manpower);
        p.garrison += add; n.manpower -= add;
      } else if (p.garrison > target) {
        n.manpower += p.garrison - target; p.garrison = target;
      }
    }
  }
  const byTag = {};
  for (const a of S.armies) (byTag[a.tag] ||= []).push(a);
  for (const n of Object.values(S.nations)) if (n.alive) EC.dailyNation(n, byTag[n.tag] || []);
  if (S.time.d % 10 === 0) EC.ai();
};

// Aylık: toplamlar, hazine
EC.monthly = function () {
  const S = G.S;
  // garnizon giderleri işgalci tarafından ödenir: kale illerini kontrol edene göre topla
  const own = EC.index(), forts = {}, byTag = {};
  for (const p of S.provinces) if (p.fort && p.ctrl && p.ctrl !== p.owner) (forts[p.ctrl] ||= []).push(p);
  for (const a of S.armies) (byTag[a.tag] ||= []).push(a);
  for (const n of Object.values(S.nations)) {
    if (!n.alive) continue;
    const provs = (own[n.tag] || []).concat(forts[n.tag] || []);
    EC.totals(n, provs);
    const b = EC.budget(n, provs, byTag[n.tag] || []);
    n.gold += b.net;
    n.lastBudget = b;
    if (n.gold < 0) {
      // borç: ordular moral kaybeder
      for (const a of G.S.armies) if (a.tag === n.tag) a.org = Math.max(20, a.org - 10);
      if (n.tag === G.S.player) G.log('Hazine boş! Askerlere ödeme yapılamıyor, ordunun morali düşüyor.', 'war', [n.tag]);
    }
  }
};

// ------------------------------------------------------------ yapay zekâ
EC.ai = function () {
  const S = G.S, P = S.provinces;
  const nbs = G.ai.neighbors();
  const own = EC.index();
  for (const n of Object.values(S.nations)) {
    if (!n.alive || n.tag === S.player) continue;
    const mine = own[n.tag] || [];
    EC.totals(n, mine);
    EC.autoLines(n, mine);
    // atölyelerin bir kısmı ticaret yapsın; hazine zorlanıyorsa daha fazlası
    const poor = n.gold < 60 || (n.lastBudget && n.lastBudget.net < 0);
    for (const p of mine) {
      if (!p.civ) continue;
      EC.fixProvince(p);
      const tradeWant = poor ? Math.ceil(p.civ * 0.6) : Math.floor(p.civ / 3);
      const trade = p.civ - (p.civLines.insaat || 0);
      if (trade < tradeWant && p.civLines.insaat > 0) EC.setCiv(p, EC.localGood(p), 1);
    }
    const maxProjects = 1 + Math.floor(n.buildCiv / 15);
    if (n.build.length >= maxProjects || n.gold < 100) continue;
    const r = G.rng();
    let kind = r < 0.25 ? 'civ' : r < 0.55 ? 'mil' : r < 0.7 ? 'fort' : r < 0.85 ? 'mine' : 'farm';
    let cand = mine;
    if (kind === 'fort') {
      cand = mine.filter(p => p.kind !== 'rural' && p.nb.some(id => P[id].owner && P[id].owner !== n.tag && (nbs[n.tag] || new Set()).has(P[id].owner)));
    } else if (kind === 'civ' || kind === 'mil') {
      cand = mine.filter(p => p.kind !== 'rural').sort((a, b) => EC.isCapital(b) - EC.isCapital(a));
    } else if (kind === 'mine') cand = mine.filter(p => EC.MINEABLE.includes(p.res));
    else cand = mine.filter(p => p.res === 'tahil').concat(mine);
    const p = cand.find(q => EC.canBuild(n.tag, q, kind)[0]);
    if (p) EC.queue(n.tag, p.id, kind);
  }
};

// ------------------------------------------------------------ kuşatma ve kale
EC.siegeNeed = p => (p.kind === 'rural' ? 30 : 70);   // kaleler ayrı işler (sim.js: stepFortSiege)
EC.fortMod = (p, defTag) => (p.ctrl === defTag || G.sameRealm(p.ctrl, defTag) ? 1 + 0.12 * (p.fort || 0) : 1);

// Ordudan garnizona asker aktar
EC.reinforceGarrison = function (p, a, men) {
  const room = EC.maxGarrison(p) - p.garrison;
  const move = Math.min(room, men, a.men - 1000);
  if (move <= 0) return 0;
  a.men -= move; p.garrison += move;
  p.garTarget = Math.max(p.garTarget ?? 1, p.garrison / EC.maxGarrison(p));
  return move;
};
