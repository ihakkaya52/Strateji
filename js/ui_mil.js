// Askerî arayüz: ordular (komutanlar), bölükler, donanma ve tersaneler
'use strict';

(function () {
  const U = G.ui, C = G.command, N = G.navy;
  const $ = id => document.getElementById(id);
  const stars = k => '★'.repeat(k) + '☆'.repeat(5 - k);
  const traitHtml = t => t ? `<span class="trait" title="${G.esc(G.TRAITS[t].desc)}">${G.esc(G.TRAITS[t].name)}</span>` : '';

  // ------------------------------------------------------------ komutan çubuğu (ekranın alt ortası, HOI4 tarzı)
  U.toggleOrdular = function () {
    const el = $('cmdbar');
    el.classList.toggle('collapsed');
    U.refreshOrdular();
  };

  // Sade komuta çubuğu: her mareşalin orduları ince renkli bir çerçeve içinde, üstte mareşalin adı.
  // Sol tık orduyu seçer (kamera kıpırdamaz), sağ tık kamerayı yumuşakça orduya kaydırır.
  // Cephe ve taarruz emirleri, ordu seçilince sağdaki ordu panelindedir.
  U.refreshOrdular = function () {
    const el = $('cmdbar');
    if (!el || !G.S) return;
    const S = G.S, tag = S.player;
    const marshals = C.of(tag);
    const free = C.freeArmies(tag);
    const selIds = new Set([...G.selected].map(a => a.id));
    const card = a => {
      const st = a.fleet != null ? '⛵' : a.retreating ? '↩' : a.encircled ? '⚠' : a.attacking != null ? '⚔' : a.path.length ? '➜'
        : a.besieging && G.atWar(a.tag, S.provinces[a.prov].ctrl) ? '♜' : '';
      return `<div class="oc ${selIds.has(a.id) ? 'sel' : ''} ${a.encircled ? 'enc' : ''}" data-a="${a.id}"
          title="${G.esc(a.name)} · ${G.esc(a.general.name)} · ${G.fmtNum(a.men)} / ${G.fmtNum(a.maxMen)} asker">
        <div class="oc-men">${G.fmtK(a.men)}${st ? `<i>${st}</i>` : ''}</div>
        <div class="oc-bar org"><div style="width:${Math.max(0, a.org)}%"></div></div>
        <div class="oc-bar str"><div style="width:${Math.min(100, a.men / a.maxMen * 100)}%"></div></div>
      </div>`;
    };
    el.classList.remove('navy', 'garr');
    el.innerHTML = `<div class="ob-row">
      ${marshals.map(m => `<div class="og" data-m="${m.id}" style="--mc:${m.color}">
          <div class="og-name" title="Mareşal ${G.esc(m.leader.name)} — tıkla: ordularını seç">${G.esc(m.leader.name)}${m.attack ? ' ⚔' : m.front ? ' 🛡' : ''}</div>
          <div class="og-cards">${C.armies(m).map(card).join('')}</div></div>`).join('')}
      ${free.length ? `<div class="og free"><div class="og-name">Bağımsız</div><div class="og-cards">${free.map(card).join('')}</div></div>` : ''}
    </div>`;
    const pick = e => {
      const c = e.target.closest('.oc');
      if (c) return { a: S.armies.find(x => x.id === +c.dataset.a) };
      const g = e.target.closest('.og-name');
      const grp = g && g.parentElement.dataset.m ? C.marshal(+g.parentElement.dataset.m) : null;
      return grp ? { m: grp } : null;
    };
    el.onclick = e => {
      if (el.classList.contains('collapsed')) { U.toggleOrdular(); return; }
      const p = pick(e);
      if (!p) return;
      if (p.a) {
        if (p.a.fleet != null) { G.selectFleet(G.navy.fleet(p.a.fleet)); return; }
        G.selectArmies([p.a], e.shiftKey);
      } else if (p.m) G.selectArmies(C.armies(p.m).filter(a => a.fleet == null), e.shiftKey);
    };
    el.oncontextmenu = e => {
      e.preventDefault();
      const p = pick(e);
      if (!p) return;
      const arr = p.a ? [p.a] : C.armies(p.m);
      const pos = arr.map(a => a.prov != null ? S.provinces[a.prov] : G.navy.fleet(a.fleet) && S.seas[G.navy.fleet(a.fleet).zone]).filter(Boolean);
      if (!pos.length) return;
      G.map.glide = { x: pos.reduce((t, q) => t + q.x, 0) / pos.length, y: pos.reduce((t, q) => t + q.y, 0) / pos.length,
        scale: Math.max(G.map.cam.scale, 26) };
    };
    el.onchange = null;
  };

  // Mareşal emirleri (ordu panelinde gösterilir)
  U.marshalControls = function (sel) {
    const S = G.S, tag = S.player, me = S.nations[tag];
    const m = sel.length && sel[0].marshal != null && sel.every(a => a.marshal === sel[0].marshal) ? C.marshal(sel[0].marshal) : null;
    if (!m) {
      return sel.every(a => a.tag === tag) && sel.length <= C.MAX_ARMIES && sel.every(a => a.marshal == null)
        ? '<div class="mc-box"><button data-mc="new">⚑ Seçili ordularla mareşal grubu kur</button></div>' : '';
    }
    const nbs = G.ai.neighbors()[tag] || new Set();
    const choices = [...new Set([...me.enemies, ...nbs])].filter(t => S.nations[t] && S.nations[t].alive && !G.sameRealm(t, tag));
    return `<div class="mc-box" style="--mc:${m.color}">
      <div class="mc-title">Mareşal ${G.esc(m.leader.name)} <span class="muted">· ${C.armies(m).length}/3 ordu</span></div>
      <div class="mc-row"><select data-mc="front"><option value="">Cephe yok</option>
        ${choices.map(t => `<option value="${t}" ${m.front === t ? 'selected' : ''}>${G.esc(S.nations[t].name)}${me.enemies.has(t) ? ' ⚔' : ''}</option>`).join('')}</select>
        <button data-mc="hold" class="${m.front && !m.attack ? 'on' : ''}" ${m.front ? '' : 'disabled'} title="Cephe boyunca savun">🛡 Savun</button>
        <button data-mc="attack" class="${m.attack ? 'on' : ''}" ${m.front ? '' : 'disabled'} title="Taarruz">⚔ Taarruz</button>
        <button data-mc="target" class="${m.target != null ? 'on' : ''}" ${m.front ? '' : 'disabled'} title="Taarruz oku çiz">➹ Hedef</button>
        <button data-mc="disband" title="Mareşali görevden al">✕</button></div></div>`;
  };
  U.bindMarshalControls = function (el, sel) {
    const S = G.S, tag = S.player;
    const m = sel[0] && sel[0].marshal != null ? C.marshal(sel[0].marshal) : null;
    const after = () => { G.command.update(); U.refreshOrdular(); U.refreshArmyPanel(); G.mapDirty = true; };
    el.querySelectorAll('[data-mc]').forEach(b => {
      const act = b.dataset.mc;
      if (act === 'front') { b.onchange = () => { m.front = b.value || null; if (!m.front) { m.attack = false; m.target = null; } after(); }; return; }
      b.onclick = () => {
        if (act === 'new') { C.createMarshal(tag, sel.filter(a => a.tag === tag)); after(); return; }
        if (!m) return;
        if (act === 'hold') m.attack = false;
        else if (act === 'attack') {
          m.attack = true;
          if (!G.atWar(tag, m.front)) U.addLog(G.fmtDate(S.time, false), `${S.nations[m.front].name} ile savaşta değilsiniz; ordular yalnızca cepheye konuşlanacak.`, 'war');
        } else if (act === 'target') { if (m.target != null) m.target = null; else { U.startTargetMode(m); return; } }
        else if (act === 'disband') C.removeMarshal(m);
        after();
      };
    });
  };

  U.startTargetMode = function (m) {
    U.targetOrdu = m;
    const bar = $('modebar');
    bar.textContent = `Mareşal ${m.leader.name}: taarruz hedefini haritada seçin (Esc iptal)`;
    bar.classList.remove('hidden');
  };
  U.endTargetMode = function () {
    U.targetOrdu = null;
    $('modebar').classList.add('hidden');
  };
  U.setTarget = function (pid) {
    const m = U.targetOrdu, S = G.S, p = S.provinces[pid];
    U.endTargetMode();
    if (!m || p.kind === 'waste') return;
    if (G.sameRealm(p.ctrl, S.player)) { U.addLog(G.fmtDate(S.time, false), 'Hedef düşman toprağında olmalı.', 'war'); return; }
    m.target = pid;
    if (!m.front && p.ctrl) m.front = G.topLord(p.ctrl);
    m.attack = true;
    G.command.update();
    U.refreshOrdular(); G.mapDirty = true;
  };

  // ------------------------------------------------------------ seçili ordular paneli
  U.refreshArmyPanel = function () {
    const el = $('armypanel');
    if (G.selFleet) { U.refreshFleetPanel(); return; }
    const sel = [...G.selected];
    if (!sel.length) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const S = G.S, P = S.provinces;
    const mine = sel.every(a => a.tag === S.player);
    const total = sel.reduce((s, a) => s + a.men, 0);
    const prov = sel[0].prov;
    const samePlace = sel.every(a => a.prov === prov);
    const docked = samePlace && mine ? S.fleets.filter(f => f.tag === S.player && f.docked === prov) : [];
    const marshals = C.of(S.player).filter(m => C.armies(m).length < C.MAX_ARMIES || sel.some(a => a.marshal === m.id));
    el.innerHTML = `<h3>${sel.length} ordu · ${G.fmtNum(total)} asker</h3>
      <div class="muted" style="font-size:12px;margin-bottom:6px">Sağ tıkla hedef seç. Deniz aşırı kıyıya sağ tık (ya da Ctrl + sağ tık): ordu gemiye binip oraya çıkarma yapar.</div>
      ${sel.map(a => {
        const g = a.general, m = a.marshal != null ? C.marshal(a.marshal) : null;
        const status = a.retreating ? 'Bozgun: geri çekiliyor' : a.encircled ? '<b style="color:#ff7a5a">Kuşatıldı!</b>'
          : a.transport != null && N.fleet(a.transport) ? `Gemiye binmeyi bekliyor: ${G.esc(P[N.fleet(a.transport).plan ? N.fleet(a.transport).plan.port : a.prov].name)}`
          : a.attacking != null ? `Saldırıyor: ${G.esc(P[a.attacking].name)}`
          : a.besieging && G.atWar(a.tag, P[a.prov].ctrl) ? `Kuşatıyor: ${G.esc(P[a.prov].name)}`
          : a.path.length ? `Yürüyor: ${G.esc(P[a.path[a.path.length - 1]].name)}`
          : `Bekliyor: ${G.esc(P[a.prov].name)}`;
        const bs = G.bolukler(a);
        const byType = {};
        for (const b of bs) byType[b.type] = (byType[b.type] || 0) + 1;
        return `<div class="army-row">
          <span class="nm">${G.esc(a.name)}</span><span>${G.fmtNum(a.men)} / ${G.fmtNum(a.maxMen)}</span>
          <span style="grid-column:1/3;font-size:13px">Komutan: <b>${G.esc(g.name)}</b> <span style="color:var(--gold)">${stars(g.skill)}</span> ${traitHtml(g.trait)}
            ${g.skill < 5 ? `<span class="muted"> · tecrübe ${Math.round((g.xp || 0) / (60 * g.skill) * 100)}%</span>` : ''}</span>
          <span class="muted" style="grid-column:1/3">${m ? `Mareşal ${G.esc(m.leader.name)}` : 'Bağımsız ordu'} · ${status}</span>
          <span style="grid-column:1/3;font-size:12px">Teçhizat: <b style="color:${G.econ.ratio(a) > 0.9 ? '#9ad07a' : G.econ.ratio(a) > 0.6 ? '#e0c060' : '#ff7a5a'}">%${Math.round(G.econ.ratio(a) * 100)}</b>
            ${a.gear ? `<span class="muted">· ${G.econ.TYPES.filter(t => G.econ.need(a)[t] > 0).map(t => `${G.EQUIP[t].icon} ${G.fmtK(a.gear[t])}/${G.fmtK(G.econ.need(a)[t])}`).join(' ')}</span>` : ''}</span>
          <details style="grid-column:1/3"><summary class="muted">${bs.length} bölük: ${Object.entries(byType).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ')}</summary>
            <div class="boluk-list">${bs.map(b => `<div><span>${G.esc(b.name)}</span><span class="muted">${G.esc(b.cmdr)}</span><span>${G.fmtNum(b.men)}</span></div>`).join('')}</div>
          </details>
          <div class="bars">
            <div title="Örgütlenme"><div class="bar org"><div style="width:${a.org}%"></div></div></div>
            <div title="Mevcut"><div class="bar str"><div style="width:${Math.min(100, a.men / a.maxMen * 100)}%"></div></div></div>
          </div></div>`;
      }).join('')}
      ${mine ? U.marshalControls(sel) : ''}
      ${mine ? `<div class="row-btns" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:5px">
        <button id="btn-army-stop">Dur</button>
        ${sel.length === 1 ? '<button id="btn-army-split" title="Orduyu ikiye böl; yeni yarıya yeni bir komutan atanır">Böl</button>' : ''}
        ${sel.length > 1 && samePlace ? '<button id="btn-army-merge" title="Aynı eyaletteki orduları birleştir (komutan kapasitesi kadar)">Birleştir</button>' : ''}
        ${marshals.length ? `<select id="sel-army-join"><option value="">Mareşale bağla…</option>
          ${marshals.map(m => `<option value="${m.id}">${G.esc(m.leader.name)} (${C.armies(m).length}/3)</option>`).join('')}</select>` : ''}
        ${sel.some(a => a.marshal != null) ? '<button id="btn-army-free">Mareşalden ayır</button>' : ''}
        ${docked.map(f => `<button class="board" data-f="${f.id}" title="Boş yer: ${G.fmtNum(N.cap(f) - N.cargoMen(f))} asker">⛵ ${G.esc(f.name)} gemilerine bindir</button>`).join('')}
        ${!docked.length ? '<button id="btn-army-board" title="Ordu en uygun limana yürür, boştaki bir filo oraya gelir ve ordu gemiye biner">⛵ Gemiye bindir</button>' : ''}
        <button id="btn-army-desel">Seçimi bırak</button>
      </div>` : ''}`;
    if (!mine) return;
    U.bindMarshalControls(el, sel);
    const done = () => { U.refreshArmyPanel(); U.refreshOrdular(); G.mapDirty = true; };
    $('btn-army-stop').onclick = () => { for (const a of G.selected) { if (a.retreating) continue; a.path = []; a.attacking = null; a.besieging = false; } done(); };
    const sp = $('btn-army-split');
    if (sp) sp.onclick = () => {
      const a = sel[0], b = C.split(a);
      if (!b) U.addLog(G.fmtDate(S.time, false), 'Bölmek için ordu en az 4.000 asker olmalı, savaşta ya da gemide olmamalı.', 'war');
      else G.selectArmies([a, b], false);
      done();
    };
    const mg = $('btn-army-merge');
    if (mg) mg.onclick = () => {
      const err = C.merge(sel);
      if (err) U.addLog(G.fmtDate(S.time, false), err, 'war');
      G.selectArmies(sel.filter(a => S.armies.includes(a)), false);
      done();
    };
    const join = $('sel-army-join');
    if (join) join.onchange = () => {
      const m = C.marshal(+join.value);
      let left = 0;
      for (const a of G.selected) if (!C.attach(a, m)) left++;
      if (left) U.addLog(G.fmtDate(S.time, false), `Bir mareşal en fazla 3 ordu yönetebilir; ${left} ordu bağlanamadı.`, 'war');
      done();
    };
    const fr = $('btn-army-free');
    if (fr) fr.onclick = () => { for (const a of G.selected) a.marshal = null; done(); };
    for (const b of el.querySelectorAll('.board')) {
      b.onclick = () => {
        const f = N.fleet(+b.dataset.f);
        const err = N.embark(f, [...G.selected]);
        if (err) U.addLog(G.fmtDate(S.time, false), err, 'war');
        G.selectFleet(f);
      };
    }
    const bd = $('btn-army-board');
    if (bd) bd.onclick = () => {
      for (const a of G.selected) a.transport = null;
      const r = N.planTransport([...G.selected], null);
      if (typeof r === 'string') U.addLog(G.fmtDate(S.time, false), r, 'war');
      else U.addLog(G.fmtDate(S.time, false), `${r.n} ordu ${S.provinces[r.port].name} limanına yürüyor; ${r.fleet.name} orada onları gemilere bindirecek.`, 'good');
      done();
    };
    $('btn-army-desel').onclick = () => G.clearSelection();
  };

  // ------------------------------------------------------------ filo paneli (haritada seçili filo)
  U.shipSummary = function (f) {
    const by = {};
    for (const sh of f.ships) {
      const t = (by[sh.type] ||= { n: 0, hp: 0, max: 0 });
      t.n++; t.hp += sh.hp; t.max += G.SHIP_TYPES[sh.type].hp;
    }
    return `<table class="ship-table"><tr><th>Tür</th><th class="num">Adet</th><th>Sağlamlık</th><th class="num">Saldırı</th><th class="num">Kapasite</th><th class="num">Menzil</th></tr>
      ${Object.entries(by).map(([k, v]) => {
        const t = G.SHIP_TYPES[k];
        return `<tr><td title="${G.esc(t.desc)}">${G.esc(t.name)}</td><td class="num">${v.n}</td>
          <td><span class="hpbar"><div style="width:${v.hp / v.max * 100}%"></div></span></td>
          <td class="num">${t.atk * v.n}</td><td class="num">${G.fmtNum(t.cap * v.n)}</td><td class="num">${t.range}</td></tr>`;
      }).join('')}</table>`;
  };

  U.fleetStatus = function (f) {
    const S = G.S;
    if (f.plan) return `Nakliye: ${G.esc(S.provinces[f.plan.port].name)} limanında ordu bekliyor${f.plan.target != null ? ` → ${G.esc(S.provinces[f.plan.target].name)}` : ''}`;
    if (f.docked != null) return `Limanda: ${G.esc(S.provinces[f.docked].name)}`;
    if (S.navalBattles.has(f.zone)) return `Muharebede: ${G.esc(S.seas[f.zone].name)}`;
    if (f.retreating) return 'Geri çekiliyor';
    if (f.order && f.order.kind === 'land') return `Çıkarma${f.order.marines ? ' (deniz piyadeleri)' : ''}: ${G.esc(S.provinces[f.order.prov].name)}`;
    if (f.order && f.order.kind === 'dock') return `Limana gidiyor: ${G.esc(S.provinces[f.order.prov].name)}`;
    if (f.path.length) return `Yolda: ${G.esc(S.seas[f.path[f.path.length - 1]].name)}`;
    return `Denizde: ${G.esc(S.seas[f.zone].name)}`;
  };

  U.cargoHtml = function (f) {
    const S = G.S;
    if (!f.cargo.length) return '';
    const units = f.cargo.map(id => S.armies.find(a => a.id === id)).filter(Boolean);
    return `<div class="cargo">Gemideki askerler: ${units.map(a => `${G.esc(a.name)} (${G.fmtK(a.men)})`).join(', ')}
      · ${G.fmtNum(N.cargoMen(f))} / ${G.fmtNum(N.cap(f))}</div>`;
  };

  U.marinesHtml = function (f) {
    const mx = N.maxMarines(f);
    if (!mx) return '<div class="cargo muted">Bu filoda deniz piyadesi taşıyan savaş gemisi yok.</div>';
    return `<div class="cargo">⚔ Deniz piyadesi: <b>${G.fmtNum(f.marines)}</b> / ${G.fmtNum(mx)}
      <span class="muted">${f.marines < N.MIN_MARINES ? '· çıkarma için yetersiz, dost limanda tamamlanır' : '· düşman kıyısına sağ tıklayınca kendiliğinden çıkarma yaparlar'}</span></div>`;
  };

  U.refreshFleetPanel = function () {
    const el = $('armypanel'), f = G.selFleet, S = G.S;
    if (!f || !S.fleets.includes(f)) { G.selFleet = null; el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    const a = f.admiral;
    el.innerHTML = `<h3>⛵ ${G.esc(f.name)}</h3>
      <div class="muted" style="font-size:13px">Kaptan: <b style="color:var(--text)">${G.esc(a.name)}</b>
        <span class="stars" style="color:var(--gold)">${stars(a.skill)}</span> ${traitHtml(a.trait)}</div>
      <div class="muted" style="font-size:13px">${U.fleetStatus(f)} · Mürettebat ${G.fmtNum(N.crew(f))} denizci ·
        Hız ${N.speed(f).toFixed(1)} km/s · Menzil ${N.range(f)} bölge</div>
      ${U.shipSummary(f)}
      ${U.marinesHtml(f)}
      ${U.cargoHtml(f)}
      <div class="muted" style="font-size:12px;margin-top:6px">Sağ tık: denize → git · dost limana → demirle ·
        düşman kıyısına → çıkarma (gemide ordu varsa ordu, yoksa geminin deniz piyadeleri çıkar). Açık renkli deniz bölgeleri menzil içinde.</div>
      <div class="row-btns" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:5px">
        ${f.docked != null && f.cargo.length ? '<button id="btn-unload">Askerleri limana indir</button>' : ''}
        <button id="btn-fleet-navy">Donanma arayüzü</button>
        <button id="btn-fleet-desel">Seçimi bırak</button>
      </div>`;
    const un = $('btn-unload');
    if (un) un.onclick = () => { N.disembark(f, f.docked); U.refreshFleetPanel(); G.mapDirty = true; };
    $('btn-fleet-navy').onclick = () => U.showNavy();
    $('btn-fleet-desel').onclick = () => G.clearSelection();
  };

  // ------------------------------------------------------------ donanma arayüzü
  U.showNavy = function () {
    $('navywin').classList.remove('hidden');
    U.refreshNavy();
  };

  U.refreshNavy = function () {
    const win = $('navywin');
    if (win.classList.contains('hidden')) return;
    const S = G.S, tag = S.player, n = S.nations[tag];
    const fleets = N.fleetsOf(tag), docks = S.dockyards.filter(d => d.tag === tag);
    const ships = fleets.reduce((s, f) => s + f.ships.length, 0);
    const crew = fleets.reduce((s, f) => s + N.crew(f), 0);
    $('navy-sub').textContent = `${fleets.length} filo · ${ships} gemi · ${G.fmtNum(crew)} denizci · ${docks.length} tersane`;
    $('navy-fleets').innerHTML = `<h3>Filolar</h3>` + (fleets.length ? fleets.map(f => `
      <div class="fleet-card ${f === G.selFleet ? 'sel' : ''}" data-f="${f.id}">
        <div class="top"><span class="nm" data-act="sel">⛵ ${G.esc(f.name)}</span><span class="muted">${U.fleetStatus(f)}</span></div>
        <div class="muted" style="font-size:13px">Kaptan: <b style="color:var(--text)">${G.esc(f.admiral.name)}</b>
          <span style="color:var(--gold)">${stars(f.admiral.skill)}</span> ${traitHtml(f.admiral.trait)}
          · ${G.fmtNum(N.crew(f))} denizci · menzil ${N.range(f)} · hız ${N.speed(f).toFixed(1)}</div>
        ${U.shipSummary(f)}
        ${U.marinesHtml(f)}
        ${U.cargoHtml(f)}
        <div class="row" style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">
          <button data-act="sel">Haritada seç</button>
          ${fleets.length > 1 ? `<select data-act="merge"><option value="">Filoyla birleştir…</option>
            ${fleets.filter(o => o !== f && o.zone === f.zone && (o.docked === f.docked)).map(o => `<option value="${o.id}">${G.esc(o.name)}</option>`).join('')}</select>` : ''}
        </div>
      </div>`).join('') : '<p class="muted">Henüz filonuz yok. Bir tersanede gemi inşa edin.</p>');

    const types = N.types(tag);
    $('navy-docks').innerHTML = `<h3>Tersaneler</h3>` + (docks.length ? docks.map(d => {
      const p = S.provinces[d.prov];
      const q = d.queue.map(it => {
        const t = G.SHIP_TYPES[it.type];
        const f = G.clamp((S.hour - it.start) / (it.done - it.start), 0, 1);
        return `<div class="queue-item"><span>${G.esc(t.name)}</span><span>${Math.max(0, Math.ceil((it.done - S.hour) / 24))} gün
          <span class="hpbar"><div style="width:${f * 100}%"></div></span></span></div>`;
      }).join('');
      return `<div class="dock-card" data-d="${d.id}">
        <div class="top" style="display:flex;justify-content:space-between"><b>⚓ ${G.esc(p.name)}</b>
          <span class="muted">${p.ctrl !== tag ? 'İşgal altında!' : d.queue.length ? 'İnşa sürüyor' : 'Boşta'}</span></div>
        ${q}
        <div class="build-grid">${types.map(k => {
          const t = G.SHIP_TYPES[k];
          return `<button class="build-btn" data-t="${k}" ${n.manpower < t.crew || n.gold < Math.ceil(t.crew / 20) ? 'disabled' : ''} title="${G.esc(t.desc)}">
            <b>${G.esc(t.name)}</b> <span>· ${G.esc(t.role)}</span><br>
            <span>Sağ. ${t.hp} · Sal. ${t.atk} · Hız ${t.speed}<br>Menzil ${t.range} · Yük ${t.cap}<br>${t.crew} denizci · ${Math.ceil(t.crew / 20)} altın · ${t.days} gün</span></button>`;
        }).join('')}</div></div>`;
    }).join('') : '<p class="muted">Tersaneniz yok.</p>') +
      `<p class="muted" style="font-size:13px">Yeni tersane kurmak için kıyıdaki bir şehrinize tıklayın
        (${G.fmtNum(N.DOCK_COST)} insan gücü, ${N.DOCK_DAYS} gün).</p>` +
      (S.dockBuild.filter(b => b.tag === tag).map(b => `<div class="queue-item"><span>Yeni tersane: ${G.esc(S.provinces[b.prov].name)}</span>
        <span>${Math.ceil((b.done - S.hour) / 24)} gün</span></div>`).join(''));

    $('navy-fleets').onclick = e => {
      const card = e.target.closest('.fleet-card');
      const act = e.target.closest('[data-act]');
      if (!card || !act || act.tagName === 'SELECT') return;
      const f = N.fleet(+card.dataset.f);
      if (act.dataset.act === 'sel') {
        G.selectFleet(f);
        const z = S.seas[f.zone];
        G.map.cam.x = z.x; G.map.cam.y = z.y; G.mapDirty = true;
        $('navywin').classList.add('hidden');
      }
    };
    $('navy-fleets').onchange = e => {
      const card = e.target.closest('.fleet-card');
      if (!card || e.target.dataset.act !== 'merge' || !e.target.value) return;
      const f = N.fleet(+card.dataset.f), o = N.fleet(+e.target.value);
      if (o.plan) N.endPlan(o, false);
      f.ships.push(...o.ships); f.cargo.push(...o.cargo);
      f.marines = Math.min(N.maxMarines(f), (f.marines || 0) + (o.marines || 0));
      for (const id of o.cargo) { const a = S.armies.find(x => x.id === id); if (a) a.fleet = f.id; }
      S.fleets.splice(S.fleets.indexOf(o), 1);
      if (G.selFleet === o) G.selFleet = f;
      U.refreshNavy(); G.mapDirty = true;
    };
    $('navy-docks').onclick = e => {
      const b = e.target.closest('.build-btn');
      const card = e.target.closest('.dock-card');
      if (!b || !card) return;
      const d = S.dockyards.find(x => x.id === +card.dataset.d);
      if (N.queueShip(d, b.dataset.t)) { U.refreshNavy(); U.refreshTop(); }
    };
  };

  // ------------------------------------------------------------ eyalet panelindeki liman bölümü
  U.portSection = function (p) {
    const S = G.S;
    if (!N.isPort(p)) return '';
    const dock = S.dockyards.find(d => d.prov === p.id);
    const building = S.dockBuild.find(b => b.prov === p.id);
    const seas = p.sea.map(z => G.esc(S.seas[z].name)).join(', ');
    const docked = S.fleets.filter(f => f.docked === p.id);
    let html = `<h3>Liman</h3><div class="muted">Açıldığı deniz: ${seas}</div>`;
    if (dock) html += `<div>⚓ Tersane (${G.esc(S.nations[dock.tag].name)})${dock.queue.length ? ` · ${dock.queue.length} gemi inşada` : ''}</div>`;
    else if (building) html += `<div class="muted">Tersane inşa ediliyor: ${Math.ceil((building.done - S.hour) / 24)} gün</div>`;
    else if (p.owner === S.player && p.ctrl === S.player) {
      html += `<div class="row-btns"><button id="btn-dock" ${S.nations[S.player].manpower < N.DOCK_COST ? 'disabled' : ''}>
        Tersane kur (${G.fmtNum(N.DOCK_COST)} asker, ${N.DOCK_DAYS} gün)</button></div>`;
    }
    if (docked.length) html += `<div>Demirli filolar: ${docked.map(f => `${U.flag(f.tag)} ${G.esc(f.name)} (${f.ships.length})`).join(', ')}</div>`;
    return html;
  };
  U.bindPortSection = function (p) {
    const b = $('btn-dock');
    if (b) b.onclick = () => { G.navy.buildDockyard(G.S.player, p.id); U.showProvince(p.id); U.refreshTop(); };
  };
})();
