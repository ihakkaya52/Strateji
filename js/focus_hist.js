// Tarihî odak ağaçları ve ulus profilleri: şimdilik Büyük Selçuklu ve İngiltere.
// Odakların çoğu gerçek olaylardır ve yılı gelmeden açılmaz; dönüm noktalarında birbirini dışlayan alternatif tarihler vardır.
'use strict';

(function () {
  const S_ = () => G.S;
  const alive = t => !!(G.S.nations[t] && G.S.nations[t].alive);
  const nm = t => (G.S && G.S.nations[t] ? G.S.nations[t].name : (window.WORLD.nations[t] || { name: t }).name);
  const byName = name => G.S.provinces.find(p => p.name === name);
  const pct = v => `%${Math.round(Math.abs(v) * 100)}`;
  const sg = v => (v < 0 ? '−' : '+');

  // ------------------------------------------------------------ etki yapı taşları: {text, fn}
  const E = {
    mp: v => ({ text: `${sg(v)}${G.fmtNum(Math.abs(v))} insan gücü`, fn: n => { n.manpower += v; } }),
    mpm: v => ({ text: `Aylık insan gücü ${sg(v)}${pct(v)}`, fn: n => { n.mpMult += v; } }),
    atk: v => ({ text: `Saldırı ${sg(v)}${pct(v)}`, fn: n => { n.atkMult += v; } }),
    def: v => ({ text: `Savunma ${sg(v)}${pct(v)}`, fn: n => { n.defMult += v; } }),
    siege: v => ({ text: `Kuşatma ${sg(v)}${pct(v)}`, fn: n => { n.siegeMult += v; } }),
    speed: v => ({ text: `Ordu hızı ${sg(v)}${pct(v)}`, fn: n => { n.speedMult += v; } }),
    org: v => ({ text: `Örgütlenme ${sg(v)}${pct(v)}`, fn: n => { n.orgMult += v; } }),
    naval: v => ({ text: `Deniz gücü ${sg(v)}${pct(v)}`, fn: n => { n.navalMult += v; } }),
    tax: v => ({ text: `Vergi ${sg(v)}${pct(v)}`, fn: n => { n.taxMult = (n.taxMult ?? 1) + v; } }),
    trade: v => ({ text: `Ticaret geliri ${sg(v)}${pct(v)}`, fn: n => { n.tradeMult = (n.tradeMult ?? 1) + v; } }),
    research: v => ({ text: `Araştırma hızı ${sg(v)}${pct(v)}`, fn: n => { n.researchMult = (n.researchMult ?? 1) + v; } }),
    stab: v => ({ text: `İstikrar ${v > 0 ? '+' : ''}${v}`, fn: n => { n.stabBonus = (n.stabBonus || 0) + v; n.stability = G.clamp((n.stability ?? 60) + v, 0, 100); } }),
    gold: v => ({ text: `${sg(v)}${G.fmtNum(Math.abs(v))} altın`, fn: n => { n.gold += v; } }),
    cap: v => ({ text: `Ordu kapasitesi +${G.fmtK(v)}`, fn: n => { n.capBonus += v; for (const a of G.S.armies) if (a.tag === n.tag) a.maxMen += v; } }),
    armies: (k, name) => ({ text: `${k} yeni ordu: ${name}`, fn: n => G.focus.spawnArmies(n, k, name) }),
    envoy: () => ({ text: '+1 elçi', fn: n => { n.envoys++; } }),
    missionary: () => ({ text: '+1 misyoner', fn: n => { n.missionaries = (n.missionaries || 1) + 1; } }),
    merchant: () => ({ text: '+1 tüccar', fn: n => { n.merchants = (n.merchants || 1) + 1; } }),
    tech: (id, label) => ({ text: `Buluş: ${label}`, fn: n => G.tech.grant(n.tag, id) }),
    cb: tags => ({ text: `Savaş gerekçesi: ${tags.map(nm).join(', ')}`, fn: n => { for (const t of tags) if (alive(t) && !G.sameRealm(t, n.tag)) n.claims.add(t); } }),
    // savaş: zaten başka bir savaştaysak yalnızca savaş gerekçesi verir (force: her durumda savaş)
    war: (tag, force) => ({ text: force ? `${nm(tag)} ile savaş` : `${nm(tag)} ile savaş (başka savaştaysak yalnızca savaş gerekçesi)`, fn: n => {
      if (!alive(tag) || G.atWar(n.tag, tag) || G.sameRealm(tag, n.tag)) return;
      if (!force && n.enemies.size) { n.claims.add(tag); return; }
      G.declareWar(n.tag, tag, true);
    } }),
    rel: (tags, v) => ({ text: `${tags.map(nm).join(', ')} ile ilişki ${v > 0 ? '+' : ''}${v}`, fn: n => { for (const t of tags) if (alive(t)) G.dip.add(n.tag, t, v); } }),
    // tahta çıkış: tarihî ya da alternatif hükümdar (eskisi tarihe karışır)
    reign: (name, opt = {}) => ({
      text: `Hükümdar: ${name}`,
      fn: n => {
        const S = G.S;
        const dead = (n.pastRulers || []).some(r => r.name === name);   // ölmüş biri yeniden tahta çıkmaz
        if (n.ruler !== name && !dead) {
          n.pastRulers ||= [];
          n.pastRulers.unshift({ name: n.ruler, from: n.reignStart ?? 1040, to: S.time.y, age: G.dyn.age(n) });
          n.ruler = name; n.reignStart = S.time.y; n.rulerTitle = null;
          n.rulerBorn = opt.born ?? S.time.y - 35;
          n.rulerSk = opt.sk ? { ...opt.sk } : { adm: 3, dip: 3, mil: 4 };
          n.regency = 0;
        }
        if (opt.dyn) n.dynasty = opt.dyn;
        const h = G.dyn.HIST[n.tag], i = h ? h.next.indexOf(name) : -1;
        if (opt.next) { n.histNext = opt.next; n.histIdx = 0; } else if (i >= 0) { n.histNext = null; n.histIdx = i + 1; }
        if (!n.heir || n.heir.name === name || n.heir.hist || n.heir.born <= n.rulerBorn) n.heir = G.dyn.makeHeir(n, 0, 14);
        G.labelsDirty = true;
        if (G.ui.refreshTop && n.tag === S.player) setTimeout(() => G.ui.refreshTop(), 0);
      },
    }),
    heir: (name, born) => ({ text: `Veliaht: ${name}`, fn: n => { if (n.ruler === name) return; n.heir = { name, born, sk: { adm: 4, dip: 3, mil: 3 }, hist: true, idx: 0 }; } }),
    // efendiden barışla ayrılış
    release: () => ({ text: 'Danimarka tacından barışla ayrılış: bağımsızlık', fn: n => {
      if (!n.overlord) return;
      const lord = n.overlord;
      n.overlord = null; n.tribute = 0;
      G.labelsDirty = true;
      G.log(`${n.name} artık bağımsız: ${nm(lord)} tacıyla bağlar barışla koptu.`, 'good', [n.tag, lord]);
    } }),
    indepWar: () => ({ text: 'Efendiye karşı bağımsızlık savaşı', fn: n => { if (n.overlord) G.declareIndependence(n.tag); } }),
    noTribute: () => ({ text: 'Efendiye haraç kalkar', fn: n => { n.tribute = 0; } }),
    vassal: tag => ({ text: `${nm(tag)} vasalımız olur`, fn: n => {
      const v = G.S.nations[tag];
      if (!v || !v.alive || G.atWar(n.tag, tag)) return;
      // kendi ordusunu kurmuş bir halife himayeyi reddeder: yalnızca savaş gerekçesi doğar
      if (v.focus && ['abb_ordu', 'abb_direnis'].some(id => v.focus.done.has(id))) { n.claims.add(tag); G.log(`${v.name} ${n.name} himayesini reddetti!`, 'war', [n.tag, tag]); return; }
      v.overlord = n.tag; G.labelsDirty = true;
      G.log(`${v.name} artık ${n.name} himayesinde.`, 'good', [n.tag, tag]);
    } }),
    annex: tag => ({ text: `${nm(tag)} topraklarımıza katılır`, fn: n => {
      for (const p of G.S.provinces) if (p.owner === tag) G.transferProvince(p.id, n.tag);
      G.checkElimination();
    } }),
    capital: name => ({ text: `Başkent ${name} olur (elimizdeyse)`, fn: n => { const p = byName(name); if (p && p.owner === n.tag) { n.capital = p.id; G.labelsDirty = true; } } }),
    forts: k => ({ text: `${k} şehre kale`, fn: n => {
      const c = G.S.provinces.filter(p => p.owner === n.tag && p.kind !== 'rural' && p.fort < G.econ.MAX_FORT).sort((a, b) => a.fort - b.fort).slice(0, k);
      for (const p of c) { p.fort++; p.walls = 100; }
    } }),
    calm: (names, label) => ({ text: `${label}: huzursuzluk biter`, fn: n => { for (const p of G.S.provinces) if (p.owner === n.tag && (!names || names.includes(p.name) || names.includes(p.home))) p.unrest = 0; } }),
    unrest: v => ({ text: `Bütün illerde huzursuzluk +${v}`, fn: n => { for (const p of G.S.provinces) if (p.owner === n.tag) p.unrest = Math.min(100, (p.unrest || 0) + v); } }),
    // istilacı orduları belli bir ile çıkarır
    invade: (tag, prov, k, men, name) => ({ text: `${nm(tag)} ${k} orduyla ${prov} kıyılarına çıkar!`, fn: n => {
      if (!alive(tag)) return;
      const p = byName(prov);
      if (!G.atWar(tag, n.tag)) G.declareWar(tag, n.tag, true);
      const at = p ? p.id : G.spawnPoint(n.tag);
      for (let i = 0; i < k; i++) { const a = G.createArmy(tag, at, men); a.gear = G.econ.need(a); a.name = `${name} ${i + 1}`; }
    } }),
    // Normandiya Dükalığı ortaya çıkar (Fransa'dan ayrılır) ve İngiltere'yi istila eder
    normans: () => ({ text: 'Normandiya Dükü William İngiltere\'ye çıkar!', fn: n => {
      const S = G.S;
      if (!S.nations.NMD || !S.nations.NMD.alive) {
        G.addNation('NMD', { name: 'Normandiya Dükalığı', color: '#a8402e', major: false, ruler: 'Piç William', religion: 'katolik', group: 'latin' });
        const NR = S.nations.NMD;
        NR.culture = 'fransiz';
        for (const c of ['Rouen', 'Caen', 'Coutances']) for (const p of G.cityAndRural(c)) if (p.owner === 'FRA' || !p.owner) G.transferProvince(p.id, 'NMD');
        const cap = byName('Rouen'); if (cap) NR.capital = cap.id;
        NR.manpower = 20000; NR.gold = 300;
      }
      E.invade('NMD', 'Lewes', 3, 11000, 'Norman Şövalyeleri').fn(n);
    } }),
    // Normandiya İngiliz tacına katılır (Fatih William yolu)
    normandy: () => ({ text: 'Normandiya (Rouen, Caen, Coutances) İngiliz tacına katılır', fn: n => {
      for (const c of ['Rouen', 'Caen', 'Coutances']) for (const p of G.cityAndRural(c)) if (p.owner === 'FRA' || p.owner === 'NMD') G.transferProvince(p.id, n.tag);
      if (G.S.nations.FRA) G.dip.add(n.tag, 'FRA', -40);
      G.checkElimination();
    } }),
    // Malazgirt: Bizans ordusu dağılır, imparator esir düşer
    manzikert: () => ({ text: 'Bizans ordularının dörtte biri dağılır, Bizans istikrarı −25', fn: n => {
      const B = G.S.nations.BYZ;
      if (!B || !B.alive) return;
      for (const a of G.S.armies) if (a.tag === 'BYZ') a.men = Math.round(a.men * 0.75);
      B.stability = Math.max(0, (B.stability ?? 60) - 25);
      G.log('Malazgirt: İmparator Romen Diyojen esir düştü! Bizans sarsılıyor.', 'war', [n.tag, 'BYZ']);
    } }),
    // Anadolu Selçukluları: Bizans'tan alınan Anadolu illeri bir vasal sultanlık olur
    rumSultanate: () => ({ text: 'Anadolu\'daki illerimiz vasal Anadolu Selçuklu Sultanlığı olur', fn: n => {
      const S = G.S;
      const list = S.provinces.filter(p => p.owner === n.tag && p.x < 41 && G.unprojLat(p.y) > 36 && G.unprojLat(p.y) < 42.5);
      if (!list.length) { G.log('Anadolu\'da henüz elimizde il yok; Süleyman Şah uç beylerini topluyor.', 'info', [n.tag]); n.manpower += 10000; return; }
      if (!S.nations.RUM || !S.nations.RUM.alive) G.addNation('RUM', { name: 'Anadolu Selçuklu Sultanlığı', color: '#4f9a86', major: false, ruler: 'Süleyman Şah', religion: 'sunni', group: 'turk_bozkir' });
      const R = S.nations.RUM;
      R.culture = 'oguz'; R.overlord = n.tag;
      for (const p of list) { G.transferProvince(p.id, 'RUM'); p.core = 'RUM'; }
      R.capital = list[0].id; R.manpower = 15000; R.gold = 150;
      G.focus.spawnArmies(R, 2, 'Uç Beyleri');
    } }),
  };

  // Odak: id, x, y, ad, simge, yıl, açıklama, etkiler, önkoşul, ek
  const F = (id, x, y, name, icon, year, desc, effects, req, extra) => ({
    id, x, y, name, icon, year, desc, req,
    effectText: effects.map(e => e.text).join(' · '),
    effect: n => effects.forEach(e => e.fn(n)),
    ...(extra || {}),
  });
  // birbirini dışlayan odaklar
  const mutex = (list, ids) => {
    for (const id of ids) {
      const f = list.find(o => o.id === id);
      f.mutex = ids.filter(x => x !== id);
    }
  };
  const finish = list => {
    for (const f of list) {
      if (f.mutex) f.effectText += ` · Kapatır: ${f.mutex.map(m => list.find(o => o.id === m).name).join(', ')}`;
    }
    return list;
  };

  // ================================================================ BÜYÜK SELÇUKLU
  const SEL = [
    F('sel_dandanakan', 5, 0, 'Dandanakan Zaferi', 'sword', 1040,
      '23 Mayıs 1040. Merv ile Serahs arasındaki Dandanakan\'da Gazneli Sultan Mesud\'un fillerle desteklenen ordusu, susuz çölde üç gün süren çarpışmanın sonunda bozguna uğradı. Horasan artık Selçukluların.',
      [E.stab(5), E.gold(120), E.atk(0.05)]),
    F('sel_kurultay', 5, 1, 'Merv Kurultayı', 'banner', 1040,
      'Zaferin ardından Merv\'de toplanan kurultay devleti kurdu: Tuğrul Bey batıya, Çağrı Bey doğuya; İbrahim Yinal, Kutalmış ve Musa Yabgu kendi uçlarına. Hilafete fetihnâme gönderildi.',
      [E.cap(1500), E.armies(1, 'Çağrı Bey\'in Ordusu'), E.rel(['ABB'], 40)], ['sel_dandanakan']),
    F('sel_bati', 3, 2, 'Batıya Yürü: Irak-ı Acem', 'banner', 1041,
      'Tuğrul Bey\'in gözü Rey\'de, İsfahan\'da ve Bağdat\'ta. Büveyhîlerin çöken düzeni ve Kâkûyîlerin şehirleri Türkmen atlılarını bekliyor.',
      [E.cb(['KAK', 'ZIY']), E.speed(0.05)], ['sel_kurultay'], { hist: true }),
    F('sel_dogu', 6, 2, 'Gazne\'yi Bitir', 'sword', 1041,
      'Alternatif tarih: Çağrı Bey\'in sözü geçer. Gazneliler tamamen ezilmeden batıya yürümek, arkada yaralı bir aslan bırakmaktır. Hedef Gazne ve Hint\'in zenginlikleri.',
      [E.war('GAZ'), E.atk(0.08), E.cb(['GAZ'])], ['sel_kurultay'], { alt: true }),
    F('sel_divan', 8, 2, 'Divan Teşkilatı', 'scroll', 1040,
      'Horasanlı kâtipler, Gazneli ve Sâmânî geleneğiyle devlet divanını kuruyor: Divân-ı İstîfâ, Divân-ı Arz, Divân-ı İnşâ.',
      [E.tax(0.06), E.stab(3)], ['sel_kurultay']),
    F('sel_turkmen', 10, 2, 'Türkmenleri Uçlara Gönder', 'spear', 1043,
      'Horasan\'a akın eden göçebe Türkmenler yerleşik halka yük oluyor. Onları Azerbaycan ve Ermeniye uçlarına, Bizans sınırına yönlendirelim.',
      [E.armies(2, 'Türkmen Akıncıları'), E.cb(['ANI', 'RAV'])], ['sel_kurultay']),
    F('sel_harezm', 2, 3, 'Harezm\'in Fethi', 'sword', 1042,
      '1042: Gazneli valisi Şah Melik\'in elindeki Harezm, Aral kıyısının zengin vahası, Selçuklu ülkesine katılmalı.',
      [E.cb(['KHW']), E.war('KHW')], ['sel_bati']),
    F('sel_rey', 4, 3, 'Rey Başkent Olsun', 'castle', 1043,
      'Tuğrul Bey 1043\'te Rey\'i aldı ve devletin merkezini buraya taşıdı. Rey\'i ele geçirdiysek başkentimiz olsun.',
      [E.capital('Rey'), E.stab(5), E.tax(0.05)], ['sel_bati'], { avail: n => { const p = byName('Rey'); return !!p && p.owner === n.tag; }, need: 'Rey elimizde olmalı' }),
    F('sel_gazne', 6, 3, 'Gazne Sarayına Giriş', 'crown', 1043,
      'Alternatif tarih: Gazne düştü. Mahmud\'un hazineleri, Hint seferlerinden kalma altın ve filler artık Selçukluların.',
      [E.gold(300), E.capital('Gazne'), E.cap(1000)], ['sel_dogu'], { alt: true, avail: n => { const p = byName('Gazne'); return !!p && p.owner === n.tag; }, need: 'Gazne elimizde olmalı' }),
    F('sel_ikta', 8, 3, 'İkta Sistemi', 'coin', 1045,
      'Toprağın vergisi, karşılığında atlı asker besleyen komutanlara bırakılıyor. Ordu hazineye yük olmadan büyüyor.',
      [E.mpm(0.12), E.cap(1000), E.tech('ikta', 'İkta Sistemi')], ['sel_divan']),
    F('sel_pasinler', 10, 3, 'Pasinler Savaşı', 'sword', 1048,
      '1048: İbrahim Yinal ve Kutalmış, Bizans-Gürcü ordusunu Pasinler\'de yendi; Gürcü prensi Liparit esir düştü. Bizans\'ın doğu sınırı ilk kez sarsıldı.',
      [E.atk(0.05), E.cb(['BYZ', 'GEO'])], ['sel_turkmen']),
    F('sel_azerbaycan', 2, 4, 'Azerbaycan ve Arran', 'banner', 1054,
      '1054: Tuğrul Bey Tebriz\'e girdi; Revvâdîler ve Şeddâdîler sultana bağlılık bildirdi. Kafkasya\'nın kapıları açık.',
      [E.vassal('RAV'), E.cb(['SHE', 'SHI'])], ['sel_harezm']),
    F('sel_isfahan', 4, 4, 'İsfahan Kuşatması', 'castle', 1050,
      '1050-51: Bir yıl süren kuşatmanın ardından Kâkûyîlerin İsfahan\'ı teslim oldu. Şehir, Selçukluların gözdesi olacak.',
      [E.war('KAK'), E.siege(0.15)], ['sel_rey']),
    F('sel_hind', 6, 4, 'Hint Seferleri', 'dragon', 1048,
      'Alternatif tarih: Mahmud\'un izinden Pencap\'a ve Ganj ovasına. Hindistan\'ın tapınak hazineleri Türk atlılarını çağırıyor.',
      [E.cb(['PAR', 'TOM', 'CHH']), E.atk(0.05), E.gold(150)], ['sel_gazne'], { alt: true }),
    F('sel_nizam', 8, 4, 'Vezir Nizâmülmülk', 'scroll', 1060,
      'Tûslu Hasan b. Ali, Nizâmülmülk unvanıyla vezir oluyor: otuz yıl boyunca devleti o yönetecek. Siyâsetnâme\'nin yazarı, düzenin mimarı.',
      [E.stab(5), E.tax(0.06), E.research(0.1), E.envoy()], ['sel_ikta']),
    F('sel_ani', 10, 4, 'Ani\'nin Fethi', 'castle', 1064,
      '1064: "Bin bir kiliseli" Ermeni başkenti Ani, Alp Arslan\'ın kuşatmasıyla düştü. Doğu Anadolu\'nun anahtarı artık bizde.',
      [E.siege(0.1), E.cb(['BYZ', 'ANI', 'GEO'])], ['sel_pasinler']),
    F('sel_bagdat', 4, 5, 'Bağdat\'a Giriş', 'crown', 1055,
      'Aralık 1055: Tuğrul Bey Bağdat\'a girdi, Büveyhî hâkimiyeti sona erdi. Halife el-Kâim ona "Doğunun ve Batının Sultanı" unvanını verdi. Abbâsî halifesi artık Selçuklu himayesinde.',
      [E.vassal('ABB'), E.cb(['BUY']), E.stab(10), E.missionary()], null, { reqAny: ['sel_isfahan', 'sel_hind'] }),
    F('sel_nizamiye', 8, 5, 'Nizamiye Medreseleri', 'scroll', 1065,
      '1065-67: Bağdat\'ta Nizamiye Medresesi açılıyor; ardından Nişabur, İsfahan, Belh, Herat. Sünnî ilim devletin omurgası olacak.',
      [E.research(0.15), E.stab(3), E.tech('medrese', 'Medrese ve Katedral Okulları')], ['sel_nizam']),
    F('sel_sultan', 3, 6, 'Doğunun ve Batının Sultanı', 'crown', 1058,
      '1058-59: Türk emîr Besâsîrî, Fâtımîler adına Bağdat\'ta hutbe okuttu; Tuğrul Bey dönüp şehri geri aldı, halifeyi tahtına iade etti. Selçuklu, Sünnî dünyanın kılıcıdır.',
      [E.cb(['FAT', 'MIR']), E.stab(5), E.def(0.05)], ['sel_bagdat'], { hist: true }),
    F('sel_halife', 5, 6, 'Halifeliği Kendine Bağla', 'crown', 1056,
      'Alternatif tarih: Bir halifenin himayesi yetmez. Bağdat doğrudan sultana bağlanır, halife sarayında yalnızca dua eder. Dünya buna nasıl bakacak?',
      [E.annex('ABB'), E.stab(-5), E.cap(1500), E.armies(1, 'Bağdat Muhafızları')], ['sel_bagdat'], { alt: true }),
    F('sel_suriye', 2, 7, 'Suriye ve Kudüs', 'sword', 1070,
      '1070-76: Türkmen beyi Atsız Kudüs\'ü ve Dımaşk\'ı Fâtımîlerden aldı. Halep\'teki Mirdâsîler sultana bağlandı.',
      [E.cb(['FAT', 'MIR', 'NUM']), E.atk(0.05)], ['sel_sultan']),
    F('sel_hilafet', 6, 7, 'Sultan-Halife Ordusu', 'helm', 1060,
      'Alternatif tarih: Halifenin sancağı ve sultanın kılıcı tek elde. Bütün Sünnî emirlikler bu orduya asker yollamak zorunda.',
      [E.armies(2, 'Hilafet Ordusu'), E.mpm(0.1)], ['sel_halife'], { alt: true }),
    F('sel_tugrul', 4, 7, 'Tuğrul Bey\'in Ölümü', 'scroll', 1063,
      'Eylül 1063: Tuğrul Bey Rey\'de yetmiş yaşında öldü. Oğlu yok. Tahtın sahibi kim olacak: Çağrı Bey\'in oğlu Alp Arslan mı, Arslan Yabgu\'nun oğlu Kutalmış mı?',
      [E.stab(-5)], null, { reqAny: ['sel_sultan', 'sel_halife'] }),
    F('sel_alparslan', 3, 8, 'Sultan Alp Arslan', 'crown', 1063,
      'Tarihî yol: Alp Arslan, Damgan yakınlarında Kutalmış\'ı yendi. Kutalmış atından düşüp öldü; oğulları Süleyman ve Mansur Anadolu\'ya, Türkmenlerin arasına kaçtı.',
      [E.reign('Alp Arslan', { born: 1029, sk: { adm: 4, dip: 3, mil: 6 } }), E.atk(0.05), E.stab(5)], ['sel_tugrul'], { hist: true }),
    F('sel_kutalmis', 5, 8, 'Kutalmış\'ın Davası', 'helm', 1063,
      'Alternatif tarih: Selçuk\'un büyük oğlu Arslan Yabgu\'nun soyu tahta çıkıyor. Kutalmış uç beyleriyle, Türkmen gelenekleriyle yönetecek; gözü hep Bizans\'ta.',
      [E.reign('Kutalmış', { born: 1015, dyn: 'Selçuklu (Kutalmışoğulları)', sk: { adm: 3, dip: 3, mil: 5 }, next: ['Süleyman Şah', 'I. Kılıç Arslan'] }), E.armies(2, 'Uç Türkmenleri'), E.stab(-5)], ['sel_tugrul'], { alt: true }),
    F('sel_meliksah', 8, 8, 'Selçuklu Altın Çağı', 'coin', 1072,
      '1072-1092: Melikşah ve Nizâmülmülk dönemi. Kaşgar\'dan Akdeniz\'e yollar güvenli, kervansaraylar dolu, İsfahan dünyanın en parlak şehirlerinden biri.',
      [E.tax(0.1), E.trade(0.1), E.stab(5), E.merchant()], ['sel_nizamiye'], { reqAny: ['sel_alparslan', 'sel_kutalmis'] }),
    F('sel_malazgirt', 10, 8, 'Malazgirt Seferi', 'sword', 1071,
      'Bahar 1071: İmparator Romanos Diogenes, Doğu Anadolu\'yu Türklerden temizlemek için büyük bir orduyla yola çıktı. Alp Arslan Halep kuşatmasını bırakıp kuzeye dönüyor.',
      [E.war('BYZ', true), E.armies(2, 'Malazgirt Ordusu'), E.atk(0.1)], ['sel_ani'], { reqAny: ['sel_alparslan', 'sel_kutalmis'] }),
    F('sel_zafer', 10, 9, 'Malazgirt Zaferi', 'dragon', 1071,
      '26 Ağustos 1071: Hilal taktiğiyle kuşatılan Bizans ordusu dağıldı, İmparator Romanos Diogenes esir düştü. Anadolu\'nun kapıları Türklere açıldı.',
      [E.manzikert(), E.cb(['BYZ']), E.armies(2, 'Anadolu Akıncıları'), E.stab(10)], ['sel_malazgirt'],
      { avail: n => ['Mantzikert', 'Van', 'Theodosiopolis', 'Taron'].some(x => { const p = byName(x); return p && p.ctrl === n.tag; }), need: 'Malazgirt, Van, Taron ya da Theodosiopolis elimizde olmalı' }),
    F('sel_celali', 8, 9, 'Celâlî Takvimi', 'scroll', 1079,
      '1079: Ömer Hayyam ve İsfahan rasathanesindeki gökbilimciler, Gregoryen takviminden bile daha doğru bir güneş takvimi hazırladı.',
      [E.research(0.1), E.tax(0.04)], ['sel_meliksah']),
    F('sel_rum', 9, 10, 'Anadolu Selçukluları', 'banner', 1075,
      'Tarihî yol: Kutalmışoğlu Süleyman Şah, 1075\'te İznik\'i aldı ve Anadolu\'da ayrı bir sultanlık kurdu. Selçuklu ağacının yeni bir dalı: Türkiye Selçukluları.',
      [E.rumSultanate(), E.stab(5)], ['sel_zafer'], { hist: true }),
    F('sel_merkez', 11, 10, 'Anadolu\'yu Merkeze Bağla', 'castle', 1075,
      'Alternatif tarih: Uç beylerine ayrı bir taht yok. Anadolu doğrudan İsfahan\'dan yönetilecek; Türkmenler sultanın sancağı altında batıya akacak.',
      [E.cb(['BYZ']), E.mpm(0.1), E.def(0.05), E.calm(null, 'Bütün ülke')], ['sel_zafer'], { alt: true }),
    F('sel_alamut', 8, 10, 'Alamut Kalesi', 'castle', 1090,
      '1090: Hasan Sabbah, Deylem dağlarındaki Alamut\'u hileyle ele geçirdi. Bâtınî fedaileri sultanlara ve vezirlere hançer sallayacak.',
      [E.siege(0.1), E.def(0.05)], ['sel_celali']),
    F('sel_iznik', 10, 11, 'İznik ve Boğazlar', 'ship', 1078,
      'Türkmen beyleri Marmara kıyısına ulaştı. Konstantinopolis\'in surları karşı kıyıdan görünüyor. Çaka Bey İzmir\'de bir donanma kuruyor.',
      [E.cb(['BYZ']), E.naval(0.15), E.atk(0.05)], null, { reqAny: ['sel_rum', 'sel_merkez'] }),
    F('sel_1092', 8, 11, '1092: Büyük Kriz', 'scroll', 1092,
      'Ekim 1092: Nizâmülmülk bir Bâtınî fedaisinin hançeriyle öldü; bir ay sonra Melikşah da öldü. Dört şehzade, dört anne, tek bir taht.',
      [E.stab(-10)], ['sel_alamut']),
    F('sel_berkyaruk', 7, 12, 'Berkyaruk\'un Saltanatı', 'helm', 1092,
      'Tarihî yol: Berkyaruk kardeşleriyle on iki yıl savaştı. Devlet bölündü ama ordular savaşta pişti.',
      [E.reign('Berkyaruk', { born: 1080, sk: { adm: 3, dip: 2, mil: 5 } }), E.armies(2, 'Berkyaruk\'un Ordusu'), E.stab(-5)], ['sel_1092'], { hist: true }),
    F('sel_birlik', 9, 12, 'Nizâmülmülk\'ün Mirası', 'shield', 1092,
      'Alternatif tarih: Vezirin yetiştirdiği Nizâmiyye kölemenleri devleti ayakta tutuyor. Taht kavgası çıkmadan bastırıldı, Selçuklu birliği korundu.',
      [E.stab(15), E.tax(0.05), E.calm(null, 'Bütün ülke')], ['sel_1092'], { alt: true }),
    F('sel_hacli', 11, 12, 'Haçlılara Karşı', 'shield', 1097,
      '1097: Batıdan gelen Frenk şövalyeleri İznik\'i kuşattı. Selçuklular ve Danişmendliler, Haçlılarla Anadolu\'nun ortasında karşılaşacak.',
      [E.def(0.1), E.org(0.1), E.rel(['FAT', 'ABB'], 30)], ['sel_iznik']),
    F('sel_cihan', 8, 13, 'Cihan Hâkimiyeti', 'dragon', 1100,
      '"Güneşin doğduğu yerden battığı yere kadar." Sencer\'in Horasan\'ından Anadolu\'ya, Selçuklu adı İslam dünyasının kılıcıdır.',
      [E.cap(1500), E.atk(0.05), E.mpm(0.1), E.cb(['FAT', 'BYZ', 'KHA'])], null, { reqAny: ['sel_berkyaruk', 'sel_birlik'] }),
  ];
  mutex(SEL, ['sel_bati', 'sel_dogu']);
  mutex(SEL, ['sel_sultan', 'sel_halife']);
  mutex(SEL, ['sel_alparslan', 'sel_kutalmis']);
  mutex(SEL, ['sel_rum', 'sel_merkez']);
  mutex(SEL, ['sel_berkyaruk', 'sel_birlik']);

  // ================================================================ İNGİLTERE
  const ENG = [
    F('eng_hardeknud', 5, 0, 'Hardeknud\'un Saltanatı', 'crown', 1040,
      '1040: Harold Tavşanayak öldü, kardeşi Hardeknud altmış gemiyle Sandwich\'e çıktı. Danimarka ve İngiltere yeniden tek kralın elinde. Ama halk ağır vergilerden bıkmış durumda.',
      [E.gold(80), E.mp(4000)]),
    F('eng_fyrd', 9, 1, 'Fyrd\'i Düzenle', 'spear', 1040,
      'Her beş hide topraktan bir asker: Sakson köylü ordusu yeniden kayda geçiriliyor.',
      [E.armies(2, 'Fyrd'), E.mpm(0.1)], ['eng_hardeknud']),
    F('eng_edward', 5, 1, 'Edward Sürgünden Dönüyor', 'scroll', 1041,
      '1041: Hardeknud, Normandiya\'da sürgünde yaşayan üvey kardeşi Edward\'ı İngiltere\'ye çağırdı ve ortak hükümdar yaptı. Æthelred\'in soyu geri döndü.',
      [E.heir('Günah Çıkaran Edward', 1003), E.rel(['FRA'], 25), E.stab(3)], ['eng_hardeknud']),
    F('eng_1042', 5, 2, 'Hardeknud\'un Ölümü', 'scroll', 1042,
      'Haziran 1042, Lambeth: Hardeknud bir düğün ziyafetinde kadehini kaldırırken yere yığıldı. Yirmi dört yaşındaydı. Kuzey Denizi İmparatorluğu dağılıyor; İngiltere\'nin tacı kimin olacak?',
      [E.stab(-5)], ['eng_edward']),
    F('eng_burh', 9, 2, 'Burh Kalelerini Onar', 'castle', 1040,
      'Alfred\'in Vikinglere karşı kurduğu müstahkem kasabalar yeniden tahkim ediliyor.',
      [E.forts(4), E.def(0.05)], ['eng_fyrd']),
    F('eng_confessor', 3, 3, 'Günah Çıkaran Edward', 'crown', 1042,
      'Tarihî yol: Kont Godwin\'in desteğiyle Edward, Paskalya 1043\'te Winchester\'da taç giydi. Danimarka ile bağlar barışla koptu; Wessex hanedanı tahtta.',
      [E.reign('Günah Çıkaran Edward', { born: 1003, dyn: 'Wessex', sk: { adm: 3, dip: 4, mil: 2 }, next: ['II. Harold'] }), E.release(), E.stab(5), E.rel(['PAP', 'FRA'], 20)], ['eng_1042'], { hist: true }),
    F('eng_godwin', 5, 3, 'Godwin\'in Tacı', 'helm', 1042,
      'Alternatif tarih: Krallığın gerçek efendisi Wessex Kontu Godwin, sürgündeki prensi beklemeden tacı kendi başına koyuyor. Danimarka bunu bir isyan sayacak.',
      [E.reign('Kral Godwin', { born: 1001, dyn: 'Godwin', sk: { adm: 4, dip: 3, mil: 4 }, next: ['II. Harold', 'Godwine Haroldson'] }), E.indepWar(), E.atk(0.1), E.armies(1, 'Godwin Huscarlları')], ['eng_1042'], { alt: true }),
    F('eng_magnus', 7, 3, 'Kuzey Birliği', 'ship', 1042,
      'Alternatif tarih: Norveç kralı İyi Magnus, Hardeknud ile yaptığı antlaşmaya dayanarak İngiltere tacını istiyor. Kabul edersek İngiltere, Danimarka ve Norveç ile birlikte kuzeyin büyük birliğinin parçası olur.',
      [E.reign('İyi Magnus', { born: 1024, dyn: 'Hårfagre', sk: { adm: 4, dip: 4, mil: 4 }, next: ['III. Harald Hardrada', 'III. Olaf'] }), E.release(), E.rel(['DEN', 'NOR'], 60), E.naval(0.15), E.armies(2, 'Kuzey Huscarlları')], ['eng_1042'], { alt: true }),
    F('eng_gumus', 9, 3, 'Gümüş Penny', 'coin', 1043,
      'İngiliz gümüş penny\'si Avrupa\'nın en güvenilir parası. Darphaneler düzenli olarak yeni sikke basıyor.',
      [E.tax(0.08), E.tech('darphane', 'Darphane')], ['eng_burh']),
    F('eng_westminster', 2, 4, 'Westminster Manastırı', 'scroll', 1050,
      'Kral Edward, Thames kıyısında Aziz Petrus\'a adanmış büyük bir manastır yaptırıyor. Romanesk taş işçiliği İngiltere\'ye geliyor.',
      [E.stab(5), E.research(0.1), E.rel(['PAP'], 30)], ['eng_confessor']),
    F('eng_exile', 4, 4, 'Godwinlerin Sürgünü ve Dönüşü', 'helm', 1051,
      '1051: Dover\'daki kavga yüzünden Godwin ailesi sürüldü; bir yıl sonra donanmayla Thames\'e girip zorla geri döndüler. Kral artık Godwinlerin gölgesinde.',
      [E.cap(1000), E.armies(1, 'Godwin Huscarlları')], ['eng_confessor']),
    F('eng_godwinrule', 5, 4, 'Godwin Hanedanı', 'banner', 1045,
      'Alternatif tarih: Wessex, Kent ve Doğu Anglia Godwin oğullarının elinde. Harold, Tostig, Gyrth ve Leofwine krallığın dört köşesini tutuyor.',
      [E.mpm(0.1), E.stab(5)], ['eng_godwin'], { alt: true }),
    F('eng_northsea', 7, 4, 'Kuzey Denizi Filosu', 'ship', 1045,
      'Alternatif tarih: Bergen, Roskilde ve Londra limanlarından kalkan uzun gemiler tek bir sancak altında.',
      [E.naval(0.15), E.trade(0.1)], ['eng_magnus'], { alt: true }),
    F('eng_yun', 9, 4, 'Yün Ticareti', 'coin', 1045,
      'İngiliz yünü Flandre\'nin dokuma tezgâhlarına akıyor. Brugge ve Gent tüccarları Londra\'da.',
      [E.trade(0.15), E.merchant()], ['eng_gumus']),
    F('eng_harold', 3, 5, 'Harold Godwinson, Wessex Kontu', 'helm', 1053,
      '1053: Godwin öldü, oğlu Harold Wessex kontu oldu. Krallığın en güçlü adamı ve en iyi komutanı artık o.',
      [E.atk(0.05), E.org(0.1)], null, { reqAny: ['eng_westminster', 'eng_exile'] }),
    F('eng_danelaw', 5, 5, 'Danelaw\'ı Kucakla', 'shield', 1050,
      'Alternatif tarih: Kuzeydeki Danimarka kökenli halk da artık bizden. York ve Lincoln\'ün savaşçıları Godwin ordusuna katılıyor.',
      [E.armies(1, 'Danelaw Ordusu'), E.calm(['York', 'Lincoln', 'Derby', 'Leicester', 'Durham'], 'Kuzey'), E.mp(5000)], ['eng_godwinrule'], { alt: true }),
    F('eng_daneclaim', 7, 5, 'Üç Krallığın Tacı', 'crown', 1050,
      'Alternatif tarih: Magnus\'un mirası Danimarka ve Norveç\'i de kapsıyor. Kopenhag ve Trondheim\'daki rakipler bu hakkı tanımak zorunda.',
      [E.cb(['DEN', 'NOR', 'SWE']), E.atk(0.05)], ['eng_northsea'], { alt: true }),
    F('eng_londra', 9, 5, 'Londra Limanı', 'ship', 1048,
      'Thames ağzındaki Londra, Kuzey Denizi ticaretinin kalbi oluyor. Tersaneler kuruluyor.',
      [E.naval(0.1), E.tax(0.05)], ['eng_yun']),
    F('eng_wales', 2, 6, 'Galler Seferi', 'sword', 1055,
      '1055-1063: Gruffydd ap Llywelyn bütün Galler\'i birleştirdi ve Hereford\'u yaktı. Harold, hafif zırhlı birliklerle Galler dağlarına yürüyor.',
      [E.war('GWY'), E.cb(['DEH', 'MRG'])], ['eng_harold']),
    F('eng_siward', 4, 6, 'Siward\'ın İskoç Seferi', 'sword', 1054,
      '1054: Northumbria kontu Siward, Macbeth\'e karşı genç Malcolm\'u desteklemek için İskoçya\'ya girdi.',
      [E.cb(['SCO']), E.rel(['SCO'], -30), E.atk(0.03)], ['eng_harold']),
    F('eng_danegeld', 9, 6, 'Danegeld\'i Kaldır', 'coin', 1050,
      '1051: Ordunun bakımı için toplanan ağır heregeld vergisi kaldırıldı. Halk rahat bir nefes alıyor.',
      [E.noTribute(), E.stab(5)], ['eng_londra']),
    F('eng_1066', 5, 7, '1066: Kralın Ölümü', 'scroll', 1066,
      '5 Ocak 1066: Kral öldü. Witan tacı Harold Godwinson\'a verdi; ama Norveç kralı Harald Hardrada ve Normandiya Dükü William da tacın kendilerine vaat edildiğini söylüyor. Üç kral, tek taç.',
      [E.stab(-5)], null, { reqAny: ['eng_wales', 'eng_siward', 'eng_danelaw', 'eng_daneclaim'] }),
    F('eng_harald2', 2, 8, 'Kral II. Harold', 'crown', 1066,
      'Tarihî yol (başlangıç): Harold Westminster\'da taç giydi. Eylülde Harald Hardrada ve Tostig 300 gemiyle Yorkshire\'a çıktı.',
      [E.reign('II. Harold', { born: 1022, dyn: 'Godwin', sk: { adm: 4, dip: 3, mil: 5 }, next: ['Edgar Ætheling'] }), E.invade('NOR', 'York', 2, 9000, 'Hardrada\'nın Vikingleri')], ['eng_1066'], { hist: true }),
    F('eng_william', 5, 8, 'Fatih William', 'crown', 1066,
      'Tarihî sonuç: 14 Ekim 1066, Hastings. Harold gözüne isabet eden okla düştü. Normandiya Dükü William, Noel\'de Westminster\'da İngiltere kralı olarak taç giydi. Normandiya ve İngiltere tek tacın altında.',
      [E.reign('Fatih William', { born: 1028, dyn: 'Normandiya', sk: { adm: 5, dip: 3, mil: 6 }, next: ['II. William Rufus', 'I. Henry'] }), E.normandy(), E.atk(0.1), E.unrest(20), E.stab(-10)], ['eng_1066'], { hist: true }),
    F('eng_hardrada', 8, 8, 'Hardrada\'nın Tacı', 'axe', 1066,
      'Alternatif tarih: Stamford Köprüsü\'nde Saksonlar dağıldı. Son büyük Viking, Harald Hardrada, York\'tan Londra\'ya yürüyor ve İngiltere\'yi Norveç tacına bağlıyor.',
      [E.reign('Harald Hardrada', { born: 1015, dyn: 'Hårfagre', sk: { adm: 3, dip: 3, mil: 6 }, next: ['III. Olaf', 'III. Magnus'] }), E.rel(['NOR'], 100), E.naval(0.1), E.armies(2, 'Varang Muhafızları')], ['eng_1066'], { alt: true }),
    F('eng_stamford', 2, 9, 'Stamford Köprüsü', 'sword', 1066,
      '25 Eylül 1066: Harold zorlu bir yürüyüşle kuzeye vardı ve Vikingleri Stamford Köprüsü\'nde hazırlıksız yakaladı. Hardrada ve Tostig öldü; 300 gemiden 24\'ü geri döndü.',
      [E.atk(0.05), E.mp(6000), E.stab(5)], ['eng_harald2'], { avail: n => !G.S.armies.some(a => a.tag === 'NOR' && a.prov != null && G.S.provinces[a.prov] && G.S.provinces[a.prov].owner === n.tag), need: 'Norveç orduları İngiltere\'den atılmalı' }),
    F('eng_castles', 5, 9, 'Motte ve Bailey Kaleleri', 'castle', 1067,
      'Normanlar fethettikleri her kasabaya toprak tepe üstünde ahşap bir kale dikiyor. Londra\'da Beyaz Kule yükseliyor.',
      [E.forts(6), E.def(0.1)], ['eng_william']),
    F('eng_viking', 8, 9, 'Son Viking Krallığı', 'ship', 1067,
      'Alternatif tarih: Bizans\'ta Varang muhafızlığı yapmış bir kral ve onun gemileri. Kuzey Denizi yine bir Viking gölü.',
      [E.atk(0.08), E.naval(0.1), E.cb(['SCO', 'DEN'])], ['eng_hardrada'], { alt: true }),
    F('eng_hastings', 2, 10, 'Hastings', 'shield', 1066,
      '14 Ekim 1066: Normandiya Dükü William, Pevensey\'e çıktı. Sakson kalkan duvarı Senlac tepesinde bekliyor. Bu sefer tarih başka yazılabilir mi?',
      [E.normans(), E.def(0.1)], ['eng_stamford']),
    F('eng_harrying', 4, 10, 'Kuzeyin Yıkımı', 'axe', 1069,
      '1069-70: Kuzeydeki Sakson ve Danimarka ayaklanmasından sonra William, York\'tan Durham\'a kadar köyleri yaktı. Kuzey bir kuşak boyunca kendine gelemedi ama bir daha başkaldırmadı.',
      [E.calm(null, 'Bütün ülke'), E.stab(-5), E.cb(['SCO'])], ['eng_castles']),
    F('eng_domesday', 6, 10, 'Domesday Kitabı', 'scroll', 1085,
      '1086: Kralın memurları ülkenin her köyünü, her sabanı, her domuzu kayda geçirdi. Avrupa\'nın en ayrıntılı vergi kaydı.',
      [E.tax(0.15), E.stab(5)], ['eng_castles']),
    F('eng_northern', 8, 10, 'Kuzey Denizi İmparatorluğu', 'crown', 1070,
      'Alternatif tarih: Knut\'un imparatorluğu yeniden kuruluyor. İngiltere, Norveç ve Danimarka\'nın tacı tek başa.',
      [E.cap(1500), E.cb(['DEN', 'NOR']), E.mpm(0.1)], ['eng_viking'], { alt: true }),
    F('eng_saxon', 2, 11, 'Anglo-Sakson İngiltere', 'dragon', 1067,
      'Alternatif tarih: Normanlar denize döküldü. Alfred\'in, Athelstan\'ın krallığı yaşıyor; Sakson dili, Sakson hukuku, Sakson kalkan duvarı.',
      [E.def(0.1), E.mpm(0.15), E.stab(10)], ['eng_hastings'], { alt: true, avail: n => !(G.S.nations.NMD && G.S.nations.NMD.alive && G.atWar(n.tag, 'NMD')), need: 'Normanlarla savaş bitmeli' }),
    F('eng_henry', 5, 11, 'Özgürlükler Fermanı', 'scroll', 1100,
      '1100: II. William av sırasında bir okla öldü; kardeşi I. Henry tahta çıktı ve baronlara verdiği Özgürlükler Fermanı ile kralın gücünü yasayla sınırladı.',
      [E.stab(10), E.tax(0.05)], null, { reqAny: ['eng_harrying', 'eng_domesday'] }),
    F('eng_crusade', 7, 11, 'Kutsal Topraklara', 'banner', 1096,
      '1096: Papa Urbanus\'un çağrısıyla Normandiya Dükü Robert Curthose ve İngiliz şövalyeleri Kudüs yolunda.',
      [E.rel(['PAP'], 50), E.stab(5), E.org(0.05)], null, { reqAny: ['eng_saxon', 'eng_henry', 'eng_northern'] }),
    F('eng_crown', 5, 12, 'Tek Taç, Tek Krallık', 'crown', 1100,
      'Sakson, Norman ya da Viking: İngiltere artık Avrupa\'nın en düzenli krallıklarından biri. Hukuku, vergisi ve ordusu tek bir tacın elinde.',
      [E.mpm(0.1), E.stab(5), E.cap(1000), E.cb(['SCO', 'FRA'])], null, { reqAny: ['eng_saxon', 'eng_henry', 'eng_northern'] }),
  ];
  mutex(ENG, ['eng_confessor', 'eng_godwin', 'eng_magnus']);
  mutex(ENG, ['eng_harald2', 'eng_william', 'eng_hardrada']);

  // Yalnızca kendine özel tarihî ağacı olan krallıklar; diğerleri ortak ağacı kullanır
  for (const t of Object.keys(G.FOCUS_TREES)) if (t !== 'GENERIC') delete G.FOCUS_TREES[t];
  G.FOCUS_TREES.SEL = finish(SEL);
  G.FOCUS_TREES.ENG = finish(ENG);
  G.SPECIAL_TAGS = ['SEL', 'ENG'];
  // İngiltere de majör krallık
  if (window.WORLD.nations.ENG) { window.WORLD.nations.ENG.major = true; window.WORLD.nations.ENG.ruler = 'Hardeknud'; }

  // diğer dosyalardaki ağaçlar için yapı taşları
  G.focusKit = { E, F, mutex, finish, byName, nm, alive };

  // ================================================================ ulus profilleri (başlangıç ekranı)
  G.PROFILES = {
    SEL: {
      title: 'Büyük Selçuklu Devleti', kind: 'Majör krallık · Sultanlık', difficulty: 'Orta',
      ruler: { name: 'Tuğrul Bey', born: 990, sk: { adm: 5, dip: 4, mil: 5 },
        traits: [['Devletin kurucusu', 'Dandanakan\'ın galibi; istikrar ve otorite'], ['Bozkır komutanı', 'Atlı okçu ordusu, hızlı akınlar'], ['Sünnîliğin kılıcı', 'Abbâsî halifesinin koruyucusu olmaya aday']] },
      heir: { name: 'Alp Arslan', born: 1029, sk: { adm: 4, dip: 3, mil: 6 }, note: 'Çağrı Bey\'in oğlu, Tuğrul\'un yeğeni. Henüz on bir yaşında ama babasının ordusunda büyüyor.' },
      capital: 'Merv',
      history: [
        'Oğuzların Kınık boyundan Selçuk Bey, X. yüzyılın sonunda Oğuz Yabgusu\'ndan ayrıldı; Seyhun kıyısındaki Cend\'e yerleşip İslam\'ı kabul etti.',
        'Torunları Tuğrul ve Çağrı Beyler, Türkmen obalarıyla Ceyhun\'u geçip Gazneli Horasan\'ına yayıldı. 1035\'te Nesa, 1038\'de Nişabur onlarındı.',
        '23 Mayıs 1040\'ta Dandanakan\'da Sultan Mesud\'un ordusunu bozguna uğrattılar. Merv kurultayında devlet kuruldu: Tuğrul batıya, Çağrı doğuya.',
        'Batıda Büveyhîlerin elindeki Bağdat, halife, Bizans\'ın Anadolu sınırı ve Fâtımî Mısırı bekliyor. Tarihte yolları Malazgirt\'ten geçecek ve Anadolu\'nun kapılarını Türklere açacaklar.',
      ],
      goals: [['1042', 'Harezm ve Rey: Irak-ı Acem\'e giriş'], ['1055', 'Bağdat\'a giriş, "Doğunun ve Batının Sultanı" unvanı'], ['1064', 'Ani\'nin fethi'],
        ['1071', 'Malazgirt: Anadolu\'nun kapıları açılıyor'], ['1075', 'Süleyman Şah ve Anadolu Selçukluları'], ['1092', 'Nizâmülmülk ve Melikşah\'ın ölümü: büyük kriz']],
      paths: ['Batıya mı Gazne\'ye mi?', 'Halifenin koruyucusu mu, efendisi mi?', 'Alp Arslan mı Kutalmış mı?', 'Anadolu Selçukluları mı, tek merkez mi?', '1092: taht kavgası mı, birlik mi?'],
      rivals: ['GAZ', 'BYZ', 'FAT', 'BUY', 'KAK'], friends: ['ABB'],
    },
    ENG: {
      title: 'İngiltere Krallığı', kind: 'Majör krallık · Danimarka tacına bağlı', difficulty: 'Zor',
      ruler: { name: 'Hardeknud', born: 1018, sk: { adm: 2, dip: 2, mil: 3 },
        traits: [['Hastalıklı', 'Sağlığı zayıf; tarihte 1042\'de öldü'], ['Ağır vergici', 'Donanma vergisi yüzünden halk huzursuz (Worcester, 1041)'], ['İki tacın kralı', 'Danimarka ve İngiltere aynı başta']] },
      heir: { name: 'Günah Çıkaran Edward', born: 1003, sk: { adm: 3, dip: 4, mil: 2 }, note: 'Æthelred\'in oğlu, Hardeknud\'un üvey kardeşi. Yirmi beş yıldır Normandiya\'da sürgünde; dindar, Normanlara yakın.' },
      capital: 'Londra',
      history: [
        '1016\'da Danimarkalı Büyük Knut İngiltere\'yi fethetti. Danimarka, Norveç ve İngiltere tek tacın altında birleşti: Kuzey Denizi İmparatorluğu.',
        'Knut 1035\'te ölünce oğulları arasında taht kavgası çıktı. 1040\'ta Harold Tavşanayak öldü ve Hardeknud iki krallığın da kralı oldu.',
        'Ama gerçek güç Wessex Kontu Godwin\'in elinde. Æthelred\'in oğlu Edward sürgünde bekliyor; Galler\'de Gruffydd ap Llywelyn, İskoçya\'da Macbeth güçleniyor.',
        '1066\'da her şey değişecek: üç kral, iki istila, tek bir taç. Stamford Köprüsü\'nde ve Hastings\'te İngiltere\'nin kaderi belirlenecek.',
      ],
      goals: [['1042', 'Hardeknud\'un ölümü: Danimarka\'dan kopuş'], ['1053', 'Harold Godwinson, Wessex kontu'], ['1063', 'Galler\'in boyun eğmesi'],
        ['1066', 'Stamford Köprüsü ve Hastings'], ['1086', 'Domesday Kitabı'], ['1100', 'Özgürlükler Fermanı']],
      paths: ['1042: Edward, Godwin ya da Norveçli Magnus', '1066: Harold, Fatih William ya da Harald Hardrada', 'Sakson direnişi mi, Norman düzeni mi, Viking imparatorluğu mu?'],
      rivals: ['DEN', 'SCO', 'GWY', 'NOR', 'FRA'], friends: ['PAP'],
    },
  };
})();
