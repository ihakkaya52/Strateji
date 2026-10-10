// Tarihî ve kurgusal olaylar (HOI4 tarzı olay pencereleri)
'use strict';

G.events = {};

const at = (y, m, d) => ({ y, m: m - 1, d });
const reached = (t, e) => t.y > e.y || (t.y === e.y && (t.m > e.m || (t.m === e.m && t.d >= e.d)));

// Olaydan doğan yeni ülke
function spawnRebel(tag, def, cityNames, from, armies) {
  const S = G.S;
  const n = G.addNation(tag, def);
  let cap = null;
  for (const c of cityNames) {
    for (const p of G.cityAndRural(c)) {
      if (p.owner !== from) continue;
      G.transferProvince(p.id, tag);
      if (cap == null && p.name === c) cap = p.id;
    }
  }
  if (cap == null) { n.alive = false; return null; }
  n.capital = cap;
  n.manpower = 15000;
  n.armyTarget = armies;
  // bu topraklardaki eski sahibin ordularını geri çek
  G.evacuateArmies();
  const provs = S.provinces.filter(p => p.owner === tag && p.kind !== 'rural');
  for (let i = 0; i < armies; i++) {
    const a = G.createArmy(tag, (i === 0 ? S.provinces[cap] : G.pick(provs)).id);
    a.gear = G.econ.need(a);   // isyancılar silahlarıyla gelir
  }
  G.declareWar(tag, from, true);
  return n;
}

G.events.list = [
  {
    // Yapay zekâ Selçukluları erken bir talihsizlikle çökmesin diye Dandanakan tarihî sonucuyla işlenir
    // (Selçuklu ya da Gazneli oyuncunun elindeyse savaşı kendisi kazanmalı).
    id: 'dandanakan',
    date: at(1040, 5, 23),
    cond: S => S.player !== 'SEL' && S.player !== 'GAZ' && S.nations.SEL && S.nations.SEL.alive && S.nations.GAZ && S.nations.GAZ.alive &&
      (G.atWar('SEL', 'GAZ') || window.WORLD.provinces.some(p => p.owner === 'SEL' && S.provinces[p.id].owner === 'GAZ')),
    title: 'Dandanakan',
    text: 'Merv ile Serahs arasındaki susuz çölde üç gün süren muharebenin sonunda Gazneli Sultan Mesud\'un fillerle desteklenen ordusu ' +
      'Tuğrul ve Çağrı Beylerin Türkmen atlılarına yenildi. Horasan artık Selçukluların; Mesud Hindistan\'a çekiliyor.',
    who: ['SEL', 'GAZ', 'ABB', 'BUY'],
    effect: S => {
      const home = new Set(window.WORLD.provinces.filter(p => p.owner === 'SEL').map(p => p.name));
      for (const p of S.provinces) if (home.has(p.name) && p.owner !== 'SEL' && (p.owner === 'GAZ' || p.ctrl === 'GAZ')) G.transferProvince(p.id, 'SEL');
      for (const a of S.armies) if (a.tag === 'GAZ') { a.men = Math.round(a.men * 0.6); a.org = Math.min(a.org, 30); }
      if (G.atWar('SEL', 'GAZ')) G.makePeace('SEL', 'GAZ', false, 'Dandanakan\'dan sonra Gazneliler Horasan\'ı Selçuklulara bıraktı.');
      S.nations.SEL.truces.GAZ = S.nations.GAZ.truces.SEL = S.hour + 5 * 24 * 365;
      // Selçuklu yeniden toparlanacak kadar asker toplar
      const N = S.nations.SEL;
      N.manpower = Math.max(N.manpower, 20000);
      while (S.armies.filter(a => a.tag === 'SEL').length < 4) { const a = G.createArmy('SEL', N.capital); a.gear = G.econ.need(a); }
    },
    options: ['Horasan Selçukluların!'],
  },
  {
    id: 'macbeth',
    date: at(1040, 8, 14),
    cond: S => S.nations.SCO && S.nations.SCO.alive,
    title: 'Macbeth Tahta Çıkıyor',
    text: 'Moray mormaeri Macbeth, Kral Duncan\'ı Pitgaveny yakınlarında savaşta öldürdü. İskoçya tacı artık onun.',
    who: ['SCO', 'DEN', 'NOR'],
    effect: S => { S.nations.SCO.ruler = 'Macbeth'; },
    options: ['Yaşasın Kral Macbeth!'],
  },
  {
    id: 'delyan',
    date: at(1040, 9, 1),
    cond: S => S.nations.BYZ && S.nations.BYZ.alive && G.cityAndRural('Belgrad').some(p => p.owner === 'BYZ'),
    title: 'Petar Delyan Ayaklanması',
    text: 'Çar Samuil\'in torunu olduğunu iddia eden Petar Delyan, Belgrad\'da Bulgar çarı ilan edildi. ' +
      'Bizans\'ın ağır vergilerinden bıkan Bulgarlar akın akın sancağının altına toplanıyor.',
    who: ['BYZ', 'BUL', 'HUN', 'PEC'],
    effect: S => {
      spawnRebel('BUL', {
        name: 'Bulgar Çarlığı (Delyan)', color: '#3f7f4a', major: false,
        ruler: 'Petar Delyan', religion: 'ortodoks', group: 'slav',
      }, ['Belgrad', 'Niş', 'Skopje', 'Ras', 'Serdika', 'Vidin', 'Ohri'], 'BYZ', 5);
    },
    options: ['İsyan bastırılmalı!'],
    playerOptions: {
      BUL: ['Bulgaristan yeniden doğuyor!'],
    },
  },
  {
    id: 'melfi',
    date: at(1041, 3, 15),
    cond: S => S.nations.BYZ && G.cityAndRural('Melfi').some(p => p.owner === 'BYZ'),
    title: 'Normanlar Melfi\'de',
    text: 'Demir Kol William ve kardeşleri önderliğindeki Norman paralı askerler Bizans\'a karşı ayaklanıp ' +
      'Melfi\'yi ele geçirdi. Güney İtalya\'da yeni bir güç doğuyor.',
    who: ['BYZ', 'SAL', 'NRM', 'PAP', 'BEN', 'NAP'],
    effect: S => {
      spawnRebel('NRM', {
        name: 'Apulia Normanları', color: '#5b5ea6', major: false,
        ruler: 'Demir Kol William', religion: 'katolik', group: 'iskandinav',
      }, ['Melfi', 'Troia'], 'BYZ', 4);
      // Norman şövalyeleri sayıca az ama çağın en iyi ağır süvarisi (Olivento ve Montemaggiore, 1041)
      const N = S.nations.NRM;
      if (N && N.alive) { N.atkMult += 0.35; N.defMult += 0.25; N.orgMult += 0.2; N.manpower = 25000; }
      // Olivento, Montemaggiore ve Montepeloso (1041): Bizans'ın İtalya ordusu üç kez bozuldu ve imparatorluk
      // Delyan isyanı ile saray kavgaları arasında Normanlarla uğraşamadı. Bizans'ı yapay zekâ yönetiyorsa
      // Normanlar Melfi kontluğunu korur; Bizans'ı oynayan oyuncu ise savaşı sürdürebilir.
      if (N && N.alive && S.player !== 'BYZ' && G.atWar('NRM', 'BYZ')) {
        G.makePeace('NRM', 'BYZ', false, 'Bizans, Melfi\'deki Norman kontluğunu şimdilik tanımak zorunda kaldı.');
        const until = S.hour + 18 * 24 * 365;   // Melfi antlaşmasına (1059) kadar
        N.truces.BYZ = until; S.nations.BYZ.truces.NRM = until;
        // Normanların gözü Lombard prensliklerinde (Salerno 1077, Benevento, Napoli)
        for (const t of ['SAL', 'BEN', 'NAP']) if (S.nations[t] && S.nations[t].alive) N.claims.add(t);
      }
      for (const p of S.provinces) if (p.owner === 'NRM' && p.kind !== 'rural') { p.fort = Math.max(p.fort || 0, 2); p.walls = 100; }
    },
    options: ['Bu barbarlar Apulia\'dan atılacak!'],
  },
  {
    id: 'schism',
    date: at(1054, 7, 16),
    cond: () => true,
    title: 'Büyük Ayrılık',
    text: 'Kardinal Humbert, Ayasofya\'nın sunağına Patrik Mihail Kerularios\'u aforoz eden bulla\'yı bıraktı. ' +
      'Roma ve Konstantinopolis kiliseleri artık resmen ayrıldı.',
    who: ['BYZ', 'PAP', 'HRE', 'FRA', 'KIE'],
    effect: () => {},
    options: ['Hristiyan dünyası ikiye bölündü.'],
  },
];

G.events.check = function () {
  const S = G.S;
  for (const e of G.events.list) {
    if (S.firedEvents.has(e.id) || !reached(S.time, e.date)) continue;
    S.firedEvents.add(e.id);
    if (!e.cond(S)) continue;
    e.effect(S);
    G.mapDirty = true; G.labelsDirty = true;
    if (e.who.includes(S.player)) {
      const opts = (e.playerOptions && e.playerOptions[S.player]) || e.options;
      G.ui.showEvent(e.title, e.text, opts.map(o => ({ text: o })));
    } else {
      G.log(`${e.title}: ${e.text.split('.')[0]}.`, 'info', e.who);
    }
  }
};
