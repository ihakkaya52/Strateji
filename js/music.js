// Müzik motoru: Web Audio ile prosedürel (örneksiz) ortaçağ müziği ve ses efektleri.
// Kültür grubuna göre üslup (latin, bizans, islam, bozkir, kuzey, cin) ve ruh hali (menu, peace, war).
// Karplus–Strong telli sazlar, nefesli ney/flüt, burdon, def/davul, zil, gong, çan; prosedürel yankı.
'use strict';

(function () {
  const NS = window.G = window.G || {};
  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  const LOOKAHEAD = 1.4;   // saniye: bu kadar ileriye nota planla
  const TICK_MS = 200;     // planlayıcı aralığı
  const MAX_VOICES = 40;   // çalar başına eşzamanlı ses sınırı
  const FADE_IN = 3.5, FADE_OUT = 3.0;
  const STORE_KEY = 'strateji_music_v1';

  // ---------------------------------------------------------------- yardımcılar
  function Rng(seed) {
    let s = seed | 0;
    const f = () => {
      s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
    return {
      f,
      i: (a, b) => a + Math.floor(f() * (b - a + 1)),
      range: (a, b) => a + f() * (b - a),
      pick: arr => arr[Math.floor(f() * arr.length)],
      chance: p => f() < p,
    };
  }
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // ---------------------------------------------------------------- makamlar / kipler
  const MODES = {
    dorian: { iv: [0, 2, 3, 5, 7, 9, 10], tr: 'Dorian' },
    mixo: { iv: [0, 2, 4, 5, 7, 9, 10], tr: 'Miksolidyen' },
    aeolian: { iv: [0, 2, 3, 5, 7, 8, 10], tr: 'Eolyen' },
    phrygian: { iv: [0, 1, 3, 5, 7, 8, 10], tr: 'Frigyen' },
    hijaz: { iv: [0, 1, 4, 5, 7, 8, 10], tr: 'Hicaz' },
    rast: { iv: [0, 2, 3.5, 5, 7, 9, 10.5], tr: 'Rast' },
    bayati: { iv: [0, 1.5, 3, 5, 7, 8, 10], tr: 'Bayati' },
    kurdi: { iv: [0, 1, 3, 5, 7, 8, 10], tr: 'Kürdi' },
    saba: { iv: [0, 1.5, 3, 4, 7, 8, 10], tr: 'Saba' },
    nahawand: { iv: [0, 2, 3, 5, 7, 8, 11], tr: 'Nihavend' },
    echos1: { iv: [0, 1.5, 3, 5, 7, 8.5, 10], tr: 'Birinci Ehos' },
    echos4: { iv: [0, 2, 4, 5, 7, 9, 10], tr: 'Dördüncü Ehos' },
    echosPl1: { iv: [0, 2, 3, 5, 7, 8, 10], tr: 'Birinci Plagal Ehos' },
    echosPl2: { iv: [0, 1, 4, 5, 7, 8, 11], tr: 'İkinci Plagal Ehos' },
    gong: { iv: [0, 2, 4, 7, 9], tr: 'Gong' },
    shang: { iv: [0, 2, 5, 7, 10], tr: 'Shang' },
    zhi: { iv: [0, 2, 5, 7, 9], tr: 'Zhi' },
    yu: { iv: [0, 3, 5, 7, 10], tr: 'Yu' },
    jue: { iv: [0, 3, 5, 8, 10], tr: 'Jue' },
    bhairav: { iv: [0, 1, 4, 5, 7, 8, 11], tr: 'Bhairav' },
    kafi: { iv: [0, 2, 3, 5, 7, 9, 10], tr: 'Kafi' },
    yaman: { iv: [0, 2, 4, 6, 7, 9, 11], tr: 'Yaman' },
    bhairavi: { iv: [0, 1, 3, 5, 7, 8, 10], tr: 'Bhairavi' },
  };
  const PERSIAN = { rast: 'Mahur', bayati: 'Şur', hijaz: 'Hümayun', nahawand: 'Nevâ', kurdi: 'Segâh', saba: 'Dəştî' };

  // ---------------------------------------------------------------- çalgılar
  // pluck: Karplus–Strong; leg: sürekli (nefesli / ses / boru)
  const INST = {
    lute: { type: 'pluck', ks: { dur: 1.5, bright: 0.45, t60: 1.3, pos: 0.18 }, oct: 0, gain: 0.42, pan: -0.25 },
    oud: { type: 'pluck', ks: { dur: 1.6, bright: 0.38, t60: 1.4, pos: 0.13 }, oct: 0, gain: 0.48, pan: -0.15, trem: true },
    psaltery: { type: 'pluck', ks: { dur: 2.0, bright: 0.8, t60: 2.0, pos: 0.09 }, oct: 12, gain: 0.22, pan: 0.3 },
    kanun: { type: 'pluck', ks: { dur: 1.6, bright: 0.75, t60: 1.5, pos: 0.1 }, oct: 12, gain: 0.24, pan: 0.3, trem: true },
    kopuz: { type: 'pluck', ks: { dur: 1.1, bright: 0.5, t60: 0.9, pos: 0.22 }, oct: 0, gain: 0.45, pan: -0.2 },
    lyre: { type: 'pluck', ks: { dur: 2.4, bright: 0.33, t60: 2.2, pos: 0.25 }, oct: 0, gain: 0.45, pan: -0.2 },
    gusli: { type: 'pluck', ks: { dur: 2.2, bright: 0.55, t60: 2.0, pos: 0.15 }, oct: 0, gain: 0.38, pan: -0.2 },
    harp: { type: 'pluck', ks: { dur: 2.2, bright: 0.5, t60: 2.0, pos: 0.3 }, oct: 0, gain: 0.38, pan: 0.25 },
    guqin: { type: 'pluck', ks: { dur: 3.0, bright: 0.28, t60: 2.8, pos: 0.16 }, oct: -12, gain: 0.6, pan: -0.1, slide: true },
    pipa: { type: 'pluck', ks: { dur: 1.1, bright: 0.7, t60: 0.9, pos: 0.12 }, oct: 0, gain: 0.36, pan: 0.15, trem: true },
    sitar: { type: 'pluck', ks: { dur: 2.0, bright: 0.85, t60: 1.8, pos: 0.07 }, oct: 0, gain: 0.3, pan: -0.15, slide: true },
    tanpura: { type: 'pluck', ks: { dur: 2.6, bright: 0.6, t60: 2.5, pos: 0.2 }, oct: 0, gain: 0.22, pan: 0.2 },
    recorder: { type: 'leg', kind: 'recorder', oct: 12, gain: 0.2, pan: 0.15 },
    ney: { type: 'leg', kind: 'ney', oct: 12, gain: 0.24, pan: 0.15 },
    dizi: { type: 'leg', kind: 'dizi', oct: 12, gain: 0.17, pan: 0.15 },
    choor: { type: 'leg', kind: 'choor', oct: 12, gain: 0.24, pan: 0.15 },
    bansuri: { type: 'leg', kind: 'ney', oct: 12, gain: 0.22, pan: 0.15 },
    choir: { type: 'leg', kind: 'choir', oct: 0, gain: 0.2, pan: 0 },
    shawm: { type: 'leg', kind: 'zurna', oct: 12, gain: 0.1, pan: 0.1 },
    zurna: { type: 'leg', kind: 'zurna', oct: 12, gain: 0.1, pan: 0.1 },
    horn: { type: 'leg', kind: 'horn', oct: -12, gain: 0.2, pan: -0.1 },
  };

  const LEG = {
    recorder: { harm: [1, 0.32, 0.14, 0.06, 0.03], breath: 0.1, bq: 3, bmul: 1, vib: 7, vibHz: 5.2, att: 0.025, sep: 0.3, scoop: 0 },
    ney: { harm: [1, 0.22, 0.07, 0.03], breath: 0.42, bq: 2.2, bmul: 1, vib: 14, vibHz: 4.8, att: 0.07, sep: 0.75, scoop: 35 },
    dizi: { harm: [1, 0.5, 0.32, 0.2, 0.12, 0.08], breath: 0.2, bq: 1.2, bmul: 3, vib: 11, vibHz: 5.5, att: 0.03, sep: 0.45, scoop: 20 },
    choor: { harm: [1, 0.12, 0.04], breath: 0.55, bq: 1.8, bmul: 1, vib: 9, vibHz: 4.5, att: 0.08, sep: 0.7, scoop: 30 },
    choir: { saw: 3, formants: [[450, 6, 1], [800, 7, 0.6], [2600, 5, 0.12]], vib: 6, vibHz: 4.6, att: 0.22, sep: 0.85, scoop: 0 },
    zurna: { harm: [1, 0.85, 0.9, 0.7, 0.62, 0.5, 0.42, 0.35, 0.3, 0.22, 0.18, 0.12], breath: 0.05, bq: 1, bmul: 2, vib: 16, vibHz: 5.8, att: 0.03, sep: 0.55, scoop: 25, lp: 3200 },
    horn: { saw: 1, brass: true, vib: 4, vibHz: 4.5, att: 0.09, sep: 0.4, scoop: 30 },
  };

  // Davullar: D = düm (pes), T = tek (tiz), k = hafif tek
  const KITS = {
    tabor: { f0: 150, bend: 1.6, dd: 0.18, dv: 0.42, dn: 0.2, nlp: 1800, tf: 2400, tq: 1.1, td: 0.07, tv: 0.3, snare: true },
    frame: { f0: 72, bend: 1.8, dd: 0.45, dv: 0.75, dn: 0.18, nlp: 700, tf: 1000, tq: 0.9, td: 0.09, tv: 0.28 },
    darbuka: { f0: 92, bend: 1.4, dd: 0.28, dv: 0.6, dn: 0.15, nlp: 1200, tf: 3300, tq: 1.6, td: 0.05, tv: 0.38, ring: 620 },
    def: { f0: 82, bend: 1.5, dd: 0.33, dv: 0.6, dn: 0.18, nlp: 900, tf: 1900, tq: 1, td: 0.08, tv: 0.3, jingle: true },
    davul: { f0: 58, bend: 2.0, dd: 0.55, dv: 0.95, dn: 0.3, nlp: 450, tf: 1500, tq: 0.8, td: 0.05, tv: 0.34 },
    taiko: { f0: 52, bend: 1.5, dd: 0.85, dv: 1.0, dn: 0.25, nlp: 380, tf: 2600, tq: 1.4, td: 0.035, tv: 0.3 },
    woodblock: { f0: 760, bend: 1.0, dd: 0.07, dv: 0.25, dn: 0, nlp: 0, tf: 1500, tq: 9, td: 0.05, tv: 0.25 },
    tabla: { f0: 70, bend: 0.75, dd: 0.45, dv: 0.6, dn: 0.08, nlp: 800, tf: 4200, tq: 2, td: 0.03, tv: 0.25, ringTonic: true },
  };

  // ---------------------------------------------------------------- üslup tanımları
  function tTitle(fn) { return fn; }
  function styleSpec(style, mood, group) {
    const S = {};
    if (mood === 'menu') {
      return {
        key: 'menu', alt: [
          {
            tonic: 50, modes: ['dorian', 'mixo', 'dorian'], meters: [[2, 2, 2]], step: [0.36, 0.42],
            lead: ['choir'], acc: [{ inst: 'choir', pat: 'organum' }], drone: { kind: 'gurdy', semis: [0, 7], oct: -12, vol: 0.55 },
            drums: { kit: 'frame', vol: 0.45, from: 1, pats: { '222': ['D.....', 'D...k.'] } },
            extra: { bell: 0.7 }, range: [-3, 8], density: 0.25, ornate: 0.15, free: 0, rev: 0.55,
            title: m => `Organum — ${MODES[m].tr}`,
          },
          {
            tonic: 55, modes: ['echos4', 'echos1'], meters: [[2, 2, 2, 2]], step: [0.32, 0.36],
            lead: ['choir'], acc: [{ inst: 'psaltery', pat: 'hetero', oct: -12 }], drone: { kind: 'ison', semis: [0], oct: -12, vol: 0.9 },
            drums: { kit: 'frame', vol: 0.35, from: 1, pats: { '2222': ['D.......', 'D...D...'] } },
            extra: { bell: 0.8 }, range: [-2, 7], density: 0.3, ornate: 0.35, free: 0.25, rev: 0.6,
            title: m => `Bizans İlahisi — ${MODES[m].tr}`,
          },
        ],
      };
    }
    const war = mood === 'war';
    switch (style) {
      case 'latin':
        return war ? {
          tonic: 57, modes: ['aeolian', 'phrygian', 'dorian'], meters: [[2, 2, 2, 2]], step: [0.15, 0.17],
          lead: ['shawm', 'recorder', 'lute'], acc: [{ inst: 'lute', pat: 'drone' }, { inst: 'harp', pat: 'drone' }],
          drone: { kind: 'gurdy', semis: [0, 7], oct: -12, vol: 0.7 },
          drums: { kit: 'tabor', kit2: 'davul', vol: 1, from: 0, pats: { '2222': ['D.TkD.T.', 'D.D.DkTk', 'DkTkD.TT', 'D.TkDDT.'] } },
          extra: { horn: 0.3 }, range: [-4, 7], density: 0.6, ornate: 0.1, free: 0, rev: 0.3,
          title: m => `Savaş Estampiesi — ${MODES[m].tr}`,
        } : {
          tonic: 62, modes: ['dorian', 'mixo', 'dorian'], meters: [[3, 3], [2, 2, 2]], step: [0.2, 0.235],
          lead: ['recorder', 'lute', 'recorder'], acc: [{ inst: 'lute', pat: 'hetero', oct: -12 }, { inst: 'lute', pat: 'drone' }, { inst: 'harp', pat: 'arp', oct: -12 }],
          drone: { kind: 'gurdy', semis: [0, 7], oct: -24, vol: 0.55 },
          drums: { kit: 'tabor', vol: 0.6, from: 1, pats: { '33': ['D..T.k', 'D.kT..', 'D..D.T'], '222': ['D.T.T.', 'D.TkT.'] } },
          extra: {}, range: [-3, 8], density: 0.5, ornate: 0.15, free: 0, rev: 0.38,
          title: m => `Estampie — ${MODES[m].tr}`,
        };
      case 'bizans':
        return war ? {
          tonic: 50, modes: ['echosPl2', 'echosPl1'], meters: [[2, 2, 2, 2]], step: [0.2, 0.23],
          lead: ['choir', 'choir', 'kanun'], acc: [{ inst: 'psaltery', pat: 'drone', oct: -12 }],
          drone: { kind: 'ison', semis: [0], oct: -12, vol: 1 },
          drums: { kit: 'davul', vol: 0.9, from: 0, pats: { '2222': ['D...D.T.', 'D.T.D...', 'D...DkT.'] } },
          extra: { bell: 0.3, horn: 0.25 }, range: [-3, 6], density: 0.45, ornate: 0.3, free: 0, rev: 0.5,
          title: m => `Bizans Savaş İlahisi — ${MODES[m].tr}`,
        } : {
          tonic: 55, modes: ['echos1', 'echos4', 'echosPl1'], meters: [[2, 2, 2, 2]], step: [0.31, 0.37],
          lead: ['choir', 'choir', 'psaltery'], acc: [{ inst: 'psaltery', pat: 'hetero', oct: -12 }, { inst: 'psaltery', pat: 'none' }],
          drone: { kind: 'ison', semis: [0], oct: -12, vol: 1 },
          drums: null, extra: { bell: 0.5 }, range: [-2, 7], density: 0.32, ornate: 0.45, free: 0.3, rev: 0.62,
          title: m => `Bizans İlahisi — ${MODES[m].tr}`,
        };
      case 'islam': {
        const iran = group === 'iran', hind = group === 'hint';
        if (hind) {
          return war ? {
            tonic: 55, modes: ['bhairav', 'bhairavi'], meters: [[2, 2, 2, 2]], step: [0.14, 0.16],
            lead: ['zurna', 'sitar'], acc: [{ inst: 'tanpura', pat: 'tanpura', oct: -12 }],
            drone: { kind: 'bowed', semis: [0, 7], oct: -12, vol: 0.5 },
            drums: { kit: 'tabla', kit2: 'davul', vol: 1, from: 0, pats: { '2222': ['DTkTD.Tk', 'D.TTDkT.', 'DDTkD.TT'] } },
            extra: { zill: 0.4 }, range: [-3, 7], density: 0.6, ornate: 0.3, free: 0, rev: 0.32,
            title: m => `Savaş Ragası — ${MODES[m].tr}`,
          } : {
            tonic: 60, modes: ['bhairav', 'kafi', 'yaman'], meters: [[2, 2, 2, 2]], step: [0.2, 0.24],
            lead: ['sitar', 'bansuri', 'sitar'], acc: [{ inst: 'tanpura', pat: 'tanpura', oct: -12 }],
            drone: { kind: 'bowed', semis: [0, 7], oct: -24, vol: 0.35 },
            drums: { kit: 'tabla', vol: 0.55, from: 1, pats: { '2222': ['DTkTD.Tk', 'D.TkDkT.', 'D.TTD.Tk'] } },
            extra: {}, range: [-3, 8], density: 0.45, ornate: 0.45, free: 0.5, rev: 0.42,
            title: m => `Raga ${MODES[m].tr}`,
          };
        }
        const mk = m => iran ? `Dastgah ${PERSIAN[m] || MODES[m].tr}` : `Makam ${MODES[m].tr}`;
        return war ? {
          tonic: 52, modes: ['hijaz', 'kurdi', 'saba'], meters: [[2, 2, 2, 2]], step: [0.13, 0.15],
          lead: ['zurna', 'oud', 'zurna'], acc: [{ inst: 'oud', pat: 'drone', oct: -12 }, { inst: 'kanun', pat: 'hetero', oct: -12 }],
          drone: { kind: 'bowed', semis: [0, 7], oct: -12, vol: 0.55 },
          drums: { kit: 'davul', kit2: 'darbuka', vol: 1, from: 0, pats: { '2222': ['D.TTD.T.', 'D.T.D.TT', 'DkTkD.T.', 'D.TTDkTk'] } },
          extra: { zill: 0.6 }, range: [-3, 7], density: 0.6, ornate: 0.25, free: 0, rev: 0.32,
          title: m => `Cenk Havası — ${mk(m)}`,
        } : {
          tonic: 57, modes: iran ? ['bayati', 'rast', 'hijaz'] : ['rast', 'bayati', 'hijaz', 'nahawand'],
          meters: [[2, 2, 2, 2], [3, 2, 2, 3]], step: [0.17, 0.2],
          lead: ['oud', 'ney', 'oud', 'kanun'], acc: [{ inst: 'oud', pat: 'hetero', oct: -12 }, { inst: 'oud', pat: 'drone', oct: -12 }, { inst: 'kanun', pat: 'none' }],
          drone: { kind: 'bowed', semis: [0, 7], oct: -24, vol: 0.4 },
          drums: { kit: 'darbuka', kit2: 'def', vol: 0.55, from: 1, pats: { '2222': ['DT.TD.T.', 'DTkTDkT.', 'DD.TD.T.'], '3223': ['D..T.DDT..', 'D.kT.DDTk.'] } },
          extra: { zill: 0.15 }, range: [-3, 8], density: 0.48, ornate: 0.4, free: 0.45, rev: 0.42,
          title: m => mk(m),
        };
      }
      case 'bozkir':
        return war ? {
          tonic: 52, modes: ['yu', 'jue', 'yu'], meters: [[3, 3, 3, 3]], step: [0.1, 0.115],
          lead: ['choor', 'kopuz'], acc: [{ inst: 'kopuz', pat: 'gallop', oct: -12 }],
          drone: { kind: 'throat', semis: [0], oct: -12, vol: 0.9 },
          drums: { kit: 'davul', kit2: 'frame', vol: 1, from: 0, pats: { '3333': ['kkDkkDkkDkkD', 'TkDTkDTkDkkD', 'kkDkkDkkDTTD'] } },
          extra: { horn: 0.45 }, range: [-3, 6], density: 0.5, ornate: 0.15, free: 0, rev: 0.3,
          title: () => 'Akın Havası',
        } : {
          tonic: 57, modes: ['yu', 'zhi', 'shang'], meters: [[3, 3, 3, 3]], step: [0.12, 0.14],
          lead: ['choor', 'kopuz', 'choor'], acc: [{ inst: 'kopuz', pat: 'gallop', oct: -12 }],
          drone: { kind: 'throat', semis: [0], oct: -12, vol: 0.85 },
          drums: { kit: 'frame', vol: 0.5, from: 1, pats: { '3333': ['kkDkkDkkDkkD', '..D..D..D..D', 'kkD..DkkD..D'] } },
          extra: {}, range: [-2, 7], density: 0.42, ornate: 0.25, free: 0.3, rev: 0.4,
          title: (m, lead) => lead === 'kopuz' ? 'Kopuz Havası' : 'Bozkır Türküsü',
        };
      case 'kuzey': {
        const kelt = group === 'kelt', slav = group === 'slav';
        const plk = slav ? 'gusli' : kelt ? 'harp' : 'lyre';
        const nm = slav ? 'Gusli Ezgisi' : kelt ? 'Kelt Ezgisi' : group === 'anglosakson' ? 'Sakson Ezgisi' : 'Kuzey Ezgisi';
        if (war) {
          return {
            tonic: 50, modes: ['aeolian', 'phrygian', 'dorian'], meters: [[2, 2, 2, 2]], step: [0.19, 0.22],
            lead: [plk, 'recorder', plk], acc: [{ inst: plk, pat: 'arp', oct: -12 }],
            drone: { kind: 'bowed', semis: [0, 7], oct: -12, vol: 0.7 },
            drums: { kit: 'frame', kit2: 'davul', vol: 1, from: 0, pats: { '2222': ['D...D.k.', 'D.D.D...', 'D..kD.D.', 'D...DDk.'] } },
            extra: { horn: 0.5 }, range: [-3, 6], density: 0.45, ornate: 0.1, free: 0, rev: 0.4,
            title: m => `Kalkan Duvarı — ${MODES[m].tr}`,
          };
        }
        return kelt ? {
          tonic: 62, modes: ['mixo', 'dorian'], meters: [[3, 3]], step: [0.19, 0.22],
          lead: ['recorder', 'harp'], acc: [{ inst: 'harp', pat: 'arp', oct: -12 }],
          drone: { kind: 'gurdy', semis: [0, 7], oct: -24, vol: 0.45 },
          drums: { kit: 'frame', vol: 0.5, from: 1, pats: { '33': ['D.kD.k', 'D.kTkk', 'D..D.k'] } },
          extra: {}, range: [-3, 8], density: 0.55, ornate: 0.2, free: 0, rev: 0.4,
          title: m => `${nm} — ${MODES[m].tr}`,
        } : {
          tonic: 55, modes: ['aeolian', 'dorian'], meters: [[2, 2, 2, 2]], step: [0.26, 0.3],
          lead: [plk, 'recorder', plk], acc: [{ inst: plk, pat: 'arp', oct: -12 }],
          drone: { kind: 'bowed', semis: [0, 7], oct: -12, vol: 0.55 },
          drums: { kit: 'frame', vol: 0.5, from: 1, pats: { '2222': ['D.......', 'D.......', 'D...D...'] } },
          extra: {}, range: [-3, 7], density: 0.38, ornate: 0.15, free: 0.15, rev: 0.5,
          title: m => `${nm} — ${MODES[m].tr}`,
        };
      }
      case 'cin':
      default:
        return war ? {
          tonic: 57, modes: ['yu', 'shang', 'jue'], meters: [[2, 2, 2, 2]], step: [0.16, 0.18],
          lead: ['pipa', 'dizi', 'pipa'], acc: [{ inst: 'pipa', pat: 'drone', oct: -12 }],
          drone: { kind: 'bowed', semis: [0, 7], oct: -12, vol: 0.4 },
          drums: { kit: 'taiko', vol: 1, from: 0, pats: { '2222': ['D.D.DkD.', 'D..kD.TT', 'DDT.D.T.', 'D.DkD.D.'] } },
          extra: { gong: 0.5 }, range: [-3, 6], density: 0.55, ornate: 0.25, free: 0, rev: 0.4,
          title: m => `Sınır Davulları — ${MODES[m].tr} Kipi`,
        } : {
          tonic: 62, modes: ['gong', 'zhi', 'yu', 'shang'], meters: [[2, 2, 2, 2]], step: [0.28, 0.33],
          lead: ['guqin', 'dizi', 'guqin'], acc: [{ inst: 'guqin', pat: 'hetero', oct: 0 }, { inst: 'guqin', pat: 'none' }],
          drone: null,
          drums: { kit: 'woodblock', vol: 0.35, from: 1, pats: { '2222': ['D.......', 'D...k...', 'D.....k.'] } },
          extra: { gong: 0.3, bell: 0.2 }, range: [-2, 7], density: 0.32, ornate: 0.35, free: 0.3, rev: 0.55,
          title: (m, lead) => `${lead === 'dizi' ? 'Dizi' : 'Guqin'} Ezgisi — ${MODES[m].tr} Kipi`,
        };
    }
    return S;
  }

  const GROUP_STYLE = {
    turk_bozkir: 'bozkir', turk_yerlesik: 'islam', iran: 'islam', arap: 'islam', berberi: 'islam', hint: 'islam', afrika: 'islam',
    bizans: 'bizans', kafkas: 'bizans', latin: 'latin',
    iskandinav: 'kuzey', kelt: 'kuzey', anglosakson: 'kuzey', slav: 'kuzey',
    cin: 'cin', dogu_asya: 'cin', gdasya: 'cin',
  };
  const STYLES = ['latin', 'bizans', 'islam', 'bozkir', 'kuzey', 'cin'];
  function resolveStyle(g) {
    if (STYLES.indexOf(g) >= 0) return g;
    return GROUP_STYLE[g] || 'latin';
  }

  // ---------------------------------------------------------------- Karplus–Strong tampon önbelleği
  const ksCache = new Map();
  const KS_CACHE_MAX = 72;
  function ksBuffer(ctx, freq, p) {
    const sr = ctx.sampleRate;
    const key = sr + '|' + p.dur + '|' + p.bright + '|' + p.t60 + '|' + p.pos + '|' + Math.round(freq * 20);
    let b = ksCache.get(key);
    if (b) { ksCache.delete(key); ksCache.set(key, b); return b; }
    const len = Math.floor(p.dur * sr);
    const out = new Float32Array(len);
    const S = 0.5;
    const D = Math.max(2, sr / freq - (1 - S));
    const di = Math.floor(D), fr = D - di;
    const exLen = Math.min(len, Math.ceil(D));
    // uyarım: yumuşatılmış gürültü + tel konumu taraklı süzgeci
    const ex = new Float32Array(exLen);
    let lp = 0, mean = 0;
    for (let i = 0; i < exLen; i++) { lp += p.bright * ((Math.random() * 2 - 1) - lp); ex[i] = lp; mean += lp; }
    mean /= exLen;
    const pd = Math.max(1, Math.round(p.pos * exLen));
    const ex2 = new Float32Array(exLen);
    for (let i = 0; i < exLen; i++) ex2[i] = (ex[i] - mean) - (i >= pd ? ex[i - pd] - mean : 0);
    const rho = Math.pow(0.001, 1 / (freq * p.t60));
    let prevD = 0;
    for (let n = 0; n < len; n++) {
      let fb = 0;
      if (n > di) {
        const a = out[n - di], c = out[n - di - 1];
        const d = a + (c - a) * fr;
        fb = rho * (S * d + (1 - S) * prevD);
        prevD = d;
      }
      out[n] = (n < exLen ? ex2[n] : 0) + fb;
    }
    // DC engeli + tepe normalizasyonu + sonda kısa sönüm
    let x1 = 0, y1 = 0, pk = 0;
    for (let n = 0; n < len; n++) { const y = out[n] - x1 + 0.995 * y1; x1 = out[n]; y1 = y; out[n] = y; const a = y < 0 ? -y : y; if (a > pk) pk = a; }
    const g = pk > 0 ? 0.9 / pk : 1;
    const fade = Math.min(len, Math.floor(0.08 * sr));
    for (let n = 0; n < len; n++) { out[n] *= g; if (n > len - fade) out[n] *= (len - n) / fade; }
    b = ctx.createBuffer(1, len, sr);
    b.getChannelData(0).set(out);
    ksCache.set(key, b);
    if (ksCache.size > KS_CACHE_MAX) ksCache.delete(ksCache.keys().next().value);
    return b;
  }

  // ---------------------------------------------------------------- Motor (her bağlam için bir grafik)
  class Engine {
    constructor(ctx) {
      this.ctx = ctx;
      const sr = ctx.sampleRate;
      this.master = ctx.createGain();
      this.master.gain.value = 1;
      this.musicGain = ctx.createGain();
      this.sfxGain = ctx.createGain();
      this.warm = ctx.createBiquadFilter();
      this.warm.type = 'lowpass'; this.warm.frequency.value = 7200; this.warm.Q.value = 0.5;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -16; this.comp.knee.value = 10; this.comp.ratio.value = 4;
      this.comp.attack.value = 0.006; this.comp.release.value = 0.25;
      this.out = ctx.createGain(); this.out.gain.value = 0.7;
      this.musicGain.connect(this.warm);
      this.sfxGain.connect(this.warm);
      this.warm.connect(this.comp); this.comp.connect(this.out); this.out.connect(this.master); this.master.connect(ctx.destination);
      // prosedürel taş salon yankısı
      this.rev = ctx.createConvolver();
      this.rev.normalize = false;
      this.rev.buffer = this.makeIR(2.8, 2.4);
      this.revSend = ctx.createGain();
      this.revOut = ctx.createGain(); this.revOut.gain.value = 0.9;
      this.revSend.connect(this.rev); this.rev.connect(this.revOut); this.revOut.connect(this.warm);
      this.sfxRev = ctx.createGain(); this.sfxRev.gain.value = 0.25;
      this.sfxGain.connect(this.sfxRev); this.sfxRev.connect(this.revSend);
      // gürültü tamponu
      const nl = Math.floor(sr * 2);
      this.noise = ctx.createBuffer(1, nl, sr);
      const nd = this.noise.getChannelData(0);
      for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
      this.waves = {};
      this.nodeCount = 0;
    }
    makeIR(len, t60) {
      const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(len * sr);
      const b = ctx.createBuffer(2, n, sr);
      const pre = Math.floor(0.018 * sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        let lp = 0;
        // erken yansımalar
        const taps = [0.011, 0.019, 0.027, 0.036, 0.047, 0.061, 0.074];
        for (let k = 0; k < taps.length; k++) {
          const i = Math.floor((taps[k] + (ch ? 0.0031 * k : 0)) * sr);
          if (i < n) d[i] += (k % 2 ? -1 : 1) * 0.35 * Math.pow(0.82, k);
        }
        for (let i = pre; i < n; i++) {
          const t = (i - pre) / sr;
          const env = Math.pow(0.001, t / t60);
          const a = 0.55 - 0.45 * Math.min(1, t / len); // kuyruk koyulaşır
          lp += a * ((Math.random() * 2 - 1) - lp);
          const fadeIn = Math.min(1, t / 0.04);
          d[i] += lp * env * fadeIn * 0.28;
        }
      }
      return b;
    }
    wave(kind, harm) {
      if (!this.waves[kind]) {
        const re = new Float32Array(harm.length + 1), im = new Float32Array(harm.length + 1);
        for (let i = 0; i < harm.length; i++) im[i + 1] = harm[i];
        this.waves[kind] = this.ctx.createPeriodicWave(re, im);
      }
      return this.waves[kind];
    }
    noiseSrc(t, dur) {
      const s = this.ctx.createBufferSource();
      s.buffer = this.noise;
      const off = Math.random() * (this.noise.duration - dur - 0.05);
      s.start(t, Math.max(0, off), dur);
      return s;
    }
  }

  // ---------------------------------------------------------------- ses kaynakları
  // Ses kaydı: {end, nodes, srcs}; bitince bağlantılar kesilir.
  function track(owner, end, nodes, srcs) {
    const v = { end, nodes, srcs };
    owner.voices.push(v);
    const last = srcs[srcs.length - 1];
    if (last) last.onended = () => { for (const n of nodes) { try { n.disconnect(); } catch (e) { /* */ } } };
    owner.made += nodes.length;
    return v;
  }

  function playPluck(e, owner, bus, t, freq, vel, inst, opt) {
    const ctx = e.ctx;
    opt = opt || {};
    const buf = ksBuffer(ctx, freq, inst.ks);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    if (opt.slide) {
      src.playbackRate.setValueAtTime(Math.pow(2, -opt.slide / 12), t);
      src.playbackRate.setTargetAtTime(1, t + 0.03, 0.06);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    let end = t + buf.duration;
    if (opt.stop && t + opt.stop < end) {
      g.gain.setTargetAtTime(0, t + opt.stop, 0.04);
      end = t + opt.stop + 0.25;
    }
    src.connect(g); g.connect(bus);
    src.start(t); src.stop(end);
    track(owner, end, [src, g], [src]);
  }

  // Sürekli ses: bir cümle boyunca açık kalır, notalar frekans/zarf otomasyonuyla çalınır
  class Legato {
    constructor(e, owner, bus, kind, t, vel) {
      const ctx = e.ctx, K = LEG[kind];
      this.e = e; this.K = K; this.owner = owner; this.prevF = 0; this.vel = vel;
      this.amp = ctx.createGain(); this.amp.gain.setValueAtTime(0, t);
      const nodes = [this.amp], srcs = [];
      this.oscs = [];
      const tone = ctx.createGain(); nodes.push(tone);
      if (K.saw) {
        for (let i = 0; i < K.saw; i++) {
          const o = ctx.createOscillator(); o.type = 'sawtooth';
          o.detune.value = K.saw > 1 ? (i - (K.saw - 1) / 2) * 9 : 0;
          o.connect(tone); this.oscs.push(o);
        }
        tone.gain.value = 1 / K.saw;
      } else {
        const o = ctx.createOscillator(); o.setPeriodicWave(e.wave(kind, K.harm));
        o.connect(tone); this.oscs.push(o);
        tone.gain.value = 1;
      }
      // titreşim (vibrato)
      this.lfo = ctx.createOscillator(); this.lfo.frequency.value = K.vibHz * (0.92 + Math.random() * 0.16);
      this.lfoG = ctx.createGain(); this.lfoG.gain.setValueAtTime(0, t);
      this.lfo.connect(this.lfoG);
      for (const o of this.oscs) this.lfoG.connect(o.frequency);
      nodes.push(this.lfo, this.lfoG);
      if (K.formants) {
        for (const f of K.formants) {
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f[0] * (0.92 + Math.random() * 0.16); bp.Q.value = f[1];
          const fg = ctx.createGain(); fg.gain.value = f[2] * 2.2;
          tone.connect(bp); bp.connect(fg); fg.connect(this.amp); nodes.push(bp, fg);
        }
      } else if (K.brass) {
        this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.Q.value = 1.5; this.lp.frequency.setValueAtTime(300, t);
        tone.connect(this.lp); this.lp.connect(this.amp); nodes.push(this.lp);
      } else if (K.lp) {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = K.lp; lp.Q.value = 0.7;
        const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 1500; pk.Q.value = 1.2; pk.gain.value = 5;
        tone.connect(pk); pk.connect(lp); lp.connect(this.amp); nodes.push(lp, pk);
      } else {
        tone.connect(this.amp);
      }
      if (K.breath) {
        const n = ctx.createBufferSource(); n.buffer = e.noise; n.loop = true;
        n.loopStart = Math.random(); n.loopEnd = e.noise.duration;
        this.bp = ctx.createBiquadFilter(); this.bp.type = 'bandpass'; this.bp.Q.value = K.bq;
        const ng = ctx.createGain(); ng.gain.value = K.breath;
        n.connect(this.bp); this.bp.connect(ng); ng.connect(this.amp);
        nodes.push(n, this.bp, ng); this.noise = n;
        n.start(t, Math.random());
      }
      this.amp.connect(bus);
      for (const o of this.oscs) o.start(t);
      this.lfo.start(t);
      this.srcs = this.oscs.concat([this.lfo]).concat(this.noise ? [this.noise] : []);
      this.v = track(owner, Infinity, nodes, this.srcs);
      this.t0 = t;
    }
    note(t, f, d, v, opt) {
      const K = this.K; opt = opt || {};
      v *= this.vel;
      const scoop = K.scoop && !opt.slur && d > 0.25 ? K.scoop : 0;
      const f0 = scoop ? f * Math.pow(2, -scoop / 1200) : f;
      for (const o of this.oscs) {
        if (opt.slur && this.prevF) o.frequency.setTargetAtTime(f, t, 0.025);
        else { o.frequency.setValueAtTime(f0, t); if (scoop) o.frequency.setTargetAtTime(f, t + 0.01, 0.045); }
        if (opt.orn === 'turn' && d > 0.35) {
          const up = f * Math.pow(2, (opt.up || 2) / 12), dn = f * Math.pow(2, -(opt.dn || 2) / 12);
          o.frequency.setValueAtTime(up, t + 0.05); o.frequency.setValueAtTime(f, t + 0.1);
          o.frequency.setValueAtTime(dn, t + 0.15); o.frequency.setValueAtTime(f, t + 0.2);
        } else if (opt.orn === 'grace' && d > 0.3) {
          o.frequency.setValueAtTime(f * Math.pow(2, (opt.up || 2) / 12), t);
          o.frequency.setValueAtTime(f, t + 0.065);
        }
      }
      // gecikmeli vibrato
      const depth = f * (Math.pow(2, K.vib / 1200) - 1);
      this.lfoG.gain.setValueAtTime(depth * 0.15, t);
      this.lfoG.gain.linearRampToValueAtTime(d > 0.4 ? depth : depth * 0.4, t + Math.max(0.05, Math.min(d * 0.8, 0.55)));
      if (this.bp) this.bp.frequency.setValueAtTime(Math.min(9000, f * K.bmul), t);
      if (this.lp) {
        this.lp.frequency.setValueAtTime(f * 1.2, t);
        this.lp.frequency.setTargetAtTime(f * 5 * (0.6 + v * 2), t, 0.05);
        this.lp.frequency.setTargetAtTime(f * 2.5, t + 0.15, 0.25);
      }
      this.amp.gain.setTargetAtTime(v, t, opt.slur ? 0.03 : K.att);
      const gap = Math.min(0.06, d * 0.2);
      this.amp.gain.setTargetAtTime(v * (opt.last ? 0.0 : K.sep), t + d - gap, opt.last ? 0.09 : 0.02);
      this.prevF = f;
    }
    end(t) {
      this.amp.gain.setTargetAtTime(0, t, 0.08);
      const stop = t + 0.6;
      for (const s of this.srcs) { try { s.stop(stop); } catch (e) { /* */ } }
      this.v.end = stop;
    }
  }

  function drone(e, owner, bus, t, dur, freqs, kind, vol, rng) {
    const ctx = e.ctx;
    const att = Math.min(3, dur * 0.3), rel = 2.5;
    const amp = ctx.createGain();
    const nodes = [amp], srcs = [];
    amp.gain.setValueAtTime(0, t);
    amp.gain.linearRampToValueAtTime(vol, t + att);
    amp.gain.setValueAtTime(vol, t + dur - 0.2);
    amp.gain.linearRampToValueAtTime(0, t + dur + rel);
    const end = t + dur + rel + 0.05;
    const filt = ctx.createBiquadFilter();
    nodes.push(filt);
    filt.connect(amp);
    if (kind === 'ison') {
      // insan sesi burdonu: testere + formantlar
      filt.type = 'lowpass'; filt.frequency.value = 1800;
      const vowels = [[450, 800], [400, 750], [550, 950]];
      const vw = rng.pick(vowels);
      const sum = ctx.createGain(); sum.gain.value = 0.5; nodes.push(sum);
      for (let k = 0; k < 2; k++) {
        const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = vw[k]; bp.Q.value = 5;
        const g = ctx.createGain(); g.gain.value = k ? 1.1 : 2.2;
        sum.connect(bp); bp.connect(g); g.connect(filt); nodes.push(bp, g);
      }
      freqs.forEach(f => {
        for (let k = 0; k < 3; k++) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (k - 1) * 8;
          o.connect(sum); srcs.push(o);
        }
      });
    } else if (kind === 'throat') {
      // gırtlak (hömey): pes testere + dar bant ıslık armonikleri
      filt.type = 'lowpass'; filt.frequency.value = 900;
      const f = freqs[0];
      const sum = ctx.createGain(); sum.gain.value = 0.35; nodes.push(sum);
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(sum); srcs.push(o);
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = 6; o2.connect(sum); srcs.push(o2);
      sum.connect(filt);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 38;
      const wg = ctx.createGain(); wg.gain.value = 3.2;
      sum.connect(bp); bp.connect(wg); wg.connect(amp); nodes.push(bp, wg);
      const harms = [6, 8, 9, 8, 12, 9, 8, 6, 8];
      let tt = t; let i = rng.i(0, harms.length - 1);
      bp.frequency.setValueAtTime(f * harms[i], t);
      while (tt < t + dur) {
        tt += rng.range(1.2, 3.2); i = (i + rng.i(1, 2)) % harms.length;
        bp.frequency.setTargetAtTime(f * harms[i], tt, 0.12);
      }
    } else {
      // gurdy (çarklı lir) veya bowed (rebab / lyra): testere + yavaş süzgeç dalgası
      filt.type = 'lowpass';
      filt.frequency.value = kind === 'gurdy' ? 1300 : 750; filt.Q.value = kind === 'gurdy' ? 2 : 1;
      const sum = ctx.createGain(); sum.gain.value = 0.32; nodes.push(sum);
      sum.connect(filt);
      freqs.forEach((f, idx) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = idx ? 3 : -2;
        o.connect(sum); srcs.push(o);
        if (kind === 'gurdy' && idx === 0) {
          const q = ctx.createOscillator(); q.type = 'square'; q.frequency.value = f * 2; q.detune.value = 5;
          const qg = ctx.createGain(); qg.gain.value = 0.25; q.connect(qg); qg.connect(sum); srcs.push(q); nodes.push(qg);
        }
      });
      const lfo = ctx.createOscillator(); lfo.frequency.value = rng.range(0.08, 0.2);
      const lg = ctx.createGain(); lg.gain.value = kind === 'gurdy' ? 350 : 220;
      lfo.connect(lg); lg.connect(filt.frequency); srcs.push(lfo); nodes.push(lg);
    }
    amp.connect(bus);
    for (const s of srcs) { s.start(t); s.stop(end); nodes.push(s); }
    track(owner, end, nodes, srcs);
  }

  function drumHit(e, owner, bus, t, kitName, ch, vel, tonicF) {
    const ctx = e.ctx, K = KITS[kitName];
    const nodes = [], srcs = [];
    if (ch === 'D') {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(K.f0 * K.bend, t);
      o.frequency.exponentialRampToValueAtTime(K.f0, t + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vel * K.dv, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + K.dd);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + K.dd + 0.02);
      nodes.push(o, g); srcs.push(o);
      if (K.dn) {
        const n = e.noiseSrc(t, 0.1);
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = K.nlp;
        const ng = ctx.createGain(); ng.gain.setValueAtTime(vel * K.dn, t); ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.08);
        n.connect(f); f.connect(ng); ng.connect(bus); nodes.push(n, f, ng); srcs.push(n);
      }
    } else {
      const v = vel * (ch === 'k' ? 0.5 : 1);
      const dec = K.td * (ch === 'k' ? 0.8 : 1);
      const n = e.noiseSrc(t, dec + 0.05);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = K.tf * (ch === 'k' ? 1.1 : 1); f.Q.value = K.tq;
      const g = ctx.createGain(); g.gain.setValueAtTime(v * K.tv * 2.2, t); g.gain.exponentialRampToValueAtTime(0.0005, t + dec);
      n.connect(f); f.connect(g); g.connect(bus); nodes.push(n, f, g); srcs.push(n);
      const rf = K.ringTonic && tonicF ? tonicF * 2 : K.ring;
      if (rf) {
        const o = ctx.createOscillator(); o.frequency.value = rf;
        const og = ctx.createGain(); og.gain.setValueAtTime(v * 0.18, t); og.gain.exponentialRampToValueAtTime(0.0005, t + (K.ringTonic ? 0.3 : 0.08));
        o.connect(og); og.connect(bus); o.start(t); o.stop(t + 0.32); nodes.push(o, og); srcs.push(o);
      }
    }
    if (K.snare || K.jingle) {
      const n = e.noiseSrc(t, 0.2);
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = K.jingle ? 6500 : 3200;
      const g = ctx.createGain(); g.gain.setValueAtTime(vel * (K.jingle ? 0.12 : 0.1), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0005, t + (K.jingle ? 0.17 : 0.11));
      n.connect(f); f.connect(g); g.connect(bus); nodes.push(n, f, g); srcs.push(n);
    }
    track(owner, t + 1, nodes, srcs);
  }

  // Çan / gong / zil: uyumsuz kısmi tonların toplamı
  const BELLS = {
    bell: { ratios: [0.5, 1, 1.19, 1.5, 2, 2.5, 3, 4.2], decay: [3.2, 2.4, 1.9, 1.6, 1.3, 0.9, 0.7, 0.45], amp: [0.45, 1, 0.55, 0.35, 0.45, 0.25, 0.18, 0.08], att: 0.002 },
    gong: { ratios: [1, 1.52, 2.07, 2.64, 3.31, 4.1], decay: [4, 3.2, 2.4, 1.6, 1.1, 0.7], amp: [1, 0.7, 0.55, 0.4, 0.3, 0.2], att: 0.03, glide: 0.985 },
    zill: { ratios: [1, 1.41, 2.13, 2.76], decay: [0.9, 0.7, 0.5, 0.35], amp: [1, 0.7, 0.5, 0.3], att: 0.001 },
  };
  function bell(e, owner, bus, t, f, vel, type, maxDur) {
    const ctx = e.ctx, B = BELLS[type];
    const nodes = [], srcs = [];
    const g = ctx.createGain(); g.gain.value = vel; g.connect(bus); nodes.push(g);
    let end = t;
    for (let i = 0; i < B.ratios.length; i++) {
      const d = Math.min(B.decay[i], maxDur || 9);
      const o = ctx.createOscillator();
      const fr = f * B.ratios[i] * (1 + (Math.random() - 0.5) * 0.004);
      o.frequency.setValueAtTime(fr, t);
      if (B.glide) o.frequency.exponentialRampToValueAtTime(fr * B.glide, t + d);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t); og.gain.linearRampToValueAtTime(B.amp[i] / B.ratios.length, t + B.att + 0.002);
      og.gain.exponentialRampToValueAtTime(0.0003, t + d);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + d + 0.02);
      nodes.push(o, og); srcs.push(o);
      end = Math.max(end, t + d + 0.02);
    }
    if (type === 'gong') {
      const n = e.noiseSrc(t, 1.5);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(0.08, t + 0.15); ng.gain.exponentialRampToValueAtTime(0.0003, t + 1.4);
      n.connect(lp); lp.connect(ng); ng.connect(g); nodes.push(n, lp, ng); srcs.push(n);
    }
    track(owner, end, nodes, srcs);
  }

  // ---------------------------------------------------------------- beste üretimi
  const BEAT_OPTS = { 1: [[1]], 2: [[2], [1, 1]], 3: [[3], [2, 1], [1, 1, 1], [1, 2]], 4: [[4], [2, 2], [3, 1], [2, 1, 1]] };
  function genRhythm(rng, groups, density) {
    const out = [];
    const base = density * 2 + 0.2;
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      if (gi < groups.length - 1 && rng.f() < 0.22 * (1 - density)) { out.push(g + groups[gi + 1]); gi++; continue; }
      const opts = BEAT_OPTS[g] || [[g]];
      let tot = 0; const w = opts.map(o => { const x = Math.pow(base, o.length - 1); tot += x; return x; });
      let r = rng.f() * tot, k = 0;
      while (k < w.length - 1 && r > w[k]) { r -= w[k]; k++; }
      out.push(...opts[k]);
    }
    return out;
  }
  function cadRhythm(rng, groups, density) {
    if (groups.length < 2) return [groups[0]];
    const head = groups.slice(0, groups.length - (rng.chance(0.5) ? 2 : 1));
    const tailLen = groups.slice(head.length).reduce((a, b) => a + b, 0);
    return genRhythm(rng, head, density).concat([tailLen]);
  }
  function walk(rng, n, start, lo, hi, bias) {
    const d = [start]; let cur = start, last = 0;
    for (let i = 1; i < n; i++) {
      let step;
      if (Math.abs(last) >= 2) step = -Math.sign(last);
      else {
        const r = rng.f();
        if (r < 0.14) step = rng.pick([2, -2, 3, -3, 4]);
        else if (r < 0.24) step = 0;
        else step = rng.f() < 0.5 + (bias || 0) ? 1 : -1;
      }
      cur += step;
      if (cur > hi) cur = hi - 1; if (cur < lo) cur = lo + 1;
      d.push(cur); last = step;
    }
    return d;
  }

  class Player {
    constructor(e, style, mood, group, seed, t0) {
      this.e = e; this.ctx = e.ctx;
      this.style = mood === 'menu' ? 'menu' : style; this.mood = mood; this.group = group;
      this.rng = Rng(seed);
      this.base = styleSpec(style, mood, group);
      this.voices = []; this.made = 0;
      this.t = t0; this.bars = [];
      this.movement = -1; this.sectionsLeft = 0; this.voice = null;
      this.stopped = false; this.dead = false;
      const ctx = this.ctx;
      this.fader = ctx.createGain(); this.revFader = ctx.createGain();
      this.fader.gain.setValueAtTime(0, ctx.currentTime);
      this.revFader.gain.setValueAtTime(0, ctx.currentTime);
      this.fader.connect(e.musicGain); this.revFader.connect(e.revSend);
      this.bus = {};
      this.newMovement();
    }
    mkBus(name, pan, send) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      let node = g;
      if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
      node.connect(this.fader);
      const s = ctx.createGain(); s.gain.value = send; node.connect(s); s.connect(this.revFader);
      this.bus[name] = { in: g, nodes: [g, node, s], send: s };
      return g;
    }
    setupBuses() {
      const sp = this.sp, rev = sp.rev;
      if (!this.bus.lead) {
        this.mkBus('lead', 0, rev); this.mkBus('acc', 0, rev); this.mkBus('drone', 0, rev * 0.8);
        this.mkBus('drum', 0, rev * 0.45); this.mkBus('perc', 0, rev * 1.2);
      }
      const li = INST[this.lead], ai = this.acc && INST[this.acc.inst];
      const setPan = (b, v) => { const n = this.bus[b].nodes[1]; if (n.pan) n.pan.setTargetAtTime(v, this.t, 0.5); };
      setPan('lead', li.pan || 0); setPan('acc', ai ? -(li.pan || 0) * 1.3 + (ai.pan || 0) * 0.4 : 0);
      for (const b of ['lead', 'acc', 'drone', 'perc']) this.bus[b].send.gain.setTargetAtTime(b === 'perc' ? rev * 1.2 : b === 'drone' ? rev * 0.8 : rev, this.t, 0.5);
      this.bus.drum.send.gain.setTargetAtTime(rev * 0.45, this.t, 0.5);
    }
    fadeIn(t, dur) {
      this.fader.gain.setValueAtTime(0, t); this.fader.gain.linearRampToValueAtTime(1, t + dur);
      this.revFader.gain.setValueAtTime(0, t); this.revFader.gain.linearRampToValueAtTime(1, t + dur);
    }
    stop(t, dur) {
      if (this.stopped) return;
      this.stopped = true;
      for (const g of [this.fader.gain, this.revFader.gain]) {
        if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t); else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
        g.linearRampToValueAtTime(0, t + dur);
      }
      this.killAt = t + dur + 0.1;
    }
    teardown() {
      const now = this.ctx.currentTime;
      for (const v of this.voices) for (const s of v.srcs) { try { s.stop(now); } catch (e) { /* */ } }
      for (const v of this.voices) for (const n of v.nodes) { try { n.disconnect(); } catch (e) { /* */ } }
      this.voices.length = 0;
      for (const k in this.bus) for (const n of this.bus[k].nodes) { try { n.disconnect(); } catch (e) { /* */ } }
      try { this.fader.disconnect(); this.revFader.disconnect(); } catch (e) { /* */ }
      this.dead = true;
    }
    prune(now) {
      const vs = this.voices;
      let j = 0;
      for (let i = 0; i < vs.length; i++) if (vs[i].end > now) vs[j++] = vs[i];
      vs.length = j;
    }

    // -------- yapı: hareket > bölüm > cümle > ölçü
    newMovement() {
      const rng = this.rng;
      this.movement++;
      this.sp = this.base.alt ? this.base.alt[this.movement % this.base.alt.length] : this.base;
      const sp = this.sp;
      let m = rng.pick(sp.modes);
      if (this.modeName && sp.modes.length > 1 && m === this.modeName && rng.chance(0.6)) m = rng.pick(sp.modes);
      this.modeName = m; this.mode = MODES[m].iv;
      this.groups = rng.pick(sp.meters);
      this.steps = this.groups.reduce((a, b) => a + b, 0);
      this.stepDur = rng.range(sp.step[0], sp.step[1]);
      let lead = rng.pick(sp.lead);
      if (lead === this.lead && sp.lead.length > 1 && rng.chance(0.5)) lead = rng.pick(sp.lead);
      this.lead = lead;
      const accs = sp.acc.filter(a => a.pat === 'organum' || a.inst !== lead || a.pat === 'gallop' || a.pat === 'arp' || a.pat === 'tanpura');
      this.acc = accs.length ? rng.pick(accs) : null;
      if (this.acc && this.acc.pat === 'none') this.acc = null;
      this.drumPats = sp.drums ? (sp.drums.pats[this.groups.join('')] || null) : null;
      this.kit = sp.drums ? (sp.drums.kit2 && rng.chance(0.35) ? sp.drums.kit2 : sp.drums.kit) : null;
      this.tonic = sp.tonic + rng.pick([0, 0, 0, -2, 2]);
      this.title = sp.title(m, lead);
      this.sectionsLeft = rng.i(2, 3);
      this.phraseCount = 0;
      this.setupBuses();
      this.freeIntro = rng.chance(sp.free);
    }
    semis(deg) {
      const n = this.mode.length;
      const o = Math.floor(deg / n), i = deg - o * n;
      return o * 12 + this.mode[i];
    }
    leadFreq(deg) { return mtof(this.tonic + INST[this.lead].oct + this.semis(deg)); }
    halfDeg() { return this.mode.length === 7 ? 4 : 3; }

    genMotif(start, density) {
      const rng = this.rng, sp = this.sp;
      const rhy = genRhythm(rng, this.groups, density);
      const rel = walk(rng, rhy.length, 0, sp.range[0] - start, sp.range[1] - start, 0.05);
      // varyasyon ritmi: bir grubu böl veya birleştir
      let rhy2 = rhy.slice();
      const i = rng.i(0, rhy2.length - 1);
      if (rhy2[i] >= 2 && rng.chance(0.6)) { const a = rhy2[i]; rhy2.splice(i, 1, a - 1, 1); }
      else if (i < rhy2.length - 1) { rhy2.splice(i, 2, rhy2[i] + rhy2[i + 1]); }
      return { rhy, rhy2, rel, start, seq: rng.pick([1, -1, 2, 0, 1]) };
    }
    barFrom(rhy, degs, info) {
      const sd = this.stepDur, notes = [];
      let s = 0;
      for (let i = 0; i < rhy.length; i++) {
        notes.push({ o: s * sd, d: rhy[i] * sd, deg: degs[i], step: s, len: rhy[i] });
        s += rhy[i];
      }
      return Object.assign({ dur: this.steps * sd, notes, metric: true, stepDur: sd }, info);
    }
    genPhrase(motif, nb, endTarget, opts) {
      const rng = this.rng, sp = this.sp, [lo, hi] = sp.range;
      const bars = [];
      const cl = d => clamp(d, lo, hi);
      let lastDeg = motif.start;
      const contour = (rhy, startDeg, bias) => walk(rng, rhy.length, cl(startDeg), lo, hi, bias);
      const cadence = (target) => {
        const rhy = cadRhythm(rng, this.groups, sp.density);
        const n = rhy.length;
        const approach = target + (rng.chance(0.65) ? 1 : -1);
        const degs = [];
        for (let i = 0; i < n; i++) {
          if (i === n - 1) degs.push(target);
          else if (i === n - 2) degs.push(approach);
          else { const k = (i + 1) / (n - 1); degs.push(cl(Math.round(lastDeg + (approach - lastDeg) * k + (rng.f() - 0.5)))); }
        }
        return [rhy, degs];
      };
      const half = Math.floor(nb / 2);
      let firstBar = null;
      for (let b = 0; b < nb; b++) {
        let rhy, degs;
        const isLast = b === nb - 1, isHalf = nb === 8 && b === half - 1;
        if (isLast || isHalf) {
          [rhy, degs] = cadence(isLast ? endTarget : this.halfDeg());
        } else if (b === 0 || (nb === 8 && b === half)) {
          if (b > 0 && firstBar) { bars.push(Object.assign({}, firstBar, { phraseStart: false })); lastDeg = firstBar.notes[firstBar.notes.length - 1].deg; continue; }
          rhy = motif.rhy; degs = motif.rel.map(r => cl(motif.start + r));
        } else if (b === 1 || (nb === 8 && b === half + 1)) {
          rhy = motif.rhy2;
          const sh = b === 1 ? motif.seq : -motif.seq;
          degs = rhy.length === motif.rel.length ? motif.rel.map(r => cl(motif.start + sh + r)) : contour(rhy, motif.start + sh, 0.05);
        } else {
          rhy = genRhythm(rng, this.groups, Math.min(1, sp.density + 0.12));
          degs = contour(rhy, lastDeg + (rng.chance(0.5) ? 1 : 0), 0.18);
        }
        lastDeg = degs[degs.length - 1];
        const bar = this.barFrom(rhy, degs, { phraseStart: b === 0, phraseEnd: isLast, pos: b, nb, cad: isLast || isHalf });
        if (b === 0) firstBar = bar;
        bars.push(bar);
      }
      if (opts && opts.quiet) bars.forEach(b => { b.quiet = true; });
      return bars;
    }
    genFree() {
      // serbest ritimli giriş (taksim / rubato)
      const rng = this.rng, sp = this.sp, [lo, hi] = sp.range;
      const notes = []; let o = 0.3, cur = rng.pick([0, 0, 2, -1]);
      const gs = rng.i(2, 4);
      for (let g = 0; g < gs; g++) {
        const n = rng.i(3, 6);
        const target = g === gs - 1 ? 0 : rng.pick([0, 2, this.halfDeg(), 1]);
        const degs = walk(rng, n, cur, lo, hi, target > cur ? 0.25 : -0.15);
        for (const d of degs) { const dur = rng.range(0.13, 0.28); notes.push({ o, d: dur, deg: d, free: true }); o += dur; }
        const long = rng.range(0.9, 1.7);
        notes.push({ o, d: long, deg: target, free: true, long: true });
        o += long + rng.range(0.25, 0.5);
        cur = target;
      }
      return [{ dur: o + 0.2, notes, metric: false, phraseStart: true, phraseEnd: true, free: true, pos: 0, nb: 1 }];
    }
    newSection() {
      const rng = this.rng, sp = this.sp;
      if (this.sectionsLeft <= 0) this.newMovement();
      this.sectionsLeft--;
      const bars = [];
      if (this.freeIntro) { bars.push(...this.genFree()); this.freeIntro = false; }
      const A = this.genMotif(rng.pick([0, 0, 2, this.halfDeg()]), sp.density);
      const B = this.genMotif(rng.pick([this.halfDeg(), 2, 3]), Math.min(1, sp.density + 0.1));
      const form = rng.pick([['A8', 'B', 'A'], ['A', 'A', 'B', 'A'], ['A8', 'A8'], ['A', 'B', 'A8']]);
      let cacheA = null;
      for (const f of form) {
        let ph;
        if (f === 'A8') ph = this.genPhrase(A, 8, 0);
        else if (f === 'A') {
          if (cacheA && rng.chance(0.6)) {
            // tekrar: aynı cümle, kadans yeniden
            ph = cacheA.slice(0, -1).map(b => Object.assign({}, b, { sectionStart: false }));
            const nc = this.genPhrase(A, 4, 0);
            ph.push(nc[nc.length - 1]);
          } else ph = this.genPhrase(A, 4, 0);
          cacheA = ph;
        } else ph = this.genPhrase(B, 4, rng.chance(0.5) ? this.halfDeg() : 0);
        bars.push(...ph);
      }
      // sessiz bir nefes ölçüsü (sadece burdon)
      if (rng.chance(0.3)) bars.push({ dur: this.steps * this.stepDur, notes: [], metric: true, stepDur: this.stepDur, rest: true, pos: 0, nb: 1 });
      bars[0].sectionStart = true;
      const total = bars.reduce((a, b) => a + b.dur, 0);
      bars[0].sectionDur = total;
      this.bars = bars;
    }

    // -------- çalma
    scheduleUntil(tEnd) {
      if (this.stopped) return;
      const now = this.ctx.currentTime;
      if (this.t < now) {
        // sekme uyutuldu: yeniden hizala
        this.t = now + 0.1;
        if (this.voice) { this.voice.end(this.t); this.voice = null; }
        this.bars = [];
      }
      let guard = 0;
      while (this.t < tEnd && guard++ < 64) {
        if (!this.bars.length) this.newSection();
        const bar = this.bars.shift();
        this.playBar(bar, this.t);
        this.t += bar.dur;
      }
    }
    playBar(bar, T) {
      const e = this.e, rng = this.rng, sp = this.sp, li = INST[this.lead];
      const war = this.mood === 'war';
      const busy = this.voices.length;
      if (bar.sectionStart) {
        if (sp.drone) {
          const fr = sp.drone.semis.map(s => mtof(this.tonic + sp.drone.oct + s));
          drone(e, this, this.bus.drone.in, T, bar.sectionDur, fr, sp.drone.kind, sp.drone.vol * 0.32, rng);
        }
        if (sp.extra.bell && rng.chance(sp.extra.bell)) bell(e, this, this.bus.perc.in, T, mtof(this.tonic + 12), 0.16, 'bell');
        if (sp.extra.gong && rng.chance(sp.extra.gong)) bell(e, this, this.bus.perc.in, T, mtof(this.tonic - 12 + rng.pick([0, -5])), 0.3, 'gong');
      }
      if (bar.phraseStart) {
        this.phraseCount++;
        if (war && sp.extra.zill && rng.chance(sp.extra.zill)) bell(e, this, this.bus.perc.in, T, 2700 + rng.range(-150, 150), 0.07, 'zill');
        if (sp.extra.gong && war && rng.chance(sp.extra.gong * 0.5)) bell(e, this, this.bus.perc.in, T, mtof(this.tonic - 12), 0.3, 'gong');
        if (sp.extra.horn && rng.chance(sp.extra.horn) && !bar.free) this.hornCall(T);
      }
      if (bar.rest) return;
      // ---- arch dinamiği
      const arch = bar.nb > 1 ? 0.82 + 0.25 * Math.sin(Math.PI * (bar.pos + 0.5) / bar.nb) : 1;
      const quiet = bar.free ? 0.95 : 1;
      // ---- ana ezgi
      const leg = li.type === 'leg';
      if (leg && (bar.phraseStart || !this.voice)) {
        if (this.voice) this.voice.end(T);
        this.voice = new Legato(e, this, this.bus.lead.in, LEG[li.kind] ? li.kind : 'ney', T, li.gain);
        if (this.acc && this.acc.pat === 'organum') {
          if (this.voice2) this.voice2.end(T);
          this.voice2 = new Legato(e, this, this.bus.acc.in, 'choir', T, li.gain * 0.75);
        }
      }
      const nn = bar.notes.length;
      for (let i = 0; i < nn; i++) {
        const n = bar.notes[i];
        const t = T + n.o;
        const f = this.leadFreq(n.deg);
        const strong = bar.metric ? (n.step === 0 ? 1 : this.isGroupStart(n.step) ? 0.9 : 0.78) : (n.long ? 0.95 : 0.75);
        const v = strong * arch * quiet * rng.range(0.9, 1.04);
        const last = bar.phraseEnd && i === nn - 1;
        let orn = null;
        if (n.d > 0.3 && rng.chance(sp.ornate)) orn = leg ? rng.pick(['turn', 'grace']) : (li.trem && n.d > 0.55 ? 'trem' : li.slide ? 'slide' : 'grace');
        if (leg) {
          const up = this.semis(n.deg + 1) - this.semis(n.deg), dn = this.semis(n.deg) - this.semis(n.deg - 1);
          const d = last ? n.d * 0.92 : n.d;
          this.voice.note(t, f, d, v, { slur: !bar.metric || (i > 0 && rng.chance(0.35)), orn, up, dn, last });
          if (this.voice2) this.voice2.note(t, f * Math.pow(2, -7 / 12), d, v * 0.8, { slur: true, last });
        } else if (busy < MAX_VOICES || n.step === 0) {
          this.pluckNote(li, this.bus.lead.in, t, f, n, v * li.gain, orn);
        }
      }
      if (bar.phraseEnd && this.voice) {
        const ln = bar.notes[nn - 1];
        this.voice.end(T + (ln ? ln.o + ln.d : bar.dur));
        this.voice = null;
        if (this.voice2) { this.voice2.end(T + (ln ? ln.o + ln.d : bar.dur)); this.voice2 = null; }
      }
      // ---- eşlik
      if (this.acc && bar.metric && this.voices.length < MAX_VOICES) this.playAcc(bar, T, arch);
      // ---- vurmalılar
      if (this.drumPats && bar.metric && !bar.quiet) {
        const from = sp.drums.from || 0;
        if (this.phraseCount > from || war) {
          let pat = this.drumPats[(bar.pos + (rng.chance(0.25) ? 1 : 0)) % this.drumPats.length];
          if (bar.phraseEnd && war) pat = pat.slice(0, pat.length - 3) + 'kTT';
          const dv = sp.drums.vol * (war ? 1 : 0.7) * (0.85 + 0.15 * arch);
          const tonicF = mtof(this.tonic);
          for (let s = 0; s < pat.length && s < this.steps; s++) {
            const ch = pat[s];
            if (ch === '.') continue;
            if (this.voices.length > MAX_VOICES + 10) break;
            const sw = !war && s % 2 === 1 ? bar.stepDur * 0.06 : 0;
            drumHit(e, this, this.bus.drum.in, T + s * bar.stepDur + sw, this.kit, ch, dv * (s === 0 ? 1 : 0.85) * rng.range(0.88, 1.05), tonicF);
          }
        }
      }
    }
    isGroupStart(step) { let s = 0; for (const g of this.groups) { if (s === step) return true; s += g; } return false; }
    pluckNote(inst, bus, t, f, n, v, orn) {
      const e = this.e;
      if (orn === 'trem') {
        const rate = 0.075, cnt = Math.min(12, Math.floor(n.d * 0.85 / rate));
        for (let k = 0; k < cnt; k++) playPluck(e, this, bus, t + k * rate, f, v * (k === 0 ? 1 : k % 2 ? 0.55 : 0.7), inst, { stop: rate + 0.03 });
        playPluck(e, this, bus, t + cnt * rate, f, v * 0.6, inst, { stop: Math.max(0.15, n.d - cnt * rate) });
        return;
      }
      if (orn === 'grace') {
        const up = f * Math.pow(2, 2 / 12);
        playPluck(e, this, bus, t, up, v * 0.6, inst, { stop: 0.08 });
        t += 0.07;
      }
      const stop = n.free && !n.long ? n.d + 0.1 : n.d + 0.6;
      playPluck(e, this, bus, t, f, v, inst, { stop, slide: orn === 'slide' ? 2 : 0 });
    }
    playAcc(bar, T, arch) {
      const e = this.e, rng = this.rng, a = this.acc, inst = INST[a.inst];
      if (a.pat === 'organum') return;
      const bus = this.bus.acc.in, sd = bar.stepDur;
      const base = this.tonic + inst.oct + (a.oct || 0);
      const v = inst.gain * 0.55 * arch;
      const third = this.mode.length === 7 ? this.mode[2] : this.mode[1];
      switch (a.pat) {
        case 'drone': {
          let s = 0, gi = 0;
          for (const g of this.groups) {
            const semi = gi % 2 === 0 ? 0 : 7;
            playPluck(e, this, bus, T + s * sd, mtof(base + semi), v * (gi === 0 ? 1 : 0.75), inst, { stop: g * sd + 0.15 });
            if (this.mood === 'war' && g >= 2) playPluck(e, this, bus, T + (s + 1) * sd, mtof(base), v * 0.5, inst, { stop: sd });
            s += g; gi++;
          }
          break;
        }
        case 'hetero': {
          for (const n of bar.notes) {
            if (!this.isGroupStart(n.step)) continue;
            playPluck(e, this, bus, T + n.o + 0.012, mtof(base + this.semis(n.deg)), v * 0.85, inst, { stop: n.d + 0.3 });
          }
          break;
        }
        case 'arp': {
          const ch = [0, 7, 12, third + 12];
          const k = rng.chance(0.5) ? 3 : 4;
          for (let i = 0; i < k; i++) playPluck(e, this, bus, T + i * 0.045, mtof(base + ch[i]), v * (1 - i * 0.12), inst);
          if (this.steps >= 6 && rng.chance(0.55)) {
            const mid = Math.floor(this.steps / 2) * sd;
            playPluck(e, this, bus, T + mid, mtof(base + 7), v * 0.7, inst);
            playPluck(e, this, bus, T + mid + 0.05, mtof(base + 12), v * 0.6, inst);
          }
          break;
        }
        case 'tanpura': {
          const seq = [7, 12, 12, 0];
          for (let i = 0; i < 4; i++) playPluck(e, this, bus, T + i * bar.dur / 4, mtof(base + seq[i] - (i === 0 ? 12 : 0)), v * 0.8, inst);
          break;
        }
        case 'gallop': {
          let s = 0;
          for (const g of this.groups) {
            const t0 = T + s * sd;
            playPluck(e, this, bus, t0, mtof(base), v, inst, { stop: sd * 1.2 });
            playPluck(e, this, bus, t0 + 0.018, mtof(base + 7), v * 0.8, inst, { stop: sd * 1.2 });
            if (g === 3) playPluck(e, this, bus, t0 + 2 * sd, mtof(base + 12), v * 0.55, inst, { stop: sd });
            s += g;
          }
          break;
        }
      }
    }
    hornCall(T) {
      // boru/boynuz çağrısı: tonik–beşli–tonik
      const e = this.e;
      const h = new Legato(e, this, this.bus.perc.in, 'horn', T, 0.16);
      const b = this.tonic - 12;
      const sd = this.stepDur;
      const seq = [[0, 2], [7, 2], [0, 4]];
      let t = T;
      seq.forEach((s, i) => { h.note(t, mtof(b + s[0]), s[1] * sd, 0.9, { last: i === seq.length - 1 }); t += s[1] * sd; });
      h.end(t);
    }
  }

  // ---------------------------------------------------------------- SFX
  const SFX = {
    click(e, o, t) {
      const ctx = e.ctx, bus = e.sfxGain;
      const n = e.noiseSrc(t, 0.05);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 4;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.035);
      n.connect(f); f.connect(g); g.connect(bus);
      const s = ctx.createOscillator(); s.frequency.value = 950;
      const sg = ctx.createGain(); sg.gain.setValueAtTime(0.18, t); sg.gain.exponentialRampToValueAtTime(0.0005, t + 0.045);
      s.connect(sg); sg.connect(bus); s.start(t); s.stop(t + 0.06);
      track(o, t + 0.1, [n, f, g, s, sg], [n, s]);
    },
    battle(e, o, t) {
      const bus = e.sfxGain;
      for (let i = 0; i < 9; i++) {
        const dt = 0.5 * (1 - Math.pow(0.82, i)) / (1 - 0.82) * 0.17;
        drumHit(e, o, bus, t + dt, 'davul', i % 3 === 2 ? 'T' : 'D', 0.5 + i * 0.05);
      }
      const h = new Legato(e, o, bus, 'horn', t + 0.55, 0.3);
      h.note(t + 0.55, mtof(45), 0.35, 1, {}); h.note(t + 0.9, mtof(52), 0.8, 1, { last: true });
      h.end(t + 1.75);
    },
    victory(e, o, t) {
      const bus = e.sfxGain;
      const h = new Legato(e, o, bus, 'horn', t, 0.24);
      const seq = [[57, 0.16], [61, 0.16], [64, 0.16], [69, 0.7]];
      let tt = t;
      seq.forEach((s, i) => { h.note(tt, mtof(s[0] - 12), s[1], 1, { last: i === seq.length - 1 }); tt += s[1]; });
      h.end(tt);
      const p = INST.psaltery;
      [69, 73, 76, 81].forEach((m, i) => playPluck(e, o, bus, t + 0.48 + i * 0.04, mtof(m), 0.18, p));
      bell(e, o, bus, t + 0.48, 2900, 0.05, 'zill', 1.0);
      drumHit(e, o, bus, t + 0.48, 'davul', 'D', 0.7);
    },
    defeat(e, o, t) {
      const bus = e.sfxGain;
      const h = new Legato(e, o, bus, 'horn', t, 0.22);
      const seq = [[52, 0.45], [51, 0.45], [48, 0.85]];
      let tt = t;
      seq.forEach((s, i) => { h.note(tt, mtof(s[0] - 12), s[1], 0.8, { slur: i > 0, last: i === seq.length - 1 }); tt += s[1]; });
      h.end(tt);
      drumHit(e, o, bus, t, 'davul', 'D', 0.6);
      drumHit(e, o, bus, t + 0.9, 'davul', 'D', 0.45);
    },
    event(e, o, t) {
      bell(e, o, e.sfxGain, t, 523, 0.3, 'bell', 1.9);
      bell(e, o, e.sfxGain, t + 0.18, 784, 0.12, 'bell', 1.6);
    },
    build(e, o, t) {
      const ctx = e.ctx, bus = e.sfxGain;
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.24;
        const s = ctx.createOscillator(); s.frequency.setValueAtTime(260, tt); s.frequency.exponentialRampToValueAtTime(140, tt + 0.05);
        const sg = ctx.createGain(); sg.gain.setValueAtTime(0.45, tt); sg.gain.exponentialRampToValueAtTime(0.0005, tt + 0.12);
        s.connect(sg); sg.connect(bus); s.start(tt); s.stop(tt + 0.14);
        const n = e.noiseSrc(tt, 0.08);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3100; f.Q.value = 6;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.7, tt); g.gain.exponentialRampToValueAtTime(0.0005, tt + 0.07);
        n.connect(f); f.connect(g); g.connect(bus);
        track(o, tt + 0.2, [s, sg, n, f, g], [s, n]);
        bell(e, o, bus, tt + 0.002, 2300 + i * 90, 0.025, 'zill', 0.25);
      }
    },
    siege(e, o, t) {
      const ctx = e.ctx, bus = e.sfxGain;
      const s = ctx.createOscillator(); s.frequency.setValueAtTime(95, t); s.frequency.exponentialRampToValueAtTime(38, t + 0.35);
      const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.linearRampToValueAtTime(1.0, t + 0.01); sg.gain.exponentialRampToValueAtTime(0.0005, t + 1.1);
      s.connect(sg); sg.connect(bus); s.start(t); s.stop(t + 1.15);
      const n = e.noiseSrc(t, 1.0);
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(150, t + 0.8);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.9);
      n.connect(f); f.connect(g); g.connect(bus);
      track(o, t + 1.2, [s, sg, n, f, g], [s, n]);
    },
    naval(e, o, t) {
      const h = new Legato(e, o, e.sfxGain, 'horn', t, 0.3);
      h.note(t, mtof(38), 0.5, 0.9, {}); h.note(t + 0.5, mtof(43), 0.9, 1, { slur: true, last: true });
      h.end(t + 1.5);
      const n = e.noiseSrc(t, 1.6);
      const ctx = e.ctx;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.5); g.gain.linearRampToValueAtTime(0.0001, t + 1.6);
      n.connect(f); f.connect(g); g.connect(e.sfxGain);
      track(o, t + 1.7, [n, f, g], [n]);
    },
  };

  // ---------------------------------------------------------------- genel arayüz
  const st = { vol: 0.6, sfx: 0.7, muted: false };
  try {
    const raw = window.localStorage && window.localStorage.getItem(STORE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (typeof o.vol === 'number') st.vol = clamp(o.vol, 0, 1);
      if (typeof o.sfx === 'number') st.sfx = clamp(o.sfx, 0, 1);
      if (typeof o.muted === 'boolean') st.muted = o.muted;
    }
  } catch (e) { /* depolama yok */ }
  function save() { try { window.localStorage.setItem(STORE_KEY, JSON.stringify(st)); } catch (e) { /* */ } }

  let ctx = null, eng = null, timer = null, cur = null, unlockBound = false, suspendTimer = null;
  const fading = [];
  const sfxOwner = { voices: [], made: 0 };
  const want = { mood: 'menu', group: 'latin' };
  const lastSfx = {};

  const curve = v => v * v;
  function applyVol(e, ramp) {
    if (!e) return;
    const t = e.ctx.currentTime;
    e.musicGain.gain.setTargetAtTime(curve(st.vol), t, ramp ? 0.08 : 0.001);
    e.sfxGain.gain.setTargetAtTime(curve(st.sfx) * 1.3, t, ramp ? 0.05 : 0.001);
  }
  function keyOf(mood, group) {
    const style = resolveStyle(group);
    if (mood === 'menu') return 'menu';
    const variant = (style === 'islam' && (group === 'iran' || group === 'hint')) || (style === 'kuzey' && ['kelt', 'slav', 'anglosakson'].indexOf(group) >= 0) ? group : '';
    return style + '|' + mood + '|' + variant;
  }
  function startPlayer() {
    if (!eng) return;
    const t = ctx.currentTime;
    const style = resolveStyle(want.group);
    const old = cur;
    let t0 = t + 0.15;
    if (old) { old.stop(t, FADE_OUT); fading.push(old); t0 = t + 1.2; }
    cur = new Player(eng, style, want.mood, want.group, (Math.random() * 1e9) | 0, t0);
    cur.key = keyOf(want.mood, want.group);
    cur.fadeIn(t0, old ? FADE_IN : 1.5);
    cur.scheduleUntil(t + LOOKAHEAD);
  }
  function tick() {
    try {
      if (!ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (cur) { cur.scheduleUntil(now + LOOKAHEAD); cur.prune(now); }
      for (let i = fading.length - 1; i >= 0; i--) {
        const p = fading[i];
        p.prune(now);
        if (now > p.killAt) { p.teardown(); fading.splice(i, 1); }
      }
      pruneOwner(sfxOwner, now);
    } catch (err) {
      if (window.console) console.warn('müzik:', err);
    }
  }
  function pruneOwner(o, now) {
    const vs = o.voices; let j = 0;
    for (let i = 0; i < vs.length; i++) if (vs[i].end > now) vs[j++] = vs[i];
    vs.length = j;
  }
  function bindUnlock() {
    if (unlockBound || typeof document === 'undefined') return;
    unlockBound = true;
    const h = () => {
      if (ctx && ctx.state === 'suspended' && !st.muted) { try { ctx.resume(); } catch (e) { /* */ } }
      if (ctx && ctx.state === 'running') {
        document.removeEventListener('pointerdown', h, true); document.removeEventListener('keydown', h, true);
      }
    };
    document.addEventListener('pointerdown', h, true);
    document.addEventListener('keydown', h, true);
  }

  const M = {
    start() {
      try {
        if (!AC) return false;
        if (!ctx) {
          try { ctx = new AC({ latencyHint: 'playback' }); } catch (e) { ctx = new AC(); }
          eng = new Engine(ctx);
          applyVol(eng, false);
          eng.master.gain.value = st.muted ? 0 : 1;
          bindUnlock();
        }
        if (!st.muted && ctx.state === 'suspended') { const p = ctx.resume(); if (p && p.catch) p.catch(() => { }); }
        if (st.muted && ctx.state === 'running') { const p = ctx.suspend(); if (p && p.catch) p.catch(() => { }); }
        if (!timer) timer = setInterval(tick, TICK_MS);
        if (!cur) startPlayer();
        return true;
      } catch (e) {
        if (window.console) console.warn('müzik başlatılamadı:', e);
        return false;
      }
    },
    setMood(mood, group) {
      try {
        if (mood !== 'menu' && mood !== 'peace' && mood !== 'war') mood = 'peace';
        if (group == null) group = want.group;
        want.mood = mood; want.group = group;
        if (!eng) return;
        if (cur && cur.key === keyOf(mood, group)) return;
        startPlayer();
      } catch (e) { if (window.console) console.warn('müzik:', e); }
    },
    setVolume(v) { st.vol = clamp(+v || 0, 0, 1); save(); try { applyVol(eng, true); } catch (e) { /* */ } },
    setSfxVolume(v) { st.sfx = clamp(+v || 0, 0, 1); save(); try { applyVol(eng, true); } catch (e) { /* */ } },
    volume() { return st.vol; },
    sfxVolume() { return st.sfx; },
    isMuted() { return st.muted; },
    mute(b) {
      st.muted = !!b; save();
      try {
        if (!ctx) return;
        const t = ctx.currentTime;
        clearTimeout(suspendTimer);
        eng.master.gain.cancelScheduledValues(t);
        eng.master.gain.setValueAtTime(eng.master.gain.value, t);
        if (st.muted) {
          eng.master.gain.linearRampToValueAtTime(0, t + 0.3);
          suspendTimer = setTimeout(() => { try { if (st.muted && ctx.state === 'running') ctx.suspend(); } catch (e) { /* */ } }, 450);
        } else {
          const p = ctx.state === 'suspended' ? ctx.resume() : null;
          const up = () => { const tt = ctx.currentTime; eng.master.gain.cancelScheduledValues(tt); eng.master.gain.setValueAtTime(0, tt); eng.master.gain.linearRampToValueAtTime(1, tt + 0.5); };
          if (p && p.then) p.then(up, () => { }); else up();
        }
      } catch (e) { /* */ }
    },
    toggle() { M.mute(!st.muted); return st.muted; },
    sfx(name) {
      try {
        if (!eng || st.muted || ctx.state !== 'running' || !SFX[name] || st.sfx <= 0) return;
        const now = ctx.currentTime;
        if (lastSfx[name] && now - lastSfx[name] < (name === 'click' ? 0.05 : 0.25)) return;
        if (sfxOwner.voices.length > 60) return;
        lastSfx[name] = now;
        SFX[name](eng, sfxOwner, now + 0.01);
      } catch (e) { /* */ }
    },
    nowPlaying() { return cur ? cur.title : ''; },
    mood() { return want.mood; },
    styleOf: resolveStyle,
    available() { return !!AC; },

    // --- test / çevrimdışı işleme
    _stats() {
      return {
        ctx: ctx ? ctx.state : 'none', players: (cur ? 1 : 0) + fading.length,
        voices: (cur ? cur.voices.length : 0) + fading.reduce((a, p) => a + p.voices.length, 0),
        sfxVoices: sfxOwner.voices.length, ksCache: ksCache.size, key: cur ? cur.key : null,
      };
    },
    // Aynı grafiği OfflineAudioContext üzerinde çalıştırır. Planlayıcı gerçek zamanlıdaki gibi
    // her 'step' saniyede bir (suspend/resume ile) çalışır. Promise<AudioBuffer> döner;
    // buffer._stats içinde ses kayıt istatistikleri bulunur.
    _renderOffline(style, mood, seconds, opts) {
      opts = opts || {};
      if (!OAC) return Promise.reject(new Error('OfflineAudioContext yok'));
      const sr = opts.sampleRate || 44100;
      const oc = new OAC(2, Math.ceil(sr * seconds), sr);
      const e = new Engine(oc);
      e.musicGain.gain.value = curve(opts.vol != null ? opts.vol : 0.75);
      e.sfxGain.gain.value = curve(opts.sfx != null ? opts.sfx : 0.7) * 1.3;
      const group = opts.group || style;
      const st2 = resolveStyle(style);
      const p = new Player(e, st2, mood, group, opts.seed != null ? opts.seed : 1234, 0.05);
      p.fadeIn(0, 0.4);
      const stats = { maxVoices: 0, made: 0, titles: [], samples: [] };
      const step = opts.step || 0.5;
      let second = null;
      const tickAt = t => {
        const pl = second && t >= second.at ? second.p : p;
        if (second && t >= second.at && !p.stopped) { p.stop(t, FADE_OUT); }
        for (const q of second && t >= second.at ? [p, second.p] : [p]) {
          if (!q.dead) {
            q.scheduleUntil(t + LOOKAHEAD);
            q.prune(t);
            if (q.stopped && t > q.killAt) q.teardown();
          }
        }
        const v = p.voices.length + (second ? second.p.voices.length : 0);
        stats.maxVoices = Math.max(stats.maxVoices, v);
        if (Math.abs(t % 10) < step / 2) stats.samples.push(v);
        if (stats.titles[stats.titles.length - 1] !== pl.title) stats.titles.push(pl.title);
        if (opts.sfxAt) for (const s of opts.sfxAt) if (s[0] >= t && s[0] < t + step) SFX[s[1]](e, sfxOwner2, s[0]);
      };
      const sfxOwner2 = { voices: [], made: 0 };
      if (opts.switchTo) {
        // geçiş testi: belirli anda başka üsluba çapraz geçiş
        const at = opts.switchTo.at;
        const p2 = new Player(e, resolveStyle(opts.switchTo.style), opts.switchTo.mood, opts.switchTo.group || opts.switchTo.style, 99, at + 1.2);
        p2.fadeIn(at + 1.2, FADE_IN);
        second = { at, p: p2 };
      }
      tickAt(0);
      for (let t = step; t < seconds; t += step) {
        const tt = Math.round(t * 1000) / 1000;
        oc.suspend(tt).then(() => { try { tickAt(tt); } catch (err) { stats.error = String(err && err.stack || err); } oc.resume(); });
      }
      return oc.startRendering().then(buf => {
        stats.made = p.made + (second ? second.p.made : 0);
        stats.finalVoices = p.voices.length + (second ? second.p.voices.length : 0);
        stats.title = p.title;
        buf._stats = stats;
        return buf;
      });
    },
    _styles: STYLES,
    _groups: Object.keys(GROUP_STYLE),
  };

  NS.music = M;
})();
