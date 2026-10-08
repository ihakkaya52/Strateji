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
  U.refreshNavyBar = function () {
    const el = $('cmdbar'), S = G.S, tag = S.player;
    if (document.activeElement && el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT') return;
    el.classList.add('navy'); el.classList.remove('garr');
    const fleets = N.fleetsOf(tag);
    for (const id of [...U.shipSel]) if (!fleets.some(f => f.ships.some(sh => sh.id === id))) U.shipSel.delete(id);
    const shipCard = (f, sh) => {
      const t = G.SHIP_TYPES[sh.type];
      sh.captain ||= G.nameFor(f.tag);
      return `<div class="scard ${U.shipSel.has(sh.id) ? 'sel' : ''}" data-ship="${sh.id}" data-f="${f.id}" title="${G.esc(t.name)} · ${G.esc(t.role)}\nKaptan: ${G.esc(sh.captain)}\nSaldırı ${t.atk} · Kapasite ${t.cap} · Deniz piyadesi ${t.marines || 0}">
        <div class="sicon">${t.atk >= 6 ? '⛵' : t.cap >= 1000 ? '⛴' : '🚣'}</div>
        <div class="sname">${G.esc(sh.name)}</div>
        <div class="scap">${G.esc(sh.captain)}</div>
        <div class="stype">${G.esc(t.name)}</div>
        <div class="gbar hp"><div style="width:${sh.hp / t.hp * 100}%"></div></div>
      </div>`;
    };
    const armyCard = a => `<div class="gcard cargo" data-a="${a.id}" title="${G.esc(a.name)} · ${G.esc(a.general.name)}">
        ${portrait(a.general, S.nations[a.tag].color, false, a.tag)}
        <div class="gname">${G.esc(a.general.name)}</div>
        <div class="gmen">${G.fmtK(a.men)}</div>
        <div class="gstat">${a.marine ? 'Deniz piyadesi' : 'Gemide'}</div></div>`;
    el.innerHTML = head('Donanma', `<button data-act="split" title="Seçili gemileri yeni bir filoya ayır">✂ Seçili gemilerle yeni filo</button>
        <button data-act="navywin" title="Tersaneler ve gemi inşası (N)">Tersaneler</button>`) +
      `<div class="cb-row">${fleets.length ? fleets.map((f, i) => {
        const col = FLEET_COLORS[i % FLEET_COLORS.length], ad = f.admiral, mx = N.maxMarines(f);
        const cargo = f.cargo.map(id => S.armies.find(a => a.id === id)).filter(Boolean);
        return `<div class="mgroup fleet ${G.selFleet === f ? 'selg' : ''}" data-f="${f.id}" style="--mc:${col}">
          <div class="mhead">
            <div class="mcard" data-act="self" title="Amiral ${G.esc(ad.name)}${ad.trait ? ' · ' + G.TRAITS[ad.trait].name : ''}">
              ${portrait(ad, col, true, f.tag, 'admiral')}
              <div><div class="mname">Amiral ${G.esc(ad.name)}</div>
                <div class="gmen">${G.esc(f.name)}</div>
                <div class="gmen">${f.ships.length} gemi · ${G.fmtK(N.cap(f))} yer</div></div>
            </div>
            <div class="mctl">
              <div class="fstat">${U.fleetStatus(f)}</div>
              ${mx ? `<div class="fmar" title="Geminin kendi askerleri: düşman kıyısına sağ tıklayınca çıkarma yaparlar">⚔ ${G.fmtNum(f.marines)} / ${G.fmtNum(mx)} deniz piyadesi
                <div class="gbar mar"><div style="width:${f.marines / mx * 100}%"></div></div></div>` : '<div class="fmar muted">Deniz piyadesi yok</div>'}
              <div class="mbtns">
                <button data-act="self" title="Filoyu seç (sonra haritada sağ tık: git / demirle / çıkarma)">🎯</button>
                <button data-act="home" title="En yakın dost limana dön">⚓</button>
                ${f.docked != null && f.cargo.length ? '<button data-act="unload" title="Gemideki askerleri limana indir">⬇</button>' : ''}
              </div>
            </div>
          </div>
          <div class="garmies">${f.ships.map(sh => shipCard(f, sh)).join('')}
            ${cargo.length ? `<div class="cargo-sep" title="Gemideki ordular">⚔</div>${cargo.map(armyCard).join('')}` : ''}</div>
        </div>`;
      }).join('') : '<div class="muted" style="padding:8px">Henüz filonuz yok. Tersanelerden gemi yaptırın.</div>'}</div>`;
    el.onclick = e => {
      const btn = e.target.closest('[data-act]');
      const grp = e.target.closest('.mgroup');
      const f = grp ? N.fleet(+grp.dataset.f) : null;
      const sc = e.target.closest('.scard');
      const ac = e.target.closest('.gcard');
      if (btn && btn.dataset.act === 'fold') { U.toggleOrdular(); return; }
      if (btn && btn.dataset.act === 'navywin') { U.showNavy(); return; }
      if (btn && btn.dataset.act === 'split') {
        const owner = fleets.find(x => x.ships.some(sh => U.shipSel.has(sh.id)));
        if (!owner) { U.addLog(G.fmtDate(S.time, false), 'Önce gemi kartlarına tıklayıp ayrılacak gemileri seçin.', 'war'); return; }
        const nf = N.splitFleet(owner, owner.ships.filter(sh => U.shipSel.has(sh.id)).map(sh => sh.id));
        if (!nf) U.addLog(G.fmtDate(S.time, false), 'Filo ayrılamadı: filo durmalı (limanda ya da denizde beklerken) ve en az bir gemi kalmalı.', 'war');
        else { U.shipSel.clear(); G.selectFleet(nf); }
        U.refreshOrdular(); G.mapDirty = true; return;
      }
      if (sc && !btn) {
        const id = +sc.dataset.ship;
        // yalnızca aynı filodan gemi seçilebilir
        const fid = +sc.dataset.f;
        for (const x of [...U.shipSel]) if (!N.fleet(fid).ships.some(sh => sh.id === x)) U.shipSel.delete(x);
        if (U.shipSel.has(id)) U.shipSel.delete(id); else U.shipSel.add(id);
        U.refreshOrdular(); return;
      }
      if (ac && !btn) {
        if (f) G.selectFleet(f);
        return;
      }
      if (!f) return;
      const act = btn ? btn.dataset.act : 'self';
      if (act === 'self') {
        G.selectFleet(f);
        const z = S.seas[f.zone]; G.map.cam.x = z.x; G.map.cam.y = z.y;
      } else if (act === 'home') {
        const err = N.orderHome(f);
        if (err) U.addLog(G.fmtDate(S.time, false), err, 'war');
      } else if (act === 'unload') N.disembark(f, f.docked);
      U.refreshOrdular(); U.refreshArmyPanel(); G.mapDirty = true;
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
