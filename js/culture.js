// Kültür: illerin halkı, kültür grupları, bayraklar, asimilasyon politikası ve asimilasyon memurları
'use strict';

G.cul = {};
(function () {
  const C = G.cul;

  // ------------------------------------------------------------ kültür grupları (renk tonu)
  C.GROUPS = {
    frank: { name: 'Frank', hue: 222 }, germen: { name: 'Germen', hue: 36 }, iskandinav: { name: 'İskandinav', hue: 352 },
    italik: { name: 'İtalik', hue: 128 }, iberik: { name: 'İberik', hue: 18 }, kelt: { name: 'Kelt', hue: 150 },
    bati_slav: { name: 'Batı Slav', hue: 335 }, dogu_slav: { name: 'Doğu Slav', hue: 26 }, guney_slav: { name: 'Güney Slav', hue: 300 },
    baltik: { name: 'Baltık', hue: 95 }, fin_ugor: { name: 'Fin-Ugor', hue: 185 }, yunan: { name: 'Helen', hue: 275 },
    kafkas: { name: 'Kafkas', hue: 8 }, turk: { name: 'Türk', hue: 200 }, mogol: { name: 'Moğol-Tunguz', hue: 240 },
    iran: { name: 'İran', hue: 165 }, arap: { name: 'Arap', hue: 108 }, berberi: { name: 'Berberi', hue: 48 },
    nil_sahra: { name: 'Nil-Sahra', hue: 30 }, habes: { name: 'Habeş-Kuşi', hue: 60 }, bati_afrika: { name: 'Batı Afrika', hue: 80 },
    bantu: { name: 'Bantu', hue: 15 }, khoisan: { name: 'Hoysan', hue: 42 }, austronezya: { name: 'Austronezya', hue: 172 },
    avustralya: { name: 'Avustralya', hue: 12 }, cin: { name: 'Çin', hue: 50 }, tibet: { name: 'Tibet-Birman', hue: 290 },
    dogu_asya: { name: 'Doğu Asya', hue: 210 }, hint: { name: 'Hint-Ari', hue: 28 }, dravid: { name: 'Dravid', hue: 330 },
    hindicin: { name: 'Hindiçini', hue: 140 },
  };

  // id: [ad, grup, bayrak] — bayrak: [desen, renk1, renk2, renk3, simge, simge rengi]
  const R = '#b52a26', W = '#efe8d6', K = '#1d1a17', Y = '#e2b83a', B = '#2b56a0', GR = '#2f7a42', LB = '#5c9ad0', P = '#6a2a72';
  const DEF = {
    fransiz: ['Fransız', 'frank', ['plain', B, '', '', 'lily', Y]],
    oksitan: ['Oksitan', 'frank', ['plain', R, '', '', 'pattee', Y]],
    breton: ['Breton', 'kelt', ['bars', W, K, '', '', '']],
    alman: ['Alman', 'germen', ['plain', Y, '', '', 'eagle', K]],
    felemenk: ['Felemenk', 'germen', ['plain', Y, '', '', 'tower', K]],
    ingiliz: ['Anglosakson', 'germen', ['cross', W, R, '', '', '']],
    danimarkali: ['Danimarkalı', 'iskandinav', ['nordic', R, W, '', '', '']],
    norvecli: ['Norveçli', 'iskandinav', ['nordic2', R, W, B, '', '']],
    isvecli: ['İsveçli', 'iskandinav', ['nordic', B, Y, '', '', '']],
    izlandali: ['İzlandalı', 'iskandinav', ['nordic2', B, W, R, '', '']],
    italyan: ['İtalyan', 'italik', ['v3', GR, W, R, '', '']],
    sardinyali: ['Sardinyalı', 'italik', ['cross', W, R, '', '', '']],
    kastilyali: ['Kastilyalı', 'iberik', ['plain', R, '', '', 'tower', Y]],
    katalan: ['Katalan', 'iberik', ['bars', Y, R, '', '', '']],
    portekizli: ['Galiçyalı', 'iberik', ['cross', W, B, '', '', '']],
    bask: ['Bask', 'iberik', ['saltire', R, GR, '', '', '']],
    irlandali: ['İrlandalı', 'kelt', ['plain', GR, '', '', 'tree', Y]],
    iskoc: ['İskoç', 'kelt', ['saltire', B, W, '', '', '']],
    galli: ['Galli', 'kelt', ['h2', W, GR, '', 'star5', R]],
    polonyali: ['Polonyalı', 'bati_slav', ['plain', R, '', '', 'eagle', W]],
    cek: ['Çek', 'bati_slav', ['h2', W, R, '', '', '']],
    vend: ['Vend', 'bati_slav', ['plain', B, '', '', 'sun', Y]],
    rus: ['Rus', 'dogu_slav', ['plain', R, '', '', 'trident', Y]],
    hirvat: ['Hırvat', 'guney_slav', ['checky', R, W, '', '', '']],
    sirp: ['Sırp', 'guney_slav', ['cross', R, W, '', '', '']],
    bulgar: ['Bulgar', 'guney_slav', ['h3', W, GR, R, '', '']],
    prusyali: ['Prusyalı', 'baltik', ['plain', W, '', '', 'tree', '#2a5a2a']],
    litvanyali: ['Litvanyalı', 'baltik', ['h3', Y, GR, R, '', '']],
    leton: ['Leton', 'baltik', ['fess', '#8a2432', W, '', '', '']],
    fin: ['Fin', 'fin_ugor', ['nordic', W, B, '', '', '']],
    eston: ['Eston', 'fin_ugor', ['h3', LB, K, W, '', '']],
    karel: ['Karel', 'fin_ugor', ['nordic', GR, R, '', '', '']],
    macar: ['Macar', 'fin_ugor', ['bars', R, W, '', '', '']],
    sami: ['Sami', 'fin_ugor', ['nordic', B, R, '', 'sun', Y]],
    samoyed: ['Samoyed', 'fin_ugor', ['h2', W, LB, '', 'star', R]],
    rum: ['Rum', 'yunan', ['plain', '#7a1f2a', '', '', 'eagle', Y]],
    gurcu: ['Gürcü', 'kafkas', ['cross', W, R, '', '', '']],
    ermeni: ['Ermeni', 'kafkas', ['h3', R, B, '#e0902a', '', '']],
    alan: ['Alan', 'kafkas', ['h3', W, R, Y, '', '']],
    fars: ['Fars', 'iran', ['plain', P, '', '', 'sun', Y]],
    kurt: ['Kürt', 'iran', ['h3', R, W, GR, 'sun', Y]],
    deylemi: ['Deylemî', 'iran', ['plain', '#2a6a5a', '', '', 'star', Y]],
    harezmli: ['Harezmli', 'iran', ['plain', B, '', '', 'cstar', W]],
    oguz: ['Oğuz', 'turk', ['plain', '#2a6aa8', '', '', 'tamga', Y]],
    kipcak: ['Kıpçak', 'turk', ['plain', Y, '', '', 'bow', R]],
    pecenek: ['Peçenek', 'turk', ['plain', '#8a4a2a', '', '', 'bow', Y]],
    karluk: ['Karluk', 'turk', ['plain', '#2a5a3a', '', '', 'bow', W]],
    uygur: ['Uygur', 'turk', ['plain', P, '', '', 'wheel', Y]],
    kirgiz: ['Kırgız', 'turk', ['plain', R, '', '', 'ring', Y]],
    idil: ['İdil Bulgar', 'turk', ['plain', GR, '', '', 'cstar', W]],
    nayman: ['Nayman', 'turk', ['plain', W, '', '', 'bow', K]],
    tatar: ['Tatar', 'mogol', ['plain', '#1a1a3a', '', '', 'tamga', W]],
    mogol: ['Moğol', 'mogol', ['plain', '#3a5aa0', '', '', 'sun', Y]],
    hitay: ['Hitay', 'mogol', ['plain', '#4a6a8a', '', '', 'sun', W]],
    curcen: ['Cürçen', 'mogol', ['plain', W, '', '', 'mountain', K]],
    evenk: ['Evenk', 'mogol', ['h2', LB, W, '', 'sun', R]],
    fars_x: null,
    endulus: ['Endülüslü', 'arap', ['plain', W, '', '', 'cstar', GR]],
    misir: ['Mısırlı', 'arap', ['plain', GR, '', '', 'crescent', W]],
    sam: ['Şamlı', 'arap', ['h2', K, GR, '', 'crescent', W]],
    irak: ['Iraklı', 'arap', ['plain', K, '', '', 'cstar', W]],
    bedevi: ['Bedevî', 'arap', ['plain', '#7a2a1e', '', '', 'star', Y]],
    yemenli: ['Yemenli', 'arap', ['h2', R, K, '', 'star', W]],
    ummanli: ['Ummanlı', 'arap', ['plain', R, '', '', 'crescent', W]],
    sicilyali: ['Sicilyalı', 'arap', ['per_bend', Y, R, '', 'sun', K]],
    sanhace: ['Sanhâce', 'berberi', ['h3', B, GR, Y, 'yaz', R]],
    zenata: ['Zenâta', 'berberi', ['h2', B, GR, '', 'yaz', R]],
    masmuda: ['Masmûde', 'berberi', ['h2', GR, Y, '', 'yaz', R]],
    tuareg: ['Tuareg', 'berberi', ['plain', '#2a2a6a', '', '', 'yaz', W]],
    nubyeli: ['Nübyeli', 'nil_sahra', ['plain', W, '', '', 'pattee', R]],
    kanuri: ['Kanuri', 'nil_sahra', ['plain', GR, '', '', 'crescent', W]],
    songay: ['Songay', 'nil_sahra', ['plain', '#a0703a', '', '', 'cstar', Y]],
    nilotik: ['Nilotik', 'nil_sahra', ['h2', K, GR, '', 'spears', W]],
    sara: ['Sara', 'nil_sahra', ['plain', '#c07a3a', '', '', 'spears', K]],
    habes: ['Habeş', 'habes', ['h3', GR, Y, R, 'pattee', B]],
    oromo: ['Oromo', 'habes', ['h3', K, R, W, 'tree', GR]],
    somali: ['Somali', 'habes', ['plain', LB, '', '', 'star5', W]],
    mande: ['Mande', 'bati_afrika', ['v3', GR, Y, R, '', '']],
    akan: ['Akan', 'bati_afrika', ['plain', Y, '', '', 'star5', K]],
    yoruba: ['Yoruba', 'bati_afrika', ['v3', GR, W, GR, 'sun', Y]],
    edo: ['Edo', 'bati_afrika', ['plain', '#8a1a1a', '', '', 'ring', W]],
    igbo: ['İgbo', 'bati_afrika', ['h3', R, K, GR, 'sun', Y]],
    hausa: ['Hausa', 'bati_afrika', ['plain', B, '', '', 'star', W]],
    kongo: ['Kongo', 'bantu', ['plain', R, '', '', 'spears', W]],
    mongo: ['Mongo', 'bantu', ['plain', '#2a5a2a', '', '', 'tree', Y]],
    fang: ['Fang', 'bantu', ['plain', '#5a3a1a', '', '', 'ring', W]],
    luba: ['Luba', 'bantu', ['plain', '#3a2a5a', '', '', 'spears', Y]],
    mbundu: ['Mbundu', 'bantu', ['h2', R, K, '', 'star', Y]],
    kitara: ['Kitara', 'bantu', ['plain', '#3a7a6a', '', '', 'ring', Y]],
    nyamwezi: ['Nyamvezi', 'bantu', ['per_bend', GR, LB, '', 'star5', Y]],
    svahili: ['Svahili', 'bantu', ['plain', R, '', '', 'waves', W]],
    maravi: ['Maravi', 'bantu', ['h3', K, R, GR, 'sun', R]],
    sona: ['Şona', 'bantu', ['plain', GR, '', '', 'tower', Y]],
    nguni: ['Nguni', 'bantu', ['plain', K, '', '', 'spears', W]],
    sotho: ['Soto', 'bantu', ['plain', B, '', '', 'mountain', W]],
    khoisan: ['Hoysan', 'khoisan', ['plain', '#c08a4a', '', '', 'sun', W]],
    malay: ['Malay', 'austronezya', ['h2', R, W, '', 'star', Y]],
    cava: ['Cava', 'austronezya', ['h2', R, W, '', '', '']],
    sunda: ['Sunda', 'austronezya', ['plain', '#3a7a3a', '', '', 'sun', Y]],
    malgas: ['Malgaş', 'austronezya', ['h2', R, GR, '', 'star5', W]],
    aborijin: ['Aborijin', 'avustralya', ['h2', K, R, '', 'disk', Y]],
    han: ['Han', 'cin', ['plain', Y, '', '', 'sun', R]],
    tibetli: ['Tibetli', 'tibet', ['plain', '#2a4a8a', '', '', 'mountain', W]],
    tangut: ['Tangut', 'tibet', ['plain', '#5a4aa0', '', '', 'tower', W]],
    bai: ['Bai', 'tibet', ['plain', '#a0507a', '', '', 'lotus', W]],
    bama: ['Bama', 'tibet', ['plain', '#c07a3a', '', '', 'wheel', W]],
    koreli: ['Koreli', 'dogu_asya', ['plain', W, '', '', 'ring', B]],
    japon: ['Japon', 'dogu_asya', ['plain', W, '', '', 'disk', R]],
    hindustani: ['Hindustanî', 'hint', ['plain', '#e08a2a', '', '', 'wheel', B]],
    racput: ['Racput', 'hint', ['h2', '#e08a2a', R, '', 'sun', Y]],
    gucarati: ['Gucaratî', 'hint', ['plain', '#a0303a', '', '', 'lotus', Y]],
    bengal: ['Bengal', 'hint', ['plain', GR, '', '', 'disk', R]],
    oriya: ['Oriya', 'hint', ['plain', '#8a2a2a', '', '', 'wheel', Y]],
    asam: ['Asam', 'hint', ['plain', '#2a6a5a', '', '', 'tree', Y]],
    kesmirli: ['Keşmirli', 'hint', ['plain', '#3a6aa0', '', '', 'mountain', W]],
    nepalli: ['Nepalli', 'hint', ['plain', '#9a1a2a', '', '', 'cstar', W]],
    sinhala: ['Sinhala', 'hint', ['plain', '#8a1a1a', '', '', 'sun', Y]],
    sindi: ['Sindî', 'hint', ['h2', GR, W, '', 'crescent', W]],
    pencabi: ['Pencabî', 'hint', ['plain', '#2a4a8a', '', '', 'star', Y]],
    tamil: ['Tamil', 'dravid', ['plain', R, '', '', 'bow', Y]],
    kannada: ['Kannada', 'dravid', ['h2', Y, R, '', 'sun', W]],
    telugu: ['Telugu', 'dravid', ['plain', '#3a8a5a', '', '', 'lotus', Y]],
    viet: ['Viet', 'hindicin', ['plain', R, '', '', 'star5', Y]],
    cam: ['Çam', 'hindicin', ['plain', '#3aa08a', '', '', 'lotus', W]],
    khmer: ['Khmer', 'hindicin', ['h3', B, R, B, 'tower', W]],
    mon: ['Mon', 'hindicin', ['plain', '#c0a03a', '', '', 'star', R]],
  };
  delete DEF.fars_x;

  // HSL → onaltılık renk
  const hsl = (h, s, l) => {
    s /= 100; l /= 100;
    const f = n => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); };
    return '#' + f(0) + f(8) + f(4);
  };
  C.LIST = {};
  const byGroup = {};
  for (const [id, d] of Object.entries(DEF)) (byGroup[d[1]] ||= []).push(id);
  for (const [g, ids] of Object.entries(byGroup)) {
    const hue = C.GROUPS[g].hue;
    ids.forEach((id, k) => {
      const d = DEF[id], off = (k - (ids.length - 1) / 2) * Math.min(9, 40 / ids.length);
      C.LIST[id] = { id, name: d[0], group: g, flag: d[2], color: hsl((hue + off + 360) % 360, 48 + (k % 2) * 10, 40 + (k % 3) * 8) };
    });
  }
  // "Türk › Oğuz" biçiminde tam ad
  C.fullName = id => { const k = C.get(id), g = C.GROUPS[k.group]; return g ? `${g.name} › ${k.name}` : k.name; };
  C.get = id => C.LIST[id] || { id, name: id || '—', group: '', flag: ['plain', '#777', '', '', '', ''], color: '#888888' };

  // Ülkelerin ana kültürü
  const NATION = {
    BYZ: 'rum', SEL: 'oguz', FAT: 'misir', HRE: 'alman', FRA: 'fransiz', KIE: 'rus', DEN: 'danimarkali', GAZ: 'fars', SNG: 'han', LIA: 'hitay',
    ENG: 'ingiliz', SCO: 'iskoc', GWY: 'galli', DEH: 'galli', MRG: 'galli', MUN: 'irlandali', LEI: 'irlandali', CON: 'irlandali', MID: 'irlandali',
    ULA: 'irlandali', AIL: 'irlandali', DUB: 'norvecli', NOR: 'norvecli', SWE: 'isvecli', ISL: 'izlandali',
    PAP: 'italyan', VEN: 'italyan', PIS: 'italyan', GEN: 'italyan', SAL: 'italyan', BEN: 'italyan', NAP: 'italyan', SIC: 'sicilyali', SAR: 'sardinyali',
    LEO: 'kastilyali', NAV: 'bask', ARA: 'katalan', BAR: 'katalan', SEV: 'endulus', KUR: 'endulus', TUL: 'endulus', ZAR: 'endulus', BTL: 'endulus',
    GRN: 'endulus', BLN: 'endulus', DNY: 'endulus', MRY: 'endulus',
    POL: 'polonyali', MAZ: 'polonyali', HUN: 'macar', CRO: 'hirvat', DUK: 'sirp', PLT: 'rus', POM: 'vend', ABO: 'vend', LUT: 'vend',
    PRU: 'prusyali', LIT: 'litvanyali', CUR: 'leton', SEM: 'leton', LTG: 'leton', EST: 'eston', FIN: 'fin', KAR: 'karel',
    PEC: 'pecenek', KIP: 'kipcak', OGU: 'oguz', VOL: 'idil', ALA: 'alan', GEO: 'gurcu', ANI: 'ermeni', LOR: 'ermeni', KKH: 'gurcu',
    SHE: 'kurt', SHI: 'fars', RAV: 'kurt', TIF: 'gurcu', ABB: 'irak', BUY: 'deylemi', MRW: 'kurt', UKA: 'irak', MEZ: 'irak', KAK: 'deylemi',
    ZIY: 'deylemi', HSN: 'kurt', ANN: 'kurt', MIR: 'sam', NUM: 'sam', QAR: 'bedevi', OMA: 'ummanli', NAJ: 'yemenli', ZAY: 'yemenli',
    KHA: 'karluk', KHW: 'harezmli', QOC: 'uygur', KIR: 'kirgiz', XIA: 'tangut', DAL: 'bai', GUG: 'tibetli', TSO: 'tibetli', TIB: 'tibetli',
    GOR: 'koreli', JAP: 'japon', KER: 'nayman', NAI: 'nayman', TAT: 'tatar', MER: 'mogol', JUR: 'curcen',
    CHO: 'tamil', CHA: 'kannada', PAR: 'racput', CHN: 'hindustani', KAL: 'hindustani', GUC: 'gucarati', PAL: 'bengal', SOM: 'oriya', KAM: 'asam',
    KAS: 'kesmirli', SIN: 'sindi', CHH: 'racput', TOM: 'hindustani', NEP: 'nepalli', RUH: 'sinhala',
    DAI: 'viet', CHM: 'cam', KHM: 'khmer', PAG: 'bama', THT: 'mon', SRI: 'malay', JAV: 'cava', SUN: 'sunda',
    ZIR: 'sanhace', HAM: 'sanhace', MAG: 'zenata', BRG: 'masmuda', LAM: 'sanhace', MAK: 'nubyeli', ALO: 'nubyeli', ETH: 'habes',
    GHA: 'mande', GAO: 'songay', KAN: 'kanuri', FZN: 'tuareg',
  };
  // Çok halklı devletlerin illeri en yakın tarihî bölgenin kültürünü alır (boylam, enlem)
  const MULTI = new Set(['BYZ', 'SEL', 'FAT', 'HRE', 'FRA', 'GAZ', 'LIA', 'BUY', 'KHA', 'CHO', 'LEO', 'HUN', 'ABB', 'DEN', 'KIE', 'ZIR']);
  const ANCHORS = {
    fransiz: [[2.35, 48.85], [1.9, 47.9], [1.1, 49.4], [4.0, 49.25], [5.0, 47.3], [0.7, 47.4], [4.1, 48.3], [2.3, 49.9], [2.4, 47.1], [6.17, 49.12], [6.18, 48.69], [6.02, 47.24], [5.57, 50.63]],
    oksitan: [[1.44, 43.6], [-0.58, 44.84], [3.88, 43.6], [1.26, 45.83], [3.08, 45.78], [0.34, 46.3], [5.37, 43.3], [4.63, 43.68], [4.83, 45.76], [3.0, 43.18], [2.57, 44.35], [6.14, 46.2], [7.26, 43.7]],
    breton: [[-1.68, 48.11], [-4.49, 48.39], [-2.76, 47.66], [-4.1, 48.0]],
    felemenk: [[3.22, 51.21], [3.72, 51.05], [5.12, 52.09], [4.6, 52.4], [4.4, 51.22], [5.7, 52.9]],
    alman: [[6.08, 50.78], [6.96, 50.94], [8.27, 50.0], [8.68, 50.11], [11.63, 52.13], [12.1, 49.0], [10.9, 48.37], [8.8, 53.08], [9.99, 53.55], [10.43, 51.9], [16.37, 48.2], [13.05, 47.8], [8.54, 47.37], [7.75, 48.58], [11.03, 50.98], [9.93, 49.79], [11.08, 49.45], [9.73, 52.37], [7.63, 51.96], [15.44, 47.07], [14.3, 46.6], [11.4, 47.26]],
    vend: [[13.47, 51.16], [14.33, 51.76], [12.9, 52.4]],
    cek: [[14.42, 50.08], [16.6, 49.2], [17.25, 49.6], [18.08, 48.3], [19.15, 48.75]],
    italyan: [[9.19, 45.46], [9.16, 45.19], [10.99, 45.44], [11.25, 43.77], [11.34, 44.49], [7.68, 45.07], [12.5, 41.9], [16.87, 41.12], [17.24, 40.47], [14.25, 40.85], [12.2, 44.42], [11.12, 46.07], [13.77, 45.65], [15.55, 41.46]],
    rum: [[28.97, 41.01], [29.72, 40.43], [27.14, 38.42], [30.7, 36.89], [32.86, 39.93], [32.49, 37.87], [35.48, 38.73], [39.72, 41.0], [35.15, 42.02], [22.94, 40.64], [23.73, 37.98], [22.93, 37.94], [21.73, 38.25], [24.8, 35.3], [33.4, 35.1], [28.0, 36.3], [33.5, 44.6], [36.16, 36.2], [19.45, 41.32], [22.42, 39.64], [26.56, 41.68], [20.85, 39.66], [15.65, 38.11], [31.3, 39.0], [30.52, 39.78], [34.9, 36.92], [36.9, 40.3]],
    bulgar: [[20.8, 41.12], [23.32, 42.7], [25.63, 43.08], [26.82, 43.15], [22.87, 43.99], [21.43, 42.0], [24.75, 42.15], [27.26, 44.12], [27.92, 43.2]],
    sirp: [[20.5, 43.15], [19.26, 42.44], [20.46, 44.82], [21.9, 43.32]],
    ermeni: [[38.31, 38.35], [37.02, 39.75], [38.79, 37.15], [41.27, 39.9], [43.38, 38.5], [43.1, 40.6], [43.57, 40.5], [44.57, 40.0], [42.49, 38.75], [40.5, 38.9]],
    gurcu: [[44.8, 41.7], [42.7, 42.27], [41.64, 41.64], [41.8, 41.2]],
    oguz: [[61.83, 37.6], [54.0, 38.0], [64.8, 44.5], [61.5, 45.8], [57.5, 39.5]],
    fars: [[58.8, 36.2], [59.5, 36.5], [62.2, 34.35], [51.43, 35.6], [48.5, 34.8], [51.67, 32.65], [57.08, 30.28], [52.53, 29.6], [54.37, 31.9], [69.17, 34.53], [68.42, 33.55], [66.96, 39.65], [64.42, 39.77], [71.8, 40.4], [67.3, 37.2], [61.5, 31.0], [66.9, 36.76], [46.3, 38.07], [46.24, 37.39], [48.29, 38.25], [46.36, 40.68], [48.64, 40.63], [48.7, 31.3], [71.57, 34.0], [65.7, 31.6]],
    harezmli: [[59.15, 42.33], [60.9, 41.4]],
    deylemi: [[49.6, 36.8], [52.35, 36.47], [49.6, 37.3]],
    kurt: [[47.4, 34.6], [45.9, 35.4], [40.22, 37.91], [41.0, 38.15], [43.74, 37.57], [44.0, 36.19]],
    irak: [[44.36, 33.31], [47.8, 30.5], [44.4, 32.0], [43.13, 36.34], [42.5, 34.4]],
    sam: [[37.16, 36.2], [36.29, 33.51], [35.23, 31.77], [35.84, 34.43], [39.0, 35.95], [39.03, 36.86], [34.8, 32.1], [36.7, 34.7]],
    misir: [[31.24, 30.04], [29.92, 31.2], [31.18, 27.18], [32.9, 24.09], [20.9, 32.5], [31.8, 31.4], [30.7, 29.3]],
    bedevi: [[39.83, 21.42], [39.6, 24.47], [46.6, 24.4], [49.6, 25.4], [38.5, 27.5], [36.6, 28.4]],
    yemenli: [[44.2, 15.35], [45.03, 12.8], [43.3, 14.2]],
    hitay: [[119.2, 43.98], [123.17, 41.27], [119.0, 41.6], [121.6, 45.4], [118.0, 46.5]],
    han: [[116.4, 39.9], [113.3, 40.1], [115.0, 38.5], [117.2, 39.1], [118.2, 39.6]],
    pencabi: [[74.35, 31.55], [71.47, 30.2], [73.0, 32.7]],
    karluk: [[75.99, 39.47], [75.2, 42.75], [72.24, 42.52], [69.6, 42.3], [73.3, 40.77], [79.9, 41.2]],
    tamil: [[79.13, 10.79], [79.7, 12.83], [78.12, 9.92], [77.0, 11.0]],
    sinhala: [[80.4, 8.31], [81.0, 7.94], [80.6, 6.5]],
    kannada: [[76.9, 12.2], [75.5, 14.5]],
    telugu: [[81.1, 16.7], [79.0, 15.5], [83.3, 17.7]],
    kastilyali: [[-3.7, 42.34], [-5.57, 42.6], [-5.85, 43.36], [-4.7, 41.65], [-3.0, 43.0]],
    portekizli: [[-8.54, 42.88], [-8.61, 41.15], [-8.43, 40.2], [-7.55, 43.0]],
    macar: [[19.04, 47.5], [18.0, 47.0], [21.6, 47.5], [23.6, 46.8], [20.15, 46.25]],
    danimarkali: [[12.57, 55.68], [10.2, 56.15], [13.0, 55.6], [9.5, 55.0]],
    isvecli: [[14.0, 57.0]],
    rus: [[30.52, 50.45], [31.3, 51.5], [31.27, 58.52], [32.0, 54.8], [37.6, 55.75], [39.7, 47.2], [36.1, 45.3], [29.9, 49.0], [26.0, 50.6]],
    fin: [[24.9, 60.2]],
    sanhace: [[10.1, 35.68], [10.2, 36.8], [5.4, 36.2], [4.1, 36.7]],
  };
  const ANCH = [];
  for (const [cul, pts] of Object.entries(ANCHORS)) for (const [lon, lat] of pts) ANCH.push([lon, lat, cul]);
  // Keşfedilmemiş toprakların dinleri
  const WILD_RELIG = { svahili: 'sunni', somali: 'sunni', habes: 'miafizit', aborijin: 'ruya' };

  C.ofNation = tag => {
    const S = G.S, n = S && S.nations[tag];
    if (n && n.culture) return n.culture;
    return NATION[tag] || null;
  };

  C.provinceCulture = function (p) {
    if (p.kind === 'wild') return p.cul;
    if (!p.owner) return null;
    const own = NATION[p.owner] || null;
    if (!MULTI.has(p.owner) || !ANCH.length) return own;
    const lat = G.unprojLat(p.y), lon = p.x;
    let best = null, bd = Infinity;
    for (const a of ANCH) {
      const dx = (a[0] - lon) * Math.cos(lat * Math.PI / 180), dy = a[1] - lat, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = a[2]; }
    }
    return bd < 5.5 * 5.5 ? best : own;
  };

  C.POLICIES = {
    hosgoru: { name: 'Hoşgörü', icon: '🕊', desc: 'Yabancı halklar huzursuzlanmaz; asimilasyon yavaş. İstikrar +4.' },
    ilimli: { name: 'Ilımlı', icon: '⚖', desc: 'Dengeli: yabancı halklar biraz huzursuz, asimilasyon olağan hızda.' },
    baski: { name: 'Zorla asimilasyon', icon: '⛓', desc: 'Asimilasyon çok hızlı; ama asimile edilen iller ve yabancı halklar huzursuzlanır. İstikrar −6.' },
  };
  C.ASSIM_NEED = 100;
  C.ASSIM_GOLD = 2;

  // Issız toprakların halkı: en yakın yerleşik komşunun halkı ve dini; uzak kuzeyde Sami, Samoyed, Evenk
  C.assignWaste = function () {
    const S = G.S, P = S.provinces;
    const from = new Int32Array(P.length).fill(-1);
    let q = [];
    for (const p of P) if (p.owner && p.kind !== 'waste') { from[p.id] = p.id; q.push(p.id); }
    while (q.length) {
      const next = [];
      for (const id of q) for (const nb of P[id].nb) if (from[nb] < 0 && P[nb].kind === 'waste') { from[nb] = from[id]; next.push(nb); }
      q = next;
    }
    for (const p of P) {
      if (p.kind !== 'waste' || p.cul != null) continue;
      const lat = G.unprojLat(p.y), lon = p.x, src = from[p.id] >= 0 ? P[from[p.id]] : null;
      const sn = src && S.nations[src.owner];
      let cul = src ? src.cul : null, relig = src ? src.relig || (sn && sn.religion) : 'tengri';
      if (lat > 63 && lon < 45) { cul = 'sami'; relig = 'pagan_fin'; }
      else if (lat > 56 && lon >= 45 && lon < 100) { cul = 'samoyed'; relig = 'tengri'; }
      else if (lat > 49 && lon >= 100) { cul = 'evenk'; relig = 'tengri'; }
      p.cul = cul || 'samoyed';
      p.relig = relig || 'tengri';
    }
  };

  C.init = function () {
    const S = G.S;
    let waste = false;
    for (const p of S.provinces) {
      if (p.kind === 'waste' && p.cul == null) { waste = true; continue; }
      if (p.cul === undefined || (p.cul === null && p.owner)) p.cul = C.provinceCulture(p);
      if (p.kind === 'wild') {
        p.relig ??= WILD_RELIG[p.cul] || 'pagan_afrika';
        p.natives ??= Math.round((p.terrain === 'col' ? 300 : p.terrain === 'orman' ? 1800 : 1200) * (0.6 + G.rng() * 0.8));
      }
    }
    if (waste) {
      C.assignWaste();
      for (const p of S.provinces) if (p.kind === 'waste') p.natives ??= Math.round((p.terrain === 'col' || p.terrain === 'tundra' ? 180 : 450) * (0.6 + G.rng() * 0.8));
    }
    for (const n of Object.values(S.nations)) {
      n.culture ||= NATION[n.tag] || (S.provinces[n.capital] && S.provinces[n.capital].cul) || 'fransiz';
      n.cultPolicy ||= 'ilimli';
      n.assimilators ??= n.major ? 2 : 1;
      n.assims ||= [];
    }
  };

  // Kabul edilen kültür: ana kültür ve aynı gruptaki kültürler
  C.accepted = function (tag, cul) {
    const n = G.S.nations[tag];
    if (!n || !cul) return true;
    if (cul === n.culture) return true;
    return C.get(cul).group === C.get(n.culture).group;
  };
  // Asimile olmuş il: halkı devletin ana kültüründen
  C.assimilated = p => !!(p.owner && G.S.nations[p.owner] && p.cul === G.S.nations[p.owner].culture);

  C.unity = function (tag) {
    const S = G.S;
    let tot = 0, ok = 0;
    for (const p of S.provinces) {
      if (p.owner !== tag) continue;
      const w = G.provinceWeight(p);
      tot += w;
      if (C.accepted(tag, p.cul)) ok += w;
    }
    return tot ? ok / tot : 1;
  };

  // ------------------------------------------------------------ asimilasyon memurları
  C.canAssim = function (tag, p) {
    const n = G.S.nations[tag];
    if (p.owner !== tag || p.ctrl !== tag) return [false, 'İl elimizde olmalı.'];
    if (!p.cul || p.cul === n.culture) return [false, 'Bu ilin halkı zaten bizim kültürümüzden.'];
    n.assims ||= [];
    if (n.assims.some(m => m.prov === p.id)) return [false, 'Memurlarımız zaten burada.'];
    if (n.assims.length >= n.assimilators) return [false, `Bütün asimilasyon memurlarımız görevde (${n.assims.length} / ${n.assimilators}).`];
    return [true, `Ayda ${C.ASSIM_GOLD} altın; yaklaşık ${Math.round(C.ASSIM_NEED / C.speed(tag, p))} ayda halk ${C.get(n.culture).name} olur.`];
  };
  C.speed = function (tag, p) {
    const n = G.S.nations[tag];
    let v = 5 * (n.rulerSk ? 1 + 0.1 * (n.rulerSk.adm - 3) : 1);
    if (G.econ.isCapital(p)) v *= 0.6;
    if (p.kind === 'rural') v *= 1.2;
    // aynı kültür grubundan (ör. Türk › Kıpçak'tan Türk › Oğuz'a) kolay, başka gruptan zor
    v *= C.accepted(tag, p.cul) ? 1.6 : 0.7;
    // aynı dinden halk kolay kaynaşır; başka mezhep biraz, başka din çok direnir
    if (p.relig && p.relig !== n.religion) v *= G.rel.sameFamily(p.relig, n.religion) ? 0.9 : 0.5;
    v -= (p.unrest || 0) / 30;
    v *= n.cultPolicy === 'baski' ? 1.8 : n.cultPolicy === 'hosgoru' ? 0.5 : 1;
    return Math.max(0.8, v);
  };
  C.sendAssim = function (tag, pid) {
    const n = G.S.nations[tag], p = G.S.provinces[pid];
    if (!C.canAssim(tag, p)[0]) return false;
    n.assims.push({ prov: pid, prog: 0 });
    return true;
  };
  C.recall = (tag, pid) => { const n = G.S.nations[tag]; n.assims = n.assims.filter(m => m.prov !== pid); };

  C.setPolicy = function (tag, pol) {
    const S = G.S, n = S.nations[tag];
    if (!C.POLICIES[pol] || n.cultPolicy === pol) return [false, ''];
    if (n.policyAt && S.hour - n.policyAt < 24 * 365) return [false, 'Politika yılda bir kez değiştirilebilir.'];
    n.cultPolicy = pol; n.policyAt = S.hour;
    return [true, ''];
  };

  C.monthly = function () {
    const S = G.S;
    C.init();
    for (const n of Object.values(S.nations)) {
      if (!n.alive) continue;
      for (const m of n.assims.slice()) {
        const p = S.provinces[m.prov];
        if (p.owner !== n.tag || p.ctrl !== n.tag || p.cul === n.culture) { C.recall(n.tag, m.prov); continue; }
        n.gold -= C.ASSIM_GOLD;
        m.prog += C.speed(n.tag, p);
        if (n.cultPolicy === 'baski') p.unrest = Math.min(100, (p.unrest || 0) + 1.5);
        if (m.prog >= C.ASSIM_NEED) {
          const old = p.cul;
          p.cul = n.culture;
          p.core = n.tag;
          p.unrest = Math.min(p.unrest || 0, 15);
          C.recall(n.tag, m.prov);
          G.labelsDirty = true; G.mapDirty = true;
          if (n.tag === S.player) G.log(`${p.name} halkı asimile oldu: artık ${C.get(n.culture).name} (eskiden ${C.get(old).name}). Burada isyan çıkmaz.`, 'good', [n.tag]);
        }
      }
      // yapay zekâ: en değerli yabancı illerden başlar
      if (n.tag !== S.player && n.assims.length < n.assimilators && n.gold > 60 && G.rng() < 0.25) {
        const c = S.provinces.filter(p => p.owner === n.tag && C.canAssim(n.tag, p)[0]);
        if (c.length) C.sendAssim(n.tag, G.pick(c.sort((a, b) => G.provinceWeight(b) - G.provinceWeight(a)).slice(0, 5)).id);
      }
    }
  };

  // ------------------------------------------------------------ iç düzene etkileri
  // İl huzursuzluğu: kabul edilmeyen kültür, politika
  const baseFactors = G.stab.factors;
  G.stab.factors = function (p) {
    const f = baseFactors(p).filter(x => x[0] !== 'Farklı kültür');
    const n = G.S.nations[p.owner];
    if (!n || !p.cul) return f;
    if (!C.accepted(p.owner, p.cul)) {
      const v = n.cultPolicy === 'hosgoru' ? 0.2 : n.cultPolicy === 'baski' ? 1.6 : 1;
      f.push([`Yabancı halk (${C.get(p.cul).name})`, v]);
    }
    if (n.cultPolicy === 'baski' && (n.assims || []).some(m => m.prov === p.id)) f.push(['Zorla asimilasyon', 1.5]);
    if (p.cul === n.culture) f.push(['Halk bizden', -0.5]);
    return f;
  };
  const baseStab = G.stab.stabFactors;
  G.stab.stabFactors = function (n) {
    const f = baseStab(n);
    if (n.cultPolicy === 'hosgoru') f.push(['Hoşgörü politikası', 4]);
    else if (n.cultPolicy === 'baski') f.push(['Zorla asimilasyon', -6]);
    const u = C.unity(n.tag);
    if (u < 0.6) f.push([`Kültürel bölünmüşlük (%${Math.round(u * 100)})`, -Math.round((0.6 - u) * 20)]);
    return f;
  };

  // ------------------------------------------------------------ bayraklar (SVG, 30×20)
  const star = (cx, cy, n, r1, r2) => {
    let d = '';
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + i * Math.PI / n;
      d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(2) + ' ' + (cy + r * Math.sin(a)).toFixed(2);
    }
    return d + 'Z';
  };
  const CHARGES = {
    cross: c => `<path fill="${c}" d="M13.6 4.5h2.8v11h-2.8zM9.5 8.6h11v2.8h-11z"/>`,
    pattee: c => `<path fill="${c}" d="M13 4h4l-1 4 4-1v6l-4-1 1 4h-4l1-4-4 1V7l4 1z"/>`,
    crescent: c => `<path fill="${c}" d="M16.6 5.4A5 5 0 1 0 16.6 14.6 4 4 0 1 1 16.6 5.4Z"/>`,
    cstar: c => `<path fill="${c}" d="M14.6 5.4A5 5 0 1 0 14.6 14.6 4 4 0 1 1 14.6 5.4Z"/><path fill="${c}" d="${star(18, 10, 5, 2.2, 0.9)}"/>`,
    star: c => `<path fill="${c}" d="${star(15, 10, 8, 4.8, 2.4)}"/>`,
    star5: c => `<path fill="${c}" d="${star(15, 10.4, 5, 4.8, 1.9)}"/>`,
    sun: c => `<circle cx="15" cy="10" r="2.6" fill="${c}"/><path fill="${c}" d="${star(15, 10, 12, 5.2, 2.9)}" opacity=".85"/>`,
    wheel: c => `<g stroke="${c}" stroke-width="1" fill="none"><circle cx="15" cy="10" r="4.4"/><path d="M15 5.6v8.8M10.6 10h8.8M11.9 6.9l6.2 6.2M18.1 6.9l-6.2 6.2"/></g>`,
    tamga: c => `<g stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round"><path d="M15 6.5v9M15 11.5l-4.5-5M15 11.5l4.5-5M10.5 6.5h-1.2M19.5 6.5h1.2"/></g>`,
    bow: c => `<g stroke="${c}" stroke-width="1.2" fill="none" stroke-linecap="round"><path d="M11.5 4.5Q19 10 11.5 15.5"/><path d="M11.5 4.5L11.5 15.5" stroke-width=".5"/><path d="M9 10h11M18.5 8.6l1.6 1.4-1.6 1.4"/></g>`,
    eagle: c => `<path fill="${c}" d="M15 8l3-2.4 4.4-1.2-2.4 4 2.4 2.2h-4l-1.8 4.2-1-2-1 2-1.8-4.2h-4l2.4-2.2-2.4-4 4.4 1.2z"/><circle cx="12.6" cy="5.4" r="1.1" fill="${c}"/><circle cx="17.4" cy="5.4" r="1.1" fill="${c}"/>`,
    lily: c => `<g fill="${c}"><path d="M15 3.8c2 2.8 2 5.2 0 8-2-2.8-2-5.2 0-8z"/><path d="M14.4 11.2c-3.4-.4-4.9-3.6-2.9-4.3-.4 2 1 3.4 2.9 3.6z"/><path d="M15.6 11.2c3.4-.4 4.9-3.6 2.9-4.3.4 2-1 3.4-2.9 3.6z"/><path d="M12 11.4h6v1.2h-6zM14.2 12.6h1.6l-.3 3h-1z"/></g>`,
    tower: (c, f) => `<path fill="${c}" d="M10.5 8h9v8h-9zM10.5 6h2v2h-2zM14 6h2v2h-2zM17.5 6h2v2h-2z"/><path fill="${f}" d="M14 12.2a1 1 0 0 1 2 0V16h-2z"/>`,
    tree: c => `<path fill="${c}" d="M15 3.6l4.2 5.4h-2l3 4h-4.2v3.4h-2V13H9.8l3-4h-2z"/>`,
    mountain: c => `<path fill="${c}" d="M6.5 16L12.5 6.5l3 4.6 2.4-3 5.6 7.9z"/>`,
    spears: c => `<g stroke="${c}" stroke-width="1" stroke-linecap="round"><path d="M9 16L21 4M21 16L9 4"/></g><ellipse cx="15" cy="10" rx="2.6" ry="4.3" fill="${c}"/>`,
    disk: c => `<circle cx="15" cy="10" r="4.2" fill="${c}"/>`,
    ring: c => `<circle cx="15" cy="10" r="3.9" fill="none" stroke="${c}" stroke-width="1.4"/><circle cx="15" cy="10" r="1.3" fill="${c}"/>`,
    lotus: c => `<g fill="${c}"><path d="M15 5c1.8 2.4 1.8 5.4 0 8-1.8-2.6-1.8-5.6 0-8z"/><path d="M14.4 13c-3-.2-5-2.4-5.2-5 2.6.6 4.4 2.4 5.2 5z"/><path d="M15.6 13c3-.2 5-2.4 5.2-5-2.6.6-4.4 2.4-5.2 5z"/><path d="M10 14h10v1.2H10z"/></g>`,
    trident: c => `<g stroke="${c}" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M15 4.5v11M10.8 5.5v5.5q4.2 4.2 8.4 0V5.5M13 15.5h4"/></g>`,
    yaz: c => `<g stroke="${c}" stroke-width="1.4" fill="none" stroke-linecap="round"><path d="M15 4.5v11M11 5.5q4 4 8 0M11 14.5q4-4 8 0"/></g>`,
    waves: c => `<g stroke="${c}" stroke-width="1.2" fill="none"><path d="M8 8q1.75-2 3.5 0t3.5 0 3.5 0 3.5 0M8 12q1.75-2 3.5 0t3.5 0 3.5 0 3.5 0"/></g>`,
  };
  C.flagSvg = function (id, w = 30, h = 20) {
    const f = C.get(id).flag;
    const [pat, a, b, c, ch, cc] = f;
    let s = `<rect width="30" height="20" fill="${a}"/>`;
    switch (pat) {
      case 'h2': s += `<rect y="10" width="30" height="10" fill="${b}"/>`; break;
      case 'v2': s += `<rect x="15" width="15" height="20" fill="${b}"/>`; break;
      case 'h3': s += `<rect y="6.67" width="30" height="6.67" fill="${b}"/><rect y="13.33" width="30" height="6.67" fill="${c}"/>`; break;
      case 'v3': s += `<rect x="10" width="10" height="20" fill="${b}"/><rect x="20" width="10" height="20" fill="${c}"/>`; break;
      case 'cross': s += `<path fill="${b}" d="M12.5 0h5v20h-5zM0 7.5h30v5H0z"/>`; break;
      case 'nordic': s += `<path fill="${b}" d="M8 0h4v20H8zM0 8h30v4H0z"/>`; break;
      case 'nordic2': s += `<path fill="${b}" d="M7.5 0h5v20h-5zM0 7.5h30v5H0z"/><path fill="${c}" d="M8.75 0h2.5v20h-2.5zM0 8.75h30v2.5H0z"/>`; break;
      case 'saltire': s += `<path stroke="${b}" stroke-width="3.6" d="M0 0L30 20M30 0L0 20"/>`; break;
      case 'checky': for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) s += `<rect x="${i * 5}" y="${j * 5}" width="5" height="5" fill="${b}"/>`; break;
      case 'bars': for (let i = 1; i < 8; i += 2) s += `<rect y="${i * 2.5}" width="30" height="2.5" fill="${b}"/>`; break;
      case 'fess': s += `<rect y="8" width="30" height="4" fill="${b}"/>`; break;
      case 'per_bend': s += `<path fill="${b}" d="M30 0V20H0z"/>`; break;
      default: break;
    }
    if (ch && CHARGES[ch]) s += CHARGES[ch](cc, a);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 20" width="${w}" height="${h}">${s}<rect width="30" height="20" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="1"/></svg>`;
  };
  C.flagHtml = (id, cls = '') => `<span class="cflag ${cls}" title="${G.esc(C.get(id).name)}">${C.flagSvg(id)}</span>`;
  const imgs = new Map();
  C.flagImg = function (id) {
    let im = imgs.get(id);
    if (!im) {
      im = new Image();
      im.onload = () => { G.mapDirty = true; };
      im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(C.flagSvg(id, 60, 40));
      imgs.set(id, im);
    }
    return im.complete && im.naturalWidth ? im : null;
  };
})();
