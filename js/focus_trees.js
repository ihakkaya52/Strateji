// Odak ağaçları: 10 büyük güce özel ağaçlar ve diğer bütün ülkeler için ortak ağaç.
// Her ağaçta üç kol vardır: siyasi (sol), ekonomik (orta), askerî / teknolojik (sağ) ve bir final odağı.
'use strict';

(function () {
  const pct = v => `%${Math.round(v * 100)}`;
  const nm = t => (window.WORLD.nations[t] || { name: t }).name;
  const alive = t => G.S.nations[t] && G.S.nations[t].alive;

  // Etki yapı taşları: her biri {text, fn}
  const E = {
    mp: v => ({ text: `+${G.fmtNum(v)} insan gücü`, fn: n => { n.manpower += v; } }),
    mpm: v => ({ text: `Aylık insan gücü +${pct(v)}`, fn: n => { n.mpMult += v; } }),
    atk: v => ({ text: `Saldırı +${pct(v)}`, fn: n => { n.atkMult += v; } }),
    def: v => ({ text: `Savunma +${pct(v)}`, fn: n => { n.defMult += v; } }),
    siege: v => ({ text: `Kuşatma +${pct(v)}`, fn: n => { n.siegeMult += v; } }),
    speed: v => ({ text: `Ordu hızı +${pct(v)}`, fn: n => { n.speedMult += v; } }),
    org: v => ({ text: `Örgütlenme yenilenmesi +${pct(v)}`, fn: n => { n.orgMult += v; } }),
    naval: v => ({ text: `Deniz gücü +${pct(v)}`, fn: n => { n.navalMult += v; } }),
    cap: v => ({
      text: `Ordu kapasitesi +${G.fmtK(v)}`,
      fn: n => { n.capBonus += v; for (const a of G.S.armies) if (a.tag === n.tag) a.maxMen += v; },
    }),
    envoy: () => ({ text: '+1 elçi', fn: n => { n.envoys++; } }),
    armies: (k, name) => ({ text: `${k} yeni ordu`, fn: n => G.focus.spawnArmies(n, k, name) }),
    dock: k => ({
      text: `${k} yeni tersane`,
      fn: n => {
        const S = G.S;
        const ports = S.provinces.filter(p => p.owner === n.tag && G.navy.isPort(p) && !S.dockyards.some(d => d.prov === p.id));
        for (const p of ports.slice(0, k)) S.dockyards.push({ id: S.nextDockId++, tag: n.tag, prov: p.id, queue: [] });
        if (!ports.length) n.manpower += 3000 * k;
      },
    }),
    cb: tags => ({
      text: `Savaş gerekçesi: ${tags.map(nm).join(', ')}`,
      fn: n => { for (const t of tags) if (alive(t) && !G.sameRealm(t, n.tag)) n.claims.add(t); },
    }),
    cbWeak: () => ({
      text: 'En zayıf komşuya karşı savaş gerekçesi',
      fn: n => {
        const nb = [...(G.ai.neighbors()[n.tag] || [])].filter(t => alive(t) && !G.sameRealm(t, n.tag) && !G.dip.allied(t, n.tag));
        nb.sort((a, b) => G.dip.power(a) - G.dip.power(b));
        if (nb[0]) n.claims.add(nb[0]);
      },
    }),
    rel: (tags, v) => ({
      text: `${tags === 'nb' ? 'Komşularla' : tags.map(nm).join(', ') + ' ile'} ilişki +${v}`,
      fn: n => {
        const list = tags === 'nb' ? [...(G.ai.neighbors()[n.tag] || [])] : tags;
        for (const t of list) if (alive(t)) G.dip.add(n.tag, t, v);
      },
    }),
    ruler: name => ({ text: `Hükümdar: ${name}`, fn: n => { n.ruler = name; } }),
    tribute: v => ({ text: `Vasallardan haraç ${pct(v)}`, fn: n => { for (const v2 of G.vassalsOf(n.tag)) G.S.nations[v2].tribute = v; } }),
  };

  // Odak tanımı
  const F = (id, x, y, name, icon, desc, effects, req, extra) => ({
    id, x, y, name, icon, desc, req,
    effectText: effects.map(e => e.text).join(' · '),
    effect: n => effects.forEach(e => e.fn(n)),
    ...(extra || {}),
  });

  // Üç kollu standart yerleşim
  const tree = (p, pol, eco, mil, fin) => {
    const out = [];
    const branch = (b, x0, kind) => {
      const [root, l1, r1, l2, r2, top] = b;
      out.push(F(`${p}_${kind}0`, x0 + 0.5, 0, ...root, undefined));
      out.push(F(`${p}_${kind}1`, x0, 1, ...l1, [`${p}_${kind}0`]));
      out.push(F(`${p}_${kind}2`, x0 + 1, 1, ...r1, [`${p}_${kind}0`]));
      out.push(F(`${p}_${kind}3`, x0, 2, ...l2, [`${p}_${kind}1`]));
      out.push(F(`${p}_${kind}4`, x0 + 1, 2, ...r2, [`${p}_${kind}2`]));
      out.push(F(`${p}_${kind}5`, x0 + 0.5, 3, ...top, [`${p}_${kind}3`, `${p}_${kind}4`]));
    };
    branch(pol, 0, 'p'); branch(eco, 2, 'e'); branch(mil, 4, 'm');
    out.push(F(`${p}_fin`, 2.5, 4, ...fin, [`${p}_p5`, `${p}_e5`, `${p}_m5`]));
    return out;
  };

  const T = {};

  // ---------------------------------------------------------------- ortak ağaç
  T.GENERIC = tree('g',
    [
      ['Saray Meclisini Topla', 'scroll', 'Ülkenin ileri gelenleri tahtın etrafında toplanıyor.', [E.envoy()]],
      ['Hanedan Evlilikleri', 'crown', 'Komşu saraylarla akrabalık bağları kuralım.', [E.rel('nb', 30)]],
      ['Merkezî Otorite', 'helm', 'Beylerin gücünü kırıp tacı güçlendirelim.', [E.mpm(0.1)]],
      ['Eski Hakları Hatırla', 'banner', 'Atalarımızın kaybettiği topraklar unutulmadı.', [E.cbWeak()]],
      ['Elçilik Okulu', 'scroll', 'Dil bilen, ince düşünen elçiler yetiştirelim.', [E.envoy(), E.rel('nb', 15)]],
      ['Tahtın Meşruiyeti', 'crown', 'Hükümdarın hakkı artık sorgulanmıyor.', [E.def(0.05), E.org(0.1)]],
    ],
    [
      ['Tarlaları Genişlet', 'coin', 'Ormanlar açılıyor, yeni köyler kuruluyor.', [E.mpm(0.1)]],
      ['Pazar Kasabaları', 'coin', 'Haftalık pazarlar halkı zenginleştiriyor.', [E.mp(6000)]],
      ['Eski Yolları Onar', 'banner', 'Ordular ve tüccarlar daha hızlı yol alacak.', [E.speed(0.1)]],
      ['Liman ve Tersane', 'ship', 'Denize açılan bir kapı.', [E.dock(1), E.naval(0.1)]],
      ['Ticaret Yolları', 'coin', 'Kervanlar ve gemiler hazineye akıyor.', [E.mpm(0.1), E.mp(4000)]],
      ['Bereket Yılları', 'coin', 'Kıtlık geride kaldı.', [E.mpm(0.15)]],
    ],
    [
      ['Demirci Loncaları', 'axe', 'Daha iyi kılıçlar, daha sağlam zırhlar.', [E.atk(0.05)]],
      ['Kaleleri Tahkim Et', 'castle', 'Sınır kaleleri taşla yeniden örülüyor.', [E.def(0.1)]],
      ['Kuşatma Makineleri', 'castle', 'Mancınıklar ve koçbaşları.', [E.siege(0.3)]],
      ['Süvari Talimi', 'spear', 'Atlılar birlikte hücum etmeyi öğreniyor.', [E.speed(0.1), E.atk(0.05)]],
      ['Profesyonel Askerler', 'helm', 'Ücretli, sürekli bir ordu.', [E.cap(1500), E.armies(1)]],
      ['Ordu Reformu', 'sword', 'Ordu yeniden düzenlendi.', [E.org(0.2), E.atk(0.05)]],
    ],
    ['Altın Çağ', 'dragon', 'Krallık tarihinin en parlak dönemini yaşıyor.', [E.atk(0.05), E.def(0.05), E.mpm(0.1), E.cap(1000)]],
  );

  // ---------------------------------------------------------------- Bizans
  T.BYZ = tree('byz',
    [
      ['Büyük Saray Entrikaları', 'scroll', 'Mihail\'in sarayında hadımlar ve aileler güç için yarışıyor.', [E.envoy()]],
      ['Patrikhaneyle Uzlaşma', 'shield', 'Kilise ve taç aynı safta.', [E.org(0.1)]],
      ['Varangian Muhafızları', 'axe', 'İmparatorun baltalı Kuzeyli muhafızları.', [E.atk(0.1)]],
      ['Balkanları Sindir', 'banner', 'Bulgar, Sırp ve Hırvat isyanları bastırılacak.', [E.cb(['BUL', 'CRO', 'DUK'])]],
      ['Ermeni Krallıklarını İlhak', 'crown', 'Ani ve Lori imparatorluğa katılacak.', [E.cb(['ANI', 'LOR'])]],
      ['Romalıların Basileus\'u', 'crown', 'Tanrı\'nın yeryüzündeki temsilcisi.', [E.cap(2000), E.def(0.05)]],
    ],
    [
      ['Altın Solidus', 'coin', 'Akdeniz\'in en güvenilir sikkesi.', [E.mpm(0.1)]],
      ['Thema Sistemini Canlandır', 'shield', 'Toprak karşılığı askerlik yeniden düzenleniyor.', [E.mp(10000), E.mpm(0.1)]],
      ['İpek Tekeli', 'coin', 'İpek atölyeleri yalnızca imparatora çalışır.', [E.mp(8000)]],
      ['Rum Ateşi', 'ship', 'Suyla sönmeyen sır silah.', [E.naval(0.25), E.dock(1)]],
      ['Theodosius Surları', 'castle', 'Bin yıldır aşılamayan surlar onarılıyor.', [E.def(0.15)]],
      ['Şehirlerin Kraliçesi', 'crown', 'Konstantinopolis dünyanın merkezi.', [E.mpm(0.15)]],
    ],
    [
      ['Tagmata', 'helm', 'Başkentin seçkin alayları.', [E.armies(2, 'Tagma')]],
      ['Kataphraktoi', 'spear', 'Baştan aşağı zırhlı ağır süvari.', [E.atk(0.1), E.speed(0.05)]],
      ['Akritai Sınır Muhafızları', 'shield', 'Doğu sınırının efsanevi bekçileri.', [E.def(0.1)]],
      ['Sicilya\'yı Geri Al', 'ship', 'Maniakes\'in yarım kalan seferi tamamlanacak.', [E.cb(['SIC'])]],
      ['Doğu Sınırını Güvenceye Al', 'banner', 'Mervânî ve Ukaylî beyleri hizaya gelecek.', [E.cb(['MRW', 'UKA'])]],
      ['Yeni Strategikon', 'scroll', 'Savaş sanatı yeniden yazılıyor.', [E.org(0.2), E.siege(0.2)]],
    ],
    ['Roma\'nın Yeniden Doğuşu', 'dragon', 'Justinianus\'un imparatorluğu geri dönüyor.', [E.atk(0.05), E.def(0.05), E.cap(1500), E.cb(['FAT'])]],
  );

  // ---------------------------------------------------------------- Büyük Selçuklu
  T.SEL = tree('sel',
    [
      ['Dandanakan\'ın Mirası', 'banner', 'Gazneliler yenildi, Horasan bizim.', [E.mp(10000)]],
      ['Oğuz Boylarını Birleştir', 'spear', 'Yirmi dört boy tek sancak altında.', [E.armies(2, 'Oğuz Ordusu')]],
      ['Halifenin Koruyucusu', 'crown', 'Bağdat\'taki halife Büveyhîlerin elinden kurtarılacak.', [E.rel(['ABB'], 60), E.cb(['BUY'])]],
      ['Büyük Vezirlik', 'scroll', 'Devleti vezirler yönetir, sultan hükmeder.', [E.envoy(), E.mpm(0.1)]],
      ['Bağdat\'a Giriş', 'banner', 'Irak ve Cezîre beyleri boyun eğecek.', [E.cb(['UKA', 'MEZ', 'MRW'])]],
      ['Sultan-ı Âzam', 'crown', 'Doğunun ve Batının sultanı.', [E.cap(2000)]],
    ],
    [
      ['İkta Sistemi', 'coin', 'Askere toprak, devlete asker.', [E.mpm(0.15)]],
      ['Kervansaraylar', 'coin', 'Yollar güvenli, kervanlar zengin.', [E.mp(8000), E.speed(0.05)]],
      ['Horasan Şehirleri', 'castle', 'Merv ve Nişabur tahkim ediliyor.', [E.def(0.1)]],
      ['Nizamiye Medreseleri', 'scroll', 'Devlete adam yetiştiren okullar.', [E.org(0.15), E.envoy()]],
      ['İsfahan\'ı Başkent Yap', 'banner', 'İran\'ın kalbi Selçuklu olacak.', [E.cb(['KAK', 'ZIY'])]],
      ['İpek Yolu\'nun Efendisi', 'coin', 'Doğudan batıya her kervan bizden geçer.', [E.mpm(0.15)]],
    ],
    [
      ['Atlı Okçular', 'spear', 'Bozkırın rüzgârı.', [E.speed(0.15)]],
      ['Gulam Ordusu', 'helm', 'Sultana bağlı köle askerler.', [E.atk(0.1)]],
      ['Anadolu\'ya Akınlar', 'axe', 'Uç beyleri Rum diyarına akın ediyor.', [E.cb(['BYZ'])]],
      ['Sahte Ricat Taktiği', 'sword', 'Kaçıyor gibi yap, döndüğünde vur.', [E.atk(0.1), E.def(0.05)]],
      ['Gaznelileri Bitir', 'banner', 'Mesud\'un devleti tarihe karışacak.', [E.cb(['GAZ'])]],
      ['Malazgirt Ruhu', 'sword', 'Hiçbir ordu bozkırın atlılarını durduramaz.', [E.atk(0.1), E.org(0.1)]],
    ],
    ['Diyar-ı Rum\'un Kapıları', 'dragon', 'Anadolu ve Mısır yolu açık.', [E.cap(1500), E.atk(0.05), E.cb(['BYZ', 'FAT'])]],
  );

  // ---------------------------------------------------------------- Fâtımî
  T.FAT = tree('fat',
    [
      ['İmamın Sarayı', 'crown', 'Kahire\'deki imam-halife tüm Müslümanların önderi olmalı.', [E.envoy()]],
      ['Dâî Ağı', 'scroll', 'Davetçiler her şehirde gizlice çalışıyor.', [E.envoy(), E.rel('nb', 20)]],
      ['Ermeni Vezirler', 'helm', 'Yetenekli Ermeni komutanlar ordunun başında.', [E.atk(0.05), E.org(0.1)]],
      ['Zîrîleri Hizaya Getir', 'banner', 'İfrîkıye\'deki asi vasal cezalandırılacak.', [E.cb(['ZIR'])]],
      ['Bağdat\'ta Fâtımî Hutbesi', 'crown', 'Abbâsî halifeliğine son.', [E.cb(['ABB', 'BUY'])]],
      ['Tek Halifelik', 'crown', 'Ümmetin tek imamı Kahire\'de.', [E.cap(2000)]],
    ],
    [
      ['Nil Bereketi', 'coin', 'Nil taşkınları ambarları dolduruyor.', [E.mpm(0.15)]],
      ['el-Ezher', 'scroll', 'İlmin merkezi Kahire.', [E.org(0.15)]],
      ['Kızıldeniz Ticareti', 'ship', 'Hint malları Kahire\'den Akdeniz\'e.', [E.dock(1), E.mp(8000)]],
      ['Kahire\'nin Surları', 'castle', 'Bedr el-Cemâlî\'nin kapıları.', [E.def(0.15)]],
      ['Hint Ticareti', 'coin', 'Aden\'den gelen gemiler.', [E.mpm(0.1)]],
      ['Fâtımî Altını', 'coin', 'Dünyanın en saf altın sikkesi.', [E.mp(15000), E.mpm(0.1)]],
    ],
    [
      ['Fâtımî Donanması', 'ship', 'Akdeniz\'in hâkimi olacak filolar.', [E.naval(0.2), E.dock(1)]],
      ['Sudanlı Piyadeler', 'spear', 'Nil\'in güneyinden gelen savaşçılar.', [E.armies(2, 'Sudan Alayı')]],
      ['Türk Gulamları', 'helm', 'Atlı okçu köle askerler.', [E.atk(0.1)]],
      ['Suriye\'yi Sağlamlaştır', 'castle', 'Halep ve Dımaşk tahkim edilecek; bedevi beyler susacak.', [E.def(0.1), E.cb(['MIR', 'NUM'])]],
      ['Benî Hilâl\'i Salıver', 'axe', 'Bedevi kabileler Mağrib\'e salınıyor.', [E.atk(0.05), E.cb(['ZIR', 'HAM'])]],
      ['Kutsal Şehirlerin Koruyucusu', 'sword', 'Mekke, Medine ve Kudüs bizim korumamızda.', [E.org(0.15), E.atk(0.05)]],
    ],
    ['Mehdî\'nin Vaadi', 'dragon', 'Fâtımî davası dünyayı saracak.', [E.cap(1500), E.cb(['SEL', 'BYZ'])]],
  );

  // ---------------------------------------------------------------- Kutsal Roma
  T.HRE = tree('hre',
    [
      ['Salyan Hanedanı', 'crown', 'III. Heinrich\'in hanedanı güçleniyor.', [E.envoy()]],
      ['Kilise Reformu', 'scroll', 'Simoni ve rüşvet kiliseden temizlenecek.', [E.rel(['PAP'], 60), E.org(0.1)]],
      ['Ministeriales', 'helm', 'İmparatora bağlı soylu hizmetkârlar.', [E.mpm(0.1)]],
      ['İtalya Seferi', 'banner', 'Kuzey İtalya şehirleri imparatora boyun eğecek.', [E.cb(['PIS', 'GEN', 'VEN'])]],
      ['Macar Meselesi', 'banner', 'Macar tahtındaki karışıklık bir fırsat.', [E.cb(['HUN'])]],
      ['Roma\'da Taç Giyme', 'crown', 'Papa imparatoru Roma\'da taçlandırıyor.', [E.cap(2000), E.rel(['PAP'], 30)]],
    ],
    [
      ['Goslar Gümüş Madenleri', 'coin', 'Rammelsberg\'in gümüşü hazineyi dolduruyor.', [E.mp(10000)]],
      ['Ren Şehirleri', 'coin', 'Köln, Mainz ve Worms büyüyor.', [E.mpm(0.15)]],
      ['Kuzey Ticareti', 'ship', 'Bremen ve Hamburg denize açılıyor.', [E.dock(1)]],
      ['Kaleler Çağı', 'castle', 'Her tepede bir kale.', [E.def(0.15)]],
      ['Doğuya Yerleşim', 'banner', 'Slav topraklarına köylüler yerleşiyor.', [E.mpm(0.1), E.cb(['LUT', 'ABO'])]],
      ['İmparatorluk Diyetleri', 'scroll', 'Prensler imparatorun meclisinde.', [E.mpm(0.1), E.envoy()]],
    ],
    [
      ['Zırhlı Şövalyeler', 'helm', 'Avrupa\'nın en ağır süvarisi.', [E.atk(0.1)]],
      ['Mızrak Hücumu', 'spear', 'Sıkı düzende mızrak hücumu.', [E.atk(0.05), E.speed(0.05)]],
      ['Kuşatma Ustaları', 'castle', 'Lombard mühendisler ordumuzda.', [E.siege(0.3)]],
      ['Sakson İsyanlarını Bastır', 'axe', 'Saksonya imparatora bağlı kalacak.', [E.def(0.1), E.armies(2)]],
      ['Polonya Üzerinde Süzerenlik', 'banner', 'Doğudaki krallar imparatorun vasalı olmalı.', [E.cb(['POL', 'POM'])]],
      ['İmparatorluk Ordusu', 'sword', 'Bütün prensliklerden toplanan ordu.', [E.org(0.15), E.cap(1000)]],
    ],
    ['Kayser', 'dragon', 'Hristiyan âleminin efendisi.', [E.atk(0.05), E.def(0.05), E.cb(['FRA'])]],
  );

  // ---------------------------------------------------------------- Fransa
  T.FRA = tree('fra',
    [
      ['Capet Tacı', 'crown', 'Zayıf bir kral, güçlü bir hanedan.', [E.envoy()]],
      ['Büyük Vasalları Hizaya Getir', 'helm', 'Normandiya, Anjou ve Blois krala bağlanacak.', [E.mpm(0.15)]],
      ['Cluny Reformu', 'scroll', 'Manastır reformu krallığı ayakta tutuyor.', [E.org(0.1), E.rel(['PAP'], 40)]],
      ['Akitanya Üzerinde Hakimiyet', 'banner', 'Güney Fransa kralın sözünü dinleyecek.', [E.def(0.1)]],
      ['İngiliz Tacına Talip', 'crown', 'Normandiya dükünün İngiltere üzerinde hakkı var.', [E.cb(['ENG', 'DEN'])]],
      ['En Hristiyan Kral', 'crown', 'Frankların kralı Tanrı\'nın seçtiği.', [E.cap(2000)]],
    ],
    [
      ['Paris\'i Büyüt', 'coin', 'Île-de-France krallığın kalbi.', [E.mp(10000)]],
      ['Şampanya Panayırları', 'coin', 'Avrupa\'nın tüccarları buluşuyor.', [E.mpm(0.15)]],
      ['Flandre Kumaşı', 'ship', 'Yün ve kumaş denizden gidiyor.', [E.dock(1), E.mp(5000)]],
      ['Su Değirmenleri', 'coin', 'Her derede bir değirmen.', [E.mpm(0.1)]],
      ['Kraliyet Yolları', 'banner', 'Kralın yolları güvenli.', [E.speed(0.1)]],
      ['Katedraller Çağı', 'castle', 'Taş ve inanç.', [E.org(0.1), E.def(0.05)]],
    ],
    [
      ['Norman Şövalyeleri', 'helm', 'Kuzeyin torunları, Avrupa\'nın en iyi süvarisi.', [E.atk(0.1)]],
      ['Tanrı\'nın Barışı', 'shield', 'Kilise savaşları sınırlıyor, krallık güçleniyor.', [E.def(0.1)]],
      ['Motte ve Bailey', 'castle', 'Toprak tepeler üzerinde ahşap kaleler.', [E.siege(0.2), E.def(0.05)]],
      ['Reconquista\'ya Yardım', 'sword', 'Fransız şövalyeleri İspanya\'ya iniyor.', [E.cb(['ZAR', 'TUL', 'SEV'])]],
      ['Burgonya Mirası', 'banner', 'Burgonya krallığı Fransa\'ya ait.', [E.cb(['HRE'])]],
      ['Haçlı Ruhu', 'sword', 'Deus vult!', [E.atk(0.1), E.org(0.1)]],
    ],
    ['Frankların Kralı', 'dragon', 'Charlemagne\'ın mirası Paris\'te.', [E.atk(0.05), E.cap(1500), E.mpm(0.1)]],
  );

  // ---------------------------------------------------------------- Kiev Rus'u
  T.KIE = tree('kie',
    [
      ['Russkaya Pravda', 'scroll', 'Yaroslav\'ın kanunları bütün Rus\'ta geçerli.', [E.mpm(0.1)]],
      ['Kiev Ayasofyası', 'shield', 'Kiev, Konstantinopolis\'e rakip.', [E.org(0.15)]],
      ['Avrupa Evlilikleri', 'crown', 'Yaroslav\'ın kızları Avrupa\'nın kraliçeleri.', [E.envoy(), E.rel(['FRA', 'HUN', 'NOR', 'BYZ'], 40)]],
      ['Polotsk\'u Birleştir', 'banner', 'Asi kuzenler Kiev\'e boyun eğecek.', [E.cb(['PLT'])]],
      ['Novgorod\'u Bağla', 'scroll', 'Kuzeyin zengin şehri.', [E.mp(8000), E.dock(1)]],
      ['Büyük Knez', 'crown', 'Bütün knezlerin üstünde tek hükümdar.', [E.cap(2000)]],
    ],
    [
      ['Varyaglardan Greklere', 'ship', 'Dinyeper yolu ticaretle canlanıyor.', [E.mp(8000)]],
      ['Kürk Ticareti', 'coin', 'Samur ve tilki kürkleri altın değerinde.', [E.mpm(0.15)]],
      ['Kale Şehirler', 'castle', 'Gorod: ahşap surlu şehirler.', [E.def(0.1)]],
      ['Volga Yolu', 'coin', 'Bulgar pazarları bizim olacak.', [E.cb(['VOL'])]],
      ['Baltık Kabileleri', 'banner', 'Kuzeybatıdaki pagan kabileler haraç verecek.', [E.cb(['EST', 'LTG', 'LIT'])]],
      ['Gardariki\'nin Zenginliği', 'coin', 'Şehirler ülkesi.', [E.mpm(0.15)]],
    ],
    [
      ['Drujina', 'helm', 'Knezin seçkin muhafızları.', [E.atk(0.1)]],
      ['Varyag Paralı Askerleri', 'axe', 'İskandinavya\'dan savaşçılar.', [E.armies(2, 'Varyag Ordusu')]],
      ['Bozkır Sınırı Surları', 'castle', 'Yılan Surları göçebeleri durduracak.', [E.def(0.1)]],
      ['Peçeneklere Son', 'spear', 'Bozkırın belası ortadan kalkacak.', [E.cb(['PEC'])]],
      ['Rus Süvarisi', 'spear', 'Göçebelerden öğrenilen savaş.', [E.speed(0.1), E.atk(0.05)]],
      ['Konstantinopolis Seferi', 'ship', 'Tsargrad\'ın kapılarına kalkan asmak.', [E.naval(0.2), E.cb(['BYZ'])]],
    ],
    ['Bütün Rus\'un Hükümdarı', 'dragon', 'Baltık\'tan Karadeniz\'e tek devlet.', [E.cap(1500), E.atk(0.05), E.def(0.05)]],
  );

  // ---------------------------------------------------------------- Danimarka
  T.DEN = tree('den',
    [
      ['Knut\'un Mirası', 'crown', 'Büyük Knut\'un imparatorluğu dağılmamalı.', [E.envoy()]],
      ['İngiltere\'yi Elde Tut', 'helm', 'İngiliz vasalı daha sıkı denetlenecek.', [E.tribute(0.4)]],
      ['Roskilde Piskoposluğu', 'scroll', 'Kilise krallığın direği.', [E.org(0.1)]],
      ['Norveç Tacı', 'crown', 'Magnus\'un tahtı Danimarka\'nın hakkı.', [E.cb(['NOR'])]],
      ['İsveç Üzerinde Hak', 'banner', 'Uppsala da Knut\'un mirası.', [E.cb(['SWE'])]],
      ['Kuzey Denizi İmparatorluğu', 'crown', 'Üç krallık tek taç altında.', [E.cap(2000)]],
    ],
    [
      ['Kattegat Ticareti', 'coin', 'Boğazlardan geçen her gemi vergi öder.', [E.mpm(0.1)]],
      ['Hedeby Pazarı', 'coin', 'Kuzeyin en büyük pazarı.', [E.mp(8000)]],
      ['Danevirke Surları', 'castle', 'Güney sınırındaki toprak sur.', [E.def(0.15)]],
      ['Drakkar Filoları', 'ship', 'Yeni gemiler, yeni akınlar.', [E.dock(1), E.naval(0.15)]],
      ['Wend Seferi', 'banner', 'Baltık kıyısındaki Slavlar boyun eğecek.', [E.cb(['ABO', 'LUT', 'POM'])]],
      ['Danegeld Gümüşü', 'coin', 'Yabancı krallar barış için gümüş öder.', [E.mp(15000)]],
    ],
    [
      ['Huscarllar', 'axe', 'Kralın baltalı muhafızları.', [E.atk(0.1)]],
      ['Vikinglerin Dönüşü', 'ship', 'Eski yollar yeniden açılıyor.', [E.naval(0.1), E.speed(0.05)]],
      ['Kalkan Duvarı', 'shield', 'Omuz omuza, kalkan kalkana.', [E.def(0.1)]],
      ['Frankya\'ya Büyük Akın', 'axe', 'Paris bir kez daha kuşatılacak.', [E.cb(['FRA'])]],
      ['Jomsvikingler', 'helm', 'Efsanevi paralı savaşçı kardeşliği.', [E.armies(2, 'Jomsviking')]],
      ['Berserkerler', 'sword', 'Ölümden korkmayan savaşçılar.', [E.atk(0.1), E.org(0.1)]],
    ],
    ['Valhalla\'nın Çocukları', 'dragon', 'Kuzeyin fırtınası yeniden esiyor.', [E.atk(0.05), E.cap(1500), E.naval(0.1)]],
  );

  // ---------------------------------------------------------------- Gazneliler
  T.GAZ = tree('gaz',
    [
      ['Gazne Sarayı', 'crown', 'Mesud tahtını sağlamlaştırmalı.', [E.envoy()]],
      ['Şehnâme\'nin Mirası', 'scroll', 'Firdevsî\'nin destanı sarayda okunuyor.', [E.org(0.1)]],
      ['Gur Beylerini Bağla', 'helm', 'Dağ beyleri sadık kalacak.', [E.def(0.1)]],
      ['Horasan\'ı Geri Al', 'banner', 'Dandanakan\'ın intikamı.', [E.cb(['SEL'])]],
      ['Lahor\'a Odaklan', 'castle', 'Pencap yeni kalemiz.', [E.def(0.1), E.mpm(0.1)]],
      ['Sultanlığın İhyası', 'crown', 'Mahmud\'un devleti yeniden doğuyor.', [E.cap(2000)]],
    ],
    [
      ['Hint Hazineleri', 'coin', 'Tapınaklardan gelen altın.', [E.mp(15000)]],
      ['Kabil Yolu', 'banner', 'Dağ geçitleri güvenli.', [E.speed(0.1)]],
      ['Pencap Ovası', 'coin', 'Beş ırmağın bereketi.', [E.mpm(0.15)]],
      ['Bîrûnî\'nin Gözlemevi', 'scroll', 'Bilim ve mühendislik.', [E.org(0.1), E.siege(0.1)]],
      ['Sind\'e Karşı', 'banner', 'Multan ve Mansura\'daki İsmaililer.', [E.cb(['SIN'])]],
      ['Gazne\'nin İhtişamı', 'coin', 'Doğunun en parlak sarayı.', [E.mpm(0.15)]],
    ],
    [
      ['Türk Gulamları', 'helm', 'Sultana bağlı atlılar.', [E.atk(0.1)]],
      ['Savaş Filleri', 'axe', 'Hint fillerinin gücü.', [E.atk(0.1), E.def(0.05)]],
      ['Atlı Okçular', 'spear', 'Bozkır taktikleri.', [E.speed(0.1)]],
      ['Hindistan Seferleri', 'sword', 'Kanauj ve Delhi\'ye yürüyüş.', [E.cb(['TOM', 'CHH', 'KAS'])]],
      ['Dağ Kaleleri', 'castle', 'Afganistan\'ın kartal yuvaları.', [E.def(0.15)]],
      ['Mahmud\'un Ordusu', 'sword', 'On yedi Hindistan seferinin ordusu yeniden kuruluyor.', [E.armies(2), E.org(0.1)]],
    ],
    ['Hindistan\'ın Fatihi', 'dragon', 'Ganj ovası Gazne\'ye bağlanıyor.', [E.cap(1500), E.cb(['PAR', 'CHN'])]],
  );

  // ---------------------------------------------------------------- Song
  T.SNG = tree('sng',
    [
      ['İmparatorluk Sınavları', 'scroll', 'Devlet adamları yetenekle seçilir.', [E.envoy()]],
      ['Qingli Reformları', 'scroll', 'Fan Zhongyan\'ın reformları.', [E.mpm(0.15)]],
      ['Sansür Dairesi', 'helm', 'Yolsuzluğa karşı denetim.', [E.org(0.1)]],
      ['Dali\'yi Haraca Bağla', 'banner', 'Güneybatıdaki krallık haraç verecek.', [E.cb(['DAL'])]],
      ['Haraç Sistemi', 'crown', 'Komşu krallar imparatora elçi gönderir.', [E.rel(['GOR', 'JAP', 'DAI'], 40)]],
      ['Cennetin Mandası', 'crown', 'Göğün oğlu bütün dünyaya hükmeder.', [E.cap(2000)]],
    ],
    [
      ['Büyük Kanal', 'ship', 'Kuzey ile güney birbirine bağlı.', [E.mp(15000)]],
      ['Champa Pirinci', 'coin', 'Yılda iki hasat veren pirinç.', [E.mpm(0.15)]],
      ['Kâğıt Para', 'coin', 'Jiaozi: dünyanın ilk kâğıt parası.', [E.mp(10000)]],
      ['Hazine Gemileri', 'ship', 'Quanzhou\'dan Hint Okyanusu\'na.', [E.dock(2), E.naval(0.2)]],
      ['Kaifeng Surları', 'castle', 'Başkent yeniden tahkim ediliyor.', [E.def(0.15)]],
      ['Song\'un Zenginliği', 'coin', 'Dünyanın en zengin imparatorluğu.', [E.mpm(0.15)]],
    ],
    [
      ['Barut', 'axe', 'Huoyao: ateş ilacı savaş alanında.', [E.siege(0.3), E.atk(0.05)]],
      ['Tetikli Yaylar', 'spear', 'Zırh delen arbaletler.', [E.def(0.1), E.atk(0.05)]],
      ['Sınır Orduları', 'helm', 'Kuzey sınırına yeni ordular.', [E.armies(3, 'Sınır Ordusu')]],
      ['Batı Xia\'ya Karşı', 'sword', 'Li Yuanhao\'nun imparatorluk iddiası kabul edilemez.', [E.cb(['XIA'])]],
      ['Đại Việt Seferi', 'banner', 'Güney sınırı güvenceye alınacak.', [E.cb(['DAI'])]],
      ['Wujing Zongyao', 'scroll', 'Askerî bilginin derlemesi.', [E.org(0.15), E.atk(0.05)]],
    ],
    ['On Altı Vilayeti Geri Al', 'dragon', 'Yanjing yeniden Çin\'in olacak.', [E.cb(['LIA']), E.cap(1500)]],
  );

  // ---------------------------------------------------------------- Liao
  T.LIA = tree('lia',
    [
      ['İkili Yönetim', 'scroll', 'Kitanlar ve Çinliler ayrı kanunlarla yönetilir.', [E.mpm(0.1)]],
      ['Budist Tapınakları', 'shield', 'İmparatorluk Buda\'nın koruması altında.', [E.org(0.15)]],
      ['Beş Başkent', 'castle', 'İmparatorluğun beş kalbi.', [E.def(0.1)]],
      ['Goryeo Seferi', 'banner', 'Kore kralı haraç verecek.', [E.cb(['GOR'])]],
      ['Bozkır Boylarını Bağla', 'banner', 'Tatar, Merkit ve Kereyitler boyun eğecek.', [E.cb(['TAT', 'MER', 'KER'])]],
      ['Gök Kağan', 'crown', 'Bozkırın ve Çin\'in hükümdarı.', [E.cap(2000)]],
    ],
    [
      ['Song Haracı', 'coin', 'Shanyuan Antlaşması\'nın gümüşü.', [E.mp(15000)]],
      ['Sürüler', 'coin', 'Sayısız at ve koyun.', [E.mpm(0.15)]],
      ['Demir Ocakları', 'axe', 'Kitan demircileri.', [E.atk(0.05)]],
      ['Bozkır Yolları', 'banner', 'Ordular hızla yer değiştirir.', [E.speed(0.1)]],
      ['Bohai Limanları', 'ship', 'Doğu denizine açılış.', [E.dock(1), E.naval(0.1)]],
      ['Kitan Altını', 'coin', 'İmparatorluk hazinesi dolu.', [E.mpm(0.1), E.mp(8000)]],
    ],
    [
      ['Ordo Muhafızları', 'helm', 'İmparatorun seçkin atlıları.', [E.atk(0.1)]],
      ['Kitan Atlıları', 'spear', 'Bozkırın en hızlı süvarisi.', [E.speed(0.15)]],
      ['Çinli Mühendisler', 'castle', 'Kuşatma sanatı.', [E.siege(0.3)]],
      ['Ordos\'u Kontrol Et', 'sword', 'Tangutlar haddini bilmeli.', [E.cb(['XIA'])]],
      ['Cürçenleri Bastır', 'axe', 'Doğudaki ormanların savaşçıları tehlikeli.', [E.cb(['JUR'])]],
      ['Kuşatıcı Atlılar', 'spear', 'Düşmanı çevrele, yok et.', [E.atk(0.1), E.org(0.1)]],
    ],
    ['Güneye Yürüyüş', 'dragon', 'Kaifeng\'in kapıları Kitanlara açılacak.', [E.cb(['SNG']), E.cap(1500)]],
  );

  Object.assign(G.FOCUS_TREES, T);
})();
