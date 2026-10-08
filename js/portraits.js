// Hükümdar ve komutan portreleri: ortaçağ ikon / minyatür üslubunda,
// tohumdan (seed) belirlenimli olarak üretilen satır içi SVG.
// Kullanım: G.portrait.svg({ seed, group, kind, color, religion, age, frame, size })
//           G.portrait.ruler(tag), G.portrait.leader(leaderObj, tag, kind)
'use strict';

(function (G) {
  const OL = '#2a1a0e';          // koyu kontur
  const GOLD = '#d6a84a', GOLD_L = '#f4dc8a', GOLD_D = '#8a6420';
  const LIP = '#a9503f';

  // ---- Belirlenimli rastgelelik ----
  function hashStr(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = h << 13 | h >>> 19;
    }
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function mkRng(seed) {
    let a = seed >>> 0;
    return () => {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---- Renk yardımcıları ----
  function rgb(h) {
    h = String(h || '#888888').replace('#', '');
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    const n = parseInt(h, 16) || 0;
    return [n >> 16 & 255, n >> 8 & 255, n & 255];
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const shade = (c, f) => f < 0 ? mix(c, '#000000', -f) : mix(c, '#ffffff', f);
  const lum = c => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
  const reddish = c => { const [r, g, b] = rgb(c); return r > 120 && r > g * 1.5 && r > b * 1.4; };

  // ---- SVG parçaları ----
  // Kontur rengi kök <g> üzerinden miras alınır; yalnızca kalınlık yazılır.
  const sk = (sw, x) => sw ? ` stroke-width="${sw}"` : x.includes(' stroke=') ? '' : ' stroke="none"';
  const P = (d, f, sw = 0.9, x = '') => `<path d="${d}" fill="${f}"${sk(sw, x)}${x}/>`;
  const C = (x, y, r, f, sw = 0.6, x2 = '') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"${sk(sw, x2)}${x2}/>`;
  const L = (d, s, w, x = '') => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w}"${x}/>`;
  const gem = (x, y, r, col) => C(x, y, r, col, 0.5) + (r >= 1.5 ? C(x - r * 0.3, y - r * 0.3, r * 0.35, '#fff8', 0) : '');
  // inci dizisi: yuvarlak uçlu kesik çizgi
  const pearls = (d, gap = 3.4, w = 2.5) => L(d, OL, w + 0.8, ` stroke-dasharray="0 ${gap}"`) + L(d, '#f4efe2', w, ` stroke-dasharray="0 ${gap}"`);
  const GEMS = ['#b3202a', '#1f6e4a', '#2a4fa0', '#b3202a'];

  // ---- Kültür grupları ----
  // skin: ten tonları, hair: saç renkleri, beard: [stil, ağırlık], must: bıyık
  const GROUPS = {
    turk_bozkir: { skin: ['#e9c49a', '#dfb487', '#d6a97b'], hair: ['#1c140e', '#2c1e12', '#3b2a18'],
      beard: [['none', 3], ['goatee', 4], ['short', 2]], must: ['droopy', 'droopy', 'thin'], eye: 'narrow', hairStyle: 'braids', art: 'persian' },
    turk_yerlesik: { skin: ['#e6c09a', '#dcb38a', '#d2a77e'], hair: ['#1c140e', '#2c1e12'],
      beard: [['short', 3], ['goatee', 3], ['full', 2]], must: ['droopy', 'full', 'thin'], eye: 'narrow', hairStyle: 'short', art: 'persian' },
    iran: { skin: ['#e4bc94', '#d9ae86', '#cfa27a'], hair: ['#1a120c', '#2a1c12', '#3a2614'],
      beard: [['full', 5], ['long', 3], ['short', 2]], must: ['full', 'full', 'curl'], eye: 'almond', hairStyle: 'long', art: 'persian' },
    arap: { skin: ['#d9ae84', '#cc9f76', '#be8f68', '#e0b893'], hair: ['#16100b', '#24180f'],
      beard: [['full', 4], ['long', 4], ['short', 2]], must: ['full', 'thin'], eye: 'almond', hairStyle: 'short', art: 'persian' },
    berberi: { skin: ['#d4a87e', '#c49470', '#b48462', '#dcb48c'], hair: ['#16100b', '#24180f'],
      beard: [['short', 4], ['full', 3], ['goatee', 2]], must: ['full', 'thin'], eye: 'almond', hairStyle: 'short', art: 'persian' },
    bizans: { skin: ['#efcfac', '#e6c19c', '#dcb48e'], hair: ['#2a1a10', '#3d2716', '#4a3020', '#1e140c'],
      beard: [['full', 4], ['forked', 3], ['short', 2], ['long', 2]], must: ['full', 'thin'], eye: 'icon', hairStyle: 'curly', art: 'icon' },
    latin: { skin: ['#f3d6b8', '#eccaa8', '#e5bf9c'], hair: ['#5a3a1e', '#7a4e26', '#3b2616', '#a0702e', '#c9a050'],
      beard: [['none', 3], ['short', 4], ['full', 3], ['forked', 1]], must: ['none', 'thin', 'full'], eye: 'almond', hairStyle: 'bob', art: 'icon' },
    iskandinav: { skin: ['#f5dcc4', '#efd2b6', '#ead0b0'], hair: ['#c9a050', '#d8b469', '#9a6a34', '#b5622f', '#e1c58a'],
      beard: [['braided', 4], ['full', 3], ['long', 2]], must: ['full', 'droopy'], eye: 'almond', hairStyle: 'long', art: 'icon' },
    kelt: { skin: ['#f6dcc6', '#f0d2ba', '#ecccb0'], hair: ['#b5522a', '#8a3e1e', '#c9a050', '#4a2e1a'],
      beard: [['none', 2], ['short', 3], ['full', 3], ['forked', 2]], must: ['droopy', 'full', 'thin'], eye: 'almond', hairStyle: 'long', art: 'icon' },
    anglosakson: { skin: ['#f4d8bf', '#eecfb2', '#e8c6a6'], hair: ['#c9a050', '#9a6a34', '#6a4422', '#d8b469'],
      beard: [['none', 2], ['short', 3], ['forked', 3], ['full', 2]], must: ['droopy', 'full'], eye: 'almond', hairStyle: 'bob', art: 'icon' },
    slav: { skin: ['#f1d4b6', '#eaccac', '#e3c3a2'], hair: ['#7a5230', '#5a3a1e', '#9a6a34', '#3b2616'],
      beard: [['full', 4], ['long', 3], ['short', 2]], must: ['droopy', 'full'], eye: 'almond', hairStyle: 'bob', art: 'icon' },
    kafkas: { skin: ['#e8c6a2', '#dfba94', '#d5ae88'], hair: ['#1c140e', '#2c1e12', '#3d2716'],
      beard: [['full', 4], ['short', 3], ['long', 2]], must: ['full', 'curl'], eye: 'icon', hairStyle: 'curly', art: 'icon' },
    hint: { skin: ['#c08e64', '#b07e56', '#9e6e4a', '#cf9e74'], hair: ['#120c08', '#1c140e'],
      beard: [['none', 5], ['short', 2], ['goatee', 1]], must: ['curl', 'thin', 'full'], eye: 'almond', hairStyle: 'long', art: 'india' },
    cin: { skin: ['#efd2ad', '#e8c8a0', '#e2c098'], hair: ['#100c0a', '#1a1410'],
      beard: [['goatee', 4], ['long', 3], ['none', 2]], must: ['thin', 'droopy'], eye: 'east', hairStyle: 'short', art: 'silk' },
    dogu_asya: { skin: ['#ecd0ac', '#e4c59e', '#dcbb94'], hair: ['#100c0a', '#1a1410'],
      beard: [['goatee', 4], ['none', 3], ['short', 1]], must: ['thin', 'droopy'], eye: 'east', hairStyle: 'short', art: 'silk' },
    gdasya: { skin: ['#c99a6c', '#bb8c60', '#ad7e56', '#d4a678'], hair: ['#120c08', '#1c140e'],
      beard: [['none', 6], ['goatee', 1]], must: ['none', 'thin'], eye: 'almond', hairStyle: 'long', art: 'india' },
    afrika: { skin: ['#7a4e30', '#6a4228', '#5a3620', '#8a5a38'], hair: ['#0e0a08', '#1a1410'],
      beard: [['short', 4], ['none', 2], ['full', 2]], must: ['thin', 'full'], eye: 'almond', hairStyle: 'short', art: 'icon' },
  };
  const SUBS = { JAP: 'jp', GOR: 'kr', TIB: 'tib', GUG: 'tib', TSO: 'tib', DAL: 'dali', DAI: 'vn' };
  const MUSLIM = { sunni: 1, sii: 1, ibadi: 1, bergvata: 1 };
  const CHRIST = { katolik: 1, ortodoks: 1, miafizit: 1, nesturi: 1 };
  const DHARMA = { budist: 1, hindu: 1 };

  function wpick(r, arr) {
    let tot = 0; for (const a of arr) tot += a[1];
    let x = r() * tot;
    for (const a of arr) { x -= a[1]; if (x < 0) return a[0]; }
    return arr[0][0];
  }

  // ================== YÜZ ==================
  function face(c) {
    const { fw, ey, chin, skin, skinD } = c;
    const l = 50 - fw, r = 50 + fw;
    let s = '';
    // kulaklar
    if (c.ears) for (const k of [-1, 1]) {
      s += `<ellipse cx="${50 + k * (fw + 0.3)}" cy="${ey + 3}" rx="2.4" ry="4.4" fill="${skinD}" stroke-width=".7"/>`;
      if (c.earring) s += C(50 + k * (fw + 0.6), ey + 9, 1.8, GOLD, 0.5) + C(50 + k * (fw + 0.6), ey + 12.5, 1.1, '#b3202a', 0.4);
    }
    s += P(`M${l},50C${l},${32 + c.r0} ${r},${32 + c.r0} ${r},50C${r},64 ${50 + fw * 0.62},${chin - 3} 50,${chin}C${50 - fw * 0.62},${chin - 3} ${l},64 ${l},50Z`, skin, 1);
    // ikon gölgesi (sağ yan) ve yanak
    s += P(`M${r - 4},44C${r + 0.5},52 ${r},64 ${53},${chin - 0.6}C${r - 4},68 ${r - 3},56 ${r - 4},44Z`, skinD, 0, ' opacity=".55"');
    s += `<g fill="#d4705a" opacity=".28" stroke="none"><ellipse cx="${50 - fw + 6}" cy="${ey + 9}" rx="3.6" ry="2.3"/><ellipse cx="${50 + fw - 6}" cy="${ey + 9}" rx="3.6" ry="2.3"/></g>`;
    // kaşlar
    const by = ey - 4.6, es = c.es, ew = c.ew;
    for (const k of [-1, 1])
      s += L(`M${50 + k * 2.6},${by + 1.2}Q${50 + k * es},${by - 2.6 + c.browArch} ${50 + k * (es + ew + 1)},${by + 1.4}`, c.brow, c.small ? 1.9 : 1.3);
    // gözler
    const eh = c.eh;
    for (const k of [-1, 1]) {
      const cx = 50 + k * es, oy = c.eye === 'east' || c.eye === 'narrow' ? -0.7 : 0;
      const ix = 50 + k * (es - ew), ox = 50 + k * (es + ew);
      s += P(`M${ix},${ey}Q${cx},${ey - 2 * eh} ${ox},${ey + oy}Q${cx},${ey + 1.5 * eh} ${ix},${ey}Z`, '#f2e8d4', 0.5);
      s += C(cx + c.gaze, ey - 0.15, f(eh * 0.78), '#2b1a10', 0);
      s += C(cx + c.gaze - 0.5, ey - 0.7, 0.45, '#fff', 0);
      s += L(`M${ix - k * 0.4},${ey + 0.2}Q${cx},${ey - 2.1 * eh} ${ox + k * 0.4},${ey + oy - 0.2}`, OL, c.small ? 1.8 : 1.15);
      if (c.eye !== 'east' && c.eye !== 'narrow') s += L(`M${50 + k * (es - ew * 0.6)},${ey - eh - 1.3}Q${cx},${ey - 2 * eh - 1.6} ${50 + k * (es + ew * 0.8)},${ey - eh - 0.9}`, shade(skinD, -0.2), 0.6);
      if (c.age === 'old') s += L(`M${50 + k * (es - ew * 0.5)},${ey + 2.6}Q${cx},${ey + 3.8} ${50 + k * (es + ew * 0.7)},${ey + 2.2}`, shade(skinD, -0.25), 0.55)
        + L(`M${50 + k * (es + ew + 1.2)},${ey - 0.5}l${k * 1.8},-.8M${50 + k * (es + ew + 1.2)},${ey + 1}l${k * 1.8},.6`, shade(skinD, -0.25), 0.5);
    }
    // burun (uzun ikon burnu)
    const nb = ey + c.nl;
    s += L(`M${48.4},${ey - 1.5}C${48},${ey + 4} ${47},${nb - 3} ${46.6},${nb - 0.6}Q${47.6},${nb + 1.8} ${50},${nb + 1}Q${52.4},${nb + 1.8} ${53.2},${nb - 0.8}`, OL, c.small ? 1.3 : 0.8);
    s += L(`M51.6,${ey - 1}C${52.2},${ey + 4} ${52.5},${nb - 4} ${52.6},${nb - 2}`, shade(skin, 0.35), 0.9, ' opacity=".8"');
    if (c.age === 'old') {
      s += L(`M${50 - 4.8},${nb + 1}Q${50 - 6.8},${c.my} ${50 - 5.6},${c.my + 3.5}M${50 + 4.8},${nb + 1}Q${50 + 6.8},${c.my} ${50 + 5.6},${c.my + 3.5}`, shade(skinD, -0.25), 0.6);
      s += L(`M45,${by - 3.5}Q50,${by - 4.6} 55,${by - 3.5}M46,${by - 1.8}Q50,${by - 2.8} 54,${by - 1.8}`, shade(skinD, -0.2), 0.5);
    }
    return s;
  }

  function mouth(c) {
    const my = c.my, w = c.mw;
    return P(`M${50 - w + 1},${my + 0.4}Q50,${my + 3.2} ${50 + w - 1},${my + 0.4}Z`, LIP, 0)
      + L(`M${50 - w},${my}Q${50 - 1.5},${my - 1.1} 50,${my - 0.4}Q${50 + 1.5},${my - 1.1} ${50 + w},${my}`, '#5a2216', c.small ? 1.4 : 0.9);
  }

  function beard(c) {
    const { fw, ey, chin, my, hair } = c;
    const st = c.beard; if (st === 'none') return '';
    if (st === 'goatee')
      return P(`M${46},${my + 2.6}Q50,${my + 4.6} ${54},${my + 2.6}Q${54.5},${chin + 3} 50,${chin + 5 + c.bl}Q${45.5},${chin + 3} ${46},${my + 2.6}Z`, hair, 0.7);
    const L0 = 50 - fw + 0.2, R0 = 50 + fw - 0.2;
    const len = { short: 2, full: 8, long: 16, forked: 12, braided: 9 }[st] + c.bl;
    const bot = chin + len;
    const lx = 50 - fw * 0.5, rx = 50 + fw * 0.5;
    const tip = st === 'forked'
      ? `C47.5,${bot - 1.5} 46.5,${bot} 45.5,${bot}L50,${bot - 5}L54.5,${bot}C53.5,${bot} 52.5,${bot - 1.5} ${rx},${bot - 3}`
      : `Q50,${bot + 2.5} ${rx},${bot - 3}`;
    let s = P(`M${L0},${ey + 1}C${L0 - 0.5},${ey + 14} ${50 - fw * 0.85},${bot - 7} ${lx},${bot - 3}` + tip
      + `C${50 + fw * 0.85},${bot - 7} ${R0 + 0.5},${ey + 14} ${R0},${ey + 1}L${R0 - 2.6},${ey + 3}C${R0 - 2.4},${my - 3} ${55.5},${my + 0.5} ${55},${my + 2}Q50,${my + 5.2} 45,${my + 2}C${44.5},${my + 0.5} ${L0 + 2.4},${my - 3} ${L0 + 2.6},${ey + 3}Z`, hair, 0.9);
    if (!c.small && len > 4) {
      const d = shade(hair, hair === c.grey ? -0.25 : 0.25);
      s += L(`M47,${my + 6}Q46,${bot - 6} 47.5,${bot - 2}M53,${my + 6}Q54,${bot - 6} 52.5,${bot - 2}M${50 - fw + 5},${ey + 10}Q${50 - fw + 6},${bot - 9} 44,${bot - 4}M${50 + fw - 5},${ey + 10}Q${50 + fw - 6},${bot - 9} 56,${bot - 4}`, d, 0.6, ' opacity=".8"');
    }
    if (st === 'braided') {
      for (let i = 0; i < 3; i++) s += `<ellipse cx="50" cy="${bot + 2 + i * 3.6}" rx="${2.6 - i * 0.4}" ry="2.2" fill="${hair}" stroke-width=".6"/>`;
      s += C(50, bot + 12, 1.2, GOLD, 0.4);
    }
    return s;
  }

  function moustache(c) {
    const my = c.my, st = c.must, h = c.hair;
    if (st === 'none') return '';
    const D = {
      thin: k => `M50,${my - 1.9}Q${50 + k * 4},${my - 3} ${50 + k * 6.5},${my - 0.3}Q${50 + k * 4},${my - 1.6} 50,${my - 1}Z`,
      droopy: k => `M50,${my - 2.3}C${50 + k * 5},${my - 3.8} ${50 + k * 6.6},${my} ${50 + k * 6.2},${my + 7.5}C${50 + k * 4.8},${my + 2} ${50 + k * 3},${my - 0.6} 50,${my - 0.9}Z`,
      full: k => `M50,${my - 2.6}C${50 + k * 5},${my - 4.2} ${50 + k * 8},${my - 1.2} ${50 + k * 8},${my + 1.2}C${50 + k * 5},${my - 0.4} ${50 + k * 2},${my} 50,${my - 0.7}Z`,
      curl: k => `M50,${my - 2.2}C${50 + k * 4},${my - 3.4} ${50 + k * 7},${my - 1} ${50 + k * 8.6},${my - 4.2}C${50 + k * 7.6},${my + 0.2} ${50 + k * 3},${my - 0.4} 50,${my - 0.8}Z`,
    }[st];
    return P(D(-1), h, 0.6) + P(D(1), h, 0.6);
  }

  // ================== SAÇ ==================
  function hairBack(c) {
    const { fw, ey, hair } = c;
    if (c.hairStyle === 'long')
      return P(`M${50 - fw - 2},44C${50 - fw - 5},66 ${50 - fw - 6},86 ${50 - fw - 1},96L${50 + fw + 1},96C${50 + fw + 6},86 ${50 + fw + 5},66 ${50 + fw + 2},44Z`, hair, 0.9);
    if (c.hairStyle === 'curly' || c.hairStyle === 'bob') {
      let s = P(`M${50 - fw - 3},44C${50 - fw - 4},58 ${50 - fw - 3},68 ${50 - fw + 1},${ey + 16}L${50 + fw - 1},${ey + 16}C${50 + fw + 3},68 ${50 + fw + 4},58 ${50 + fw + 3},44Z`, hair, 0.9);
      if (c.hairStyle === 'curly') for (const k of [-1, 1]) for (let i = 0; i < 3; i++)
        s += C(50 + k * (fw + 1.6), ey + 1 + i * 5, 2.8, hair, 0.7);
      return s;
    }
    return '';
  }
  function hairMid(c) {
    const { fw, ey, hair } = c;
    let s = '';
    if (c.hairStyle === 'braids') {
      const d = `M${50 - fw - 1.4},${ey}V${ey + 42}M${50 + fw + 1.4},${ey}V${ey + 42}`;
      s += L(d, OL, 5.4, ' stroke-linecap="butt"') + L(d, hair, 4, ' stroke-dasharray="3.6 1"');
      s += C(50 - fw - 1.4, ey + 44, 1.5, GOLD, 0.4) + C(50 + fw + 1.4, ey + 44, 1.5, GOLD, 0.4);
    }
    if (c.hairStyle === 'kundun') for (const k of [-1, 1])
      s += P(`M${50 + k * (fw - 1)},44C${50 + k * (fw + 1)},54 ${50 + k * (fw + 0.5)},64 ${50 + k * (fw + 2)},74L${50 + k * (fw + 3.5)},73C${50 + k * (fw + 2.5)},62 ${50 + k * (fw + 2.5)},52 ${50 + k * (fw + 1.5)},44Z`, hair, 0.6);
    return s;
  }
  function hairCap(c) {
    const { fw, ey, hair } = c;
    if (c.hairStyle === 'kundun')
      return P(`M${50 - fw},50C${50 - fw - 0.5},26 ${50 + fw + 0.5},26 ${50 + fw},50C${50 + fw - 2},44 ${50 - fw + 2},44 ${50 - fw},50Z`, mix(c.skin, '#7a8a90', 0.18), 0.9);
    let s = P(`M${50 - fw - 1.4},${ey}C${50 - fw - 2.5},27 ${50 + fw + 2.5},27 ${50 + fw + 1.4},${ey}L${50 + fw - 1.2},${ey - 4.5}C${50 + fw - 3},41 ${53},40 50,42C47,40 ${50 - fw + 3},41 ${50 - fw + 1.2},${ey - 4.5}Z`, hair, 0.9);
    if (!c.small) s += L(`M50,33Q${50 - fw * 0.6},34 ${50 - fw + 1},${ey - 6}M50,33Q${50 + fw * 0.6},34 ${50 + fw - 1},${ey - 6}`, shade(hair, 0.3), 0.6, ' opacity=".7"');
    if (c.hairStyle === 'curly') for (const k of [-1, 1])
      s += C(50 + k * (fw - 0.6), ey - 5, 2.4, hair, 0.6) + C(50 + k * (fw - 4.2), ey - 9.6, 2.2, hair, 0.6);
    return s;
  }

  // ================== GİYSİ ==================
  const SH = 'M0,120L0,106C2,96 22,89 38,88Q50,92 62,88C78,89 98,96 100,106L100,120Z';
  const CHEST = 'M38,88Q50,92 62,88L70,120L30,120Z';
  const CUIRASS = 'M12,120L14,101C18,93 30,89 39,88Q50,92 61,88C70,89 82,93 86,101L88,120Z';
  function body(c) {
    const { robe, robeD, id } = c;
    const b = c.body;
    let s = '';
    if (b === 'loros') {
      s += P(SH, robe, 1);
      s += P('M43,92L57,92L58,120L42,120Z', `url(#${id}g)`, 0.8);
      for (let i = 0; i < 4; i++) s += `<rect x="47.6" y="${97 + i * 6}" width="4.8" height="3.6" fill="${GEMS[i]}" stroke-width=".4"/>`;
      s += P('M30,90Q50,104 70,90L72,97Q50,113 28,97Z', `url(#${id}g)`, 0.8);
      s += pearls('M31,92.6Q50,106.4 69,92.6', 3, 1.6);
      for (let i = 0; i < 5; i++) s += gem(36 + i * 7, 97.5 + (i < 3 ? i : 4 - i) * 2.6, 1.3, GEMS[i % 3]);
    } else if (b === 'kaftan' || b === 'furkaftan') {
      s += P(SH, robe, 1);
      s += P('M42,88L50,100L58,88Z', '#efe6d2', 0.6);
      s += L('M40,88L58,120', OL, 4.6) + L('M40,88L58,120', `url(#${id}g)`, 3.2);
      s += L('M8,104Q14,99 21,102M92,104Q86,99 79,102', `url(#${id}g)`, 3.4);
      if (!c.small) s += L('M20,112l3,-3M28,116l3,-3M74,108l3,3M80,114l3,3', robeD, 1.2);
      if (b === 'furkaftan') s += P('M24,92C34,86 44,88 50,96C56,88 66,86 76,92L74,98C66,94 58,96 50,104C42,96 34,94 26,98Z', '#6b4a2c', 0.8)
        + L('M30,94l1,3M38,92l1,3M46,96l1,3M54,96l-1,3M62,92l-1,3M70,94l-1,3', '#3d2816', 0.7);
    } else if (b === 'mantle') {
      s += P(SH, robeD, 1) + P(CHEST, robe, 0.8);
      s += L('M39,88Q50,96 61,88', OL, 3.8) + L('M39,88Q50,96 61,88', `url(#${id}g)`, 2.6);
      s += L('M33,108L67,108', `url(#${id}g)`, 2.2);
      s += C(66, 97, 3.2, `url(#${id}g)`, 0.7) + gem(66, 97, 1.4, '#b3202a');
    } else if (b === 'round') {
      s += P(SH, robe, 1);
      s += L('M37,89Q50,103 63,89', OL, 4.4) + L('M37,89Q50,103 63,89', robeD, 3);
      s += L('M41,89Q50,98 59,89', '#efe6d2', 1.6);
      if (!c.small) s += L('M22,110q4,-4 8,0M70,110q4,-4 8,0', shade(robe, 0.25), 1);
    } else if (b === 'jewels') {
      s += P(SH, c.skinD, 1);
      s += P('M100,98L100,108L30,120L18,120Z', robe, 0.8);
      s += P('M33,90Q50,108 67,90L70,96Q50,118 30,96Z', `url(#${id}g)`, 0.8);
      for (let i = 0; i < 5; i++) s += gem(38 + i * 6, 99 + (i < 3 ? i : 4 - i) * 2.4, 1.3, GEMS[i % 3]);
      s += C(18, 101, 2, GOLD, 0.5) + C(82, 101, 2, GOLD, 0.5);
    } else if (b === 'african') {
      s += P(SH, robe, 1);
      s += P('M36,88Q50,100 64,88L66,94Q50,108 34,94Z', '#efe6d2', 0.7);
      s += L('M36,91Q50,104 64,91', `url(#${id}g)`, 1.6);
      if (CHRIST[c.rel]) s += L('M50,100v9M46.5,103.5h7', `url(#${id}g)`, 2.2);
    } else if (b === 'lamellar' || b === 'mail' || b === 'gilt') {
      s += P(SH, c.cloak, 1);
      const base = b === 'gilt' ? GOLD : b === 'mail' ? '#9aa1a8' : c.lamCol;
      s += P(CUIRASS, base, 1);
      s += P(CUIRASS, `url(#${id}${b === 'mail' ? 'm' : 'l'})`, 0);
      s += P('M38,88Q50,93 62,88L60,94Q50,99 40,94Z', shade(base, -0.2), 0.7);
      if (c.skill >= 3) s += L('M14,101C18,93 30,89 39,88M86,101C82,93 70,89 61,88', `url(#${id}g)`, 1.8);
      if (c.skill >= 4) s += L('M24,114Q50,119 76,114', `url(#${id}g)`, 2.4);
      s += C(28, 96, 2.6, `url(#${id}g)`, 0.6) + C(72, 96, 2.6, `url(#${id}g)`, 0.6);
      if (c.skill >= 5) s += gem(28, 96, 1.2, '#b3202a') + gem(72, 96, 1.2, '#b3202a');
    } else if (b === 'admiral') {
      s += P(SH, c.cloak, 1) + P(CHEST, robe, 0.8);
      s += L('M39,88Q50,96 61,88', `url(#${id}g)`, 2.2);
      if (!c.small) s += L('M4,112q5,-3 10,0t10,0M76,112q5,-3 10,0t10,0', shade(c.cloak, 0.35), 0.9);
      // çapa broşu
      s += C(68, 97, 4.4, `url(#${id}g)`, 0.7);
      s += L('M68,94.2v6.4M65.4,98.8q2.6,2.8 5.2,0M66.4,95.6h3.2', OL, 0.9);
      if (c.skill >= 4) s += L('M33,108L67,108', `url(#${id}g)`, 2);
    }
    return s;
  }

  // ================== BAŞLIKLAR ==================
  function turbanShape(c, col, top, plume, jewel) {
    const W = c.fw + 4, l = 50 - W, r = 50 + W, id = c.id;
    let s = P(`M${l},45C${l - 3},30 ${l + 4},${top} 50,${top}C${r - 4},${top} ${r + 3},30 ${r},45Q50,40 ${l},45Z`, col, 1);
    const d = shade(col, -0.22);
    s += L(`M${l + 1},38Q50,${top + 8} ${r - 3},${top + 6}M${l + 2},43Q50,${top + 16} ${r},34M${l + 6},${top + 6}Q50,${top + 22} ${r - 1},42`, d, c.small ? 1.4 : 0.9);
    if (jewel) s += P(`M50,${top + 10}l3.2,4.4l-3.2,4.4l-3.2,-4.4Z`, `url(#${id}g)`, 0.6) + gem(50, top + 14.4, 1.4, jewel);
    if (plume) s += P(`M50,${top + 10}C46,${top} 47,${top - 8} 52,${top - 12}C51,${top - 6} 54,${top} 50,${top + 10}Z`, plume, 0.6);
    return s;
  }
  function crownBand(c, y0, y1, ext = 3) {
    const W = c.fw + ext, id = c.id;
    let s = P(`M${50 - W},${y1}L${50 - W},${y0}Q50,${y0 - 2} ${50 + W},${y0}L${50 + W},${y1}Q50,${y1 - 2} ${50 - W},${y1}Z`, `url(#${id}g)`, 0.9);
    const n = 5;
    for (let i = 0; i < n; i++) s += gem(50 - W + 4 + i * (2 * W - 8) / (n - 1), (y0 + y1) / 2 - 0.7, 1.3, GEMS[i % 3]);
    return s;
  }
  function crossTop(x, y, id) { return P(`M${x - 1},${y}h2v-3h3v-2h-3v-3h-2v3h-3v2h3Z`, `url(#${id}g)`, 0.5); }

  const HATS = {
    stemma(c) { // Bizans kapalı taç + pendilia
      const W = c.fw + 3, id = c.id;
      let s = P(`M${50 - W + 1},38C${50 - W + 1},16 ${50 + W - 1},16 ${50 + W - 1},38Z`, c.robeD, 0.9);
      s += L(`M50,20V38M${50 - W + 4},26Q50,22 ${50 + W - 4},26`, `url(#${id}g)`, 2.4);
      s += crownBand(c, 36, 45) + crossTop(50, 20, id);
      for (const k of [-1, 1]) {
        const x = 50 + k * (W - 1.5);
        s += pearls(`M${x},47.5V61.1`);
        s += P(`M${x},64l1.8,2.6l-1.8,3.4l-1.8,-3.4Z`, '#b3202a', 0.5);
      }
      return s;
    },
    crownOpen(c) { // Latin açık taç, zambak uçlu
      const W = c.fw + 2.5, id = c.id;
      let s = '';
      for (const x of [50 - W + 3, 50 - W / 2 + 1, 50, 50 + W / 2 - 1, 50 + W - 3])
        s += P(`M${x - 2.8},39L${x - 2.8},34Q${x - 5},29.5 ${x - 1.4},30.4Q${x},25 ${x + 1.4},30.4Q${x + 5},29.5 ${x + 2.8},34L${x + 2.8},39Z`, `url(#${id}g)`, 0.7);
      return s + crownBand(c, 37, 44, 2.5);
    },
    circlet(c) {
      const W = c.fw + 1.8, id = c.id;
      let s = '';
      for (const x of [50 - W + 4, 50, 50 + W - 4]) s += P(`M${x - 2.4},40L${x},34.5L${x + 2.4},40Z`, `url(#${id}g)`, 0.6);
      return s + crownBand(c, 39, 44.5, 1.8);
    },
    monomakh(c) { // Rus kürklü kalpak
      const W = c.fw + 3, id = c.id;
      let s = P(`M${50 - W + 2},37C${50 - W + 2},14 ${50 + W - 2},14 ${50 + W - 2},37Z`, `url(#${id}g)`, 0.9);
      s += L(`M50,18V36M${50 - 8},20Q46,30 44,36M${50 + 8},20Q54,30 56,36`, GOLD_D, 0.9);
      s += gem(50, 28, 1.6, '#1f6e4a') + gem(42, 31, 1.2, '#b3202a') + gem(58, 31, 1.2, '#b3202a');
      s += crossTop(50, 17, id) + C(50, 17.5, 1.4, '#f4efe2', 0.4);
      s += P(`M${50 - W - 1},46C${50 - W - 2},40 ${50 - W - 1},34 ${50 - W + 2},34Q50,31 ${50 + W - 2},34C${50 + W + 1},34 ${50 + W + 2},40 ${50 + W + 1},46Q50,42 ${50 - W - 1},46Z`, '#6b4a2c', 0.9);
      if (!c.small) s += L(`M${50 - W + 3},38v4M${50 - W + 9},37v4M${50 - 3},36v4M${50 + 3},36v4M${50 + W - 9},37v4M${50 + W - 3},38v4`, '#3d2816', 0.8);
      return s;
    },
    bork(c) { // bozkır börkü, kürk kenarlı
      const W = c.fw + 3, id = c.id, cap = c.kind === 'ruler' ? c.robe : c.hatCol;
      let s = P(`M${50 - W + 2},38C${50 - W + 4},24 ${45},12 ${52},8C${55},16 ${50 + W - 2},24 ${50 + W - 2},38Z`, cap, 0.9);
      if (!c.small) s += L(`M50,12Q47,26 46,38M54,16Q56,28 57,37`, shade(cap, -0.25), 0.8);
      s += P(`M${50 - W - 1},46C${50 - W - 2},40 ${50 - W},35 ${50 - W + 3},35Q50,32 ${50 + W - 3},35C${50 + W},35 ${50 + W + 2},40 ${50 + W + 1},46Q50,42 ${50 - W - 1},46Z`, c.fur, 0.9);
      if (!c.small) s += L(`M${50 - W + 3},38v4M${50 - 7},37v4M50,36v4M${50 + 7},37v4M${50 + W - 3},38v4`, shade(c.fur, -0.35), 0.8);
      if (c.kind === 'ruler' || c.skill >= 4) {
        s += P('M46.5,33h7v6h-7Z', `url(#${id}g)`, 0.6) + gem(50, 36, 1.3, '#b3202a');
        s += P('M50,33C45,24 46,14 53,7C51,16 55,24 50,33Z', '#f2ede0', 0.6) + L('M50,32Q49,20 52,9', '#9a8f80', 0.5);
      }
      return s;
    },
    turban(c) { return turbanShape(c, c.hatCol, 16, c.plume, c.jewel); },
    caliph(c) { // halife sarığı + taylasan
      return P(`M${50 - c.fw - 4},42C${50 - c.fw - 8},60 ${50 - c.fw - 9},80 ${50 - c.fw - 6},96L${50 - c.fw + 1},96C${50 - c.fw - 2},76 ${50 - c.fw - 1},58 ${50 - c.fw + 1},44Z`, shade(c.hatCol, -0.08), 0.8)
        + turbanShape(c, c.hatCol, 14, null, '#1f6e4a');
    },
    kulah(c) { // İran: uzun külah + sarık
      const id = c.id;
      let s = P(`M42,32C42,14 46,6 50,4C54,6 58,14 58,32Z`, c.robeD, 0.9);
      if (c.kind === 'ruler') s += L('M50,8V30', `url(#${id}g)`, 2) + gem(50, 10, 1.4, '#b3202a');
      return s + turbanShape(c, c.hatCol, 22, null, c.kind === 'ruler' ? '#2a4fa0' : null);
    },
    litham(c) { // Sanhaca peçesi
      const { fw, ey } = c;
      return P(`M${50 - fw - 1},${ey + 3}Q50,${ey + 5.5} ${50 + fw + 1},${ey + 3}L${50 + fw + 4},92L${50 - fw - 4},92Z`, c.veil, 1)
        + L(`M${50 - fw + 2},${ey + 9}Q50,${ey + 12} ${50 + fw - 2},${ey + 9}M${50 - fw + 1},${ey + 17}Q50,${ey + 21} ${50 + fw - 1},${ey + 17}`, shade(c.veil, 0.2), 0.8)
        + turbanShape(c, c.veil, 17, null, null);
    },
    kafkasCrown(c) { // Gürcü Bagrationi tacı: kısa, açılan, uçlu
      const W = c.fw + 1.5, id = c.id;
      let s = P(`M${50 - W},40L${50 - W - 2},24Q50,20 ${50 + W + 2},24L${50 + W},40Z`, c.robeD, 0.9);
      s += L(`M${50 - W + 5},39L${50 - W + 4},23M50,39V21M${50 + W - 5},39L${50 + W - 4},23`, `url(#${id}g)`, 1.8);
      for (const x of [50 - W - 1, 50 - W / 2, 50, 50 + W / 2, 50 + W + 1]) s += P(`M${x - 2},25L${x},18L${x + 2},25Z`, `url(#${id}g)`, 0.5) + C(x, 18, 1, '#f4efe2', 0.3);
      s += L(`M${50 - W - 2},24Q50,20 ${50 + W + 2},24`, `url(#${id}g)`, 2.2);
      s += pearls(`M${50 - W - 0.5},47.5V57.7M${50 + W + 0.5},47.5V57.7`, 3.4, 2.2);
      return s + crownBand(c, 37, 45, 2);
    },
    tiaraArm(c) { // Ermeni tacı: sivri, yıldızlı
      const W = c.fw + 2, id = c.id;
      let s = P(`M${50 - W},40L${50 - W + 4},16L50,8L${50 + W - 4},16L${50 + W},40Z`, c.robe, 0.9);
      s += L(`M${50 - W + 4},16L50,8L${50 + W - 4},16`, `url(#${id}g)`, 2);
      for (const [x, y] of [[44, 26], [56, 26], [50, 18]]) s += P(`M${x},${y - 3}l1,2l2,1l-2,1l-1,2l-1,-2l-2,-1l2,-1Z`, `url(#${id}g)`, 0.4);
      return s + crownBand(c, 37, 45, 2);
    },
    mukuta(c) { // GD Asya: katlı sivri taç (Khmer/Cava)
      const W = c.fw + 2, id = c.id;
      let s = P(`M${50 - W + 1},40L${50 - W + 3},31L41,25L44,17L47,10L50,2L53,10L56,17L59,25L${50 + W - 3},31L${50 + W - 1},40Z`, `url(#${id}g)`, 0.9);
      s += L(`M${50 - W + 3},31H${50 + W - 3}M41,25H59M44,17H56M47,10H53`, GOLD_D, 1);
      s += gem(50, 35, 1.8, '#b3202a') + gem(50, 21, 1.2, '#1f6e4a') + gem(43, 35, 1.1, '#2a4fa0') + gem(57, 35, 1.1, '#2a4fa0');
      return s + crownBand(c, 38, 45, 2);
    },
    kirita(c) { // Hint: üç dilimli yelpaze taç (kirita mukuta)
      const W = c.fw + 2.5, id = c.id, l = 50 - W, r = 50 + W;
      let s = P(`M${l},40L${l - 1.5},30Q${l - 2},15 ${l + 7},17Q${l + 10},19 ${l + 11},25L45,23Q45,9 50,4Q55,9 55,23L${r - 11},25Q${r - 10},19 ${r - 7},17Q${r + 2},15 ${r + 1.5},30L${r},40Z`, `url(#${id}g)`, 0.9);
      s += L(`M${l + 1},31Q50,37 ${r - 1},31`, GOLD_D, 0.9);
      s += gem(50, 16, 2, '#b3202a') + gem(l + 4, 25, 1.4, '#1f6e4a') + gem(r - 4, 25, 1.4, '#1f6e4a') + C(50, 6.5, 1.1, '#f4efe2', 0.4)
        + C(l + 5, 17, 0.9, '#f4efe2', 0.3) + C(r - 5, 17, 0.9, '#f4efe2', 0.3);
      return s + crownBand(c, 37, 45, 2.5);
    },
    futou(c) { // Song: kanatlı futou
      const W = c.fw + 1.5, wing = c.sub === 'kr' || c.sub === 'vn' ? 14 : c.kind === 'ruler' ? 40 : 30;
      let s = '';
      s += P(`M${50 - W},38.6L${50 - W - wing},37.6L${50 - W - wing},39.8L${50 - W},40.8ZM${50 + W},38.6L${50 + W + wing},37.6L${50 + W + wing},39.8L${50 + W},40.8Z`, '#16120f', 0.6);
      s += P(`M${50 - W},45L${50 - W},31Q50,27 ${50 + W},31L${50 + W},45Q50,42 ${50 - W},45Z`, '#1d1915', 0.9);
      s += P(`M${50 - 8},30C${50 - 8},20 ${50 + 8},20 ${50 + 8},30Z`, '#1d1915', 0.9);
      if (!c.small) s += L(`M${50 - W + 1},36Q50,33 ${50 + W - 1},36`, '#4a443c', 0.8);
      if (c.kind === 'ruler') s += gem(50, 38, 1.4, '#e8c46a');
      return s;
    },
    eboshi(c) { // Japon tate-eboshi
      let s = P('M39,44L40,14Q44,4 56,6Q60,10 60,22L61,44Q50,41 39,44Z', '#1b1814', 0.9);
      if (!c.small) s += L('M42,30Q50,26 58,30M41,38Q50,34 59,38', '#4a443c', 0.7);
      return s + P(`M38,44Q50,40 62,44L62,46Q50,43 38,46Z`, '#2e2a24', 0.6);
    },
    tibTurban(c) { // Tibet krallarının yüksek sarığı
      let s = P(`M${50 - c.fw - 3},45C${50 - c.fw - 5},20 ${50 - 8},4 50,4C${50 + 8},4 ${50 + c.fw + 5},20 ${50 + c.fw + 3},45Q50,40 ${50 - c.fw - 3},45Z`, '#efe9dc', 1);
      s += P('M45,14C45,6 55,6 55,14Q50,12 45,14Z', '#b3202a', 0.7);
      s += L(`M${50 - c.fw - 1},38Q50,20 ${50 + c.fw},26M${50 - c.fw + 1},30Q50,14 ${50 + c.fw - 3},18`, '#b7ae9c', 0.9);
      return s + gem(50, 30, 1.6, '#2a4fa0');
    },
    furHat(c) { // Hıtay/doğu bozkırı kürk şapka
      const W = c.fw + 3;
      let s = P(`M${50 - W + 2},38C${50 - W + 2},22 ${50 + W - 2},22 ${50 + W - 2},38Z`, c.robe, 0.9);
      s += P(`M${50 - W - 2},46C${50 - W - 2},38 ${50 - W},34 ${50 - W + 3},34Q50,31 ${50 + W - 3},34C${50 + W},34 ${50 + W + 2},38 ${50 + W + 2},46Q50,42 ${50 - W - 2},46Z`, c.fur, 0.9);
      return s + gem(50, 28, 1.5, '#e8c46a');
    },
    ethCrown(c) { // Habeş/Nubya kubbeli taç
      const W = c.fw + 2.5, id = c.id;
      let s = P(`M${50 - W + 1},39C${50 - W + 1},20 ${50 + W - 1},20 ${50 + W - 1},39Z`, `url(#${id}g)`, 0.9);
      s += L(`M${50 - W + 4},38Q${50 - 6},24 50,22Q${50 + 6},24 ${50 + W - 4},38M50,22V38`, GOLD_D, 0.9);
      s += gem(43, 32, 1.3, '#b3202a') + gem(57, 32, 1.3, '#b3202a') + gem(50, 29, 1.4, '#1f6e4a');
      if (CHRIST[c.rel]) s += crossTop(50, 22, id);
      return s + crownBand(c, 37, 45, 2.5);
    },
    sahel(c) { // Sahel: altınla süslü sarık-başlık
      let s = turbanShape(c, c.hatCol, 15, null, null);
      if (c.kind === 'ruler') s += P('M43,22L46,14L50,20L54,14L57,22Z', `url(#${c.id}g)`, 0.6) + gem(50, 30, 1.6, '#b3202a');
      return s;
    },
    // ---- miğferler ----
    nasal(c) { // Norman burunluklu konik miğfer + zırh başlık
      const W = c.fw + 2, id = c.id, met = c.skill >= 5 ? `url(#${id}g)` : `url(#${id}s)`;
      const { fw, ey } = c;
      let s = P(`M${50 - fw - 4},40L${50 + fw + 4},40L${50 + fw + 5},96L${50 - fw - 5},96ZM${50 - fw + 2.6},${ey - 2}Q50,${ey - 6} ${50 + fw - 2.6},${ey - 2}C${50 + fw - 2},${ey + 18} ${57},${c.chin - 2} 50,${c.chin - 1}C${43},${c.chin - 2} ${50 - fw + 2},${ey + 18} ${50 - fw + 2.6},${ey - 2}Z`, '#8b9298', 0.9, ' fill-rule="evenodd"');
      s += P(`M${50 - fw - 4},40L${50 + fw + 4},40L${50 + fw + 5},96L${50 - fw - 5},96ZM${50 - fw + 2.6},${ey - 2}Q50,${ey - 6} ${50 + fw - 2.6},${ey - 2}C${50 + fw - 2},${ey + 18} ${57},${c.chin - 2} 50,${c.chin - 1}C${43},${c.chin - 2} ${50 - fw + 2},${ey + 18} ${50 - fw + 2.6},${ey - 2}Z`, `url(#${id}m)`, 0, ' fill-rule="evenodd"');
      s += P(`M${50 - W},46C${50 - W},32 ${46},16 50,9C${54},16 ${50 + W},32 ${50 + W},46Q50,42 ${50 - W},46Z`, met, 0.9);
      s += P(`M${50 - W},46Q50,42 ${50 + W},46L${50 + W},42Q50,38 ${50 - W},42Z`, shade('#9aa1a8', -0.25), 0.7);
      s += P(`M48.4,43h3.2v${c.nl + 9}l-1.6,1.5l-1.6,-1.5Z`, met, 0.7);
      if (!c.small) s += L('M50,12V39', '#ffffff', 0.8, ' opacity=".6"');
      if (c.skill >= 4) s += C(50, 9.5, 1.8, `url(#${id}g)`, 0.5);
      return s;
    },
    spangen(c) { // İskandinav: yuvarlak kubbe, bantlı, gözlüklü
      const W = c.fw + 2.5, id = c.id, met = `url(#${id}s)`, ey = c.ey;
      let s = P(`M${50 - W},46C${50 - W},22 ${50 + W},22 ${50 + W},46Q50,42 ${50 - W},46Z`, met, 0.9);
      const band = c.skill >= 4 ? `url(#${id}g)` : '#a07a3a';
      s += L(`M50,23V44M${50 - W + 2},36Q50,30 ${50 + W - 2},36`, band, 2.2);
      s += P(`M${50 - W},46Q50,42 ${50 + W},46L${50 + W},42Q50,38 ${50 - W},42Z`, band, 0.7);
      if (c.sub2) s += P(`M48.6,44h2.8v${c.nl + 3}h-2.8ZM${50 - c.es - c.ew - 1.5},45Q${50 - c.es},${ey + 6} 49,${ey + 2}L${49},45ZM${50 + c.es + c.ew + 1.5},45Q${50 + c.es},${ey + 6} 51,${ey + 2}L51,45Z`, met, 0.8, ' fill-opacity=".95"')
        + P(`M${50 - c.es - c.ew + 0.5},45.5Q${50 - c.es},${ey + 3.5} 48.3,${ey + 1}L${48.3},45.5ZM${50 + c.es + c.ew - 0.5},45.5Q${50 + c.es},${ey + 3.5} 51.7,${ey + 1}L51.7,45.5Z`, '#2a1a10', 0, ' opacity=".55"');
      else s += P(`M48.6,44h2.8v${c.nl + 2}l-1.4,1.4l-1.4,-1.4Z`, met, 0.7);
      if (c.skill >= 5) s += P('M50,24C46,16 48,10 52,8C50,14 54,18 50,24Z', '#b3202a', 0.5);
      return s;
    },
    pointed(c) { // Rus şişak / bozkır / Kafkas sivri miğferi + yakalık
      const W = c.fw + 2.5, id = c.id, met = c.skill >= 5 ? `url(#${id}g)` : `url(#${id}s)`;
      let s = P(`M${50 - W},46C${50 - W},30 ${46},18 50,6C${54},18 ${50 + W},30 ${50 + W},46Q50,42 ${50 - W},46Z`, met, 0.9);
      s += P(`M${50 - W},46Q50,42 ${50 + W},46L${50 + W},42Q50,38 ${50 - W},42Z`, c.skill >= 3 ? `url(#${id}g)` : shade('#9aa1a8', -0.25), 0.7);
      if (!c.small) s += L('M50,9V39', '#ffffff', 0.8, ' opacity=".6"') + L(`M${50 - 7},40Q${50 - 6},26 50,10M${50 + 7},40Q${50 + 6},26 50,10`, '#5f666d', 0.6);
      if (c.group === 'turk_bozkir' || c.group === 'turk_yerlesik' || c.skill >= 4) s += P('M50,7C47,0 48,-4 52,-6C51,-1 54,2 50,7Z', c.plume || '#b3202a', 0.5);
      if (c.group === 'slav' && c.skill >= 3) s += P('M46.5,30h7l-3.5,7Z', `url(#${id}g)`, 0.5);
      return s;
    },
    aventail(c) { // miğfer arkasından sarkan zırh (arka katman)
      const fw = c.fw;
      return P(`M${50 - fw - 3.5},42L${50 - fw - 6},90Q50,98 ${50 + fw + 6},90L${50 + fw + 3.5},42Z`, '#8b9298', 0.9)
        + P(`M${50 - fw - 3.5},42L${50 - fw - 6},90Q50,98 ${50 + fw + 6},90L${50 + fw + 3.5},42Z`, `url(#${c.id}m)`, 0);
    },
    turbanHelm(c) { // sarıklı miğfer (İslam dünyası)
      const W = c.fw + 2, id = c.id, met = c.skill >= 5 ? `url(#${id}g)` : `url(#${id}s)`;
      let s = P(`M${50 - W + 3},36C${50 - W + 4},24 ${47},14 50,6C${53},14 ${50 + W - 4},24 ${50 + W - 3},36Z`, met, 0.9);
      if (!c.small) s += L('M50,9V34', '#ffffff', 0.8, ' opacity=".6"');
      const W2 = W + 2, col = c.hatCol;
      s += P(`M${50 - W2},46C${50 - W2 - 1},38 ${50 - W2 + 2},33 50,33C${50 + W2 - 2},33 ${50 + W2 + 1},38 ${50 + W2},46Q50,41 ${50 - W2},46Z`, col, 0.9);
      s += L(`M${50 - W2 + 2},42Q50,34 ${50 + W2 - 2},38M${50 - W2 + 3},38Q50,40 ${50 + W2 - 1},43`, shade(col, -0.25), 0.8);
      if (c.skill >= 3) s += gem(50, 38.5, 1.5, c.skill >= 5 ? '#1f6e4a' : '#b3202a');
      if (c.skill >= 4) s += P('M50,7C46,0 47,-4 52,-6C51,-1 54,2 50,7Z', c.plume || '#f2ede0', 0.5);
      return s;
    },
    byzHelm(c) { // Bizans: yuvarlak, yaldızlı miğfer
      const W = c.fw + 2.5, id = c.id;
      let s = P(`M${50 - W},46C${50 - W},22 ${50 + W},22 ${50 + W},46Q50,42 ${50 - W},46Z`, `url(#${id}s)`, 0.9);
      s += P(`M${50 - W},46Q50,42 ${50 + W},46L${50 + W},41Q50,37 ${50 - W},41Z`, `url(#${id}g)`, 0.7);
      s += L('M50,25V40', `url(#${id}g)`, 2);
      s += C(50, 24, 2, `url(#${id}g)`, 0.6);
      if (c.skill >= 4) s += P('M50,24C44,16 44,10 49,6C48,12 54,16 50,24Z', '#b3202a', 0.5);
      return s;
    },
    chnHelm(c) { // Song miğferi: kulak kanatlı, püsküllü
      const W = c.fw + 2.5, id = c.id, met = c.skill >= 5 ? `url(#${id}g)` : `url(#${id}s)`;
      let s = '';
      for (const k of [-1, 1]) s += P(`M${50 + k * (W - 2)},40L${50 + k * (W + 5)},44L${50 + k * (W + 6)},66L${50 + k * (W - 1)},62Z`, met, 0.8);
      s += P(`M${50 - W},46C${50 - W},22 ${50 + W},22 ${50 + W},46Q50,42 ${50 - W},46Z`, met, 0.9);
      s += P(`M${50 - W},46Q50,42 ${50 + W},46L${50 + W},42Q50,38 ${50 - W},42Z`, `url(#${id}g)`, 0.6);
      s += P('M50,25C44,20 45,10 50,6C55,10 56,20 50,25Z', '#c0262c', 0.6);
      s += L('M47,14Q50,10 53,14M46,19Q50,15 54,19', '#7a1418', 0.6);
      s += P('M46,26L54,26L52,20L48,20Z', `url(#${id}g)`, 0.5);
      return s;
    },
    kabuto(c) { // Japon kabuto: geniş ense koruması, kuwagata
      const W = c.fw + 2.5, id = c.id;
      let s = P(`M${50 - W},40L${50 - W - 9},62L${50 - W - 2},64L${50 - W + 2},46ZM${50 + W},40L${50 + W + 9},62L${50 + W + 2},64L${50 + W - 2},46Z`, c.robeD, 0.8);
      s += P(`M${50 - W},46C${50 - W},22 ${50 + W},22 ${50 + W},46Q50,42 ${50 - W},46Z`, '#2a2622', 0.9);
      if (!c.small) s += L(`M50,24V42M${50 - 7},26V42M${50 + 7},26V42`, '#5a544c', 0.7);
      s += P('M48,40C44,32 40,22 38,12L40,12C43,22 47,30 50,36C53,30 57,22 60,12L62,12C60,22 56,32 52,40Z', `url(#${id}g)`, 0.6);
      return s;
    },
    headband(c) { // GD Asya / Hint savaşçı başlığı
      return crownBand(c, 39, 45, 2) + P(`M44,40L47,30L50,24L53,30L56,40Z`, `url(#${c.id}g)`, 0.7);
    },
    // ---- denizci başlıkları ----
    seaCap(c) { // yumuşak keçe başlık (Akdeniz/Kuzey)
      const W = c.fw + 2.5;
      let s = P(`M${50 - W},45C${50 - W - 1},28 ${50 - 4},20 ${50 + 4},19C${50 + 12},19 ${50 + W + 3},28 ${50 + W},45Q50,41 ${50 - W},45Z`, c.hatCol, 0.9);
      s += P(`M${50 - W - 0.5},46Q50,41 ${50 + W + 0.5},46L${50 + W},41Q50,37 ${50 - W},41Z`, shade(c.hatCol, -0.3), 0.7);
      if (c.skill >= 4) s += gem(50 - W + 6, 41.5, 1.3, '#e8c46a');
      return s;
    },
  };

  // ---- Grup -> kıyafet seçimi ----
  function outfit(c) {
    const g = c.group, k = c.kind, r = c.r, rel = c.rel, sub = c.sub;
    const mus = !!MUSLIM[rel];
    const o = { hat: null, back: null, body: 'mantle', cap: false, ears: true };
    const pk = a => a[Math.floor(r() * a.length)];
    if (k === 'ruler') {
      o.body = 'mantle';
      switch (g) {
        case 'bizans': o.hat = 'stemma'; o.body = 'loros'; break;
        case 'latin': o.hat = 'crownOpen'; o.cap = true; break;
        case 'iskandinav': case 'kelt': case 'anglosakson': o.hat = r() < 0.6 ? 'circlet' : 'crownOpen'; o.cap = true; break;
        case 'slav': o.hat = 'monomakh'; o.body = 'furkaftan'; break;
        case 'kafkas': o.hat = mus ? 'turban' : rel === 'miafizit' ? 'tiaraArm' : 'kafkasCrown'; o.body = mus ? 'kaftan' : 'loros'; break;
        case 'turk_bozkir': o.hat = 'bork'; o.body = 'furkaftan'; break;
        case 'turk_yerlesik': o.hat = 'turban'; o.body = 'kaftan'; c.plume = '#f2ede0'; c.jewel = '#b3202a'; break;
        case 'iran': o.hat = 'kulah'; o.body = 'kaftan'; break;
        case 'arap': o.hat = 'caliph'; o.body = 'kaftan'; c.hatCol = rel === 'sii' ? '#f4f0e6' : r() < 0.5 ? '#2a2622' : '#f4f0e6'; break;
        case 'berberi': o.hat = r() < 0.35 ? 'litham' : 'turban'; o.body = 'kaftan'; c.jewel = '#1f6e4a'; break;
        case 'hint': o.hat = mus ? 'turban' : 'kirita'; o.body = mus ? 'kaftan' : 'jewels'; c.earring = !mus; break;
        case 'gdasya': o.hat = sub === 'vn' ? 'futou' : 'mukuta'; o.body = sub === 'vn' ? 'round' : 'jewels'; c.earring = sub !== 'vn'; break;
        case 'cin': o.hat = 'futou'; o.body = 'round'; break;
        case 'dogu_asya': o.body = 'round';
          o.hat = sub === 'jp' ? 'eboshi' : sub === 'tib' ? 'tibTurban' : sub === 'kr' || sub === 'dali' || sub === 'vn' ? 'futou' : 'furHat';
          if (!sub) c.hairStyle = 'kundun'; break;
        case 'afrika': o.hat = CHRIST[rel] ? 'ethCrown' : 'sahel'; o.body = 'african'; c.hatCol = pk(['#f4f0e6', '#e8dcc0', '#2c3a6a']); break;
        default: o.hat = 'crownOpen'; o.cap = true;
      }
    } else if (k === 'general') {
      o.body = 'lamellar';
      switch (g) {
        case 'latin': case 'anglosakson': o.hat = 'nasal'; o.body = 'mail'; o.ears = false; break;
        case 'kelt': if (r() < 0.5) { o.hat = 'nasal'; o.ears = false; } else { o.cap = true; } o.body = 'mail'; break;
        case 'iskandinav': o.hat = 'spangen'; o.body = 'mail'; c.sub2 = r() < 0.5; break;
        case 'bizans': o.body = 'gilt'; if (r() < 0.45) o.cap = true; else o.hat = 'byzHelm'; break;
        case 'slav': case 'kafkas': o.hat = 'pointed'; o.back = 'aventail'; o.body = r() < 0.5 ? 'mail' : 'lamellar'; o.ears = false; break;
        case 'turk_bozkir': o.hat = r() < 0.5 ? 'pointed' : 'bork'; if (o.hat === 'pointed') { o.back = 'aventail'; o.ears = false; } break;
        case 'turk_yerlesik': case 'iran': case 'arap': o.hat = 'turbanHelm'; o.back = 'aventail'; o.ears = false; o.body = r() < 0.5 ? 'mail' : 'lamellar'; break;
        case 'berberi': o.hat = r() < 0.55 ? 'litham' : 'turbanHelm'; if (o.hat === 'turbanHelm') { o.back = 'aventail'; o.ears = false; } o.body = 'mail'; break;
        case 'hint': o.hat = 'turban'; o.body = 'mail'; c.jewel = c.skill >= 3 ? '#b3202a' : null; c.plume = c.skill >= 4 ? '#f2ede0' : null; break;
        case 'gdasya': o.hat = sub === 'vn' ? 'chnHelm' : 'headband'; c.earring = sub !== 'vn'; break;
        case 'cin': o.hat = 'chnHelm'; break;
        case 'dogu_asya': o.hat = sub === 'jp' ? 'kabuto' : 'chnHelm'; if (!sub) c.hairStyle = 'kundun'; break;
        case 'afrika': o.hat = CHRIST[rel] ? 'pointed' : 'sahel'; o.body = 'mail'; c.hatCol = pk(['#f4f0e6', '#2c3a6a', '#7a3020']); break;
        default: o.hat = 'nasal'; o.body = 'mail'; o.ears = false;
      }
    } else { // admiral
      o.body = 'admiral';
      switch (g) {
        case 'latin': case 'anglosakson': case 'kelt': case 'iskandinav': case 'bizans': case 'kafkas':
          if (r() < 0.65) { o.hat = 'seaCap'; c.hatCol = pk(['#a3302a', '#5a3a26', '#2c3a6a', '#3a5a3a']); } else o.cap = true; break;
        case 'slav': o.hat = 'furHat'; break;
        case 'turk_bozkir': o.hat = 'bork'; break;
        case 'turk_yerlesik': case 'iran': case 'arap': case 'berberi': case 'hint': case 'afrika':
          o.hat = 'turban'; c.hatCol = pk(['#2f6f8f', '#f4f0e6', '#1f4e6e', '#e8dcc0']); c.jewel = c.skill >= 3 ? '#2a4fa0' : null; break;
        case 'gdasya': o.hat = sub === 'vn' ? 'futou' : 'headband'; c.earring = sub !== 'vn'; break;
        case 'cin': case 'dogu_asya': o.hat = sub === 'jp' ? 'eboshi' : 'futou'; if (!sub && g === 'dogu_asya') c.hairStyle = 'kundun'; break;
        default: o.hat = 'seaCap';
      }
    }
    if (o.hat === 'litham') { c.beard = 'none'; c.must = 'none'; }
    if (c.hairStyle === 'kundun') o.cap = o.cap || o.hat === 'chnHelm' ? o.cap : o.cap;
    return o;
  }

  // ================== ÇERÇEVE / ARKA PLAN ==================
  const ARCH = 'M7,113V48A43,43 0 0 1 93,48V113Z';
  const RECT = 'M11,7H89L93,11V109L89,113H11L7,109V11Z';

  function emblem(c, x, y) {
    const id = c.id, rel = c.rel;
    let s = C(x, y, 4.6, `url(#${id}g)`, 0.8);
    if (CHRIST[rel]) s += P(`M${x - 0.9},${y - 3}h1.8v2.1h2.1v1.8h-2.1v2.1h-1.8v-2.1h-2.1v-1.8h2.1Z`, '#8b2a1a', 0);
    else if (MUSLIM[rel]) s += P(`M${x + 1},${y - 3}A3,3 0 1 0 ${x + 1},${y + 3}A3.8,3.8 0 0 1 ${x + 1},${y - 3}Z`, '#1f5e4a', 0);
    else if (DHARMA[rel]) s += P(`M${x},${y - 3}C${x + 1.5},${y - 1} ${x + 1.5},${y + 1} ${x},${y + 2.5}C${x - 1.5},${y + 1} ${x - 1.5},${y - 1} ${x},${y - 3}ZM${x - 3.2},${y - 0.6}C${x - 1.2},${y} ${x - 0.6},${y + 1.6} ${x},${y + 2.5}C${x - 2},${y + 2.2} ${x - 3},${y + 1} ${x - 3.2},${y - 0.6}ZM${x + 3.2},${y - 0.6}C${x + 1.2},${y} ${x + 0.6},${y + 1.6} ${x},${y + 2.5}C${x + 2},${y + 2.2} ${x + 3},${y + 1} ${x + 3.2},${y - 0.6}Z`, '#a3302a', 0);
    else s += C(x, y, 2, '#8b2a1a', 0) + L(`M${x},${y - 3.4}v1M${x},${y + 2.4}v1M${x - 3.4},${y}h1M${x + 2.4},${y}h1`, '#8b2a1a', 0.8);
    return s;
  }

  function background(c) {
    const id = c.id;
    let s;
    if (c.kind === 'ruler') {
      s = `<rect width="100" height="120" stroke="none" fill="url(#${id}b)"/>`;
      if (!c.small) s += `<rect width="100" height="120" stroke="none" fill="url(#${id}t)"/>`;
    } else {
      s = `<rect width="100" height="120" stroke="none" fill="${c.field}"/>`;
      if (!c.small) s += `<rect width="100" height="120" stroke="none" fill="url(#${id}t)" opacity=".8"/>`;
      if (c.kind === 'admiral' && !c.small) s += L('M7,30q6,-4 12,0t12,0t12,0t12,0t12,0t12,0t12,0t12,0M7,62q6,-4 12,0t12,0M69,62q6,-4 12,0t12,0', GOLD, 0.9, ' opacity=".5"');
    }
    // nimbus
    if (c.kind === 'ruler') {
      const cy = c.ey - 8, R = c.fw + 13, rel = c.rel;
      if (CHRIST[rel]) s += C(50, cy, R, GOLD_L, 1.1, ' stroke="#8b2a1a"') + C(50, cy, R - 2.6, 'none', 0, ` stroke="${GOLD_D}" stroke-width="1.2" stroke-dasharray=".1 2.4"`);
      else if (DHARMA[rel]) s += C(50, cy, R, '#2f6e58', 0.9) + C(50, cy, R - 3, '#c9893a', 0.6) + C(50, cy, R - 5.5, GOLD_L, 0.5);
      else if (MUSLIM[rel]) s += C(50, cy, R, mix(GOLD_L, '#fff8e6', 0.4), 0.8) + C(50, cy, R - 2.2, 'none', 0, ` stroke="${GOLD}" stroke-width="1"`);
      else s += C(50, cy, R, GOLD_L, 0.8);
    }
    return s;
  }

  function frame(c) {
    const id = c.id, hole = c.kind === 'ruler' ? ARCH : RECT;
    let s = P('M0,0H100V120H0Z' + hole, `url(#${id}g)`, 1, ' fill-rule="evenodd"');
    s += P(hole, 'none', c.small ? 2 : 1.4) + P(hole, 'none', 0, ` stroke="${c.kind === 'ruler' ? '#8b2a1a' : GOLD_L}" stroke-width=".7" transform="translate(50 60) scale(.975) translate(-50 -60)"`);
    if (!c.small) s += P('M3.5,3.5H96.5V116.5H3.5Z', 'none', 0, ` stroke="${GOLD_D}" stroke-width=".8" stroke-dasharray=".1 2.6"`);
    if (c.kind === 'ruler') {
      s += gem(11, 11, 2.4, '#b3202a') + gem(89, 11, 2.4, '#b3202a');
      if (MUSLIM[c.rel]) s += P('M25,4.6A2.6,2.6 0 1 0 25,9.8A3.3,3.3 0 0 1 25,4.6ZM75,4.6A2.6,2.6 0 1 1 75,9.8A3.3,3.3 0 0 0 75,4.6Z', '#1f5e4a', 0);
    } else {
      for (const [x, y] of [[3.5, 3.5], [96.5, 3.5], [3.5, 116.5], [96.5, 116.5]]) s += C(x, y, 1.6, GOLD_L, 0.5);
    }
    s += emblem(c, 50, 115);
    return s;
  }

  function defs(c) {
    const id = c.id;
    let s = `<defs><linearGradient id="${id}g" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="${GOLD_L}"/><stop offset=".5" stop-color="${GOLD}"/><stop offset="1" stop-color="${GOLD_D}"/></linearGradient>`;
    s += `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6d747b"/><stop offset=".4" stop-color="#e4e8ea"/><stop offset="1" stop-color="#5a6168"/></linearGradient>`;
    if (c.kind === 'ruler') {
      const bg = c.art === 'silk' ? ['#efdcae', '#cfae6a'] : ['#f2d27a', '#c08f34'];
      s += `<radialGradient id="${id}b" cx=".5" cy=".38" r=".75"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient>`;
    }
    if (!c.small) {
      const t = c.art === 'persian' ? `<path d="M4,1.6L4.6,3.4L6.4,4L4.6,4.6L4,6.4L3.4,4.6L1.6,4L3.4,3.4Z" fill="${c.kind === 'ruler' ? GOLD_D : GOLD}" opacity=".45"/>`
        : `<circle cx="4" cy="4" r=".7" fill="${c.kind === 'ruler' ? GOLD_D : GOLD}" opacity=".55"/><circle cx="0" cy="0" r=".5" fill="${c.kind === 'ruler' ? GOLD_D : GOLD}" opacity=".4"/>`;
      s += `<pattern id="${id}t" width="8" height="8" patternUnits="userSpaceOnUse">${t}</pattern>`;
    }
    if (c.needMail) s += `<pattern id="${id}m" width="2.6" height="2.2" patternUnits="userSpaceOnUse"><path d="M0,1.1a1.3,1.1 0 0 1 2.6,0" fill="none" stroke="#3b4248" stroke-width=".45"/></pattern>`;
    if (c.needLam) s += `<pattern id="${id}l" width="4" height="6" patternUnits="userSpaceOnUse"><path d="M.3,.4V4.6Q2,6 3.7,4.6V.4Z" fill="#fff" fill-opacity=".18" stroke="${OL}" stroke-width=".5" opacity=".8"/><path d="M0,2.4H4" stroke="#5a2a14" stroke-width=".35" opacity=".6"/></pattern>`;
    s += `<clipPath id="${id}c"><path d="${c.frame ? (c.kind === 'ruler' ? ARCH : RECT) : 'M0,0H100V120H0Z'}"/></clipPath></defs>`;
    return s;
  }

  const f = n => Math.round(n * 100) / 100;

  // ================== ANA ÜRETİCİ ==================
  function build(o) {
    const seed = String(o.seed || 'x');
    const kind = o.kind === 'general' || o.kind === 'admiral' ? o.kind : 'ruler';
    const group = GROUPS[o.group] ? o.group : 'latin';
    const gd = GROUPS[group];
    const h = hashStr(seed + '|' + group + '|' + kind);
    const r = mkRng(h);
    const pk = a => a[Math.floor(r() * a.length)];
    const col = /^#[0-9a-f]{3,6}$/i.test(o.color || '') ? o.color : '#7a5a3a';
    const small = !!(o.size && o.size < 60);
    const c = {
      r, kind, group, sub: o.sub || null, rel: o.religion || '', small,
      id: 'pp' + h.toString(36) + (small ? 's' : '') + (o.frame === false ? 'n' : ''),
      frame: o.frame !== false, art: gd.art, skill: o.skill || 3,
    };
    c.age = o.age || (kind === 'ruler' ? pk(['young', 'adult', 'adult', 'old']) : pk(['young', 'adult', 'adult', 'adult', 'old']));
    c.skin = pk(gd.skin); c.skinD = shade(c.skin, -0.14);
    c.grey = c.age === 'old' ? pk(['#cfcac0', '#e2ded6', '#b8b2a8']) : null;
    const baseHair = pk(gd.hair);
    c.hair = c.grey || baseHair;
    c.brow = c.age === 'old' ? shade(c.grey, -0.25) : shade(baseHair, -0.1);
    c.hairStyle = gd.hairStyle;
    c.fw = 16.5 + Math.floor(r() * 5) * 0.5 - (c.age === 'young' ? 0.5 : 0);
    c.ey = 54 + Math.floor(r() * 3) * 0.5;
    c.es = 7.5 + Math.floor(r() * 4) * 0.4;
    c.ew = 4.3 + r() * 0.8;
    c.eh = gd.eye === 'east' ? 1.6 : gd.eye === 'narrow' ? 1.9 : 2.4 + r() * 0.3;
    c.gaze = pk([0, 0, 0.4, -0.4]);
    c.browArch = gd.eye === 'icon' ? -0.6 : r() * 1.2;
    c.nl = 9.5 + r() * 2.5;
    c.my = c.ey + c.nl + 5.5;
    c.chin = c.my + 10 + r() * 2;
    c.mw = 3.6 + r() * 1.2;
    c.r0 = f(r() * 2);
    c.bl = f(r() * 4);
    c.beard = wpick(r, gd.beard);
    c.must = pk(gd.must);
    if (c.age === 'young') { if (r() < 0.6) c.beard = c.beard === 'none' ? 'none' : 'short'; if (r() < 0.5 && c.beard === 'none') c.must = 'thin'; }
    if (c.age === 'old' && (c.beard === 'short' || c.beard === 'goatee') && r() < 0.6) c.beard = group === 'cin' || group === 'dogu_asya' ? 'long' : 'full';
    if (c.beard !== 'none' && c.must === 'none') c.must = 'full';
    // renkler
    c.robe = col; c.robeD = shade(col, -0.35);
    c.fur = pk(['#6b4a2c', '#7a5a3a', '#4e3a28', '#8a6a48']);
    c.hatCol = pk(group === 'arap' || group === 'berberi' ? ['#f4f0e6', '#f4f0e6', '#e8dcc0', '#2c5a3a'] : group === 'iran' ? ['#f4f0e6', '#e8dcc0', '#7a2a30'] : group === 'hint' ? ['#f4f0e6', '#e0a030', '#b3202a'] : ['#f4f0e6', '#e8dcc0', '#c9b27a', '#7a2a30']);
    c.veil = pk(['#23305a', '#2a2a3a', '#1e3c5a']);
    c.plume = null; c.jewel = kind === 'ruler' ? '#b3202a' : null;
    c.cloak = kind === 'admiral' ? mix('#1d4f73', col, 0.18) : col;
    c.lamCol = (o.skill || 3) >= 4 ? '#c7a24e' : group === 'cin' || group === 'dogu_asya' ? pk(['#8a3a24', '#6a4a2a', '#9aa1a8']) : group === 'turk_bozkir' ? pk(['#7a5232', '#9aa1a8']) : pk(['#9aa1a8', '#a08050', '#9aa1a8']);
    c.field = kind === 'admiral' ? '#1c3a56' : reddish(col) || lum(col) < 0.2 ? '#2f4a36' : '#7a2a1c';

    const out = outfit(c);
    c.body = out.body; c.ears = out.ears;
    if (group === 'bizans' && c.body === 'gilt') c.cloak = reddish(col) ? col : '#9a2a22';
    c.needMail = c.body === 'mail' || out.back === 'aventail' || out.hat === 'nasal';
    c.needLam = c.body === 'lamellar' || c.body === 'gilt';
    if (out.hat === 'nasal') c.hairStyle = 'none';
    if (c.ears === false || c.hairStyle === 'long' || c.hairStyle === 'braids') c.ears = c.hairStyle === 'braids' && out.ears;
    if (c.earring) c.ears = true;

    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120"${o.size ? ` width="${o.size}" height="${f(o.size * 1.2)}"` : ''}>`;
    s += defs(c) + `<g stroke="${OL}" stroke-linejoin="round" stroke-linecap="round"><g clip-path="url(#${c.id}c)">` + background(c);
    s += hairBack(c);
    s += P(`M44,${c.chin - 8}L44,95L56,95L56,${c.chin - 8}Z`, c.skinD, 0.8);
    s += body(c);
    if (out.back) s += HATS[out.back](c);
    s += hairMid(c);
    s += face(c) + beard(c) + mouth(c) + moustache(c);
    if (out.cap || c.hairStyle === 'kundun') s += hairCap(c);
    if (out.hat) s += HATS[out.hat](c);
    s += '</g>';
    if (c.frame) s += frame(c);
    s += '</g></svg>';
    return s.replace(/(\d+\.\d)\d+/g, '$1').replace(/([ ,"MLCQVHAvhlq-])0\./g, '$1.');
  }

  const cache = new Map();
  function svg(opts) {
    const key = JSON.stringify(opts || {});
    let v = cache.get(key);
    if (v === undefined) {
      v = build(opts || {});
      if (cache.size > 600) cache.clear();
      cache.set(key, v);
    }
    return v;
  }

  function nationOf(tag) {
    const S = G.S && G.S.nations && G.S.nations[tag];
    if (S) return S;
    return (window.WORLD && window.WORLD.nations && window.WORLD.nations[tag]) || null;
  }

  G.portrait = {
    svg,
    groups: Object.keys(GROUPS),
    ruler(tag, extra) {
      const n = nationOf(tag) || {};
      return svg(Object.assign({ seed: tag + '|' + (n.ruler || ''), group: n.group || 'latin', kind: 'ruler',
        color: n.color, religion: n.religion, sub: SUBS[tag] || null }, extra || {}));
    },
    leader(ld, tag, kind, extra) {
      const n = nationOf(tag) || {};
      ld = ld || {};
      return svg(Object.assign({ seed: tag + '|' + (ld.name || ''), group: n.group || 'latin', kind: kind === 'admiral' ? 'admiral' : 'general',
        color: n.color, religion: n.religion, skill: ld.skill || 1, sub: SUBS[tag] || null }, extra || {}));
    },
    clearCache() { cache.clear(); },
  };
})(window.G || (window.G = {}));
