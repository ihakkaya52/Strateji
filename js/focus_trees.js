// Odak ağaçları: 10 büyük güce özel ağaçlar ve diğer bütün ülkeler için ortak ağaç.
// Ortak ağaçta üç kol (siyasi, ekonomik, askerî) ve bir final vardır; büyük güçlerin ağaçları beş kollu ve 56 odaklıdır.
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
    gold: v => ({ text: `+${G.fmtNum(v)} altın`, fn: n => { n.gold = (n.gold || 0) + v; } }),
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

  // Büyük güçler için geniş yerleşim (56 odak, 9 satır). Her kol kendi sütun bandında:
  //   P siyaset (x 0-2) · D diplomasi/din, birbirini dışlayan iki yol (x 3-4) · E ekonomi (x 5-7)
  //   M ordu/teknoloji (x 8-10) · S ulusa özel kol (x 11-12) · zirve ve final ortada.
  // Her satır: [x, y, ebeveyn indeksleri]
  const SHAPE = {
    p: [[1, 0], [0, 1, [0]], [2, 1, [0]], [0, 2, [1]], [2, 2, [2]], [1, 3, [3, 4]],
      [0, 4, [5]], [2, 4, [5]], [0, 5, [6]], [2, 5, [7]], [1, 6, [8, 9]]],
    d: [[3.5, 0], [3, 1, [0]], [4, 1, [0]], [3.5, 2, [1, 2]], [3, 3, [3]], [4, 3, [3]],
      [3, 4, [4]], [4, 4, [5]], [3, 5, [6]], [4, 5, [7]]],
    e: [[6, 0], [5, 1, [0]], [7, 1, [0]], [5, 2, [1]], [7, 2, [2]], [6, 3, [3, 4]],
      [5, 4, [5]], [7, 4, [5]], [5, 5, [6]], [7, 5, [7]], [6, 6, [8, 9]]],
    m: [[9, 0], [8, 1, [0]], [10, 1, [0]], [8, 2, [1]], [9, 2, [1, 2]], [10, 2, [2]],
      [9, 3, [3, 4, 5]], [8, 4, [6]], [10, 4, [6]], [8, 5, [7]], [10, 5, [8]], [9, 6, [9, 10]]],
    s: [[11.5, 0], [11, 1, [0]], [12, 1, [0]], [11, 2, [1]], [12, 2, [2]], [11.5, 3, [3, 4]],
      [11, 4, [5]], [12, 4, [5]], [11.5, 5, [6, 7]], [11.5, 6, [8]]],
  };
  // D kolunda 4 ve 5 numaralı odaklar birbirini dışlar (iki farklı yol)
  const big = (p, spec) => {
    const out = [];
    const id = (k, i) => `${p}_${k}${i}`;
    for (const k of ['p', 'd', 'e', 'm', 's']) {
      const shape = SHAPE[k], list = spec[k];
      if (list.length !== shape.length) throw new Error(`Odak ağacı ${p}.${k}: ${list.length} != ${shape.length}`);
      list.forEach((c, i) => {
        const [x, y, req] = shape[i];
        const extra = k === 'd' && (i === 4 || i === 5) ? { mutex: [id('d', i === 4 ? 5 : 4)] } : undefined;
        out.push(F(id(k, i), x, y, ...c, req && req.map(r => id(k, r)), extra));
      });
    }
    const ends = ['p', 'e', 'm', 's'].map(k => id(k, SHAPE[k].length - 1));
    out.push(F(`${p}_cap`, 6, 7, ...spec.cap, ends));
    out.push(F(`${p}_fin`, 6, 8, ...spec.fin, [`${p}_cap`]));
    for (const f of out) {
      if (f.mutex) f.effectText += ` · Kapatır: ${f.mutex.map(m => out.find(o => o.id === m).name).join(', ')}`;
    }
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
  T.BYZ = big('byz', {
    p: [
      ['Mihail\'in Sarayı', 'scroll', 'IV. Mihail\'in sarayında hadım Yuhanna devletin iplerini elinde tutuyor. Düzen kurulmalı.', [E.envoy()]],
      ['Hadım Yuhanna\'yı Uzaklaştır', 'helm', 'Orphanotrophos Yuhanna\'nın yeğenlerini kayıran düzenine son.', [E.org(0.05), E.mpm(0.05)]],
      ['Konstantinos Monomakhos', 'crown', 'İmparatoriçe Zoe ile evlenen Monomakhos tahta çıkıyor.', [E.ruler('IX. Konstantinos Monomakhos'), E.gold(100)]],
      ['Senato Aristokrasisi', 'scroll', 'Başkentin sivil bürokratları devleti yönetiyor.', [E.mpm(0.05), E.gold(80)]],
      ['Hukuk Okulu', 'scroll', 'Nomophylax\'ın yönettiği yeni hukuk okulu devlete kâtip yetiştiriyor.', [E.org(0.05)]],
      ['Askerî Aristokrasiyle Barış', 'shield', 'Doukas ve Komnenos aileleri tahta bağlanıyor; iç savaş tehlikesi azalıyor.', [E.def(0.05), E.mp(6000)]],
      ['Doukas Hanedanı', 'crown', 'X. Konstantinos Doukas ile sivil soylular iktidarda.', [E.ruler('X. Konstantinos Doukas'), E.gold(120)]],
      ['Romanos Diogenes', 'helm', 'Kapadokyalı asker imparator doğu sınırını kurtarmaya ant içiyor.', [E.atk(0.05), E.armies(1, 'Diogenes Ordusu')]],
      ['Psellos\'un Kalemi', 'scroll', 'Filozof Mihail Psellos sarayın danışmanı ve tarihçisi.', [E.envoy()]],
      ['Malazgirt Hazırlıkları', 'banner', 'Bütün themalardan asker toplanıyor; bu kez Türkler durdurulacak.', [E.cap(1000), E.mp(8000)]],
      ['Komnenos Restorasyonu', 'crown', 'I. Aleksios Komnenos imparatorluğu yıkımın eşiğinden geri çekiyor.', [E.ruler('I. Aleksios Komnenos'), E.org(0.1), E.mpm(0.05)]],
    ],
    d: [
      ['Patrikhaneyle Uzlaşma', 'shield', 'Patrik Kerularios ile taç aynı safta.', [E.org(0.05)]],
      ['Kiev ile Evlilik Bağı', 'crown', 'Monomakhos\'un kızı Kiev prensi Vsevolod ile evleniyor.', [E.rel(['KIE'], 50)]],
      ['Fâtımîlerle Ateşkes', 'scroll', 'Kutsal Kabir Kilisesi\'nin yeniden inşası için Kahire ile anlaşma.', [E.rel(['FAT'], 40), E.envoy()]],
      ['Büyük Ayrılık', 'scroll', '1054: Roma ile Konstantinopolis birbirini aforoz ediyor. Ortodoksluk kendi yolunda.', [E.org(0.05), E.def(0.05)]],
      ['Latinlerle Yakınlaşma', 'crown', 'Batının şövalyeleri ve tüccarlarıyla ittifak.', [E.rel(['VEN', 'PAP'], 50), E.gold(100)]],
      ['Bozkır Diplomasisi', 'spear', 'Kuman hanlarıyla anlaşıp Peçeneklere karşı kullan.', [E.rel(['KIP'], 60)]],
      ['Venedik Altın Bullası', 'ship', '1082: Venedikli tüccarlara gümrüksüz ticaret karşılığında donanma desteği.', [E.naval(0.1), E.dock(1)]],
      ['Levunion Zaferi', 'axe', '1091: Kumanlarla birlikte Peçenek halkı yok ediliyor.', [E.cb(['PEC']), E.atk(0.05)]],
      ['Haçlı Çağrısı', 'banner', 'Piacenza\'ya giden elçiler Papa II. Urbanus\'tan yardım istiyor.', [E.rel(['PAP', 'FRA', 'HRE'], 50), E.cb(['SEL'])]],
      ['Türk Paralı Askerleri', 'helm', 'Selçuklu emirleri imparatorun hizmetine alınıyor.', [E.armies(2, 'Türk Paralı Alayı'), E.rel(['SEL'], 30)]],
    ],
    e: [
      ['Altın Solidus', 'coin', 'Akdeniz\'in en güvenilir sikkesi.', [E.gold(150)]],
      ['İpek Tekeli', 'coin', 'İpek atölyeleri yalnızca imparatora çalışır.', [E.gold(100), E.mpm(0.05)]],
      ['Thema Vergileri', 'scroll', 'Taşra vergileri yeniden sayılıyor.', [E.mpm(0.05)]],
      ['Bizans Loncaları', 'coin', 'Eparkhos\'un Kitabı ile şehir esnafı düzenleniyor.', [E.gold(100)]],
      ['Anadolu Tahıl Ambarları', 'coin', 'Anadolu ovalarının buğdayı başkenti besliyor.', [E.mpm(0.05), E.mp(8000)]],
      ['Şehirlerin Kraliçesi', 'castle', 'Konstantinopolis dünyanın merkezi.', [E.mpm(0.1)]],
      ['Selanik Panayırı', 'coin', 'Aziz Dimitrios panayırına bütün Balkanlar\'dan tüccar geliyor.', [E.gold(120)]],
      ['Trabzon Limanı', 'ship', 'Karadeniz ticareti Trabzon\'dan akıyor.', [E.mp(6000), E.dock(1)]],
      ['Pronoia Sistemi', 'coin', 'Toprak gelirleri askerlik karşılığında soylulara veriliyor.', [E.mpm(0.1), E.cap(500)]],
      ['Ermeni Tüccarlar', 'coin', 'Doğu ticaret yolları Ermeni tüccarların elinde.', [E.gold(100)]],
      ['Hyperpyron Reformu', 'coin', '1092: Değeri düşen sikke yerine yeni altın hyperpyron basılıyor.', [E.gold(200), E.mpm(0.05)]],
    ],
    m: [
      ['Tagmata', 'helm', 'Başkentin seçkin alayları.', [E.armies(2, 'Tagma')]],
      ['Varangian Muhafızları', 'axe', 'İmparatorun baltalı Kuzeyli muhafızları.', [E.atk(0.05)]],
      ['Akritai Sınır Muhafızları', 'shield', 'Doğu sınırının efsanevi bekçileri.', [E.def(0.05)]],
      ['Harald Hardrada\'nın Baltası', 'axe', 'Varangların komutanı Harald, Sicilya\'dan Bulgaristan\'a savaşıyor.', [E.atk(0.05), E.org(0.05)]],
      ['Kataphraktoi', 'spear', 'Baştan aşağı zırhlı ağır süvari.', [E.atk(0.05), E.speed(0.05)]],
      ['Theodosius Surları', 'castle', 'Bin yıldır aşılamayan surlar onarılıyor.', [E.def(0.1)]],
      ['Yeni Strategikon', 'scroll', 'Kekaumenos\'un öğütleriyle savaş sanatı yeniden yazılıyor.', [E.org(0.1)]],
      ['Kuşatma Mühendisleri', 'castle', 'Helepolis kuleleri ve mancınık ustaları.', [E.siege(0.2)]],
      ['Doğu Kaleleri', 'castle', 'Malatya, Urfa ve Antakya tahkim ediliyor; sınır beyleri hizaya gelecek.', [E.def(0.05), E.cb(['MRW', 'UKA'])]],
      ['Ermeni Krallıklarını İlhak', 'crown', 'Ani ve Lori imparatorluğa katılacak.', [E.cb(['ANI', 'LOR'])]],
      ['Malazgirt\'e Yürüyüş', 'banner', 'Selçuklu akınlarına kaynağında son verilecek.', [E.cb(['SEL']), E.atk(0.05)]],
      ['Komnenos Ordusu', 'sword', 'Aleksios\'un yeniden kurduğu ordu: paralı askerler ve sadık soylular.', [E.org(0.1), E.cap(1000), E.armies(1, 'Komnenos Ordusu')]],
    ],
    s: [
      ['Basileia Donanması', 'ship', 'İmparatorluk filosu yeniden donatılıyor.', [E.naval(0.1)]],
      ['Rum Ateşi', 'ship', 'Suyla sönmeyen sır silah.', [E.naval(0.15)]],
      ['Sicilya\'yı Geri Al', 'ship', 'Maniakes\'in yarım kalan seferi tamamlanacak.', [E.cb(['SIC'])]],
      ['Ateş Sifonları', 'ship', 'Rum ateşi surlarda ve kuşatmalarda da kullanılıyor.', [E.naval(0.05), E.siege(0.1)]],
      ['İtalya Katepanlığı', 'banner', 'Bari, Normanlara ve Lombardlara karşı savunulacak.', [E.def(0.05), E.cb(['SAL', 'BEN'])]],
      ['İmparatorluk Tersaneleri', 'ship', 'Altın Boynuz\'da yeni kızaklar.', [E.dock(2)]],
      ['Balkanları Sindir', 'banner', 'Hırvat ve Duklja isyanları bastırılacak.', [E.cb(['CRO', 'DUK'])]],
      ['Kıbrıs ve Girit Filoları', 'ship', 'Adaların filoları korsanları temizliyor.', [E.naval(0.1), E.mp(5000)]],
      ['Dyrrhachion Savunması', 'castle', 'Guiscard\'ın Normanları Adriyatik\'te durdurulacak.', [E.def(0.1)]],
      ['Ege\'nin Efendisi', 'ship', 'Ege ve Doğu Akdeniz yeniden Roma gölü.', [E.naval(0.1), E.gold(100)]],
    ],
    cap: ['Romalıların Basileus\'u', 'crown', 'Tanrı\'nın yeryüzündeki temsilcisi, Romalıların tek imparatoru.', [E.atk(0.05), E.def(0.05), E.cap(1500)]],
    fin: ['Roma\'nın Yeniden Doğuşu', 'dragon', 'Justinianus\'un imparatorluğu geri dönüyor.', [E.cb(['FAT', 'SEL']), E.mpm(0.1), E.org(0.1)]],
  });

  // ---------------------------------------------------------------- Büyük Selçuklu
  T.SEL = big('sel', {
    p: [
      ['Dandanakan\'ın Mirası', 'banner', 'Gazneliler yenildi, Horasan bizim.', [E.mp(10000)]],
      ['Tuğrul Bey\'in Hükümdarlığı', 'crown', 'Tuğrul Bey Nişabur\'da sultan ilan ediliyor.', [E.envoy(), E.gold(100)]],
      ['Oğuz Boylarını Birleştir', 'spear', 'Yirmi dört boy tek sancak altında.', [E.armies(2, 'Oğuz Ordusu')]],
      ['Divan Teşkilatı', 'scroll', 'Fars kâtipler ve divanlar devleti düzenliyor.', [E.mpm(0.05)]],
      ['Türkmen Göçünü Yönlendir', 'spear', 'Türkmen obaları uç bölgelerine yerleştiriliyor.', [E.mp(8000), E.speed(0.05)]],
      ['Bağdat\'a Giriş', 'banner', '1055: Tuğrul Bey Bağdat\'a giriyor, Büveyhîlerin devri bitiyor.', [E.cb(['BUY']), E.rel(['ABB'], 60)]],
      ['Doğunun ve Batının Sultanı', 'crown', 'Halife Tuğrul Bey\'e doğunun ve batının sultanı unvanını veriyor.', [E.cap(1000), E.def(0.05)]],
      ['Alp Arslan', 'helm', 'Tuğrul\'un yeğeni Alp Arslan tahtta: cesur ve adil bir sultan.', [E.ruler('Alp Arslan'), E.atk(0.05)]],
      ['Kutalmışoğlu İsyanını Bastır', 'axe', 'Taht iddiacısı Kutalmış yenilecek.', [E.def(0.05), E.org(0.05)]],
      ['Melikşah Dönemi', 'crown', 'Melikşah ile devlet en geniş sınırlarına ulaşıyor.', [E.ruler('Melikşah'), E.mpm(0.1)]],
      ['Nizâmülmülk\'ün Vezirliği', 'scroll', 'Büyük vezir Nizâmülmülk otuz yıl devleti yönetiyor; Siyasetnâme yazılıyor.', [E.envoy(), E.org(0.1), E.gold(100)]],
    ],
    d: [
      ['Halifenin Koruyucusu', 'crown', 'Abbâsî halifesi Sünnî dünyanın önderi; sultan onun kılıcı.', [E.rel(['ABB'], 60)]],
      ['Sünnî İhyası', 'scroll', 'Şiî Büveyhî ve Fâtımî davetine karşı Sünnî âlimler destekleniyor.', [E.org(0.05)]],
      ['Karahanlılarla Barış', 'scroll', 'Mâverâünnehir sınırında barış.', [E.rel(['KHA'], 50)]],
      ['Nizamiye Medreseleri', 'scroll', 'Bağdat\'tan Nişabur\'a devlete adam yetiştiren okullar.', [E.org(0.05), E.envoy()]],
      ['Anadolu Uç Beyleri', 'banner', 'Türkmen beyleri Rum diyarına akın ediyor.', [E.cb(['BYZ']), E.speed(0.05)]],
      ['Suriye ve Hicaz Seferi', 'banner', 'Fâtımî nüfuzu Suriye\'den silinecek.', [E.cb(['MIR', 'NUM'])]],
      ['Süleyman Şah\'ın Seferi', 'axe', 'Kutalmışoğlu Süleyman Anadolu\'nun içlerine yürüyor.', [E.armies(1, 'Süleyman Şah'), E.cb(['GEO'])]],
      ['Atsız\'ın Kudüs\'ü', 'sword', '1073: Kudüs ve Dımaşk Fâtımîlerden alınıyor.', [E.cb(['FAT']), E.atk(0.05)]],
      ['Rum Sultanlığı', 'crown', 'İznik merkezli yeni bir Selçuklu kolu Anadolu\'yu Türk yurdu yapıyor.', [E.cap(1000), E.mpm(0.05)]],
      ['Haremeyn\'de Abbâsî Hutbesi', 'crown', 'Mekke ve Medine\'de hutbe yeniden Abbâsî halifesi adına.', [E.rel(['ABB'], 40), E.org(0.1)]],
    ],
    e: [
      ['İkta Sistemi', 'coin', 'Askere toprak, devlete asker.', [E.mpm(0.1)]],
      ['Kervansaraylar', 'coin', 'Yollar güvenli, kervanlar zengin.', [E.gold(100), E.speed(0.05)]],
      ['Horasan Şehirleri', 'castle', 'Merv ve Nişabur tahkim ediliyor.', [E.def(0.05)]],
      ['Merv Pazarı', 'coin', 'Horasan\'ın incisi yeniden canlanıyor.', [E.gold(120)]],
      ['Kanat Sulama', 'coin', 'Yeraltı kanalları kurak toprakları yeşertiyor.', [E.mpm(0.05)]],
      ['İsfahan\'ı Başkent Yap', 'banner', 'İran\'ın kalbi Selçuklu olacak.', [E.cb(['KAK', 'ZIY'])]],
      ['Celâlî Takvimi', 'scroll', 'Ömer Hayyam\'ın rasathanesi yeni bir takvim hazırlıyor.', [E.org(0.05), E.gold(80)]],
      ['Tebriz-Bağdat Yolu', 'coin', 'Azerbaycan\'dan Irak\'a kervan yolu.', [E.mp(8000)]],
      ['Atabeylik Kurumu', 'helm', 'Şehzadelerin yanında deneyimli atabeyler.', [E.def(0.05), E.mp(6000)]],
      ['Selçuklu Altını', 'coin', 'Hazine dolu, ordu maaşını alıyor.', [E.mp(12000)]],
      ['İpek Yolu\'nun Efendisi', 'coin', 'Doğudan batıya her kervan bizden geçer.', [E.mpm(0.1), E.gold(150)]],
    ],
    m: [
      ['Atlı Okçular', 'spear', 'Bozkırın rüzgârı.', [E.speed(0.1)]],
      ['Gulam Ordusu', 'helm', 'Sultana bağlı köle askerler.', [E.atk(0.05)]],
      ['Hassa Askerleri', 'helm', 'Sultanın kendi atlı muhafızları.', [E.armies(1, 'Hassa Ordusu')]],
      ['Sahte Ricat Taktiği', 'sword', 'Kaçıyor gibi yap, döndüğünde vur.', [E.atk(0.05), E.def(0.05)]],
      ['Türkmen Akıncıları', 'axe', 'Hafif atlı akıncılar düşman topraklarını yakıp yıkıyor.', [E.speed(0.05), E.mp(6000)]],
      ['Gaznelileri Bitir', 'banner', 'Mesud\'un devleti tarihe karışacak.', [E.cb(['GAZ'])]],
      ['Ani\'nin Fethi', 'castle', '1064: Alp Arslan Ermeni başkentini kuşatıyor.', [E.cb(['ANI', 'LOR']), E.siege(0.1)]],
      ['Kuşatma Ustaları', 'castle', 'Fars ve Arap mühendisler orduya katılıyor.', [E.siege(0.2)]],
      ['Gürcü Seferi', 'banner', 'Kafkas krallıkları haraç verecek.', [E.cb(['GEO', 'KKH'])]],
      ['Malazgirt Ruhu', 'sword', 'Hiçbir ordu bozkırın atlılarını durduramaz.', [E.atk(0.05), E.org(0.05)]],
      ['Zırhlı Gulam Süvarisi', 'spear', 'Ağır zırhlı gulamlar atlı okçuların arkasında.', [E.atk(0.05), E.cap(500)]],
      ['Sultan\'ın Ordusu', 'sword', 'Gazi ruhu ve disiplin bir arada.', [E.org(0.1), E.cap(1000), E.armies(2, 'Sultan Ordusu')]],
    ],
    s: [
      ['Yabgu\'nun Mirası', 'banner', 'Cend\'deki Oğuz yabgusu Selçuklulara boyun eğmeli.', [E.cb(['OGU'])]],
      ['Harezm\'i Bağla', 'banner', 'Aral kıyısındaki zengin vaha.', [E.cb(['KHW'])]],
      ['Kirman Melikliği', 'crown', 'Kavurt Bey güneyde kendi melikliğini kuruyor.', [E.mp(8000)]],
      ['Ceyhun Kaleleri', 'castle', 'Amuderya geçitleri tahkim ediliyor.', [E.def(0.05)]],
      ['Umman Seferi', 'ship', 'Kavurt Bey körfezi aşıp Umman\'a çıkıyor.', [E.cb(['OMA']), E.dock(1)]],
      ['Doğu Sınırı', 'banner', 'Horasan\'dan Fergana\'ya sınır güvende.', [E.def(0.05), E.mpm(0.05)]],
      ['Semerkand Seferi', 'sword', '1089: Melikşah Karahanlıları tâbi kılıyor.', [E.cb(['KHA'])]],
      ['Basra Körfezi', 'ship', 'Körfez limanları sultanın gümrüğüne bağlı.', [E.naval(0.1), E.gold(80)]],
      ['Mâverâünnehir', 'crown', 'Buhara ve Semerkand Selçuklu hutbesi okuyor.', [E.mpm(0.05), E.envoy()]],
      ['Cihan Sultanlığı', 'crown', 'Kaşgar\'dan Kudüs\'e tek sultan.', [E.cap(1000), E.def(0.05)]],
    ],
    cap: ['Büyük Selçuklu', 'crown', 'Türk-İslâm dünyasının en büyük devleti.', [E.atk(0.05), E.cap(1000), E.mpm(0.05)]],
    fin: ['Diyar-ı Rum\'un Kapıları', 'dragon', 'Anadolu ve Mısır yolu açık.', [E.cb(['BYZ', 'FAT']), E.atk(0.05), E.org(0.1)]],
  });

  // ---------------------------------------------------------------- Fâtımî
  T.FAT = big('fat', {
    p: [
      ['el-Müstansır\'ın Tahtı', 'crown', 'Altmış yıl hüküm sürecek imam-halife el-Müstansır.', [E.envoy()]],
      ['Valide\'nin Naipliği', 'scroll', 'Halifenin Sudanlı annesi sarayda söz sahibi.', [E.mp(6000)]],
      ['Vezir el-Yâzûrî', 'scroll', 'Becerikli vezir hazineyi ve tahıl ambarlarını düzene sokuyor.', [E.gold(100), E.mpm(0.05)]],
      ['Saray Hiziplerini Dengele', 'shield', 'Türk ve Sudanlı alaylar arasındaki kan davası yatıştırılmalı.', [E.org(0.05), E.def(0.05)]],
      ['Büyük Kıtlığa Hazırlık', 'coin', 'Nil yedi yıl taşmazsa ambarlar dolu olmalı.', [E.mpm(0.05), E.mp(8000)]],
      ['Bedr el-Cemâlî\'yi Çağır', 'helm', '1073: Akka valisi Ermeni ordusuyla Kahire\'ye çağrılıyor.', [E.armies(1, 'Ermeni Muhafızları'), E.atk(0.05)]],
      ['Seyfü\'l-İmam', 'sword', 'Ordular emiri vezir, devletin gerçek hâkimi.', [E.org(0.1)]],
      ['Kahire\'nin Yeni Surları', 'castle', 'Taş surlar ve Bâbü\'n-Nasr kapısı.', [E.def(0.1)]],
      ['Ermeni Vezirler', 'helm', 'Yetenekli Ermeni komutanlar ordunun başında.', [E.atk(0.05), E.cap(500)]],
      ['Bâbü\'l-Fütûh', 'castle', 'Fetihler Kapısı: Kahire bir kale şehre dönüşüyor.', [E.def(0.05), E.siege(0.1)]],
      ['el-Efdal Şâhinşâh', 'crown', 'Bedr\'in oğlu el-Efdal devleti yeniden ayağa kaldırıyor.', [E.envoy(), E.mpm(0.05), E.cap(500)]],
    ],
    d: [
      ['Dâî Ağı', 'scroll', 'Davetçiler her şehirde gizlice çalışıyor.', [E.envoy()]],
      ['el-Ezher', 'scroll', 'İlmin merkezi Kahire.', [E.org(0.05)]],
      ['Bağdat\'ta Fâtımî Hutbesi', 'crown', '1058: Besâsîrî Bağdat\'ta hutbeyi el-Müstansır adına okutuyor.', [E.cb(['ABB', 'BUY'])]],
      ['Dârü\'l-İlm', 'scroll', 'İlim evinde davetçiler yetişiyor.', [E.envoy(), E.rel('nb', 20)]],
      ['Nizâr\'ı Veliaht Tanı', 'crown', 'Halifenin büyük oğlu Nizâr meşru imam.', [E.mp(6000), E.cb(['SEL'])]],
      ['Müsta\'lî\'yi Tahta Çıkar', 'crown', 'el-Efdal\'in desteklediği genç Müsta\'lî imam oluyor.', [E.def(0.05), E.mpm(0.05)]],
      ['Hasan Sabbah\'ın Davetçileri', 'scroll', 'Yeni davet İran dağlarında yayılıyor.', [E.org(0.05), E.envoy()]],
      ['Süleyhî Yemen', 'banner', 'Yemen\'in Süleyhî kraliçesi Kahire\'ye bağlı.', [E.rel(['ZAY'], 50), E.cb(['NAJ'])]],
      ['Alamut\'un Fedaileri', 'sword', 'Kartal yuvasındaki fedailer sultanları titretiyor.', [E.atk(0.05), E.def(0.05)]],
      ['Hind Davası', 'ship', 'Gücerat ve Sind\'deki davetçiler Kızıldeniz ticaretini besliyor.', [E.gold(150), E.mpm(0.05)]],
    ],
    e: [
      ['Nil Bereketi', 'coin', 'Nil taşkınları ambarları dolduruyor.', [E.mpm(0.1)]],
      ['Nilometre', 'scroll', 'Ravza\'daki ölçek taşkını ve vergiyi belirliyor.', [E.mpm(0.05)]],
      ['Kızıldeniz Ticareti', 'ship', 'Hint malları Kahire\'den Akdeniz\'e.', [E.dock(1), E.gold(100)]],
      ['Fustat Pazarları', 'coin', 'Dünyanın dört bir yanından tüccar.', [E.gold(100)]],
      ['Ayzâb Limanı', 'ship', 'Hac ve baharat yolunun Kızıldeniz kapısı.', [E.mp(6000), E.gold(80)]],
      ['Hint Ticareti', 'coin', 'Aden\'den gelen gemiler.', [E.mpm(0.05), E.gold(120)]],
      ['Tiraz Atölyeleri', 'coin', 'Halife adına işlenen keten ve ipek.', [E.gold(100)]],
      ['Kârimî Tüccarları', 'coin', 'Baharat tüccarlarının büyük ortaklıkları.', [E.mpm(0.05)]],
      ['Kıpti ve Yahudi Kâtipler', 'scroll', 'Divanların usta kâtipleri.', [E.envoy()]],
      ['İskenderiye Limanı', 'ship', 'Akdeniz\'in en büyük limanı.', [E.dock(1), E.naval(0.05)]],
      ['Fâtımî Altını', 'coin', 'Dünyanın en saf altın sikkesi.', [E.mp(15000), E.gold(150), E.mpm(0.05)]],
    ],
    m: [
      ['Sudanlı Piyadeler', 'spear', 'Nil\'in güneyinden gelen savaşçılar.', [E.armies(2, 'Sudan Alayı')]],
      ['Türk Gulamları', 'helm', 'Atlı okçu köle askerler.', [E.atk(0.05)]],
      ['Kütâme Süvarileri', 'spear', 'Fâtımî davasının ilk Berberî savaşçıları.', [E.speed(0.1)]],
      ['Ermeni Okçular', 'spear', 'Bedr\'in getirdiği okçu alayları.', [E.atk(0.05)]],
      ['Saray Muhafızları', 'helm', 'Hücerîye: halifenin genç muhafızları.', [E.def(0.05), E.org(0.05)]],
      ['Suriye\'yi Sağlamlaştır', 'castle', 'Halep ve Dımaşk tahkim edilecek; bedevi beyler susacak.', [E.def(0.05), E.cb(['MIR', 'NUM'])]],
      ['Askerî İkta', 'coin', 'Komutanlara gelir karşılığında asker.', [E.mpm(0.05), E.cap(500)]],
      ['Kudüs Garnizonu', 'castle', 'Kutsal şehir sağlam bir garnizonla korunacak.', [E.def(0.1)]],
      ['Sur ve Akka Kaleleri', 'castle', 'Sahil kaleleri tahkim ediliyor.', [E.def(0.05), E.siege(0.1)]],
      ['Filistin Ordusu', 'banner', 'Askalan\'da yeni bir sahra ordusu.', [E.armies(1, 'Filistin Ordusu')]],
      ['Halep\'e Yürüyüş', 'banner', 'Kuzey Suriye yeniden Fâtımî olacak.', [E.cb(['MIR', 'UKA']), E.atk(0.05)]],
      ['Kutsal Şehirlerin Koruyucusu', 'sword', 'Mekke, Medine ve Kudüs bizim korumamızda.', [E.org(0.1), E.cap(1000)]],
    ],
    s: [
      ['Fâtımî Donanması', 'ship', 'Akdeniz\'in hâkimi olacak filolar.', [E.naval(0.1)]],
      ['Zîrîleri Hizaya Getir', 'banner', 'İfrîkıye\'deki asi vasal cezalandırılacak.', [E.cb(['ZIR'])]],
      ['Mehdiye\'nin Mirası', 'castle', 'Fâtımî davasının ilk başkenti unutulmadı.', [E.def(0.05)]],
      ['Benî Hilâl\'i Salıver', 'axe', 'Bedevi kabileler Mağrib\'e salınıyor.', [E.cb(['ZIR', 'HAM']), E.atk(0.05)]],
      ['Sicilya Kelbîleri', 'ship', 'Sicilya emirleri Normanlara karşı destekleniyor.', [E.rel(['SIC'], 50), E.naval(0.05)]],
      ['Akdeniz Filoları', 'ship', 'Yeni kadırgalar denize iniyor.', [E.dock(1), E.naval(0.1)]],
      ['Berka ve Fizan', 'banner', 'Libya çölünün vahaları kervan yolunu açacak.', [E.cb(['FZN'])]],
      ['Kızıldeniz Filosu', 'ship', 'Nubya ile bakt antlaşması yenileniyor.', [E.naval(0.05), E.rel(['MAK'], 40)]],
      ['İfrîkıye\'nin Geri Dönüşü', 'crown', 'Mağrib yeniden imamın hutbesini okuyor.', [E.cb(['ZIR', 'MAG'])]],
      ['Doğu Akdeniz\'in Hâkimi', 'ship', 'İskenderiye\'den Askalan\'a deniz bizim.', [E.naval(0.1), E.gold(100), E.def(0.05)]],
    ],
    cap: ['Tek Halifelik', 'crown', 'Ümmetin tek imamı Kahire\'de.', [E.cap(1000), E.atk(0.05), E.def(0.05)]],
    fin: ['Mehdî\'nin Vaadi', 'dragon', 'Fâtımî davası dünyayı saracak.', [E.cb(['SEL', 'BYZ']), E.mpm(0.1), E.org(0.1)]],
  });

  // ---------------------------------------------------------------- Kutsal Roma
  T.HRE = big('hre', {
    p: [
      ['Salyan Hanedanı', 'crown', 'III. Heinrich\'in hanedanı güçleniyor.', [E.envoy()]],
      ['Sutri Sinodu', 'scroll', '1046: İmparator üç papayı azlediyor; kilise reformu başlıyor.', [E.rel(['PAP'], 50)]],
      ['Ministeriales', 'helm', 'İmparatora bağlı soylu hizmetkârlar.', [E.mpm(0.05)]],
      ['Roma\'da Taç Giyme', 'crown', 'Papa imparatoru Roma\'da taçlandırıyor.', [E.cap(1000)]],
      ['Agnes\'in Naipliği', 'scroll', 'Çocuk kral IV. Heinrich adına annesi hüküm sürüyor.', [E.def(0.05)]],
      ['Kaiserswerth\'ten Ders', 'shield', '1062: Köln başpiskoposu Anno genç kralı kaçırdı. Taç bir daha savunmasız kalmayacak.', [E.org(0.05)]],
      ['Goslar Sarayı', 'castle', 'Harz dağlarında imparatorluk sarayı.', [E.gold(120)]],
      ['Sakson İsyanlarını Bastır', 'axe', '1073: Saksonya imparatora bağlı kalacak.', [E.armies(1, 'Sakson Ordusu'), E.def(0.05)]],
      ['Langensalza Zaferi', 'sword', '1075: Unstrut kıyısında Sakson ordusu dağıtılıyor.', [E.atk(0.05)]],
      ['Prensleri Böl', 'scroll', 'Rakip prenslerin ittifakı dağıtılmalı.', [E.envoy()]],
      ['İmparatorluk Barışı', 'shield', '1103 Mainz Landfrieden\'i: bütün imparatorlukta barış yemini.', [E.mpm(0.05), E.org(0.05), E.gold(100)]],
    ],
    d: [
      ['Atama Tartışması', 'scroll', 'Papa VII. Gregorius piskoposları imparatorun atayamayacağını ilan ediyor.', [E.org(0.05)]],
      ['Worms Sinodu', 'scroll', '1076: Alman piskoposları papayı tanımadığını bildiriyor.', [E.envoy()]],
      ['Alman Piskoposları', 'shield', 'İmparatorluk kilisesinin şövalyeleri tahtın yanında.', [E.mp(6000)]],
      ['Kilise ile Hesaplaşma', 'crown', 'Ya papaya boyun eğilecek ya da papa devrilecek.', [E.def(0.05)]],
      ['Canossa\'ya Yürüyüş', 'shield', '1077: Kral karda yalınayak bekleyip aforozdan kurtuluyor.', [E.rel(['PAP'], 80), E.def(0.05)]],
      ['Karşı Papa', 'crown', 'Ravenna başpiskoposu III. Clemens adıyla papa ilan ediliyor.', [E.cb(['PAP']), E.atk(0.05)]],
      ['Prenslerle Uzlaşma', 'scroll', 'Karşı kral Rudolf\'un taraftarları affediliyor.', [E.mpm(0.05), E.gold(80)]],
      ['Roma Kuşatması', 'castle', '1084: İmparator Roma\'ya giriyor.', [E.siege(0.2)]],
      ['Worms Konkordatosu', 'scroll', '1122: Ruhani yetki kiliseye, dünyevi yetki imparatora.', [E.org(0.1), E.rel(['PAP'], 40)]],
      ['İmparatorluk Kilisesi', 'crown', 'Piskoposlar yalnızca imparatora hesap veriyor.', [E.cap(1000), E.mpm(0.05)]],
    ],
    e: [
      ['Goslar Gümüş Madenleri', 'coin', 'Rammelsberg\'in gümüşü hazineyi dolduruyor.', [E.gold(150)]],
      ['Ren Şehirleri', 'coin', 'Köln, Mainz ve Worms büyüyor.', [E.mpm(0.05)]],
      ['Kuzey Ticareti', 'ship', 'Bremen ve Hamburg denize açılıyor.', [E.dock(1)]],
      ['Köln Pazarı', 'coin', 'Ren\'in en büyük şehri.', [E.gold(100)]],
      ['Hamburg Gemicileri', 'ship', 'Kuzey Denizi\'nde Alman gemileri.', [E.naval(0.1), E.mp(5000)]],
      ['Orman Açma', 'coin', 'Rodung: ormanlar tarlaya dönüşüyor.', [E.mpm(0.1)]],
      ['Speyer Katedrali', 'castle', 'Salyan hanedanının mezar kilisesi.', [E.org(0.05)]],
      ['Alp Geçitleri', 'banner', 'Brenner ve Septimer yolları açık tutuluyor.', [E.speed(0.05)]],
      ['Ren Yahudi Tüccarları', 'coin', 'Worms ve Mainz\'ın tüccarları imparatorun korumasında.', [E.gold(120)]],
      ['Lombardiya Ticareti', 'coin', 'İtalya\'nın zenginliği Alpleri aşıyor.', [E.gold(100), E.mpm(0.05)]],
      ['Doğuya Yerleşim', 'banner', 'Slav topraklarına köylüler yerleşiyor.', [E.mpm(0.05), E.mp(12000), E.cb(['LUT', 'ABO'])]],
    ],
    m: [
      ['Zırhlı Şövalyeler', 'helm', 'Avrupa\'nın en ağır süvarisi.', [E.atk(0.05)]],
      ['Mızrak Hücumu', 'spear', 'Sıkı düzende mızrak hücumu.', [E.atk(0.05), E.speed(0.05)]],
      ['Kaleler Çağı', 'castle', 'Her tepede bir kale.', [E.def(0.1)]],
      ['Şövalye Ordusu', 'helm', 'Vasalların atlıları imparatorun sancağı altında.', [E.armies(2, 'Şövalye Ordusu')]],
      ['Kuşatma Ustaları', 'castle', 'Lombard mühendisler ordumuzda.', [E.siege(0.2)]],
      ['Harzburg', 'castle', 'İmparatorluk kaleleri Saksonya\'yı denetliyor.', [E.def(0.05)]],
      ['Feodal Askerlik', 'sword', 'Her prens seferde belirli sayıda atlı getirmek zorunda.', [E.mp(8000), E.cap(500)]],
      ['Macar Tahtı', 'banner', 'Macar tahtındaki karışıklık bir fırsat.', [E.cb(['HUN'])]],
      ['Doğu Markları', 'castle', 'Meissen ve Lusatia sınır kaleleri.', [E.def(0.05), E.cb(['LUT'])]],
      ['Pressburg Kuşatması', 'castle', 'Tuna kalesi düşmeli.', [E.siege(0.1), E.org(0.05)]],
      ['Polonya Üzerinde Süzerenlik', 'banner', 'Doğudaki krallar imparatorun vasalı olmalı.', [E.cb(['POL', 'POM', 'MAZ'])]],
      ['İmparatorluk Ordusu', 'sword', 'Bütün prensliklerden toplanan ordu.', [E.org(0.1), E.cap(1000), E.armies(1, 'İmparatorluk Ordusu')]],
    ],
    s: [
      ['İtalya Krallığı', 'crown', 'Alplerin ötesindeki ikinci taç.', [E.mp(6000)]],
      ['Lombard Şehirleri', 'banner', 'Kuzey İtalya şehirleri imparatora boyun eğecek.', [E.cb(['PIS', 'GEN'])]],
      ['Toskana Markgraflığı', 'shield', 'Kontes Matilda\'nın toprakları denetlenmeli.', [E.def(0.05)]],
      ['Venedik ile Antlaşma', 'ship', 'Lagün cumhuriyetiyle ticaret ve barış.', [E.rel(['VEN'], 50)]],
      ['Güney İtalya Normanları', 'banner', 'Guiscard\'ın Normanları imparatorun vasalı olacak.', [E.cb(['SAL', 'BEN', 'NAP'])]],
      ['İtalya Seferi', 'sword', 'İmparator ordusuyla Alpleri aşıyor.', [E.atk(0.05), E.speed(0.05)]],
      ['Pavia\'nın Demir Tacı', 'crown', 'Lombard krallarının tacı imparatorun başında.', [E.cap(500), E.gold(100)]],
      ['Ravenna', 'castle', 'İmparatorluk yanlısı başpiskoposluk İtalya\'daki üssümüz.', [E.def(0.05)]],
      ['Burgonya Krallığı', 'crown', 'Arelat tacı imparatorlukla birleşik.', [E.def(0.05), E.mpm(0.05)]],
      ['Üç Taç', 'crown', 'Almanya, İtalya ve Burgonya tek imparatorun.', [E.cap(500), E.envoy(), E.mp(8000)]],
    ],
    cap: ['Kayser', 'crown', 'Hristiyan âleminin dünyevi efendisi.', [E.atk(0.05), E.def(0.05), E.cap(1000)]],
    fin: ['Hristiyan Âleminin Efendisi', 'dragon', 'Charlemagne\'ın tacı Salyan hanedanında.', [E.cb(['FRA', 'HUN']), E.org(0.1), E.mpm(0.1)]],
  });

  // ---------------------------------------------------------------- Fransa
  T.FRA = big('fra', {
    p: [
      ['Capet Tacı', 'crown', 'Zayıf bir kral, güçlü bir hanedan.', [E.envoy()]],
      ['I. Henri\'nin Tahtı', 'crown', 'Kral kardeşinin isyanını atlatıp tahtını koruyor.', [E.def(0.05)]],
      ['Kraliyet Demesnesi', 'coin', 'Paris ile Orléans arası kralın kendi toprakları.', [E.mpm(0.05), E.gold(100)]],
      ['Kievli Anna ile Evlilik', 'crown', '1051: Yaroslav\'ın kızı Fransa kraliçesi oluyor.', [E.rel(['KIE'], 60)]],
      ['Saray Görevlileri', 'scroll', 'Seneschal, kâhya ve şansölye krallığı yönetiyor.', [E.org(0.05)]],
      ['I. Philippe', 'crown', '1060: Anna\'nın oğlu tahtta; Bizans adı taşıyan ilk Fransız kralı.', [E.ruler('I. Philippe'), E.envoy()]],
      ['Vexin\'i Al', 'banner', '1077: Normandiya sınırındaki stratejik kontluk krala geçiyor.', [E.mp(6000), E.cb(['ENG'])]],
      ['Bourges Vikontluğu', 'coin', '1101: Haçlı seferine giden vikontun toprakları satın alınıyor.', [E.gold(120)]],
      ['Haydut Baronlara Son', 'castle', 'Le Puiset ve Montlhéry kaleleri düşüyor; yollar güvenli.', [E.def(0.05), E.siege(0.1)]],
      ['Abbé Suger', 'scroll', 'Saint-Denis başrahibi kralın akıl hocası.', [E.envoy(), E.mpm(0.05)]],
      ['VI. Louis', 'crown', '1108: Şişman Louis büyük vasalları hizaya getiriyor.', [E.ruler('VI. Louis'), E.org(0.05), E.mpm(0.1), E.cap(500)]],
    ],
    d: [
      ['Cluny Reformu', 'scroll', 'Manastır reformu krallığı ayakta tutuyor.', [E.org(0.05), E.rel(['PAP'], 40)]],
      ['Tanrı\'nın Barışı', 'shield', 'Kilise, köylüleri ve din adamlarını şövalyelerin şiddetinden koruyor.', [E.def(0.05)]],
      ['Tanrı\'nın Ateşkesi', 'shield', 'Perşembeden pazartesiye savaş yasak.', [E.mpm(0.05)]],
      ['Normandiya Meselesi', 'banner', 'Genç dük William\'ın gücü artıyor. Kral ne yapmalı?', [E.mp(6000)]],
      ['Piç William\'ı Destekle', 'crown', '1047 Val-ès-Dunes: kral ve dük isyancı baronları birlikte eziyor.', [E.atk(0.05), E.armies(1, 'Norman Şövalyeleri')]],
      ['Varaville\'de Pusu', 'axe', 'Normandiya kralın vasalı olarak kalmalı; dükün gücü kırılacak.', [E.def(0.05), E.atk(0.05)]],
      ['İngiltere Seferine Ortaklık', 'ship', '1066: Fransız şövalyeleri de Hastings\'te savaşıyor.', [E.cb(['ENG']), E.naval(0.05)]],
      ['Anjou ile İttifak', 'scroll', 'Kont Geoffrey Martel Normandiya\'ya karşı müttefik.', [E.rel('nb', 30)]],
      ['Anglo-Norman Bağı', 'crown', 'Manş\'ın iki yakası Fransız kültürüyle birleşiyor.', [E.cap(500), E.mpm(0.05)]],
      ['Normandiya\'yı Kuşat', 'sword', 'Kral, dükün İngiliz tacına rağmen efendisi olduğunu hatırlatıyor.', [E.cb(['ENG']), E.org(0.05)]],
    ],
    e: [
      ['Paris\'i Büyüt', 'coin', 'Île-de-France krallığın kalbi.', [E.mp(10000)]],
      ['Şampanya Panayırları', 'coin', 'Avrupa\'nın tüccarları buluşuyor.', [E.gold(120)]],
      ['Su Değirmenleri', 'coin', 'Her derede bir değirmen.', [E.mpm(0.05)]],
      ['Flandre Kumaşı', 'ship', 'Yün ve kumaş denizden gidiyor.', [E.dock(1), E.gold(80)]],
      ['Ağır Saban', 'coin', 'Tekerlekli ağır saban kuzeyin killi topraklarını açıyor.', [E.mpm(0.1)]],
      ['Kraliyet Yolları', 'banner', 'Kralın yolları güvenli.', [E.speed(0.05)]],
      ['Lendit Panayırı', 'coin', 'Saint-Denis\'deki büyük panayır.', [E.gold(100)]],
      ['Orman Açma', 'coin', 'Yeni köyler, yeni tarlalar.', [E.mpm(0.05)]],
      ['Gotik Katedraller', 'castle', 'Saint-Denis\'de ışık dolu yeni bir mimari doğuyor.', [E.org(0.05)]],
      ['Loire Bağları', 'coin', 'Şarap ticareti krallığı zenginleştiriyor.', [E.mpm(0.05), E.gold(100)]],
      ['Fransa\'nın Bereketi', 'coin', 'Avrupa\'nın en kalabalık krallığı.', [E.mp(12000), E.mpm(0.05), E.gold(120)]],
    ],
    m: [
      ['Şövalyelik', 'helm', 'Atlı savaşçılar kendi ahlakını yaratıyor.', [E.atk(0.05)]],
      ['Ağır Süvari Hücumu', 'spear', 'Kol altına sıkıştırılmış mızrakla hücum.', [E.atk(0.05)]],
      ['Motte ve Bailey', 'castle', 'Toprak tepeler üzerinde ahşap kaleler.', [E.def(0.05), E.siege(0.1)]],
      ['Turnuvalar', 'sword', 'Şövalyeler barışta da savaşı öğreniyor.', [E.org(0.05)]],
      ['Kraliyet Ordusu', 'helm', 'Kralın kendi vasallarından ordular.', [E.armies(2, 'Kraliyet Ordusu')]],
      ['Taş Kaleler', 'castle', 'Ahşabın yerini taş kuleler alıyor.', [E.def(0.1)]],
      ['Oriflamme', 'banner', 'Saint-Denis\'nin kızıl sancağı kralın önünde.', [E.org(0.05), E.atk(0.05)]],
      ['Arbaletçiler', 'spear', 'Kilisenin yasakladığı ölümcül silah.', [E.def(0.05)]],
      ['Mancınık Ustaları', 'castle', 'Kuşatma sanatı ilerliyor.', [E.siege(0.2)]],
      ['Burgonya Mirası', 'banner', 'Burgonya krallığı Fransa\'ya ait.', [E.cb(['HRE'])]],
      ['Reconquista\'ya Yardım', 'sword', 'Fransız şövalyeleri İspanya\'ya iniyor.', [E.cb(['TUL', 'SEV', 'BLN'])]],
      ['Frank Ordusu', 'sword', 'Krallığın bütün şövalyeleri tek sancak altında.', [E.cap(1000), E.org(0.1)]],
    ],
    s: [
      ['Haçlı Ruhu', 'sword', 'Kutsal savaş fikri şövalyeleri sarıyor.', [E.org(0.05)]],
      ['Clermont Konsili', 'scroll', '1095: Papa II. Urbanus Fransa\'da haçlı seferini ilan ediyor.', [E.rel(['PAP'], 60)]],
      ['Pirenelerin Ötesi', 'banner', 'Barselona, Navarra ve Aragon ile akrabalık.', [E.rel(['BAR', 'NAV', 'ARA'], 40)]],
      ['Deus Vult', 'sword', 'Tanrı bunu istiyor!', [E.atk(0.05)]],
      ['Barbastro Seferi', 'sword', '1064: Fransız şövalyeleri Ebro vadisinde.', [E.cb(['ZAR']), E.siege(0.05)]],
      ['Haçlı Ordusu', 'banner', 'Haç takan binlerce savaşçı.', [E.armies(1, 'Haçlı Ordusu'), E.mp(8000)]],
      ['Tapınak Şövalyeleri', 'helm', '1119: Hacıları koruyan rahip şövalyeler.', [E.atk(0.05), E.def(0.05)]],
      ['Doğu Akdeniz Limanları', 'ship', 'Marsilya ve Montpellier gemileri Levant\'a.', [E.dock(1), E.naval(0.1)]],
      ['Kudüs Krallığı\'na Destek', 'crown', 'Doğudaki Latin krallıkları Fransız asilzadelerinin.', [E.cb(['FAT']), E.org(0.05)]],
      ['Hristiyanlığın Kılıcı', 'sword', 'Fransız şövalyeleri dünyanın dört bir yanında.', [E.cap(500), E.atk(0.05), E.gold(150)]],
    ],
    cap: ['En Hristiyan Kral', 'crown', 'Frankların kralı Tanrı\'nın seçtiği.', [E.cap(1000), E.def(0.05)]],
    fin: ['Frankların Kralı', 'dragon', 'Charlemagne\'ın mirası Paris\'te.', [E.atk(0.05), E.mpm(0.1), E.cb(['HRE', 'ENG'])]],
  });

  // ---------------------------------------------------------------- Kiev Rus'u
  T.KIE = big('kie', {
    p: [
      ['Russkaya Pravda', 'scroll', 'Yaroslav\'ın kanunları bütün Rus\'ta geçerli.', [E.mpm(0.05)]],
      ['Bilge Yaroslav', 'crown', 'Kiev\'in büyük knezi Avrupa\'nın en saygın hükümdarlarından.', [E.envoy()]],
      ['Veçe Meclisleri', 'scroll', 'Şehir halkı meclislerde toplanıyor.', [E.org(0.05)]],
      ['Yaroslav\'ın Vasiyeti', 'scroll', '1054: Kardeşler kıdem sırasına göre hüküm sürecek.', [E.def(0.05)]],
      ['Polotsk\'u Birleştir', 'banner', 'Asi kuzen Vseslav Kiev\'e boyun eğecek.', [E.cb(['PLT'])]],
      ['Yaroslaviçi Üçlüsü', 'crown', 'İzyaslav, Svyatoslav ve Vsevolod ortak yönetiyor.', [E.mp(8000)]],
      ['Lyubeç Konseyi', 'scroll', '1097: Knezler iç savaşa son vermeye yemin ediyor.', [E.mpm(0.05), E.org(0.05)]],
      ['Vladimir Monomakh', 'crown', '1113: Kiev halkı Monomakh\'ı tahta çağırıyor.', [E.ruler('Vladimir Monomakh'), E.atk(0.05)]],
      ['Pravda Yaroslaviçi', 'scroll', 'Kanunlar genişletiliyor, kan davası yerine para cezası.', [E.gold(100)]],
      ['Monomakh\'ın Öğütleri', 'scroll', 'Knez oğullarına adaleti ve savaşı öğretiyor.', [E.org(0.05), E.envoy()]],
      ['Büyük Knez', 'crown', 'Bütün knezlerin üstünde tek hükümdar.', [E.cap(1000), E.def(0.05), E.mpm(0.05)]],
    ],
    d: [
      ['Kiev Ayasofyası', 'shield', 'Kiev, Konstantinopolis\'e rakip.', [E.org(0.05)]],
      ['Mağara Manastırı', 'scroll', 'Peçerska Lavra Rus Ortodoksluğunun kalbi.', [E.mp(5000)]],
      ['Metropolit İlarion', 'scroll', '1051: İlk yerli metropolit, Kanun ve Lütuf Üzerine Vaaz.', [E.envoy()]],
      ['Avrupa Evlilikleri', 'crown', 'Yaroslav\'ın kızları Avrupa\'nın kraliçeleri.', [E.rel(['FRA', 'HUN', 'NOR'], 40)]],
      ['Bizans Prensesi', 'crown', 'Monomakhos\'un kızı Kiev sarayına geliyor; Rus yüzünü Konstantinopolis\'e dönüyor.', [E.rel(['BYZ'], 60)]],
      ['Latin Batıyla İttifak', 'scroll', 'İzyaslav Papa ve imparatordan yardım istiyor.', [E.rel(['PAP', 'POL', 'HRE'], 40)]],
      ['Grek Ustalar', 'castle', 'Konstantinopolisli mimarlar ve ressamlar.', [E.def(0.05), E.gold(100)]],
      ['Polonya Bağı', 'banner', 'Polonyalı akrabalar Kiev tahtını destekliyor.', [E.armies(1, 'Polonya Yardımcıları')]],
      ['Çargrad\'ın Mirası', 'crown', 'Rus knezleri Roma imparatorlarının mirasçısı.', [E.cap(500), E.org(0.05)]],
      ['Varyag Kuzeyi', 'axe', 'Harald Hardrada\'nın eşi Elisiv: İskandinavya ile kan bağı.', [E.rel(['NOR', 'SWE'], 50), E.atk(0.05)]],
    ],
    e: [
      ['Varyaglardan Greklere', 'ship', 'Dinyeper yolu ticaretle canlanıyor.', [E.mp(8000)]],
      ['Kürk Ticareti', 'coin', 'Samur ve tilki kürkleri altın değerinde.', [E.gold(120)]],
      ['Kale Şehirler', 'castle', 'Gorod: ahşap surlu şehirler.', [E.def(0.05)]],
      ['Novgorod\'u Bağla', 'scroll', 'Kuzeyin zengin şehri.', [E.mp(6000), E.dock(1)]],
      ['Huş Kabuğu Mektuplar', 'scroll', 'Novgorod\'da tüccarlar bile okuyup yazıyor.', [E.org(0.05)]],
      ['Gardariki', 'coin', 'Şehirler ülkesi.', [E.mpm(0.1)]],
      ['Volga Yolu', 'coin', 'Bulgar pazarları bizim olacak.', [E.cb(['VOL'])]],
      ['Kiev Pazarı', 'coin', 'Sekiz pazarlı başkent.', [E.gold(100)]],
      ['Bal ve Balmumu', 'coin', 'Ormanların zenginliği Bizans\'a satılıyor.', [E.mpm(0.05)]],
      ['Smolensk ve Çernigov', 'castle', 'Büyük şehirler kalabalıklaşıyor.', [E.mp(8000)]],
      ['Gardariki\'nin Zenginliği', 'coin', 'Baltık\'tan Karadeniz\'e pazarlar.', [E.mpm(0.1), E.gold(150), E.cb(['EST', 'LTG', 'LIT'])]],
    ],
    m: [
      ['Drujina', 'helm', 'Knezin seçkin muhafızları.', [E.atk(0.05)]],
      ['Varyag Paralı Askerleri', 'axe', 'İskandinavya\'dan savaşçılar.', [E.armies(2, 'Varyag Ordusu')]],
      ['Yılan Surları', 'castle', 'Göçebeleri durduracak toprak surlar.', [E.def(0.1)]],
      ['Rus Süvarisi', 'spear', 'Göçebelerden öğrenilen savaş.', [E.speed(0.1)]],
      ['Ros Kaleleri', 'castle', 'Ros nehri boyunca sınır kaleleri.', [E.def(0.05)]],
      ['Kara Kalpaklar', 'spear', 'Sınıra yerleştirilen Türk boyları Kiev\'e hizmet ediyor.', [E.mp(6000), E.speed(0.05)]],
      ['Peçeneklere Son', 'spear', 'Bozkırın eski belası ortadan kalkacak.', [E.cb(['PEC'])]],
      ['Alta\'dan Ders', 'shield', '1068: Kumanlar karşısındaki bozgun unutulmayacak.', [E.org(0.1)]],
      ['Kumanlara Karşı Seferler', 'sword', '1103 Dolobsk: knezler bozkıra birlikte yürüyor.', [E.cb(['KIP'])]],
      ['Halk Milisi', 'banner', 'Voi: şehirlerin piyadeleri.', [E.mpm(0.05), E.cap(500)]],
      ['Salnitsa Zaferi', 'sword', '1111: Kumanlar kendi bozkırlarında yeniliyor.', [E.atk(0.05), E.org(0.05)]],
      ['Rus Ordusu', 'sword', 'Bütün knezliklerin birleşik ordusu.', [E.cap(1000), E.armies(1, 'Rus Ordusu')]],
    ],
    s: [
      ['Lodya Filoları', 'ship', 'Nehir ve deniz için kayıklar.', [E.naval(0.1)]],
      ['Ladoga Kalesi', 'castle', 'Kuzeyin kapısı.', [E.def(0.05)]],
      ['Dinyeper Akıntıları', 'ship', 'Çağlayanlarda kayıkları taşıma yolları güvenli.', [E.speed(0.05)]],
      ['Fin Kabileleri', 'banner', 'Kuzeydeki kabileler haraç verecek.', [E.cb(['FIN', 'KAR'])]],
      ['Karadeniz Kıyıları', 'ship', 'Dinyeper ağzında yeni limanlar.', [E.dock(1)]],
      ['Tmutarakan Prensliği', 'crown', 'Kerç boğazındaki uzak Rus prensliği.', [E.mp(8000), E.cb(['ALA'])]],
      ['Novgorod Tüccarları', 'coin', 'Gotland ve Baltık ile ticaret.', [E.gold(120)]],
      ['Kırım Kıyıları', 'ship', 'Karadeniz\'de Rus gemileri.', [E.naval(0.1)]],
      ['Konstantinopolis Seferi', 'ship', '1043: Tsargrad\'ın kapılarına kalkan asmak.', [E.naval(0.1), E.cb(['BYZ'])]],
      ['Rus Denizi', 'ship', 'Karadeniz yeniden Rus Denizi.', [E.naval(0.05), E.cap(500), E.mpm(0.05)]],
    ],
    cap: ['Bütün Rus\'un Hükümdarı', 'crown', 'Baltık\'tan Karadeniz\'e tek devlet.', [E.cap(1000), E.atk(0.05), E.def(0.05)]],
    fin: ['Rus Şehirlerinin Anası', 'dragon', 'Kiev, Doğu Avrupa\'nın en büyük şehri.', [E.mpm(0.1), E.org(0.1), E.cb(['KIP', 'PLT'])]],
  });

  // ---------------------------------------------------------------- Danimarka
  T.DEN = big('den', {
    p: [
      ['Knut\'un Mirası', 'crown', 'Büyük Knut\'un imparatorluğu dağılmamalı.', [E.envoy()]],
      ['Magnus ile Antlaşma', 'crown', 'İyi Magnus ile Danimarka ve Norveç tacı birleşiyor.', [E.rel(['NOR'], 50)]],
      ['Sven Estridsen', 'crown', '1047: Knut\'un yeğeni Sven tahtı ele geçiriyor.', [E.ruler('Sven Estridsen'), E.mp(6000)]],
      ['Ting Meclisleri', 'scroll', 'Özgür köylüler meclislerde kanun koyuyor.', [E.org(0.05)]],
      ['Jarl Sistemi', 'helm', 'Bölge jarlları krala sadakat yemini ediyor.', [E.mpm(0.05)]],
      ['Kraliyet Otoritesi', 'crown', 'Kral, ting\'lerin üstünde.', [E.mpm(0.05), E.def(0.05)]],
      ['Sven\'in Oğulları', 'crown', 'Beş oğul sırayla tahta çıkacak.', [E.mp(8000)]],
      ['Kutsal Knut', 'shield', '1086: Şehit kral IV. Knut aziz ilan ediliyor.', [E.org(0.1)]],
      ['Kıtlık Yıllarına Çare', 'coin', 'Aç Olaf\'ın yıllarından ders alındı.', [E.mpm(0.05)]],
      ['Erik Ejegod', 'crown', '1095: Hacca giden iyi yürekli kral.', [E.ruler('I. Erik'), E.envoy()]],
      ['Kuzey Denizi İmparatorluğu', 'crown', 'Knut\'un rüyası yeniden canlanıyor.', [E.cap(1000), E.gold(100)]],
    ],
    d: [
      ['Kuzeyin Kilisesi', 'scroll', 'Danimarka kilisesi Hamburg-Bremen\'den bağımsızlık istiyor.', [E.org(0.05)]],
      ['Roskilde Piskoposluğu', 'scroll', 'Kilise krallığın direği.', [E.def(0.05)]],
      ['Lund Başpiskoposluğu', 'shield', '1103: İskandinavya\'nın ilk başpiskoposluğu Lund\'da.', [E.rel(['PAP'], 50)]],
      ['Yön Seçimi', 'crown', 'Batıya mı, doğuya mı? Krallık kılıcını nereye çevirecek?', [E.envoy()]],
      ['İngiltere Tacına Hak', 'crown', 'Knut\'un tahtı Danimarka\'nın hakkı.', [E.cb(['ENG']), E.tribute(0.4)]],
      ['Baltık\'a Yönel', 'banner', 'Baltık kıyısındaki Wendler boyun eğecek.', [E.cb(['ABO', 'LUT', 'POM'])]],
      ['Humber\'a Çıkarma', 'ship', '1069: Danimarka filosu York\'u alıyor.', [E.armies(1, 'İngiltere Seferi'), E.naval(0.05)]],
      ['Wend Haçlı Seferi', 'sword', 'Pagan Slavlara karşı kutsal savaş.', [E.atk(0.05), E.cb(['PRU', 'CUR'])]],
      ['Büyük Filo', 'ship', '1085: Bin gemi Limfjord\'da toplanıyor.', [E.dock(1), E.naval(0.1)]],
      ['Baltık\'ın Efendisi', 'ship', 'Doğu denizi Danimarka gölü.', [E.naval(0.1), E.gold(120)]],
    ],
    e: [
      ['Kattegat Ticareti', 'coin', 'Boğazlardan geçen her gemi vergi öder.', [E.gold(100)]],
      ['Hedeby Pazarı', 'coin', 'Kuzeyin en büyük pazarı.', [E.mp(8000)]],
      ['Ribe ve Aarhus', 'coin', 'Kıyı şehirleri büyüyor.', [E.mpm(0.05)]],
      ['Ringa Balıkçılığı', 'ship', 'Øresund\'un ringaları Avrupa\'yı besliyor.', [E.mpm(0.05)]],
      ['Skåne Tarlaları', 'coin', 'Güneyin bereketli ovaları.', [E.mpm(0.05)]],
      ['Danevirke Surları', 'castle', 'Güney sınırındaki toprak sur.', [E.def(0.1)]],
      ['Gümüş Sikke', 'coin', 'Kraliyet darphanesi Lund\'da.', [E.gold(120)]],
      ['Lund Şehri', 'castle', 'Kuzeyin yeni büyük şehri.', [E.mp(6000)]],
      ['Schleswig Pazarı', 'coin', 'Hedeby\'nin mirasçısı.', [E.gold(100)]],
      ['Danegeld Gümüşü', 'coin', 'Yabancı krallar barış için gümüş öder.', [E.mp(12000)]],
      ['Kuzeyin Zenginliği', 'coin', 'Kuzey Denizi ve Baltık ticareti Danimarka\'dan geçiyor.', [E.mpm(0.1), E.gold(150), E.dock(1)]],
    ],
    m: [
      ['Huscarllar', 'axe', 'Kralın baltalı muhafızları.', [E.atk(0.05)]],
      ['Kalkan Duvarı', 'shield', 'Omuz omuza, kalkan kalkana.', [E.def(0.05)]],
      ['Leidang', 'ship', 'Her bölge sefer için gemi ve asker verir.', [E.mp(8000), E.naval(0.05)]],
      ['Danimarka Baltası', 'axe', 'Uzun saplı iki elle kullanılan balta.', [E.atk(0.05)]],
      ['Jomsvikingler', 'helm', 'Efsanevi paralı savaşçı kardeşliği.', [E.armies(2, 'Jomsviking')]],
      ['Halka Kaleler', 'castle', 'Trelleborg tipi kaleler yeniden kullanılıyor.', [E.def(0.05)]],
      ['Vikinglerin Dönüşü', 'ship', 'Eski yollar yeniden açılıyor.', [E.naval(0.05), E.speed(0.05)]],
      ['Norveç Tacı', 'crown', 'Magnus\'un tahtı Danimarka\'nın hakkı.', [E.cb(['NOR'])]],
      ['İsveç Üzerinde Hak', 'banner', 'Uppsala da Knut\'un mirası.', [E.cb(['SWE'])]],
      ['Frankya\'ya Büyük Akın', 'axe', 'Paris bir kez daha kuşatılacak.', [E.cb(['FRA']), E.siege(0.1)]],
      ['Berserkerler', 'sword', 'Ölümden korkmayan savaşçılar.', [E.atk(0.05), E.org(0.05)]],
      ['Kralın Ordusu', 'helm', 'Kuzeyin fırtınası tek sancak altında.', [E.cap(1000), E.org(0.1), E.armies(1, 'Kral Ordusu')]],
    ],
    s: [
      ['Drakkar Filoları', 'ship', 'Yeni gemiler, yeni akınlar.', [E.dock(1), E.naval(0.1)]],
      ['Kıyı Gözcüleri', 'castle', 'Wend korsanlarına karşı kıyı kuleleri.', [E.def(0.05)]],
      ['Snekkja Akıncıları', 'ship', 'Hızlı, hafif savaş gemileri.', [E.speed(0.05)]],
      ['Korsan Avı', 'shield', 'Baltık korsanları denizden temizleniyor.', [E.naval(0.05)]],
      ['Orkney ve Adalar', 'ship', 'Kuzey adaları ve İskoç kıyıları.', [E.cb(['SCO'])]],
      ['Kuzey Denizi Filosu', 'ship', 'Manş\'tan Norveç\'e uzanan donanma.', [E.naval(0.1)]],
      ['İrlanda Denizi', 'ship', 'Dublin\'in Norse kralları eski akrabalar.', [E.cb(['DUB'])]],
      ['Gotland Yolu', 'coin', 'Doğu ticaretinin adası.', [E.gold(100)]],
      ['Deniz Kralları', 'crown', 'Kuzey denizlerinde Danimarka bayrağı.', [E.naval(0.1), E.mp(6000)]],
      ['Dalgaların Efendisi', 'ship', 'İzlanda\'dan Novgorod\'a deniz bizim.', [E.naval(0.05), E.cap(500), E.rel(['ISL'], 50)]],
    ],
    cap: ['Üç Taç', 'crown', 'Danimarka, Norveç ve İngiltere tek taç altında.', [E.cap(1000), E.def(0.05), E.atk(0.05)]],
    fin: ['Valhalla\'nın Çocukları', 'dragon', 'Kuzeyin fırtınası yeniden esiyor.', [E.atk(0.05), E.naval(0.1), E.cb(['ENG', 'NOR'])]],
  });

  // ---------------------------------------------------------------- Gazneliler
  T.GAZ = big('gaz', {
    p: [
      ['Gazne Sarayı', 'crown', 'Mesud tahtını sağlamlaştırmalı.', [E.envoy()]],
      ['Dandanakan\'dan Ders', 'scroll', 'Çölde susuz kalan ordu bozgunun sebebi.', [E.def(0.05)]],
      ['Mevdud\'un İntikamı', 'sword', '1041: Mesud öldürüldü; oğlu Mevdud babasının katillerini cezalandırıyor.', [E.ruler('Mevdud'), E.mp(8000)]],
      ['Gur Beylerini Bağla', 'helm', 'Dağ beyleri sadık kalacak.', [E.def(0.05)]],
      ['Saray Gulamları', 'helm', 'Sultanın kendi muhafızları.', [E.org(0.05)]],
      ['İbrahim\'in Barışı', 'scroll', '1059: Sultan İbrahim Selçuklularla kalıcı barış yapıyor.', [E.rel(['SEL'], 60)]],
      ['Şehnâme\'nin Mirası', 'scroll', 'Firdevsî\'nin destanı sarayda okunuyor.', [E.org(0.05)]],
      ['Lahor\'a Odaklan', 'castle', 'Pencap yeni kalemiz.', [E.def(0.05), E.mpm(0.05)]],
      ['Beyhakî\'nin Tarihi', 'scroll', 'Fars nesrinin şaheseri sarayda yazılıyor.', [E.envoy()]],
      ['İkinci Başkent Lahor', 'crown', 'Sultan kışları Lahor\'da geçiriyor.', [E.mpm(0.05), E.cap(500)]],
      ['Sultanlığın İhyası', 'crown', 'Mahmud\'un devleti yeniden doğuyor.', [E.cap(1000), E.gold(120)]],
    ],
    d: [
      ['Halifeye Bağlılık', 'crown', 'Gazne sultanları Abbâsî halifesinin sadık kılıcı.', [E.rel(['ABB'], 50)]],
      ['Sünnî Âlimler', 'scroll', 'Hanefî fakihleri sultanın yanında.', [E.org(0.05)]],
      ['Sind\'e Karşı', 'banner', 'Multan ve Mansura\'daki İsmaililer.', [E.cb(['SIN'])]],
      ['Gazne Medreseleri', 'scroll', 'Doğunun ilim merkezi.', [E.envoy()]],
      ['Horasan\'ı Geri Al', 'banner', 'Dandanakan\'ın intikamı alınacak.', [E.cb(['SEL'])]],
      ['Selçuklu ile Barış', 'scroll', 'Batıda barış, doğuda fetih.', [E.rel(['SEL'], 80), E.def(0.05)]],
      ['Tohâristan Seferi', 'sword', 'Belh ve Tirmiz yeniden Gazneli.', [E.atk(0.05), E.armies(1, 'Horasan Ordusu')]],
      ['Batıyı Tahkim Et', 'castle', 'Selçuklu sınırı kalelerle kapatılıyor.', [E.def(0.1)]],
      ['Dandanakan\'ın İntikamı', 'sword', 'Merv kapıları yeniden açılacak.', [E.atk(0.05), E.org(0.05)]],
      ['Gaza Ruhu', 'sword', 'Gaziler Hindistan\'a akın ediyor.', [E.mp(10000), E.org(0.05)]],
    ],
    e: [
      ['Hint Hazineleri', 'coin', 'Tapınaklardan gelen altın.', [E.gold(200)]],
      ['Kabil Yolu', 'banner', 'Dağ geçitleri güvenli.', [E.speed(0.05)]],
      ['Pencap Ovası', 'coin', 'Beş ırmağın bereketi.', [E.mpm(0.1)]],
      ['Hayber Geçidi', 'castle', 'Hindistan\'ın kapısı tahkim ediliyor.', [E.def(0.05)]],
      ['Bîrûnî\'nin Gözlemevi', 'scroll', 'Bilim ve mühendislik.', [E.org(0.05), E.siege(0.1)]],
      ['Gazne Pazarları', 'coin', 'Dağların arasında zengin bir başkent.', [E.gold(100)]],
      ['Hilmend Bendleri', 'coin', 'Sistan\'ın sulama kanalları onarılıyor.', [E.mpm(0.05)]],
      ['Multan Ticareti', 'coin', 'İndus kervanları.', [E.gold(100)]],
      ['Sistan Tahılı', 'coin', 'Ordunun ambarı.', [E.mp(8000)]],
      ['Hint Tüccarları', 'coin', 'Lahor\'un Hindu tüccarları sultana bağlı.', [E.mpm(0.05)]],
      ['Gazne\'nin İhtişamı', 'coin', 'Doğunun en parlak sarayı.', [E.mpm(0.05), E.gold(150), E.mp(10000)]],
    ],
    m: [
      ['Türk Gulamları', 'helm', 'Sultana bağlı atlılar.', [E.atk(0.05)]],
      ['Savaş Filleri', 'axe', 'Hint fillerinin gücü.', [E.atk(0.05), E.def(0.05)]],
      ['Atlı Okçular', 'spear', 'Bozkır taktikleri.', [E.speed(0.1)]],
      ['Fil Ahırları', 'castle', 'Binlerce fil için ahırlar.', [E.cap(500)]],
      ['Hindu Piyadeleri', 'spear', 'Tilak\'ın Hindu alayları sultana hizmet ediyor.', [E.armies(2, 'Hindu Alayı')]],
      ['Dağ Kaleleri', 'castle', 'Afganistan\'ın kartal yuvaları.', [E.def(0.1)]],
      ['Mahmud\'un Ordusu', 'sword', 'On yedi Hindistan seferinin ordusu yeniden kuruluyor.', [E.org(0.1)]],
      ['Hindistan Seferleri', 'sword', 'Delhi ve Ajmer\'e yürüyüş.', [E.cb(['TOM', 'CHH'])]],
      ['Nagarkot Kuşatması', 'castle', 'Kangra kalesi geri alınacak.', [E.siege(0.2)]],
      ['Kanauj\'a Yürüyüş', 'banner', 'Ganj ovasının kapıları.', [E.cb(['CHN', 'KAL'])]],
      ['Somnat Ruhu', 'sword', 'Mahmud\'un en ünlü seferi hatırlanıyor.', [E.atk(0.05), E.speed(0.05)]],
      ['Sultan\'ın Ordusu', 'sword', 'Türk, Afgan ve Hint askerleri tek ordu.', [E.cap(1000), E.armies(1, 'Sultan Ordusu')]],
    ],
    s: [
      ['Gur Dağları', 'castle', 'Gur\'un dağ kaleleri.', [E.def(0.05)]],
      ['Sistan Emirliği', 'banner', 'Saffârî torunları sultana bağlı.', [E.mp(6000)]],
      ['Belucistan Yolu', 'banner', 'Kirman\'a uzanan çöl yolu.', [E.speed(0.05)]],
      ['Mekran Kıyısı', 'ship', 'Arap Denizi\'ne açılış.', [E.dock(1)]],
      ['Gur Seferi', 'axe', 'Asi Gurlu beyler cezalandırılacak.', [E.atk(0.05)]],
      ['Batı Sınırı', 'castle', 'Herat ve Bust kaleleri.', [E.def(0.05)]],
      ['Keşmir Vadisi', 'banner', 'Mahmud\'un alamadığı vadi.', [E.cb(['KAS'])]],
      ['Debul Limanı', 'ship', 'Sind\'in eski limanı.', [E.gold(100), E.naval(0.05)]],
      ['Gücerat Seferi', 'sword', 'Anhilvara\'nın zenginlikleri.', [E.cb(['GUC'])]],
      ['Hind\'in Kapısı', 'crown', 'Bütün kuzeybatı Hindistan Gazne\'ye bağlı.', [E.cap(500), E.mp(8000), E.mpm(0.05)]],
    ],
    cap: ['Mahmud\'un Mirası', 'crown', 'Gazne yeniden doğunun en büyük gücü.', [E.cap(1000), E.atk(0.05), E.def(0.05)]],
    fin: ['Hindistan\'ın Fatihi', 'dragon', 'Ganj ovası Gazne\'ye bağlanıyor.', [E.cb(['PAR', 'CHN']), E.mpm(0.1), E.org(0.1)]],
  });

  // ---------------------------------------------------------------- Song
  T.SNG = big('sng', {
    p: [
      ['İmparatorluk Sınavları', 'scroll', 'Devlet adamları yetenekle seçilir.', [E.envoy()]],
      ['İmparator Renzong', 'crown', 'Yumuşak huylu imparator âlimleri dinliyor.', [E.def(0.05)]],
      ['Sansür Dairesi', 'helm', 'Yolsuzluğa karşı denetim.', [E.org(0.05)]],
      ['Qingli Reformları', 'scroll', '1043: Fan Zhongyan\'ın on maddelik reformu.', [E.mpm(0.05)]],
      ['Bao Zheng\'in Adaleti', 'scroll', 'Yargıç Bao\'nun dürüstlüğü efsane oluyor.', [E.mpm(0.05)]],
      ['Ouyang Xiu\'nun Kalemi', 'scroll', 'Devlet adamı ve tarihçi yeni bir edebiyat başlatıyor.', [E.envoy()]],
      ['İmparator Shenzong', 'crown', '1067: Hırslı genç imparator reform istiyor.', [E.ruler('Shenzong'), E.mp(8000)]],
      ['Hanlin Akademisi', 'scroll', 'İmparatorun bilginleri fermanlar yazıyor.', [E.org(0.05)]],
      ['Zizhi Tongjian', 'scroll', 'Sima Guang\'ın büyük tarihi: yönetime ayna.', [E.gold(100)]],
      ['Yuanyou Dönemi', 'crown', 'Naibe imparatoriçe ile istikrar.', [E.def(0.05)]],
      ['Cennetin Mandası', 'crown', 'Göğün oğlu bütün dünyaya hükmeder.', [E.cap(1000), E.ruler('Huizong'), E.gold(150)]],
    ],
    d: [
      ['Haraç Sistemi', 'crown', 'Komşu krallar imparatora elçi gönderir.', [E.rel(['GOR', 'JAP', 'DAI'], 40)]],
      ['Shanyuan Barışı', 'scroll', 'Liao ile kardeş imparatorluk barışı korunuyor.', [E.rel(['LIA'], 50)]],
      ['Dali\'yi Haraca Bağla', 'banner', 'Güneybatıdaki krallık haraç verecek.', [E.cb(['DAL'])]],
      ['Reform Tartışması', 'scroll', 'Saray ikiye bölündü: Yeni Kanunlar mı, eski düzen mi?', [E.envoy()]],
      ['Wang Anshi\'nin Yeni Kanunları', 'scroll', '1069: Devlet ekonomiye el koyuyor.', [E.mpm(0.1)]],
      ['Sima Guang\'ın Muhafazakârları', 'scroll', 'Atalarının yolundan sapma.', [E.org(0.1)]],
      ['Qingmiao Kredileri', 'coin', 'Yeşil Filiz kredileri köylüyü tefeciden kurtarıyor.', [E.gold(150)]],
      ['Eski Düzenin İhyası', 'shield', 'Yeni Kanunlar kaldırılıyor, istikrar geri geliyor.', [E.def(0.1)]],
      ['Baojia Milisleri', 'spear', 'Her on hane bir milis birliği kuruyor.', [E.mp(10000), E.cap(500)]],
      ['Konfüçyüs Erdemi', 'crown', 'Erdemli yönetim halkın gönlünü kazanıyor.', [E.mpm(0.05), E.envoy()]],
    ],
    e: [
      ['Büyük Kanal', 'ship', 'Kuzey ile güney birbirine bağlı.', [E.mp(12000)]],
      ['Champa Pirinci', 'coin', 'Yılda iki hasat veren pirinç.', [E.mpm(0.1)]],
      ['Jiaozi Kâğıt Parası', 'coin', 'Dünyanın ilk devlet kâğıt parası.', [E.gold(150)]],
      ['Teraslı Tarlalar', 'coin', 'Güneyin tepeleri pirinç tarlası.', [E.mpm(0.05)]],
      ['Çay ve Tuz Tekeli', 'coin', 'Devletin en büyük gelir kaynakları.', [E.gold(120)]],
      ['Kaifeng Pazarları', 'coin', 'Bir milyonluk başkent gece gündüz açık.', [E.mp(8000)]],
      ['Porselen Atölyeleri', 'coin', 'Jingdezhen fırınları.', [E.gold(100)]],
      ['Demir Dökümhaneleri', 'axe', 'Kömürle çalışan dev yüksek fırınlar.', [E.atk(0.05)]],
      ['Hareketli Harfler', 'scroll', 'Bi Sheng\'in matbaası bilgiyi yayıyor.', [E.org(0.05)]],
      ['Pusula', 'ship', 'Shen Kuo manyetik iğneyi tarif ediyor.', [E.naval(0.1)]],
      ['Song\'un Zenginliği', 'coin', 'Dünyanın en zengin imparatorluğu.', [E.mpm(0.1), E.gold(150), E.dock(1)]],
    ],
    m: [
      ['Barut', 'axe', 'Huoyao: ateş ilacı savaş alanında.', [E.siege(0.2)]],
      ['Tetikli Yaylar', 'spear', 'Zırh delen arbaletler.', [E.def(0.05), E.atk(0.05)]],
      ['Sınır Orduları', 'helm', 'Kuzey sınırına yeni ordular.', [E.armies(2, 'Sınır Ordusu')]],
      ['Ateş Okları', 'axe', 'Barutlu oklar düşman saflarını yakıyor.', [E.atk(0.05)]],
      ['Wujing Zongyao', 'scroll', '1044: Askerî bilginin derlemesi.', [E.org(0.1)]],
      ['Kuzey Sınır Kaleleri', 'castle', 'Hebei\'nin kanal ve kale hattı.', [E.def(0.1)]],
      ['Gök Gürültüsü Bombaları', 'axe', 'Pili huoqiu: mancınıkla atılan barut bombaları.', [E.siege(0.15)]],
      ['Alev Püskürtücüler', 'axe', 'Neft püskürten pompalar surları savunuyor.', [E.def(0.05), E.atk(0.05)]],
      ['Batı Xia\'ya Karşı', 'sword', 'Li Yuanhao\'nun imparatorluk iddiası kabul edilemez.', [E.cb(['XIA'])]],
      ['Đại Việt Seferi', 'banner', '1076: Güney sınırı güvenceye alınacak.', [E.cb(['DAI'])]],
      ['Lingzhou Seferi', 'sword', '1081: Beş kol halinde Xia\'ya yürüyüş.', [E.atk(0.05), E.org(0.05), E.speed(0.05)]],
      ['Yasak Muhafızlar', 'helm', 'Başkentin imparatorluk orduları.', [E.cap(1000), E.armies(1, 'Muhafız Ordusu')]],
    ],
    s: [
      ['Guangzhou Limanı', 'ship', 'Arap ve Fars tüccarların limanı.', [E.dock(1)]],
      ['Quanzhou Limanı', 'ship', 'Zeytun: dünyanın en büyük limanı olacak.', [E.gold(100)]],
      ['Güney Kıyı Muhafızları', 'castle', 'Korsanlara karşı kıyı kaleleri.', [E.def(0.05)]],
      ['Hazine Gemileri', 'ship', 'Su geçirmez bölmeli dev gemiler.', [E.naval(0.1), E.dock(1)]],
      ['Nong Zhigao İsyanı', 'axe', '1052: Güneydeki isyan Di Qing tarafından bastırılıyor.', [E.mp(8000), E.def(0.05)]],
      ['Ticaret Gemileri Bürosu', 'coin', 'Shibosi deniz ticaretini vergilendiriyor.', [E.mpm(0.05), E.gold(100)]],
      ['Champa ile Dostluk', 'scroll', 'Güney krallığı pirinç ve fil gönderiyor.', [E.rel(['CHM'], 50)]],
      ['Su Savaşı Okulu', 'ship', 'Yangtze filoları talim yapıyor.', [E.naval(0.1)]],
      ['Srivijaya Elçileri', 'scroll', 'Boğazların krallığı haraç gönderiyor.', [E.rel(['SRI'], 40), E.gold(100)]],
      ['Güney Denizlerinin Efendisi', 'ship', 'Song gemileri Hint Okyanusu\'nda.', [E.naval(0.1), E.cap(500), E.dock(1)]],
    ],
    cap: ['Göğün Oğlu', 'crown', 'Bütün dünyanın merkezi Kaifeng.', [E.cap(1000), E.def(0.05)]],
    fin: ['On Altı Vilayeti Geri Al', 'dragon', 'Yanjing yeniden Çin\'in olacak.', [E.cb(['LIA', 'XIA']), E.atk(0.05), E.mpm(0.1)]],
  });

  // ---------------------------------------------------------------- Liao
  T.LIA = big('lia', {
    p: [
      ['İkili Yönetim', 'scroll', 'Kitanlar ve Çinliler ayrı kanunlarla yönetilir.', [E.mpm(0.05)]],
      ['Kuzey ve Güney Daireleri', 'scroll', 'Bozkır ve tarım bölgeleri ayrı dairelerde.', [E.org(0.05)]],
      ['Kitan Yazısı', 'scroll', 'Büyük ve küçük Kitan yazıları devlette.', [E.envoy()]],
      ['İmparator Xingzong', 'crown', 'Song\'dan daha fazla haraç koparan imparator.', [E.def(0.05)]],
      ['Yelü ve Xiao Klanları', 'crown', 'İmparator ve imparatoriçe klanları uzlaşıyor.', [E.mp(8000)]],
      ['Beş Başkent', 'castle', 'İmparatorluğun beş kalbi.', [E.def(0.05)]],
      ['İmparator Daozong', 'crown', '1055: Budist imparatorun uzun saltanatı.', [E.ruler('Daozong'), E.envoy()]],
      ['Kitan Geleneklerini Koru', 'shield', 'Çinlileşmeye karşı bozkır töresi.', [E.org(0.05)]],
      ['Yelü Yixin\'i Devir', 'scroll', 'Veliahdı öldüren entrikacı bakan cezalandırılıyor.', [E.def(0.05)]],
      ['Nabo Kampları', 'spear', 'İmparator mevsimlik av kamplarında hüküm sürüyor.', [E.speed(0.05)]],
      ['Gök Kağan', 'crown', 'Bozkırın ve Çin\'in hükümdarı.', [E.cap(1000), E.gold(100)]],
    ],
    d: [
      ['Budist Tapınakları', 'shield', 'İmparatorluk Buda\'nın koruması altında.', [E.org(0.05)]],
      ['Kitan Tripitakası', 'scroll', 'Budist kanonu imparatorluk emriyle basılıyor.', [E.gold(80)]],
      ['Song Haracı', 'coin', 'Shanyuan Antlaşması\'nın gümüşü ve ipeği.', [E.gold(200)]],
      ['Shanyuan\'ı Yenile', 'scroll', '1042: Song haracı artırılıyor.', [E.rel(['SNG'], 30), E.mp(8000)]],
      ['Pagodalar Ülkesi', 'castle', '1056: Yingxian\'ın dev ahşap pagodası yükseliyor.', [E.org(0.1)]],
      ['Bozkır Geleneği', 'spear', 'Kitanlar atalarının yolunda kalacak.', [E.speed(0.05), E.atk(0.05)]],
      ['Goryeo ile Budist Bağı', 'scroll', 'Kore ile keşişler ve sutralar paylaşılıyor.', [E.rel(['GOR'], 50)]],
      ['Ordo Kampları', 'helm', 'Her imparatorun kendi atlı ordosu.', [E.armies(1, 'Ordo Süvarisi')]],
      ['Buda\'nın Koruması', 'shield', 'Tapınaklar ve manastırlar halkı birleştiriyor.', [E.def(0.1)]],
      ['Kurultay', 'crown', 'Sekiz boy beyleri imparatoru onaylıyor.', [E.cap(500), E.mpm(0.05)]],
    ],
    e: [
      ['Sürüler', 'coin', 'Sayısız at ve koyun.', [E.mpm(0.1)]],
      ['Demir Ocakları', 'axe', 'Kitan demircileri.', [E.atk(0.05)]],
      ['Yan Tarlaları', 'coin', 'On altı vilayetin bereketli tarlaları.', [E.mpm(0.05)]],
      ['Liaodong Tuzlaları', 'coin', 'Tuz tekeli hazineyi dolduruyor.', [E.gold(100)]],
      ['Yanjing Pazarı', 'coin', 'Güney başkentinin tüccarları.', [E.gold(120)]],
      ['Bozkır Yolları', 'banner', 'Ordular hızla yer değiştirir.', [E.speed(0.05)]],
      ['At Yetiştiriciliği', 'spear', 'Yüz binlerce savaş atı.', [E.cap(500)]],
      ['Bohai Ustaları', 'castle', 'Eski Bohai krallığının zanaatkârları.', [E.def(0.05)]],
      ['Sınır Pazarları', 'coin', 'Song sınırındaki pazarlarda gümüş el değiştiriyor.', [E.gold(100)]],
      ['Bohai Limanları', 'ship', 'Doğu denizine açılış.', [E.dock(1), E.naval(0.1)]],
      ['Kitan Altını', 'coin', 'İmparatorluk hazinesi dolu.', [E.mpm(0.1), E.mp(10000)]],
    ],
    m: [
      ['Ordo Muhafızları', 'helm', 'İmparatorun seçkin atlıları.', [E.atk(0.05)]],
      ['Kitan Atlıları', 'spear', 'Bozkırın en hızlı süvarisi.', [E.speed(0.1)]],
      ['Çinli Mühendisler', 'castle', 'Kuşatma sanatı.', [E.siege(0.2)]],
      ['Zırhlı Atlılar', 'helm', 'Demir zırhlı ağır süvari.', [E.atk(0.05), E.def(0.05)]],
      ['Kuşatıcı Atlılar', 'spear', 'Düşmanı çevrele, yok et.', [E.atk(0.05)]],
      ['Mancınık Birlikleri', 'castle', 'Han Çinlisi mancınıkçılar.', [E.siege(0.1)]],
      ['Kitan Ordusu', 'sword', 'Sekiz boyun savaşçıları.', [E.armies(2, 'Kitan Ordusu')]],
      ['Ordos\'u Kontrol Et', 'sword', '1044: Tangutlar haddini bilmeli.', [E.cb(['XIA'])]],
      ['Goryeo Seferi', 'banner', 'Kore kralı haraç verecek.', [E.cb(['GOR'])]],
      ['Hequ\'nun İntikamı', 'sword', 'Xia karşısındaki yenilgi unutulmadı.', [E.atk(0.05), E.org(0.05)]],
      ['Doğu Sınır Kaleleri', 'castle', 'Yalu kıyısında kaleler.', [E.def(0.1)]],
      ['İmparatorluk Ordusu', 'helm', 'Bozkır disiplini ve Çin mühendisliği.', [E.cap(1000), E.org(0.1), E.armies(1, 'İmparatorluk Ordusu')]],
    ],
    s: [
      ['Bozkır Boylarını Bağla', 'banner', 'Tatar, Merkit ve Kereyitler boyun eğecek.', [E.cb(['TAT', 'MER', 'KER'])]],
      ['Zubu Federasyonu', 'spear', 'Batı bozkırının boyları sefere çağrılıyor.', [E.mp(8000)]],
      ['Cürçen Haraçları', 'coin', 'Cürçenler av şahini ve inci gönderiyor.', [E.gold(100)]],
      ['Kedun Garnizonu', 'castle', 'Moğolistan\'ın kalbinde bir Kitan kalesi.', [E.def(0.05)]],
      ['Cürçenleri Bastır', 'axe', 'Doğudaki ormanların savaşçıları tehlikeli.', [E.cb(['JUR'])]],
      ['Naymanlar', 'banner', 'Altay\'daki boylar da Kitan\'a bağlanacak.', [E.cb(['NAI'])]],
      ['Uygur ve Kırgız Elçileri', 'scroll', 'Batının kağanları elçi gönderiyor.', [E.rel(['QOC', 'KIR'], 40)]],
      ['Wanyan Akuda\'ya Karşı', 'sword', 'Cürçen tehdidi büyümeden ezilmeli.', [E.def(0.1)]],
      ['Huanglong Kalesi', 'castle', 'Cürçen sınırındaki büyük kale.', [E.def(0.05), E.mp(6000)]],
      ['Doğu ve Batının Kağanı', 'crown', 'Mançurya\'dan Altay\'a bozkır Kitan\'ın.', [E.mpm(0.05), E.org(0.05), E.cap(500), E.speed(0.05)]],
    ],
    cap: ['Büyük Liao', 'crown', 'Doğu Asya\'nın en güçlü imparatorluğu.', [E.cap(1000), E.atk(0.05)]],
    fin: ['Güneye Yürüyüş', 'dragon', 'Kaifeng\'in kapıları Kitanlara açılacak.', [E.cb(['SNG', 'XIA']), E.atk(0.05), E.mpm(0.1)]],
  });

  Object.assign(G.FOCUS_TREES, T);
})();
