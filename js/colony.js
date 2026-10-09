// Keşif ve kolonicilik: haritanın bilinmeyen topraklarına kâşif gönderilir, açılan yerlere yerleşim kurulur
'use strict';

G.explore = {};
(function () {
  const X = G.explore;
  const DAY = 24, MONTH = 24 * 30;
  X.EXPLORE_GOLD = 25;        // bir keşif seferinin bedeli
  X.COLONY_GOLD = 60;         // yerleşim kurmanın bedeli
  X.COLONY_UPKEEP = 1;        // yerleşim başına aylık altın
  X.SETTLERS = 1000;          // bu kadar yerleşimci olunca il ülkeye katılır
  X.LOST = 0.08;              // kâşifin kaybolma olasılığı

  // Keşfedilip yerleşilebilecek topraklar: bilinmeyen diyarlar ve ıssız çöl / bozkır / tundra
  const OPEN = p => p.kind === 'wild' || p.kind === 'waste';
  X.isOpen = p => OPEN(p) && !p.owner;

  X.init = function () {
    const S = G.S, P = S.provinces;
    S.expeditions ||= [];
    S.nextExpId ||= 1;
    for (const n of Object.values(S.nations)) {
      n.explorers ??= n.major ? 2 : 1;
      n.colonists ??= n.major ? 2 : 1;
      if (!(n.explored instanceof Set)) n.explored = new Set(n.explored || []);
    }
    // komşu yabani ve ıssız topraklar baştan biliniyor (eski kayıtlarda bir kez eklenir)
    if (!S.openV2) {
      S.openV2 = true;
      for (const p of P) if (p.owner && S.nations[p.owner]) for (const id of p.nb) if (OPEN(P[id])) S.nations[p.owner].explored.add(id);
    }
  };

  // Oyuncu bu ili haritada görüyor mu?
  X.known = function (p) {
    if (!OPEN(p) || p.owner) return true;
    const S = G.S;
    if (!S) return false;
    const n = S.nations[S.player];
    return !!(n && n.explored && n.explored.has(p.id));
  };

  // ------------------------------------------------------------ menzil
  const coastal = p => (p.sea && p.sea.length) || p.coast;
  X.RANGE = tag => (G.S.nations[tag].major ? 1500 : 1100);
  // Kâşifin gidebileceği il: bilinmeyen, ama bildiğimiz bir yere komşu ya da kıyıdan ulaşılabilir
  X.canExplore = function (tag, p) {
    const S = G.S, n = S.nations[tag];
    if (!OPEN(p) || p.owner) return [false, 'Burası zaten bilinen bir yer.'];
    if (n.explored.has(p.id)) return [false, 'Burası keşfedildi.'];
    if (S.expeditions.some(e => e.tag === tag && e.to === p.id)) return [false, 'Kâşifimiz zaten yolda.'];
    const busy = S.expeditions.filter(e => e.tag === tag).length;
    if (busy >= n.explorers) return [false, `Bütün kâşiflerimiz yolda (${busy} / ${n.explorers}).`];
    if (n.gold < X.EXPLORE_GOLD) return [false, `${X.EXPLORE_GOLD} altın gerekir.`];
    const r = X.route(tag, p);
    if (!r) return [false, 'Buraya ulaşamıyoruz: bildiğimiz bir yere komşu olmalı ya da kıyımızdan deniz menzilinde olmalı.'];
    return [true, `${X.EXPLORE_GOLD} altın · yaklaşık ${Math.max(1, Math.round(r.d / 18 / 30 * 10) / 10)} ay sürer${r.land ? '' : ' (deniz yoluyla)'}.`];
  };
  X.route = function (tag, p) {
    const S = G.S, P = S.provinces, n = S.nations[tag];
    let best = null;
    for (const id of p.nb) {
      const q = P[id];
      if (q.owner === tag || (OPEN(q) && n.explored.has(id))) {
        // keşfedilmiş yabani topraktan geçiliyorsa yol bizim en yakın ilimizden başlar
        const from = q.owner === tag ? q : X.nearestOwn(tag, q, false);
        if (!from) continue;
        const d = G.distKm(from, p);
        if (!best || d < best.d) best = { from: from.id, d, land: true };
      }
    }
    if (best) return best;
    if (!coastal(p)) return null;
    const q = X.nearestOwn(tag, p, true);
    if (!q) return null;
    const d = G.distKm(q, p);
    return d <= X.RANGE(tag) ? { from: q.id, d, land: false } : null;
  };
  let coastCache = null;
  X.nearestOwn = function (tag, p, coast) {
    let best = null, bd = Infinity;
    const list = coast && coastCache && coastCache.tag === tag ? coastCache.list : G.S.provinces;
    for (const q of list) {
      if (q.owner !== tag || q.ctrl !== tag || (coast && !coastal(q))) continue;
      const d = G.distKm(p, q);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  };

  X.sendExplorer = function (tag, pid) {
    const S = G.S, n = S.nations[tag], p = S.provinces[pid];
    if (!X.canExplore(tag, p)[0]) return false;
    const r = X.route(tag, p);
    n.gold -= X.EXPLORE_GOLD;
    S.expeditions.push({ id: S.nextExpId++, tag, from: r.from, to: pid, start: S.hour, arrive: S.hour + Math.max(10, Math.round(r.d / 18)) * DAY, sea: !r.land });
    return true;
  };
  X.recall = function (id) { const S = G.S; S.expeditions = S.expeditions.filter(e => e.id !== id); };

  // Kâşif ulaştı: hedef ve çevresi haritaya işlenir
  X.reveal = function (tag, pid, radius) {
    const S = G.S, P = S.provinces, n = S.nations[tag];
    const seen = new Set([pid]);
    let ring = [pid];
    for (let k = 0; k <= radius; k++) {
      const next = [];
      for (const id of ring) {
        if (OPEN(P[id])) n.explored.add(id);
        if (k < radius) for (const nb of P[id].nb) if (!seen.has(nb) && OPEN(P[nb])) { seen.add(nb); next.push(nb); }
      }
      ring = next;
    }
    if (tag === S.player) { G.labelsDirty = true; G.mapDirty = true; }
  };

  // ------------------------------------------------------------ yerleşim
  X.canColonize = function (tag, p) {
    const S = G.S, n = S.nations[tag];
    if (!OPEN(p) || p.owner) return [false, 'Burası sahipli.'];
    if (!n.explored.has(p.id)) return [false, 'Önce bu toprakları keşfetmeliyiz.'];
    if (p.colony) return [false, p.colony.tag === tag ? 'Yerleşimimiz burada büyüyor.' : `${S.nations[p.colony.tag] ? S.nations[p.colony.tag].name : 'Başka bir ülke'} burada yerleşim kuruyor.`];
    const mine = S.provinces.filter(q => q.colony && q.colony.tag === tag).length;
    if (mine >= n.colonists) return [false, `Bütün yerleşimci kafilelerimiz yolda (${mine} / ${n.colonists}).`];
    if (n.gold < X.COLONY_GOLD) return [false, `${X.COLONY_GOLD} altın gerekir.`];
    const r = X.colonyReach(tag, p);
    if (!r) return [false, 'Yerleşim ancak topraklarımıza komşu ya da kıyımızdan deniz menzilinde kurulabilir.'];
    return [true, `${X.COLONY_GOLD} altın, sonra ayda ${X.COLONY_UPKEEP} altın · ${G.fmtNum(X.SETTLERS)} yerleşimciye ulaşınca il ülkemize katılır (yaklaşık ${Math.round(X.SETTLERS / X.growth(tag, p))} ay).`];
  };
  X.colonyReach = function (tag, p) {
    const S = G.S, P = S.provinces;
    for (const id of p.nb) if (P[id].owner === tag && P[id].ctrl === tag) return { from: id, land: true };
    if (!coastal(p)) return null;
    const q = X.nearestOwn(tag, p, true);
    return q && G.distKm(q, p) <= X.RANGE(tag) ? { from: q.id, land: false } : null;
  };
  X.growth = function (tag, p) {
    const n = G.S.nations[tag];
    const t = { col: 0.5, orman: 0.7, dag: 0.6, tepe: 0.85, bataklik: 0.6, tundra: 0.4, tayga: 0.6, bozkir: 0.9 }[p.terrain] || 1;
    return 90 * t * (n.rulerSk ? 1 + 0.08 * (n.rulerSk.adm - 3) : 1);
  };
  X.colonize = function (tag, pid) {
    const S = G.S, n = S.nations[tag], p = S.provinces[pid];
    if (!X.canColonize(tag, p)[0]) return false;
    n.gold -= X.COLONY_GOLD;
    p.colony = { tag, settlers: 120, start: S.hour };
    G.mapDirty = true;
    return true;
  };
  X.abandon = function (pid) { const p = G.S.provinces[pid]; p.colony = null; G.mapDirty = true; };

  const pickRes = (p, n) => {
    const r = G.rng(), rich = ['akan', 'sona', 'mande'].includes(p.cul);
    if (rich && r < 0.35) return 'altin';
    if (r < 0.07) return 'demir';
    if (r < 0.1) return 'gumus';
    if (p.cul === 'svahili' || p.cul === 'malgas') return G.rng() < 0.5 ? 'baharat' : 'balik';
    if (coastal(p) && G.rng() < 0.25) return 'balik';
    if (p.terrain === 'col') return G.rng() < 0.4 ? 'tuz' : 'kurk';
    if (p.terrain === 'orman') return 'kereste';
    if (p.terrain === 'tundra' || p.terrain === 'tayga') return G.rng() < 0.6 ? 'kurk' : 'kereste';
    if (p.terrain === 'bozkir') return G.rng() < 0.6 ? 'at' : 'kurk';
    return G.rng() < 0.6 ? 'tahil' : 'kurk';
  };

  X.complete = function (p) {
    const S = G.S, tag = p.colony.tag, n = S.nations[tag];
    p.colony = null;
    p.owner = p.ctrl = tag;
    p.kind = 'rural';
    p.core = tag; p.lastOwner = tag; p.conquered = null; p.unrest = 0;
    p.colonized = S.hour;
    // yerli halk kalabalıksa kendi kültürünü ve dinini korur
    if ((p.natives || 0) < 1100) { p.cul = n.culture; p.relig = n.religion; }
    p.res = pickRes(p, n);
    p.natives = 0;
    X.reveal(tag, p.id, 1);
    G.labelsDirty = true; G.mapDirty = true;
    const txt = `${p.name} yerleşimi büyüdü ve ${n.name} topraklarına katıldı.`;
    G.log(txt, tag === S.player ? 'good' : 'info', [tag]);
    if (tag === S.player) G.ui.toast && G.ui.toast(`⚑ ${txt}`);
  };

  // ------------------------------------------------------------ zaman
  X.tick = function () {
    const S = G.S;
    if (!S.expeditions || !S.expeditions.length) return;
    for (const e of S.expeditions.slice()) {
      if (S.hour < e.arrive) continue;
      X.recall(e.id);
      const n = S.nations[e.tag], p = S.provinces[e.to];
      if (!n || !n.alive) continue;
      if (G.rng() < X.LOST) {
        if (e.tag === S.player) G.log(`${p.name} yönüne giden kâşifimizden bir daha haber alınamadı.`, 'war', [e.tag]);
        continue;
      }
      X.reveal(e.tag, e.to, p.terrain === 'orman' || p.terrain === 'dag' ? 1 : ['col', 'tundra', 'bozkir'].includes(p.terrain) ? 3 : 2);
      if (e.tag === S.player) {
        const C = G.cul.get(p.cul);
        G.log(`Kâşifimiz ${p.name} topraklarına ulaştı: ${C.name} halkı yaşıyor, ${G.terrainOf(p).name.toLowerCase()}. Yeni topraklar haritaya işlendi.`, 'good', [e.tag]);
        G.ui.toast && G.ui.toast(`🧭 ${p.name} keşfedildi`);
      }
    }
  };

  X.monthly = function () {
    const S = G.S, P = S.provinces;
    X.init();
    for (const p of P) {
      if (!p.colony) continue;
      const c = p.colony, n = S.nations[c.tag];
      if (!n || !n.alive || p.owner) { p.colony = null; continue; }
      n.gold -= X.COLONY_UPKEEP;
      c.settlers += X.growth(c.tag, p) * (0.8 + G.rng() * 0.4);
      // yerli baskını
      if (G.rng() < (p.natives || 0) / 22000) {
        const loss = Math.round(80 + G.rng() * 180);
        c.settlers -= loss;
        if (c.settlers <= 0) {
          p.colony = null; G.mapDirty = true;
          if (c.tag === S.player) G.ui.showEvent('Yerleşim yok edildi', `${p.name} yerlileri yerleşimimizi bastı; sağ kalanlar geri çekildi.`, [{ text: 'Yazık' }]);
          continue;
        }
        if (c.tag === S.player) G.log(`${p.name} yerlileri yerleşimimize baskın düzenledi: ${loss} yerleşimci öldü.`, 'war', [c.tag]);
        p.natives = Math.max(0, p.natives - 100);
      }
      if (c.settlers >= X.SETTLERS) X.complete(p);
    }
    // yapay zekâ: yakınındaki bilinmeyeni keşfeder, uygun yere yerleşir
    for (const n of Object.values(S.nations)) {
      if (!n.alive || n.tag === S.player || n.overlord || n.rebel || n.enemies.size) continue;
      if (n.gold > 80 && G.rng() < 0.06 && S.expeditions.filter(e => e.tag === n.tag).length < n.explorers) {
        const c = X.frontierOf(n.tag).filter(id => !n.explored.has(id));
        const pick = c.find(id => X.canExplore(n.tag, P[id])[0]);
        if (pick != null) X.sendExplorer(n.tag, pick);
      }
      if (n.gold > 160 && G.rng() < 0.035) {
        const c = [...n.explored].filter(id => OPEN(P[id]) && !P[id].owner && !P[id].colony);
        const ok = c.filter(id => X.canColonize(n.tag, P[id])[0]);
        // ıssız çöl ve tundraya isteksiz
        const good = ok.filter(id => P[id].kind === 'wild' || !['col', 'tundra'].includes(P[id].terrain));
        const pick = good.length ? G.pick(good) : ok.length && G.rng() < 0.2 ? G.pick(ok) : null;
        if (pick != null) X.colonize(n.tag, pick);
      }
    }
  };
  // Bir ülkenin topraklarına ya da keşfettiği yerlere komşu yabani iller
  X.frontierOf = function (tag) {
    const S = G.S, P = S.provinces, n = S.nations[tag], out = new Set();
    for (const p of P) {
      if (p.owner === tag || (OPEN(p) && n.explored.has(p.id))) for (const id of p.nb) if (OPEN(P[id]) && !P[id].owner) out.add(id);
    }
    return [...out];
  };

  // Keşif kipinde haritada gösterilecek hedefler (oyuncu için, günde bir hesaplanır)
  let cache = null;
  X.targets = function () {
    const S = G.S, key = S.time.y * 12 + S.time.m + '|' + S.expeditions.length + '|' + S.nations[S.player].explored.size + '|' + S.provinces.filter(p => p.colony).length + '|' + (S.nations[S.player].gold > X.COLONY_GOLD);
    if (cache && cache.key === key) return cache;
    const tag = S.player, P = S.provinces, n = S.nations[tag];
    const explore = [], colonize = [];
    coastCache = { tag, list: P.filter(q => q.owner === tag && q.ctrl === tag && coastal(q)) };
    for (const p of P) {
      if (!OPEN(p) || p.owner) continue;
      if (!n.explored.has(p.id)) { if (X.route(tag, p)) explore.push(p.id); }
      else if (!p.colony && X.colonyReach(tag, p)) colonize.push(p.id);
    }
    coastCache = null;
    cache = { key, explore, colonize };
    return cache;
  };
  X.invalidate = () => { cache = null; };
})();
