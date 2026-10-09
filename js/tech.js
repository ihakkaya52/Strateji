// Teknoloji: dört dal (askerî, ulaşım, savunma, ekonomi), yıllara yayılmış buluşlar.
// Zamanının ötesindeki bir buluşu araştırmak katlanarak uzar; geride kalınan buluşlar hızlı öğrenilir.
'use strict';

G.tech = {};
(function () {
  const T = G.tech;
  const DAY = 24;
  T.BASE_DAYS = 220;          // zamanında araştırılan bir buluşun süresi (bir araştırma yeri için)

  T.CATS = {
    askeri: { name: 'Askerî', icon: '⚔', desc: 'Silahlar, zırhlar, süvari ve ordu düzeni' },
    ulasim: { name: 'Ulaşım', icon: '🧭', desc: 'Yollar, gemiler, denizcilik ve keşif' },
    savunma: { name: 'Savunma', icon: '♜', desc: 'Kaleler, surlar, garnizonlar ve erzak' },
    ekonomi: { name: 'Ekonomi', icon: '⚖', desc: 'Tarım, zanaat, ticaret ve bilgi' },
  };

  // Etkiler: [anahtar, değer]; ülke alanına eklenir
  const FX = {
    atk: ['atkMult', 'Saldırı', 'pct'], def: ['defMult', 'Savunma', 'pct'], siege: ['siegeMult', 'Kuşatma gücü', 'pct'],
    speed: ['speedMult', 'Ordu hızı', 'pct'], org: ['orgMult', 'Örgütlenme yenilenmesi', 'pct'], naval: ['navalMult', 'Deniz gücü', 'pct'],
    mp: ['mpMult', 'İnsan gücü', 'pct'], cap: ['capBonus', 'Ordu kapasitesi', 'men'],
    tax: ['taxMult', 'Vergi', 'pct'], trade: ['tradeMult', 'Ticaret geliri', 'pct'], farm: ['farmMult', 'Tarım geliri', 'pct'],
    mine: ['mineMult', 'Maden geliri', 'pct'], build: ['buildMult', 'İnşaat hızı', 'pct'], prod: ['prodMult', 'Silah üretimi', 'pct'],
    food: ['foodMult', 'Kale erzakı', 'pct'], wall: ['wallMult', 'Sur dayanıklılığı', 'pct'], gar: ['garMult', 'Garnizon büyüklüğü', 'pct'],
    shipSpeed: ['shipSpeed', 'Gemi hızı', 'pct'], shipRange: ['shipRange', 'Gemi menzili', 'add'], colRange: ['colRange', 'Keşif ve yerleşim menzili', 'km'],
    colGrowth: ['colGrowth', 'Yerleşim büyümesi', 'pct'], research: ['researchMult', 'Araştırma hızı', 'pct'], stab: ['techStab', 'İstikrar', 'add'],
  };
  const MULT = new Set(['atkMult', 'defMult', 'siegeMult', 'speedMult', 'orgMult', 'navalMult', 'mpMult', 'taxMult', 'tradeMult', 'farmMult',
    'mineMult', 'buildMult', 'prodMult', 'foodMult', 'wallMult', 'garMult', 'shipSpeed', 'colGrowth', 'researchMult']);

  // id, dal, ad, simge, yıl, önkoşullar, etkiler, açıklama
  const D = (id, cat, name, icon, year, req, eff, desc) => ({ id, cat, name, icon, year, req, eff, desc });
  T.LIST = [
    // ---------------------------------------------------------------- askerî
    D('kompozit_yay', 'askeri', 'Kompozit Yay', '🏹', 950, [], [['atk', 0.05]], 'Boynuz, ağaç ve sinirden yapılan kısa ama güçlü yay.'),
    D('uzengi', 'askeri', 'Üzengi', '🐎', 960, [], [['atk', 0.05]], 'Atlı, eyerde sağlam durur; mızrak ve kılıç darbesi güçlenir.'),
    D('zincir_zirh', 'askeri', 'Zincir Zırh', '⛓', 990, [], [['def', 0.06]], 'Binlerce halkadan örülmüş zırh.'),
    D('gulam', 'askeri', 'Gulam ve Memlûk Birlikleri', '🛡', 1000, [], [['cap', 1000]], 'Küçük yaşta yetiştirilen sadık köle askerler.'),
    D('parali', 'askeri', 'Paralı Askerler', '💰', 1040, [], [['mp', 0.08]], 'Altın karşılığı savaşan Varegler, Normanlar ve Türkmen beyleri.'),
    D('mancinik', 'askeri', 'Mancınık', '🪨', 1050, [], [['siege', 0.12]], 'Çekmeli mancınıklar surlara taş yağdırır.'),
    D('agir_suvari', 'askeri', 'Ağır Süvari Hücumu', '🏇', 1060, ['uzengi'], [['atk', 0.08]], 'Koltuk altına sıkıştırılmış mızrakla toplu hücum.'),
    D('mizrak_duvari', 'askeri', 'Mızrak Duvarı', '🔱', 1080, ['zincir_zirh'], [['def', 0.06]], 'Sık saflarda duran piyade süvariye karşı aşılmaz bir duvar örer.'),
    D('ikta', 'askeri', 'İkta Sistemi', '📜', 1090, ['parali'], [['mp', 0.12], ['cap', 1000]], 'Toprak geliri karşılığında atlı asker besleyen komutanlar.'),
    D('arbalet', 'askeri', 'Arbalet', '🎯', 1100, ['kompozit_yay'], [['atk', 0.06], ['siege', 0.05]], 'Az eğitimle kullanılan, zırhı delen tatar yayı.'),
    D('sovalye', 'askeri', 'Askerî Tarikatlar', '✠', 1120, ['agir_suvari'], [['atk', 0.05], ['org', 0.1]], 'Tapınak ve Hastane şövalyeleri: disiplinli seçkin birlikler.'),
    D('talimname', 'askeri', 'Askerî Talimname', '📘', 1150, ['ikta'], [['org', 0.15], ['cap', 1500]], 'Yazılı savaş kuralları, düzenli talim ve kumanda zinciri.'),
    D('karsi_agirlik', 'askeri', 'Karşı Ağırlıklı Mancınık', '🏗', 1180, ['mancinik'], [['siege', 0.2]], 'Dev karşı ağırlıklı mancınık: en kalın surları yıkar.'),
    D('uzun_yay', 'askeri', 'Uzun Yay', '🏹', 1190, ['arbalet'], [['atk', 0.08]], 'İnsan boyunda yay; okçular uzaktan saf bozar.'),
    D('levha_zirh', 'askeri', 'Levha Zırh', '🛡', 1220, ['mizrak_duvari', 'sovalye'], [['def', 0.1]], 'Dövme demir levhalar zincir zırhın üstüne eklenir.'),
    D('ates_mizragi', 'askeri', 'Ateş Mızrağı', '🔥', 1230, ['arbalet', 'karsi_agirlik'], [['atk', 0.06], ['siege', 0.12]], 'Kara barutla ateş püskürten borular: barutlu silahların atası.'),
    // ---------------------------------------------------------------- ulaşım
    D('kervan', 'ulasim', 'Kervan Yolları', '🐫', 950, [], [['speed', 0.04], ['trade', 0.05]], 'Develerle uzun yol ticareti.'),
    D('latin_yelken', 'ulasim', 'Latin Yelkeni', '⛵', 960, [], [['shipSpeed', 0.1]], 'Üçgen yelken rüzgâra karşı da yol aldırır.'),
    D('at_nali', 'ulasim', 'At Nalı', '🧲', 1000, [], [['speed', 0.05]], 'Demir nal atı taşlı yolda korur.'),
    D('tas_kopru', 'ulasim', 'Taş Köprüler', '🌉', 1020, ['kervan'], [['speed', 0.06]], 'Nehirleri her mevsim geçmek mümkün olur.'),
    D('ulak', 'ulasim', 'Menzil ve Ulak Teşkilatı', '📯', 1060, ['at_nali'], [['org', 0.05], ['speed', 0.04]], 'Konaklarda taze at bekleyen ulaklar haberi günler önce ulaştırır.'),
    D('kervansaray', 'ulasim', 'Kervansaraylar', '🏯', 1070, ['kervan'], [['trade', 0.1], ['speed', 0.03]], 'Yol boyunca güvenli konaklar ticareti canlandırır.'),
    D('kafile', 'ulasim', 'Yerleşimci Kafileleri', '⚑', 1080, ['kervan'], [['colGrowth', 0.3]], 'Örgütlü göçler yeni topraklarda tutunur.'),
    D('pusula', 'ulasim', 'Pusula', '🧭', 1100, ['latin_yelken'], [['shipRange', 2], ['colRange', 300]], 'Mıknatıslı iğne bulutlu havada da yönü gösterir.'),
    D('hanlar', 'ulasim', 'Yollar ve Hanlar', '🛤', 1130, ['tas_kopru'], [['speed', 0.07]], 'Bakımlı yollar orduların ikmalini kolaylaştırır.'),
    D('koga', 'ulasim', 'Koga Gemileri', '🚢', 1150, ['latin_yelken'], [['naval', 0.08]], 'Yüksek bordalı, sağlam ticaret ve savaş gemileri.'),
    D('tersane_usulu', 'ulasim', 'Tersane Usulü', '⚓', 1160, ['koga'], [['naval', 0.1]], 'Arsenale benzeyen tersanelerde seri gemi yapımı.'),
    D('kic_dumeni', 'ulasim', 'Kıç Dümeni', '🛞', 1180, ['pusula'], [['shipSpeed', 0.1], ['naval', 0.05]], 'Tek dümen büyük gemileri kolay yönetir.'),
    D('portolan', 'ulasim', 'Portolan Haritaları', '🗺', 1200, ['pusula'], [['colRange', 400], ['shipRange', 2]], 'Kıyıları ve rotaları gösteren deniz haritaları.'),
    D('acik_deniz', 'ulasim', 'Açık Deniz Seyri', '🌊', 1240, ['portolan', 'kic_dumeni'], [['shipRange', 3], ['colRange', 700]], 'Kıyıdan uzaklaşıp okyanusa açılma bilgisi.'),
    // ---------------------------------------------------------------- savunma
    D('ahsap_hisar', 'savunma', 'Ahşap Hisar', '🪵', 950, [], [['food', 0.1]], 'Toprak tepe üstünde ahşap kule ve çit.'),
    D('tas_kale', 'savunma', 'Taş Kale', '🏰', 1000, ['ahsap_hisar'], [['wall', 0.15]], 'Taş duvarlar ateşe ve mancınığa dayanır.'),
    D('sarnic', 'savunma', 'Sarnıçlar', '💧', 1020, ['ahsap_hisar'], [['food', 0.25]], 'Kalede yıllarca yetecek su.'),
    D('uc_beyleri', 'savunma', 'Uç Beyleri', '🏴', 1040, [], [['gar', 0.2]], 'Sınır boylarında kendi askeriyle bekleyen beyler.'),
    D('ic_kale', 'savunma', 'İç Kale', '🗼', 1070, ['tas_kale'], [['gar', 0.25], ['def', 0.03]], 'Sur düşse bile direnen ana kule.'),
    D('hendek', 'savunma', 'Hendek ve Su Kanalları', '〰', 1090, ['sarnic'], [['wall', 0.1], ['food', 0.1]], 'Suyla dolu hendek kuşatma kulelerini uzak tutar.'),
    D('mazgal', 'savunma', 'Mazgallar ve Burçlar', '🏯', 1110, ['tas_kale'], [['wall', 0.2]], 'Çıkıntılı burçlardan surun dibi de okla korunur.'),
    D('rum_atesi', 'savunma', 'Rum Ateşi', '🔥', 1100, ['sarnic'], [['naval', 0.15], ['def', 0.03]], 'Suda bile sönmeyen gizli yangın silahı.'),
    D('erzak_depo', 'savunma', 'Erzak Ambarları', '🌾', 1130, ['hendek'], [['food', 0.3]], 'Uzun kuşatmalar için tahıl ve tuzlu et ambarları.'),
    D('surlu_sehir', 'savunma', 'Surlu Şehirler', '🏙', 1150, ['ic_kale', 'hendek'], [['gar', 0.25], ['food', 0.2]], 'Bütün şehri çevreleyen surlar ve şehir milisi.'),
    D('es_merkezli', 'savunma', 'Eş Merkezli Surlar', '◎', 1180, ['mazgal', 'ic_kale'], [['wall', 0.25], ['gar', 0.2]], 'İç içe surlar: biri düşerse ötekinden savunma sürer.'),
    D('barbakan', 'savunma', 'Barbakan', '🛡', 1220, ['es_merkezli'], [['wall', 0.3], ['def', 0.05]], 'Kapıların önünde ileri savunma kalesi.'),
    // ---------------------------------------------------------------- ekonomi
    D('su_degirmeni', 'ekonomi', 'Su Değirmeni', '⚙', 950, [], [['prod', 0.08]], 'Suyun gücü öğütür, döver ve biçer.'),
    D('agir_saban', 'ekonomi', 'Ağır Saban', '🌱', 980, [], [['farm', 0.25], ['mp', 0.04]], 'Kuzeyin ağır topraklarını derin süren saban.'),
    D('darphane', 'ekonomi', 'Darphane', '🪙', 1000, [], [['tax', 0.08]], 'Ayarı belli sikke, güvenilir vergi.'),
    D('uc_tarla', 'ekonomi', 'Üç Tarla Sistemi', '🌾', 1050, ['agir_saban'], [['farm', 0.25], ['mp', 0.06]], 'Nadas üçe bölünür: aynı toprak daha çok insan besler.'),
    D('kagit', 'ekonomi', 'Kâğıt', '📄', 1050, [], [['research', 0.1], ['tax', 0.04]], 'Semerkant ve Bağdat kâğıdı: kayıt tutmak ucuzlar.'),
    D('medrese', 'ekonomi', 'Medrese ve Katedral Okulları', '🕌', 1070, ['kagit'], [['research', 0.15]], 'Nizamiye medreseleri ve katedral okulları.'),
    D('lonca', 'ekonomi', 'Loncalar', '⚒', 1080, ['su_degirmeni'], [['prod', 0.1], ['build', 0.1]], 'Ustalar örgütlenir, zanaat gelişir.'),
    D('senet', 'ekonomi', 'Senet ve Havale', '✉', 1100, ['darphane'], [['trade', 0.15], ['tax', 0.05]], 'Altın taşımadan ödeme: süftece ve poliçe.'),
    D('derin_maden', 'ekonomi', 'Derin Madencilik', '⛏', 1120, ['lonca'], [['mine', 0.3]], 'Galeriler, havalandırma ve su tahliyesi.'),
    D('panayir', 'ekonomi', 'Panayırlar', '🎪', 1130, ['senet'], [['trade', 0.15]], 'Şampanya ve Ukaz panayırları uzak tüccarları buluşturur.'),
    D('gotik', 'ekonomi', 'Sivri Kemer ve Gotik Yapı', '⛪', 1140, ['lonca'], [['build', 0.2]], 'Daha yüksek, daha hızlı yapılar.'),
    D('universite', 'ekonomi', 'Üniversiteler', '🎓', 1150, ['medrese'], [['research', 0.2], ['stab', 3]], 'Bologna, Paris, Oxford: kendi kendini yöneten bilim kurumları.'),
    D('hukuk', 'ekonomi', 'Hukuk Okulları', '⚖', 1160, ['universite'], [['stab', 4], ['tax', 0.05]], 'Yazılı hukuk ve eğitimli kadılar, yargıçlar.'),
    D('yel_degirmeni', 'ekonomi', 'Yel Değirmeni', '🌬', 1180, ['su_degirmeni'], [['prod', 0.1], ['farm', 0.15]], 'Rüzgâr gücü nehri olmayan ovalara değirmen getirir.'),
    D('bankacilik', 'ekonomi', 'Bankacılık', '🏦', 1200, ['panayir'], [['tax', 0.1], ['trade', 0.1]], 'Ceneviz ve Floransa bankerleri: kredi ve faiz.'),
  ];
  T.BY = {};
  for (const t of T.LIST) T.BY[t.id] = t;

  // Ülkenin başlangıçta bildiği yıl: kültür grubuna ve büyüklüğüne göre
  const GROUP_YEAR = { cin: 1070, bizans: 1040, arap: 1040, iran: 1030, turk_yerlesik: 1020, hint: 1020, latin: 1000, anglosakson: 1000,
    iskandinav: 990, kafkas: 1010, dogu_asya: 1030, gdasya: 1000, turk_bozkir: 990, berberi: 1010, slav: 980, kelt: 980, afrika: 960 };
  const EXTRA = { BYZ: ['rum_atesi'], SNG: ['pusula', 'kagit', 'medrese'], LIA: ['kagit'], FAT: ['kagit', 'senet'], ABB: ['kagit', 'medrese'],
    BUY: ['kagit'], SEL: ['ikta'], GAZ: ['gulam', 'ikta'], VEN: ['senet', 'koga'], GEN: ['senet'], DEN: [], NOR: [] };

  T.text = function ([k, v]) {
    const f = FX[k];
    if (!f) return k;
    if (f[2] === 'pct') return `${f[1]} +%${Math.round(v * 100)}`;
    if (f[2] === 'men') return `${f[1]} +${G.fmtNum(v)} asker`;
    if (f[2] === 'km') return `${f[1]} +${G.fmtNum(v)} km`;
    return `${f[1]} +${v}`;
  };

  const apply = function (n, t) {
    for (const [k, v] of t.eff) {
      const f = FX[k][0];
      if (MULT.has(f)) n[f] = (n[f] ?? 1) + v;
      else n[f] = (n[f] || 0) + v;
      if (f === 'capBonus') for (const a of G.S.armies) if (a.tag === n.tag) a.maxMen += v;
    }
  };
  const grant = function (n, t) {
    if (n.techs.has(t.id)) return;
    n.techs.add(t.id);
    apply(n, t);
  };

  T.init = function () {
    const S = G.S;
    for (const n of Object.values(S.nations)) {
      if (n.techs instanceof Set) { n.research ||= []; continue; }
      n.techs = new Set(n.techs || []);
      n.research = [];
      n.slots ??= n.major ? 3 : 2;
      let y = (GROUP_YEAR[n.group] || 1000) + (n.major ? 15 : 0);
      if (n.rebel) y = 1000;
      // isyancılar ve sonradan doğanlar efendilerinin bilgisini paylaşmaz; yıl sırasıyla, önkoşullara uyarak
      for (const t of T.LIST.slice().sort((a, b) => a.year - b.year)) if (t.year <= y && t.req.every(r => n.techs.has(r))) grant(n, t);
      for (const id of EXTRA[n.tag] || []) {
        const t = T.BY[id];
        for (const r of t.req) if (!n.techs.has(r)) grant(n, T.BY[r]);
        grant(n, t);
      }
    }
  };

  T.has = (tag, id) => !!(G.S.nations[tag] && G.S.nations[tag].techs && G.S.nations[tag].techs.has(id));
  T.available = (tag, t) => {
    const n = G.S.nations[tag];
    return !n.techs.has(t.id) && t.req.every(r => n.techs.has(r)) && !n.research.some(r => r.id === t.id);
  };
  // Zamanın ötesi: her 25 yıl için süre katlanarak artar; geride kalan buluşlar yarı sürede öğrenilir
  T.timeMult = function (t) {
    const ahead = t.year - G.S.time.y;
    if (ahead > 0) return 1 + Math.pow(ahead / 25, 1.5);
    return Math.max(0.45, 1 + ahead / 120);
  };
  T.daily = n => (n.researchMult ?? 1) * (n.rulerSk ? 1 + 0.06 * (n.rulerSk.adm - 3) : 1) * ((n.stability ?? 60) < 30 ? 0.7 : 1);
  T.cost = t => Math.round(T.BASE_DAYS * T.timeMult(t));
  // Kalan gün (tahmin)
  T.daysLeft = function (tag, t) {
    const n = G.S.nations[tag], r = n.research.find(x => x.id === t.id);
    return Math.ceil(((r ? r.need - r.prog : T.cost(t))) / T.daily(n));
  };

  T.start = function (tag, id) {
    const n = G.S.nations[tag], t = T.BY[id];
    if (!t || !T.available(tag, t)) return [false, 'Bu buluş araştırılamaz.'];
    if (n.research.length >= n.slots) return [false, `Bütün araştırma yerleri dolu (${n.research.length} / ${n.slots}).`];
    n.research.push({ id, prog: 0, need: T.cost(t) });
    return [true, ''];
  };
  T.cancel = function (tag, id) {
    const n = G.S.nations[tag];
    n.research = n.research.filter(r => r.id !== id);
  };

  T.dailyTick = function () {
    const S = G.S;
    for (const n of Object.values(S.nations)) {
      if (!n.alive || !n.research || !n.research.length) continue;
      const pts = T.daily(n);
      for (const r of n.research.slice()) {
        r.prog += pts;
        if (r.prog >= r.need) {
          T.cancel(n.tag, r.id);
          const t = T.BY[r.id];
          grant(n, t);
          if (n.tag === S.player) {
            G.log(`Buluş tamamlandı: ${t.icon} ${t.name} (${t.eff.map(T.text).join(', ')}).`, 'good', [n.tag]);
            G.ui.toast && G.ui.toast(`${t.icon} ${t.name} öğrenildi`);
          }
        }
      }
    }
  };

  // Yapay zekâ: boş yere en kısa sürecek buluşu koyar (dallar arasında biraz rastgele)
  T.monthly = function () {
    const S = G.S;
    T.init();
    // ay başında süreler güncellenir: zaman ilerledikçe ileri buluşlar ucuzlar
    for (const n of Object.values(S.nations)) {
      if (!n.alive) continue;
      for (const r of n.research) {
        const need = T.cost(T.BY[r.id]);
        if (need < r.need) r.need = Math.max(r.prog + 1, need);
      }
      if (n.tag === S.player) continue;
      let guard = 0;
      while (n.research.length < n.slots && guard++ < 4) {
        const av = T.LIST.filter(t => T.available(n.tag, t));
        if (!av.length) break;
        av.sort((a, b) => T.cost(a) * (0.8 + G.rng() * 0.5) - T.cost(b) * (0.8 + G.rng() * 0.5));
        T.start(n.tag, av[0].id);
      }
    }
  };

  // ------------------------------------------------------------ etkilerin oyuna bağlanması
  // gemi hızı ve menzili
  const nSpeed = G.navy.speed, nRange = G.navy.range;
  G.navy.speed = f => nSpeed(f) * ((G.S.nations[f.tag] || {}).shipSpeed ?? 1);
  G.navy.range = f => (f.ships.length ? nRange(f) + ((G.S.nations[f.tag] || {}).shipRange || 0) : 0);
  // kale: garnizon büyüklüğü
  const maxGar = G.econ.maxGarrison;
  G.econ.maxGarrison = p => Math.round(maxGar(p) * ((G.S && G.S.nations[p.owner] || {}).garMult ?? 1));
  // keşif / yerleşim menzili ve yerleşim büyümesi
  const xRange = G.explore.RANGE, xGrowth = G.explore.growth;
  G.explore.RANGE = tag => xRange(tag) + (G.S.nations[tag].colRange || 0);
  G.explore.growth = (tag, p) => xGrowth(tag, p) * (G.S.nations[tag].colGrowth ?? 1);
  // istikrar
  const stabF = G.stab.stabFactors;
  G.stab.stabFactors = function (n) {
    const f = stabF(n);
    if (n.techStab) f.push(['Bilim ve hukuk', n.techStab]);
    return f;
  };
})();
