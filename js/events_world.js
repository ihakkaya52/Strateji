// Dünya geneli tarihî olaylar (1040-1120): odak ağacı olmayan ülkelerde de tarih işler.
// Kural: oyuncu adına asla savaş açılmaz (oyuncuya yalnızca savaş gerekçesi verilir); oyuncuya karşı savaş açılabilir.
'use strict';

(function () {
  const at = (y, m, d) => ({ y, m: m - 1, d });
  const N = t => G.S.nations[t];
  const alive = t => !!(N(t) && N(t).alive);
  const isPlayer = t => G.S.player === t;
  const own = t => G.S.provinces.filter(p => p.owner === t);
  const byName = name => G.S.provinces.find(p => p.name === name);
  const muslim = t => alive(t) && G.rel.family(N(t).religion) === 'islam';

  // a, b'ye savaş açar; a oyuncuysa yalnızca savaş gerekçesi kazanır
  const war = (a, b) => {
    if (!alive(a) || !alive(b) || G.sameRealm(a, b) || G.atWar(a, b)) return;
    if (isPlayer(a)) { N(a).claims.add(b); return; }
    N(a).truces[b] = 0; N(b).truces[a] = 0;
    G.declareWar(a, b, true);
  };
  const armies = (t, k, men, pid, name) => {
    const n = N(t);
    const spawn = pid != null ? pid : G.spawnPoint(t);
    if (spawn == null) return;
    for (let i = 0; i < k; i++) {
      const a = G.createArmy(t, spawn, men);
      a.gear = G.econ.need(a);
      if (name) a.name = `${name} ${i + 1}`;
    }
    n.armyTarget = Math.max(n.armyTarget || 0, G.nationStats(t).armies);
  };
  const setRuler = (t, name, born, dyn) => {
    const n = N(t);
    if (!n || n.ruler === name) return;
    (n.pastRulers ||= []).unshift({ name: n.ruler, from: n.reignStart ?? 1040, to: G.S.time.y, age: G.dyn.age(n) });
    n.ruler = name; n.rulerBorn = born; n.reignStart = G.S.time.y; n.rulerTitle = null; n.regency = 0;
    if (dyn) n.dynasty = dyn;
    if (!n.heir || n.heir.born <= born) n.heir = G.dyn.makeHeir(n, 0, 14);
  };
  // bir ülkenin illeri (adıyla) başka bir ülkeye geçer
  const cede = (from, to, names) => {
    let k = 0;
    for (const p of G.S.provinces) {
      if (p.owner !== from || (names && !names.includes(p.name) && !names.includes(p.home))) continue;
      G.transferProvince(p.id, to); p.core = to; p.conquered = G.S.hour; k++;
    }
    G.evacuateArmies(); G.checkElimination();
    return k;
  };
  // olaydan doğan yeni devlet (eski sahibiyle savaşta başlar)
  const newState = (tag, def, cities, from, k, culture) => {
    const S = G.S;
    const n = G.addNation(tag, def);
    let cap = null;
    for (const c of cities) for (const p of G.cityAndRural(c)) {
      if (p.owner !== from) continue;
      G.transferProvince(p.id, tag); p.core = tag;
      if (cap == null && p.name === c) cap = p.id;
    }
    if (cap == null) { n.alive = false; return null; }
    n.capital = cap; n.manpower = 18000; n.gold = 150; n.stability = 60;
    n.culture = culture; n.cultPolicy = 'ilimli'; n.assimilators = 1; n.assims = [];
    G.tech.init();
    G.evacuateArmies();
    armies(tag, k, 10000, cap);
    G.command.organize(tag);
    G.declareWar(tag, from, true);
    return n;
  };

  const EV = [
    // ------------------------------------------------------------ İskandinavya ve Britanya
    { id: 'hardrada', date: at(1047, 10, 25), title: 'Harald Hardrada Norveç Tahtında',
      cond: () => alive('NOR'),
      text: 'İyi Magnus öldü. Bizans\'ta Varang muhafızı olarak servet toplayan amcası Harald Sigurdsson, "Sert Hükümdar", Norveç\'in tek kralı oldu. Danimarka tacını da istiyor: on yedi yıl sürecek bir savaş başlıyor.',
      who: ['NOR', 'DEN', 'SWE', 'ENG'],
      effect: () => { setRuler('NOR', 'Harald Hardrada', 1015, 'Hårfagre'); N('NOR').atkMult += 0.08; war('NOR', 'DEN'); },
      options: ['Kuzeyin son vikingi'] },
    { id: 'lumphanan', date: at(1057, 8, 15), title: 'Lumphanan: Macbeth\'in Sonu',
      cond: () => alive('SCO'),
      text: 'Kral Macbeth, Duncan\'ın oğlu Malcolm\'a karşı Lumphanan\'da düştü. Malcolm Canmore İskoçya tahtında; sarayı İngiliz ve Sakson etkisine açılıyor.',
      who: ['SCO', 'ENG'],
      effect: () => { setRuler('SCO', 'III. Malcolm', 1031, 'Dunkeld'); N('SCO').stability = Math.max(0, (N('SCO').stability ?? 60) - 5); },
      options: ['Yaşasın Canmore'] },

    // ------------------------------------------------------------ Rus ve bozkır
    { id: 'yaroslav', date: at(1054, 2, 20), title: 'Bilge Yaroslav Öldü',
      cond: () => alive('KIE') && !isPlayer('KIE'),
      text: 'Bilge Yaroslav öldü. Vasiyetine göre oğulları kıdem sırasıyla hüküm sürecek: İzyaslav Kiev\'de, Svyatoslav Çernigov\'da, Vsevolod Pereyaslavl\'da. Kiev Rus\'unun birliği gevşiyor.',
      who: ['KIE', 'PLT', 'BYZ', 'POL'],
      effect: () => {
        setRuler('KIE', 'I. İzyaslav', 1024, 'Rurik');
        N('KIE').stability = Math.max(0, (N('KIE').stability ?? 60) - 15);
        if (N('PLT') && N('PLT').overlord === 'KIE') G.vassal.mod('PLT', -25, 'Yaroslav\'ın ölümü', 6);
      },
      options: ['Kardeşler arasında bölünen miras'] },
    { id: 'alta', date: at(1068, 9, 1), title: 'Alta Bozgunu',
      cond: () => alive('KIE') && alive('KIP') && ((G.ai.neighbors()['KIP'] || new Set()).has('KIE')),
      text: 'Kumanlar (Kıpçaklar) Alta ırmağı kıyısında Yaroslav\'ın oğullarının birleşik ordusunu bozguna uğrattı. Kiev halkı ayaklandı; bozkırdan yeni bir tehdit yükseliyor.',
      who: ['KIE', 'KIP'],
      effect: () => { for (const a of G.S.armies) if (a.tag === 'KIE') a.men = Math.round(a.men * 0.7); war('KIP', 'KIE'); },
      options: ['Bozkırın yeni efendileri'] },

    // ------------------------------------------------------------ Doğu ve Güneydoğu Asya
    { id: 'thaton', date: at(1057, 3, 1), title: 'Anawrahta Thaton\'u Fethetti',
      cond: () => alive('PAG') && alive('THT') && !isPlayer('PAG'),
      text: 'Pagan kralı Anawrahta, Mon başkenti Thaton\'u kuşatıp aldı. Mon rahipleri, yazıcıları ve Pali kutsal kitapları Pagan\'a taşındı; Theravada Budizmi Burma\'nın dini oluyor.',
      who: ['PAG', 'THT'],
      effect: () => {
        if (isPlayer('THT')) { war('PAG', 'THT'); armies('PAG', 2, 10000); }
        else { cede('THT', 'PAG'); N('PAG').researchMult = (N('PAG').researchMult ?? 1) + 0.05; }
      },
      options: ['Altın Pagodalar Ülkesi'] },
    { id: 'wanganshi', date: at(1069, 3, 1), title: 'Wang Anshi\'nin Yeni Yasaları',
      cond: () => alive('SNG'),
      text: 'İmparator Shenzong, başvezir Wang Anshi\'ye Yeni Yasaları uygulama yetkisi verdi: köylülere devlet kredisi, ordu için köy milisleri (baojia), ticarete devlet tekeli. Hazine doluyor, ama saray ikiye bölündü.',
      who: ['SNG', 'LIA', 'XIA', 'DAI'],
      effect: () => { const n = N('SNG'); n.taxMult = (n.taxMult ?? 1) + 0.1; n.mpMult += 0.1; n.stability = Math.max(0, (n.stability ?? 60) - 6); },
      options: ['Reformlar sürecek'] },
    { id: 'jin', date: at(1115, 1, 28), title: 'Jin Hanedanı Kuruldu',
      cond: () => alive('JUR') && alive('LIA'),
      text: 'Cürçen beyi Wanyan Aguda kendini imparator ilan etti ve hanedanına "Jin" (Altın) adını verdi. Liao\'ya haraç ödeyen ormanlı boylar, efendilerine karşı ayaklanıyor. Hurdagu\'da Liao ordusu dağıtıldı.',
      who: ['JUR', 'LIA', 'SNG', 'GOR'],
      effect: () => {
        const n = N('JUR');
        n.name = 'Jin Hanedanı'; setRuler('JUR', 'Wanyan Aguda', 1068, 'Wanyan');
        n.atkMult += 0.25; n.orgMult += 0.1; n.major = true;
        armies('JUR', 4, 12000, null, 'Cürçen Süvarisi');
        if (isPlayer('JUR')) { N('JUR').claims.add('LIA'); return; }
        if (n.overlord === 'LIA') G.declareIndependence('JUR'); else war('JUR', 'LIA');
        for (const a of G.S.armies) if (a.tag === 'LIA') a.men = Math.round(a.men * 0.75);
        G.labelsDirty = true;
      },
      options: ['Altın İmparatorluk'] },

    // ------------------------------------------------------------ Murâbıtlar (Mağrib ve Endülüs)
    { id: 'murabit', date: at(1053, 1, 1), title: 'Murâbıtların Yükselişi',
      cond: () => alive('LAM'),
      text: 'Sahra\'nın Lemtûne boyları, fakih Abdullah bin Yâsîn\'in ribâtında sıkı bir Mâlikî disiplini altında toplandı. "Murâbıtlar" Sicilmâse\'ye yürüyor; Mağrib\'in Zenâte beyliklerinin sonu geliyor.',
      who: ['LAM', 'MAG', 'HAM', 'ZIR', 'GHA'],
      effect: () => {
        const n = N('LAM');
        n.name = 'Murâbıtlar'; setRuler('LAM', 'Ebû Bekir bin Ömer', 1020, 'Lemtûne');
        n.atkMult += 0.15; n.mpMult += 0.15;
        armies('LAM', 3, 11000, null, 'Murâbıt Ordusu');
        war('LAM', 'MAG');
        G.labelsDirty = true;
      },
      options: ['Ribâtın askerleri'] },
    { id: 'marakes', date: at(1070, 5, 1), title: 'Merakeş\'in Kuruluşu',
      cond: () => alive('LAM') && own('LAM').some(p => ['Ağmat', 'Fas', 'Sicilmâse', 'Sûs-i Aksâ'].includes(p.name)),
      text: 'Yûsuf bin Tâşfîn, Atlas dağlarının eteğinde yeni bir başkent kurdu: Merakeş. Murâbıtlar artık bir bozkır konfederasyonu değil, Mağrib\'in hükümdarı.',
      who: ['LAM', 'MAG'],
      effect: () => {
        setRuler('LAM', 'Yûsuf bin Tâşfîn', 1009, 'Lemtûne');
        const p = byName('Ağmat'); if (p && p.owner === 'LAM') N('LAM').capital = p.id;
        N('LAM').stability = Math.min(100, (N('LAM').stability ?? 60) + 10);
        G.labelsDirty = true;
      },
      options: ['Merakeş\'in kırmızı surları'] },
    { id: 'gana', date: at(1076, 1, 1), title: 'Kumbi Salih Seferi',
      cond: () => alive('LAM') && alive('GHA'),
      text: 'Murâbıtlar Gana İmparatorluğu\'nun altın başkenti Kumbi Salih\'e yürüyor. Sahra ötesi altın yolu kimin elinde olacak?',
      who: ['LAM', 'GHA', 'GAO'],
      effect: () => { for (const a of G.S.armies) if (a.tag === 'GHA') a.men = Math.round(a.men * 0.6); war('LAM', 'GHA'); },
      options: ['Altın ülkesi'] },
    { id: 'toledo', date: at(1085, 5, 25), title: 'Toledo\'nun Düşüşü',
      cond: () => alive('LEO') && alive('TUL'),
      text: 'VI. Alfonso, Vizigotların eski başkenti Toledo\'ya girdi. Endülüs\'ün kalbindeki tâifa düştü; diğer tâifa emîrleri Mağrib\'deki Murâbıtlardan yardım istiyor.',
      who: ['LEO', 'TUL', 'SEV', 'BTL', 'ZAR', 'LAM'],
      effect: () => {
        if (isPlayer('TUL')) { war('LEO', 'TUL'); armies('LEO', 2, 11000); return; }
        cede('TUL', 'LEO');
        N('LEO').stability = Math.min(100, (N('LEO').stability ?? 60) + 8);
      },
      options: ['Reconquista ilerliyor'] },
    { id: 'zallaka', date: at(1086, 10, 23), title: 'Zallâka',
      cond: () => alive('LAM') && alive('LEO') && own('LAM').some(p => ['Sebte', 'Tanca', 'Fas'].includes(p.name)),
      text: 'Yûsuf bin Tâşfîn Cebelitarık\'ı geçti; tâifa emîrleriyle birlikte Badajoz yakınlarındaki Zallâka\'da (Sagrajas) VI. Alfonso\'yu ağır bir yenilgiye uğrattı. Endülüs Murâbıtlara bakıyor.',
      who: ['LAM', 'LEO', 'SEV', 'GRN', 'BTL'],
      effect: () => {
        for (const a of G.S.armies) if (a.tag === 'LEO') a.men = Math.round(a.men * 0.6);
        const sebte = byName('Sebte');
        armies('LAM', 2, 12000, sebte && sebte.owner === 'LAM' ? sebte.id : null, 'Murâbıt Seferi');
        for (const t of ['SEV', 'GRN', 'BTL', 'MRY']) if (alive(t)) G.dip.add('LAM', t, 30);
      },
      options: ['Endülüs\'ün kurtarıcıları'] },
    { id: 'tavaif', date: at(1091, 6, 1), title: 'Tâifaların Sonu',
      cond: () => alive('LAM') && own('LAM').some(p => ['Sebte', 'Tanca', 'Fas', 'Ağmat'].includes(p.name)),
      text: 'Fakihlerin fetvasıyla Yûsuf bin Tâşfîn, Hristiyanlara haraç ödeyen tâifa emîrlerini tahttan indirdi. Sevilla, Granada, Almería ve Badajoz Murâbıt valilerine geçti. Şair-kral Mu\'temid, Ağmat\'ta sürgünde.',
      who: ['LAM', 'SEV', 'GRN', 'MRY', 'BTL', 'LEO'],
      effect: () => {
        for (const t of ['SEV', 'GRN', 'MRY', 'BTL', 'KUR']) {
          if (!alive(t) || G.sameRealm(t, G.S.player)) continue;
          if (isPlayer(t)) { war('LAM', t); continue; }
          cede(t, 'LAM');
        }
        G.labelsDirty = true;
      },
      options: ['Endülüs Murâbıt oldu'] },

    // ------------------------------------------------------------ Normanlar güneyde
    { id: 'melfi1059', date: at(1059, 8, 23), title: 'Melfi Antlaşması',
      cond: () => alive('NRM') && alive('PAP') && !isPlayer('PAP') && !N('NRM').overlord && !isPlayer('NRM'),
      text: 'Papa II. Nicolaus, Melfi\'de Robert Guiscard\'ı "Tanrı ve Aziz Petrus\'un lütfuyla Apulia ve Kalabria dükü, gelecekte Sicilya dükü" tanıdı. Normanlar artık papalığın vasalı.',
      who: ['NRM', 'PAP', 'BYZ', 'HRE'],
      effect: () => {
        if (G.atWar('NRM', 'PAP')) G.makePeace('NRM', 'PAP', false, '');
        N('NRM').overlord = 'PAP'; N('NRM').loyalty = 75; N('NRM').vassalSince = G.S.hour;
        N('NRM').name = 'Apulia ve Kalabria Dükalığı'; setRuler('NRM', 'Robert Guiscard', 1015, 'Hauteville');
        G.labelsDirty = true; G.mapDirty = true;
      },
      options: ['Papanın kılıcı'] },
    { id: 'sicilyafethi', date: at(1061, 5, 1), title: 'Normanlar Sicilya\'ya Geçti',
      cond: () => alive('NRM') && alive('SIC'),
      text: 'Kont Roger, Messina boğazını geçti. Kalbî emîrleri arasındaki iç savaş Normanlara kapıyı açtı; otuz yıl sürecek Sicilya fethi başlıyor.',
      who: ['NRM', 'SIC', 'ZIR', 'BYZ'],
      effect: () => { war('NRM', 'SIC'); if (!isPlayer('NRM')) armies('NRM', 1, 9000, null, 'Roger\'in Şövalyeleri'); },
      options: ['Sicilya Hristiyan olacak'] },
    { id: 'bari', date: at(1071, 4, 16), title: 'Bari Düştü',
      cond: () => alive('NRM') && alive('BYZ') && own('BYZ').some(p => ['Bari', 'Brindisi', 'Taranto', 'Otranto', 'Reggio'].includes(p.name)),
      text: 'Üç yıllık kuşatmanın sonunda Bizans İtalya\'sının son kalesi Bari, Robert Guiscard\'a teslim oldu. Beş asırlık Roma hâkimiyeti güney İtalya\'da sona erdi; aynı yıl doğuda Malazgirt yaşanıyor.',
      who: ['NRM', 'BYZ', 'PAP'],
      effect: () => {
        const names = ['Bari', 'Brindisi', 'Taranto', 'Otranto', 'Reggio', 'Cosenza', 'Rossano', 'Catanzaro'];
        if (isPlayer('BYZ')) { N('NRM').claims.add('BYZ'); war('NRM', 'BYZ'); armies('NRM', 2, 11000); return; }
        cede('BYZ', 'NRM', names);
      },
      options: ['Apulia Norman oldu'] },
    { id: 'dirac', date: at(1081, 6, 1), title: 'Guiscard Dıraç\'ta',
      cond: () => alive('NRM') && alive('BYZ') && !isPlayer('NRM'),
      text: 'Robert Guiscard ve oğlu Bohemond Adriyatik\'i geçip Dyrrakhion\'u kuşattı. Hedefleri Konstantinopolis tahtı; yeni imparator Aleksios Komnenos Venedik\'ten yardım istiyor.',
      who: ['NRM', 'BYZ', 'VEN'],
      effect: () => {
        const p = byName('Dyrrakhion');
        if (N('NRM').overlord) N('NRM').overlord = null;
        war('NRM', 'BYZ');
        armies('NRM', 3, 11000, p && p.owner === 'BYZ' ? p.id : null, 'Norman Seferi');
      },
      options: ['Normanlar Balkanlarda'] },
    { id: 'sicilya1091', date: at(1091, 2, 1), title: 'Sicilya\'nın Fethi Tamamlandı',
      cond: () => alive('NRM') && alive('SIC') && !isPlayer('SIC'),
      text: 'Noto\'nun teslimiyle son Müslüman kale de düştü. Kont Roger Sicilya\'nın efendisi; Arap, Rum ve Latin bir ada krallığının temelleri atıldı.',
      who: ['NRM', 'SIC', 'ZIR', 'PAP'],
      effect: () => { cede('SIC', 'NRM'); },
      options: ['Sicilya Norman oldu'] },

    // ------------------------------------------------------------ Haçlı devletleri (Clermont çağrısı yapıldıysa)
    { id: 'urfa', date: at(1098, 3, 10), title: 'Urfa Kontluğu',
      cond: () => G.S.relFired && G.S.relFired.clermont && byName('Edessa') && muslim(byName('Edessa').owner),
      text: 'Boulogneli Baudouin, ordudan ayrılıp Fırat\'ın ötesine geçti; Ermeni hükümdar Toros onu evlat edindi ve öldürüldü. Doğudaki ilk Haçlı devleti kuruldu: Urfa Kontluğu.',
      who: ['SEL', 'BYZ', 'PAP', 'FAT', 'ABB'],
      effect: () => {
        const from = byName('Edessa').owner;
        newState('EDE', { name: 'Urfa Kontluğu', color: '#b89a7a', major: false, ruler: 'Boulogneli Baudouin', religion: 'katolik', group: 'latin' }, ['Edessa', 'Samosata'], from, 2, 'fransiz');
      },
      options: ['Deus vult!'] },
    { id: 'antakya', date: at(1098, 6, 3), title: 'Antakya Prinkepsliği',
      cond: () => G.S.relFired && G.S.relFired.clermont && byName('Antiokheia') && muslim(byName('Antiokheia').owner),
      text: 'Sekiz aylık kuşatmanın ardından bir Ermeni muhafızın açtığı kapıdan Haçlılar Antakya\'ya girdi. Tarantolu Bohemond şehri kendine aldı: Antakya Prinkepsliği.',
      who: ['SEL', 'BYZ', 'PAP', 'FAT', 'ABB'],
      effect: () => {
        const from = byName('Antiokheia').owner;
        newState('ANT', { name: 'Antakya Prinkepsliği', color: '#9a7a9a', major: false, ruler: 'Tarantolu Bohemond', religion: 'katolik', group: 'latin' }, ['Antiokheia', 'Laodikeia', 'Germanikeia'], from, 3, 'fransiz');
      },
      options: ['Deus vult!'] },
    { id: 'kudus', date: at(1099, 7, 15), title: 'Kudüs\'ün Fethi',
      cond: () => G.S.relFired && G.S.relFired.clermont && byName('Kudüs') && muslim(byName('Kudüs').owner),
      text: '15 Temmuz 1099: Haçlılar kuşatma kulelerinden surlara atladı ve Kudüs\'e girdi. Şehir kana bulandı. Bouillonlu Godefroy, Kurtarıcının diken tacını taşıdığı şehirde altın taç giymeyi reddetti ve "Kutsal Kabrin Koruyucusu" unvanını aldı.',
      who: ['FAT', 'SEL', 'BYZ', 'PAP', 'ABB', 'HRE', 'FRA'],
      effect: () => {
        const from = byName('Kudüs').owner;
        const k = newState('KUD', { name: 'Kudüs Krallığı', color: '#c8b8a0', major: false, ruler: 'Bouillonlu Godefroy', religion: 'katolik', group: 'latin' }, ['Kudüs', 'Remle', 'Taberiye', 'Akka'], from, 4, 'fransiz');
        if (!k) return;
        for (const t of ['ANT', 'EDE']) if (alive(t) && !G.dip.allied('KUD', t)) G.dip.ally('KUD', t);
        for (const o of Object.values(G.S.nations)) if (o.alive && o.religion === 'katolik' && o.tag !== 'KUD') G.dip.add('KUD', o.tag, 40);
      },
      options: ['Kudüs Krallığı'] },
  ];
  for (const e of EV) { e.options ||= ['Tamam']; G.events.list.push(e); }
})();
