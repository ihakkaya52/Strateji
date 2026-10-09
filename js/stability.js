// İç düzen: ülke istikrarı, illerde huzursuzluk, asimilasyon ve isyanlar
'use strict';

G.stab = {};
(function () {
  const ST = G.stab;
  const YEAR = 24 * 365;
  ST.CORE_YEARS = 25;          // bu kadar yıl elde tutulan il "asıl toprak" olur
  ST.REVOLT_AT = 100;          // huzursuzluk bu değere ulaşınca isyan çıkabilir

  ST.init = function () {
    const S = G.S, W = window.WORLD;
    for (const p of S.provinces) {
      if (!p.owner) continue;
      p.core ??= p.owner;
      p.relig ??= (S.nations[p.owner] || W.nations[p.owner] || {}).religion;
      p.unrest ??= 0;
      p.lastOwner ??= p.owner;
    }
    for (const n of Object.values(S.nations)) n.stability ??= 60;
  };

  const groupOf = tag => (G.S.nations[tag] || window.WORLD.nations[tag] || {}).group;

  // Bir ilin huzursuzluk etkenleri: [ad, değer] listesi (aylık eğilim; pozitif = huzursuzluk artar)
  ST.factors = function (p) {
    const S = G.S, n = S.nations[p.owner];
    if (!n) return [];
    const f = [];
    if (p.core && p.core !== p.owner) f.push(['Yabancı toprak (asıl sahibi başkası)', 2]);
    if (p.relig && p.relig !== n.religion) f.push([`Farklı din (${(G.RELIGIONS[p.relig] || { name: p.relig }).name})`, 2]);
    if (p.core && groupOf(p.core) && groupOf(p.core) !== n.group) f.push(['Farklı kültür', 1]);
    if (p.conquered && S.hour - p.conquered < 5 * YEAR) f.push(['Yeni fethedildi', 1.5]);
    const st = (n.stability ?? 60);
    if (st < 50) f.push(['Düşük istikrar', (50 - st) / 12]);
    else if (st > 60) f.push(['Yüksek istikrar', -(st - 60) / 15]);
    if (n.gold < 0) f.push(['Hazine boş: askere maaş ödenmiyor', 1.5]);
    if (p.fort && p.garrison > 0) f.push(['Garnizon', -Math.min(2.5, p.garrison / 1500)]);
    if (S.armies.some(a => a.prov === p.id && a.tag === p.owner)) f.push(['Ordumuz burada', -3]);
    if (G.econ.isCapital(p)) f.push(['Başkent', -3]);
    f.push(['Zamanla yatışma', -1.5]);
    return f;
  };
  ST.trend = p => ST.factors(p).reduce((t, x) => t + x[1], 0);

  // Huzursuzluk ilin vergisini ve insan gücünü düşürür
  G.unrestMult = p => (p.unrest > 75 ? 0.4 : p.unrest > 50 ? 0.65 : p.unrest > 25 ? 0.9 : 1);

  // Ülke istikrarının hedefi ve etkenleri
  ST.stabFactors = function (n) {
    const S = G.S, f = [['Temel', 60]];
    if (n.gold < 0) f.push(['Hazine eksi', -20]);
    let own = 0, occ = 0, foreign = 0;
    for (const p of S.provinces) {
      if (p.owner !== n.tag) continue;
      own++;
      if (p.ctrl !== n.tag) occ++;
      if (p.core && p.core !== n.tag) foreign++;
    }
    if (own && occ) f.push(['Topraklarımız işgalde', -Math.round(occ / own * 40)]);
    if (own && foreign / own > 0.25) f.push(['Fazla yabancı toprak', -Math.round((foreign / own - 0.25) * 40)]);
    const wars = (S.wars || []).filter(w => w.att.has(n.tag) || w.def.has(n.tag));
    for (const w of wars) {
      const yrs = (S.hour - w.start) / YEAR;
      if (yrs > 1) f.push([`Uzayan savaş (${Math.floor(yrs)} yıl)`, -Math.min(20, Math.round((yrs - 1) * 5))]);
    }
    if (!n.enemies.size) f.push(['Barış', 8]);
    if (n.stabBonus) f.push(['Odaklar ve kararlar', n.stabBonus]);
    if (n.rulerSk) f.push([`Hükümdarın yönetimi (${n.rulerSk.adm})`, (n.rulerSk.adm - 3) * 3]);
    if (n.regency > G.S.hour) f.push(['Naiplik', -8]);
    return f;
  };

  // ------------------------------------------------------------ aylık işleyiş
  ST.monthly = function () {
    const S = G.S;
    for (const n of Object.values(S.nations)) {
      if (!n.alive) continue;
      const target = G.clamp(ST.stabFactors(n).reduce((t, x) => t + x[1], 0), 0, 100);
      n.stability = (n.stability ?? 60) + (target - (n.stability ?? 60)) * 0.15;
    }
    const risers = [];
    for (const p of S.provinces) {
      if (!p.owner || p.kind === 'waste') continue;
      // sahip değişti: fetih zamanı
      if (p.lastOwner !== p.owner) { p.lastOwner = p.owner; p.conquered = S.hour; }
      // asimilasyon: uzun süre elde tutulan il asıl toprak olur
      if (p.core !== p.owner && p.conquered && S.hour - p.conquered > ST.CORE_YEARS * YEAR) {
        p.core = p.owner;
        if (p.owner === S.player) G.log(`${p.name} artık ülkemizin asıl toprağı sayılıyor.`, 'good', [p.owner]);
      }
      if (p.ctrl !== p.owner) continue;   // işgal altındaki ilde isyan olmaz
      p.unrest = G.clamp((p.unrest || 0) + ST.trend(p) + (G.rng() - 0.5), 0, 100);
      if (p.unrest >= ST.REVOLT_AT && G.rng() < 0.25) risers.push(p);
    }
    for (const p of risers) if (p.unrest >= ST.REVOLT_AT && p.owner === p.ctrl) ST.revolt(p);
    ST.rebelFate();
  };

  // İsyancıların sonu: ordusu kalmayan isyan söner (iller eski sahibine döner), üç yıl dayanan isyan bağımsızlığını kazanır
  ST.rebelFate = function () {
    const S = G.S;
    for (const n of Object.values(S.nations)) {
      if (!n.alive || !n.rebel) continue;
      const lord = S.nations[n.rebelAgainst];
      if (!lord || !lord.alive || !n.enemies.has(n.rebelAgainst)) { n.rebel = false; continue; }   // barış oldu: artık bağımsız
      const months = (S.hour - (n.rebelSince || S.hour)) / 24 / 30;
      const armies = S.armies.some(a => a.tag === n.tag);
      if (!armies && months > 4) {
        // isyan bastırıldı
        for (const p of S.provinces) if (p.owner === n.tag) { p.owner = n.rebelAgainst; p.ctrl = n.rebelAgainst; p.siege = null; p.unrest = 30; p.lastOwner = p.owner; }
        G.log(`${n.name} bastırıldı; topraklar yeniden ${lord.name}'a bağlandı.`, n.rebelAgainst === S.player ? 'good' : 'info', [n.tag, n.rebelAgainst]);
        G.makePeace(n.rebelAgainst, n.tag, false, '');
        G.checkElimination();
        G.labelsDirty = true; G.mapDirty = true;
      } else if (months > 36) {
        n.rebel = false;
        G.makePeace(n.tag, n.rebelAgainst, true, `${n.name} ${lord.name}'a karşı direnişini sürdürdü ve bağımsızlığını kabul ettirdi.`);
      }
    }
  };

  // ------------------------------------------------------------ isyan
  let rebelNo = 0;
  ST.revolt = function (p, customName) {
    const S = G.S, owner = p.owner, on = S.nations[owner];
    // aynı sahibin, aynı asıl sahipli ve huzursuz komşu illeri de katılır
    const group = [p], seen = new Set([p.id]);
    for (let i = 0; i < group.length && group.length < 7; i++) {
      for (const nb of group[i].nb) {
        const q = S.provinces[nb];
        if (seen.has(nb) || q.owner !== owner || q.ctrl !== owner || q.core !== p.core || q.unrest < 60 || G.econ.isCapital(q)) continue;
        seen.add(nb); group.push(q);
      }
    }
    if (group.some(q => G.econ.isCapital(q)) && group.length === 1) { p.unrest = 70; return; }
    // tek bir kırsal ilin ayaklanması ülke kuramaz: köylüler dağılır, il kısa süre verimsiz kalır
    if (group.length === 1 && p.kind === 'rural' && !customName) { p.unrest = 75; return; }
    // eski sahibi yok olmuşsa yeniden doğar; yoksa yeni bir isyancı ülkesi kurulur
    let tag, def;
    const core = p.core && p.core !== owner ? p.core : null;
    const coreDef = core && (window.WORLD.nations[core] || (S.nations[core] && S.nations[core]));
    if (core && coreDef && (!S.nations[core] || !S.nations[core].alive)) {
      tag = core;
      def = { name: coreDef.name, color: coreDef.color, major: false, ruler: G.nameFor(owner), religion: p.relig || coreDef.religion, group: coreDef.group };
    } else {
      tag = 'R' + (++rebelNo) + '_' + S.hour;
      const base = p.home || p.name;
      def = { name: customName || `${base} İsyancıları`, color: '#7a2a24', major: false, ruler: G.nameFor(owner),
        religion: p.relig || on.religion, group: groupOf(p.core) || on.group };
    }
    // ülkenin bu illerdeki orduları dışarı çekilir
    const n = G.addNation(tag, def);
    n.rebel = true; n.stability = 50; n.rebelAgainst = owner; n.rebelSince = S.hour;
    for (const q of group) { G.transferProvince(q.id, tag); q.unrest = 0; q.garrison = 0; q.lastOwner = tag; q.conquered = null; }
    n.capital = group[0].id;
    n.manpower = 6000 + group.length * 1500;
    G.evacuateArmies();
    const men = Math.round(4000 + group.reduce((t, q) => t + (q.kind === 'rural' ? 1200 : 2500), 0));
    let left = men, k = 0;
    while (left > 1500 && k < 4) {
      const a = G.createArmy(tag, group[k % group.length].id, Math.min(left, 9000));
      a.gear = G.econ.need(a);
      left -= a.men; k++;
    }
    G.declareWar(tag, owner, true);
    for (const q of S.provinces) if (q.owner === owner && q.unrest > 20) q.unrest -= 20;   // isyan patlayınca gerilim azalır
    on.stability = Math.max(0, (on.stability ?? 60) - 10);
    G.labelsDirty = true; G.mapDirty = true;
    const names = group.map(q => q.name).slice(0, 4).join(', ') + (group.length > 4 ? '…' : '');
    G.log(`${on.name} topraklarında isyan: ${n.name} ${names} illerini ele geçirdi!`, 'war', [owner, tag]);
    if (owner === S.player) {
      G.ui.showEvent('İsyan!', `${names} halkı ${core && tag === core ? `eski ${n.name} adına` : 'tacımıza karşı'} ayaklandı. ` +
        `${G.fmtNum(men)} isyancı silaha sarıldı ve ${group.length} il ellerine geçti. İsyan bastırılmazsa bu topraklar kaybedilecek.`,
        [{ text: 'İsyanı bastırın!' }]);
    }
  };
})();
