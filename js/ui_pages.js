// Üst çubuk sayfaları (ekonomi, ordular, atölyeler, olaylar), bildirim baloncukları ve Esc ile ana haritaya dönüş
'use strict';

(function () {
  const U = G.ui, EC = G.econ, C = G.command, N = G.navy;
  const $ = id => document.getElementById(id);
  const g1 = v => (Math.round(v * 10) / 10).toLocaleString('tr-TR');
  const sign = v => (v >= 0 ? '+' : '') + g1(v);

  // ------------------------------------------------------------ olay kaydı ve bildirim baloncukları
  // Sol alttaki haber akışı kalktı: her şey "Olaylar" sayfasında, önemli olanlar kısa süreli baloncukla görünür.
  U.logHistory = [];
  U.unread = 0;
  U.addLog = function (date, text, cls) {
    U.logHistory.unshift({ date, text, cls });
    if (U.logHistory.length > 400) U.logHistory.length = 400;
    if (cls === 'good' || cls === 'war') {
      U.unread++;
      U.toast(text, cls);
    }
    const c = $('tb-ev-count');
    if (c) { c.textContent = U.unread; c.classList.toggle('hidden', !U.unread); }
    if (U.page === 'olaylar') U.renderPage();
  };
  U.toast = function (text, cls) {
    const box = $('toasts');
    if (!box) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (cls || '');
    t.textContent = text;
    box.prepend(t);
    while (box.children.length > 4) box.lastChild.remove();
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 5000);
  };

  // ------------------------------------------------------------ üst çubuk
  const baseInit = U.initGame;
  U.initGame = function () {
    baseInit();
    $('tb-gold').onclick = () => U.openPage('ekonomi');
    $('tb-mp').onclick = () => U.openPage('ordular');
    $('tb-ordular').onclick = () => U.openPage('ordular');
    $('tb-prod').onclick = () => U.openPage('atolyeler');
    $('tb-events').onclick = () => U.openPage('olaylar');
  };
  const baseTop = U.refreshTop;
  U.refreshTop = function () {
    baseTop();
    const S = G.S;
    if (S) $('tb-time').classList.toggle('paused', S.paused);
    if (U.page && U.page !== 'olaylar' && S && !S.paused) {
      const now = performance.now();
      if (now - (U._pageT || 0) > 1000) { U._pageT = now; U.renderPage(); }
    }
  };

  // ------------------------------------------------------------ sayfa penceresi
  U.page = null;
  U.openPage = function (page) {
    if (U.page === page && !$('pagewin').classList.contains('hidden')) { U.closePage(); return; }
    U.page = page;
    if (page === 'olaylar') { U.unread = 0; $('tb-ev-count').classList.add('hidden'); }
    for (const id of ['prodwin', 'navywin', 'focuswin', 'warpanel']) $(id).classList.add('hidden');
    $('pagewin').classList.remove('hidden');
    U.renderPage();
  };
  U.closePage = function () {
    U.page = null;
    $('pagewin').classList.add('hidden');
  };

  const TITLES = { ekonomi: 'Hazine ve Ekonomi', ordular: 'Ordular', atolyeler: 'Atölyeler ve Silahhaneler', olaylar: 'Olaylar' };
  U.renderPage = function () {
    const el = $('pagewin');
    if (!U.page || el.classList.contains('hidden') || !G.S) return;
    if (el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
    const body = PAGES[U.page]();
    const scroll = el.querySelector('.pg-body') ? el.querySelector('.pg-body').scrollTop : 0;
    el.innerHTML = `<div class="focus-head"><h2>${TITLES[U.page]}</h2>
        <div class="pg-tabs">${Object.entries(TITLES).map(([k, v]) => `<button data-page="${k}" class="${k === U.page ? 'on' : ''}">${v}</button>`).join('')}</div>
        <button class="pg-close">✕</button></div>
      <div class="pg-body">${body}</div>`;
    el.querySelector('.pg-body').scrollTop = scroll;
    el.querySelector('.pg-close').onclick = U.closePage;
    el.querySelectorAll('[data-page]').forEach(b => b.onclick = () => U.openPage(b.dataset.page));
    if (BIND[U.page]) BIND[U.page](el);
  };

  // ------------------------------------------------------------ sayfalar
  const PAGES = {};
  const BIND = {};

  // Hazine ve ekonomi
  PAGES.ekonomi = function () {
    const S = G.S, tag = S.player, n = S.nations[tag];
    const own = S.provinces.filter(p => p.owner === tag);
    const b = EC.budget(n);
    const mines = own.filter(p => p.mine > 0);
    const farms = own.filter(p => p.farm > 0);
    const goods = {};
    for (const p of own) for (const [g, k] of Object.entries(p.civLines || {})) if (k) goods[g] = (goods[g] || 0) + k;
    const top = own.filter(p => p.ctrl === tag).map(p => {
      let v = EC.isCapital(p) ? 3 : p.kind === 'city' ? 1 : 0.3;
      for (const g of EC.GOOD_KEYS) if (g !== 'insaat') v += (p.civLines[g] || 0) * G.GOODS[g].gold * (G.GOODS[g].res === p.res ? 1.5 : 1);
      if (p.mine && p.res && G.RESOURCES[p.res].mine) v += p.mine * G.RESOURCES[p.res].mine;
      v += p.farm * 0.5;
      return { p, v };
    }).sort((x, y) => y.v - x.v).slice(0, 12);
    const row = (l, v, cls) => `<tr><td>${l}</td><td class="num ${cls || ''}">${v}</td></tr>`;
    return `<div class="pg-grid3">
      <div class="pg-card">
        <h3>Hazine</h3>
        <div class="pg-big">◉ ${G.fmtNum(n.gold)} <span class="${b.net >= 0 ? 'pos' : 'neg'}">${sign(b.net)} / ay</span></div>
        <table class="pg-tab">
          <tr class="sec"><td colspan="2">Gelir</td></tr>
          ${row('Vergiler', '+' + g1(b.tax))}${row('Ticari ürünler', '+' + g1(b.trade))}${row('Madenler', '+' + g1(b.mines))}${row('Tarım', '+' + g1(b.farms))}
          ${row('<b>Toplam gelir</b>', '<b>+' + g1(b.income) + '</b>', 'pos')}
          <tr class="sec"><td colspan="2">Gider</td></tr>
          ${row('Ordu maaşları', '−' + g1(b.army))}${row('Garnizonlar', '−' + g1(b.garrison))}
          ${row('<b>Toplam gider</b>', '<b>−' + g1(b.expense) + '</b>', 'neg')}
        </table>
        ${n.gold < 0 ? '<p class="bad">Hazine eksiye düştü: ordunun morali bozuluyor!</p>' : ''}
      </div>
      <div class="pg-card">
        <h3>Ticari ürünler</h3>
        ${Object.keys(goods).length ? `<table class="pg-tab">${Object.entries(goods).map(([g, k]) => row(`${G.GOODS[g].icon} ${G.esc(G.GOODS[g].name)}`, `${k} atölye`)).join('')}</table>` : '<p class="muted">Yok.</p>'}
        <h3>Madenler</h3>
        ${mines.length ? `<table class="pg-tab">${mines.map(p => row(`<span class="link" data-prov="${p.id}">${G.esc(p.name)}</span>`, `${G.RESOURCES[p.res].icon} ${G.esc(G.RESOURCES[p.res].name)} · ${p.mine}. seviye`)).join('')}</table>` : '<p class="muted">Henüz maden yok. Demir, gümüş, altın ya da tuz olan illerde açılabilir.</p>'}
        <h3>Tarım</h3>
        <p>${farms.reduce((t, p) => t + p.farm, 0)} çiftlik · ${farms.length} ilde · ayda +${g1(b.farms)} altın, insan gücüne katkı</p>
      </div>
      <div class="pg-card">
        <h3>En çok kazandıran iller</h3>
        <table class="pg-tab">${top.map(o => row(`<span class="link" data-prov="${o.p.id}">${G.esc(o.p.name)}</span>`, `+${g1(o.v)}`, 'pos')).join('')}</table>
        <h3>İnsan gücü</h3>
        <p>♟ ${G.fmtNum(n.manpower)} · ayda +${G.fmtNum(G.monthlyManpower(tag))}</p>
      </div>
    </div>`;
  };

  // Bütün ordular
  PAGES.ordular = function () {
    const S = G.S, tag = S.player, n = S.nations[tag], P = S.provinces;
    const armies = S.armies.filter(a => a.tag === tag);
    const total = armies.reduce((t, a) => t + a.men, 0), max = armies.reduce((t, a) => t + a.maxMen, 0);
    const status = a => a.fleet != null ? '⛵ Gemide' : a.retreating ? '↩ Bozgun' : a.encircled ? '⚠ Kuşatıldı' : a.attacking != null ? `⚔ ${P[a.attacking].name}`
      : a.besieging && G.atWar(tag, P[a.prov].ctrl) ? `♜ ${P[a.prov].name}` : a.path.length ? `➜ ${P[a.path[a.path.length - 1]].name}` : `⛺ ${P[a.prov].name}`;
    const rows = list => list.map(a => `<tr class="pg-row" data-army="${a.id}">
        <td>${G.esc(a.name)}</td><td>${G.esc(a.general.name)} <span class="stars">${'★'.repeat(a.general.skill)}</span></td>
        <td class="num">${G.fmtNum(a.men)} / ${G.fmtK(a.maxMen)}</td>
        <td><div class="bar org sm"><div style="width:${a.org}%"></div></div></td>
        <td class="num">%${Math.round(EC.ratio(a) * 100)}</td><td>${G.esc(status(a))}</td></tr>`).join('');
    const groups = C.of(tag).map(m => `<tr class="grp" style="--mc:${m.color}"><td colspan="6"><i></i>Mareşal ${G.esc(m.leader.name)}
        <span class="muted">· ${C.armies(m).length}/3 ordu${m.front ? ` · cephe: ${G.esc(S.nations[m.front].name)}${m.attack ? ' ⚔' : ''}` : ''}</span></td></tr>${rows(C.armies(m))}`).join('');
    const free = C.freeArmies(tag);
    return `<div class="pg-summary">
        <div><b>${armies.length}</b><span>ordu</span></div><div><b>${C.of(tag).length}</b><span>mareşal</span></div>
        <div><b>${G.fmtNum(total)}</b><span>asker (en çok ${G.fmtNum(max)})</span></div>
        <div><b>${G.fmtNum(n.manpower)}</b><span>insan gücü</span></div>
        <div><b>${n.queue.length}</b><span>eğitimde</span></div>
        <div><button id="pg-recruit" ${n.manpower < G.RECRUIT_COST || n.gold < EC.RECRUIT_GOLD ? 'disabled' : ''}>＋ Yeni ordu topla</button>
          <span class="muted small">${G.fmtNum(G.RECRUIT_COST)} asker · ${EC.RECRUIT_GOLD} altın · ${G.RECRUIT_DAYS} gün</span></div>
      </div>
      <table class="pg-tab wide"><tr class="hd"><td>Ordu</td><td>Komutan</td><td class="num">Asker</td><td>Örgütlenme</td><td class="num">Teçhizat</td><td>Durum</td></tr>
        ${groups}${free.length ? `<tr class="grp"><td colspan="6"><i></i>Bağımsız ordular</td></tr>${rows(free)}` : ''}</table>
      <p class="muted small">Bir ordunun satırına tıklayınca o ordu seçilir ve harita yumuşakça ona kayar.</p>`;
  };
  BIND.ordular = function (el) {
    const S = G.S;
    el.querySelectorAll('[data-army]').forEach(r => r.onclick = () => {
      const a = S.armies.find(x => x.id === +r.dataset.army);
      if (!a) return;
      U.closePage();
      if (a.fleet != null) { G.selectFleet(N.fleet(a.fleet)); return; }
      G.selectArmies([a], false);
      const p = S.provinces[a.prov];
      G.map.glide = { x: p.x, y: p.y, scale: Math.max(G.map.cam.scale, 26) };
    });
    const r = $('pg-recruit');
    if (r) r.onclick = () => { G.recruit(S.player); U.renderPage(); U.refreshTop(); };
  };

  // Atölyeler ve silahhaneler: bütün iller ve ne ürettikleri
  PAGES.atolyeler = function () {
    const S = G.S, tag = S.player, n = S.nations[tag];
    EC.totals(n);
    const provs = S.provinces.filter(p => p.owner === tag && (p.civ || p.mil)).sort((a, b) => (b.civ + b.mil) - (a.civ + a.mil));
    const civTxt = p => Object.entries(p.civLines || {}).filter(([, k]) => k).map(([g, k]) => `${G.GOODS[g].icon} ${k} ${G.esc(G.GOODS[g].short || G.GOODS[g].name)}`).join(' · ') || '<span class="muted">boşta</span>';
    const milTxt = p => EC.TYPES.filter(t => p.milLines[t]).map(t => `${G.EQUIP[t].icon} ${p.milLines[t]} ${G.esc(G.EQUIP[t].short)}`).join(' · ') || (p.mil ? '<span class="muted">boşta</span>' : '');
    const stock = EC.TYPES.map(t => `<div><i>${G.EQUIP[t].icon}</i><b>${G.fmtK(n.stock[t])}</b><span>${G.esc(G.EQUIP[t].short)}</span></div>`).join('');
    return `<div class="pg-summary">
        <div><b>${n.civTotal ?? provs.reduce((t, p) => t + p.civ, 0)}</b><span>atölye</span></div>
        <div><b>${n.milTotal ?? provs.reduce((t, p) => t + p.mil, 0)}</b><span>silahhane</span></div>
        <div><b>${n.build.length}</b><span>inşaat sürüyor</span></div>
        ${stock}
        <div><button id="pg-build">İnşaat ve teçhizat penceresi</button></div>
      </div>
      <table class="pg-tab wide"><tr class="hd"><td>İl</td><td>Kaynak</td><td class="num">Atölye</td><td>Atölyeler ne yapıyor</td><td class="num">Silahhane</td><td>Silahhaneler ne üretiyor</td></tr>
        ${provs.map(p => `<tr class="pg-row" data-prov-open="${p.id}"><td>${EC.isCapital(p) ? '★ ' : ''}${G.esc(p.name)}${p.ctrl !== tag ? ' <span class="bad">(işgalde)</span>' : ''}</td>
          <td>${p.res ? `${G.RESOURCES[p.res].icon} ${G.esc(G.RESOURCES[p.res].name)}` : '—'}</td>
          <td class="num">${p.civ}</td><td>${p.civ ? civTxt(p) : ''}</td><td class="num">${p.mil}</td><td>${milTxt(p)}</td></tr>`).join('')}</table>
      <p class="muted small">Bir ile tıklayınca il paneli açılır; Atölye ve Silahhane sekmelerinden ne üretileceğini seçebilirsiniz.</p>`;
  };
  BIND.atolyeler = function (el) {
    el.querySelectorAll('[data-prov-open]').forEach(r => r.onclick = () => {
      const pid = +r.dataset.provOpen, p = G.S.provinces[pid];
      U.closePage();
      U.provTab = p.mil && !p.civ ? 'silah' : 'atolye';
      U.showProvince(pid);
      if (U.provTab !== (p.mil && !p.civ ? 'silah' : 'atolye')) { U.provTab = p.mil && !p.civ ? 'silah' : 'atolye'; U.refreshProvince(); }
      G.map.glide = { x: p.x, y: p.y, scale: Math.max(G.map.cam.scale, 30) };
    });
    $('pg-build').onclick = () => { U.closePage(); U.showProduction(); };
  };

  // Olaylar: bütün haberler
  PAGES.olaylar = function () {
    if (!U.logHistory.length) return '<p class="muted">Henüz bir olay yok.</p>';
    return `<div class="ev-list">${U.logHistory.map(e => `<div class="ev-item ${e.cls}"><span class="date">${G.esc(e.date)}</span>${G.esc(e.text)}</div>`).join('')}</div>`;
  };

  // il bağlantıları
  document.addEventListener('click', e => {
    const t = e.target.closest('#pagewin [data-prov]');
    if (!t) return;
    const p = G.S.provinces[+t.dataset.prov];
    U.closePage(); U.showProvince(p.id);
    G.map.glide = { x: p.x, y: p.y, scale: Math.max(G.map.cam.scale, 30) };
  });

  // ------------------------------------------------------------ sol taraftaki paneller
  U.closeLeftPanels = function () {
    if (U.closeProvPanel) U.closeProvPanel();
    if (U.closeDiplomacy && U.dipTag) U.closeDiplomacy();
    $('panel').classList.add('hidden');
    U.panelKind = null;
  };

  // ------------------------------------------------------------ Esc: her şeyi kapat, ana siyasi haritaya dön
  U.escapeAll = function () {
    if (U.targetOrdu) U.endTargetMode();
    for (const id of ['dipwin', 'prodwin', 'navywin', 'focuswin', 'warpanel', 'battlepanel', 'pagewin', 'mus-pop']) { const e = $(id); if (e) e.classList.add('hidden'); }
    U.page = null; U.battleKey = null; U.dipTag = null;
    G.clearSelection();
    U.closePanel();
    if (U.setBarMode && U.barMode !== 'kara') U.setBarMode('kara');
    G.map.mode = 'political';
    for (const b of document.querySelectorAll('#mapmodes [data-mode]')) b.classList.toggle('active', b.dataset.mode === 'political');
    G.map.garrisonView = false;
    G.mapDirty = true;
  };
  window.addEventListener('keydown', e => {
    if (!G.S) return;
    if (!$('modal').classList.contains('hidden')) return;   // olay penceresi bir seçim ister
    if (e.key === 'Escape') { e.stopImmediatePropagation(); U.escapeAll(); }
    else if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey) U.openPage('olaylar');
  }, true);

  // ------------------------------------------------------------ odak ağacı: sol tıkla basılı tutup sürükleme
  // (tıklama ile sürükleme ayrılır: 5 pikselden az kıpırdayan basış odağı seçer)
  window.addEventListener('mousedown', e => {
    const box = $('focus-tree');
    if (e.button !== 0 || !box || !box.contains(e.target) || !U.focusView) return;
    const start = { x: e.clientX, y: e.clientY, vx: U.focusView.x, vy: U.focusView.y };
    let moved = false;
    const mv = ev => {
      if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return;
      moved = true;
      box.classList.add('dragging');
      U.focusView.x = start.vx + ev.clientX - start.x; U.focusView.y = start.vy + ev.clientY - start.y;
      const t = box.querySelector('.ftree');
      if (t) t.style.transform = `translate(${U.focusView.x}px, ${U.focusView.y}px) scale(${U.focusView.z})`;
    };
    const up = () => {
      window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up);
      box.classList.remove('dragging');
      if (moved) {
        // sürüklemenin sonundaki tıklama odak seçmesin
        const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
        box.addEventListener('click', stop, { capture: true, once: true });
      }
    };
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    e.preventDefault();
  }, true);
})();
