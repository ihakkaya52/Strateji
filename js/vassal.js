// Vasallık: Kutsal Roma'nın düklükleri, vasal sadakati, haraç, ayrıcalık, ilhak, vasal kurma ve prens birlikleri.
'use strict';

G.vassal = {};
(function () {
  const V = G.vassal;
  const YEAR = 24 * 365;

  // ------------------------------------------------------------ senaryo: 1040'ta Kutsal Roma'nın düklükleri
  // İmparatorun doğrudan elinde Frankonya, Ren kıyısındaki taç toprakları ve Lombardiya kalır; gerisi vasal dükler.
  V.DUCHIES = {
    SAX: { name: 'Saksonya Dükalığı', color: '#a88e3a', ruler: 'II. Bernhard', kind: 'dukalik', cap: 'Magdeburg',
      provs: ['Magdeburg', 'Hamburg', 'Bremen', 'Holstein', 'Münster', 'Paderborn', 'Merseburg', 'Meissen', 'Bautzen'] },
    BAV: { name: 'Bavyera Dükalığı', color: '#7f9cc0', ruler: 'VII. Heinrich', kind: 'dukalik', cap: 'Regensburg',
      provs: ['Regensburg', 'Passau', 'Salzburg', 'Melk'] },
    SWA: { name: 'Svabya Dükalığı', color: '#c49a6c', ruler: 'II. Otto', kind: 'dukalik', cap: 'Augsburg',
      provs: ['Augsburg', 'Konstanz', 'Zürih', 'Basel', 'Strazburg'] },
    CAR: { name: 'Karintiya Dükalığı', color: '#8c7448', ruler: 'Adalbero', kind: 'dukalik', cap: 'Karintiya',
      provs: ['Karintiya', 'Krayna', 'Steiermark', 'İstriya', 'Aquileia', 'Verona', 'Padova', 'Trento'] },
    ULO: { name: 'Yukarı Lotaringiya', color: '#b3ac62', ruler: 'Sakallı Godfrey', kind: 'dukalik', cap: 'Metz',
      provs: ['Metz', 'Trier', 'Verdun', 'Toul'] },
    DLO: { name: 'Aşağı Lotaringiya', color: '#98974e', ruler: 'I. Gothelo', kind: 'dukalik', cap: 'Leuven',
      provs: ['Leuven', 'Liège', 'Utrecht', 'Groningen', 'Cambrai'] },
    KOL: { name: 'Köln Başpiskoposluğu', color: '#d9cfae', ruler: 'II. Hermann', kind: 'kilise', cap: 'Köln',
      provs: ['Köln'] },
    BOH: { name: 'Bohemya Dükalığı', color: '#b25a48', ruler: 'I. Břetislav', kind: 'dukalik', cap: 'Prag',
      provs: ['Prag', 'Olomouc', 'Brno', 'Pilsen', 'Wrocław', 'Opole', 'Glogau'] },
    BUR: { name: 'Burgonya Kontluğu', color: '#9a6a88', ruler: 'I. Rainald', kind: 'dukalik', cap: 'Besançon',
      provs: ['Besançon', 'Lyon', 'Vienne', 'Cenevre', 'Arles', 'Marsilya', 'Grenoble', 'Nice'] },
    TUS: { name: 'Toskana Markgraflığı', color: '#7c9e6c', ruler: 'Canossalı Bonifacio', kind: 'dukalik', cap: 'Canossa',
      provs: ['Canossa', 'Floransa', 'Siena', 'Parma', 'Bologna'] },
  };
  V.KIND_NAMES = { dukalik: 'Düklük', kilise: 'Kilise beyliği', krallik: 'Haraçgüzar krallık', vasal: 'Vasal' };
  // Tarihî dük hanedanları (ölüm yılları yaklaşık)
  Object.assign(G.dyn.HIST, {
    SAX: { born: 995, dies: 1059, dyn: 'Billung', next: ['Ordulf', 'Magnus', 'Supplinburglu Lothar'] },
    BAV: { born: 1005, dies: 1047, dyn: 'Lüksemburg', next: ['I. Konrad', 'Nordheimli Otto', 'I. Welf', 'II. Welf', 'Kara Heinrich'] },
    SWA: { born: 1015, dies: 1047, dyn: 'Ezzonen', next: ['III. Otto', 'Rheinfeldenli Rudolf', 'I. Friedrich', 'II. Friedrich'] },
    BOH: { born: 1002, dies: 1055, dyn: 'Přemysl', next: ['II. Spytihněv', 'II. Vratislav', 'II. Břetislav', 'Bořivoj', 'Svatopluk', 'I. Vladislav'] },
    TUS: { born: 985, dies: 1052, dyn: 'Canossa', next: ['Canossalı Matilda'] },
    ULO: { born: 997, dies: 1069, dyn: 'Ardenne-Verdun', next: ['Kambur Godfrey', 'Bouillonlu Godfrey'] },
  });

  // Haritaya uygula (oyun başlamadan önce, dünya verisi üzerinde)
  V.setupScenario = function () {
    const W = window.WORLD;
    if (!W || W.__duchies || !W.nations.HRE) return;
    W.__duchies = true;
    W.vassals ||= {};
    for (const [tag, d] of Object.entries(V.DUCHIES)) {
      let cap = null;
      for (const p of W.provinces) {
        if (p.owner !== 'HRE' || !(d.provs.includes(p.name) || d.provs.includes(p.home))) continue;
        p.cul ??= G.cul.provinceCulture(p);   // halk, il imparatorluktan ayrılmadan önce belirlenir
        p.owner = tag;
        if (p.name === d.cap) cap = p.id;
      }
      if (cap == null) continue;
      W.nations[tag] = { name: d.name, color: d.color, major: false, ruler: d.ruler, religion: 'katolik', group: 'latin', capital: cap, vkind: d.kind };
      W.vassals[tag] = 'HRE';
    }
  };
  V.setupScenario();

  // ------------------------------------------------------------ haraç seviyeleri
  V.TRIB = {
    hafif: { name: 'Hafif', mp: 0.10, gold: 0.05, loy: 12 },
    orta: { name: 'Orta', mp: 0.25, gold: 0.12, loy: 0 },
    agir: { name: 'Ağır', mp: 0.40, gold: 0.25, loy: -18 },
  };
  V.MAX_PRIV = 3;
  V.GIFT_GOLD = 60;
  const own = t => { const n = G.S.nations[t]; return n ? G.nationStats(t).men + n.manpower * 0.3 + 1 : 1; };
  V.list = lord => Object.values(G.S.nations).filter(n => n.alive && n.overlord === lord);
  V.kind = n => n.vkind || 'vasal';

  // Sadakat etkenleri: [açıklama, değer]
  V.factors = function (tag) {
    const S = G.S, n = S.nations[tag], L = S.nations[n.overlord];
    if (!L) return [];
    const f = [['Temel', 50]];
    const fam = G.rel.sameFamily(n.religion, L.religion);
    if (n.religion === L.religion) f.push(['Aynı din ve mezhep', 10]);
    else if (fam) f.push(['Aynı din, başka mezhep', 0]);
    else f.push(['Başka dinden efendi', -25]);
    const nc = n.culture && G.cul.get(n.culture), lc = L.culture && G.cul.get(L.culture);
    if (nc && lc) {
      if (n.culture === L.culture) f.push(['Aynı halk', 12]);
      else if (nc.group === lc.group) f.push(['Aynı kültür grubu', 6]);
      else f.push(['Yabancı halk', -10]);
    }
    const r = own(n.overlord) / own(tag);
    f.push(r > 5 ? ['Efendi çok güçlü', 15] : r > 2 ? ['Efendi güçlü', 6] : r > 1 ? ['Güçler denk', -4] : ['Efendi bizden zayıf', -20]);
    const t = V.TRIB[n.tribLevel || 'orta'];
    if (t.loy) f.push([`${t.name} haraç`, t.loy]);
    if (n.privileges) f.push([`Ayrıcalıklar (${n.privileges})`, n.privileges * 7]);
    if (n.marriages && n.marriages.has(n.overlord)) f.push(['Hanedan evliliği', 10]);
    if ((L.stability ?? 60) < 30) f.push(['Efendinin ülkesi karışık', -10]);
    if (L.regency > S.hour) f.push(['Çocuk hükümdar, naiplik', -10]);
    if (L.excommunicated && S.hour - L.excommunicated < 5 * YEAR && n.religion === 'katolik') f.push(['Efendi aforozlu', V.kind(n) === 'kilise' ? -35 : -25]);
    if (V.kind(n) === 'kilise') f.push(['Kilise beyliği: hanedan hırsı yok', 8]);
    const op = G.dip.opinion(tag, n.overlord);
    if (Math.abs(op) >= 20) f.push(['İlişkiler', Math.round(G.clamp(op / 10, -10, 10))]);
    if (n.loyMod && n.loyMod.until > S.hour) f.push([n.loyMod.label, n.loyMod.v]);
    return f;
  };
  V.target = tag => G.clamp(V.factors(tag).reduce((s, x) => s + x[1], 0), 0, 100);
  // geçici etki (olaylar, odaklar)
  V.mod = function (tag, v, label, years = 5) {
    const n = G.S.nations[tag];
    if (!n || !n.alive) return;
    n.loyalty = G.clamp((n.loyalty ?? 60) + v, 0, 100);
    if (label) n.loyMod = { v: Math.round(v / 2), label, until: G.S.hour + years * YEAR };
  };

  // ------------------------------------------------------------ aylık
  V.monthly = function () {
    const S = G.S;
    for (const n of Object.values(S.nations)) {
      if (!n.alive || !n.overlord) continue;
      const L = S.nations[n.overlord];
      if (!L || !L.alive) continue;
      n.loyalty ??= 65;
      n.tribLevel ||= 'orta';
      n.vassalSince ??= S.hour;
      const tgt = V.target(n.tag);
      n.loyalty += G.clamp(tgt - n.loyalty, -1.5, 1.5);
      const t = V.TRIB[n.tribLevel], priv = 1 - 0.15 * (n.privileges || 0), late = n.loyalty < 30 ? 0.5 : 1;
      n.tribute = t.mp * priv * late;
      // altın haracı: vasalın aylık gelirinden pay
      const inc = n.lastBudget ? n.lastBudget.income : 0;
      const g = Math.max(0, Math.min(n.gold, inc * t.gold * priv * late));
      if (g > 0) { n.gold -= g; L.gold += g; n.paidGold = g; } else n.paidGold = 0;
      // sadakatsiz yapay zekâ vasalı ayaklanır
      if (n.tag !== S.player && n.loyalty < 20 && !n.enemies.size && G.rng() < 0.03 && own(n.tag) > own(n.overlord) * 0.15) V.rebel(n.tag);
    }
    V.ai();
  };

  // Yapay zekâ efendiler vasallarını yönetir
  V.ai = function () {
    const S = G.S;
    for (const n of Object.values(S.nations)) {
      if (!n.alive || !n.overlord || n.overlord === S.player) continue;
      const L = S.nations[n.overlord];
      if (!L || !L.alive) continue;
      if (n.loyalty < 40 && n.tribLevel !== 'hafif') { n.tribLevel = n.tribLevel === 'agir' ? 'orta' : 'hafif'; continue; }
      if (n.loyalty < 45 && L.gold > 250 && G.rng() < 0.2) { V.gift(L.tag, n.tag); continue; }
      if (n.loyalty < 30 && (n.privileges || 0) < V.MAX_PRIV && G.rng() < 0.1) { V.privilege(L.tag, n.tag); continue; }
      if (n.loyalty > 80 && n.tribLevel !== 'agir' && G.rng() < 0.05) n.tribLevel = n.tribLevel === 'hafif' ? 'orta' : 'agir';
    }
  };

  // ------------------------------------------------------------ efendinin araçları
  V.canGift = function (lord, tag) {
    const n = G.S.nations[tag], L = G.S.nations[lord];
    if (n.overlord !== lord) return [false, 'Vasalımız değil.'];
    if (n.lastGift && G.S.hour - n.lastGift < YEAR) return [false, 'Bu yıl zaten hediye gönderdik.'];
    if (L.gold < V.GIFT_GOLD) return [false, `${V.GIFT_GOLD} altın gerekir.`];
    return [true, `${V.GIFT_GOLD} altın: sadakat +12`];
  };
  V.gift = function (lord, tag) {
    if (!V.canGift(lord, tag)[0]) return false;
    const n = G.S.nations[tag], L = G.S.nations[lord];
    L.gold -= V.GIFT_GOLD; n.gold += V.GIFT_GOLD; n.lastGift = G.S.hour;
    n.loyalty = Math.min(100, (n.loyalty ?? 60) + 12);
    G.dip.add(lord, tag, 10);
    return true;
  };
  V.canPrivilege = function (lord, tag) {
    const n = G.S.nations[tag];
    if (n.overlord !== lord) return [false, 'Vasalımız değil.'];
    if ((n.privileges || 0) >= V.MAX_PRIV) return [false, `En fazla ${V.MAX_PRIV} ayrıcalık verilebilir.`];
    if (n.lastPriv && G.S.hour - n.lastPriv < 2 * YEAR) return [false, 'İki yılda bir ayrıcalık verilebilir.'];
    return [true, 'Sadakat kalıcı olarak +7, ama haraç kalıcı olarak %15 azalır'];
  };
  V.privilege = function (lord, tag) {
    if (!V.canPrivilege(lord, tag)[0]) return false;
    const n = G.S.nations[tag];
    n.privileges = (n.privileges || 0) + 1; n.lastPriv = G.S.hour;
    n.loyalty = Math.min(100, (n.loyalty ?? 60) + 10);
    return true;
  };
  V.setTribute = function (lord, tag, level) {
    const n = G.S.nations[tag];
    if (n.overlord !== lord || !V.TRIB[level]) return false;
    n.tribLevel = level;
    return true;
  };
  V.annexCost = tag => 60 + G.S.provinces.filter(p => p.owner === tag).length * 25;
  V.canAnnex = function (lord, tag) {
    const S = G.S, n = S.nations[tag], L = S.nations[lord];
    if (n.overlord !== lord) return [false, 'Vasalımız değil.'];
    if (L.enemies.size) return [false, 'Savaş sırasında tımar geri alınamaz.'];
    if (V.list(tag).length) return [false, 'Kendi vasalları olan bir vasal ilhak edilemez.'];
    if ((n.loyalty ?? 60) < 50) return [false, 'Sadakati en az 50 olmalı; yoksa ayaklanır.'];
    if (n.vassalSince != null && S.hour - n.vassalSince < 10 * YEAR) return [false, `Vasallığının üzerinden 10 yıl geçmeli (${Math.ceil((n.vassalSince + 10 * YEAR - S.hour) / YEAR)} yıl kaldı).`];
    const c = V.annexCost(tag);
    if (L.gold < c) return [false, `${c} altın gerekir.`];
    return [true, `${c} altın. Bütün toprakları bize geçer; diğer vasalların sadakati −15.`];
  };
  V.annex = function (lord, tag) {
    if (!V.canAnnex(lord, tag)[0]) return false;
    const S = G.S, n = S.nations[tag], L = S.nations[lord];
    L.gold -= V.annexCost(tag);
    for (const a of S.armies.slice()) if (a.tag === tag) { L.manpower += a.men; G.removeArmy(a); }
    for (const p of S.provinces) if (p.owner === tag) { G.transferProvince(p.id, lord); p.core = lord; }
    for (const o of V.list(lord)) V.mod(o.tag, -15, `${n.name} ilhak edildi`, 5);
    G.log(`${L.name}, ${n.name} tımarını geri aldı: topraklar doğrudan tacın oldu.`, 'good', [lord, tag]);
    G.checkElimination();
    G.labelsDirty = true; G.mapDirty = true;
    return true;
  };
  V.free = function (lord, tag) {
    const n = G.S.nations[tag];
    if (n.overlord !== lord) return false;
    n.overlord = null; n.tribute = 0.25;
    G.dip.add(lord, tag, 50);
    G.log(`${G.S.nations[lord].name}, ${n.name}'ı vasallıktan azat etti.`, 'good', [lord, tag]);
    G.labelsDirty = true; G.mapDirty = true;
    return true;
  };
  // Vasala il vermek
  V.canGrant = function (lord, tag, pid) {
    const S = G.S, p = S.provinces[pid], n = S.nations[tag];
    if (!n || n.overlord !== lord) return [false, 'Vasalımız değil.'];
    if (p.owner !== lord || p.ctrl !== lord) return [false, 'İl elimizde olmalı.'];
    if (G.econ.isCapital(p)) return [false, 'Başkent verilemez.'];
    if (!p.nb.some(id => S.provinces[id].owner === tag)) return [false, 'Vasalın topraklarına komşu olmalı.'];
    return [true, 'İl vasala geçer, sadakati +10'];
  };
  V.grant = function (lord, tag, pid) {
    if (!V.canGrant(lord, tag, pid)[0]) return false;
    const p = G.S.provinces[pid];
    G.transferProvince(pid, tag); p.core = tag;
    V.mod(tag, 10);
    G.evacuateArmies();
    return true;
  };

  // ------------------------------------------------------------ yeni vasal kurmak
  let vNo = 0;
  const suffix = relig => {
    const f = G.rel.family(relig);
    return f === 'islam' ? 'Emirliği' : relig === 'ortodoks' ? 'Despotluğu' : f === 'hristiyan' ? 'Dükalığı' : 'Beyliği';
  };
  const majority = (list, key) => {
    const c = {};
    for (const p of list) if (p[key]) c[p[key]] = (c[p[key]] || 0) + G.provinceWeight(p);
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null;
  };
  const shade = (hex, k) => {
    const v = parseInt(hex.slice(1), 16);
    const ch = s => G.clamp(Math.round(((v >> s) & 255) * k), 0, 255);
    return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('');
  };
  // Bir il listesinden hangi ülke kurulur: tarihî düklük, ölmüş asıl sahip ya da yeni bir vasal
  V.identity = function (lord, provs) {
    const S = G.S;
    for (const [tag, d] of Object.entries(V.DUCHIES)) {
      if (S.nations[tag] && S.nations[tag].alive) continue;
      if (provs.some(p => d.provs.includes(p.name) || d.provs.includes(p.home))) return { tag, name: d.name, color: d.color, ruler: d.ruler, vkind: d.kind };
    }
    const core = majority(provs.filter(p => p.core && p.core !== lord), 'core');
    if (core && !(S.nations[core] && S.nations[core].alive)) {
      const def = window.WORLD.nations[core] || S.nations[core];
      if (def) return { tag: core, name: def.name, color: def.color, ruler: null, vkind: 'vasal' };
    }
    const capP = provs.slice().sort((a, b) => G.provinceWeight(b) - G.provinceWeight(a))[0];
    const relig = majority(provs, 'relig') || S.nations[lord].religion;
    return { tag: null, name: `${capP.home || capP.name} ${suffix(relig)}`, color: shade(S.nations[lord].color, 0.7 + G.rng() * 0.25), ruler: null, vkind: 'dukalik' };
  };
  V.create = function (lord, pids, opts = {}) {
    const S = G.S, L = S.nations[lord];
    const provs = pids.map(id => S.provinces[id]).filter(p => p && p.owner && !(p.owner === lord && G.econ.isCapital(p)));
    if (!provs.length) return null;
    const id = V.identity(lord, provs);
    const tag = id.tag || ('V' + (++vNo) + '_' + S.hour);
    const relig = majority(provs, 'relig') || L.religion;
    const cul = majority(provs, 'cul') || L.culture;
    const old = S.nations[tag];
    const n = G.addNation(tag, { name: id.name, color: id.color, major: false, ruler: id.ruler || G.nameFor(lord), religion: relig, group: (old && old.group) || L.group });
    n.vkind = id.vkind;
    const capP = provs.slice().sort((a, b) => G.provinceWeight(b) - G.provinceWeight(a))[0];
    for (const p of provs) { G.transferProvince(p.id, tag); p.core = tag; p.unrest = Math.min(p.unrest || 0, 20); p.conquered = null; }
    n.capital = capP.id;
    n.culture = cul; n.cultPolicy = 'ilimli'; n.assimilators = 1; n.assims = [];
    n.overlord = lord; n.tribute = 0.25; n.tribLevel = 'orta';
    n.loyalty = opts.loyalty ?? 75; n.vassalSince = S.hour;
    n.stability = 55; n.gold = 50 + provs.length * 10;
    n.manpower = 3000 + provs.length * 1500;
    n.armyTarget = Math.max(1, Math.round(provs.length / 3));
    G.tech.init();
    // küçük bir ordu
    const a = G.createArmy(tag, capP.id, Math.min(12000, 3000 + provs.length * 1200));
    a.gear = G.econ.need(a);
    G.command.organize(tag);
    G.dip.add(lord, tag, 60);
    G.evacuateArmies();
    G.labelsDirty = true; G.mapDirty = true;
    if (!opts.quiet) G.log(`${n.name} kuruldu ve ${L.name} tacının vasalı oldu.`, 'good', [lord, tag]);
    return n;
  };
  // Kendi topraklarımızdan kurulabilecek vasallar
  V.candidates = function (lord) {
    const S = G.S, L = S.nations[lord], out = [];
    const mine = S.provinces.filter(p => p.owner === lord && p.ctrl === lord && !G.econ.isCapital(p));
    const used = new Set();
    for (const [tag, d] of Object.entries(V.DUCHIES)) {
      if (S.nations[tag] && S.nations[tag].alive) continue;
      const ps = mine.filter(p => d.provs.includes(p.name) || d.provs.includes(p.home));
      if (ps.length) { out.push({ key: 'd:' + tag, name: d.name, why: 'Tarihî düklük', provs: ps }); ps.forEach(p => used.add(p.id)); }
    }
    const byCore = {};
    for (const p of mine) if (!used.has(p.id) && p.core && p.core !== lord && !(S.nations[p.core] && S.nations[p.core].alive)) (byCore[p.core] ||= []).push(p);
    for (const [core, ps] of Object.entries(byCore)) {
      const def = window.WORLD.nations[core] || S.nations[core];
      if (!def) continue;
      out.push({ key: 'c:' + core, name: def.name, why: 'Eski sahiplerinin yeniden kurulması', provs: ps });
      ps.forEach(p => used.add(p.id));
    }
    const byCul = {};
    for (const p of mine) if (!used.has(p.id) && p.cul && !G.cul.accepted(lord, p.cul)) (byCul[p.cul] ||= []).push(p);
    for (const [cul, ps] of Object.entries(byCul)) {
      if (ps.length < 2) continue;
      out.push({ key: 'k:' + cul, name: `${G.cul.get(cul).name} ${suffix(majority(ps, 'relig') || L.religion)}`, why: 'Yabancı halkın toprakları', provs: ps });
    }
    return out;
  };

  // ------------------------------------------------------------ prens birlikleri ve ayaklanma
  V.rebel = function (tag, opts = {}) {
    const S = G.S, n = S.nations[tag], lord = n && n.overlord;
    if (!lord || !n.alive) return;
    G.declareIndependence(tag);
    const war = G.findWar(tag, lord);
    const joined = [];
    if (war) {
      for (const o of V.list(lord)) {
        if (o.tag === S.player || o.tag === tag || (o.loyalty ?? 60) >= (opts.threshold ?? 35)) continue;
        o.overlord = null; o.rebelFrom = lord;
        // savunan taraftan saldıran tarafa geçer
        for (const x of war.att) { o.enemies.delete(x); if (S.nations[x]) S.nations[x].enemies.delete(o.tag); }
        war.att.add(o.tag); war.def.delete(o.tag);
        for (const y of war.def) {
          const ny = S.nations[y];
          if (!ny || !ny.alive) continue;
          o.enemies.add(y); ny.enemies.add(o.tag);
          o.warStart[y] = ny.warStart[o.tag] = S.hour;
        }
        joined.push(o);
      }
    }
    const L = S.nations[lord];
    const title = opts.title || (joined.length ? 'Prensler Birliği' : 'Vasal Ayaklanması');
    const msg = `${n.name}${joined.length ? ' ve ' + joined.map(o => o.name).join(', ') : ''} ${L.name} tacına başkaldırdı!`;
    G.log(`${title}: ${msg}`, 'war', [tag, lord, ...joined.map(o => o.tag)]);
    if (lord === S.player) G.ui.showEvent(title, `${opts.text ? opts.text + ' ' : ''}${msg} Sadakatsiz vasallar haraç ödemeyi bıraktı ve ordularını bize karşı topluyor. ` +
      'Onları yenersek yeniden vasalımız olurlar; yenilirsek bağımsızlıklarını kazanırlar.', [{ text: 'Asiler cezalandırılacak!' }]);
    G.labelsDirty = true; G.mapDirty = true;
  };
  // Birliğe katılan asiler de ana asinin kaderini paylaşır
  const basePeace = G.makePeace;
  G.makePeace = function (a, b, transfer, msg) {
    const S = G.S;
    const lords = [a, b];
    const pending = Object.values(S.nations).filter(n => n.alive && n.rebelFrom && lords.includes(n.rebelFrom) && (n.tag === a || n.tag === b || n.enemies.has(n.rebelFrom)));
    const main = pending.find(n => n.tag === a || n.tag === b);
    // efendi asiyi yendiyse asinin toprakları alınmaz: dük topraklarıyla birlikte yeniden biat eder
    let forced = false;
    if (main && transfer && G.warScore(main.tag, main.rebelFrom) < 0) { forced = !V.forceSubmit; V.forceSubmit = true; transfer = false; }
    basePeace(a, b, transfer, msg);
    if (forced) V.forceSubmit = false;
    // barış masasında asi yeniden vasal yapılıyorsa birliğin geri kalanı da boyun eğer
    const won = V.forceSubmit ? false : main ? !main.overlord : null;
    for (const r of pending) {
      if (r === main || !r.alive || !r.rebelFrom || r.enemies.has(r.rebelFrom)) continue;
      const lord = r.rebelFrom;
      r.rebelFrom = null;
      if (won === false) { r.overlord = lord; r.loyalty = 45; r.vassalSince = S.hour; G.log(`${r.name} yeniden ${S.nations[lord].name} tacına boyun eğdi.`, 'war', [r.tag, lord]); }
      else G.log(`${r.name} de bağımsızlığını kazandı.`, 'good', [r.tag, lord]);
    }
    if (main && main.overlord) { main.loyalty = 45; main.vassalSince = S.hour; }
    G.labelsDirty = true;
  };

  // Teslim olan asi vasal topraklarını kaybetmez: yeniden biat eder (birliğe katılanlar da)
  const baseCap = G.capitulate;
  G.capitulate = function (tag) {
    const S = G.S, n = S.nations[tag];
    if (n && n.alive && n.rebelFrom && n.enemies.has(n.rebelFrom) && S.nations[n.rebelFrom].alive) {
      const lord = n.rebelFrom;
      for (const p of S.provinces) if (p.owner === tag) { p.ctrl = tag; p.siege = null; }
      V.forceSubmit = true;
      G.makePeace(lord, tag, false, `${n.name} teslim oldu ve yeniden ${S.nations[lord].name} tacına biat etti.`);
      V.forceSubmit = false;
      if (lord === S.player) G.ui.notify(`Zafer! ${n.name} teslim oldu ve yeniden vasalımız oldu.`);
      return;
    }
    baseCap(tag);
  };

  // aylık döngüye bağla
  const baseMonthly = G.monthly;
  G.monthly = function () { baseMonthly(); V.monthly(); };

  V.init = function () {
    for (const n of Object.values(G.S.nations)) {
      if (!n.overlord) continue;
      n.loyalty ??= 65; n.tribLevel ||= 'orta'; n.vassalSince ??= -10 * YEAR;
      if (V.DUCHIES[n.tag]) n.vkind ||= V.DUCHIES[n.tag].kind;
    }
  };
})();
