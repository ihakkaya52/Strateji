// Ticaret çubuğu: yollar, değerleri, payımız ve tüccarlarımız
'use strict';

(function () {
  const U = G.ui, TR = G.trade;
  const $ = id => document.getElementById(id);
  const g1 = v => (Math.round(v * 10) / 10).toLocaleString('tr-TR');
  U.tradeSel = null;

  U.refreshTradeBar = function () {
    const el = $('cmdbar'), S = G.S, tag = S.player, n = S.nations[tag];
    el.classList.add('garr', 'trade'); el.classList.remove('navy', 'kesif');
    if (!S.trade) TR.update();
    const list = TR.ROUTES.map(r => ({ r, e: S.trade[r.id] })).filter(x => x.e);
    list.sort((a, b) => ((b.e.shares[tag] || { gold: 0 }).gold - (a.e.shares[tag] || { gold: 0 }).gold) || b.e.value - a.e.value);
    const income = n.routeIncome || 0;
    const cards = list.map(({ r, e }) => {
      const s = e.shares[tag], k = n.tradeAt.filter(x => x === r.id).length;
      const [can] = TR.canSend(tag, r.id);
      const top = Object.entries(e.shares).sort((a, b) => b[1].pow - a[1].pow)[0];
      return `<div class="fcard trcard ${U.tradeSel === r.id ? 'on' : ''} ${s ? 'ours' : ''}" data-r="${r.id}" style="--rc:${r.color}"
          title="${G.esc(r.name)}\n${G.esc(r.desc)}\n\nDeğer: ayda ${g1(e.value)} altın${e.blocked ? ` (yolun ${e.blocked} yeri kesik, %${Math.round(e.health * 100)})` : ''}\nEn büyük pay: ${top ? `${S.nations[top[0]].name} %${Math.round(top[1].pow * 100)}` : '—'}">
        <div class="ftop"><span class="flvl">${r.icon}</span><span class="tr-name">${G.esc(r.name)}</span></div>
        <div class="gmen">${g1(e.value)} altın${e.blocked ? ' <b style="color:#ff7a5a">✕</b>' : ''}</div>
        <div class="gbar str"><div style="width:${s ? Math.min(100, s.pow * 100) : 0}%"></div></div>
        <div class="gstat">${s ? `<b style="color:#e8c869">%${Math.round(s.pow * 100)} · +${g1(s.gold * (n.tradeMult ?? 1))}</b>` : '<span class="muted">payımız yok</span>'}</div>
        <div class="tr-m">${k ? '🧳'.repeat(k) : ''}<button data-m="-" ${k ? '' : 'disabled'} title="Tüccarı çek">−</button><button data-m="+" ${can ? '' : 'disabled'} title="Tüccar gönder: yoldaki payımızı artırır">+</button></div>
      </div>`;
    }).join('');
    el.innerHTML = `<div class="cb-head"><span>Ticaret yolları · 🧳 ${n.tradeAt.length}/${n.merchants} tüccar · aylık +${g1(income)} altın</span>
        <button data-act="fold" title="Çubuğu küçült / büyüt (O)">${el.classList.contains('collapsed') ? '▲' : '▼'}</button></div>
      <div class="cb-row">${cards}</div>`;
    el.onclick = e => {
      const btn = e.target.closest('[data-act]');
      if (btn && btn.dataset.act === 'fold') { U.toggleOrdular(); return; }
      const c = e.target.closest('.trcard');
      if (!c) return;
      const id = c.dataset.r, m = e.target.closest('[data-m]');
      if (m) {
        if (m.dataset.m === '+') { if (!TR.send(tag, id)) U.toast && U.toast(TR.canSend(tag, id)[1]); }
        else TR.recall(tag, id);
        U.refreshOrdular(); U.refreshTop(); return;
      }
      U.tradeSel = U.tradeSel === id ? null : id;
      if (U.tradeSel) {
        const pts = TR.points(id);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
        const M = G.map;
        M.glide = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, scale: G.clamp(Math.min(M.w / (x1 - x0 + 8), (M.h - 220) / (y1 - y0 + 8)), 4, 30) };
      }
      U.refreshOrdular(); G.mapDirty = true;
    };
    el.onchange = null;
  };
})();
