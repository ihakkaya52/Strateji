// Tarihî odak ağaçları (3): Kutsal Roma İmparatorluğu ve Papalık.
// İki ağaç birbirine bağlıdır: Sutri, Worms, aforoz, Canossa ve Roma'nın yağması karşı tarafın oyuncusuna da duyurulur.
'use strict';

(function () {
  const { E, F, mutex, finish, byName, nm, alive } = G.focusKit;
  const YEAR = 24 * 365;

  // ------------------------------------------------------------ bu ağaçlara özel etkiler
  const X = {
    catholic: v => ({ text: `Bütün Katolik ülkelerle ilişki ${v > 0 ? '+' : ''}${v}`, fn: n => {
      for (const o of Object.values(G.S.nations)) if (o.alive && o.tag !== n.tag && o.religion === 'katolik') G.dip.add(n.tag, o.tag, v);
    } }),
    calmCul: (cul, label) => ({ text: `${label}: huzursuzluk biter`, fn: n => { for (const p of G.S.provinces) if (p.owner === n.tag && p.cul === cul) p.unrest = 0; } }),
    // aforoz: hedef ülkenin istikrarı çöker, Katolik dünya ondan yüz çevirir
    excommunicate: tag => ({ text: `${nm(tag)} hükümdarı aforoz edilir: istikrarı −15, Katoliklerle ilişkisi −30`, fn: n => {
      const t = G.S.nations[tag];
      if (!t || !t.alive || t.religion !== 'katolik') return;
      t.stability = Math.max(0, (t.stability ?? 60) - 15);
      t.excommunicated = G.S.hour;
      for (const o of Object.values(G.S.nations)) if (o.alive && o.tag !== tag && o.religion === 'katolik') G.dip.add(tag, o.tag, -30);
      G.log(`Papa ${t.ruler}'i aforoz etti! Tebaası sadakat yemininden kurtuldu.`, 'war', [n.tag, tag]);
    } }),
    // karşı kral: Saksonya ayaklanır (Rudolf von Rheinfelden)
    antiking: () => ({ text: 'Sakson prensleri karşı kral seçer: Saksonya ayaklanır', fn: () => {
      const S = G.S, p = byName('Magdeburg');
      if (!p || p.owner !== 'HRE' || p.ctrl !== 'HRE' || !S.nations.HRE.alive) return;
      G.stab.revolt(p, 'Rudolf\'un Krallığı');
      // Saksonya'nın geri kalanı da karşı krala katılır (kendi kültürümüzden olduğu için isyan kendiliğinden yayılmaz)
      const rebel = p.owner;
      if (rebel === 'HRE') return;
      for (const name of ['Goslar', 'Merseburg', 'Meissen', 'Erfurt']) {
        const q = byName(name);
        if (q && q.owner === 'HRE' && q.ctrl === 'HRE') { G.transferProvince(q.id, rebel); q.unrest = 0; q.garrison = 0; }
      }
      G.evacuateArmies(); G.labelsDirty = true; G.mapDirty = true;
      G.log('Forchheim\'da toplanan prensler Rheinfeldenli Rudolf\'u karşı kral seçti!', 'war', ['HRE', 'PAP']);
    } }),
    // kutsal sefer (bedelsiz), yalnızca başka dindense ve zaten bir seferde değilsek
    holy: pick => ({ text: pick.text, fn: n => {
      const tag = pick.tag(n);
      if (!tag || !alive(tag) || G.rel.activeOf(n.tag) || n.overlord) return;
      if (G.rel.family(G.S.nations[tag].religion) === G.rel.family(n.religion)) return;
      G.rel.call(n.tag, tag, { free: true });
    } }),
    regency: (years, label) => ({ text: `${label} naipliği (${years} yıl)`, fn: n => { n.regency = G.S.hour + years * YEAR; } }),
    // vasal: savaştaysak önce barış
    forceVassal: tag => ({ text: `${nm(tag)} (ayaktaysa) vasalımız olur; savaştaysak barışla`, fn: n => {
      const v = G.S.nations[tag];
      if (!v || !v.alive || v.overlord || G.sameRealm(tag, n.tag)) return;
      if (G.atWar(n.tag, tag)) G.makePeace(n.tag, tag, false, `${v.name} ${n.name} ile barış yaptı ve ona biat etti.`);
      if (G.atWar(n.tag, tag)) return;
      v.overlord = n.tag; G.labelsDirty = true;
      G.log(`${v.name} artık ${n.name} himayesinde.`, 'good', [n.tag, tag]);
    } }),
    silver: () => ({ text: 'Rammelsberg gümüşü: Goslar\'da maden +2, +200 altın', fn: n => {
      const p = byName('Goslar');
      if (p && p.owner === n.tag) p.mine = (p.mine || 0) + 2;
      n.gold += 200;
    } }),
    // Civitate: papalık ordusu bozulur (savaş açılmaz; yenilgi tarihî sonucuyla işlenir)
    civitate: () => ({ text: 'Papalık ordularının yarısı Civitate\'de dağılır', fn: n => {
      for (const a of G.S.armies) if (a.tag === n.tag) a.men = Math.round(a.men * 0.5);
      G.log('Civitate: Normanlar papalık ordusunu bozdu, Papa IX. Leo esir düştü.', 'war', [n.tag, 'NRM']);
    } }),
    clermont: () => ({ text: 'Kudüs Müslümanların elindeyse bütün Hristiyan âlemine Haçlı çağrısı', fn: n => {
      const S = G.S, p = byName('Kudüs');
      S.relFired ||= {};
      if (!p || !p.owner || G.rel.family(S.nations[p.owner].religion) !== 'islam' || G.rel.activeOf(n.tag)) return;
      S.relFired.clermont = true;
      G.log('Papa Clermont\'da Hristiyan âlemini Kudüs\'ü kurtarmaya çağırdı: "Deus vult!"', 'war', [n.tag, p.owner]);
      G.rel.call(n.tag, p.owner, { free: true });
    } }),
  };
  // İberya'daki en güçlü Müslüman ülke (Reconquista hedefi)
  const iberianMuslim = () => {
    const c = {};
    for (const p of G.S.provinces) {
      if (!p.owner || p.x < -10 || p.x > 3.5 || p.y > -36 || p.y < -44) continue;
      const o = G.S.nations[p.owner];
      if (o && o.alive && G.rel.family(o.religion) === 'islam') c[p.owner] = (c[p.owner] || 0) + 1;
    }
    return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || null;
  };
  const ownerOf = name => () => { const p = byName(name); return p && p.owner; };

  // ================================================================ KUTSAL ROMA İMPARATORLUĞU
  const HRE = [
    F('hre_heinrich', 5, 0, 'III. Heinrich\'in Tahtı', 'crown', 1040,
      '1039: Salier hanedanından II. Konrad öldü; oğlu III. Heinrich Almanya, İtalya ve Burgonya taçlarını tek başında taşıyor. Dindar, sert ve kudretli: imparatorluğun zirvesi.',
      [E.stab(5), E.gold(150), E.envoy()]),
    F('hre_bohemya', 2, 1, 'Bohemya\'yı Diz Çöktür', 'sword', 1041,
      '1041: Dük Břetislav Polonya\'yı yağmalayıp Gniezno\'dan Aziz Adalbert\'in kemiklerini Prag\'a taşıdı. Heinrich ikinci seferinde Prag önlerine dayandı; Břetislav Regensburg\'da diz çöktü.',
      [X.calmCul('cek', 'Çek illeri'), E.rel(['POL'], -20), E.atk(0.04)], ['hre_heinrich']),
    F('hre_landfriede', 5, 1, 'Konstanz Barış Ilanı', 'scroll', 1043,
      '1043: Heinrich Konstanz kürsüsünden bütün düşmanlarını affettiğini ilan etti ve tebaasından da aynısını istedi. Tanrı\'nın Barışı imparatorluğun barışı oluyor.',
      [E.stab(8), E.calm(null, 'Bütün ülke')], ['hre_heinrich']),
    F('hre_macar', 8, 1, 'Macar Seferi', 'spear', 1044,
      '1041\'de Macar soyluları Kral Péter\'i kovup Aba Samuel\'i tahta çıkardı. Péter imparatorun sarayına sığındı. 1044\'te Ménfő\'de Heinrich\'in şövalyeleri Macar ordusunu dağıttı.',
      [E.war('HUN'), E.armies(1, 'Bavyera Şövalyeleri')], ['hre_heinrich']),
    F('hre_godfrey', 2, 2, 'Sakallı Godfrey', 'shield', 1044,
      '1044: Yukarı ve Aşağı Lotaringiya\'yı birlikte isteyen Sakallı Godfrey imparatora başkaldırdı. Lotaringiya dükleri asırlar boyu imparatorların baş belası.',
      [E.def(0.05), E.forts(2), E.calm(['Liège', 'Verdun', 'Metz', 'Toul', 'Trier', 'Leuven'], 'Lotaringiya')], ['hre_bohemya']),
    F('hre_sutri', 5, 2, 'Sutri Sinodu', 'scroll', 1046,
      'Aralık 1046: Roma\'da üç papa birden var. Heinrich Sutri\'de bir sinod topladı; IX. Benedictus, III. Silvester ve VI. Gregorius azledildi. Papayı artık imparator seçecek.',
      [E.rel(['PAP'], 20), E.stab(5)], ['hre_landfriede'], { notify: { PAP: 'III. Heinrich Sutri\'de bir sinod topladı: Roma\'daki üç papanın üçü de azledilecek!' } }),
    F('hre_peter', 7, 2, 'Péter\'i Vasal Kral Yap', 'banner', 1045,
      'Tarihî yol: Péter Székesfehérvár\'da tahtına yeniden oturdu ve 1045 Pentekost\'unda Macaristan\'ı imparatordan bir tımar olarak aldı. Macaristan imparatorluğun vasalı.',
      [X.forceVassal('HUN'), E.stab(3)], ['hre_macar'], { hist: true }),
    F('hre_macar_ilhak', 9, 2, 'Pannonia Markı', 'sword', 1045,
      'Alternatif tarih: Bir vasal kral yetmez. Macar ovası Bavyera\'nın doğusunda yeni bir imparatorluk markı olacak; Alman kontlar Esztergom\'a yerleşecek.',
      [E.cb(['HUN']), E.atk(0.08), E.siege(0.1), E.armies(1, 'Doğu Markı Ordusu')], ['hre_macar'], { alt: true }),
    F('hre_burgonya', 2, 3, 'Burgonya Tacı', 'crown', 1046,
      'Arles krallığı II. Konrad\'dan beri imparatorun elinde. Lyon, Besançon ve Provence kontları sadakatlerini tazeliyor.',
      [E.tax(0.05), E.calm(['Lyon', 'Vienne', 'Cenevre', 'Arles', 'Marsilya', 'Grenoble', 'Besançon', 'Nice'], 'Burgonya')], ['hre_godfrey']),
    F('hre_reformpapa', 4, 3, 'Reformcu Papalar', 'scroll', 1048,
      'Tarihî yol: Heinrich Alman piskoposları birer birer Roma\'ya gönderiyor: II. Clemens, II. Damasus, IX. Leo. Cluny\'nin ruhu Petrus\'un tahtına oturuyor. Ama bu papalar bir gün imparatora karşı dönecek.',
      [E.rel(['PAP'], 40), X.catholic(10), E.research(0.05)], ['hre_sutri'], { hist: true, notify: { PAP: 'İmparator Roma\'ya reformcu bir Alman piskopos gönderiyor. Kilise yozlaşmadan arınacak.' } }),
    F('hre_imparatorpapa', 6, 3, 'Papalık İmparatora Bağlı', 'crown', 1048,
      'Alternatif tarih: Patricius unvanı imparatora papayı seçme hakkını veriyor. Roma\'nın piskoposu artık imparatorluk sarayının bir piskoposu: sadık, uysal, bağımlı.',
      [X.forceVassal('PAP'), E.stab(5), E.rel(['PAP'], -30), X.catholic(-5)], ['hre_sutri'], { alt: true, notify: { PAP: 'İmparator papalığı kendi kilisesine bağlamak istiyor: Roma imparatorun vasalı olacak!' } }),
    F('hre_goslar', 9, 3, 'Rammelsberg Gümüşü', 'coin', 1046,
      'Harz dağlarındaki Rammelsberg madenleri Avrupa\'nın en zengin gümüş damarı. Salierler Goslar\'da görkemli bir imparatorluk sarayı kuruyor.',
      [X.silver(), E.tax(0.05)], ['hre_macar']),
    F('hre_italya', 1, 4, 'İtalya Seferi', 'spear', 1047,
      'İmparator Alpleri aşıyor: Lombardiya şehirleri, Toskana markgrafları ve güneyin Norman beyleri biat etmeli.',
      [E.calm(['Milano', 'Pavia', 'Torino', 'Verona', 'Padova', 'Bologna', 'Ravenna', 'Parma', 'Canossa', 'Floransa', 'Siena', 'Ancona', 'Spoleto'], 'İtalya krallığı'), E.armies(1, 'İtalya Ordusu'), E.speed(0.05)], ['hre_burgonya']),
    F('hre_1056', 5, 4, '1056: Çocuk Kral', 'crown', 1056,
      'Ekim 1056: III. Heinrich otuz dokuz yaşında Bodfeld\'de öldü. Altı yaşındaki oğlu IV. Heinrich kral; annesi Agnes naip. Prensler başını kaldırıyor.',
      [E.reign('IV. Heinrich', { born: 1050, dyn: 'Salier', sk: { adm: 3, dip: 2, mil: 4 } }), X.regency(9, 'Agnes de Poitou'), E.stab(-8)], null, { reqAny: ['hre_reformpapa', 'hre_imparatorpapa'] }),
    F('hre_ostsiedlung', 9, 4, 'Doğuya Göç', 'coin', 1050,
      'Ostsiedlung: Flaman ve Sakson köylüleri Elbe\'nin doğusundaki ormanları açıyor. Vend topraklarında yeni köyler, yeni kiliseler.',
      [E.mpm(0.1), E.cb(['ABO', 'LUT']), E.missionary()], ['hre_goslar']),
    F('hre_pataria', 1, 5, 'Milano\'da Pataria', 'banner', 1057,
      '1057: Milano\'nun yoksul halkı ve reformcu rahipleri, rüşvetçi ve evli başpiskoposlarına karşı ayaklandı. Lombard şehirleri kaynıyor.',
      [E.unrest(5), E.trade(0.08), E.research(0.03)], ['hre_italya']),
    F('hre_kaiserswerth', 5, 5, 'Kaiserswerth Darbesi', 'helm', 1062,
      'Nisan 1062: Köln Başpiskoposu Anno, genç kralı Ren\'deki bir gemiye çağırıp kaçırdı. Kral kendini nehre attı, kurtarıldı. Agnes manastıra çekildi; ülkeyi piskoposlar yönetiyor.',
      [E.stab(-3), E.research(0.05), E.envoy()], ['hre_1056']),
    F('hre_hamburg', 9, 5, 'Hamburg-Bremen Başpiskoposluğu', 'scroll', 1062,
      'Başpiskopos Adalbert "Kuzeyin papası" olmak istiyor: İskandinavya, İzlanda ve Vend toprakları onun misyonerlerine açılıyor.',
      [E.missionary(), E.rel(['DEN'], 20), E.trade(0.05)], ['hre_ostsiedlung']),
    F('hre_sakson', 5, 6, 'Sakson Ayaklanması', 'sword', 1073,
      '1073: Heinrich Harz dağlarına kaleler kurup Svabyalı ministerialleri yerleştirdi. Saksonlar ayaklandı; kral Harzburg\'dan gece kaçmak zorunda kaldı.',
      [E.stab(-5), E.calm(null, 'Bütün ülke')], ['hre_kaiserswerth']),
    F('hre_burgen', 9, 6, 'Harz Kaleleri', 'castle', 1068,
      'Harzburg, Hasenburg, Heimburg: kral Saksonya\'yı taş kalelerle zapt ediyor.',
      [E.forts(3), E.def(0.06)], ['hre_hamburg']),
    F('hre_langensalza', 4, 7, 'Langensalza Zaferi', 'sword', 1075,
      'Tarihî yol: Haziran 1075, Unstrut kıyısında Heinrich\'in ordusu Sakson köylülerini ve soylularını ezdi. Sakson prensleri Spier\'de teslim oldu.',
      [E.atk(0.08), E.cap(1500), E.stab(5)], ['hre_sakson'], { hist: true }),
    F('hre_sakson_haklar', 6, 7, 'Sakson Haklarını Tanı', 'scroll', 1075,
      'Alternatif tarih: Kral Saksonların eski haklarını tanıyor, kaleleri yıktırıyor. Prensler kralın yanında; Roma\'yla kavgada arkasında birleşik bir Almanya olacak.',
      [E.stab(12), E.def(-0.03), E.mpm(0.08)], ['hre_sakson'], { alt: true }),
    F('hre_ministerial', 9, 7, 'Ministerialler', 'helm', 1070,
      'Özgür olmayan ama kılıç kuşanan kraliyet hizmetkârları: sadık şövalyeler, kale komutanları, saray memurları.',
      [E.org(0.08), E.armies(1, 'Kraliyet Ministerialleri')], ['hre_burgen']),
    F('hre_worms', 5, 8, 'Worms Sinodu', 'scroll', 1076,
      'Ocak 1076: Heinrich\'in toplattığı Alman piskoposları VII. Gregorius\'u tanımadıklarını ilan etti. Kralın mektubu: "Hildebrand\'a, artık papa değil sahte bir rahip olana... in aşağı, in!"',
      [E.rel(['PAP'], -60), E.stab(3)], null, { reqAny: ['hre_langensalza', 'hre_sakson_haklar'], notify: { PAP: 'Worms\'ta toplanan Alman piskoposları Papa\'yı tanımadıklarını ilan etti! Kral Heinrich, Papa\'nın tahttan inmesini istiyor.' } }),
    F('hre_canossa', 4, 9, 'Canossa\'ya Yürüyüş', 'scroll', 1077,
      'Tarihî yol: Ocak 1077. Kral karla kaplı Alpleri kış ortasında aştı; Canossa kalesinin kapısında üç gün yalınayak, tövbe gömleğiyle bekledi. Papa aforozu kaldırdı. Taç kurtuldu, onur kayboldu.',
      [E.stab(10), E.rel(['PAP'], 40), E.org(-0.05)], ['hre_worms'], { hist: true, notify: { PAP: 'Kral Heinrich tövbe gömleğiyle Canossa kalesinin kapısında bekliyor. Affedilmek istiyor.' } }),
    F('hre_roma', 6, 9, 'Roma Üzerine', 'sword', 1077,
      'Alternatif tarih: Bir kral diz çökmez. Heinrich Lombard piskoposlarının ordusuyla Alpleri aşıyor; hedef Canossa değil, Roma.',
      [E.war('PAP', true), E.atk(0.08), E.armies(2, 'Lombard Ordusu'), X.catholic(-15)], ['hre_worms'],
      { alt: true, notify: { PAP: 'Kral Heinrich af dilemiyor: ordusuyla Alpleri aştı ve Roma\'ya yürüyor!' } }),
    F('hre_elster', 5, 10, 'Elster Savaşı', 'helm', 1080,
      'Ekim 1080: Karşı kral Rudolf, Elster kıyısında Heinrich\'i yendi ama sağ elini kaybetti ve öldü. "Krala bağlılık yemini ettiğim el buydu" dedi. Saksonlar başsız kaldı.',
      [E.atk(0.05), E.calm(['Magdeburg', 'Goslar', 'Merseburg', 'Meissen'], 'Saksonya'), E.stab(5)], null, { reqAny: ['hre_canossa', 'hre_roma'] }),
    F('hre_roma1084', 5, 11, 'İmparatorluk Tacı', 'crown', 1084,
      'Mart 1084: Heinrich Roma\'ya girdi. Kendi papası III. Clemens onu Aziz Petrus\'ta imparator olarak taçlandırdı. Gregorius Sant\'Angelo kalesinde kuşatma altında.',
      [E.stab(10), E.cap(1500), E.envoy()], ['hre_elster'], { notify: { PAP: 'Heinrich Roma\'ya girdi ve karşı papa III. Clemens onu imparator olarak taçlandırdı!' } }),
    F('hre_ogul', 5, 12, 'V. Heinrich\'in İsyanı', 'crown', 1105,
      '1105: Oğul babasına başkaldırdı; IV. Heinrich Ingelheim\'da tahttan indirildi ve ertesi yıl Liège\'de öldü. Ama yeni kral da yatırım hakkından vazgeçmeyecek.',
      [E.reign('V. Heinrich', { born: 1086, dyn: 'Salier', sk: { adm: 4, dip: 3, mil: 4 } }), E.stab(-3), E.tax(0.05)], ['hre_roma1084']),
    // Worms Konkordatosu 1122'de imzalandı; senaryo 1120'de bittiği için kapı 1110'da açılır
    F('hre_konkordato', 4, 13, 'Worms Konkordatosu', 'scroll', 1110,
      'Tarihî yol: Eylül 1122. Piskoposları kilise seçecek, yüzük ve asayı papa verecek; imparator yalnızca asayla toprağı verecek. Elli yıllık kavga uzlaşmayla bitti.',
      [E.stab(15), E.rel(['PAP'], 50), X.catholic(10), E.tax(0.05)], ['hre_ogul'], { hist: true }),
    F('hre_sezar', 6, 13, 'Sezaropapizm', 'dragon', 1111,
      'Alternatif tarih: 1111\'de V. Heinrich Papa II. Paschalis\'i kardinalleriyle birlikte tutukladı. Papa yatırım hakkını imparatora bıraktı. Bu kez geri adım yok: imparator kilisenin de efendisi.',
      [X.forceVassal('PAP'), E.cap(2000), E.atk(0.05), X.catholic(-15), E.stab(5)], ['hre_ogul'], { alt: true, notify: { PAP: 'V. Heinrich Papa\'yı ve kardinalleri tutukladı! Yatırım hakkı imparatora bırakılmazsa Roma yanacak.' } }),
  ];
  mutex(HRE, ['hre_peter', 'hre_macar_ilhak']);
  mutex(HRE, ['hre_reformpapa', 'hre_imparatorpapa']);
  mutex(HRE, ['hre_langensalza', 'hre_sakson_haklar']);
  mutex(HRE, ['hre_canossa', 'hre_roma']);
  mutex(HRE, ['hre_konkordato', 'hre_sezar']);

  // ================================================================ PAPALIK
  const PAP = [
    F('pap_benedictus', 5, 0, 'IX. Benedictus', 'crown', 1040,
      'Tusculum kontlarının yeğeni IX. Benedictus yirmili yaşlarında papa oldu. Lateran\'da şölenler, rüşvet ve skandal. Roma\'nın soyluları papalığı aile mülkü sayıyor.',
      [E.gold(100), E.stab(-3)]),
    F('pap_cluny', 3, 1, 'Cluny\'nin Ruhu', 'scroll', 1040,
      'Burgonya\'daki Cluny manastırından yükselen reform hareketi: rüşvetle makam alımına (simoni) ve evli rahiplere karşı.',
      [E.missionary(), E.research(0.05), X.catholic(5)], ['pap_benedictus']),
    F('pap_roma_soylular', 7, 1, 'Roma Soyluları', 'helm', 1040,
      'Crescentiler ve Tusculumlar şehrin kulelerinden Roma\'yı paylaşıyor. Papa kendi şehrinde bile güvende değil.',
      [E.armies(1, 'Roma Milisleri'), E.def(0.05)], ['pap_benedictus']),
    F('pap_1045', 5, 2, '1045: Satılık Papalık', 'coin', 1045,
      '1044\'te Romalılar Benedictus\'u kovup III. Silvester\'i seçti; Benedictus geri döndü. 1045\'te papalığı vaftiz babası Giovanni Graziano\'ya bin libre gümüşe sattı. Roma\'da üç papa var.',
      [E.reign('VI. Gregorius', { born: 990, dyn: 'Kilise', sk: { adm: 3, dip: 3, mil: 1 } }), E.gold(150), E.stab(-5)], ['pap_benedictus']),
    F('pap_peter', 9, 2, 'Petrus Sadakası', 'coin', 1040,
      'İngiltere\'den Polonya\'ya kadar Katolik krallıklar Roma\'ya her yıl "Peter\'s Pence" gönderiyor.',
      [E.tax(0.1), E.gold(100)], ['pap_roma_soylular']),
    F('pap_sutri', 4, 3, 'Sutri\'ye Boyun Eğ', 'scroll', 1046,
      'Tarihî yol: Papalar imparatorun sinoduna çağrıldı. VI. Gregorius çekildi; Bamberg piskoposu Suidger II. Clemens adıyla papa oldu ve Heinrich\'i imparator olarak taçlandırdı.',
      [E.reign('II. Clemens', { born: 1005, dyn: 'Kilise', sk: { adm: 3, dip: 3, mil: 1 } }), E.rel(['HRE'], 40), E.stab(5)], ['pap_1045'], { hist: true }),
    F('pap_tusculum', 6, 3, 'Tusculum Direnişi', 'castle', 1046,
      'Alternatif tarih: Roma\'nın soyluları bir Alman piskoposunu tahtta istemiyor. Tusculum kontları şehrin kapılarını kapatıyor; papayı Romalılar seçecek.',
      [E.forts(2), E.def(0.1), E.rel(['HRE'], -40), E.armies(1, 'Tusculum Şövalyeleri')], ['pap_1045'], { alt: true, notify: { HRE: 'Roma soyluları imparatorun papasını tanımıyor: Tusculum kontları Roma\'nın kapılarını kapattı.' } }),
    F('pap_matilda', 2, 3, 'Toskana Kontesi', 'shield', 1046,
      'Canossa\'nın efendileri, Toskana markgrafları papalığın en sadık kılıcı olacak. Küçük Matilda bir gün "Kilisenin kızı" diye anılacak.',
      [E.def(0.05), E.rel(['HRE'], -10), E.cap(1000)], ['pap_cluny']),
    F('pap_lateran', 8, 3, 'Lateran Sarayı', 'castle', 1048,
      'Papalık maliyesi düzene giriyor: kançılarya, camera apostolica, mülk defterleri.',
      [E.tax(0.05), E.envoy()], ['pap_peter']),
    F('pap_leo', 5, 4, 'IX. Leo', 'crown', 1049,
      '1049: Toul piskoposu Bruno, Roma\'ya yalınayak bir hacı gibi girdi. IX. Leo Avrupa\'yı dolaşıyor, sinodlar topluyor, rüşvetçi piskoposları azlediyor. Papalık yeniden ayağa kalkıyor.',
      [E.reign('IX. Leo', { born: 1002, dyn: 'Kilise', sk: { adm: 4, dip: 5, mil: 2 } }), E.stab(10), X.catholic(10), E.envoy()], null, { reqAny: ['pap_sutri', 'pap_tusculum'] }),
    F('pap_hac', 8, 4, 'Hac Yolları', 'coin', 1050,
      'Avrupa\'nın dört bir yanından hacılar Aziz Petrus\'un mezarına geliyor; Via Francigena Roma\'ya altın taşıyor.',
      [E.trade(0.1), E.merchant()], ['pap_lateran']),
    F('pap_civitate', 4, 5, 'Civitate Seferi', 'sword', 1053,
      'Tarihî yol: Haziran 1053, Civitate. Papa\'nın Svabyalı ve İtalyan ordusu Normanlar tarafından bozguna uğratıldı; IX. Leo dokuz ay esir kaldı ve fidyeyle kurtuldu. Esaret pazarlığında Normanların fetihlerini tanıdı.',
      [X.civitate(), E.stab(-5), E.gold(-100), E.rel(['NRM'], 20), E.atk(0.05)], ['pap_leo'], { hist: true }),
    F('pap_normanbaris', 6, 5, 'Normanlarla Pazarlık', 'banner', 1053,
      'Alternatif tarih: Papa kılıç yerine kalemle savaşıyor. Normanlar topraklarını papadan tımar olarak alacak; papalık güneyde sadık bir ordu kazanacak.',
      [X.forceVassal('NRM'), E.rel(['NRM'], 40), E.rel(['BYZ'], -20)], ['pap_leo'], { alt: true }),
    F('pap_1054', 5, 6, '1054: Doğu ile Ayrılık', 'scroll', 1054,
      'Kardinal Humbert Konstantinopolis\'e gidiyor. Patrik Kerularios Latin kiliselerini kapattırdı; mayasız ekmek, filioque, Roma\'nın üstünlüğü... Bir uzlaşma mı, bir aforoz mu?',
      [E.stab(-2)], null, { reqAny: ['pap_civitate', 'pap_normanbaris'] }),
    F('pap_aforoz_dogu', 4, 7, 'Kerularios\'u Aforoz Et', 'scroll', 1054,
      'Tarihî yol: 16 Temmuz 1054. Humbert, Ayasofya\'nın sunağına aforoz bullasını bıraktı. Hristiyan âlemi ikiye bölündü.',
      [E.rel(['BYZ', 'KIE'], -50), E.stab(5), X.catholic(5)], ['pap_1054'], { hist: true, notify: { BYZ: 'Papa\'nın elçisi Kardinal Humbert, Ayasofya\'nın sunağına Patrik Kerularios\'u aforoz eden bir bulla bıraktı!' } }),
    F('pap_birlik', 6, 7, 'Kiliselerin Birliği', 'banner', 1054,
      'Alternatif tarih: Elçiler sabırlı davrandı; İmparator Monomakhos patriği yatıştırdı. Roma ve Konstantinopolis kardeş kiliseler olarak kalıyor.',
      [E.rel(['BYZ'], 60), E.rel(['KIE'], 30), E.missionary(), E.stab(3)], ['pap_1054'], { alt: true, notify: { BYZ: 'Papa\'nın elçileri uzlaşma arıyor: Roma, Konstantinopolis ile kiliselerin birliğini teklif ediyor.' } }),
    F('pap_1059', 5, 8, 'Papa Seçim Fermanı', 'scroll', 1059,
      'Nisan 1059: II. Nicolaus\'un Lateran sinodu, papayı artık yalnızca kardinallerin seçeceğini ilan etti. Ağustosta Melfi\'de Robert Guiscard papalığın vasalı oldu: "Tanrı ve Aziz Petrus\'un lütfuyla Apulia ve Kalabria dükü."',
      [X.forceVassal('NRM'), E.stab(8), E.rel(['HRE'], -15)], null, { reqAny: ['pap_aforoz_dogu', 'pap_birlik'], notify: { HRE: 'Lateran sinodu: papayı artık imparator değil, yalnızca kardinaller seçecek!' } }),
    F('pap_barbastro', 3, 9, 'Barbastro Seferi', 'sword', 1064,
      '1064: II. Alexander, Sarakusta tâifasındaki Barbastro\'ya sefer edenlere günahlarının affını vaat etti. Normandiya, Akitanya ve Katalonya şövalyeleri Pireneleri aştı: Haçlı seferlerinin provası.',
      [X.holy({ text: 'Sarakusta Tâifası\'na kutsal sefer (bedelsiz)', tag: () => 'ZAR' }), X.catholic(5)], ['pap_1059']),
    F('pap_sancak', 7, 9, 'Aziz Petrus\'un Sancağı', 'banner', 1066,
      'Papa sancağını kutsadığı seferlere gönderiyor: Normandiyalı William\'a İngiltere için, Erlembald\'a Milano için. Kilisenin onayı kılıçtan keskin.',
      [E.rel(['ENG', 'FRA', 'NMD'], 20), E.envoy(), E.stab(3)], ['pap_1059']),
    F('pap_gregor', 5, 10, 'VII. Gregorius', 'crown', 1073,
      'Nisan 1073: II. Alexander\'ın cenazesinde halk "Hildebrand papa olsun!" diye haykırdı. Yarım asırdır reformun beyni olan Toskanalı keşiş artık VII. Gregorius. Dictatus Papae: "Papa imparatorları azledebilir."',
      [E.reign('VII. Gregorius', { born: 1015, dyn: 'Kilise', sk: { adm: 5, dip: 4, mil: 2 } }), E.stab(8), E.research(0.05)], null, { reqAny: ['pap_barbastro', 'pap_sancak'] }),
    F('pap_aforoz', 5, 11, 'Kralı Aforoz Et', 'dragon', 1076,
      'Şubat 1076: Lateran\'da Gregorius, Heinrich\'i aforoz etti ve tebaasını ona bağlılık yemininden azat etti. Bir kral ilk kez bir papa tarafından tahtından indirildi.',
      [X.excommunicate('HRE'), E.stab(5)], ['pap_gregor'], { notify: { HRE: 'Papa VII. Gregorius kralı aforoz etti! Tebaanız sadakat yemininden azat edildi; prensler yeni bir kral seçmek için toplanıyor.' } }),
    F('pap_canossa_af', 4, 12, 'Canossa\'da Af', 'scroll', 1077,
      'Tarihî yol: Kral üç gün kalenin kapısında yalınayak bekledi. Matilda ve Cluny başrahibi Hugo araya girdi; papa aforozu kaldırdı. Ama prensler yine de karşı kral seçecek.',
      [E.rel(['HRE'], 40), X.catholic(10), E.stab(5)], ['pap_aforoz'], { hist: true, notify: { HRE: 'Papa Canossa\'da affı kabul etti: aforoz kaldırıldı.' } }),
    F('pap_israr', 6, 12, 'Karşı Krala Taç', 'crown', 1077,
      'Alternatif tarih: Gregorius kapıyı açmıyor. Sakson prensleri Forchheim\'da Rheinfeldenli Rudolf\'u kral seçiyor; Papa ona taç gönderiyor: "Petra dedit Petro, Petrus diadema Rudolpho."',
      [X.antiking(), E.rel(['HRE'], -40), E.cb(['HRE'])], ['pap_aforoz'], { alt: true, notify: { HRE: 'Papa affı reddetti ve Sakson prenslerinin seçtiği karşı kral Rudolf\'a taç gönderdi! Saksonya ayaklanıyor.' } }),
    F('pap_1084', 5, 13, '1084: Roma\'nın Yağması', 'castle', 1084,
      'Mayıs 1084: Robert Guiscard\'ın Norman ve Sarazen askerleri papayı kurtarmak için Roma\'ya girdi ve şehri üç gün yağmaladı. Gregorius Salerno\'da sürgünde öldü: "Adaleti sevdim, haksızlıktan nefret ettim; bu yüzden sürgünde ölüyorum."',
      [E.stab(-10), E.def(0.05), E.forts(2)], null, { reqAny: ['pap_canossa_af', 'pap_israr'], notify: { HRE: 'Normanlar papayı kurtarmak için Roma\'ya girdi; şehir üç gün yağmalandı.' } }),
    F('pap_urban', 5, 14, 'II. Urbanus', 'crown', 1088,
      '1088: Cluny\'nin eski priorusu Châtillonlu Odo, II. Urbanus adıyla papa seçildi. Karşı papa Clemens hâlâ Roma\'nın yarısını tutuyor; ama Avrupa Urbanus\'u dinliyor.',
      [E.reign('II. Urbanus', { born: 1035, dyn: 'Kilise', sk: { adm: 4, dip: 6, mil: 2 } }), E.envoy(), X.catholic(10)], ['pap_1084']),
    F('pap_clermont', 4, 15, 'Clermont: Deus Vult!', 'dragon', 1095,
      'Tarihî yol: 27 Kasım 1095. Clermont\'un dışındaki tarlada Urbanus, Bizans\'ın yardım çağrısını Kudüs\'ü kurtarma seferine çevirdi. Kalabalık tek sesle haykırdı: "Deus vult!" Haçlı seferi başlıyor.',
      [X.clermont(), E.stab(10), X.catholic(15)], ['pap_urban'], { hist: true, notify: { BYZ: 'Papa II. Urbanus Clermont\'da Haçlı seferi ilan etti: binlerce şövalye Konstantinopolis üzerinden Kudüs\'e yürüyecek!', SEL: 'Frenklerin Papa\'sı Kudüs\'e karşı büyük bir sefer ilan etti. Batıdan şövalyeler geliyor!', FAT: 'Frenklerin Papa\'sı Kudüs için büyük bir sefer ilan etti!' } }),
    F('pap_reconquista', 6, 15, 'İspanya\'da Haçlı Seferi', 'sword', 1095,
      'Alternatif tarih: Urbanus Katalan şövalyelerine Kudüs\'e gitmek yerine Tarragona\'yı kurtarmalarını söylemişti. Bu kez bütün Hristiyan âlemi Endülüs\'e yürüyor.',
      [X.holy({ text: 'İberya\'daki en güçlü Müslüman ülkeye kutsal sefer (bedelsiz)', tag: iberianMuslim }), E.rel(['LEO', 'ARA', 'NAV', 'BAR'], 30)], ['pap_urban'], { alt: true }),
    F('pap_final', 5, 16, 'Papalık Monarşisi', 'crown', 1105,
      'Reform kazandı: papa Hristiyan âleminin ruhani hükümdarı, krallar onun oğulları. Lateran\'dan bütün Avrupa\'ya uzanan bir kilise devleti.',
      [E.stab(10), X.catholic(15), E.tax(0.1), E.envoy(), E.missionary()], null, { reqAny: ['pap_clermont', 'pap_reconquista'] }),
  ];
  mutex(PAP, ['pap_sutri', 'pap_tusculum']);
  mutex(PAP, ['pap_civitate', 'pap_normanbaris']);
  mutex(PAP, ['pap_aforoz_dogu', 'pap_birlik']);
  mutex(PAP, ['pap_canossa_af', 'pap_israr']);
  mutex(PAP, ['pap_clermont', 'pap_reconquista']);

  G.FOCUS_TREES.HRE = finish(HRE);
  G.FOCUS_TREES.PAP = finish(PAP);
  G.SPECIAL_TAGS.push('HRE', 'PAP');

  // ================================================================ ulus profilleri
  Object.assign(G.PROFILES, {
    HRE: {
      title: 'Kutsal Roma İmparatorluğu', kind: 'Majör krallık · İmparatorluk', difficulty: 'Orta',
      ruler: { name: 'III. Heinrich', born: 1017, sk: { adm: 5, dip: 4, mil: 5 },
        traits: [['Kara Kral', 'Sert, dindar ve kudretli: Salierlerin en güçlüsü'], ['Barış kralı', 'Tanrı\'nın Barışı\'nı imparatorluğun barışı yaptı'], ['Papa yapıcı', 'Roma\'ya dört papa gönderecek']] },
      heir: null,
      capital: 'Aachen',
      history: [
        '962\'de I. Otto Roma\'da imparator olarak taçlandı: Charlemagne\'ın tacı Alman krallarına geçti. Almanya, İtalya ve Burgonya tek bir hükümdarın altında.',
        '1024\'te Sakson hanedanı sönünce Frankonyalı Salierler tahta çıktı. II. Konrad Burgonya\'yı ekledi; oğlu III. Heinrich 1039\'da imparatorluğu zirvesinde devraldı.',
        'Ama imparatorluğun gücü kiliseye dayanıyor: piskoposları kral atıyor, papayı imparator seçiyor. Cluny\'den yükselen reform rüzgârı bu düzeni yıkmak üzere.',
        'Tarihte Heinrich\'in oğlu Canossa\'da yalınayak bekleyecek, Saksonlar ayaklanacak, iki papa ve iki kral birbirini aforoz edecek. Elli yıllık Yatırım Kavgası sizi bekliyor.',
      ],
      goals: [['1046', 'Sutri sinodu: üç papanın azli'], ['1056', 'III. Heinrich\'in ölümü, çocuk kral'], ['1075', 'Langensalza\'da Sakson ayaklanması'],
        ['1076', 'Worms sinodu ve aforoz'], ['1077', 'Canossa'], ['1084', 'Roma\'da imparatorluk tacı'], ['1122', 'Worms Konkordatosu']],
      paths: ['Macaristan: vasal kral mı, Pannonia markı mı?', 'Reformcu papalar mı, imparatora bağlı bir papalık mı?', 'Saksonları ezmek mi, haklarını tanımak mı?',
        'Canossa\'da diz çökmek mi, Roma\'ya yürümek mi?', 'Worms Konkordatosu mu, sezaropapizm mi?'],
      rivals: ['PAP', 'HUN', 'POL', 'FRA', 'NRM'], friends: ['VEN'],
    },
    PAP: {
      title: 'Papalık Devleti', kind: 'Minör krallık · Seçimle gelen papalık', difficulty: 'Zor',
      ruler: { name: 'IX. Benedictus', born: 1012, sk: { adm: 2, dip: 3, mil: 1 },
        traits: [['Tusculum kontlarının adamı', 'Papalığı ailesinin mülkü sayıyor'], ['Skandal', 'Ahlaksızlığıyla ünlü; Roma halkı ondan nefret ediyor'], ['Üç kez papa', 'Tahta üç kez çıkıp üç kez inecek']] },
      heir: { name: 'VI. Gregorius', born: 990, hist: true, sk: { adm: 3, dip: 3, mil: 1 }, note: 'Başrahip Giovanni Graziano. Vaftiz oğlu Benedictus\'u papalıktan kurtarmak için tahtı ondan satın alacak.' },
      capital: 'Roma',
      history: [
        'Aziz Petrus\'un halefleri, Roma\'nın piskoposları: bütün Batı Hristiyan âleminin ruhani önderleri. 754\'te Pepin\'in bağışıyla İtalya\'nın ortasında kendi devletlerine kavuştular.',
        'X. yüzyılda papalık Roma soylu ailelerinin oyuncağı oldu: Crescentiler ve Tusculumlar papaları tahta çıkarıp indirdi. 1040\'ta tahtta yirmili yaşlarda bir Tusculum yeğeni var.',
        'Ama Cluny\'den, Lotaringiya\'dan bir reform hareketi yükseliyor: rüşvetle makam alımına, evli rahiplere ve kiliseye karışan krallara karşı.',
        'Papa seçimle gelir; her papanın ölümünde yeni bir papa seçilir. Tarihte papalar imparatoru Canossa\'da diz çöktürecek ve Clermont\'da bütün Avrupa\'yı Kudüs\'e yürütecek.',
      ],
      goals: [['1046', 'Sutri: üç papanın azli'], ['1049', 'IX. Leo ve reform'], ['1054', 'Doğu kilisesiyle ayrılık'], ['1059', 'Kardinallerin seçim hakkı, Melfi'],
        ['1076', 'Kralın aforozu'], ['1077', 'Canossa'], ['1095', 'Clermont: Haçlı seferi']],
      paths: ['Sutri\'ye boyun eğmek mi, Tusculum direnişi mi?', 'Normanlara savaş mı, pazarlık mı?', '1054: aforoz mu, kiliselerin birliği mi?',
        'Canossa\'da af mı, karşı krala taç mı?', 'Kudüs mü, Endülüs mü?'],
      rivals: ['HRE', 'NRM', 'BYZ'], friends: ['FRA', 'SAL'],
    },
  });
})();
