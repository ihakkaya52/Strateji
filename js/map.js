// Harita çizimi: kamera, eyaletler, sınırlar, etiketler, ordular
'use strict';

G.map = {};

const M = G.map;
M.mode = 'political';
M.cam = { x: 30, y: -50, scale: 20 };
M.hoverProv = null;
M.selProv = null;
M.counterRects = [];

M.init = function (canvas) {
  M.canvas = canvas;
  M.ctx = canvas.getContext('2d');
  const W = window.WORLD;
  M.paths = [];
  M.bbox = [];
  for (const p of W.provinces) {
    const path = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of p.poly) {
      path.moveTo(r[0], r[1]);
      for (let i = 2; i < r.length; i += 2) {
        path.lineTo(r[i], r[i + 1]);
        if (r[i] < x0) x0 = r[i]; if (r[i] > x1) x1 = r[i];
        if (r[i + 1] < y0) y0 = r[i + 1]; if (r[i + 1] > y1) y1 = r[i + 1];
      }
      path.closePath();
    }
    M.paths.push(path);
    M.bbox.push([x0, y0, x1, y1]);
  }
  // deniz bölgeleri
  M.seaPaths = []; M.seaBbox = [];
  for (const z of W.seas || []) {
    const path = new Path2D();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const r of z.poly) {
      path.moveTo(r[0], r[1]);
      for (let i = 2; i < r.length; i += 2) {
        path.lineTo(r[i], r[i + 1]);
        x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); y0 = Math.min(y0, r[i + 1]); y1 = Math.max(y1, r[i + 1]);
      }
      path.closePath();
    }
    M.seaPaths.push(path); M.seaBbox.push([x0, y0, x1, y1]);
  }
  // keşfedilmemiş topraklar (henüz eyalet yok)
  M.unkPath = new Path2D();
  for (const r of W.unexplored || []) {
    M.unkPath.moveTo(r[0], r[1]);
    for (let i = 2; i < r.length; i += 2) M.unkPath.lineTo(r[i], r[i + 1]);
    M.unkPath.closePath();
  }
  M.unkCoast = new Path2D();
  for (const s of W.unexploredCoast || []) {
    M.unkCoast.moveTo(s[0], s[1]);
    for (let i = 2; i < s.length; i += 2) M.unkCoast.lineTo(s[i], s[i + 1]);
  }
  M.fogY = Math.max(...M.seaBbox.map(b => b[3]), -Infinity);
  // deniz bölgeleri arasındaki sınırlar (kıyı çizgisi hariç)
  M.seaEdgePath = new Path2D();
  for (const s of W.seaEdges || []) {
    M.seaEdgePath.moveTo(s[0], s[1]);
    for (let i = 2; i < s.length; i += 2) M.seaEdgePath.lineTo(s[i], s[i + 1]);
  }
  M.geoInit();
  M.edgeMap = new Map();
  for (const [a, b, segs] of W.edges) M.edgeMap.set(a < b ? a + '|' + b : b + '|' + a, segs);
  M.patterns = new Map();
  M.resize();
  M.buildGrid();
  window.addEventListener('resize', M.resize);
};

// Eyalet kimliklerinin kaba bir ızgarası: ülke adlarını sınır içine sığdırmak için
M.GRID_RES = 8;
M.buildGrid = function () {
  const W = window.WORLD, [x0, y0, x1, y1] = W.bounds, R = M.GRID_RES;
  const w = Math.ceil((x1 - x0) * R), h = Math.ceil((y1 - y0) * R);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  x.setTransform(R, 0, 0, R, -x0 * R, -y0 * R);
  for (let i = 0; i < M.paths.length; i++) {
    const v = i + 1;
    x.fillStyle = `rgb(${v >> 8},${v & 255},255)`;
    x.fill(M.paths[i]);
  }
  const d = x.getImageData(0, 0, w, h).data;
  const g = new Int16Array(w * h);
  for (let i = 0; i < w * h; i++) {
    g[i] = d[i * 4 + 2] === 255 ? ((d[i * 4] << 8) | d[i * 4 + 1]) - 1 : -1;
  }
  M.grid = { g, w, h, x0, y0 };
};
M.gridAt = function (wx, wy) {
  const G2 = M.grid, R = M.GRID_RES;
  const i = Math.floor((wx - G2.x0) * R), j = Math.floor((wy - G2.y0) * R);
  if (i < 0 || j < 0 || i >= G2.w || j >= G2.h) return -1;
  return G2.g[j * G2.w + i];
};

M.seaAt = function (sx, sy) {
  const w = M.toWorld(sx, sy), ctx = M.ctx;
  w.x = M.wrapX(w.x);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < M.seaPaths.length; i++) {
    const b = M.seaBbox[i];
    if (w.x < b[0] || w.x > b[2] || w.y < b[1] || w.y > b[3]) continue;
    if (ctx.isPointInPath(M.seaPaths[i], w.x, w.y)) return i;
  }
  return null;
};

M.resize = function () {
  const dpr = window.devicePixelRatio || 1;
  M.dpr = dpr;
  M.w = window.innerWidth; M.h = window.innerHeight;
  M.canvas.width = M.w * dpr; M.canvas.height = M.h * dpr;
  M.canvas.style.width = M.w + 'px'; M.canvas.style.height = M.h + 'px';
  G.mapDirty = true;
};

M.toWorld = (sx, sy) => ({ x: (sx - M.w / 2) / M.cam.scale + M.cam.x, y: (sy - M.h / 2) / M.cam.scale + M.cam.y });
M.toScreen = (wx, wy) => ({ x: (wx - M.cam.x) * M.cam.scale + M.w / 2, y: (wy - M.cam.y) * M.cam.scale + M.h / 2 });

M.clampCam = function () {
  const [x0, y0, x1, y1] = window.WORLD.bounds;
  M.cam.scale = G.clamp(M.cam.scale, Math.max(M.w / M.WORLD_W, 4), 400);
  M.cam.x = M.wrapX(M.cam.x);   // yatayda sonsuz: sınırı geçince öbür uçtan devam
  M.cam.y = G.clamp(M.cam.y, y0, y1);
};

M.zoomAt = function (sx, sy, factor) {
  const before = M.toWorld(sx, sy);
  M.cam.scale *= factor;
  M.clampCam();
  const after = M.toWorld(sx, sy);
  M.cam.x += before.x - after.x;
  M.cam.y += before.y - after.y;
  M.clampCam();
  G.mapDirty = true;
};

M.centerOn = function (pid, scale) {
  const p = G.S ? G.S.provinces[pid] : window.WORLD.provinces[pid];
  M.cam.x = p.x; M.cam.y = p.y;
  if (scale) M.cam.scale = scale;
  M.clampCam();
  G.mapDirty = true;
};

M.provinceAt = function (sx, sy) {
  const w = M.toWorld(sx, sy), ctx = M.ctx;
  w.x = M.wrapX(w.x);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const P = window.WORLD.provinces;
  for (let i = 0; i < P.length; i++) {
    const b = M.bbox[i];
    if (w.x < b[0] || w.x > b[2] || w.y < b[1] || w.y > b[3]) continue;
    if (ctx.isPointInPath(M.paths[i], w.x, w.y)) return i;
  }
  return null;
};

M.counterAt = function (sx, sy) {
  for (let i = M.counterRects.length - 1; i >= 0; i--) {
    const r = M.counterRects[i];
    if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return r;
  }
  return null;
};

// ------------------------------------------------------------ renkler
M.shade = function (hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  if (f >= 0) { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  else { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};

// Eski harita görünümü: ülke renkleri parşömen tonuyla karıştırılıp soldurulur
M.PARCHMENT = [205, 186, 145];
M.muted = new Map();
M.mute = function (hex) {
  let c = M.muted.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const grey = (r + g + b) / 3;
    const sat = 0.92, mix = 0.14, [pr, pg, pb] = M.PARCHMENT;
    r = (grey + (r - grey) * sat) * (1 - mix) + pr * mix;
    g = (grey + (g - grey) * sat) * (1 - mix) + pg * mix;
    b = (grey + (b - grey) * sat) * (1 - mix) + pb * mix;
    c = `rgb(${r | 0},${g | 0},${b | 0})`;
    M.muted.set(hex, c);
  }
  return c;
};

M.provColor = function (p) {
  const c = M.provColorRaw(p), h = M.legendHi;
  // lejantta üzerine gelinen din / kültür dışındaki iller soluklaşır
  if (h && (h.mode === 'religion' ? (p.relig || (p.owner && G.S && G.S.nations[p.owner] && G.S.nations[p.owner].religion)) !== h.key : p.cul !== h.key)) return 'rgb(150,140,118)';
  return c;
};
M.provColorRaw = function (p) {
  const S = G.S;
  if (S && M.mode === 'culture' && p.cul) return M.mute(G.cul.get(p.cul).color);
  if (p.kind === 'waste' && !p.owner) return S && M.mode === 'religion' && p.relig ? M.mute(G.RELIGIONS[p.relig].color) : '#6a5e48';
  if (!p.owner) {
    // keşfedilmiş ama sahipsiz topraklar: yerlilerin diyarı
    if (p.kind === 'wild') return M.mode === 'religion' && p.relig ? M.mute(G.RELIGIONS[p.relig].color) : '#a2967a';
    return '#5b5242';
  }
  const n = S ? S.nations[p.owner] : window.WORLD.nations[p.owner];
  if (M.mode === 'religion') return M.mute((G.RELIGIONS[p.relig || n.religion] || { color: '#888888' }).color);
  return M.mute(n.color);
};
// Oyuncunun haritasında görünmeyen (keşfedilmemiş) il
M.hidden = p => (p.kind === 'wild' || (p.kind === 'waste' && G.S)) && !p.owner && !(G.S && G.explore.known(p));

// Parşömen dokusu (bir kez üretilir)
M.paper = function () {
  if (M.paperPat) return M.paperPat;
  const c = document.createElement('canvas'), N = 256;
  c.width = c.height = N;
  const x = c.getContext('2d'), img = x.createImageData(N, N);
  const rnd = G.makeRng(7);
  // birkaç ölçekte gürültü: lekeli kâğıt hissi
  const layer = (cell, amp, acc) => {
    const g = [];
    const m = N / cell;
    for (let i = 0; i <= m; i++) { g.push([]); for (let j = 0; j <= m; j++) g[i].push(rnd()); }
    for (let i = 0; i <= m; i++) { g[i][m] = g[i][0]; g[m] = g[0]; }
    for (let y = 0; y < N; y++) for (let xx = 0; xx < N; xx++) {
      const gx = xx / cell, gy = y / cell, ix = gx | 0, iy = gy | 0;
      const fx = gx - ix, fy = gy - iy;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const a = g[iy][ix] + (g[iy][ix + 1] - g[iy][ix]) * sx;
      const b = g[iy + 1][ix] + (g[iy + 1][ix + 1] - g[iy + 1][ix]) * sx;
      acc[y * N + xx] += (a + (b - a) * sy) * amp;
    }
  };
  const acc = new Float32Array(N * N);
  layer(64, 0.5, acc); layer(16, 0.3, acc); layer(4, 0.2, acc);
  for (let i = 0; i < N * N; i++) {
    const v = 200 + acc[i] * 55;
    img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.96; img.data[i * 4 + 2] = v * 0.88; img.data[i * 4 + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  M.paperPat = M.ctx.createPattern(c, 'repeat');
  return M.paperPat;
};

M.hatch = function (color) {
  let pat = M.patterns.get(color);
  if (!pat) {
    const c = document.createElement('canvas');
    c.width = c.height = 10;
    const x = c.getContext('2d');
    x.strokeStyle = color; x.lineWidth = 3.2;
    x.beginPath();
    x.moveTo(-2, 12); x.lineTo(12, -2);
    x.moveTo(-2, 2); x.lineTo(2, -2);
    x.moveTo(8, 12); x.lineTo(12, 8);
    x.stroke();
    pat = M.ctx.createPattern(c, 'repeat');
    M.patterns.set(color, pat);
  }
  return pat;
};

// ------------------------------------------------------------ sınırlar ve etiketler
M.rebuildBorders = function () {
  const P = G.S ? G.S.provinces : window.WORLD.provinces;
  const lord = t => (G.S && t ? G.topLord(t) : t);
  const inner = new Path2D(), outer = new Path2D(), realm = new Path2D();
  for (const [a, b, segs] of window.WORLD.edges) {
    const pa = P[a], pb = P[b];
    const wa = pa.kind === 'waste', wb = pb.kind === 'waste';
    if (wa && wb) continue;
    if (M.hidden(pa) || M.hidden(pb)) continue;
    let target = inner;
    if (pa.owner !== pb.owner) target = lord(pa.owner) === lord(pb.owner) ? realm : outer;
    for (const s of segs) {
      target.moveTo(s[0], s[1]);
      for (let i = 2; i < s.length; i += 2) target.lineTo(s[i], s[i + 1]);
    }
  }
  M.innerBorders = inner;
  M.outerBorders = outer;
  M.realmBorders = realm;
};

M.rebuildLabels = function () {
  const S = G.S;
  const P = S ? S.provinces : window.WORLD.provinces;
  const seen = new Uint8Array(P.length);
  const comps = {};
  for (const p of P) {
    if (seen[p.id] || !p.owner || p.kind === 'waste') continue;
    // aynı sahibin bağlı bileşeni
    const comp = [], q = [p.id];
    seen[p.id] = 1;
    while (q.length) {
      const id = q.pop(), c = P[id];
      comp.push(c);
      for (const n of c.nb) {
        if (!seen[n] && P[n].owner === p.owner) { seen[n] = 1; q.push(n); }
      }
    }
    const area = comp.reduce((s, c) => s + M.areaOf(c.id), 0);
    if (!comps[p.owner] || comps[p.owner].area < area) comps[p.owner] = { comp, area };
  }
  M.labels = [];
  for (const [tag, { comp, area }] of Object.entries(comps)) {
    let sx = 0, sy = 0, sw = 0;
    for (const c of comp) { const w = M.areaOf(c.id); sx += c.x * w; sy += c.y * w; sw += w; }
    const mx = sx / sw, my = sy / sw;
    let cxx = 0, cyy = 0, cxy = 0;
    for (const c of comp) {
      const w = M.areaOf(c.id), dx = c.x - mx, dy = c.y - my;
      cxx += w * dx * dx; cyy += w * dy * dy; cxy += w * dx * dy;
    }
    let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    ang = G.clamp(ang, -0.5, 0.5);
    const spread = Math.sqrt(Math.max(cxx, cyy) / sw);
    const name = (S ? S.nations[tag] : window.WORLD.nations[tag]).name;
    const fit = M.fitLabel(tag, name, comp, mx, my, ang, spread, P);
    if (fit) M.labels.push({ tag, name, ...fit });
  }
};

// Adın yalnızca kendi topraklarının üzerinde kalacağı en büyük boyutu ve yeri bulur
M.fitLabel = function (tag, name, comp, mx, my, ang, spread, P) {
  const ctx = M.ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = `600 100px ${G.FONT_TITLE}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '20px';
  const w100 = ctx.measureText(name).width;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.restore();
  const test = (cx, cy, a, h) => {
    const W = w100 * h / 100, ca = Math.cos(a), sa = Math.sin(a);
    let bad = 0, sea = 0, tot = 0;
    for (let i = 0; i <= 14; i++) {
      const u = -W / 2 + W * i / 14;
      for (const v of [-0.33 * h, 0, 0.33 * h]) {
        tot++;
        const id = M.gridAt(cx + u * ca - v * sa, cy + u * sa + v * ca);
        if (id < 0) { sea++; continue; }
        const q = P[id];
        if (q.owner === tag) continue;
        if (q.kind === 'waste') sea++; else if (++bad > 0) return false;
      }
    }
    return sea <= tot * 0.25;
  };
  const best = (cx, cy, a) => {
    let lo = 0, hi = Math.max(0.3, spread * 0.6);
    if (test(cx, cy, a, hi)) return hi;
    for (let k = 0; k < 9; k++) {
      const mid = (lo + hi) / 2;
      if (test(cx, cy, a, mid)) lo = mid; else hi = mid;
    }
    return lo;
  };
  const cands = [[mx, my, ang], [mx, my, 0]];
  const near = comp.slice().sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my)).slice(0, 8);
  for (const c of near) { cands.push([c.x, c.y, ang]); cands.push([c.x, c.y, 0]); }
  let res = null;
  for (const [cx, cy, a] of cands) {
    const h = best(cx, cy, a);
    if (!res || h > res.h * 1.08) res = { x: cx, y: cy, ang: a, h };
  }
  return res && res.h > 0 ? res : null;
};

M.areaOf = id => {
  const b = M.bbox[id];
  return Math.max(0.01, (b[2] - b[0]) * (b[3] - b[1]) * 0.6);
};

// ------------------------------------------------------------ çizim
// Harita iki katmanda çizilir. Sabit katman (deniz, iller, sınırlar, parşömen dokusu, yazılar) ekranın biraz
// dışına taşan bir tuvale bir kez çizilip saklanır; kaydırma ve yakınlaştırma sırasında bu görüntü kaydırılıp
// ölçeklenir ve yalnızca harita değişince ya da görüntü ekranı örtmeyince yeniden çizilir. Hareketli katman
// (ordular, filolar, kuşatmalar, cepheler, seçim) her karede üste çizilir.
M.CACHE_MARGIN = 0.22;
M.tagIdx = new Map();
const tagId = t => { if (!t) return 0; let v = M.tagIdx.get(t); if (v == null) { v = M.tagIdx.size + 1; M.tagIdx.set(t, v); } return v; };
M.signature = function () {
  const S = G.S, P = S ? S.provinces : window.WORLD.provinces;
  const kult = M.mode === 'culture', din = M.mode === 'religion';
  let h = 7;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    h = (Math.imul(h, 31) + tagId(p.owner) * 4099 + (p.colony ? 77 : 0)) | 0;   // kale simgeleri bir sonraki yenilemede güncellenir
    if (kult) h = (Math.imul(h, 17) + tagId(p.cul)) | 0;
    if (din) h = (Math.imul(h, 17) + tagId(p.relig)) | 0;
  }
  const me = S && S.nations[S.player];
  const f = G.selFleet;
  return [h, M.mode, M.garrisonView ? 1 : 0, M.tradeView ? 1 : 0, M.selNation || '', M.legendHi ? M.legendHi.key : '',
    f ? f.id + ':' + (S.hour >> 3) : '', me && me.explored ? me.explored.size : 0, S ? Object.keys(S.nations).length : 0,
    M.labelVer || 0].join('|');
};
M.visibleProvs = function () {
  const P = G.S ? G.S.provinces : window.WORLD.provinces;
  const v = M.toWorld(0, 0), v2 = M.toWorld(M.w, M.h), vis = [];
  for (let i = 0; i < P.length; i++) {
    const b = M.bbox[i];
    if (b[2] < v.x || b[0] > v2.x || b[3] < v.y || b[1] > v2.y) continue;
    if (M.hidden(P[i])) continue;
    vis.push(i);
  }
  return vis;
};
// saklanan görüntünün ekrandaki yeri; ekranı örtmüyorsa null
M.cachePlace = function (C) {
  const cam = M.cam, k = cam.scale / C.sc;
  const cx = cam.x + M.dxWrap(cam.x, C.cx);
  let x = (cx - cam.x) * cam.scale + M.w / 2 - C.W / 2 * k;
  let y = (C.cy - cam.y) * cam.scale + M.h / 2 - C.H / 2 * k;
  if (x > 0.5 || y > 0.5 || x + C.W * k < M.w - 0.5 || y + C.H * k < M.h - 0.5) return null;
  if (k === 1) { x = Math.round(x * M.dpr) / M.dpr; y = Math.round(y * M.dpr) / M.dpr; }
  return { x, y, k };
};
// q < 1: kamera hareket halindeyken düşük çözünürlükte hızlı çizim; durunca tam çözünürlükte yeniden çizilir
M.renderCache = function (sig, q = 1) {
  const dpr = M.dpr, W = Math.ceil(M.w * (1 + 2 * M.CACHE_MARGIN)), H = Math.ceil(M.h * (1 + 2 * M.CACHE_MARGIN));
  const r = dpr * q;
  let C = M.cache;
  if (!C || C.W !== W || C.H !== H || C.dpr !== dpr || C.r !== r) {
    const cv = (C && C.cv) || document.createElement('canvas');
    cv.width = Math.round(W * r); cv.height = Math.round(H * r);
    C = M.cache = { cv, ctx: cv.getContext('2d'), W, H, dpr, r };
  }
  const real = { ctx: M.ctx, w: M.w, h: M.h, dpr: M.dpr };
  M.ctx = C.ctx; M.w = W; M.h = H; M.dpr = r;
  try { M.drawStatic(); } finally { M.ctx = real.ctx; M.w = real.w; M.h = real.h; M.dpr = real.dpr; }
  C.sig = sig; C.cx = M.cam.x; C.cy = M.cam.y; C.sc = M.cam.scale; C.t = performance.now(); C.q = q;
};

M.draw = function () {
  const cam = M.cam, sc = cam.scale, now = performance.now();
  // sınırlar ve ülke adları en fazla yarım saniyede bir yeniden kurulur (savaşta iller sık el değiştirir)
  if (!M.labels || (G.labelsDirty && now - (M._lblT || 0) > 500)) {
    M.rebuildBorders(); M.rebuildLabels(); G.labelsDirty = false; M.labelVer = (M.labelVer || 0) + 1; M._lblT = now;
  } else if (G.labelsDirty && !M._lblTimer) M._lblTimer = setTimeout(() => { M._lblTimer = null; G.mapDirty = true; }, 520);
  // yakınlaştırma sürerken eski görüntü ölçeklenir; durunca net olarak yeniden çizilir
  if (sc !== M._prevSc) { M._prevSc = sc; M._scT = now; clearTimeout(M._scTimer); M._scTimer = setTimeout(() => { G.mapDirty = true; }, 190); }
  const sig = M.signature();
  const C = M.cache;
  let place = C && C.dpr === M.dpr ? M.cachePlace(C) : null;
  if (place && place.k !== 1 && now - M._scT > 170) place = null;
  // harita verisi değişti: kamera oynamıyorsa sabit katman en fazla 0,35 saniyede bir yenilenir
  if (place && C.sig !== sig) {
    // yüksek hızlarda dünya çok hızlı değişir: yenileme seyrekleşir ki kare hızı düşmesin
    const gap = G.S && !G.S.paused && G.S.speed >= 4 ? 1200 : 350;
    if (now - C.t > gap) place = null;
    else if (!M._sigTimer) M._sigTimer = setTimeout(() => { M._sigTimer = null; G.mapDirty = true; }, gap + 10 - (now - C.t));
  }
  // kamera hareket ediyor mu? (kaydırma / yakınlaştırma)
  const camKey = cam.x.toFixed(4) + ',' + cam.y.toFixed(4) + ',' + sc;
  if (camKey !== M._camKey) { M._camKey = camKey; M._camT = now; }
  const moving = now - (M._camT || 0) < 220;
  if (place && M.cache.q < 1 && !moving) place = null;   // durdu: net çiz
  if (!place) {
    M.renderCache(sig, moving ? 0.5 : 1); place = M.cachePlace(M.cache);
    if (moving) { clearTimeout(M._sharpTimer); M._sharpTimer = setTimeout(() => { G.mapDirty = true; }, 240); }
  }
  const ctx = M.ctx, dpr = M.dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(M.cache.cv, place.x * dpr, place.y * dpr, M.cache.W * place.k * dpr, M.cache.H * place.k * dpr);
  M.counterRects = []; M.fleetRects = []; M.battleRects = [];
  for (const k of M.copies()) M.withCopy(k, () => M.drawDynamic());
  if (M.dragBox) {
    const b = M.dragBox;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,233,168,0.1)';
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }
};

// sabit katman (saklanan tuvale çizilir)
M.drawStatic = function () {
  const S = G.S, ctx = M.ctx, dpr = M.dpr, cam = M.cam, sc = cam.scale;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  const grd = ctx.createLinearGradient(0, 0, 0, M.h);
  grd.addColorStop(0, '#a9bab4'); grd.addColorStop(1, '#94a8a2');   // suluboya deniz
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, M.w, M.h);
  // dünya yuvarlak: harita yatayda tekrar eder; görünen her kopya ayrı çizilir
  const copies = M.copies();
  const visBy = {};
  for (const k of copies) M.withCopy(k, () => { visBy[k] = M.drawBase(); });
  {
    const ox = M.w / 2 - cam.x * sc, oy = M.h / 2 - cam.y * sc;
    // ekran koordinatlarına geç ve parşömen dokusunu bindir
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.55;
    const pat = M.paper();
    pat.setTransform(new DOMMatrix([1.6, 0, 0, 1.6, (ox * 0.25) % 410, (oy * 0.25) % 410]));
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, M.w, M.h);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // tam ekran karartmalar bir kez
  if (S && M.garrisonView) { ctx.fillStyle = 'rgba(10,8,5,0.42)'; ctx.fillRect(0, 0, M.w, M.h); }
  if (S && M.tradeView) { ctx.fillStyle = 'rgba(12,9,5,0.28)'; ctx.fillRect(0, 0, M.w, M.h); }
  for (const k of copies) M.withCopy(k, () => M.drawOverStatic(visBy[k]));
};

// hareketli katman (her karede)
M.drawDynamic = function () {
  const S = G.S, ctx = M.ctx, dpr = M.dpr, cam = M.cam, sc = cam.scale;
  const P = S ? S.provinces : window.WORLD.provinces;
  const ox = M.w / 2 - cam.x * sc, oy = M.h / 2 - cam.y * sc;
  ctx.setTransform(sc * dpr, 0, 0, sc * dpr, ox * dpr, oy * dpr);
  // seçili / üzerine gelinen eyalet
  if (M.hoverProv != null && !M.hidden(P[M.hoverProv])) {
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fill(M.paths[M.hoverProv]);
  }
  if (M.selProv != null) {
    ctx.fillStyle = 'rgba(255,240,200,0.22)';
    ctx.fill(M.paths[M.selProv]);
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 2 / sc;
    ctx.stroke(M.paths[M.selProv]);
  }
  if (!S) return;
  const vis = M.visibleProvs();
  // işgal taraması (hareketli katmanda: kuşatma ve işgaller sabit katmanı yeniden çizdirmez)
  if (M.mode === 'political') {
    for (const i of vis) {
      const p = P[i];
      if (!p.ctrl || p.ctrl === p.owner || !S.nations[p.ctrl]) continue;
      const pat = M.hatch(M.mute(S.nations[p.ctrl].color));
      pat.setTransform(new DOMMatrix([1 / sc, 0, 0, 1 / sc, 0, 0]));
      ctx.fillStyle = pat;
      ctx.fill(M.paths[i]);
    }
  }
  M.drawFronts(sc);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (M.garrisonView) M.drawGarrisons(vis, P, true);
  M.drawPorts(vis, P);
  M.drawSieges(vis, P);
  M.drawArrows();
  M.drawPaths();
  M.drawCounters();
  M.drawFleets();
  M.drawBattles();
  M.drawExploration();
  if (M.tradeView) M.drawTrade();
};

// Görünen dünya kopyaları (-1: batıdaki, 0: asıl, 1: doğudaki)
M.WORLD_W = 360;
M.copies = function () {
  const [x0, , x1] = window.WORLD.bounds, v = M.toWorld(0, 0), v2 = M.toWorld(M.w, M.h), out = [];
  for (const k of [-1, 0, 1]) if (x1 + k * M.WORLD_W >= v.x && x0 + k * M.WORLD_W <= v2.x) out.push(k);
  return out.length ? out : [0];
};
M.withCopy = function (k, fn) {
  if (!k) return fn();
  const cx = M.cam.x;
  M.cam.x = cx - k * M.WORLD_W;
  try { return fn(); } finally { M.cam.x = cx; }
};
M.wrapX = x => {
  const x0 = window.WORLD.bounds[0];
  return ((x - x0) % M.WORLD_W + M.WORLD_W) % M.WORLD_W + x0;
};
// En kısa yönde yatay fark (sınırdan geçerek gitmek daha kısaysa onu seçer)
M.dxWrap = (a, b) => { let d = (b - a) % M.WORLD_W; if (d > M.WORLD_W / 2) d -= M.WORLD_W; if (d < -M.WORLD_W / 2) d += M.WORLD_W; return d; };

M.drawBase = function () {
  const S = G.S, ctx = M.ctx, dpr = M.dpr, cam = M.cam, sc = cam.scale;
  const P = S ? S.provinces : window.WORLD.provinces;
  const ox = M.w / 2 - cam.x * sc, oy = M.h / 2 - cam.y * sc;
  ctx.setTransform(sc * dpr, 0, 0, sc * dpr, ox * dpr, oy * dpr);
  const v = M.toWorld(0, 0), v2 = M.toWorld(M.w, M.h);
  const vis = [];
  for (let i = 0; i < P.length; i++) {
    const b = M.bbox[i];
    if (b[2] < v.x || b[0] > v2.x || b[3] < v.y || b[1] > v2.y) continue;
    if (M.hidden(P[i])) continue;
    vis.push(i);
  }

  // deniz bölgeleri: seçili filonun menzili ve bölge sınırları
  if (S && S.seas && sc > 5) {
    const f = G.selFleet;
    if (f) {
      for (let i = 0; i < M.seaPaths.length; i++) {
        ctx.fillStyle = G.navy.reachable(f, i) ? 'rgba(150,215,230,0.2)' : 'rgba(0,0,0,0.3)';
        ctx.fill(M.seaPaths[i]);
      }
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(60,85,88,0.07)';
    ctx.lineWidth = 5 / sc;
    ctx.stroke(M.seaEdgePath);
    ctx.setLineDash([0.5 / sc, 4 / sc]);
    ctx.strokeStyle = 'rgba(50,75,78,0.32)';
    ctx.lineWidth = 1.3 / sc;
    ctx.stroke(M.seaEdgePath);
    ctx.setLineDash([]);
  }

  M.drawUnexplored(sc);
  if (S) M.drawHiddenFog(P, v, v2, sc);

  // kıyı: eski haritalardaki gibi yumuşak, katmanlı su çizgisi
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // (yalnızca denize komşu iller: iç kesimlerin çizgileri zaten dolgunun altında kalıyordu)
  const coast = vis.filter(i => P[i].sea && P[i].sea.length);
  ctx.strokeStyle = 'rgba(70, 98, 102, 0.13)';
  ctx.lineWidth = 9 / sc;
  for (const i of coast) ctx.stroke(M.paths[i]);
  ctx.strokeStyle = 'rgba(55, 82, 86, 0.30)';
  ctx.lineWidth = 3.5 / sc;
  for (const i of coast) ctx.stroke(M.paths[i]);

  // dolgular (coğrafi kipte boyalı arazi zemini)
  const geo = M.mode === 'geo';
  const selNation = M.selNation;
  if (geo) M.drawGeoLand(vis, sc);
  else for (const i of vis) {
    const p = P[i];
    ctx.fillStyle = M.provColor(p);
    ctx.fill(M.paths[i]);
    if (selNation && p.owner === selNation) {
      ctx.fillStyle = 'rgba(255,245,220,0.2)';
      ctx.fill(M.paths[i]);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0)';
  // işgal taraması
  M.drawRivers(sc, geo);
  if (S) M.drawColonies(vis, P, sc);

  // sınırlar: yumuşak, iki katmanlı (geniş gölge + ince mürekkep)
  if (sc > 7 && !geo) {
    ctx.strokeStyle = `rgba(40,28,14,${G.clamp((sc - 7) / 45, 0, 0.2)})`;
    ctx.lineWidth = 0.5 / sc;
    ctx.stroke(M.innerBorders);
  }
  const bw = Math.min(1.6, 0.5 + sc / 40);
  if (geo) {
    // coğrafi kipte sınırlar ince, kesik kırmızı mürekkep
    ctx.setLineDash([4 / sc, 3 / sc]);
    ctx.strokeStyle = 'rgba(120,30,20,0.5)';
    ctx.lineWidth = bw * 0.9 / sc;
    ctx.stroke(M.outerBorders);
    ctx.setLineDash([]);
  } else {
  // devletler arası: en kalın (gölge + koyu mürekkep)
  ctx.strokeStyle = 'rgba(30,20,10,0.12)';
  ctx.lineWidth = bw * 3.4 / sc;
  ctx.stroke(M.outerBorders);
  ctx.strokeStyle = 'rgba(35,24,12,0.5)';
  ctx.lineWidth = bw * 1.15 / sc;
  ctx.stroke(M.outerBorders);
  }
  // efendi ile vasalı arası: orta kalınlıkta düz mürekkep
  if (!geo) {
    ctx.strokeStyle = 'rgba(30,20,10,0.10)';
    ctx.lineWidth = bw * 2.2 / sc;
    ctx.stroke(M.realmBorders);
  }
  ctx.strokeStyle = 'rgba(35,24,12,0.4)';
  ctx.lineWidth = bw * 0.7 / sc;
  ctx.stroke(M.realmBorders);

  return vis;
};

M.drawOverStatic = function (vis) {
  const S = G.S, ctx = M.ctx;
  const P = S ? S.provinces : window.WORLD.provinces;
  const geo = M.mode === 'geo';
  ctx.setTransform(M.dpr, 0, 0, M.dpr, 0, 0);
  M.drawUnexploredNames();
  if (geo) { M.drawGeoNames(); ctx.globalAlpha = 0.5; }
  M.drawLabels(vis, P);
  ctx.globalAlpha = 1;
  if (S) M.drawSeaNames();
};

M.drawLabels = function (vis, P) {
  const ctx = M.ctx, sc = M.cam.scale;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // ülke adları: silik, ince, harfleri aralıklı
  for (const L of M.labels) {
    const fs = Math.min(L.h * sc, 30);
    if (fs < 9) continue;
    if (sc > 70 && fs > 22) continue;
    const s = M.toScreen(L.x, L.y);
    if (s.x < -400 || s.x > M.w + 400 || s.y < -100 || s.y > M.h + 100) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(L.ang);
    ctx.font = `600 ${fs | 0}px ${G.FONT_TITLE}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(fs / 5).toFixed(1)}px`;
    // din ve kültür kiplerinde canlı renklerin üstünde adlar daha belirgin: açık hale + koyu mürekkep
    const strong = M.mode === 'religion' || M.mode === 'culture';
    if (strong) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(250,242,222,0.55)';
      ctx.lineWidth = Math.max(2, fs / 7);
      ctx.strokeText(L.name, 0, 0);
    }
    ctx.shadowColor = 'rgba(250,242,222,0.6)';
    ctx.shadowBlur = fs / 4;
    ctx.fillStyle = `rgba(42,28,14,${strong ? 0.85 : fs > 18 ? 0.5 : 0.62})`;   // mürekkep
    ctx.fillText(L.name, 0, 0);
    ctx.shadowBlur = 0;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }
  // şehir adları
  if (sc < 28) return;
  ctx.font = `${sc > 60 ? 14 : 12}px ${G.FONT_BODY}`;
  for (const i of vis) {
    const p = P[i];
    if (p.kind === 'waste') { if (sc < 45) continue; }
    else if (p.kind === 'wild') { if (sc < 16) continue; }
    else if (p.kind === 'rural' && sc < 90) continue;
    const s = M.toScreen(p.x, p.y);
    if (p.kind === 'capital' || p.kind === 'city') {
      // yıldız yalnızca bugünkü başkentlerde; fethedilmiş eski başkentler sıradan şehir gibi görünür
      const cap = G.S ? G.econ.isCapital(p) : p.kind === 'capital';
      ctx.fillStyle = cap ? '#e8c869' : '#efe4c8';
      ctx.strokeStyle = 'rgba(30,20,10,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath();
      if (cap) M.star(ctx, s.x, s.y, 5, 2.4);
      else ctx.arc(s.x, s.y, 2.3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    if (G.S && p.fort && sc >= 40) M.drawFort(ctx, s.x - 14, s.y - 2, p);
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(25,16,8,0.45)';
    const soft = p.kind === 'rural' || p.kind === 'waste' || p.kind === 'wild';
    ctx.fillStyle = p.kind === 'waste' || p.kind === 'wild' ? 'rgba(235,222,190,0.7)' : 'rgba(255,248,230,0.85)';
    const ty = soft ? s.y : s.y + 11;
    if (soft) ctx.font = `italic ${sc > 60 ? 13 : 11}px ${G.FONT_BODY}`;
    ctx.strokeText(p.name, s.x, ty);
    ctx.fillText(p.name, s.x, ty);
    if (soft) ctx.font = `${sc > 60 ? 14 : 12}px ${G.FONT_BODY}`;
  }
};

M.star = function (ctx, x, y, r1, r2) {
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? r2 : r1, a = -Math.PI / 2 + i * Math.PI / 5;
    if (i === 0) ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
    else ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
};

M.drawSieges = function (vis, P) {
  const ctx = M.ctx, S = G.S;
  for (const i of vis) {
    const p = P[i];
    if (!p.siege) continue;
    const s = M.toScreen(p.x, p.y), sg = p.siege, col = S.nations[sg.by].color;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    if (!sg.fort) {
      const f = G.clamp(sg.progress / sg.need, 0, 1);
      ctx.fillRect(s.x - 17, s.y + 10, 34, 6);
      ctx.fillStyle = col;
      ctx.fillRect(s.x - 16, s.y + 11, 32 * f, 4);
      continue;
    }
    // kale: üstte sur, altta erzak çubuğu
    ctx.fillRect(s.x - 20, s.y + 10, 40, 10);
    ctx.fillStyle = '#c8b48a'; ctx.fillRect(s.x - 19, s.y + 11, 38 * p.walls / 100, 3.5);
    ctx.fillStyle = '#7fbf5a'; ctx.fillRect(s.x - 19, s.y + 15.5, 38 * sg.food / sg.foodMax, 3.5);
    ctx.strokeStyle = sg.assault ? ((S.hour >> 1) % 2 ? '#ff3b2a' : '#ffd060') : sg.stalled ? '#ff5a3a' : col;
    ctx.lineWidth = sg.assault ? 2.5 : 1.5;
    ctx.strokeRect(s.x - 20.5, s.y + 9.5, 41, 11);
    if (sg.assault) {
      ctx.font = `14px ${G.FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd060'; ctx.fillText('⚔', s.x + 28, s.y + 15);
    }
  }
};

M.drawPaths = function () {
  const ctx = M.ctx, S = G.S, P = S.provinces;
  ctx.lineWidth = 2;
  for (const a of S.armies) {
    if (!a.path.length || a.fleet != null) continue;
    const mine = a.tag === S.player;
    if (!mine && !a.sel) continue;
    ctx.strokeStyle = a.sel ? 'rgba(255,230,140,0.95)' : 'rgba(255,230,140,0.45)';
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    let s = M.toScreen(P[a.prov].x, P[a.prov].y);
    ctx.moveTo(s.x, s.y);
    for (const id of a.path) { s = M.toScreen(P[id].x, P[id].y); ctx.lineTo(s.x, s.y); }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
  }
};

M.drawCounters = function () {
  const ctx = M.ctx, S = G.S, P = S.provinces, sc = M.cam.scale;
  if (sc < 7) return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const small = sc < 16;
  const w = small ? 22 : 44, h = small ? 9 : 19;
  const slot = new Map();   // aynı noktadaki orduları üst üste diz
  for (const a of S.armies) {
    if (a.fleet != null) continue;
    const p = P[a.prov], n = S.nations[a.tag];
    // uzaktan bakarken yalnızca bizi ilgilendiren orduları göster
    if (sc < 32 && a.tag !== S.player && !G.atWar(S.player, a.tag)) continue;
    let s = M.toScreen(p.x, p.y);
    let key = a.prov;
    // hareket halindeki ordu ilerlemeye göre kaydırılır
    if (a.path.length && a.prog > 0 && !a.attacking) {
      const nx = P[a.path[0]], i = p.nb.indexOf(nx.id), d = i >= 0 ? p.nbDist[i] : 100;
      const f = G.clamp(a.prog / d, 0, 1);
      const t = M.toScreen(nx.x, nx.y);
      s = { x: s.x + (t.x - s.x) * f, y: s.y + (t.y - s.y) * f };
      key = a.prov + '>' + nx.id;
    }
    const k = slot.get(key) || 0;
    slot.set(key, k + 1);
    const x = s.x - w / 2, y = s.y - h - 3 - k * (h + 3);
    if (x < -60 || x > M.w + 60 || y < -40 || y > M.h + 20) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = n.color;
    ctx.fillRect(x, y, w, h);
    if (!small) {
      // mareşal rengi şeridi
      const m = a.marshal != null && a.tag === S.player ? G.command.marshal(a.marshal) : null;
      if (m) { ctx.fillStyle = m.color; ctx.fillRect(x, y, 4, h); }
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(x, y + h - 5, w, 5);
      ctx.fillStyle = '#6fd05a';
      ctx.fillRect(x, y + h - 5, w * a.org / 100, 2);
      ctx.fillStyle = '#e0a060';
      ctx.fillRect(x, y + h - 2, w * Math.min(1, a.men / a.maxMen), 2);
      ctx.font = `600 12px ${G.FONT_BODY}`;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2.5;
      const label = G.fmtK(a.men);
      ctx.strokeText(label, s.x + 2, y + (h - 5) / 2 + 1);
      ctx.fillText(label, s.x + 2, y + (h - 5) / 2 + 1);
    }
    if (a.retreating) {   // bozgun: soluk
      ctx.fillStyle = 'rgba(20,14,8,0.45)';
      ctx.fillRect(x, y, w, h);
    }
    if (a.encircled) {    // kuşatılmış: kırmızı çerçeve ve işaret
      ctx.strokeStyle = (S.hour >> 2) % 2 ? '#ff3b2a' : '#a01d12'; ctx.lineWidth = 2.5;
      ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
      if (!small) {
        ctx.fillStyle = '#a01d12';
        ctx.beginPath(); ctx.arc(x + w + 4, y + 2, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `700 9px ${G.FONT_BODY}`;
        ctx.fillText('!', x + w + 4, y + 2.5);
      }
    } else if (a.sel) {
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    } else if (a.tag === S.player) {
      ctx.strokeStyle = 'rgba(255,233,168,0.45)'; ctx.lineWidth = 1;
      ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    }
    M.counterRects.push({ x: x - 2, y: y - 2, w: w + 4, h: h + 4, armies: [a], tag: a.tag });
  }
};

M.drawBattles = function () {
  const ctx = M.ctx, S = G.S, P = S.provinces;
  for (const b of S.battles.values()) {
    const a = P[b.from], t = P[b.target];
    const s1 = M.toScreen(a.x, a.y), s2 = M.toScreen(t.x, t.y);
    const x = (s1.x + s2.x) / 2, y = (s1.y + s2.y) / 2;
    if (x < -20 || x > M.w + 20 || y < -20 || y > M.h + 20) continue;
    let good = b.ratio >= 1;
    if (b.defTag === S.player) good = !good;
    const involved = b.tag === S.player || b.defTag === S.player;
    ctx.beginPath();
    ctx.arc(x, y, 11, 0, Math.PI * 2);
    ctx.fillStyle = involved ? (good ? '#3f7a2f' : '#8a2a22') : '#5a4a2a';
    ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `13px ${G.FONT_BODY}`;
    ctx.fillText('⚔', x, y + 1);
    if (G.ui.battleKey === b.key) { ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke(); }
    M.battleRects.push({ x: x - 13, y: y - 13, w: 26, h: 26, key: b.key });
  }
};
M.battleAt = (sx, sy) => (M.battleRects || []).find(r => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h);

// ------------------------------------------------------------ cepheler ve taarruz okları
M.frontCache = new Map();
M.drawFronts = function (sc) {
  const S = G.S, ctx = M.ctx;
  if (!S.marshals) return;
  for (const o of S.marshals) {
    if (o.tag !== S.player || !o.front) continue;
    const key = o.id + '|' + o.front + '|' + (S.hour / 24 | 0);   // cephe günde bir hesaplanır
    let edges = M.frontCache.get(o.id);
    if (!edges || edges.key !== key) {
      edges = { key, list: G.command.frontEdges(o.tag, o.front) };
      M.frontCache.set(o.id, edges);
    }
    const path = new Path2D();
    for (const [a, b] of edges.list) {
      const segs = M.edgeMap.get(a < b ? a + '|' + b : b + '|' + a);
      if (!segs) continue;
      for (const sg of segs) {
        path.moveTo(sg[0], sg[1]);
        for (let i = 2; i < sg.length; i += 2) path.lineTo(sg[i], sg[i + 1]);
      }
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(20,12,4,0.55)';
    ctx.lineWidth = 6 / sc;
    ctx.stroke(path);
    ctx.strokeStyle = o.color;
    ctx.lineWidth = 3.4 / sc;
    if (o.attack) ctx.setLineDash([9 / sc, 5 / sc]);
    ctx.stroke(path);
    ctx.setLineDash([]);
  }
};

M.arrow = function (ctx, x0, y0, x1, y1, color, width) {
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
  const cx = mx - dy / len * len * 0.18, cy = my + dx / len * len * 0.18;
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1);
  ctx.strokeStyle = 'rgba(20,10,5,0.6)'; ctx.lineWidth = width + 3; ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  const a = Math.atan2(y1 - cy, x1 - cx), hl = 9 + width * 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - hl * Math.cos(a - 0.45), y1 - hl * Math.sin(a - 0.45));
  ctx.lineTo(x1 - hl * Math.cos(a + 0.45), y1 - hl * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,5,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
};

M.drawArrows = function () {
  const S = G.S, ctx = M.ctx, P = S.provinces;
  if (!S.marshals) return;
  for (const o of S.marshals) {
    if (o.tag !== S.player || o.target == null) continue;
    const us = G.command.armies(o).filter(a => a.prov != null);
    if (!us.length) continue;
    const cx = us.reduce((s, a) => s + P[a.prov].x, 0) / us.length;
    const cy = us.reduce((s, a) => s + P[a.prov].y, 0) / us.length;
    const a = M.toScreen(cx, cy), b = M.toScreen(P[o.target].x, P[o.target].y);
    M.arrow(ctx, a.x, a.y, b.x, b.y, 'rgba(200,60,45,0.85)', 5);
  }
};

// ------------------------------------------------------------ garnizon görünümü
// Harita kararır, kaleler parlar ve garnizon sayıları yazılır
M.drawGarrisons = function (vis, P) {
  const ctx = M.ctx, S = G.S, sc = M.cam.scale, me = S.player;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const i of vis) {
    const p = P[i];
    if (!p.fort || !p.ctrl) continue;
    const mine = G.sameRealm(p.ctrl, me), enemy = G.atWar(me, p.ctrl);
    if (!mine && !enemy && sc < 45) continue;
    const s = M.toScreen(p.x, p.y);
    if (s.x < -40 || s.x > M.w + 40 || s.y < -40 || s.y > M.h + 40) continue;
    const col = mine ? '255,214,110' : enemy ? '255,90,60' : '190,180,160';
    const r = 10 + p.fort * 4;
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 1.8);
    g.addColorStop(0, `rgba(${col},${mine || enemy ? 0.75 : 0.35})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.8, 0, Math.PI * 2); ctx.fill();
    // kale simgesi
    ctx.font = `${12 + p.fort * 2}px ${G.FONT_BODY}`;
    ctx.fillStyle = mine ? '#fff3c8' : enemy ? '#ffd0c0' : '#ddd';
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3;
    ctx.strokeText('♜', s.x, s.y - 2); ctx.fillText('♜', s.x, s.y - 2);
    if (sc >= 9 && (mine || enemy || sc > 30)) {
      const max = G.econ.maxGarrison(p);
      const txt = mine || sc > 40 ? G.fmtK(p.garrison) : '?';
      ctx.font = `600 ${sc > 30 ? 13 : 11}px ${G.FONT_BODY}`;
      ctx.strokeText(txt, s.x, s.y + 13); ctx.fillText(txt, s.x, s.y + 13);
      if (mine && sc > 14) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(s.x - 15, s.y + 21, 30, 4);
        ctx.fillStyle = '#e0a060'; ctx.fillRect(s.x - 14, s.y + 22, 28 * (max ? p.garrison / max : 0), 2);
      }
    }
  }
};

// ------------------------------------------------------------ keşfedilmemiş topraklar
M.drawUnexplored = function (sc) {
  const ctx = M.ctx;
  // bilinmeyen denizler: haritanın güneyi sise gömülür
  if (isFinite(M.fogY)) {
    const g = ctx.createLinearGradient(0, M.fogY - 3, 0, M.fogY + 14);
    g.addColorStop(0, 'rgba(12,18,18,0)'); g.addColorStop(1, 'rgba(12,18,18,0.32)');
    ctx.fillStyle = g;
    ctx.fillRect(-180, M.fogY - 3, 360, 200);
  }
  // bilinmeyen batı okyanusu: Atlantik'in ötesi sise gömülür
  if (!M.seaX0) M.seaX0 = Math.min(...M.seaBbox.map(b => b[0]));
  if (isFinite(M.seaX0)) {
    const g = ctx.createLinearGradient(M.seaX0 + 2, 0, M.seaX0 - 14, 0);
    g.addColorStop(0, 'rgba(12,18,18,0)'); g.addColorStop(1, 'rgba(12,18,18,0.32)');
    ctx.fillStyle = g;
    ctx.fillRect(-180, -300, M.seaX0 + 180, 600);
  }
  // doğuda da Pasifik'in bilinmeyeni
  if (!M.seaX1) M.seaX1 = Math.max(...M.seaBbox.map(b => b[2]));
  if (isFinite(M.seaX1)) {
    const g = ctx.createLinearGradient(M.seaX1 - 2, 0, M.seaX1 + 14, 0);
    g.addColorStop(0, 'rgba(12,18,18,0)'); g.addColorStop(1, 'rgba(12,18,18,0.32)');
    ctx.fillStyle = g;
    ctx.fillRect(M.seaX1 - 2, -300, 182 - M.seaX1, 600);
  }
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(70, 98, 102, 0.12)';
  ctx.lineWidth = 8 / sc;
  ctx.stroke(M.unkCoast);
  ctx.fillStyle = '#857a64';
  ctx.fill(M.unkPath);
  ctx.strokeStyle = '#857a64'; ctx.lineWidth = 1.2 / sc;   // parçalar arasında dikiş kalmasın
  ctx.stroke(M.unkPath);
  const pat = M.hatch('rgba(60,48,32,0.16)');
  pat.setTransform(new DOMMatrix([1.4 / sc, 0, 0, 1.4 / sc, 0, 0]));
  ctx.fillStyle = pat;
  ctx.fill(M.unkPath);
  ctx.setLineDash([2 / sc, 3 / sc]);
  ctx.strokeStyle = 'rgba(45,34,20,0.45)';
  ctx.lineWidth = 0.9 / sc;
  ctx.stroke(M.unkCoast);
  ctx.setLineDash([]);
};

// Keşfedilmemiş ıssız topraklar da aynı sisle örtülür
M.drawHiddenFog = function (P, v, v2, sc) {
  const ctx = M.ctx, list = [];
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (p.kind !== 'waste' || !M.hidden(p)) continue;
    const b = M.bbox[i];
    if (b[2] < v.x || b[0] > v2.x || b[3] < v.y || b[1] > v2.y) continue;
    list.push(i);
  }
  if (!list.length) return;
  ctx.fillStyle = '#857a64'; ctx.strokeStyle = '#857a64'; ctx.lineWidth = 1.2 / sc;
  for (const i of list) { ctx.fill(M.paths[i]); ctx.stroke(M.paths[i]); }
  const pat = M.hatch('rgba(60,48,32,0.16)');
  pat.setTransform(new DOMMatrix([1.4 / sc, 0, 0, 1.4 / sc, 0, 0]));
  ctx.fillStyle = pat;
  for (const i of list) ctx.fill(M.paths[i]);
};

M.drawUnexploredNames = function () {
  const ctx = M.ctx, sc = M.cam.scale, L = window.WORLD.unexploredLabels || [];
  if (sc > 70) return;
  const size = G.clamp(sc * 1.1, 13, 44);
  ctx.font = `italic 600 ${size}px ${G.FONT_TITLE}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.25)}px`;
  ctx.fillStyle = 'rgba(40,30,18,0.38)';
  for (const l of L) {
    const id = M.gridAt(l.x, l.y);
    if (G.S && id >= 0 && !M.hidden(G.S.provinces[id])) continue;
    const s = M.toScreen(l.x, l.y);
    if (s.x < -400 || s.x > M.w + 400 || s.y < -50 || s.y > M.h + 50) continue;
    ctx.fillText(l.name, s.x, s.y);
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
};

// ------------------------------------------------------------ deniz
M.drawSeaNames = function () {
  const S = G.S, ctx = M.ctx, sc = M.cam.scale;
  if (sc < 11 || sc > 90) return;
  ctx.font = `italic ${sc > 40 ? 14 : 12}px ${G.FONT_BODY}`;
  ctx.fillStyle = 'rgba(38,60,64,0.55)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
  for (const z of S.seas) {
    const s = M.toScreen(z.x, z.y);
    if (s.x < -100 || s.x > M.w + 100 || s.y < -20 || s.y > M.h + 20) continue;
    ctx.fillText(z.name, s.x, s.y + 22);
  }
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
};

M.drawPorts = function (vis, P) {
  const S = G.S, ctx = M.ctx, sc = M.cam.scale;
  if (sc < 30 || !S.dockyards) return;
  const docks = new Set(S.dockyards.map(d => d.prov));
  ctx.font = `13px ${G.FONT_BODY}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const i of vis) {
    const p = P[i];
    if (!G.navy.isPort(p)) continue;
    const s = M.toScreen(p.x, p.y);
    const dock = docks.has(p.id);
    ctx.fillStyle = 'rgba(15,10,5,0.7)';
    ctx.beginPath(); ctx.arc(s.x + 13, s.y - 3, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dock ? '#e8c869' : 'rgba(200,220,220,0.85)';
    ctx.fillText('⚓', s.x + 13, s.y - 2);
  }
};

M.fleetPos = function (f) {
  const S = G.S, z = S.seas[f.zone];
  if (f.docked != null) {
    const p = S.provinces[f.docked];
    return { x: p.x + (z.x - p.x) * 0.35, y: p.y + (z.y - p.y) * 0.35 };
  }
  if (f.path.length && f.prog > 0) {
    const n = S.seas[f.path[0]], i = z.nb.indexOf(n.id), d = i >= 0 ? z.nbDist[i] : 300;
    const t = G.clamp(f.prog / d, 0, 1);
    return { x: z.x + (n.x - z.x) * t, y: z.y + (n.y - z.y) * t };
  }
  return { x: z.x, y: z.y };
};

M.drawFleets = function () {
  const S = G.S, ctx = M.ctx, sc = M.cam.scale;
  if (!S.fleets) return;
  const slot = new Map();
  // seçili filonun rotası
  const sf = G.selFleet;
  if (sf && sf.path.length) {
    ctx.strokeStyle = 'rgba(160,220,240,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    ctx.beginPath();
    let s = M.toScreen(M.fleetPos(sf).x, M.fleetPos(sf).y);
    ctx.moveTo(s.x, s.y);
    for (const z of sf.path) { s = M.toScreen(S.seas[z].x, S.seas[z].y); ctx.lineTo(s.x, s.y); }
    ctx.stroke(); ctx.setLineDash([]);
  }
  for (const f of S.fleets) {
    const mine = f.tag === S.player, enemy = G.atWar(S.player, f.tag);
    if (sc < 32 && !mine && !enemy) continue;
    if (sc < 5) continue;
    const w = M.fleetPos(f);
    const k = Math.round(w.x * 4) + '|' + Math.round(w.y * 4);
    const n = slot.get(k) || 0; slot.set(k, n + 1);
    const s = M.toScreen(w.x, w.y);
    const x = s.x - 24, y = s.y - 9 + n * 20;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 1, y - 1, 50, 19, 8) : ctx.rect(x - 1, y - 1, 50, 19); ctx.fill();
    ctx.fillStyle = M.mute(S.nations[f.tag].color);
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, 48, 17, 7) : ctx.rect(x, y, 48, 17); ctx.fill();
    const hp = N_hpFrac(f);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x + 4, y + 14, 40, 2);
    ctx.fillStyle = '#7fc4e0'; ctx.fillRect(x + 4, y + 14, 40 * hp, 2);
    ctx.font = `600 12px ${G.FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2.5; ctx.fillStyle = '#fff';
    const label = `⛵ ${f.ships.length}` + (f.cargo.length ? ' ⚔' : '');
    ctx.strokeText(label, s.x, y + 7.5); ctx.fillText(label, s.x, y + 7.5);
    if (f === G.selFleet) { ctx.strokeStyle = '#a8e0f0'; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 3, 54, 23); }
    else if (mine) { ctx.strokeStyle = 'rgba(168,224,240,0.5)'; ctx.lineWidth = 1; ctx.strokeRect(x - 2, y - 2, 52, 21); }
    M.fleetRects.push({ x: x - 3, y: y - 3, w: 54, h: 23, fleet: f });
    // çıkarma oku
    if (f.order && f.order.kind === 'land' && (mine || enemy)) {
      const t = S.provinces[f.order.prov], ts = M.toScreen(t.x, t.y);
      M.arrow(ctx, s.x, s.y + 9, ts.x, ts.y, mine ? 'rgba(120,200,230,0.85)' : 'rgba(220,80,60,0.85)', 3);
    }
  }
  // liman muharebeleri
  for (const f of S.fleets) {
    if (!f.harbor || f.harbor.hp <= 0 || !f.order || f.order.kind !== 'land') continue;
    const p = S.provinces[f.order.prov], s2 = M.toScreen(p.x, p.y);
    ctx.beginPath(); ctx.arc(s2.x, s2.y - 30, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#7a3a2a'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `14px ${G.FONT_BODY}`; ctx.fillText('⚓', s2.x, s2.y - 29);
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(s2.x - 18, s2.y - 14, 36, 5);
    ctx.fillStyle = '#e07a5a'; ctx.fillRect(s2.x - 17, s2.y - 13, 34 * f.harbor.hp / f.harbor.max, 3);
  }
  // deniz muharebeleri
  for (const b of S.navalBattles.values()) {
    const z = S.seas[b.zone], s = M.toScreen(z.x, z.y);
    ctx.beginPath(); ctx.arc(s.x, s.y - 26, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#2a5a70'; ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `14px ${G.FONT_BODY}`;
    ctx.fillText('⚔', s.x, s.y - 25);
  }
};
function N_hpFrac(f) { const m = G.navy.maxHp(f); return m ? G.navy.hp(f) / m : 0; }

M.fleetAt = function (sx, sy) {
  for (let i = (M.fleetRects || []).length - 1; i >= 0; i--) {
    const r = M.fleetRects[i];
    if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return r.fleet;
  }
  return null;
};

// Kale simgesi: seviye ve garnizon
M.drawFort = function (ctx, x, y, p) {
  const w = 11, h = 9;
  ctx.save();
  ctx.fillStyle = 'rgba(20,14,8,0.85)';
  ctx.fillRect(x - w / 2 - 1, y - h - 1, w + 2, h + 4);
  ctx.fillStyle = '#c8b48a';
  ctx.fillRect(x - w / 2, y - h + 3, w, h - 3);
  for (let i = 0; i < 3; i++) ctx.fillRect(x - w / 2 + i * 4, y - h, 3, 3);
  const max = G.econ.maxGarrison(p);
  ctx.fillStyle = '#7a1e14';
  ctx.fillRect(x - w / 2, y + 1, w, 2);
  ctx.fillStyle = '#e0a060';
  ctx.fillRect(x - w / 2, y + 1, w * (max ? p.garrison / max : 0), 2);
  ctx.font = `600 9px ${G.FONT_BODY}`; ctx.fillStyle = '#2a1a0a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(p.fort), x, y - 2);
  ctx.restore();
};

// ------------------------------------------------------------ keşif ve yerleşimler
// Yerleşim kurulan il kurucunun renginde taranır; ortada yerleşimci çemberi
M.drawColonies = function (vis, P, sc) {
  const ctx = M.ctx, S = G.S;
  for (const i of vis) {
    const p = P[i];
    if (!p.colony) continue;
    const n = S.nations[p.colony.tag];
    if (!n) continue;
    const pat = M.hatch(M.mute(n.color));
    pat.setTransform(new DOMMatrix([1 / sc, 0, 0, 1 / sc, 0, 0]));
    ctx.fillStyle = pat;
    ctx.fill(M.paths[i]);
  }
};

M.drawExploration = function () {
  const ctx = M.ctx, S = G.S, P = S.provinces, sc = M.cam.scale, X = G.explore, me = S.player;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  // keşif kipinde hedefler: bilinmeyen yerlerde soru işareti, yerleşime uygun yerlerde bayrak
  if (M.exploreView && sc > 4) {
    const t = X.targets();
    const r = sc > 20 ? 11 : 8;
    for (const id of t.explore) {
      const p = P[id], s = M.toScreen(p.x, p.y);
      if (s.x < -20 || s.x > M.w + 20 || s.y < -20 || s.y > M.h + 20) continue;
      const busy = S.expeditions.some(e => e.tag === me && e.to === id);
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fillStyle = busy ? 'rgba(90,140,170,0.85)' : 'rgba(40,30,18,0.7)'; ctx.fill();
      ctx.strokeStyle = '#e8d49a'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = '#f4e6c0'; ctx.font = `700 ${r + 2}px ${G.FONT_TITLE}`;
      ctx.fillText(busy ? '🧭' : '?', s.x, s.y + 1);
    }
    for (const id of t.colonize) {
      ctx.setLineDash([5 / sc, 3 / sc]);
      ctx.save();
      ctx.setTransform(sc * M.dpr, 0, 0, sc * M.dpr, (M.w / 2 - M.cam.x * sc) * M.dpr, (M.h / 2 - M.cam.y * sc) * M.dpr);
      ctx.strokeStyle = 'rgba(140,220,120,0.85)'; ctx.lineWidth = 2 / sc;
      ctx.stroke(M.paths[id]);
      ctx.restore();
      ctx.setLineDash([]);
      const p = P[id], s = M.toScreen(p.x, p.y);
      if (sc > 9) { ctx.font = `${sc > 20 ? 16 : 12}px ${G.FONT_BODY}`; ctx.fillStyle = '#bff0a8'; ctx.fillText('⚑', s.x, s.y - (sc > 20 ? 14 : 9)); }
    }
  }
  // yerleşimlerin ilerleme çemberi
  for (const p of P) {
    if (!p.colony || M.hidden(p)) continue;
    const s = M.toScreen(p.x, p.y);
    if (s.x < -30 || s.x > M.w + 30 || s.y < -30 || s.y > M.h + 30 || sc < 6) continue;
    const n = S.nations[p.colony.tag], f = G.clamp(p.colony.settlers / X.SETTLERS, 0, 1);
    ctx.beginPath(); ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,14,8,0.8)'; ctx.fill();
    ctx.beginPath(); ctx.arc(s.x, s.y, 10, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2);
    ctx.strokeStyle = n ? n.color : '#ccc'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#f4e6c0'; ctx.font = `11px ${G.FONT_BODY}`;
    ctx.fillText('⚑', s.x, s.y + 1);
  }
  // yoldaki kâşiflerimiz
  for (const e of S.expeditions) {
    if (e.tag !== me) continue;
    const a = P[e.from], b = P[e.to];
    const f = G.clamp((S.hour - e.start) / Math.max(1, e.arrive - e.start), 0, 1);
    const s1 = M.toScreen(a.x, a.y), s2 = M.toScreen(b.x, b.y);
    ctx.setLineDash([3, 5]); ctx.strokeStyle = e.sea ? 'rgba(150,210,235,0.75)' : 'rgba(240,215,150,0.75)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke(); ctx.setLineDash([]);
    const x = s1.x + (s2.x - s1.x) * f, y = s1.y + (s2.y - s1.y) * f;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,22,12,0.85)'; ctx.fill(); ctx.strokeStyle = '#e8c869'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `12px ${G.FONT_BODY}`; ctx.fillStyle = '#fff';
    ctx.fillText(e.sea ? '⛵' : '🧭', x, y + 1);
  }
};

// ------------------------------------------------------------ kültür haritası: halkların adları ve bayrakları
M.rebuildCultureLabels = function () {
  const S = G.S, P = S.provinces, seen = new Uint8Array(P.length), out = [];
  for (const p of P) {
    if (seen[p.id] || !p.cul || p.kind === 'waste' || M.hidden(p)) continue;
    const comp = [], q = [p.id];
    seen[p.id] = 1;
    while (q.length) {
      const c = P[q.pop()];
      comp.push(c);
      for (const id of c.nb) if (!seen[id] && P[id].cul === p.cul && !M.hidden(P[id]) && P[id].kind !== 'waste') { seen[id] = 1; q.push(id); }
    }
    let sx = 0, sy = 0, sw = 0;
    for (const c of comp) { const w = M.areaOf(c.id); sx += c.x * w; sy += c.y * w; sw += w; }
    const mx = sx / sw, my = sy / sw;
    // ağırlık merkezine en yakın il (dışbükey olmayan bölgelerde yazı denize düşmesin)
    const c0 = comp.reduce((b, c) => (Math.hypot(c.x - mx, c.y - my) < Math.hypot(b.x - mx, b.y - my) ? c : b), comp[0]);
    out.push({ cul: p.cul, x: (mx + c0.x) / 2, y: (my + c0.y) / 2, size: Math.sqrt(sw) });
  }
  out.sort((a, b) => b.size - a.size);
  M.cultureLabels = out;
};
M.drawCultureLabels = function () {
  if (G.labelsDirty || !M.cultureLabels || M.cultureKey !== G.S.hour >> 9) { M.rebuildCultureLabels(); M.cultureKey = G.S.hour >> 9; }
  const ctx = M.ctx, sc = M.cam.scale, used = [];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const L of M.cultureLabels) {
    const px = L.size * sc;
    if (px < 26) continue;
    const s = M.toScreen(L.x, L.y);
    if (s.x < -100 || s.x > M.w + 100 || s.y < -60 || s.y > M.h + 60) continue;
    const fs = G.clamp(px / 9, 10, 22), C = G.cul.get(L.cul);
    ctx.font = `600 ${fs | 0}px ${G.FONT_TITLE}`;
    const tw = ctx.measureText(C.name).width, fw = fs * 1.6, fh = fs * 1.07;
    const box = [s.x - tw / 2 - fw / 2 - 4, s.y - fh / 2 - 2, tw + fw + 8, fh + 4];
    if (used.some(u => box[0] < u[0] + u[2] && u[0] < box[0] + box[2] && box[1] < u[1] + u[3] && u[1] < box[1] + box[3])) continue;
    used.push(box);
    const img = G.cul.flagImg(L.cul);
    const fx = s.x - tw / 2 - fw / 2 - 2;
    if (img) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(fx - fw / 2 + 1, s.y - fh / 2 + 1, fw, fh);
      ctx.drawImage(img, fx - fw / 2, s.y - fh / 2, fw, fh);
    }
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(20,12,4,0.65)';
    ctx.fillStyle = 'rgba(255,246,222,0.92)';
    ctx.strokeText(C.name, s.x + fw / 2 + 2, s.y + 1);
    ctx.fillText(C.name, s.x + fw / 2 + 2, s.y + 1);
  }
};

// ------------------------------------------------------------ ticaret yolları
// Yollar değerlerine göre kalınlıkta, akan kesik çizgilerle; üzerlerinde kervanlar ve gemiler ilerler
M.drawTrade = function () {
  const ctx = M.ctx, S = G.S, TR = G.trade, now = performance.now(), sel = G.ui.tradeSel;
  if (!TR.paths) return;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const mine = S.player;
  const curve = pts => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l.x, l.y);
  };
  const labels = [];
  for (const r of TR.ROUTES) {
    const e = S.trade[r.id];
    if (!e) continue;
    const pts = TR.points(r.id).map(p => M.toScreen(p.x, p.y));
    const on = sel === r.id, ours = !!e.shares[mine];
    const w = (1.5 + e.value / 7) * (on ? 1.5 : 1);
    ctx.setLineDash([]);
    curve(pts);
    ctx.strokeStyle = 'rgba(15,10,5,0.75)'; ctx.lineWidth = w + 3; ctx.stroke();
    ctx.globalAlpha = sel && !on ? 0.45 : 1;
    ctx.strokeStyle = r.color; ctx.lineWidth = w; ctx.stroke();
    // akış
    ctx.setLineDash([w * 1.2, w * 3]);
    ctx.lineDashOffset = -(now / 45) % (w * 4.2);
    ctx.strokeStyle = 'rgba(255,248,225,0.75)'; ctx.lineWidth = Math.max(1, w * 0.45); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // kervanlar: yol boyunca ilerleyen simgeler
    const seg = [];
    let len = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); seg.push(d); len += d; }
    const nodes = TR.paths[r.id];
    ctx.font = `${on ? 15 : 12}px ${G.FONT_BODY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (len > 60) for (let k = 0; k < 3; k++) {
      let t = ((now / 26000 + k / 3 + r.value * 0.013) % 1) * len, i = 0;
      while (i < seg.length - 1 && t > seg[i]) { t -= seg[i]; i++; }
      const f = seg[i] ? t / seg[i] : 0, a = pts[i], b = pts[i + 1] || a;
      const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f;
      if (x < -20 || x > M.w + 20 || y < -20 || y > M.h + 20) continue;
      const sea = nodes[i] && nodes[i].z != null && (!nodes[i + 1] || nodes[i + 1].z != null);
      ctx.fillStyle = 'rgba(20,14,8,0.75)';
      ctx.beginPath(); ctx.arc(x, y, on ? 10 : 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(sea ? '⛵' : '🐫', x, y + 1);
    }
    // kesilen yerler
    for (const nd of nodes) {
      const p = nd.p != null ? P_(nd.p) : null;
      const bad = p ? (p.siege || (p.owner && p.ctrl !== p.owner)) : S.navalBattles && S.navalBattles.has(nd.z);
      if (!bad) continue;
      const q = p || S.seas[nd.z], s = M.toScreen(q.x, q.y);
      ctx.fillStyle = '#c0302a'; ctx.beginPath(); ctx.arc(s.x, s.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `700 10px ${G.FONT_BODY}`; ctx.fillText('✕', s.x, s.y + 0.5);
    }
    const mid = pts[Math.floor(pts.length / 2)];
    labels.push({ r, e, x: mid.x, y: mid.y, ours, on });
  }
  // yol adları: önce seçili, sonra bizim, sonra değerli yollar; üst üste binen yazılmaz
  labels.sort((a, b) => (b.on - a.on) || (b.ours - a.ours) || b.e.value - a.e.value);
  const used = [];
  for (const L of labels) {
    if (L.x < -80 || L.x > M.w + 80 || L.y < -30 || L.y > M.h + 30) continue;
    const bw = 150, box = [L.x - bw / 2, L.y - 28, bw, 34];
    if (used.some(u => box[0] < u[0] + u[2] && u[0] < box[0] + box[2] && box[1] < u[1] + u[3] && u[1] < box[1] + box[3])) continue;
    used.push(box);
    const txt = `${L.r.icon} ${L.r.name}`, sub = `${G.fmtNum(Math.round(L.e.value * 10) / 10)} altın${L.ours ? ` · bizim %${Math.round(L.e.shares[S.player].pow * 100)}` : ''}`;
    ctx.font = `600 ${L.on ? 14 : 12}px ${G.FONT_TITLE}`;
    const tw = Math.max(ctx.measureText(txt).width, 70) + 14;
    ctx.fillStyle = 'rgba(25,18,10,0.85)';
    ctx.fillRect(L.x - tw / 2, L.y - 26, tw, 30);
    ctx.strokeStyle = L.ours ? '#e8c869' : L.r.color; ctx.lineWidth = L.on ? 2 : 1;
    ctx.strokeRect(L.x - tw / 2, L.y - 26, tw, 30);
    ctx.fillStyle = '#f4e6c0'; ctx.fillText(txt, L.x, L.y - 16);
    ctx.font = `11px ${G.FONT_BODY}`; ctx.fillStyle = L.ours ? '#e8c869' : '#c8b890';
    ctx.fillText(sub, L.x, L.y - 3);
  }
  G.mapDirty = true;   // akış için sürekli çiz
};
function P_(id) { return G.S.provinces[id]; }
