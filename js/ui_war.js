// Savaş durumu paneli (HOI4 gibi üstte açılır): taraflar, sahadaki ordular, kayıplar, grafik
'use strict';

(function () {
  const U = G.ui;
  const $ = id => document.getElementById(id);
  const OUR = '#d6b36a', THEIR = '#d0503f';

  U.warSel = null;

  U.toggleWarPanel = function () {
    const el = $('warpanel');
    if (el.classList.contains('hidden')) { el.classList.remove('hidden'); U.refreshWarPanel(true); }
    else el.classList.add('hidden');
  };

  // Teslimiyet ilerlemesi: toprakların ağırlıklı ne kadarı işgal altında (0..1)
  U.capProgress = function (tag) {
    const S = G.S, n = S.nations[tag];
    let tot = 0, lost = 0;
    for (const p of S.provinces) {
      if (p.owner !== tag) continue;
      const w = G.provinceWeight(p);
      tot += w;
      if (p.ctrl !== tag && n.enemies.has(p.ctrl)) lost += w;
    }
    return tot ? lost / tot : 0;
  };

  // Düşman sayıları kesin bilinmez: yuvarlanmış tahmin
  const estimate = men => {
    const b = Math.max(1, Math.round(men / 1000 / 5) * 5);
    return `~${b} bölük <span class="muted">(≈${G.fmtK(b * 1000)})</span>`;
  };

  const playerWars = () => {
    const S = G.S, me = S.player;
    return (S.wars || []).filter(w => w.att.has(me) || w.def.has(me));
  };

  U.refreshWarPanel = function (force) {
    const el = $('warpanel');
    if (!G.S || el.classList.contains('hidden')) return;
    const S = G.S, me = S.player, wars = playerWars();
    if (!wars.length) {
      el.innerHTML = `<div class="wp-head"><h2>Savaş Durumu</h2><button class="x" id="wp-close">✕</button></div>
        <div class="wp-empty">Ülkemiz barış içinde. ${(S.nations[me].dead || 0) > 0 ? `Şimdiye dek savaşlarda ${G.fmtNum(S.nations[me].dead)} askerimizi kaybettik.` : ''}</div>`;
      $('wp-close').onclick = U.toggleWarPanel;
      return;
    }
    if (!wars.some(w => w.id === U.warSel)) U.warSel = wars[0].id;
    const w = wars.find(x => x.id === U.warSel);
    const mine = w.att.has(me) ? w.att : w.def, theirs = w.att.has(me) ? w.def : w.att;
    const men = {}, armies = {}, enc = {};
    for (const a of S.armies) {
      men[a.tag] = (men[a.tag] || 0) + a.men;
      armies[a.tag] = (armies[a.tag] || 0) + 1;
      if (a.encircled) enc[a.tag] = (enc[a.tag] || 0) + 1;
    }
    const sum = (side, o) => [...side].reduce((s, t) => s + (o[t] || 0), 0);
    const ourMen = sum(mine, men), theirMen = sum(theirs, men);
    const ourCas = G.war.sideCas(w, mine), theirCas = G.war.sideCas(w, theirs);
    const leader = w.att.has(me) ? w.b : w.a;
    const score = G.warScore(me, leader);
    const days = Math.floor((S.hour - w.start) / 24);
    const nameOf = t => S.nations[t].name;
    const side = (tags, our) => [...tags].filter(t => S.nations[t].alive).map(t => {
      const cp = Math.round(U.capProgress(t) * 100);
      return `<div class="wp-nat">${U.flag(t)} <span class="link" data-nation="${t}">${G.esc(nameOf(t))}</span>
        <span class="wp-mini">${our ? `${G.fmtK(men[t] || 0)} · ${armies[t] || 0} ordu` : estimate(men[t] || 0)}</span>
        <span class="wp-cap" title="Teslimiyet ilerlemesi: topraklarının ne kadarı işgal altında"><i style="width:${cp}%"></i><b>%${cp}</b></span></div>`;
    }).join('');

    el.innerHTML = `
      <div class="wp-head">
        <h2>Savaş Durumu</h2>
        <div class="wp-tabs">${wars.map(x => {
          const l = x.att.has(me) ? x.b : x.a;
          return `<button data-war="${x.id}" class="${x.id === w.id ? 'on' : ''}">${U.flag(l)} ${G.esc(nameOf(l))}</button>`;
        }).join('')}</div>
        <button class="x" id="wp-close">✕</button>
      </div>
      <div class="wp-title">${G.esc(nameOf(w.a))} – ${G.esc(nameOf(w.b))} Savaşı <span class="muted">· ${days} gündür sürüyor</span></div>
      <div class="wp-score"><span>Savaş skoru</span>
        <div class="wp-bar"><div class="our" style="width:${50 + score / 2}%"></div></div><b class="${score >= 0 ? 'pos' : 'neg'}">${score > 0 ? '+' : ''}${score}</b></div>
      <div class="wp-cols">
        <div class="wp-col our">
          <h3>Bizim taraf</h3>
          <div class="wp-big"><span>Sahadaki asker</span><b>${G.fmtNum(ourMen)}</b></div>
          <div class="wp-big"><span>Bölük</span><b>${Math.round(ourMen / 1000)}</b></div>
          <div class="wp-big"><span>Kayıplar</span><b class="neg">${G.fmtNum(ourCas)}</b></div>
          ${sum(mine, enc) ? `<div class="wp-big"><span>Kuşatılmış ordu</span><b class="neg">${sum(mine, enc)}</b></div>` : ''}
          ${side(mine, true)}
        </div>
        <div class="wp-col their">
          <h3>Düşman</h3>
          <div class="wp-big"><span>Sahadaki asker (tahmini)</span><b>~${G.fmtK(Math.round(theirMen / 5000) * 5000)}</b></div>
          <div class="wp-big"><span>Bölük (tahmini)</span><b>~${Math.round(theirMen / 5000) * 5}</b></div>
          <div class="wp-big"><span>Kayıplar</span><b class="pos">${G.fmtNum(theirCas)}</b></div>
          ${sum(theirs, enc) ? `<div class="wp-big"><span>Kuşatılmış ordu</span><b class="pos">${sum(theirs, enc)}</b></div>` : ''}
          ${side(theirs, false)}
        </div>
      </div>
      <div class="wp-chart">
        <div class="wp-legend">
          <span><i style="background:${OUR}"></i>Bizim ordu</span><span><i style="background:${THEIR}"></i>Düşman ordusu (tahmini)</span>
          <span><i class="dash" style="border-color:${OUR}"></i>Bizim kayıplar</span><span><i class="dash" style="border-color:${THEIR}"></i>Düşman kayıpları</span>
        </div>
        <canvas id="wp-canvas" width="720" height="170"></canvas>
      </div>`;
    $('wp-close').onclick = U.toggleWarPanel;
    el.querySelectorAll('[data-war]').forEach(b => b.onclick = () => { U.warSel = +b.dataset.war; U.refreshWarPanel(true); });
    el.querySelectorAll('[data-nation]').forEach(b => b.onclick = () => U.showDiplomacy && U.showDiplomacy(b.dataset.nation));
    U.drawWarChart($('wp-canvas'), w, w.att.has(me), [ourMen, theirMen, ourCas, theirCas]);
  };

  // Çizgi grafiği: sahadaki asker (düz) ve toplam kayıplar (kesik)
  U.drawWarChart = function (cv, w, weAtt, now) {
    const ctx = cv.getContext('2d'), dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth || 720, H = cv.clientHeight || 170;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const day = Math.floor(G.S.hour / 24);
    const pts = (w.hist || []).map(h => weAtt ? [h[0], h[1], h[2], h[3], h[4]] : [h[0], h[2], h[1], h[4], h[3]]);
    pts.push([day, ...now]);
    const L = 46, R = 8, T = 8, B = 20;
    const x0 = pts[0][0], x1 = Math.max(x0 + 1, pts[pts.length - 1][0]);
    let max = 1000;
    for (const p of pts) for (let i = 1; i < 5; i++) max = Math.max(max, p[i]);
    max *= 1.1;
    const X = d => L + (d - x0) / (x1 - x0) * (W - L - R);
    const Y = v => T + (1 - v / max) * (H - T - B);
    ctx.clearRect(0, 0, W, H);
    ctx.font = `11px ${G.FONT_BODY}`;
    ctx.fillStyle = '#a99c7e'; ctx.strokeStyle = 'rgba(214,179,106,0.12)'; ctx.lineWidth = 1;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let k = 0; k <= 4; k++) {
      const v = max * k / 4, y = Y(v);
      ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(W - R, y); ctx.stroke();
      ctx.fillText(G.fmtK(v), L - 5, y);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    // yaklaşık tarih: oyun 1 Ocak 1040'ta başlar
    for (let k = 0; k <= 4; k++) {
      const d = x0 + (x1 - x0) * k / 4;
      const y = 1040 + Math.floor(d / 365.25), m = Math.min(11, Math.floor((d % 365.25) / 30.44));
      ctx.textAlign = k === 0 ? 'left' : k === 4 ? 'right' : 'center';
      ctx.fillText(`${G.MONTHS[m].slice(0, 3)} ${y}`, k === 0 ? L : k === 4 ? W - R : X(d), H - B + 4);
    }
    const line = (i, color, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = dash ? 1.6 : 2.2;
      ctx.setLineDash(dash ? [5, 4] : []);
      ctx.beginPath();
      pts.forEach((p, k) => (k ? ctx.lineTo(X(p[0]), Y(p[i])) : ctx.moveTo(X(p[0]), Y(p[i]))));
      ctx.stroke();
    };
    line(1, OUR, false); line(2, THEIR, false); line(3, OUR, true); line(4, THEIR, true);
    ctx.setLineDash([]);
  };
})();
