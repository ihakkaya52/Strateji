// Teknoloji penceresi: dört dal yan yana (askerî, ulaşım, savunma, ekonomi), dikey eksende yıllar
'use strict';

(function () {
  const U = G.ui, T = G.tech;
  const $ = id => document.getElementById(id);
  const Y0 = 940, Y1 = 1250, ROW = 58, CARD_H = 52;
  const yPos = y => (y - Y0) / 10 * ROW;
  const H = yPos(Y1) + 20;

  // Her dalda kartların sütunları: önkoşulun sütununa yakın, üst üste binmeyecek şekilde
  const layout = {};
  for (const cat of Object.keys(T.CATS)) {
    const list = T.LIST.filter(t => t.cat === cat).sort((a, b) => a.year - b.year);
    const placed = [];
    for (const t of list) {
      const parent = t.req.map(r => layout[r]).find(Boolean);
      const pref = parent ? parent.col : placed.filter(q => q.col === 0).length > placed.filter(q => q.col === 1).length ? 1 : 0;
      const order = [pref, 1 - pref];
      let col = order.find(c => !placed.some(q => q.col === c && Math.abs(q.y - yPos(t.year)) < CARD_H + 4));
      let y = yPos(t.year);
      if (col == null) { col = pref; while (placed.some(q => q.col === col && Math.abs(q.y - y) < CARD_H + 4)) y += 8; }
      layout[t.id] = { col, y };
      placed.push({ col, y });
    }
  }

  const fmtDays = d => (d < 60 ? `${d} gün` : d < 730 ? `${Math.round(d / 30)} ay` : `${(Math.round(d / 36.5) / 10).toLocaleString('tr-TR')} yıl`);

  U.showTech = function () {
    const el = $('techwin');
    if (!el.classList.contains('hidden')) { el.classList.add('hidden'); return; }
    for (const id of ['focuswin', 'prodwin', 'navywin', 'pagewin', 'warpanel']) { const e = $(id); if (e) e.classList.add('hidden'); }
    U.page = null;
    el.classList.remove('hidden');
    U.renderTech(true);
  };

  U.renderTech = function (first) {
    const el = $('techwin');
    if (!el || el.classList.contains('hidden') || !G.S) return;
    const S = G.S, tag = S.player, n = S.nations[tag];
    U._techAt = S.hour;
    const body = el.querySelector('.tech-body');
    const scroll = body ? body.scrollTop : null;
    const nowY = yPos(S.time.y + S.time.m / 12);

    // araştırma yerleri
    const slots = [];
    for (let i = 0; i < n.slots; i++) {
      const r = n.research[i];
      if (!r) { slots.push(`<div class="ts-slot empty"><span class="muted">Boş araştırma yeri</span><span class="muted small">Aşağıdan bir buluş seçin</span></div>`); continue; }
      const t = T.BY[r.id];
      slots.push(`<div class="ts-slot"><div class="ts-ic">${t.icon}</div><div class="ts-main"><div><b>${G.esc(t.name)}</b> <span class="muted small">${T.CATS[t.cat].name} · ${t.year}</span></div>
        <div class="bar"><div style="width:${Math.min(100, r.prog / r.need * 100)}%"></div></div>
        <div class="muted small">${fmtDays(T.daysLeft(tag, t))} kaldı</div></div>
        <button class="ts-x" data-cancel="${t.id}" title="Araştırmayı bırak (ilerleme kaybolur)">✕</button></div>`);
    }

    // dallar
    const panes = Object.entries(T.CATS).map(([cat, C]) => {
      const list = T.LIST.filter(t => t.cat === cat);
      const lines = [];
      for (const t of list) for (const r of t.req) {
        const a = layout[r], b = layout[t.id];
        if (!a || T.BY[r].cat !== cat) continue;
        const x1 = a.col * 150 + 75, y1 = a.y + CARD_H, x2 = b.col * 150 + 75, y2 = b.y;
        const done = n.techs.has(r);
        lines.push(`<path d="M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}" class="${done ? 'on' : ''}"/>`);
      }
      const cards = list.map(t => {
        const L = layout[t.id], has = n.techs.has(t.id), r = n.research.find(x => x.id === t.id);
        const av = T.available(tag, t);
        const ahead = t.year - S.time.y;
        const st = has ? 'done' : r ? 'busy' : av ? 'avail' : 'locked';
        const reqs = t.req.map(id => T.BY[id].name).join(', ');
        const tip = `${t.name} (${t.year})\n${t.desc}\n\n${t.eff.map(T.text).join('\n')}${reqs ? `\n\nÖnkoşul: ${reqs}` : ''}` +
          (!has ? `\n\nSüre: ${fmtDays(T.daysLeft(tag, t))}${ahead > 0 ? ` — zamanının ${ahead} yıl ötesinde (×${(Math.round(T.timeMult(t) * 10) / 10).toLocaleString('tr-TR')})` : ahead < 0 ? ' — geride kalınmış buluş, hızlı öğrenilir' : ''}` : '');
        const foot = has ? '<span class="tc-ok">✓ Biliniyor</span>'
          : r ? `<div class="bar"><div style="width:${Math.min(100, r.prog / r.need * 100)}%"></div></div>`
          : `<span class="${ahead > 30 ? 'bad' : ahead > 0 ? 'warn' : 'muted'}">≈ ${fmtDays(T.daysLeft(tag, t))}</span>`;
        return `<div class="tcard ${st}" data-tech="${t.id}" title="${G.esc(tip)}" style="top:${L.y}px;left:calc(${L.col * 50}% + 4px)">
          <div class="tc-top"><span class="tc-ic">${t.icon}</span><span class="tc-name">${G.esc(t.name)}</span><span class="tc-y">${t.year}</span></div>
          <div class="tc-eff">${t.eff.map(T.text).join(' · ')}</div>
          <div class="tc-foot">${foot}</div></div>`;
      }).join('');
      const known = list.filter(t => n.techs.has(t.id)).length;
      return `<div class="tpane"><div class="tp-head"><span class="tp-ic">${C.icon}</span><div><b>${C.name}</b><div class="muted small">${C.desc} · ${known} / ${list.length}</div></div></div>
        <div class="tp-tree" style="height:${H}px">
          <svg class="tp-lines" viewBox="0 0 300 ${H}" preserveAspectRatio="none" style="height:${H}px">${lines.join('')}</svg>
          ${cards}</div></div>`;
    }).join('');
    const years = [];
    for (let y = 950; y <= Y1; y += 25) years.push(`<div class="ty" style="top:${yPos(y)}px">${y}</div>`);

    el.innerHTML = `<div class="focus-head"><h2>Teknoloji</h2>
        <span class="muted">Araştırma hızı ×${(Math.round(T.daily(n) * 100) / 100).toLocaleString('tr-TR')} · ${n.techs.size} / ${T.LIST.length} buluş · zamanının ötesindeki buluşlar katlanarak uzun sürer</span>
        <button class="tech-close">✕</button></div>
      <div class="tech-slots">${slots.join('')}</div>
      <div class="tech-body">
        <div class="tech-grid" style="height:${H + 50}px">
          <div class="tyears"><div class="tp-head ghost"></div><div class="tp-tree" style="height:${H}px">${years.join('')}</div></div>
          ${panes}
          <div class="tnow" style="top:${nowY + 50}px"><span>${S.time.y} · bugün</span></div>
          <div class="tfuture" style="top:${nowY + 50}px;height:${H - nowY}px"></div>
        </div>
      </div>`;
    const nb = el.querySelector('.tech-body');
    nb.scrollTop = first || scroll == null ? Math.max(0, nowY - 160) : scroll;
    el.querySelector('.tech-close').onclick = () => el.classList.add('hidden');
    el.onclick = e => {
      const c = e.target.closest('[data-cancel]');
      if (c) { T.cancel(tag, c.dataset.cancel); U.renderTech(); U.refreshTop(); return; }
      const card = e.target.closest('.tcard.avail');
      if (!card) return;
      const [ok, why] = T.start(tag, card.dataset.tech);
      if (!ok) U.toast ? U.toast(why) : U.addLog(G.fmtDate(S.time, false), why, 'war');
      U.renderTech(); U.refreshTop();
    };
  };

  // üst çubuk düğmesi
  const baseInit = U.initGame;
  U.initGame = function () {
    baseInit();
    $('tb-tech').onclick = () => U.showTech();
  };
  const baseTop = U.refreshTop;
  U.refreshTop = function () {
    baseTop();
    const S = G.S;
    if (!S || !S.nations[S.player]) return;
    const n = S.nations[S.player];
    const txt = $('tb-techtxt');
    if (txt && n.research) {
      txt.textContent = `${n.research.length}/${n.slots}`;
      $('tb-tech').classList.toggle('idle', n.research.length < n.slots);
    }
    if (!$('techwin').classList.contains('hidden') && S.hour - (U._techAt || 0) >= 24 * 3) U.renderTech();
  };
  window.addEventListener('keydown', e => {
    if (!G.S || e.ctrlKey || e.target.tagName === 'INPUT') return;
    if (!$('modal').classList.contains('hidden')) return;
    if (e.key === 't' || e.key === 'T') U.showTech();
  });
})();
