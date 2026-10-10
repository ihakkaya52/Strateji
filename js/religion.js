// Din: illerin dini, misyonerler, dinî birlik, Haçlı Seferi ve Cihat
'use strict';

G.rel = {};
(function () {
  const R = G.rel;
  const YEAR = 24 * 365;
  // Dinlerin üst kategorisi (aile) ve alt kategorisi (mezhep)
  R.CHRISTIAN = ['katolik', 'ortodoks', 'miafizit', 'nesturi'];
  R.MUSLIM = ['sunni', 'sii', 'ibadi', 'bergvata'];
  R.PAGAN = ['tengri', 'pagan_slav', 'pagan_baltik', 'pagan_fin', 'pagan_afrika', 'ruya'];
  R.family = r => (R.CHRISTIAN.includes(r) ? 'hristiyan' : R.MUSLIM.includes(r) ? 'islam' : R.PAGAN.includes(r) ? 'pagan' : r);
  R.FAMILY_NAMES = { hristiyan: 'Hristiyanlık', islam: 'İslam', pagan: 'Eski İnançlar', budist: 'Budizm', hindu: 'Hinduizm', konfucyus: 'Çin İnançları' };
  R.familyName = r => R.FAMILY_NAMES[R.family(r)] || (G.RELIGIONS[r] || { name: r }).name;
  // "İslam › Sünnî" biçiminde tam ad
  R.fullName = r => { const n = (G.RELIGIONS[r] || { name: r || '—' }).name, f = R.familyName(r); return f && f !== n ? `${f} › ${n}` : n; };
  // Aynı ailedeki başka mezhebe öğreti, başka dine misyonerlik yapılır
  R.sameFamily = (a, b) => !!a && !!b && R.family(a) === R.family(b);
  R.TEACH_GOLD = 1;
  R.CONVERT_NEED = 100;
  R.MISSION_GOLD = 2;            // misyoner başına aylık altın
  R.HOLY_GOLD = 200;             // kutsal sefer çağrısının bedeli
  R.HOLY_YEARS = 5;              // sefer bu kadar sürer
  R.COOLDOWN = 10;               // aynı ülke bu kadar yıl yeni sefer çağıramaz

  R.init = function () {
    const S = G.S;
    S.holyWars ||= [];
    for (const n of Object.values(S.nations)) {
      n.missionaries ??= n.major ? 2 : 1;
      n.missions ||= [];
    }
  };

  // ------------------------------------------------------------ dinî birlik
  R.unity = function (tag) {
    const S = G.S, n = S.nations[tag];
    let tot = 0, same = 0;
    for (const p of G.provsOf(tag)) {
      const w = G.provinceWeight(p);
      tot += w;
      const r = p.relig || n.religion;
      if (r === n.religion) same += w; else if (R.sameFamily(r, n.religion)) same += w * 0.75;   // aynı dinin başka mezhebi büyük ölçüde sayılır
    }
    return tot ? same / tot : 1;
  };

  // ------------------------------------------------------------ misyonerler
  R.canMission = function (tag, p) {
    const n = G.S.nations[tag];
    if (p.owner !== tag || p.ctrl !== tag) return [false, 'İl elimizde olmalı.'];
    if (!p.relig || p.relig === n.religion) return [false, 'Bu il zaten bizim dinimizden.'];
    if (n.missions.some(m => m.prov === p.id)) return [false, 'Misyonerimiz zaten burada.'];
    if (n.missions.length >= n.missionaries) return [false, `Bütün misyonerlerimiz görevde (${n.missions.length} / ${n.missionaries}).`];
    const teach = R.sameFamily(p.relig, n.religion);
    return [true, `${teach ? 'Mezhep öğretisi' : 'Misyonerlik'}: ayda ${teach ? R.TEACH_GOLD : R.MISSION_GOLD} altın; yaklaşık ${Math.round(R.CONVERT_NEED / R.speed(tag, p))} ayda halk ${G.RELIGIONS[n.religion].name} olur.`];
  };
  R.speed = function (tag, p) {
    const n = G.S.nations[tag];
    let v = 7 * (n.rulerSk ? 1 + 0.1 * (n.rulerSk.dip - 3) : 1);
    if (G.econ.isCapital(p)) v *= 0.6;
    if (p.kind === 'rural') v *= 1.25;
    v -= (p.unrest || 0) / 25;
    if (R.family(p.relig) === R.family(n.religion)) v *= 1.7;   // aynı dinin başka mezhebine öğreti: çok daha kolay
    return Math.max(1, v);
  };
  R.sendMission = function (tag, pid) {
    const n = G.S.nations[tag], p = G.S.provinces[pid];
    const [ok] = R.canMission(tag, p);
    if (!ok) return false;
    n.missions.push({ prov: pid, prog: 0 });
    return true;
  };
  R.recall = (tag, pid) => { const n = G.S.nations[tag]; n.missions = n.missions.filter(m => m.prov !== pid); };

  // ------------------------------------------------------------ kutsal seferler
  R.holyKind = tag => (R.family(G.S.nations[tag].religion) === 'hristiyan' ? 'hacli' : R.family(G.S.nations[tag].religion) === 'islam' ? 'cihat' : null);
  R.kindName = k => (k === 'hacli' ? 'Haçlı Seferi' : 'Cihat');
  R.activeOf = tag => (G.S.holyWars || []).find(h => h.members.includes(tag));

  R.canCall = function (tag, target) {
    const S = G.S, n = S.nations[tag], t = S.nations[target];
    const kind = R.holyKind(tag);
    if (!kind) return [false, 'Dinimizin kutsal sefer geleneği yok.'];
    if (!t || !t.alive) return [false, 'Bu ülke yok.'];
    if (R.family(t.religion) === R.family(n.religion)) return [false, 'Kendi dinimizden bir ülkeye kutsal sefer açılmaz.'];
    if (n.overlord) return [false, 'Vasallar kutsal sefer çağıramaz.'];
    if (R.activeOf(tag)) return [false, 'Zaten bir kutsal seferdeyiz.'];
    if (n.lastHoly && S.hour - n.lastHoly < R.COOLDOWN * YEAR) return [false, `Son seferin üzerinden ${R.COOLDOWN} yıl geçmeli.`];
    if (n.gold < R.HOLY_GOLD) return [false, `${R.HOLY_GOLD} altın gerekir.`];
    if ((n.stability ?? 60) < 40) return [false, 'İstikrar en az 40 olmalı.'];
    if ((n.truces[target] || 0) > S.hour) return [false, 'Ateşkes sürüyor.'];
    return [true, `${R.HOLY_GOLD} altın. Aynı dinden ülkeler ordularıyla katılabilir.`];
  };

  // Savaşa yeni bir ülke ekle (koalisyon)
  G.joinWar = function (war, tag, attSide) {
    const S = G.S, mine = attSide ? war.att : war.def, other = attSide ? war.def : war.att;
    if (mine.has(tag) || other.has(tag)) return;
    mine.add(tag);
    const n = S.nations[tag];
    for (const y of other) {
      const ny = S.nations[y];
      if (!ny || !ny.alive || n.enemies.has(y)) continue;
      n.enemies.add(y); ny.enemies.add(tag);
      n.warStart[y] = ny.warStart[tag] = S.hour;
    }
  };

  // Sefer hedefi: kutsal şehir hedef ülkedeyse orası, yoksa hedefin başkenti
  R.goalFor = function (target, kind) {
    const S = G.S;
    const holy = S.provinces.find(p => p.name === 'Kudüs');
    if (holy && holy.owner === target) return holy.id;
    if (kind === 'cihat') {
      const mk = S.provinces.find(p => p.name === 'Mekke');
      if (mk && mk.owner === target) return mk.id;
    }
    return S.nations[target].capital;
  };

  // Toplanma yeri: hedefe en yakın, seferin dininden bir ülkenin elindeki il
  R.staging = function (h) {
    const S = G.S, goal = S.provinces[h.goal];
    let best = null;
    for (const p of S.provinces) {
      if (!p.ctrl || p.kind === 'waste') continue;
      const c = S.nations[p.ctrl];
      if (!c || R.family(c.religion) !== h.fam || G.atWar(p.ctrl, h.leader) || p.ctrl === h.target) continue;
      if (S.armies.some(a => a.prov === p.id && G.atWar(h.members[0], a.tag))) continue;
      const d = G.distKm(p, goal);
      if (!best || d < best.d) best = { p, d };
    }
    return best ? best.p.id : null;
  };

  R.call = function (leader, target, opts = {}) {
    const S = G.S, ln = S.nations[leader], tn = S.nations[target];
    const kind = R.holyKind(leader), fam = R.family(ln.religion);
    if (!opts.free) ln.gold -= R.HOLY_GOLD;
    ln.lastHoly = S.hour;
    if (!ln.enemies.has(target)) G.declareWar(leader, target, true);
    const war = G.findWar(leader, target);
    const h = { id: S.hour, kind, fam, leader, target, goal: R.goalFor(target, kind), members: [leader], start: S.hour, end: S.hour + R.HOLY_YEARS * YEAR };
    S.holyWars.push(h);
    const title = R.kindName(kind);
    G.log(`${ln.name} ${tn.name}'a karşı ${title} çağrısı yaptı! Hedef: ${S.provinces[h.goal].name}.`, 'war', [leader, target]);
    // katılımcılar: aynı dinden (Haçlılarda Katolikler) ülkeler
    const relig = kind === 'hacli' ? (ln.religion === 'ortodoks' ? ['ortodoks', 'katolik'] : ['katolik']) : [ln.religion];
    const cands = Object.values(S.nations).filter(n => n.alive && n.tag !== leader && relig.includes(n.religion) && !n.overlord &&
      !n.enemies.has(leader) && !G.dip.allied(n.tag, target) && (n.truces[target] || 0) <= S.hour && n.tag !== target)
      .sort((a, b) => G.dip.power(b.tag) - G.dip.power(a.tag)).slice(0, 12);
    for (const n of cands) {
      if (n.tag === S.player) {
        G.ui.showEvent(title, `${ln.name} (${ln.ruler}) bütün ${kind === 'hacli' ? 'Hristiyan' : 'Müslüman'} hükümdarları ${tn.name}'a karşı ${title}na çağırıyor. ` +
          `Hedef ${S.provinces[h.goal].name}. Katılırsak ordularımız toplanma yerinde sefere katılacak; sefer başarılı olursa itibarımız ve istikrarımız artar.`,
          [{ text: `${title}na katıl`, sub: 'Savaşa gireriz, iki ordumuz cepheye gönderilir', action: () => R.join(h, S.player) },
           { text: 'Katılma', sub: `${ln.name} ile ilişki −30`, action: () => G.dip.add(S.player, leader, -30) }]);
        continue;
      }
      let ch = n.major ? 0.55 : 0.3;
      ch += G.dip.opinion(n.tag, leader) / 400;
      if (n.enemies.size) ch -= 0.25;
      if (G.rng() < ch) R.join(h, n.tag, true);
    }
    R.reinforce(h, leader);
    if (target === S.player) {
      G.ui.showEvent(`${title} Bize Karşı!`, `${ln.name} ${title} ilan etti ve ${h.members.length} hükümdar sancağı altında toplandı: ` +
        `${h.members.map(t => S.nations[t].name).join(', ')}. Hedefleri ${S.provinces[h.goal].name}. Ülkemizi savunmalıyız!`, [{ text: 'Kâfirlere geçit yok!' }]);
    }
    return h;
  };

  R.join = function (h, tag, quiet) {
    const S = G.S;
    const war = G.findWar(h.leader, h.target);
    if (!war || h.members.includes(tag)) return;
    G.joinWar(war, tag, war.att.has(h.leader));
    h.members.push(tag);
    R.reinforce(h, tag);
    if (!quiet || S.nations[tag].major) G.log(`${S.nations[tag].name} ${R.kindName(h.kind)}na katıldı.`, 'war', [tag, h.target]);
  };

  // Katılan ülkenin orduları toplanma yerinde belirir (yolculuk sefer hazırlığına sayılır)
  R.reinforce = function (h, tag) {
    const S = G.S, n = S.nations[tag];
    const st = R.staging(h);
    if (st == null) return;
    const k = n.major ? 2 : 1;
    for (let i = 0; i < k; i++) {
      const a = G.createArmy(tag, st, 9000);
      a.name = `${n.name.split(' ')[0]} ${h.kind === 'hacli' ? 'Haçlıları' : 'Gazileri'}${k > 1 ? ' ' + (i + 1) : ''}`;
      a.gear = G.econ.need(a);
      a.holy = h.id;
    }
    if (tag === S.player) G.log(`Ordularımız ${S.provinces[st].name}'da ${R.kindName(h.kind)}na katıldı.`, 'good', [tag]);
  };

  // Seferdeki ülkeler, aynı dinden ülkelerin topraklarından geçebilir
  const baseAccess = G.dip.hasAccess;
  G.dip.hasAccess = function (tag, ctrl) {
    if (baseAccess(tag, ctrl)) return true;
    const S = G.S;
    if (!S || !S.holyWars || !S.holyWars.length || !tag || !ctrl) return false;
    const h = R.activeOf(tag), c = S.nations[ctrl];
    return !!(h && c && R.family(c.religion) === h.fam && !G.atWar(tag, ctrl));
  };

  // ------------------------------------------------------------ aylık işleyiş
  R.monthly = function () {
    const S = G.S;
    R.init();
    // misyonerler
    for (const n of Object.values(S.nations)) {
      if (!n.alive) continue;
      for (const m of n.missions.slice()) {
        const p = S.provinces[m.prov];
        if (p.owner !== n.tag || p.ctrl !== n.tag || p.relig === n.religion) { R.recall(n.tag, m.prov); continue; }
        n.gold -= R.sameFamily(p.relig, n.religion) ? R.TEACH_GOLD : R.MISSION_GOLD;
        m.prog += R.speed(n.tag, p);
        if (m.prog >= R.CONVERT_NEED) {
          const old = p.relig;
          p.relig = n.religion;
          p.unrest = Math.min(100, (p.unrest || 0) + (R.sameFamily(old, n.religion) ? 2 : 8));
          R.recall(n.tag, m.prov);
          if (n.tag === S.player) G.log(`${p.name} halkı ${G.RELIGIONS[n.religion].name} dinine geçti (eskiden ${(G.RELIGIONS[old] || { name: old }).name}).`, 'good', [n.tag]);
        }
      }
      // yapay zekâ misyonerleri
      if (n.tag !== S.player && n.missions.length < n.missionaries && n.gold > 40 && G.rng() < 0.3) {
        const c = S.provinces.filter(p => R.canMission(n.tag, p)[0]);
        if (c.length) R.sendMission(n.tag, G.pick(c.sort((a, b) => G.provinceWeight(b) - G.provinceWeight(a)).slice(0, 5)).id);
      }
    }
    // kutsal seferler: hedef alınınca zafer, süre dolunca dağılır
    for (const h of S.holyWars.slice()) {
      const goal = S.provinces[h.goal], tn = S.nations[h.target];
      const winner = h.members.find(t => goal.ctrl === t);
      const over = !tn || !tn.alive || !G.atWar(h.leader, h.target);
      if (winner || over || S.hour > h.end) {
        S.holyWars.splice(S.holyWars.indexOf(h), 1);
        const title = R.kindName(h.kind);
        if (winner) {
          goal.owner = winner; goal.lastOwner = winner;
          for (const t of h.members) { const n = S.nations[t]; if (n && n.alive) n.stability = Math.min(100, (n.stability ?? 60) + 12); }
          const txt = `${title} zaferle sonuçlandı: ${goal.name} ${S.nations[winner].name}'ın eline geçti!`;
          G.log(txt, 'war', [...h.members, h.target]);
          if (h.members.includes(S.player) || h.target === S.player) G.ui.showEvent(title, txt, [{ text: h.target === S.player ? 'Acı bir kayıp' : 'Deus vult!' }]);
        } else {
          // süre doldu: lider dışındaki katılımcılar evlerine döner
          for (const t of h.members) if (t !== h.leader && S.nations[t] && G.atWar(t, h.target)) G.makePeace(t, h.target, false, '');
          G.log(`${title} hedefine ulaşamadan dağıldı.`, 'info', [h.leader, h.target]);
          for (const t of h.members) { const n = S.nations[t]; if (n && n.alive) n.stability = Math.max(0, (n.stability ?? 60) - 5); }
        }
      }
    }
    R.historical();
    R.ai();
  };

  // Tarihî tetikleyiciler: 1095 Clermont çağrısı
  R.historical = function () {
    const S = G.S;
    S.relFired ||= {};
    const holy = S.provinces.find(p => p.name === 'Kudüs');
    if (!S.relFired.clermont && S.time.y >= 1095 && holy && holy.owner && R.family(S.nations[holy.owner].religion) === 'islam') {
      S.relFired.clermont = true;
      const pap = S.nations.PAP && S.nations.PAP.alive ? 'PAP' : null;
      const cath = Object.values(S.nations).filter(n => n.alive && n.religion === 'katolik' && n.major).sort((a, b) => G.dip.power(b.tag) - G.dip.power(a.tag));
      const leader = pap || (cath[0] && cath[0].tag);
      if (leader && leader !== S.player) {
        G.log('Papa Clermont\'da Hristiyan âlemini Kudüs\'ü kurtarmaya çağırdı: "Deus vult!"', 'war', [leader, holy.owner]);
        R.call(leader, holy.owner, { free: true });
      }
    }
  };

  // Yapay zekâ: kutsal şehirleri kaybeden ya da dinî düşmanına karşı güçlü olan büyük güçler sefer çağırır
  R.ai = function () {
    const S = G.S;
    if (G.rng() > 0.15) return;
    for (const n of Object.values(S.nations)) {
      if (!n.alive || n.tag === S.player || !n.major || !R.holyKind(n.tag)) continue;
      const nb = [...(G.ai.neighbors()[n.tag] || [])].filter(t => S.nations[t] && S.nations[t].alive && R.family(S.nations[t].religion) !== R.family(n.religion) && R.holyKind(t));
      for (const t of nb) {
        if (!R.canCall(n.tag, t)[0]) continue;
        // kutsal şehirlerimizi elinde tutuyorsa ya da bizden çok zayıfsa
        // kutsal şehirde dindaşlarımız yabancı yönetim altında yaşıyorsa (ör. Haçlıların aldığı Kudüs) sefer sebebidir
        const holyTaken = S.provinces.some(p => p.owner === t && (p.name === 'Kudüs' || p.name === 'Mekke') && R.family(p.relig) === R.family(n.religion));
        if ((holyTaken && G.rng() < 0.4) || (!n.enemies.size && G.dip.power(n.tag) > G.dip.power(t) * 3 && G.rng() < 0.01)) { R.call(n.tag, t); return; }
      }
    }
  };

  // dinî birlik istikrarı etkiler
  const baseStab = G.stab.stabFactors;
  G.stab.stabFactors = function (n) {
    const f = baseStab(n);
    const u = R.unity(n.tag);
    if (u < 0.7) f.push([`Dinî birlik düşük (%${Math.round(u * 100)})`, -Math.round((0.7 - u) * 30)]);
    else if (u > 0.95) f.push(['Dinî birlik', 4]);
    return f;
  };
})();
