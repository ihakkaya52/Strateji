// Tarihî odak ağaçları (2): Bizans, Fâtımî Halifeliği ve Abbâsî Halifeliği.
// Ağaçlar birbirine bağlıdır: Malazgirt, Besâsîrî fitnesi, Bağdat'a giriş gibi olaylar karşı tarafın oyuncusuna da duyurulur.
'use strict';

(function () {
  const { E, F, mutex, finish, byName, nm, alive } = G.focusKit;
  const pct = v => `%${Math.round(v * 100)}`;

  // ------------------------------------------------------------ bu ağaçlara özel etkiler
  const X = {
    // bir kültürün illerinde huzursuzluk biter
    calmCul: (cul, label) => ({ text: `${label}: huzursuzluk biter`, fn: n => { for (const p of G.S.provinces) if (p.owner === n.tag && p.cul === cul) p.unrest = 0; } }),
    // bir ilin sahibine savaş (o il bizim değilse)
    warOwner: (prov, force) => ({ text: `${prov}'ün sahibine savaş`, fn: n => {
      const p = byName(prov);
      if (!p || !p.owner || G.sameRealm(p.owner, n.tag)) return;
      E.war(p.owner, force).fn(n);
    } }),
    ally: tag => ({ text: `${nm(tag)} ile ittifak`, fn: n => { if (alive(tag) && !G.atWar(n.tag, tag) && !G.dip.allied(n.tag, tag)) G.dip.ally(n.tag, tag); } }),
    marry: tag => ({ text: `${nm(tag)} hanedanıyla evlilik`, fn: n => {
      const o = G.S.nations[tag];
      if (o && o.alive && n.marriages && !n.marriages.has(tag) && !G.atWar(n.tag, tag)) G.dyn.marry(n.tag, tag);
    } }),
    // Benî Hilâl: Zîrî ülkesi göçebe Arap boylarıyla harap olur
    hilal: () => ({ text: 'Zîrîler harap olur: orduları ve istikrarı çöker, illeri huzursuz', fn: n => {
      const Z = G.S.nations.ZIR;
      if (!Z || !Z.alive) return;
      Z.stability = Math.max(0, (Z.stability ?? 60) - 30);
      for (const a of G.S.armies) if (a.tag === 'ZIR') a.men = Math.round(a.men * 0.6);
      for (const p of G.S.provinces) if (p.owner === 'ZIR') p.unrest = Math.min(100, (p.unrest || 0) + 40);
      G.log('Benî Hilâl ve Benî Süleym boyları İfrikiye\'ye saldı: Kayrevan yağmalandı.', 'war', [n.tag, 'ZIR']);
    } }),
    // Kudüs'ün sahibi Hristiyansa ona karşı kutsal sefer çağrılır
    holyJerusalem: () => ({ text: 'Kudüs Hristiyanların elindeyse cihat çağrısı (bedelsiz)', fn: n => {
      const p = byName('Kudüs');
      if (!p || !p.owner || p.owner === n.tag) return;
      const o = G.S.nations[p.owner];
      if (!o || G.rel.family(o.religion) !== 'hristiyan' || G.rel.activeOf(n.tag)) return;
      G.rel.call(n.tag, p.owner, { free: true });
    } }),
    // halife: Sünnî hükümdarlarla ilişki
    sunni: v => ({ text: `Bütün Sünnî ülkelerle ilişki +${v}`, fn: n => {
      for (const o of Object.values(G.S.nations)) if (o.alive && o.tag !== n.tag && o.religion === 'sunni') G.dip.add(n.tag, o.tag, v);
    } }),
    independence: () => ({ text: 'Efendimiz varsa bağımsızlık savaşı', fn: n => { if (n.overlord) G.declareIndependence(n.tag); } }),
    // vasal efendisinden barışla kopar (efendi değişmişse etkisiz)
    breakAway: (tag, lord, msg) => ({ text: `${nm(tag)} ${nm(lord)} himayesinden çıkar`, fn: () => {
      const v = G.S.nations[tag];
      if (!v || !v.alive || v.overlord !== lord) return;
      v.overlord = null; G.labelsDirty = true; G.mapDirty = true;
      G.log(msg, 'war', [tag, lord]);
    } }),
    freeIfSel: () => ({ text: 'Selçuklu himayesindeysek barışla ayrılış', fn: n => { if (n.overlord) { G.log(`${n.name} artık kimsenin himayesinde değil.`, 'good', [n.tag, n.overlord]); n.overlord = null; G.labelsDirty = true; } } }),
  };

  // ================================================================ BİZANS
  const BYZ = [
    F('byz_paphlagon', 5, 0, 'Paflagonyalı Mihail', 'crown', 1040,
      'İmparator IV. Mihail sara nöbetleriyle boğuşuyor; devleti kardeşi, hadım İoannes Orphanotrophos yönetiyor. Vergiler ağır, hazine dolu.',
      [E.gold(150), E.tax(0.05)]),
    F('byz_delyan', 2, 1, 'Delyan Ayaklanmasını Bastır', 'sword', 1040,
      '1040-41: Çar Samuil\'in torunu olduğunu söyleyen Petar Delyan, Bulgarları ayaklandırdı. Hasta imparator bizzat sefere çıktı ve isyan Ostrovo\'da bastırıldı.',
      [E.cb(['BUL']), X.calmCul('bulgar', 'Bulgar illeri'), E.atk(0.05)], ['byz_paphlagon']),
    F('byz_kalaphates', 5, 1, 'Kalafatçı\'nın Düşüşü', 'scroll', 1041,
      'Nisan 1042: V. Mihail, kendisini evlat edinen İmparatoriçe Zoe\'yi manastıra sürdü. Konstantinopolis halkı ayaklandı; Kalafatçı kör edildi. Makedonya hanedanının son iki prensesi tahtta.',
      [E.stab(-5)], ['byz_paphlagon']),
    F('byz_tema', 9, 1, 'Tema Ordularını Topla', 'spear', 1040,
      'Anadolu ve Balkan temalarının çiftçi-askerleri sancak altına çağrılıyor.',
      [E.armies(2, 'Tema Ordusu'), E.mpm(0.08)], ['byz_paphlagon']),
    F('byz_zoe', 4, 2, 'Zoe ve Monomakhos', 'crown', 1042,
      'Tarihî yol: Altmış dört yaşındaki Zoe üçüncü kez evlendi; IX. Konstantinos Monomakhos imparator oldu. Saray şenlikleri, Psellos\'un üniversitesi, bol harcama.',
      [E.reign('IX. Konstantinos Monomakhos', { born: 1000, dyn: 'Makedonya (Monomakhos)', sk: { adm: 3, dip: 4, mil: 2 } }), E.stab(10), E.research(0.1)], ['byz_kalaphates'], { hist: true }),
    F('byz_maniakes', 6, 2, 'Maniakes\'in Tacı', 'helm', 1043,
      'Alternatif tarih: Sicilya\'nın fatihi dev cüsseli Georgios Maniakes, İtalya\'dan ordusuyla geçip Ostrovo\'da imparatorluk ordusunu yendi. Konstantinopolis bir asker imparator kazandı.',
      [E.reign('Georgios Maniakes', { born: 998, dyn: 'Maniakes', sk: { adm: 2, dip: 2, mil: 6 }, next: ['II. Basileios Maniakes'] }), E.atk(0.1), E.armies(2, 'Maniakes\'in Tagmaları'), E.stab(-5)], ['byz_kalaphates'], { alt: true }),
    F('byz_varang', 9, 2, 'Varang Muhafızları', 'axe', 1040,
      'İmparatorun İskandinav ve Rus muhafızları; aralarında Harald Hardrada da var. Baltalarıyla ünlü, sadakatleri altınla ölçülür.',
      [E.atk(0.06), E.armies(1, 'Varang Muhafızları')], ['byz_tema']),
    F('byz_rus', 2, 3, 'Rus Donanmasını Yak', 'ship', 1043,
      '1043: Bilge Yaroslav\'ın oğlu Vladimir 400 gemiyle Boğaz\'a geldi. Rum ateşi püskürten dromonlar Rus kayıklarını yaktı.',
      [E.naval(0.1), E.rel(['KIE'], -20), E.def(0.03)], ['byz_zoe']),
    F('byz_ani', 4, 3, 'Ani\'nin İlhakı', 'castle', 1045,
      '1045: Son Bagratuni kralı II. Gagik Konstantinopolis\'e çağrıldı, tacından vazgeçmeye zorlandı. Ani ve Ermenistan imparatorluğa katıldı.',
      [E.annex('ANI'), E.unrest(5)], ['byz_zoe']),
    F('byz_sicilya', 6, 3, 'Sicilya\'nın Geri Fethi', 'sword', 1044,
      'Alternatif tarih: Maniakes yarım kalan işini bitiriyor. Siraküza\'dan Palermo\'ya, Sicilya yeniden Rum olacak.',
      [E.war('SIC'), E.cb(['SAL', 'NAP', 'BEN']), E.naval(0.1)], ['byz_maniakes'], { alt: true }),
    F('byz_rumatesi', 9, 3, 'Rum Ateşi Atölyeleri', 'dragon', 1045,
      'Kallinikos\'un gizli formülü yalnızca birkaç ailenin elinde. Sifonlu dromonlar yeniden donatılıyor.',
      [E.naval(0.15), E.tech('rum_atesi', 'Rum Ateşi')], ['byz_varang']),
    F('byz_schism', 4, 4, '1054: Büyük Ayrılık', 'scroll', 1054,
      'Temmuz 1054: Kardinal Humbert, Ayasofya\'nın sunağına Patrik Mihail Kerularios\'u aforoz eden bir belge bıraktı. Patrik de papa elçilerini aforoz etti. Kiliseler yol ayrımında.',
      [E.stab(-3)], null, { reqAny: ['byz_rus', 'byz_ani', 'byz_sicilya'] }),
    F('byz_demob', 8, 4, 'Ermeni Temalarını Dağıt', 'coin', 1053,
      'Tarihî yol: Monomakhos, İberia teması ordusunun askerlik görevini vergiye çevirdi. Hazine doldu, ama doğu sınırı savunmasız kaldı.',
      [E.gold(300), E.tax(0.08), E.def(-0.05)], ['byz_rumatesi'], { hist: true }),
    F('byz_akritai', 10, 4, 'Akritaslar Sınırda Kalsın', 'shield', 1053,
      'Alternatif tarih: Digenis Akritas\'ın torunları, sınır boylarının yarı asker yarı çoban beyleri, yerinde kalıyor. Türkmen akınlarına karşı ilk duvar onlar.',
      [E.def(0.1), E.mpm(0.08), E.forts(3)], ['byz_rumatesi'], { alt: true }),
    F('byz_kerularios', 3, 5, 'Patrik Kerularios', 'scroll', 1054,
      'Tarihî yol: Konstantinopolis Roma\'ya boyun eğmeyecek. Ortodoks kilisesi kendi yolunda; halk patriğin arkasında.',
      [E.stab(5), E.missionary(), E.rel(['PAP'], -60), E.rel(['HRE'], -20)], ['byz_schism'], { hist: true }),
    F('byz_union', 5, 5, 'Kiliselerin Birliği', 'banner', 1054,
      'Alternatif tarih: İmparator patriği azlediyor, Papa\'nın elçileriyle uzlaşıyor. Batının şövalyeleri kardeş sayılacak; ama Konstantinopolis\'in rahipleri öfkeli.',
      [E.rel(['PAP'], 80), E.rel(['FRA', 'HRE'], 30), E.stab(-10), E.armies(1, 'Latin Paralı Askerleri')], ['byz_schism'], { alt: true }),
    F('byz_normans', 9, 5, 'Normanlar Güney İtalya\'da', 'helm', 1059,
      '1059: Papa, Norman Robert Guiscard\'ı Apulia ve Kalabria dükü tanıdı. Bizans İtalya\'sı Norman şövalyelerinin kuşatması altında.',
      [E.def(0.03)], null, { reqAny: ['byz_demob', 'byz_akritai'] }),
    F('byz_komnenos1', 4, 6, 'İsaakios Komnenos', 'crown', 1057,
      '1057: Anadolu generalleri sivil saraya karşı ayaklandı; İsaakios Komnenos imparator ilan edildi. Sikkelerin üzerinde ilk kez kılıçlı bir imparator.',
      [E.reign('I. İsaakios Komnenos', { born: 1007, dyn: 'Komnenos', sk: { adm: 4, dip: 3, mil: 4 } }), E.atk(0.05), E.tax(0.05)], null, { reqAny: ['byz_kerularios', 'byz_union'] }),
    F('byz_bari', 8, 6, 'Bari\'yi Savun', 'castle', 1068,
      'Tarihî yol: Bizans İtalya\'sının son kalesi Bari, üç yıl Guiscard\'ın kuşatmasına dayanacak.',
      [E.forts(2), E.def(0.05), E.cb(['NRM'])], ['byz_normans'], { hist: true }),
    F('byz_normanally', 10, 6, 'Normanlarla İttifak', 'banner', 1068,
      'Alternatif tarih: Düşmanı paralı asker yap. Roussel de Bailleul gibi Norman şövalyeleri Bizans adına Türklere karşı savaşacak.',
      [X.ally('NRM'), E.armies(2, 'Norman Şövalyeleri'), E.atk(0.05)], ['byz_normans'], { alt: true }),
    F('byz_doukas', 4, 7, 'Doukaslar', 'scroll', 1059,
      '1059: İsaakios tahttan çekildi; Konstantinos Doukas imparator oldu. Saray bürokratlarının dönemi: ordu kısıldı, sikkenin ayarı düştü.',
      [E.reign('X. Konstantinos Doukas', { born: 1006, dyn: 'Doukas', sk: { adm: 3, dip: 3, mil: 1 } }), E.gold(150), E.def(-0.03)], ['byz_komnenos1']),
    F('byz_romanos', 4, 8, 'IV. Romanos Diogenes', 'helm', 1068,
      '1068: Kapadokyalı asker Romanos Diogenes, dul imparatoriçe Eudokia ile evlenip tahta çıktı. Türklere karşı büyük bir ordu topluyor.',
      [E.reign('IV. Romanos Diogenes', { born: 1030, dyn: 'Diogenes', sk: { adm: 3, dip: 2, mil: 5 } }), E.armies(2, 'Doğu Ordusu'), E.cap(1000)], ['byz_doukas']),
    F('byz_malazgirt', 4, 9, 'Malazgirt: Doğu Seferi', 'sword', 1071,
      'Bahar 1071: Romanos, Varanglar, Normanlar, Peçenekler ve tema askerlerinden oluşan dev ordusuyla Erzurum\'a, oradan Malazgirt\'e yürüyor.',
      [E.war('SEL', true), E.atk(0.1)], ['byz_romanos'], { notify: { SEL: 'İmparator Romanos Diogenes dev bir orduyla doğuya yürüyor. Hedefi Malazgirt ve Ahlat!' } }),
    F('byz_yenilgi', 3, 10, 'Malazgirt Sonrası: Doukas Darbesi', 'scroll', 1071,
      'Tarihî yol: Ordu dağıldı, imparator esir düştü. Serbest bırakılan Romanos\'u Doukaslar kör etti; VII. Mihail Doukas tahtta. Nikephoritzes buğdayı tekele bağladı.',
      [E.reign('VII. Mihail Doukas', { born: 1050, dyn: 'Doukas', sk: { adm: 2, dip: 3, mil: 1 } }), E.tax(0.05), E.stab(-10)], ['byz_malazgirt'], { hist: true }),
    F('byz_zafer', 5, 10, 'Romanos\'un Zaferi', 'dragon', 1071,
      'Alternatif tarih: Doukasların ihaneti son anda önlendi; ihtiyat kuvvetleri savaş alanından kaçmadı. Alp Arslan\'ın hilali çöktü. Doğu sınırı yeniden Fırat\'ta.',
      [E.atk(0.1), E.stab(10), E.cb(['SEL']), E.armies(2, 'Malazgirt Galipleri')], ['byz_malazgirt'],
      { alt: true, avail: n => ['Mantzikert', 'Theodosiopolis'].every(x => { const p = byName(x); return p && p.ctrl === n.tag; }), need: 'Mantzikert ve Theodosiopolis elimizde olmalı',
        notify: { SEL: 'Romanos Diogenes Malazgirt\'te galip geldi! Anadolu\'nun kapıları kapanıyor.' } }),
    F('byz_aleksios', 4, 11, 'I. Aleksios Komnenos', 'crown', 1081,
      '1081: Genç general Aleksios Komnenos başkente girdi. Hazine boş, ordu dağılmış, Normanlar Dıraç\'ta, Türkler İznik\'te. İmparatorluğu kurtaracak adam o.',
      [E.reign('I. Aleksios Komnenos', { born: 1057, dyn: 'Komnenos', sk: { adm: 5, dip: 5, mil: 4 } }), E.stab(10), E.org(0.1)], null, { reqAny: ['byz_yenilgi', 'byz_zafer'] }),
    F('byz_venedik', 2, 12, 'Venedik\'e Altın Mühür', 'coin', 1082,
      '1082: Norman donanmasına karşı yardım karşılığında Venedikli tüccarlar bütün imparatorlukta vergiden muaf tutuldu. Deniz kurtuldu, ticaret Venedik\'in oldu.',
      [X.ally('VEN'), E.naval(0.15), E.trade(-0.05)], ['byz_aleksios']),
    F('byz_pronoia', 4, 12, 'Pronoia Sistemi', 'coin', 1085,
      'Toprağın gelirini askerlik karşılığında soylulara bırakan pronoia ile ordu yeniden kuruluyor.',
      [E.mpm(0.12), E.cap(1500)], ['byz_aleksios']),
    F('byz_levounion', 6, 12, 'Levounion', 'sword', 1091,
      '29 Nisan 1091: Kıpçaklarla ittifak kuran Aleksios, Peçenekleri Levounion\'da yok etti. Bir halk tarih sahnesinden silindi.',
      [E.cb(['PEC']), E.rel(['KIP'], 50), E.atk(0.05)], ['byz_aleksios']),
    F('byz_clermont', 4, 13, 'Batıya Elçiler', 'scroll', 1095,
      '1095: Aleksios\'un elçileri Piacenza\'da Papa Urbanus\'tan paralı asker istedi. Papa Clermont\'ta bütün Batı\'yı Kudüs\'e çağırdı. Gelen, beklenenden çok daha büyük olacak.',
      [E.rel(['PAP'], 30)], ['byz_pronoia']),
    F('byz_hacli', 3, 14, 'Haçlılarla Antlaşma', 'banner', 1097,
      'Tarihî yol: Haçlı beyleri Konstantinopolis\'te imparatora yemin etti: geri alınacak Rum şehirleri imparatora verilecek.',
      [E.rel(['FRA', 'HRE', 'PAP'], 40), E.cb(['SEL', 'RUM']), E.stab(5)], ['byz_clermont'], { hist: true }),
    F('byz_kendi', 5, 14, 'Haçlılara Güvenme', 'shield', 1097,
      'Alternatif tarih: Bu silahlı kalabalık başkenti yağmalayabilir. Boğaz kapalı; imparatorluk kendi ordusuyla savaşacak.',
      [E.def(0.1), E.armies(2, 'Varang Alayları'), E.rel(['PAP'], -30)], ['byz_clermont'], { alt: true }),
    F('byz_iznik', 4, 15, 'İznik\'in Geri Alınması', 'castle', 1097,
      'Haziran 1097: Türk sultanının başkenti İznik, imparatorun gemileri gölden yaklaşınca Bizans\'a teslim oldu. Anadolu\'nun batısı yeniden Rum.',
      [E.cb(['RUM', 'SEL']), E.atk(0.05), E.siege(0.1)], null, { reqAny: ['byz_hacli', 'byz_kendi'] }),
    F('byz_restorasyon', 4, 16, 'Komnenos Restorasyonu', 'dragon', 1110,
      'II. İoannes "Kaloioannes" ve torunlarıyla Bizans yeniden Doğu Akdeniz\'in en güçlü devleti olacak.',
      [E.stab(10), E.mpm(0.1), E.cap(1500)], ['byz_iznik']),
  ];
  mutex(BYZ, ['byz_zoe', 'byz_maniakes']);
  mutex(BYZ, ['byz_demob', 'byz_akritai']);
  mutex(BYZ, ['byz_kerularios', 'byz_union']);
  mutex(BYZ, ['byz_bari', 'byz_normanally']);
  mutex(BYZ, ['byz_yenilgi', 'byz_zafer']);
  mutex(BYZ, ['byz_hacli', 'byz_kendi']);

  // ================================================================ FÂTIMÎ
  const FAT = [
    F('fat_mustansir', 5, 0, 'el-Müstansır\'ın Tahtı', 'crown', 1040,
      'Halife-imam el-Müstansır Billâh on bir yaşında. Annesi Sudanlı bir cariye; devleti tecrübeli vezir el-Cercerâî yönetiyor. Kahire, Akdeniz\'in en zengin şehri.',
      [E.stab(5), E.gold(150)]),
    F('fat_cercerai', 3, 1, 'Vezir el-Cercerâî', 'scroll', 1040,
      'İki eli kesik vezir el-Cercerâî, el-Hâkim döneminde cezalandırılmıştı; şimdi devletin direği. Vergiler düzenli, ordu kontrol altında.',
      [E.tax(0.06), E.stab(3)], ['fat_mustansir']),
    F('fat_ordu', 7, 1, 'Türk ve Sudanlı Alaylar', 'spear', 1040,
      'Fâtımî ordusu Türk atlı okçuları, Sudanlı piyadeler, Berberî ve Ermeni birliklerinden oluşuyor. Aralarındaki kıskançlık bir gün kan dökecek.',
      [E.armies(2, 'Sudanlı Alaylar'), E.mpm(0.08)], ['fat_mustansir']),
    F('fat_suleyhi', 1, 2, 'Süleyhîler Yemen\'de', 'banner', 1047,
      '1047: Fâtımî dâîsi Ali es-Süleyhî, Mesâr dağında ayaklandı ve Yemen\'i Fâtımî halifesi adına birleştirdi.',
      [E.cb(['NAJ', 'ZAY']), E.rel(['NAJ'], -30)], ['fat_cercerai']),
    F('fat_yazuri', 4, 2, 'Vezir el-Yâzûrî', 'scroll', 1050,
      'Tarihî yol: Filistinli kadı el-Yâzûrî vezir oldu; halifenin annesinin desteğiyle Mısır\'ı sekiz yıl yönetecek.',
      [E.tax(0.05), E.stab(5), E.research(0.05)], ['fat_cercerai'], { hist: true }),
    F('fat_turkler', 6, 2, 'Türk Komutanlara Yaslan', 'helm', 1050,
      'Alternatif tarih: Saray Türk komutanlara teslim ediliyor. Ordu güçlenecek, ama Sudanlılar bunu unutmayacak.',
      [E.atk(0.1), E.armies(1, 'Türk Atlıları'), E.stab(-5)], ['fat_ordu'], { alt: true }),
    F('fat_ziri', 9, 2, 'Zîrîlerin İhaneti', 'sword', 1048,
      '1048: İfrikiye\'nin Zîrî emîri el-Muiz, Fâtımî hutbesini kesti ve Bağdat\'taki Abbâsî halifesine bağlandı. Kahire buna cevap vermek zorunda.',
      [X.breakAway('ZIR', 'FAT', 'Zîrîler Fâtımî hutbesini kesip Abbâsî halifesine biat etti!'), E.cb(['ZIR']), E.rel(['ZIR'], -50)], ['fat_ordu']),
    F('fat_dai', 1, 3, 'Dâîler Ağı', 'scroll', 1050,
      'Nâsır-ı Hüsrev Horasan\'a, Mueyyed eş-Şîrâzî İran\'a: İsmâilî davetçiler Kahire\'den bütün İslam dünyasına yayılıyor.',
      [E.missionary(), E.envoy(), E.research(0.05)], ['fat_suleyhi']),
    F('fat_besasiri', 5, 3, 'Besâsîrî ile Anlaşma', 'helm', 1057,
      'Bağdat\'ın Türk komutanı Arslan el-Besâsîrî, Selçuklulara karşı Kahire\'den yardım istiyor. Altın, silah ve Fâtımî sancağı karşılığında Bağdat\'ta Fâtımî halifesi adına hutbe okutacak.',
      [E.gold(-100), E.cb(['ABB', 'SEL'])], null, { reqAny: ['fat_yazuri', 'fat_turkler'], notify: { ABB: 'Fâtımîler, Bağdat\'taki Türk emîri Besâsîrî\'yi destekliyor. Halifeliğe karşı bir darbe hazırlanıyor!', SEL: 'Kahire, Bağdat\'taki Besâsîrî\'ye altın ve silah gönderiyor.' } }),
    F('fat_hilal', 8, 3, 'Benî Hilâl\'i Salıver', 'dragon', 1050,
      'Tarihî yol: Vezir el-Yâzûrî, Yukarı Mısır\'daki azgın Benî Hilâl ve Benî Süleym boylarına "İfrikiye sizin" dedi. Çekirge sürüsü gibi batıya aktılar.',
      [X.hilal(), E.war('ZIR')], ['fat_ziri'], { hist: true }),
    F('fat_ziribaris', 10, 3, 'Zîrîlerle Uzlaş', 'banner', 1050,
      'Alternatif tarih: Elçiler, hediyeler ve bir hanedan evliliği. İfrikiye yeniden Fâtımî hutbesine dönüyor.',
      [E.rel(['ZIR'], 80), E.vassal('ZIR'), E.trade(0.05)], ['fat_ziri'], { alt: true }),
    F('fat_mekke', 1, 4, 'Hicaz Hutbesi', 'crown', 1063,
      '1063: Süleyhî emîri Mekke\'ye girdi; Kâbe\'de Fâtımî halifesi adına hutbe okundu. İki Harem\'in koruyucusu Kahire\'dir.',
      [E.stab(5), E.missionary(), E.rel(['QAR'], -20)], ['fat_dai']),
    F('fat_hutbe', 4, 4, 'Bağdat\'ta Fâtımî Hutbesi', 'banner', 1058,
      'Tarihî yol: Aralık 1058: Besâsîrî Bağdat\'a girdi; halife el-Kâim Hadîse\'ye sürüldü. Bir yıl boyunca Abbâsî başkentinde Fâtımî halifesi adına hutbe okundu.',
      [E.war('ABB'), E.armies(2, 'Besâsîrî\'nin Türkleri'), E.stab(5)], ['fat_besasiri'], { hist: true, notify: { ABB: 'Besâsîrî Fâtımî sancağıyla Bağdat\'a girdi! Halife şehirden kaçmak zorunda.', SEL: 'Bağdat\'ta Fâtımî hutbesi okunuyor; halife Hadîse\'de sürgünde.' } }),
    F('fat_birak', 6, 4, 'Besâsîrî\'yi Yalnız Bırak', 'shield', 1058,
      'Alternatif tarih: Irak macerası Mısır\'ı Selçuklularla savaşa sürükler. Altın Kahire\'de kalsın.',
      [E.gold(200), E.def(0.05), E.stab(5)], ['fat_besasiri'], { alt: true }),
    F('fat_kizildeniz', 9, 4, 'Kızıldeniz Ticareti', 'ship', 1055,
      'Hint baharatı Aden\'den Ayzâb\'a, oradan Kus ve Kahire\'ye. Fâtımî hazinesinin damarı.',
      [E.trade(0.15), E.merchant()], null, { reqAny: ['fat_hilal', 'fat_ziribaris'] }),
    F('fat_sikinti', 5, 5, 'Büyük Sıkıntı', 'scroll', 1065,
      '1065-1072: Nil yedi yıl taşmadı. Kıtlık, veba, Türk ve Sudanlı askerlerin iç savaşı. Halife sarayının hazineleri yağmalandı, Kahire\'de insanlar kedi köpek yedi.',
      [E.stab(-15), E.mp(-10000)], null, { reqAny: ['fat_hutbe', 'fat_birak'] }),
    F('fat_ezher', 9, 5, 'el-Ezher ve Dârü\'l-İlm', 'scroll', 1060,
      'Kahire\'nin medresesi el-Ezher ve el-Hâkim\'in kurduğu Dârü\'l-İlm kütüphanesi, İsmâilî ilminin kalbi.',
      [E.research(0.15), E.tech('kagit', 'Kâğıt')], ['fat_kizildeniz']),
    F('fat_bedr', 4, 6, 'Bedr el-Cemâlî\'yi Çağır', 'helm', 1073,
      'Tarihî yol: Halife, Akka\'daki Ermeni komutan Bedr el-Cemâlî\'yi çağırdı. Kış ortasında denizden geldi, isyancı komutanları bir gecede ortadan kaldırdı ve Mısır\'a düzen getirdi.',
      [E.stab(15), E.atk(0.05), E.armies(2, 'Ermeni Muhafızları'), E.calm(null, 'Bütün ülke')], ['fat_sikinti'], { hist: true }),
    F('fat_nil', 6, 6, 'Nil Bentleri ve Ambarlar', 'coin', 1065,
      'Alternatif tarih: Yusuf\'un ambarları gibi devlet tahıl ambarları ve yeni bentler. Kıtlık atlatılıyor, ordu ayakta kalıyor.',
      [E.stab(12), E.mpm(0.1), E.tax(0.05)], ['fat_sikinti'], { alt: true }),
    F('fat_donanma', 9, 6, 'Akdeniz Donanması', 'ship', 1065,
      'İskenderiye, Dimyat ve Sur tersanelerinde yeni kadırgalar. Fâtımî donanması Doğu Akdeniz\'in efendisi.',
      [E.naval(0.15), E.def(0.03)], ['fat_ezher']),
    F('fat_suriye', 5, 7, 'Suriye\'yi Savun', 'castle', 1071,
      '1071-1076: Türkmen beyi Atsız Kudüs\'ü ve Dımaşk\'ı aldı, Mısır\'a kadar ilerledi. Bedr el-Cemâlî onu Kahire kapılarında durdurdu.',
      [E.forts(3), E.def(0.08), E.cb(['SEL'])], null, { reqAny: ['fat_bedr', 'fat_nil'] }),
    F('fat_iskenderiye', 9, 7, 'İskenderiye Limanı', 'coin', 1070,
      'Venedikli, Cenevizli ve Amalfili tüccarlar İskenderiye\'de: Avrupa\'nın baharatı buradan geçiyor.',
      [E.trade(0.1), E.tax(0.05)], ['fat_donanma']),
    F('fat_1094', 5, 8, '1094: Nizâr mı, Müsta\'lî mi?', 'scroll', 1094,
      'Aralık 1094: el-Müstansır elli sekiz yıllık saltanatın ardından öldü. Büyük oğlu Nizâr veliahttı; ama vezir el-Efdal, kendi damadı genç Müsta\'lî\'yi tahta çıkarmak istiyor.',
      [E.stab(-5)], ['fat_suriye']),
    F('fat_mustali', 4, 9, 'el-Müsta\'lî ve el-Efdal', 'crown', 1094,
      'Tarihî yol: Müsta\'lî halife oldu, Nizâr İskenderiye\'de yenilip öldürüldü. İran\'daki İsmâilîler, Hasan Sabbah önderliğinde Kahire\'den koptu.',
      [E.reign('el-Müsta\'lî', { born: 1074, sk: { adm: 2, dip: 2, mil: 2 } }), E.def(0.05), E.armies(1, 'el-Efdal\'in Ordusu')], ['fat_1094'], { hist: true }),
    F('fat_nizar', 6, 9, 'İmam Nizâr', 'banner', 1094,
      'Alternatif tarih: Meşru veliaht Nizâr tahta çıkıyor. Alamut\'taki Hasan Sabbah ve İran\'daki bütün İsmâilîler Kahire\'ye bağlı kalıyor.',
      [E.reign('Nizâr', { born: 1045, dyn: 'Fâtımî', sk: { adm: 4, dip: 4, mil: 3 }, next: ['el-Hâdî'] }), E.stab(5), E.envoy(), E.missionary(), E.cb(['SEL'])], ['fat_1094'], { alt: true }),
    F('fat_kudus', 5, 10, 'Kudüs\'ü Geri Al', 'sword', 1098,
      '1098: Haçlılar Antakya\'yı kuşatırken el-Efdal, Artukluların elindeki Kudüs\'ü kırk gün kuşatıp aldı.',
      [X.warOwner('Kudüs'), E.siege(0.1), E.armies(1, 'Kudüs Seferi')], null, { reqAny: ['fat_mustali', 'fat_nizar'] }),
    F('fat_askalan', 4, 11, 'Askalan\'ı Tahkim Et', 'castle', 1099,
      'Tarihî yol: Kudüs Temmuz 1099\'da Haçlılara düştü. Askalan, Fâtımîlerin Filistin\'deki son kalesi olarak elli yıl dayanacak.',
      [E.forts(3), E.def(0.1)], ['fat_kudus'], { hist: true }),
    F('fat_cihad', 6, 11, 'Haçlılara Karşı Cihat', 'dragon', 1099,
      'Alternatif tarih: Kahire bütün Müslümanları Frenklere karşı çağırıyor. Sünnî ya da Şiî, Kudüs hepsinin.',
      [X.holyJerusalem(), E.atk(0.08), E.stab(5)], ['fat_kudus'], { alt: true }),
    F('fat_final', 5, 12, 'Kahire\'nin Altın Çağı', 'crown', 1105,
      'Akdeniz\'in en zengin şehri, el-Ezher\'in ilmi ve Kızıldeniz\'in baharatı: Fâtımî Mısırı İslam dünyasının parlayan incisi.',
      [E.tax(0.1), E.trade(0.1), E.stab(10)], null, { reqAny: ['fat_askalan', 'fat_cihad'] }),
  ];
  mutex(FAT, ['fat_yazuri', 'fat_turkler']);
  mutex(FAT, ['fat_hilal', 'fat_ziribaris']);
  mutex(FAT, ['fat_hutbe', 'fat_birak']);
  mutex(FAT, ['fat_bedr', 'fat_nil']);
  mutex(FAT, ['fat_mustali', 'fat_nizar']);
  mutex(FAT, ['fat_askalan', 'fat_cihad']);

  // ================================================================ ABBÂSÎ (konu: Abbâsîlerin yükselişi)
  const ABB = [
    F('abb_kaim', 5, 0, 'el-Kâim bi-emrillâh', 'crown', 1040,
      'Halife el-Kâim, Bağdat\'ın Dârü\'l-Hilâfe sarayında. Sünnî dünyasının imamı ama kılıcı yok: şehri Büveyhî emîrlerinin Türk ve Deylemî askerleri yönetiyor.',
      [E.stab(5), E.envoy()]),
    F('abb_itikad', 3, 1, 'Kâdirî İtikadnâmesi', 'scroll', 1041,
      'Babası el-Kâdir\'in yazdırdığı Sünnî inanç bildirgesi her cuma camilerde okunuyor. Mutezile ve Şiîlik karşısında Bağdat Sünnîliğin kalesi.',
      [E.missionary(), E.stab(5), X.sunni(20)], ['abb_kaim']),
    F('abb_muhafiz', 7, 1, 'Halife Muhafızları', 'helm', 1040,
      'Sarayın birkaç yüz kişilik muhafız birliği büyütülüyor. Halifenin kendi askeri olmadan kimse onun sözünü dinlemez.',
      [E.armies(1, 'Hilafet Muhafızları'), E.cap(1000)], ['abb_kaim']),
    F('abb_ibnmuslime', 3, 2, 'Vezir İbnü\'l-Müslime', 'scroll', 1045,
      'Akıllı ve hırslı vezir Ebü\'l-Kâsım İbnü\'l-Müslime, Büveyhîlerin çöküşünü fırsata çevirmek istiyor.',
      [E.tax(0.06), E.envoy()], ['abb_itikad']),
    F('abb_buveyh', 7, 2, 'Büveyhî Vesayeti', 'shield', 1048,
      'Büveyhî emîri el-Melikü\'r-Rahîm zayıf; Bağdat sokaklarında Türk askerleri ile halk çatışıyor. Halife ya yeni bir hami bulacak ya da kendi ayakları üstünde duracak.',
      [E.stab(-3)], ['abb_muhafiz']),
    F('abb_kanal', 1, 3, 'Nehrevân Kanallarını Onar', 'coin', 1046,
      'Sevad\'ın bereketi kanallara bağlı. Yıkılan bentler onarılınca Bağdat\'ın tahılı yeniden bollaşacak.',
      [E.mpm(0.15), E.tax(0.05)], ['abb_ibnmuslime']),
    F('abb_tugrul', 6, 3, 'Tuğrul Bey\'i Bağdat\'a Davet Et', 'banner', 1055,
      'Tarihî yol: İbnü\'l-Müslime\'nin mektupları Rey\'e ulaştı. Halife, Sünnî Türk sultanını Büveyhîlerin elinden kurtarıcı olarak çağırıyor.',
      [X.breakAway('ABB', 'BUY', 'Tuğrul Bey\'in gelişiyle Büveyhî vesayeti sona erdi.'), E.rel(['SEL'], 80), E.cb(['BUY']), X.ally('SEL')], ['abb_buveyh'], { hist: true, notify: { SEL: 'Halife el-Kâim sizi Bağdat\'a davet ediyor: Büveyhî vesayetine son verin!' } }),
    F('abb_ordu', 8, 3, 'Halifenin Kendi Ordusu', 'sword', 1048,
      'Alternatif tarih: Müsterşid\'den yetmiş yıl önce bir halife kılıç kuşanıyor. Bağdat\'ın gençleri, Arap bedevîler ve satın alınan Türk köleler: Abbâsî ordusu yeniden doğuyor. Hiçbir sultanın himayesine girilmeyecek.',
      [E.armies(2, 'Abbâsî Ordusu'), E.cap(2000), E.mpm(0.2), E.stab(-5), X.independence()], ['abb_buveyh'], { alt: true }),
    F('abb_suk', 1, 4, 'Bağdat Çarşıları', 'coin', 1050,
      'Kerh\'in kumaşçıları, Bâbü\'t-Tâk\'ın kitapçıları: dünyanın en büyük şehirlerinden biri yeniden canlanıyor.',
      [E.trade(0.15), E.merchant()], ['abb_kanal']),
    F('abb_besasiri', 5, 4, 'Besâsîrî Fitnesi', 'dragon', 1058,
      'Aralık 1058: Selçuklu sultanı İbrahim Yinal isyanıyla uğraşırken Türk emîr Besâsîrî, Fâtımî sancağıyla Bağdat\'a girdi. Vezir İbnü\'l-Müslime işkenceyle öldürüldü.',
      [E.stab(-10)], null, { reqAny: ['abb_tugrul', 'abb_ordu'] }),
    F('abb_beytulhikme', 1, 5, 'Beytülhikme\'yi Yeniden Aç', 'scroll', 1055,
      'Me\'mûn\'un "Hikmet Evi" yeniden açılıyor: çevirmenler, gökbilimciler, hekimler Bağdat\'a dönüyor.',
      [E.research(0.15), E.tech('kagit', 'Kâğıt')], ['abb_suk']),
    F('abb_hadise', 4, 5, 'Hadîse Sürgünü', 'scroll', 1059,
      'Tarihî yol: Halife Fırat kıyısındaki Hadîse\'ye sürüldü. Bir yıl sonra Tuğrul Bey Besâsîrî\'yi yendi ve halifeyi atının dizginlerini tutarak Bağdat\'a geri getirdi.',
      [E.stab(5), E.rel(['SEL'], 50)], ['abb_besasiri'], { hist: true }),
    F('abb_direnis', 6, 5, 'Bağdat Direnişi', 'castle', 1058,
      'Alternatif tarih: Halife kaçmıyor. Bağdat\'ın Sünnî mahalleleri, ayyârlar ve halifenin askerleri Besâsîrî\'yi surların önünde durduruyor.',
      [E.def(0.15), E.forts(2), E.armies(1, 'Bağdat Ahâlisi'), E.stab(5)], ['abb_besasiri'], { alt: true }),
    F('abb_hicaz', 1, 6, 'Hicaz\'ın Koruyucusu', 'banner', 1065,
      'Hac kervanları halifenin sancağıyla yola çıkıyor; Mekke ve Medine şerifleri Bağdat\'ın hilatlerini giyiyor.',
      [E.stab(5), E.missionary(), E.cb(['QAR'])], ['abb_beytulhikme']),
    F('abb_evlilik', 4, 6, 'Hanedanlar Arası Evlilik', 'crown', 1062,
      'Tarihî yol: 1062: Halifenin kızı Seyyide Hatun, Tuğrul Bey ile evlendi. Halifelik ile saltanat aynı ailenin içinde.',
      [X.marry('SEL'), E.rel(['SEL'], 40), E.stab(5)], null, { reqAny: ['abb_hadise', 'abb_direnis'], hist: true }),
    F('abb_emirler', 6, 6, 'Arap Emirleri Biat Etsin', 'banner', 1062,
      'Alternatif tarih: Musul\'un Ukaylîleri ve Hille\'nin Mezyedîleri halifenin elini öpüyor. Irak\'ın Arap boyları Abbâsî sancağının altında.',
      [E.vassal('UKA'), E.vassal('MEZ'), E.cap(1000)], null, { reqAny: ['abb_hadise', 'abb_direnis'], alt: true }),
    F('abb_nizamiye', 5, 7, 'Nizamiye ve Sünnî Uyanış', 'scroll', 1067,
      '1067: Bağdat Nizamiye Medresesi açıldı. Eş\'arî kelâmı ve Şâfiî fıkhı devletin resmî ilmi; halife bu uyanışın manevi önderi.',
      [E.research(0.1), E.stab(5), X.sunni(15)], null, { reqAny: ['abb_evlilik', 'abb_emirler'] }),
    F('abb_basra', 8, 7, 'Basra ve Körfez', 'ship', 1070,
      'Alternatif tarih: Halifenin ordusu Dicle\'den aşağı iniyor. Basra\'nın limanı ve Körfez ticareti Bağdat\'a bağlanacak.',
      [E.cb(['BUY']), X.warOwner('Basra'), E.trade(0.1)], ['abb_emirler'], { alt: true }),
    F('abb_muktedi', 5, 8, 'el-Muktedî', 'crown', 1075,
      '1075: El-Kâim kırk dört yıllık hilafetin ardından öldü; on dokuz yaşındaki torunu el-Muktedî halife oldu.',
      [E.reign('el-Muktedî', { born: 1056, sk: { adm: 3, dip: 4, mil: 2 } }), E.stab(3)], ['abb_nizamiye']),
    F('abb_irak', 8, 8, 'Irak\'ın Efendisi', 'dragon', 1080,
      'Alternatif tarih: Musul\'dan Basra\'ya Irak yeniden halifenin. Bağdat, Hârûnürreşîd\'in günlerinden beri ilk kez kendi kaderine hükmediyor.',
      [E.atk(0.08), E.cap(1500), E.mpm(0.1)], ['abb_basra'], { alt: true }),
    F('abb_1092', 5, 9, '1092: Melikşah\'ın Fermanı', 'scroll', 1092,
      '1092: Sultan Melikşah, halifeye "Bağdat\'ı terk et, Basra\'ya git" diye haber gönderdi. Halife on gün mühlet istedi; bu on gün içinde sultan öldü.',
      [E.stab(-5)], ['abb_muktedi']),
    F('abb_boyun', 4, 10, 'Fermana Boyun Eğ', 'shield', 1092,
      'Tarihî yol: Halife sabırla bekledi; tarih onun lehine döndü. Melikşah\'ın ölümüyle Selçuklular taht kavgasına düştü, Bağdat nefes aldı.',
      [E.stab(8), E.rel(['SEL'], 20)], ['abb_1092'], { hist: true }),
    F('abb_bagimsiz', 6, 10, 'Bağımsızlık Hutbesi', 'sword', 1092,
      'Alternatif tarih: Halife sultanın adını hutbeden çıkarıyor. Selçuklu himayesi bitti; Bağdat kendi ordusuyla kendini savunacak.',
      [X.independence(), E.armies(2, 'Hilafet Ordusu'), E.atk(0.08), E.cb(['SEL'])], ['abb_1092'], { alt: true }),
    F('abb_mustazhir', 5, 11, 'el-Müstazhir ve Gazâlî', 'scroll', 1094,
      '1094: el-Müstazhir halife oldu. İmam Gazâlî, Bâtınîlere karşı yazdığı reddiyeyi ona ithaf etti: "el-Müstazhirî".',
      [E.reign('el-Müstazhir', { born: 1078, sk: { adm: 3, dip: 4, mil: 2 } }), E.research(0.1), E.stab(5)], null, { reqAny: ['abb_boyun', 'abb_bagimsiz'] }),
    F('abb_hacli', 5, 12, 'Bağdat\'ın Feryadı', 'banner', 1099,
      '1099: Kudüs\'ten kaçan kadı el-Herevî, Bağdat Camii\'nde başını tıraş edip ağladı. 1111\'de halk camiye baskın yapıp cihat istedi.',
      [X.holyJerusalem(), X.sunni(20), E.stab(5)], ['abb_mustazhir']),
    F('abb_mustersid', 5, 13, 'el-Müsterşid\'in Kılıcı', 'helm', 1118,
      '1118: el-Müsterşid, Abbâsî halifeleri içinde kendi ordusunu kurup savaş meydanına çıkan ilk halife olacak. Himaye çağı bitiyor.',
      [E.reign('el-Müsterşid', { born: 1092, sk: { adm: 4, dip: 3, mil: 4 } }), X.freeIfSel(), E.armies(2, 'Müsterşid\'in Ordusu'), E.atk(0.05)], ['abb_hacli']),
    F('abb_final', 5, 14, 'Abbâsî Hilafetinin Dirilişi', 'dragon', 1120,
      'el-Muktefî ve en-Nâsır\'ın yolu açıldı: Abbâsî halifeliği yeniden Irak\'ta bir devlet, İslam dünyasında bir güç.',
      [E.cap(2000), E.mpm(0.15), E.stab(10), E.cb(['BUY', 'SEL', 'UKA'])], ['abb_mustersid']),
  ];
  mutex(ABB, ['abb_tugrul', 'abb_ordu']);
  mutex(ABB, ['abb_hadise', 'abb_direnis']);
  mutex(ABB, ['abb_evlilik', 'abb_emirler']);
  mutex(ABB, ['abb_boyun', 'abb_bagimsiz']);

  G.FOCUS_TREES.BYZ = finish(BYZ);
  G.FOCUS_TREES.FAT = finish(FAT);
  G.FOCUS_TREES.ABB = finish(ABB);
  G.SPECIAL_TAGS.push('BYZ', 'FAT', 'ABB');

  // Selçuklu ağacındaki olaylar da karşı tarafa duyurulsun
  const sel = id => G.FOCUS_TREES.SEL.find(f => f.id === id);
  sel('sel_bagdat').notify = { ABB: 'Tuğrul Bey Bağdat\'a girdi! Büveyhî hâkimiyeti sona erdi; Selçuklu sultanı halifeyi himayesine almak istiyor.', FAT: 'Selçuklular Bağdat\'ta: Abbâsî halifesinin yeni koruyucusu Tuğrul Bey.' };
  sel('sel_malazgirt').notify = { BYZ: 'Alp Arslan Halep kuşatmasını bırakıp kuzeye, Malazgirt\'e yöneldi. Büyük savaş yaklaşıyor!' };
  sel('sel_zafer').notify = { BYZ: 'Malazgirt felaketi! İmparator esir düştü, ordu dağıldı. Anadolu\'nun kapıları Türklere açıldı.' };
  sel('sel_suriye').notify = { FAT: 'Türkmen beyi Atsız Kudüs\'ü ve Dımaşk\'ı aldı! Suriye elden gidiyor.' };
  sel('sel_halife').notify = { ABB: 'Selçuklu sultanı Bağdat\'ı doğrudan topraklarına katıyor! Halifenin dünyevi gücü sona eriyor.' };
  sel('sel_rum').notify = { BYZ: 'Süleyman Şah İznik\'te sultanlığını ilan etti: Konstantinopolis\'in karşı kıyısında bir Türk devleti.' };

  // ================================================================ profiller
  Object.assign(G.PROFILES, {
    BYZ: {
      title: 'Bizans İmparatorluğu', kind: 'Majör krallık · Romalıların İmparatorluğu', difficulty: 'Orta',
      ruler: { name: 'IV. Mihail', born: 1010, sk: { adm: 2, dip: 3, mil: 2 },
        traits: [['Saralı', 'Ağır sara nöbetleri; tarihte 1041\'de öldü'], ['Kardeşinin gölgesinde', 'Devleti hadım İoannes Orphanotrophos yönetiyor'], ['Dindar', 'Manastırlara ve hastanelere cömert']] },
      heir: { name: 'V. Mihail', born: 1015, sk: { adm: 2, dip: 1, mil: 2 }, note: 'İmparatorun yeğeni; İmparatoriçe Zoe onu evlat edindi. Babasının mesleğinden ötürü "Kalafatçı" diye anılıyor.' },
      capital: 'Konstantinopolis',
      history: [
        'Bulgar Kesen II. Basileios 1025\'te öldüğünde imparatorluk Tuna\'dan Fırat\'a, Ermenistan\'dan Güney İtalya\'ya uzanıyordu: Justinianus\'tan beri en güçlü günleri.',
        'O günden beri taht, Makedonya hanedanının son prensesi Zoe\'nin kocalarının elinde. Saray entrikaları, ağır vergiler ve soylu generallerin hırsı devleti kemiriyor.',
        'Georgios Maniakes 1038-40\'ta Sicilya\'yı Araplardan geri alıyordu; kıskanç saray onu geri çağırdı. Şimdi Balkanlarda Petar Delyan Bulgarları ayaklandırıyor.',
        'Doğuda Ermeni krallıkları birer birer imparatorluğa katılıyor; ama Ceyhun\'un ötesinden yeni bir güç geliyor. Tarihte bu yol 1071\'de Malazgirt\'e varacak.',
      ],
      goals: [['1042', 'Zoe ve Theodora; IX. Konstantinos Monomakhos'], ['1045', 'Ani\'nin ilhakı'], ['1054', 'Büyük Ayrılık'], ['1071', 'Malazgirt ve Bari'],
        ['1081', 'Aleksios Komnenos tahtta'], ['1097', 'Haçlılar ve İznik\'in geri alınması']],
      paths: ['1042: Zoe ve Monomakhos mu, asker imparator Maniakes mi?', '1054: Ayrılık mı, kiliselerin birliği mi?', 'Ermeni temalarını dağıtmak mı, akritasları korumak mı?',
        'Normanlarla savaş mı, ittifak mı?', '1071: Malazgirt felaketi mi, Romanos\'un zaferi mi?', 'Haçlılara güvenmek mi?'],
      rivals: ['SEL', 'PEC', 'FAT', 'SIC', 'HUN'], friends: ['VEN', 'GEO', 'KIE'],
    },
    FAT: {
      title: 'Fâtımî Halifeliği', kind: 'Majör krallık · İsmâilî Halifelik', difficulty: 'Orta', regency: 5,
      ruler: { name: 'el-Müstansır Billâh', born: 1029, sk: { adm: 3, dip: 4, mil: 2 },
        traits: [['Çocuk halife', 'On bir yaşında: beş yıl naiplik (annesi ve vezir)'], ['İsmâilî imam', 'Dâîler ağı Yemen\'den Horasan\'a uzanıyor'], ['Uzun ömürlü', 'Tarihte elli sekiz yıl hüküm sürdü (1036-1094)']] },
      heir: null,
      capital: 'Kahire',
      history: [
        'Ubeydullah el-Mehdî 909\'da İfrikiye\'de kendini halife ilan etti: Peygamber\'in kızı Fâtıma soyundan bir İsmâilî imam, Abbâsîlere rakip bir halifelik.',
        '969\'da komutan Cevher Mısır\'ı aldı ve Kahire\'yi kurdu. el-Ezher, Dârü\'l-İlm ve Nil\'in zenginliğiyle Kahire, Bağdat\'ı gölgede bırakan bir başkent oldu.',
        'Fâtımî sancağı Suriye\'de, Hicaz\'da ve Sicilya\'da dalgalanıyor; dâîler Yemen\'den Horasan\'a İsmâilî davetini yayıyor.',
        'Ama ordu Türkler ile Sudanlılar arasında bölünmüş, İfrikiye\'deki Zîrîler huysuz ve doğudan Sünnî Türkler geliyor. Halife-imam ise henüz bir çocuk.',
      ],
      goals: [['1047', 'Süleyhîler Yemen\'de'], ['1050', 'Benî Hilâl İfrikiye\'de'], ['1058', 'Bağdat\'ta Fâtımî hutbesi'], ['1065', 'Büyük Sıkıntı'],
        ['1073', 'Bedr el-Cemâlî'], ['1094', 'Nizâr ile Müsta\'lî ayrılığı'], ['1099', 'Kudüs ve Askalan']],
      paths: ['Vezir el-Yâzûrî mi, Türk komutanlar mı?', 'Benî Hilâl\'i salmak mı, Zîrîlerle uzlaşmak mı?', 'Besâsîrî\'yle Bağdat macerası mı?',
        'Büyük Sıkıntı: Bedr el-Cemâlî mi, Nil ambarları mı?', '1094: Müsta\'lî mi, Nizâr mı?', 'Haçlılara karşı: Askalan mı, cihat mı?'],
      rivals: ['SEL', 'ABB', 'ZIR', 'BYZ'], friends: ['MIR'],
    },
    ABB: {
      title: 'Abbâsî Halifeliği', kind: 'Minör krallık · Sünnî Halifelik', difficulty: 'Çok zor',
      ruler: { name: 'el-Kâim bi-emrillâh', born: 1001, sk: { adm: 4, dip: 5, mil: 1 },
        traits: [['Halifelerin halifesi', 'Sünnî dünyasının manevi önderi: her Sünnî hükümdar onun onayını ister'], ['Kılıçsız halife', 'Kendi ordusu yok denecek kadar az'], ['Sabırlı', 'Tarihte kırk dört yıl hüküm sürdü (1031-1075)']] },
      heir: { name: 'Zahîretüddîn Muhammed', born: 1030, hist: false, sk: { adm: 3, dip: 3, mil: 2 }, note: 'Halifenin oğlu. Tarihte babasından önce, 1056\'da öldü; hilafet torun el-Muktedî\'ye geçti.' },
      capital: 'Bağdat',
      history: [
        '750\'de Abbâsî devrimi Emevîleri yıktı; 762\'de kurulan Bağdat, Hârûnürreşîd ve Me\'mûn\'un çağında dünyanın en büyük şehri ve bilginin başkenti oldu.',
        '945\'te Şiî Büveyhîler Bağdat\'a girdi. Halifeler bir asır boyunca emîrlerin elinde birer kukla oldu; tahtlarına konup indirildiler, gözlerine mil çekildi.',
        'el-Kâdir (991-1031) Sünnî uyanışını başlattı, İtikadnâme\'yi yazdırdı. Oğlu el-Kâim, Büveyhîlerin çöküşünü sabırla izliyor.',
        'Doğuda yeni bir Sünnî güç doğdu: Selçuklular. Halife ya onları kurtarıcı olarak çağıracak ya da Abbâsîlerin unutulmuş kılıcını yeniden kuşanacak.',
      ],
      goals: [['1055', 'Tuğrul Bey Bağdat\'ta'], ['1058', 'Besâsîrî fitnesi'], ['1062', 'Hanedanlar arası evlilik'], ['1075', 'el-Muktedî'],
        ['1094', 'el-Müstazhir ve Gazâlî'], ['1118', 'el-Müsterşid\'in kılıcı: Abbâsîlerin yükselişi']],
      paths: ['Tuğrul Bey\'i çağırmak mı, kendi ordusunu kurmak mı?', 'Besâsîrî\'ye karşı: sürgün mü, direniş mi?', 'Selçuklu ile evlilik mi, Arap emirlerinin biatı mı?',
        '1092: Melikşah\'ın fermanına boyun eğmek mi, bağımsızlık hutbesi mi?'],
      rivals: ['BUY', 'FAT', 'UKA'], friends: ['SEL', 'GAZ'],
    },
  });
})();
