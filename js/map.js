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
  M.cam.scale = G.clamp(M.cam.scale, Math.max(M.w / (x1 - x0 + 20), 4), 400);
  M.cam.x = G.clamp(M.cam.x, x0, x1);
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
    const sat = 0.78, mix = 0.24, [pr, pg, pb] = M.PARCHMENT;
    r = (grey + (r - grey) * sat) * (1 - mix) + pr * mix;
    g = (grey + (g - grey) * sat) * (1 - mix) + pg * mix;
    b = (grey + (b - grey) * sat) * (1 - mix) + pb * mix;
    c = `rgb(${r | 0},${g | 0},${b | 0})`;
    M.muted.set(hex, c);
  }
  return c;
};

M.provColor = function (p) {
  const S = G.S;
  if (p.kind === 'waste' || !p.owner) return '#5b5242';
  const n = S ? S.nations[p.owner] : window.WORLD.nations[p.owner];
  if (M.mode === 'religion') return M.mute((G.RELIGIONS[n.religion] || { color: '#888888' }).color);
  return M.mute(n.color);
};

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
M.draw = function () {
  const S = G.S, ctx = M.ctx, dpr = M.dpr, cam = M.cam, sc = cam.scale;
  if (G.labelsDirty || !M.labels) { M.rebuildBorders(); M.rebuildLabels(); G.labelsDirty = false; }
  const P = S ? S.provinces : window.WORLD.provinces;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const grd = ctx.createLinearGradient(0, 0, 0, M.h);
  grd.addColorStop(0, '#30474a'); grd.addColorStop(1, '#25393c');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, M.w, M.h);

  const ox = M.w / 2 - cam.x * sc, oy = M.h / 2 - cam.y * sc;
  ctx.setTransform(sc * dpr, 0, 0, sc * dpr, ox * dpr, oy * dpr);
  const v = M.toWorld(0, 0), v2 = M.toWorld(M.w, M.h);
  const vis = [];
  for (let i = 0; i < P.length; i++) {
    const b = M.bbox[i];
    if (b[2] < v.x || b[0] > v2.x || b[3] < v.y || b[1] > v2.y) continue;
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
    ctx.setLineDash([4 / sc, 4 / sc]);
    ctx.strokeStyle = 'rgba(190,215,205,0.16)';
    ctx.lineWidth = 0.9 / sc;
    for (let i = 0; i < M.seaPaths.length; i++) ctx.stroke(M.seaPaths[i]);
    ctx.setLineDash([]);
  }

  // kıyı: eski haritalardaki gibi yumuşak, katmanlı su çizgisi
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(160, 190, 180, 0.10)';
  ctx.lineWidth = 9 / sc;
  for (const i of vis) ctx.stroke(M.paths[i]);
  ctx.strokeStyle = 'rgba(170, 200, 190, 0.16)';
  ctx.lineWidth = 3.5 / sc;
  for (const i of vis) ctx.stroke(M.paths[i]);

  // dolgular
  const selNation = M.selNation;
  for (const i of vis) {
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
  if (S && M.mode === 'political') {
    for (const i of vis) {
      const p = P[i];
      if (p.ctrl && p.ctrl !== p.owner) {
        const pat = M.hatch(M.mute(S.nations[p.ctrl].color));
        pat.setTransform(new DOMMatrix([1 / sc, 0, 0, 1 / sc, 0, 0]));
        ctx.fillStyle = pat;
        ctx.fill(M.paths[i]);
      }
    }
  }
  // seçili / üzerine gelinen eyalet
  if (M.hoverProv != null) {
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

  // sınırlar: yumuşak, iki katmanlı (geniş gölge + ince mürekkep)
  if (sc > 9) {
    ctx.strokeStyle = `rgba(40,28,14,${G.clamp((sc - 9) / 60, 0, 0.16)})`;
    ctx.lineWidth = 0.6 / sc;
    ctx.stroke(M.innerBorders);
  }
  const bw = Math.min(1.6, 0.5 + sc / 40);
  ctx.strokeStyle = 'rgba(30,20,10,0.16)';
  ctx.lineWidth = bw * 3.2 / sc;
  ctx.stroke(M.outerBorders);
  ctx.strokeStyle = 'rgba(35,24,12,0.55)';
  ctx.lineWidth = bw / sc;
  ctx.stroke(M.outerBorders);
  // efendi-vasal sınırı: kesik çizgi
  ctx.setLineDash([3 / sc, 3 / sc]);
  ctx.strokeStyle = 'rgba(35,24,12,0.45)';
  ctx.lineWidth = bw * 0.8 / sc;
  ctx.stroke(M.realmBorders);
  ctx.setLineDash([]);
  if (S) M.drawFronts(sc);

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
  M.drawLabels(vis, P);
  if (S) {
    M.drawSeaNames();
    M.drawPorts(vis, P);
    M.drawSieges(vis, P);
    M.drawArrows();
    M.drawPaths();
    M.drawCounters();
    M.drawFleets();
    M.drawBattles();
  }
  if (M.dragBox) {
    const b = M.dragBox;
    ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(255,233,168,0.1)';
    ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    ctx.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  }
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
    ctx.shadowColor = 'rgba(20,12,4,0.55)';
    ctx.shadowBlur = fs / 4;
    ctx.fillStyle = `rgba(250,240,215,${fs > 18 ? 0.42 : 0.55})`;
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
    else if (p.kind === 'rural' && sc < 90) continue;
    const s = M.toScreen(p.x, p.y);
    if (p.kind === 'capital' || p.kind === 'city') {
      ctx.fillStyle = p.kind === 'capital' ? '#e8c869' : '#efe4c8';
      ctx.strokeStyle = 'rgba(30,20,10,0.8)'; ctx.lineWidth = 1;
      ctx.beginPath();
      if (p.kind === 'capital') M.star(ctx, s.x, s.y, 5, 2.4);
      else ctx.arc(s.x, s.y, 2.3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(25,16,8,0.45)';
    ctx.fillStyle = p.kind === 'waste' ? 'rgba(220,205,170,0.6)' : 'rgba(255,248,230,0.85)';
    const ty = p.kind === 'rural' || p.kind === 'waste' ? s.y : s.y + 11;
    if (p.kind === 'rural' || p.kind === 'waste') ctx.font = `italic ${sc > 60 ? 13 : 11}px ${G.FONT_BODY}`;
    ctx.strokeText(p.name, s.x, ty);
    ctx.fillText(p.name, s.x, ty);
    if (p.kind === 'rural' || p.kind === 'waste') ctx.font = `${sc > 60 ? 14 : 12}px ${G.FONT_BODY}`;
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
  const ctx = M.ctx;
  for (const i of vis) {
    const p = P[i];
    if (!p.siege) continue;
    const s = M.toScreen(p.x, p.y);
    const f = G.clamp(p.siege.progress / p.siege.need, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(s.x - 17, s.y + 10, 34, 6);
    ctx.fillStyle = G.S.nations[p.siege.by].color;
    ctx.fillRect(s.x - 16, s.y + 11, 32 * f, 4);
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
  M.counterRects = [];
  if (sc < 7) return;
  const groups = new Map();
  for (const a of S.armies) {
    if (a.fleet != null) continue;
    const k = a.prov + '|' + a.tag;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(a);
  }
  ctx.font = `600 12px ${G.FONT_BODY}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const small = sc < 16;
  for (const [, arr] of groups) {
    const a0 = arr[0], p = P[a0.prov], n = S.nations[a0.tag];
    // uzaktan bakarken yalnızca bizi ilgilendiren orduları göster
    if (sc < 32 && a0.tag !== S.player && !G.atWar(S.player, a0.tag)) continue;
    let s = M.toScreen(p.x, p.y);
    // hareket halindeki ordu ilerlemeye göre kaydırılır
    if (a0.path.length && a0.prog > 0 && !a0.attacking) {
      const nx = P[a0.path[0]], i = p.nb.indexOf(nx.id), d = i >= 0 ? p.nbDist[i] : 100;
      const f = G.clamp(a0.prog / d, 0, 1);
      const t = M.toScreen(nx.x, nx.y);
      s = { x: s.x + (t.x - s.x) * f, y: s.y + (t.y - s.y) * f };
    }
    if (s.x < -40 || s.x > M.w + 40 || s.y < -20 || s.y > M.h + 20) continue;
    const men = arr.reduce((t, a) => t + a.men, 0);
    const org = arr.reduce((t, a) => t + a.org, 0) / arr.length;
    const w = small ? 22 : 40, h = small ? 10 : 17;
    const x = s.x - w / 2, y = s.y - h - 3;
    const sel = arr.some(a => a.sel);
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = n.color;
    ctx.fillRect(x, y, w, h);
    if (!small) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(x, y + h - 3, w, 3);
      ctx.fillStyle = '#6fd05a';
      ctx.fillRect(x, y + h - 3, w * org / 100, 3);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2.5;
      const label = G.fmtK(men);
      ctx.strokeText(label, s.x, y + (h - 3) / 2 + 1);
      ctx.fillText(label, s.x, y + (h - 3) / 2 + 1);
      if (arr.length > 1) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x + w - 1, y - 6, 12, 11);
        ctx.fillStyle = '#ffd760';
        ctx.font = `600 10px ${G.FONT_BODY}`;
        ctx.fillText(String(arr.length), x + w + 5, y);
        ctx.font = `600 12px ${G.FONT_BODY}`;
      }
    }
    if (sel) {
      ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 2;
      ctx.strokeRect(x - 2, y - 2, w + 4, h + 4);
    } else if (a0.tag === S.player) {
      ctx.strokeStyle = 'rgba(255,233,168,0.5)'; ctx.lineWidth = 1;
      ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
    }
    M.counterRects.push({ x: x - 2, y: y - 2, w: w + 4, h: h + 4, armies: arr, tag: a0.tag });
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
  }
};

// ------------------------------------------------------------ cepheler ve taarruz okları
M.frontCache = new Map();
M.drawFronts = function (sc) {
  const S = G.S, ctx = M.ctx;
  if (!S.ordular) return;
  for (const o of S.ordular) {
    if (o.tag !== S.player || !o.front) continue;
    const key = o.id + '|' + o.front + '|' + S.hour;
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
  if (!S.ordular) return;
  for (const o of S.ordular) {
    if (o.tag !== S.player || o.target == null) continue;
    const us = G.command.units(o).filter(a => a.prov != null);
    if (!us.length) continue;
    const cx = us.reduce((s, a) => s + P[a.prov].x, 0) / us.length;
    const cy = us.reduce((s, a) => s + P[a.prov].y, 0) / us.length;
    const a = M.toScreen(cx, cy), b = M.toScreen(P[o.target].x, P[o.target].y);
    M.arrow(ctx, a.x, a.y, b.x, b.y, 'rgba(200,60,45,0.85)', 5);
  }
};

// ------------------------------------------------------------ deniz
M.drawSeaNames = function () {
  const S = G.S, ctx = M.ctx, sc = M.cam.scale;
  if (sc < 11 || sc > 90) return;
  ctx.font = `italic ${sc > 40 ? 14 : 12}px ${G.FONT_BODY}`;
  ctx.fillStyle = 'rgba(205,228,222,0.38)';
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
  M.fleetRects = [];
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
