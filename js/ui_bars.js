// Alt çubuk kipleri: Kara (mareşaller), Donanma (amiraller, gemiler, kaptanlar), Garnizon (kaleler)
'use strict';

(function () {
  const U = G.ui, N = G.navy, EC = G.econ;
  const $ = id => document.getElementById(id);
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  // Komutan portresi: yordamsal minyatür (portraits.js), yoksa baş harfler
  const portrait = (g, color, big, tag, kind) => G.portrait
    ? `<div class="portrait pimg ${big ? 'big' : ''}" style="--pc:${color}">${G.portrait.leader(g, tag || G.S.player, kind || 'general', { size: big ? 36 : 30 })}<i class="pstars">${'★'.repeat(g.skill)}</i></div>`
    : `<div class="portrait ${big ? 'big' : ''}" style="--pc:${color}">
      <span>${G.esc(initials(g.name))}</span><i class="pstars">${'★'.repeat(g.skill)}</i></div>`;
  const FLEET_COLORS = ['#4f8ad0', '#3aa0a0', '#7a6ad0', '#5aa06a', '#c0904a', '#a05a8a', '#6a8aa0'];

  U.barMode = 'kara';
  U.shipSel = new Set();

  U.setBarMode = function (mode) {
    U.barMode = mode;
    for (const b of $('barmodes').children) b.classList.toggle('active', b.dataset.bar === mode);
    G.map.garrisonView = mode === 'garnizon';
    $('cmdbar').classList.remove('collapsed');
    U.refreshOrdular();
    G.mapDirty = true;
  };

  // Kara kipi mevcut komuta çubuğudur; diğer kipler aynı yeri kullanır
  const karaRefresh = U.refreshOrdular;
  U.refreshOrdular = function () {
    const el = $('cmdbar');
    if (!el || !G.S) return;
    if (U.barMode === 'donanma') return U.refreshNavyBar();
    if (U.barMode === 'garnizon') return U.refreshGarrisonBar();
    el.classList.remove('navy', 'garr');
    return karaRefresh();
  };

  const head = (title, extra) => {
    const el = $('cmdbar');
    return `<div class="cb-head"><span>${title}</span>${extra || ''}
      <button data-act="fold" title="Çubuğu küçült / büyüt (O)">${el.classList.contains('collapsed') ? '▲' : '▼'}</button></div>`;
  };

  // ------------------------------------------------------------ donanma
  // Ordu çubuğu gibi sade: her filo ince renkli bir çerçeve, üstte amiralin adı, içinde gemiler ve gemideki ordular.
  // Sol tık filoyu seçer (kamera kıpırdamaz), sağ tık kamerayı yumuşakça filoya kaydırır.
  // Gemi kartına sol tık o gemiyi ayırmak için işaretler; ayırma, limana dönüş ve indirme sağdaki filo panelindedir.
  U.refreshNavyBar = function () {
    const el = $('cmdbar'), S = G.S, tag = S.player;
    el.classList.add('navy'); el.classList.remove('garr');
    const fleets = N.fleetsOf(tag);
    for (const id of [...U.shipSel]) if (!fleets.some(f => f.ships.some(sh => sh.id === id))) U.shipSel.delete(id);
    const ship = sh => {
      const t = G.SHIP_TYPES[sh.type];
      sh.captain ||= G.nameFor(tag);
      return `<div class="oc ship ${U.shipSel.has(sh.id) ? 'sel' : ''}" data-ship="${sh.id}"
          title="${G.esc(sh.name)} · ${G.esc(t.name)}\nKaptan: ${G.esc(sh.captain)}\nSaldırı ${t.atk} · Kapasite ${t.cap} · Deniz piyadesi ${t.marines || 0}">
        <div class="oc-men">${t.atk >= 6 ? '⛵' : t.cap >= 1000 ? '⛴' : '🚣'}</div>
        <div class="oc-bar hp"><div style="width:${sh.hp / t.hp * 100}%"></div></div></div>`;
    };
    const army = a => `<div class="oc cargo" data-cargo="${a.id}" title="${G.esc(a.name)} · ${G.fmtNum(a.men)} asker${a.marine ? ' (deniz piyadesi)' : ''}">
        <div class="oc-men">${G.fmtK(a.men)}</div><div class="oc-bar str"><div style="width:${Math.min(100, a.men / a.maxMen * 100)}%"></div></div></div>`;
    el.innerHTML = `<div class="ob-row">${fleets.length ? fleets.map((f, i) => {
      const col = FLEET_COLORS[i % FLEET_COLORS.length];
      const cargo = f.cargo.map(id => S.armies.find(a => a.id === id)).filter(Boolean);
      const st = f.docked != null ? '⚓' : S.navalBattles.has(f.zone) ? '⚔' : f.order && f.order.kind === 'land' ? '⇲' : f.path.length ? '➜' : '';
      return `<div class="og ${G.selFleet === f ? 'selg' : ''}" data-f="${f.id}" style="--mc:${col}">
        <div class="og-name" title="${G.esc(f.name)} · Amiral ${G.esc(f.admiral.name)} — tıkla: filoyu seç">${G.esc(f.admiral.name)} <span class="og-cnt">${f.ships.length}/${N.maxShips(f)}</span>${st ? ' ' + st : ''}</div>
        <div class="og-cards">${f.ships.map(ship).join('')}${cargo.length ? `<span class="og-sep"></span>${cargo.map(army).join('')}` : ''}</div></div>`;
    }).join('') : '<div class="muted" style="padding:6px">Henüz filonuz yok.</div>'}</div>`;
    const fleetOf = e => { const g = e.target.closest('.og'); return g && g.dataset.f ? N.fleet(+g.dataset.f) : null; };
    el.onclick = e => {
      if (el.classList.contains('collapsed')) { U.toggleOrdular(); return; }
      const f = fleetOf(e);
      if (!f) return;
      const sc = e.target.closest('.oc.ship');
      if (sc) {
        const id = +sc.dataset.ship;
        for (const x of [...U.shipSel]) if (!f.ships.some(sh => sh.id === x)) U.shipSel.delete(x);
        if (U.shipSel.has(id)) U.shipSel.delete(id); else U.shipSel.add(id);
      }
      G.selectFleet(f);
      U.refreshOrdular();
    };
    el.oncontextmenu = e => {
      e.preventDefault();
      const f = fleetOf(e);
      if (!f) return;
      // seçili filoyla başka bir filoya sağ tık: o filoyu doldur
      if (G.selFleet && G.selFleet !== f && G.selFleet.tag === tag) {
        const src = G.selFleet, before = f.ships.length, r = N.orderJoin(src, f);
        const log = (t, c) => U.addLog(G.fmtDate(S.time, false), t, c);
        if (r === 'done') log(`${f.name} filosuna ${f.ships.length - before} gemi katıldı (${f.ships.length} / ${N.maxShips(f)}).`, 'good');
        else if (r === 'moving') log(`${src.name}, ${f.name} filosuna katılmak için yola çıktı.`, 'good');
        else if (r === 'full') log(`${f.name} dolu: amirali en fazla ${N.maxShips(f)} gemi yönetebilir.`, 'war');
        else log(r, 'war');
        U.refreshOrdular(); U.refreshArmyPanel(true); G.mapDirty = true;
        return;
      }
      const z = S.seas[f.zone];
      G.map.glide = { x: z.x, y: z.y, scale: Math.max(G.map.cam.scale, 20) };
    };
    el.onchange = null;
  };

  // ------------------------------------------------------------ garnizon
  U.refreshGarrisonBar = function () {
    const el = $('cmdbar'), S = G.S, tag = S.player;
    el.classList.add('garr'); el.classList.remove('navy');
    const forts = S.provinces.filter(p => p.fort && p.ctrl === tag);
    forts.sort((a, b) => (!!b.siege - !!a.siege) || (EC.isCapital(b) - EC.isCapital(a)) || b.fort - a.fort || b.garrison - a.garrison);
    const tot = forts.reduce((s, p) => s + p.garrison, 0), max = forts.reduce((s, p) => s + EC.maxGarrison(p), 0);
    const lost = S.provinces.filter(p => p.fort && p.owner === tag && p.ctrl !== tag).length;
    el.innerHTML = head(`Garnizonlar · ${forts.length} kale · ${G.fmtNum(tot)} / ${G.fmtNum(max)} asker${lost ? ` · ${lost} kale düşman elinde` : ''}`,
      `<span class="muted" style="font-size:11px">Hepsi:</span>${[0, 0.5, 1].map(v => `<button data-all="${v}">%${v * 100}</button>`).join('')}`) +
      `<div class="cb-row">${forts.map(p => {
        const mx = EC.maxGarrison(p), sg = p.siege;
        return `<div class="fcard ${sg ? 'besieged' : ''}" data-p="${p.id}" title="${G.esc(p.name)}: kale ${p.fort}, surlar %${Math.round(p.walls ?? 100)}">
          <div class="ftop"><span class="flvl">${'♜'.repeat(p.fort)}</span>${EC.isCapital(p) ? '<span class="fcap">★</span>' : ''}</div>
          <div class="fname">${G.esc(p.name)}</div>
          <div class="gmen">${G.fmtNum(p.garrison)} / ${G.fmtNum(mx)}</div>
          <div class="gbar str"><div style="width:${mx ? p.garrison / mx * 100 : 0}%"></div></div>
          <div class="gstat">${sg ? `<b style="color:#ff7a5a">${sg.assault ? 'HÜCUM!' : `Kuşatmada · ${Math.ceil(sg.food || 0)} gün erzak`}</b>` : `hedef %${Math.round((p.garTarget ?? 1) * 100)}`}</div>
        </div>`;
      }).join('') || '<div class="muted" style="padding:8px">Elinizde kale yok.</div>'}</div>`;
    el.onclick = e => {
      const btn = e.target.closest('[data-act]');
      if (btn && btn.dataset.act === 'fold') { U.toggleOrdular(); return; }
      const all = e.target.closest('[data-all]');
      if (all) {
        for (const p of forts) p.garTarget = +all.dataset.all;
        U.refreshOrdular(); return;
      }
      const c = e.target.closest('.fcard');
      if (!c) return;
      const pid = +c.dataset.p;
      G.map.centerOn(pid, Math.max(G.map.cam.scale, 30));
      U.showProvince(pid);
      G.mapDirty = true;
    };
    el.onchange = null;
  };
})();
