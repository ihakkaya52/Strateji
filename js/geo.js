// Coğrafi harita: arazi dokusu, eski atlaslardaki gibi dağ / orman / çöl simgeleri, nehirler ve coğrafi adlar
'use strict';

(function () {
  const M = G.map;

  // Arazi türleri: oyun etkileri ve harita renkleri
  G.TERRAIN = {
    ova: { name: 'Ova', def: 1, move: 1, color: [164, 172, 108] },
    orman: { name: 'Orman', def: 1.12, move: 0.8, color: [96, 124, 70], noFlank: true },
    tayga: { name: 'Tayga', def: 1.1, move: 0.75, color: [78, 104, 78], noFlank: true },
    bozkir: { name: 'Bozkır', def: 0.95, move: 1.1, color: [190, 180, 118] },
    col: { name: 'Çöl', def: 1, move: 0.85, color: [222, 196, 140] },
    dag: { name: 'Dağlık', def: 1.3, move: 0.6, color: [150, 134, 110], noFlank: true },
    tepe: { name: 'Tepelik', def: 1.15, move: 0.8, color: [172, 158, 112] },
    bataklik: { name: 'Bataklık', def: 1.2, move: 0.6, color: [122, 138, 100], noFlank: true },
    tundra: { name: 'Tundra', def: 1.05, move: 0.8, color: [184, 188, 172] },
  };
  G.terrainOf = p => G.TERRAIN[p.terrain] || G.TERRAIN.ova;

  const CLS = ['', 'dag', 'col', 'yayla', 'bataklik', 'tundra'];
  const R = 6;   // doku çözünürlüğü (piksel / harita birimi)

  // ------------------------------------------------------------ hazırlık
  M.geoInit = function () {
    const W = window.WORLD, geo = W.geo || { regions: [], rivers: [] };
    // nehirler: genişlik sınıfına göre ayrı yollar
    M.rivers = [];
    for (const r of geo.rivers) {
      const path = new Path2D();
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (const l of r.lines) {
        path.moveTo(l[0], l[1]);
        for (let i = 2; i < l.length; i += 2) {
          path.lineTo(l[i], l[i + 1]);
          bx0 = Math.min(bx0, l[i]); bx1 = Math.max(bx1, l[i]); by0 = Math.min(by0, l[i + 1]); by1 = Math.max(by1, l[i + 1]);
        }
      }
      // adın yazılacağı yer: en uzun kolun ortası
      const long = r.lines.reduce((a, b) => (b.length > a.length ? b : a));
      const k = Math.floor(long.length / 4) * 2;
      const ang = Math.atan2(long[k + 3] - long[k + 1], long[k + 2] - long[k]);
      M.rivers.push({ path, w: r.w, name: r.name, lx: long[k], ly: long[k + 1],
        ang: Math.abs(ang) > Math.PI / 2 ? ang + Math.PI : ang, bbox: [bx0, by0, bx1, by1] });
    }
    M.geoRegions = geo.regions;
  };

  // Bölge maskesi: her pikselde dağ / çöl / yayla / bataklık / tundra kodu
  M.geoMask = function () {
    if (M._geoMask) return M._geoMask;
    const [x0, y0, x1, y1] = window.WORLD.bounds;
    const w = Math.ceil((x1 - x0) * R), h = Math.ceil((y1 - y0) * R);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.setTransform(R, 0, 0, R, -x0 * R, -y0 * R);
    // önce geniş sınıflar, en son dağlar (üstte kalsın)
    const order = ['tundra', 'yayla', 'bataklik', 'col', 'dag'];
    for (const cls of order) {
      x.fillStyle = `rgb(${CLS.indexOf(cls)},0,0)`;
      for (const g of M.geoRegions) {
        if (g.c !== cls) continue;
        const p = new Path2D();
        for (const r of g.poly) { p.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]); p.closePath(); }
        x.fill(p);
      }
    }
    const d = x.getImageData(0, 0, w, h).data;
    const m = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) m[i] = d[i * 4 + 3] > 128 ? d[i * 4] : 0;
    // kara maskesi: eyaletler ve keşfedilmemiş topraklar
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
    x.setTransform(R, 0, 0, R, -x0 * R, -y0 * R);
    x.fillStyle = '#fff';
    for (const p of M.paths) x.fill(p);
    x.fillStyle = '#f00';
    x.fill(M.unkPath);
    const d2 = x.getImageData(0, 0, w, h).data;
    const land = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) land[i] = d2[i * 4 + 3] > 100 ? (d2[i * 4 + 1] > 128 ? 1 : 2) : 0;   // 1 eyalet, 2 keşfedilmemiş
    M._geoMask = { m, land, w, h, x0, y0 };
    return M._geoMask;
  };
  const maskAt = (wx, wy) => {
    const g = M._geoMask, i = Math.floor((wx - g.x0) * R), j = Math.floor((wy - g.y0) * R);
    if (i < 0 || j < 0 || i >= g.w || j >= g.h) return 0;
    return g.m[j * g.w + i];
  };

  // Basit değer gürültüsü
  const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  const noise = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const fbm = (x, y) => noise(x, y) * 0.55 + noise(x * 2.1, y * 2.1) * 0.3 + noise(x * 4.3, y * 4.3) * 0.15;

  // Orman ve açık ova eyalet sınırına göre değil, gürültüye göre kümelenir: doğal orman lekeleri
  M.forestify = function (t, wx, wy) {
    if (t !== 'orman' && t !== 'ova' && t !== 'tayga') return t;
    const n = fbm(wx * 1.4 + 31, wy * 1.4 + 7);
    if (t === 'orman') return n > 0.4 ? 'orman' : 'ova';
    if (t === 'tayga') return n > 0.3 ? 'tayga' : 'ova';
    return n > 0.66 ? 'orman' : 'ova';
  };

  // Arazi dokusu: bir kez üretilen boyalı atlas zemini
  M.geoTexture = function () {
    if (M._geoTex) return M._geoTex;
    const g = M.geoMask(), P = G.S ? G.S.provinces : window.WORLD.provinces;
    const c = document.createElement('canvas');
    c.width = g.w; c.height = g.h;
    const x = c.getContext('2d'), img = x.createImageData(g.w, g.h), d = img.data;
    const T = G.TERRAIN;
    for (let j = 0; j < g.h; j++) {
      const wy = g.y0 + (j + 0.5) / R;
      for (let i = 0; i < g.w; i++) {
        const k = j * g.w + i, L = g.land[k];
        if (!L) continue;
        const wx = g.x0 + (i + 0.5) / R;
        let t;
        const mc = CLS[g.m[k]];
        if (mc === 'dag') t = 'dag';
        else if (mc === 'col') t = 'col';
        else if (mc === 'bataklik') t = 'bataklik';
        else if (mc === 'tundra') t = 'tundra';
        else if (L === 1) {
          const id = M.gridAt(wx, wy);
          t = id >= 0 ? (P[id].terrain || 'ova') : 'ova';
          if (mc === 'yayla' && (t === 'ova' || t === 'bozkir')) t = 'tepe';
          if (t === 'dag') t = 'tepe';   // maskede dağ yoksa eyalet geneli tepelik görünür
          t = M.forestify(t, wx, wy);
        } else {
          // keşfedilmemiş Afrika: enlemlere göre kaba iklim
          const lat = G.unprojLat(wy);
          t = mc === 'yayla' ? 'tepe' : Math.abs(lat) < 7 ? 'orman' : Math.abs(lat) < 16 ? 'bozkir' : lat < -18 ? 'bozkir' : 'ova';
        }
        const col = T[t].color;
        const n = fbm(wx * 0.9, wy * 0.9), n2 = noise(wx * 5, wy * 5);
        let v = 0.86 + n * 0.22 + (n2 - 0.5) * 0.06;
        if (t === 'dag') v = 0.78 + fbm(wx * 2.4, wy * 2.4) * 0.42;   // kabartı hissi
        d[k * 4] = Math.min(255, col[0] * v); d[k * 4 + 1] = Math.min(255, col[1] * v); d[k * 4 + 2] = Math.min(255, col[2] * v);
        d[k * 4 + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    // yumuşat: iki kez küçültüp büyüt
    const s = document.createElement('canvas');
    s.width = g.w; s.height = g.h;
    const sx = s.getContext('2d');
    sx.filter = 'blur(1.2px)';
    sx.drawImage(c, 0, 0);
    M._geoTex = s;
    return s;
  };

  // ------------------------------------------------------------ simgeler (harita biriminde, bir kez üretilir)
  M.geoGlyphs = function () {
    if (M._glyphs) return M._glyphs;
    M.geoMask();
    const P = G.S ? G.S.provinces : window.WORLD.provinces;
    const [x0, y0, x1, y1] = window.WORLD.bounds;
    const per = P.map(() => null);
    const get = id => (per[id] ||= {
      mtnL: new Path2D(), mtnD: new Path2D(), mtnS: new Path2D(), tree: new Path2D(), treeD: new Path2D(), pine: new Path2D(),
      dune: new Path2D(), grass: new Path2D(), hill: new Path2D(), reed: new Path2D(), n: 0,
      mtnLc: new Path2D(), mtnDc: new Path2D(), mtnSc: new Path2D(), treec: new Path2D(), pinec: new Path2D(), dunec: new Path2D(), hillc: new Path2D(),
    });
    const step = 0.34;
    let row = 0;
    for (let y = y0; y < y1; y += step * 0.8, row++) {
      for (let x = x0 + (row % 2) * step / 2; x < x1; x += step) {
        const jx = x + (hash(x, y) - 0.5) * step * 0.5, jy = y + (hash(y, x) - 0.5) * step * 0.4;
        const id = M.gridAt(jx, jy);
        if (id < 0) continue;
        const p = P[id];
        if (p.kind === 'waste' && p.terrain === 'tundra' && hash(jx * 3, jy) > 0.3) continue;
        const mc = CLS[maskAt(jx, jy)];
        let t = mc === 'dag' ? 'dag' : mc === 'col' ? 'col' : mc === 'bataklik' ? 'bataklik' : mc === 'yayla' ? 'tepe' : p.terrain;
        if (t === 'dag' && mc !== 'dag') t = 'tepe';
        t = M.forestify(t, jx, jy);
        const g = get(id), r = hash(jx * 7.1, jy * 3.3), coarse = r < 0.33;
        g.n++;
        if (t === 'dag') {
          const w = 0.15 + r * 0.07, h = w * (1.5 + hash(jx, jy * 2) * 0.6);
          const add = (L, D, S) => {
            L.moveTo(jx - w, jy); L.lineTo(jx, jy - h); L.lineTo(jx + 0.1 * w, jy); L.closePath();
            D.moveTo(jx + 0.1 * w, jy); D.lineTo(jx, jy - h); D.lineTo(jx + w, jy); D.closePath();
            S.moveTo(jx - w, jy); S.lineTo(jx, jy - h); S.lineTo(jx + w, jy);
            // kar
            if (h > 0.3) { S.moveTo(jx - w * 0.3, jy - h * 0.7); S.lineTo(jx, jy - h * 0.62); S.lineTo(jx + w * 0.3, jy - h * 0.72); }
          };
          add(g.mtnL, g.mtnD, g.mtnS);
          if (coarse) add(g.mtnLc, g.mtnDc, g.mtnSc);
        } else if (t === 'tepe') {
          if (r > 0.55) continue;
          const w = 0.13 + r * 0.05;
          const add = H => { H.moveTo(jx - w, jy); H.quadraticCurveTo(jx, jy - w * 1.2, jx + w, jy); };
          add(g.hill); if (coarse) add(g.hillc);
        } else if (t === 'orman') {
          if (r > 0.8) continue;
          const rr = 0.065 + r * 0.03;
          const add = (T, D) => {
            T.moveTo(jx + rr, jy - rr); T.arc(jx, jy - rr, rr, 0, Math.PI * 2);
            D.moveTo(jx + rr, jy - rr); D.arc(jx, jy - rr, rr, -0.4, Math.PI * 0.6);
          };
          add(g.tree, g.treeD); if (coarse) add(g.treec, g.treeD);
        } else if (t === 'tayga') {
          if (r > 0.8) continue;
          const w = 0.055 + r * 0.02, h = w * 3;
          const add = T => { T.moveTo(jx - w, jy); T.lineTo(jx, jy - h); T.lineTo(jx + w, jy); T.closePath(); };
          add(g.pine); if (coarse) add(g.pinec);
        } else if (t === 'col') {
          if (r > 0.6) continue;
          const w = 0.16 + r * 0.06;
          const add = D => { D.moveTo(jx - w, jy); D.quadraticCurveTo(jx - w * 0.2, jy - w * 0.5, jx + w * 0.3, jy - w * 0.1); D.quadraticCurveTo(jx + w * 0.7, jy + w * 0.1, jx + w, jy); };
          add(g.dune); if (coarse) add(g.dunec);
        } else if (t === 'bozkir' || t === 'ova') {
          if (r > (t === 'bozkir' ? 0.45 : 0.18)) continue;
          const s = 0.05;
          g.grass.moveTo(jx - s, jy); g.grass.lineTo(jx - s * 1.4, jy - s * 1.6);
          g.grass.moveTo(jx, jy); g.grass.lineTo(jx, jy - s * 2);
          g.grass.moveTo(jx + s, jy); g.grass.lineTo(jx + s * 1.4, jy - s * 1.6);
        } else if (t === 'bataklik') {
          if (r > 0.7) continue;
          const s = 0.08;
          g.reed.moveTo(jx - s * 1.5, jy); g.reed.lineTo(jx + s * 1.5, jy);
          g.reed.moveTo(jx - s * 0.5, jy); g.reed.lineTo(jx - s * 0.7, jy - s * 1.8);
          g.reed.moveTo(jx + s * 0.4, jy); g.reed.lineTo(jx + s * 0.6, jy - s * 1.6);
        } else if (t === 'tundra') {
          if (r > 0.25) continue;
          g.grass.moveTo(jx - 0.06, jy); g.grass.lineTo(jx + 0.06, jy);
        }
      }
    }
    M._glyphs = per;
    return per;
  };

  // ------------------------------------------------------------ çizim
  // Coğrafi kipte eyalet dolguları yerine boyalı zemin ve simgeler
  M.drawGeoLand = function (vis, sc) {
    const ctx = M.ctx, tex = M.geoTexture(), g = M._geoMask;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tex, g.x0, g.y0, g.w / R, g.h / R);
    ctx.restore();
    if (sc < 6) return;
    const gl = M.geoGlyphs(), coarse = sc < 15, lw = 1 / sc;
    for (const i of vis) {
      const q = gl[i];
      if (!q || !q.n) continue;
      ctx.fillStyle = 'rgba(214,200,170,0.95)'; ctx.fill(coarse ? q.mtnLc : q.mtnL);
      ctx.fillStyle = 'rgba(112,96,76,0.95)'; ctx.fill(coarse ? q.mtnDc : q.mtnD);
      ctx.strokeStyle = 'rgba(60,46,32,0.9)'; ctx.lineWidth = 1.1 * lw; ctx.stroke(coarse ? q.mtnSc : q.mtnS);
      ctx.strokeStyle = 'rgba(110,92,62,0.85)'; ctx.lineWidth = 1.2 * lw; ctx.stroke(coarse ? q.hillc : q.hill);
      ctx.fillStyle = 'rgba(70,100,52,0.95)'; ctx.fill(coarse ? q.treec : q.tree);
      ctx.fillStyle = 'rgba(40,62,30,0.6)'; ctx.fill(q.treeD);
      ctx.fillStyle = 'rgba(52,80,58,0.95)'; ctx.fill(coarse ? q.pinec : q.pine);
      ctx.strokeStyle = 'rgba(170,140,90,0.9)'; ctx.lineWidth = 1 * lw; ctx.stroke(coarse ? q.dunec : q.dune);
      if (!coarse) {
        ctx.strokeStyle = 'rgba(110,112,64,0.7)'; ctx.lineWidth = 0.9 * lw; ctx.stroke(q.grass);
        ctx.strokeStyle = 'rgba(70,92,80,0.8)'; ctx.stroke(q.reed);
      }
    }
  };

  // Nehirler: bütün kiplerde ince, coğrafi kipte belirgin
  M.drawRivers = function (sc, strong) {
    if (!M.rivers || sc < 5) return;
    const ctx = M.ctx, v = M.toWorld(0, 0), v2 = M.toWorld(M.w, M.h);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const r of M.rivers) {
      const b = r.bbox;
      if (b[2] < v.x || b[0] > v2.x || b[3] < v.y || b[1] > v2.y) continue;
      if (!strong && r.w > 5 && sc < 14) continue;
      const px = Math.max(0.7, (8 - r.w) * 0.55) * (strong ? 1.3 : 0.9) * Math.min(1.6, Math.max(0.7, sc / 25));
      ctx.strokeStyle = strong ? 'rgba(70,110,130,0.9)' : 'rgba(80,120,135,0.5)';
      ctx.lineWidth = px / sc;
      ctx.stroke(r.path);
    }
  };

  // Dağ, çöl ve nehir adları (ekran koordinatlarında)
  M.drawGeoNames = function () {
    const ctx = M.ctx, sc = M.cam.scale;
    if (sc < 8) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const g of M.geoRegions || []) {
      if (!g.name) continue;
      const big = g.area > 25;
      if (!big && sc < 18) continue;
      if (sc > 80) continue;
      const s = M.toScreen(g.x, g.y);
      if (s.x < -200 || s.x > M.w + 200 || s.y < -30 || s.y > M.h + 30) continue;
      const fs = G.clamp(sc * (big ? 0.7 : 0.5), 10, 20);
      ctx.font = `italic 600 ${fs}px ${G.FONT_BODY}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(fs * 0.3)}px`;
      ctx.strokeStyle = 'rgba(240,226,190,0.55)'; ctx.lineWidth = 3;
      ctx.fillStyle = g.c === 'col' ? 'rgba(120,80,30,0.85)' : 'rgba(70,50,30,0.85)';
      ctx.strokeText(g.name.toUpperCase(), s.x, s.y); ctx.fillText(g.name.toUpperCase(), s.x, s.y);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    if (sc < 16) return;
    ctx.font = `italic ${G.clamp(sc * 0.35, 10, 15)}px ${G.FONT_BODY}`;
    for (const r of M.rivers || []) {
      if (!r.name || r.w > 6) continue;
      const s = M.toScreen(r.lx, r.ly);
      if (s.x < -100 || s.x > M.w + 100 || s.y < -30 || s.y > M.h + 30) continue;
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(r.ang);
      ctx.strokeStyle = 'rgba(240,230,200,0.6)'; ctx.lineWidth = 2.5;
      ctx.fillStyle = 'rgba(40,80,110,0.95)';
      ctx.strokeText(r.name, 0, -6); ctx.fillText(r.name, 0, -6);
      ctx.restore();
    }
  };
})();
