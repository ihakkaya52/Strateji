// Hanedanlar: hükümdarların yaşı, becerileri, ölümü, varisler, naiplik, taht krizleri, hanedan evlilikleri ve kişisel birlik
'use strict';

G.dyn = {};
(function () {
  const DY = G.dyn;

  // Büyük güçlerin 1040'taki hükümdarlarının doğum yılı, tarihî ölüm yılı ve sıradaki tarihî hükümdarlar
  const HIST = {
    BYZ: { born: 1010, dies: 1041, dyn: 'Paphlagon', next: ['V. Mihail', 'IX. Konstantinos Monomakhos', 'VI. Mihail', 'I. İsaakios Komnenos', 'X. Konstantinos Doukas', 'IV. Romanos Diogenes', 'VII. Mihail Doukas', 'III. Nikephoros', 'I. Aleksios Komnenos', 'II. İoannes Komnenos'] },
    SEL: { born: 990, dies: 1063, dyn: 'Selçuklu', next: ['Alp Arslan', 'Melikşah', 'Berkyaruk', 'Muhammed Tapar', 'Sencer'] },
    FAT: { born: 1029, dies: 1094, dyn: 'Fâtımî', next: ['el-Müsta\'lî', 'el-Âmir', 'el-Hâfız'] },
    HRE: { born: 1017, dies: 1056, dyn: 'Salier', next: ['IV. Heinrich', 'V. Heinrich', 'III. Lothar'] },
    FRA: { born: 1008, dies: 1060, dyn: 'Capet', next: ['I. Philippe', 'VI. Louis', 'VII. Louis'] },
    KIE: { born: 978, dies: 1054, dyn: 'Rurik', next: ['I. İzyaslav', 'II. Svyatoslav', 'I. Vsevolod', 'II. Svyatopolk', 'Vladimir Monomakh'] },
    DEN: { born: 1018, dies: 1042, dyn: 'Jelling', next: ['I. Magnus', 'II. Sven Estridsen', 'II. Harald', 'IV. Knut', 'I. Olaf', 'I. Erik', 'I. Niels'] },
    GAZ: { born: 998, dies: 1041, dyn: 'Gazneli', next: ['Mevdud', 'II. Mesud', 'Abdürreşid', 'Ferruhzad', 'İbrahim', 'III. Mesud'] },
    SNG: { born: 1010, dies: 1063, dyn: 'Zhao', next: ['Yingzong', 'Shenzong', 'Zhezong', 'Huizong'] },
    LIA: { born: 1016, dies: 1055, dyn: 'Yelü', next: ['Daozong', 'Tianzuo'] },
    ABB: { born: 1001, dies: 1075, dyn: 'Abbâsî', next: ['el-Muktedî', 'el-Müstazhir', 'el-Müsterşid', 'er-Râşid', 'el-Muktefî'] },
    ENG: { born: 1018, dies: 1042, dyn: 'Wessex', next: ['Günah Çıkaran Edward', 'II. Harold', 'I. William'] },
  };
  DY.HIST = HIST;
  const YEAR = 24 * 365;
  const roll = () => 1 + Math.floor(G.rng() * 3 + G.rng() * 3);   // 1–6, ortası sık
  const skills = () => ({ adm: roll(), dip: roll(), mil: roll() });
  const ordinalName = (tag, base) => {
    const n = G.S.nations[tag];
    return base || G.nameFor(tag);
  };

  DY.age = (n, born) => G.S.time.y - (born ?? n.rulerBorn ?? G.S.time.y - 35);

  DY.makeHeir = function (n, minAge = 0, maxAge = 22) {
    const h = HIST[n.tag];
    const y = G.S.time.y;
    let name = null;
    // alternatif tarih yollarında hanedanın kendi halef listesi olabilir
    const list = n.histNext || (h && h.next);
    if (list && (n.histIdx || 0) < list.length) name = list[n.histIdx || 0];
    return { name: name || G.nameFor(n.tag), born: y - (minAge + Math.floor(G.rng() * (maxAge - minAge + 1))), sk: skills(), hist: !!name,
      idx: name ? (n.histIdx || 0) : null };
  };

  DY.init = function () {
    const S = G.S;
    for (const n of Object.values(S.nations)) DY.setup(n);
  };
  DY.setup = function (n) {
    const y = G.S.time.y, h = HIST[n.tag];
    if (n.rulerBorn != null) return;
    n.rulerBorn = h ? h.born : y - (22 + Math.floor(G.rng() * 35));
    n.rulerSk = skills();
    if (h && n.tag === 'SEL') n.rulerSk = { adm: 5, dip: 4, mil: 5 };
    n.dynasty = h ? h.dyn : (n.ruler || '').split(/\s+/).pop() || n.name.split(' ')[0];
    n.histIdx = 0;
    n.heir = G.rng() < 0.85 ? DY.makeHeir(n, 0, Math.max(0, Math.min(25, DY.age(n) - 18))) : null;
    // özel başlangıçlı ülkelerde hükümdar becerileri ve veliaht tarihe göre
    const pr = G.PROFILES && G.PROFILES[n.tag];
    if (pr) {
      if (pr.ruler && pr.ruler.sk) n.rulerSk = { ...pr.ruler.sk };
      if (pr.heir) n.heir = { name: pr.heir.name, born: pr.heir.born, sk: { ...pr.heir.sk }, hist: pr.heir.hist ?? true, idx: 0 };
      else if (pr.heir === null) n.heir = null;
      if (pr.regency) n.regency = G.S.hour + pr.regency * YEAR;
    }
    n.marriages ||= new Set();
    n.pastRulers ||= [];
    n.regency = 0;
  };

  // Hükümdar becerilerinin etkisi
  G.rulerMod = function (tag, kind) {
    const n = G.S.nations[tag];
    if (!n || !n.rulerSk) return 1;
    const v = n.rulerSk[kind] ?? 3;
    const reg = n.regency > G.S.hour ? 0.5 : 1;   // naiplikte hükümdarın etkisi yarıya iner
    if (kind === 'adm') return 1 + 0.05 * (v - 3) * reg;
    if (kind === 'mil') return 1 + 0.04 * (v - 3) * reg;
    if (kind === 'dip') return 1 + 0.15 * (v - 3) * reg;
    return 1;
  };

  // ------------------------------------------------------------ aylık: ölüm, varis doğumu, evlilikler
  const deathChance = (age, hist) => {
    let p = age < 30 ? 0.0006 : age < 45 ? 0.0012 : age < 55 ? 0.003 : age < 65 ? 0.007 : age < 75 ? 0.016 : 0.035;
    if (hist) p = Math.max(p, 0.12);   // tarihî ölüm yılı geldi
    return p;
  };
  DY.monthly = function () {
    const S = G.S, y = S.time.y;
    for (const n of Object.values(S.nations)) {
      if (!n.alive) continue;
      if (n.rulerBorn == null) DY.setup(n);
      const h = HIST[n.tag];
      const hist = h && n.reignStart == null && (n.histIdx || 0) === 0 && y >= h.dies;   // yalnızca 1040'taki hükümdar
      // özel başlangıçlı krallıklarda 1040'taki hükümdar tarihî ölüm yılından önce ölmez
      const shield = h && n.reignStart == null && y < h.dies && G.PROFILES && G.PROFILES[n.tag];
      if (!shield && G.rng() < deathChance(DY.age(n), hist)) { DY.die(n); continue; }
      // varisi yoksa doğabilir; varis de ölebilir
      if (!n.heir && DY.age(n) < 60 && G.rng() < 0.02) {
        n.heir = DY.makeHeir(n, 0, 0);
        if (n.tag === S.player) G.log(`Sarayda bir veliaht doğdu: ${n.heir.name}.`, 'good', [n.tag]);
      } else if (n.heir && G.rng() < deathChance(y - n.heir.born) * 0.6) {
        if (n.tag === S.player) G.log(`Veliaht ${n.heir.name} öldü. Taht bir varissiz kalabilir!`, 'war', [n.tag]);
        n.heir = null;
      }
      if (n.tag !== S.player && G.rng() < 0.01) DY.aiMarry(n);
    }
  };

  DY.die = function (n) {
    const S = G.S, old = n.ruler, age = DY.age(n), me = n.tag === S.player;
    n.pastRulers ||= [];
    n.pastRulers.unshift({ name: old + (n.rulerTitle ? ` "${n.rulerTitle}"` : ''), from: n.reignStart ?? 1040, to: S.time.y, age });
    n.rulerTitle = null;   // kötü unvan hükümdarla birlikte gömülür
    if (n.pastRulers.length > 20) n.pastRulers.length = 20;
    const h = HIST[n.tag];
    if (n.heir) {
      const heir = n.heir;
      n.ruler = heir.name; n.rulerBorn = heir.born; n.rulerSk = heir.sk; n.reignStart = S.time.y;
      if (heir.hist) n.histIdx = (heir.idx ?? (n.histIdx || 0)) + 1;
      n.heir = null;
      const hAge = S.time.y - heir.born;
      let extra = '';
      if (hAge < 16) {
        n.regency = S.hour + (16 - hAge) * YEAR;
        n.stability = Math.max(0, (n.stability ?? 60) - 10);
        extra = ` Yeni hükümdar ${hAge} yaşında; ${16 - hAge} yıl boyunca naipler yönetecek.`;
      }
      // yeni varis: hükümdarın çocuğu ya da kardeşi
      n.heir = G.rng() < 0.75 ? DY.makeHeir(n, 0, Math.max(0, Math.min(18, hAge - 16))) : null;
      if (me) G.ui.showEvent('Hükümdar Öldü', `${old} ${age} yaşında öldü. Taht ${n.ruler}'a geçti.${extra}`, [{ text: 'Yaşasın yeni hükümdar!' }]);
      else G.log(`${n.name}: ${old} öldü, yerine ${n.ruler} geçti.`, 'info', [n.tag]);
    } else DY.crisis(n, old, age);
    if (G.ui.refreshTop && me) G.labelsDirty = true;
  };

  // Varis yok: hanedan evliliği olan güçlü bir ülke tahtı alabilir; yoksa taht kavgası
  DY.crisis = function (n, old, age) {
    const S = G.S, me = n.tag === S.player;
    const partners = [...(n.marriages || [])].map(t => S.nations[t]).filter(x => x && x.alive && !x.overlord && x.tag !== n.tag)
      .sort((a, b) => G.dip.power(b.tag) - G.dip.power(a.tag));
    const lord = partners[0];
    if (lord && G.dip.power(lord.tag) > G.dip.power(n.tag) * 1.2 && !n.enemies.has(lord.tag) && G.rng() < 0.5 && !n.major) {
      // kişisel birlik: taht evlilik yoluyla güçlü ülkenin hükümdarına geçer; ülke vasal olur
      n.ruler = lord.ruler; n.rulerBorn = lord.rulerBorn; n.rulerSk = { ...lord.rulerSk }; n.reignStart = S.time.y;
      n.overlord = lord.tag; n.tribute = 0.2;
      for (const t of [...n.allies]) { n.allies.delete(t); if (S.nations[t]) S.nations[t].allies.delete(n.tag); }
      n.heir = null;
      G.labelsDirty = true; G.mapDirty = true;
      const txt = `${old} varissiz öldü. Hanedan evliliği sayesinde taht ${lord.name} hükümdarı ${lord.ruler}'a geçti: ${n.name} artık ${lord.name} tacına bağlı.`;
      if (me || lord.tag === S.player) G.ui.showEvent('Kişisel Birlik', txt, [{ text: lord.tag === S.player ? 'Taç genişliyor!' : 'Kader böyleymiş' }]);
      else G.log(txt, 'info', [n.tag, lord.tag]);
      return;
    }
    // taht kavgası: uzak bir akraba tahta çıkar, istikrar çöker, bir taht davacısı ayaklanabilir
    n.ruler = G.nameFor(n.tag); n.rulerBorn = S.time.y - (25 + Math.floor(G.rng() * 25)); n.rulerSk = skills(); n.reignStart = S.time.y;
    n.stability = Math.max(0, (n.stability ?? 60) - 25);
    n.heir = G.rng() < 0.5 ? DY.makeHeir(n, 0, 10) : null;
    const cities = S.provinces.filter(p => p.owner === n.tag && p.ctrl === n.tag && p.kind !== 'rural' && !G.econ.isCapital(p));
    const pretender = cities.length >= 3 && G.rng() < 0.6;
    if (pretender) {
      const p = G.pick(cities);
      for (const q of S.provinces) if (q.owner === n.tag && (q.home === (p.home || p.name) || q.id === p.id)) q.unrest = 100;
      p.unrest = 100;
      G.stab.revolt(p, `Taht davacısı ${G.nameFor(n.tag)}`);
    }
    const txt = `${old} varissiz öldü! Saray karıştı, soylular birbirine girdi; sonunda ${n.ruler} tahta çıktı.` +
      (pretender ? ' Ama bir taht davacısı onu tanımıyor ve isyan bayrağı açtı!' : '');
    if (me) G.ui.showEvent('Taht Kavgası', txt, [{ text: 'Düzeni sağlayın!' }]);
    else G.log(`${n.name}: ${txt}`, 'war', [n.tag]);
  };

  // Odak ya da olayla tahta biri çıkarılır (darbe, tahttan feragat, tarihî halef): eski hükümdar listeye yazılır
  DY.crown = function (n, name) {
    const S = G.S;
    if (n.ruler === name) return;
    // tarihî bir halef ise hemen tahta çıkmaz, veliaht ilan edilir (zamanı gelince tahta geçer)
    const hh = HIST[n.tag], hi = hh ? hh.next.indexOf(name) : -1;
    if (hi >= 0) {
      n.heir = { name, born: S.time.y - (18 + Math.floor(G.rng() * 12)), sk: skills(), hist: true, idx: hi };
      n.heir.sk.mil = Math.max(n.heir.sk.mil, 4); n.heir.sk.adm = Math.max(n.heir.sk.adm, 3);
      if (n.tag === S.player) G.log(`${name} veliaht ilan edildi.`, 'good', [n.tag]);
      return;
    }
    n.pastRulers ||= [];
    n.pastRulers.unshift({ name: n.ruler, from: n.reignStart ?? 1040, to: S.time.y, age: DY.age(n) });
    n.ruler = name; n.reignStart = S.time.y; n.rulerTitle = null;
    n.rulerBorn = S.time.y - (28 + Math.floor(G.rng() * 15));
    n.rulerSk = skills(); n.rulerSk.mil = Math.max(n.rulerSk.mil, 4);
    const h = HIST[n.tag];
    if (h) { const i = h.next.indexOf(name); if (i >= 0) n.histIdx = Math.max(n.histIdx || 0, i + 1); }
    if (n.heir && n.heir.name === name) n.heir = null;
    if (!n.heir || (h && n.heir.hist)) n.heir = DY.makeHeir(n, 0, 12);
    if (n.tag === S.player) G.log(`${name} tahta çıktı.`, 'good', [n.tag]);
    G.labelsDirty = true;
  };

  // ------------------------------------------------------------ hanedan evlilikleri
  DY.canMarry = function (a, b) {
    const S = G.S, na = S.nations[a], nb = S.nations[b];
    if (!nb || !nb.alive) return [false, 'Bu ülke yok.'];
    if (na.marriages.has(b)) return [false, 'Zaten akrabayız.'];
    if (na.enemies.has(b)) return [false, 'Savaştayız.'];
    if (na.religion !== nb.religion && !(G.RELIGIONS[na.religion] && ['katolik', 'ortodoks'].includes(na.religion) && ['katolik', 'ortodoks'].includes(nb.religion)))
      return [false, 'Farklı dinden hanedanlar evlenmez.'];
    if (na.marriages.size >= 4) return [false, 'En fazla 4 hanedan evliliği yapılabilir.'];
    const op = G.dip.opinion(b, a);
    if (op < 25) return [false, `İlişki yetersiz (${Math.round(op)} / 25 gerekli).`];
    return [true, 'Kabul ederler. İlişki +30; varissiz ölümde taht akrabaya geçebilir.'];
  };
  DY.marry = function (a, b) {
    const S = G.S;
    S.nations[a].marriages.add(b); S.nations[b].marriages.add(a);
    G.dip.add(a, b, 30);
    G.log(`${S.nations[a].name} ile ${S.nations[b].name} hanedanları evlilikle birleşti.`, 'good', [a, b]);
  };
  DY.aiMarry = function (n) {
    if (n.marriages.size >= 2) return;
    const nb = [...(G.ai.neighbors()[n.tag] || [])].filter(t => G.S.nations[t] && G.S.nations[t].alive && t !== G.S.player);
    const c = nb.find(t => DY.canMarry(n.tag, t)[0] && DY.canMarry(t, n.tag)[0]);
    if (c) DY.marry(n.tag, c);
  };
})();
