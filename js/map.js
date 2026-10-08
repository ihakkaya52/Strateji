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
  M.patterns = new Map();
  M.resize();
  window.addEventListener('resize', M.resize);
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

M.provColor = function (p) {
  const S = G.S;
  if (p.kind === 'waste' || !p.owner) return '#4a4335';
  const n = S ? S.nations[p.owner] : window.WORLD.nations[p.owner];
  if (M.mode === 'religion') return (G.RELIGIONS[n.religion] || { color: '#888' }).color;
  return n.color;
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
  const inner = new Path2D(), outer = new Path2D();
  for (const [a, b, segs] of window.WORLD.edges) {
    const pa = P[a], pb = P[b];
    const wa = pa.kind === 'waste', wb = pb.kind === 'waste';
    if (wa && wb) continue;
    const target = (pa.owner !== pb.owner) ? outer : inner;
    for (const s of segs) {
      target.moveTo(s[0], s[1]);
      for (let i = 2; i < s.length; i += 2) target.lineTo(s[i], s[i + 1]);
    }
  }
  M.innerBorders = inner;
  M.outerBorders = outer;
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
    M.labels.push({ tag, x: mx, y: my, ang, size: Math.sqrt(area), spread, name });
  }
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
  grd.addColorStop(0, '#1d3442'); grd.addColorStop(1, '#162a36');
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

  // kıyı parıltısı
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(120, 170, 190, 0.35)';
  ctx.lineWidth = 4 / sc;
  for (const i of vis) ctx.stroke(M.paths[i]);

  // dolgular
  const selNation = M.selNation;
  for (const i of vis) {
    const p = P[i];
    let col = M.provColor(p);
    if (selNation && p.owner === selNation) col = M.shade(col, 0.22);
    ctx.fillStyle = col;
    ctx.fill(M.paths[i]);
  }
  ctx.fillStyle = 'rgba(0,0,0,0)';
  // işgal taraması
  if (S && M.mode === 'political') {
    for (const i of vis) {
      const p = P[i];
      if (p.ctrl && p.ctrl !== p.owner) {
        const pat = M.hatch(S.nations[p.ctrl].color);
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

  // sınırlar
  if (sc > 9) {
    ctx.strokeStyle = 'rgba(20,15,8,0.28)';
    ctx.lineWidth = 0.7 / sc;
    ctx.stroke(M.innerBorders);
  }
  ctx.strokeStyle = 'rgba(15,10,5,0.85)';
  ctx.lineWidth = Math.min(2.2, 0.6 + sc / 30) / sc;
  ctx.stroke(M.outerBorders);

  // ekran koordinatlarına geç
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  M.drawLabels(vis, P);
  if (S) {
    M.drawSieges(vis, P);
    M.drawPaths();
    M.drawCounters();
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
  // ülke adları
  for (const L of M.labels) {
    const fs = G.clamp(L.spread * sc * 0.42, 0, 46);
    if (fs < 9) continue;
    if (sc > 70 && fs > 30) continue;
    const s = M.toScreen(L.x, L.y);
    if (s.x < -400 || s.x > M.w + 400 || s.y < -100 || s.y > M.h + 100) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(L.ang);
    ctx.font = `bold ${fs | 0}px Georgia, serif`;
    const txt = L.name.toLocaleUpperCase('tr-TR');
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.max(1, fs / 8) | 0}px`;
    ctx.lineWidth = Math.max(2, fs / 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = 'rgba(255,248,230,0.9)';
    ctx.fillText(txt, 0, 0);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }
  // şehir adları
  if (sc < 28) return;
  ctx.font = `${sc > 60 ? 13 : 11}px Georgia, serif`;
  for (const i of vis) {
    const p = P[i];
    if (p.kind === 'waste') { if (sc < 45) continue; }
    else if (p.kind === 'rural' && sc < 90) continue;
    const s = M.toScreen(p.x, p.y);
    if (p.kind === 'capital' || p.kind === 'city') {
      ctx.fillStyle = p.kind === 'capital' ? '#ffd760' : '#f4ead0';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
      ctx.beginPath();
      if (p.kind === 'capital') M.star(ctx, s.x, s.y, 5, 2.4);
      else ctx.arc(s.x, s.y, 2.6, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.fillStyle = p.kind === 'waste' ? '#b9ad90' : '#fff8e6';
    const ty = p.kind === 'rural' || p.kind === 'waste' ? s.y : s.y + 11;
    ctx.strokeText(p.name, s.x, ty);
    ctx.fillText(p.name, s.x, ty);
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
    if (!a.path.length) continue;
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
    const k = a.prov + '|' + a.tag;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(a);
  }
  ctx.font = 'bold 11px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const small = sc < 16;
  for (const [, arr] of groups) {
    const a0 = arr[0], p = P[a0.prov], n = S.nations[a0.tag];
    // uzaktan bakarken yalnızca bizi ilgilendiren orduları göster
    if (sc < 14 && a0.tag !== S.player && !G.atWar(S.player, a0.tag)) continue;
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
        ctx.font = 'bold 9px Georgia, serif';
        ctx.fillText(String(arr.length), x + w + 5, y);
        ctx.font = 'bold 11px Georgia, serif';
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
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px Georgia, serif';
    ctx.fillText('⚔', x, y + 1);
  }
};
