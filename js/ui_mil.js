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
      // seçili ordularla başka bir orduya sağ tık: o orduyu doldur
      if (p.a && G.selected.size && !G.selected.has(p.a) && p.a.fleet == null) { G.joinOrder([...G.selected].filter(a => a.tag === S.player), p.a); return; }
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
    if (!m) return '';
    const nbs = G.ai.neighbors()[tag] || new Set();
    const choices = [...new Set([...me.enemies, ...nbs])].filter(t => S.nations[t] && S.nations[t].alive && !G.sameRealm(t, tag));
    return `<div class="mc-box" style="--mc:${m.color}">
      <div class="mc-title">Mareşalin emirleri</div>
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
    const after = () => { G.command.update(); U.refreshOrdular(); U.refreshArmyPanel(true); G.mapDirty = true; };
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

  // ------------------------------------------------------------ seçili ordu kutusu (ekranın solu)
  // Üstte bağlı olduğu mareşal, sonra komutan, bileşim (piyade / okçu / süvari), emirler ve eylemler.
  U.armyAssignOpen = false;
  const statusOf = a => {
    const S = G.S, P = S.provinces;
    if (a.fleet != null) return ['⛵', 'Gemide'];
    if (a.retreating) return ['↩', 'Bozgun, geri çekiliyor'];
    if (a.encircled) return ['⚠', 'Kuşatıldı! İkmal yolu kesik'];
    if (a.transport != null && N.fleet(a.transport)) return ['⚓', 'Gemiye binmeyi bekliyor'];
    if (a.attacking != null) return ['⚔', `Saldırıyor: ${P[a.attacking].name}`];
    if (a.besieging && G.atWar(a.tag, P[a.prov].ctrl)) return ['♜', `Kuşatıyor: ${P[a.prov].name}`];
    if (a.path.length) return ['➜', `Yürüyor: ${P[a.path[a.path.length - 1]].name}`];
    return ['⛺', `Bekliyor: ${P[a.prov].name}`];
  };
  const compOf = arr => {
    const c = { piyade: 0, okcu: 0, suvari: 0 };
    for (const a of arr) { const k = G.composition(a); c.piyade += k.piyade; c.okcu += k.okcu; c.suvari += k.suvari; }
    return c;
  };

  U.refreshArmyPanel = function (force) {
    const el = $('armypanel');
    if (G.selFleet) { U._fleetForce = !!force || U._fleetForce; U.refreshFleetPanel(); return; }
    const sel = [...G.selected];
    if (!sel.length) { el.classList.add('hidden'); U.armyAssignOpen = false; return; }
    // fare kutunun üzerindeyken ya da bir seçim kutusu açıkken kendiliğinden yenileme (açık menüyü kapatmasın)
    if (!force && !el.classList.contains('hidden') && (el.matches(':hover') || el.contains(document.activeElement) && document.activeElement.tagName === 'SELECT')) return;
    el.classList.remove('hidden');
    el.classList.add('army');
    const S = G.S, P = S.provinces, tag = S.player;
    const mine = sel.every(a => a.tag === tag);
    const total = sel.reduce((t, a) => t + a.men, 0), max = sel.reduce((t, a) => t + a.maxMen, 0);
    const org = sel.reduce((t, a) => t + a.org * a.men, 0) / Math.max(1, total);
    const gear = sel.reduce((t, a) => t + G.econ.ratio(a) * a.men, 0) / Math.max(1, total);
    const comp = compOf(sel);
    const one = sel.length === 1 ? sel[0] : null;
    const prov = sel[0].prov, samePlace = sel.every(a => a.prov === prov && a.prov != null);
    const docked = samePlace && mine ? S.fleets.filter(f => f.tag === tag && f.docked === prov) : [];
    const mids = [...new Set(sel.map(a => a.marshal))];
    const m = mids.length === 1 && mids[0] != null ? C.marshal(mids[0]) : null;
    const nat = S.nations[sel[0].tag];

    // 1) mareşal
    let marshalHtml;
    if (m) {
      marshalHtml = `<div class="ap-marshal" style="--mc:${m.color}">
        <div class="ap-k">Mareşal</div>
        <div class="ap-mname">${G.esc(m.leader.name)} <span class="stars">${stars(m.leader.skill)}</span></div>
        <div class="ap-sub">${traitHtml(m.leader.trait)} ${C.armies(m).length}/3 ordu${m.front ? ` · Cephe: ${G.esc(S.nations[m.front].name)}${m.attack ? ' ⚔' : ' 🛡'}` : ''}</div>
      </div>`;
    } else {
      marshalHtml = `<div class="ap-marshal free"><div class="ap-k">Mareşal</div>
        <div class="ap-mname">${mids.length > 1 ? 'Farklı mareşaller' : 'Bağımsız ordu'}</div></div>`;
    }
    // mareşale atama listesi
    const assign = mine && U.armyAssignOpen ? `<div class="ap-assign">
        ${C.of(tag).map(mm => {
          const full = C.armies(mm).filter(x => !sel.includes(x)).length + sel.length > C.MAX_ARMIES;
          return `<button data-assign="${mm.id}" style="--mc:${mm.color}" ${full ? 'disabled title="Bu mareşalin yeri yok (en fazla 3 ordu)"' : ''}>
            <i></i>${G.esc(mm.leader.name)} <span class="muted">${C.armies(mm).length}/3</span></button>`;
        }).join('')}
        ${sel.length <= C.MAX_ARMIES ? '<button data-assign="new" class="newm">＋ Yeni mareşal kur</button>' : ''}
      </div>` : '';

    // 2) komutan(lar)
    const cmdHtml = one ? (() => {
      const g = one.general, [ic, st] = statusOf(one);
      return `<div class="ap-cmd">
        <div class="ap-k">${G.esc(one.name)}</div>
        <div class="ap-gname">${G.esc(g.name)} <span class="stars">${stars(g.skill)}</span></div>
        <div class="ap-sub">${traitHtml(g.trait)}${g.skill < 5 ? ` <span class="muted">tecrübe %${Math.round((g.xp || 0) / (60 * g.skill) * 100)}</span>` : ''}</div>
        <div class="ap-status">${ic} ${G.esc(st)}</div></div>`;
    })() : `<div class="ap-cmd"><div class="ap-k">${sel.length} ordu seçili</div>
        ${sel.map(a => `<div class="ap-mini" data-only="${a.id}"><span>${G.esc(a.name)}</span><span class="muted">${G.esc(a.general.name)}</span><b>${G.fmtK(a.men)}</b><span>${statusOf(a)[0]}</span></div>`).join('')}</div>`;

    // 3) güç ve bileşim
    const statHtml = `<div class="ap-stats">
        <div class="ap-big"><b>${G.fmtNum(total)}</b><span class="muted"> / ${G.fmtNum(max)} asker</span></div>
        <div class="ap-bars">
          <div title="Örgütlenme (moral)"><span>Örgütlenme</span><div class="bar org"><div style="width:${org}%"></div></div><em>%${Math.round(org)}</em></div>
          <div title="Mevcut"><span>Mevcut</span><div class="bar str"><div style="width:${Math.min(100, total / Math.max(1, max) * 100)}%"></div></div><em>%${Math.round(total / Math.max(1, max) * 100)}</em></div>
          <div title="Teçhizat"><span>Teçhizat</span><div class="bar gear"><div style="width:${gear * 100}%"></div></div><em>%${Math.round(gear * 100)}</em></div>
        </div>
        <div class="ap-comp">
          <div><i>🛡</i><b>${G.fmtNum(comp.piyade)}</b><span>Piyade</span></div>
          <div><i>🏹</i><b>${G.fmtNum(comp.okcu)}</b><span>Okçu</span></div>
          <div><i>🐎</i><b>${G.fmtNum(comp.suvari)}</b><span>Süvari</span></div>
        </div>
        ${one ? `<details class="ap-boluk"><summary>${G.bolukler(one).length} bölük ve komutanları</summary>
          <div class="boluk-list">${G.bolukler(one).map(b => `<div><span>${G.esc(b.name)}</span><span class="muted">${G.esc(b.cmdr)}</span><span>${G.fmtNum(b.men)}</span></div>`).join('')}</div></details>` : ''}
      </div>`;

    el.innerHTML = `<div class="ap-head" style="--nc:${nat.color}"><span class="flag" style="background:${nat.color}"></span>
        <span>${one ? G.esc(one.name) : `${sel.length} ordu`}</span><button class="x" id="btn-army-desel" title="Seçimi bırak (Esc)">✕</button></div>
      ${marshalHtml}
      ${mine ? `<div class="ap-row"><button id="btn-assign" class="${U.armyAssignOpen ? 'on' : ''}">⚑ Mareşale ata</button>
        ${sel.some(a => a.marshal != null) ? '<button id="btn-army-free">Mareşalden ayır</button>' : ''}</div>` : ''}
      ${assign}
      ${cmdHtml}
      ${statHtml}
      ${mine && m ? U.marshalControls(sel) : ''}
      ${mine ? `<div class="ap-actions">
        <button id="btn-army-stop" title="Yürüyüşü ve saldırıyı durdur">✋ Dur</button>
        ${one ? '<button id="btn-army-split" title="Orduyu ikiye böl; yeni yarıya yeni komutan atanır">✂ Böl</button>' : ''}
        ${sel.length > 1 && samePlace ? '<button id="btn-army-merge" title="Aynı eyaletteki orduları birleştir">⊕ Birleştir</button>' : ''}
        ${docked.map(f => `<button class="board" data-f="${f.id}" title="Boş yer: ${G.fmtNum(N.cap(f) - N.cargoMen(f))} asker">⛵ ${G.esc(f.name)}'na bindir</button>`).join('')}
        ${!docked.length ? '<button id="btn-army-board" title="Ordu en uygun limana yürür, boştaki bir filo gelir ve ordu biner">⛵ Gemiye bindir</button>' : ''}
      </div>
      <div class="ap-hint">Sağ tık: hedefe yürü / saldır · deniz aşırı kıyıya sağ tık ya da Ctrl + sağ tık: gemiyle çıkarma</div>` : ''}`;

    $('btn-army-desel').onclick = () => G.clearSelection();
    if (!mine) return;
    U.bindMarshalControls(el, sel);
    const done = () => { U.refreshArmyPanel(true); U.refreshOrdular(); G.mapDirty = true; };
    for (const r of el.querySelectorAll('[data-only]')) r.onclick = () => G.selectArmies([S.armies.find(a => a.id === +r.dataset.only)], false);
    $('btn-assign').onclick = () => { U.armyAssignOpen = !U.armyAssignOpen; done(); };
    for (const b of el.querySelectorAll('[data-assign]')) {
      b.onclick = () => {
        if (b.dataset.assign === 'new') C.createMarshal(tag, sel);
        else {
          const mm = C.marshal(+b.dataset.assign);
          for (const a of sel) a.marshal = null;
          let left = 0;
          for (const a of sel) if (!C.attach(a, mm)) left++;
          if (left) U.addLog(G.fmtDate(S.time, false), `Bir mareşal en fazla 3 ordu yönetebilir; ${left} ordu bağlanamadı.`, 'war');
        }
        U.armyAssignOpen = false;
        G.command.update();
        done();
      };
    }
    const fr = $('btn-army-free');
    if (fr) fr.onclick = () => { for (const a of sel) a.marshal = null; done(); };
    $('btn-army-stop').onclick = () => { for (const a of sel) { if (a.retreating) continue; a.path = []; a.attacking = null; a.besieging = false; } done(); };
    const sp = $('btn-army-split');
    if (sp) sp.onclick = () => {
      const a = sel[0], b2 = C.split(a);
      if (!b2) U.addLog(G.fmtDate(S.time, false), 'Bölmek için ordu en az 4.000 asker olmalı, savaşta ya da gemide olmamalı.', 'war');
      else G.selectArmies([a, b2], false);
      done();
    };
    const mg = $('btn-army-merge');
    if (mg) mg.onclick = () => {
      const err = C.merge(sel);
      if (err) U.addLog(G.fmtDate(S.time, false), err, 'war');
      G.selectArmies(sel.filter(a => S.armies.includes(a)), false);
      done();
    };
    for (const b of el.querySelectorAll('.board')) {
      b.onclick = () => {
        const f = N.fleet(+b.dataset.f);
        const err = N.embark(f, sel);
        if (err) U.addLog(G.fmtDate(S.time, false), err, 'war');
        G.selectFleet(f);
      };
    }
    const bd = $('btn-army-board');
    if (bd) bd.onclick = () => {
      for (const a of sel) a.transport = null;
      const r = N.planTransport(sel, null);
      if (typeof r === 'string') U.addLog(G.fmtDate(S.time, false), r, 'war');
      else U.addLog(G.fmtDate(S.time, false), `${r.n} ordu ${S.provinces[r.port].name} limanına yürüyor; ${r.fleet.name} orada onları gemilere bindirecek.`, 'good');
      done();
    };
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

  // Seçili filo kutusu (ekranın solu): amiral, gemiler ve kaptanları, deniz piyadeleri, gemideki ordular, emirler
  U.refreshFleetPanel = function () {
    const el = $('armypanel'), f = G.selFleet, S = G.S;
    if (!f || !S.fleets.includes(f)) { G.selFleet = null; el.classList.add('hidden'); return; }
    if (!el.classList.contains('hidden') && el.dataset.fleet === String(f.id) && el.matches(':hover') && !U._fleetForce) return;
    U._fleetForce = false;
    el.dataset.fleet = f.id;
    el.classList.remove('hidden');
    const a = f.admiral, nat = S.nations[f.tag], mine = f.tag === S.player;
    const max = N.maxShips(f), mx = N.maxMarines(f);
    const hp = N.hp(f), mhp = N.maxHp(f);
    const kinds = { savas: 0, nakliye: 0, hafif: 0 };
    for (const sh of f.ships) { const t = G.SHIP_TYPES[sh.type]; if (t.atk >= 6) kinds.savas++; else if (t.cap >= 1000) kinds.nakliye++; else kinds.hafif++; }
    const cargo = f.cargo.map(id => S.armies.find(x => x.id === id)).filter(Boolean);
    const marked = f.ships.filter(sh => U.shipSel.has(sh.id)).length;
    el.innerHTML = `<div class="ap-head" style="--nc:${nat.color}"><span class="flag" style="background:${nat.color}"></span>
        <span>⛵ ${G.esc(f.name)}</span><button class="x" id="btn-fleet-desel" title="Seçimi bırak (Esc)">✕</button></div>
      <div class="ap-marshal" style="--mc:#6aa8c0">
        <div class="ap-k">Amiral</div>
        <div class="ap-mname">${G.esc(a.name)} <span class="stars">${stars(a.skill)}</span></div>
        <div class="ap-sub">${traitHtml(a.trait)} <b style="color:${f.ships.length > max ? '#ff7a5a' : 'var(--text)'}">${f.ships.length} / ${max}</b> gemi yönetiyor</div>
        <div class="bar str" style="margin-top:4px"><div style="width:${Math.min(100, f.ships.length / max * 100)}%"></div></div>
      </div>
      <div class="ap-cmd"><div class="ap-status">${U.fleetStatus(f)}</div>
        <div class="ap-sub">Hız ${N.speed(f).toFixed(1)} km/s · menzil ${N.range(f)} bölge · saldırı ${Math.round(N.power(f))} · ${G.fmtNum(N.crew(f))} denizci</div></div>
      <div class="ap-stats">
        <div class="ap-bars">
          <div title="Gövde sağlamlığı"><span>Sağlamlık</span><div class="bar hpb"><div style="width:${hp / Math.max(1, mhp) * 100}%"></div></div><em>%${Math.round(hp / Math.max(1, mhp) * 100)}</em></div>
          <div title="Taşınan asker"><span>Yük</span><div class="bar str"><div style="width:${Math.min(100, N.cargoMen(f) / Math.max(1, N.cap(f)) * 100)}%"></div></div><em>${G.fmtK(N.cargoMen(f))}/${G.fmtK(N.cap(f))}</em></div>
          ${mx ? `<div title="Deniz piyadeleri: düşman kıyısına sağ tıklayınca kendiliğinden çıkarma yaparlar"><span>Deniz piyadesi</span><div class="bar mar"><div style="width:${f.marines / mx * 100}%"></div></div><em>${G.fmtK(f.marines)}</em></div>` : ''}
        </div>
        <div class="ap-comp">
          <div><i>⛵</i><b>${kinds.savas}</b><span>Savaş</span></div>
          <div><i>⛴</i><b>${kinds.nakliye}</b><span>Nakliye</span></div>
          <div><i>🚣</i><b>${kinds.hafif}</b><span>Hafif</span></div>
        </div>
      </div>
      <div class="ap-ships">
        <div class="ap-k">Gemiler ve kaptanları <span class="muted">· ayırmak için tıklayıp işaretleyin</span></div>
        ${f.ships.map(sh => {
          const t = G.SHIP_TYPES[sh.type];
          sh.captain ||= G.nameFor(f.tag);
          return `<div class="ap-ship ${U.shipSel.has(sh.id) ? 'sel' : ''}" data-ship="${sh.id}" title="${G.esc(t.desc)}">
            <i>${t.atk >= 6 ? '⛵' : t.cap >= 1000 ? '⛴' : '🚣'}</i>
            <span class="nm">${G.esc(sh.name)}<small>${G.esc(t.name)}</small></span>
            <span class="cp">${G.esc(sh.captain)}</span>
            <span class="hpw"><span class="hpbar"><div style="width:${sh.hp / t.hp * 100}%"></div></span></span></div>`;
        }).join('')}
      </div>
      ${cargo.length ? `<div class="ap-cmd"><div class="ap-k">Gemideki ordular</div>
        ${cargo.map(x => `<div class="ap-mini"><span>${G.esc(x.name)}</span><span class="muted">${G.esc(x.general.name)}</span><b>${G.fmtK(x.men)}</b><span>${x.marine ? '⚓' : '⚔'}</span></div>`).join('')}</div>` : ''}
      ${mine ? `<div class="ap-actions">
        <button id="btn-fleet-home" title="En yakın dost limana dön">⚓ Limana dön</button>
        ${f.docked != null && f.cargo.length ? '<button id="btn-unload">⬇ Askerleri indir</button>' : ''}
        ${marked ? `<button id="btn-fleet-split" title="İşaretli gemilerle yeni filo">✂ ${marked} gemiyle yeni filo</button>` : ''}
        <button id="btn-fleet-navy">Tersaneler</button>
      </div>
      <div class="ap-hint">Sağ tık: denize git · dost limana demirle · düşman kıyısına çıkarma · kendi başka filona sağ tık: o filoyu amiralinin yönetebileceği kadar gemiyle doldur</div>` : ''}`;
    $('btn-fleet-desel').onclick = () => G.clearSelection();
    if (!mine) return;
    const redo = () => { U._fleetForce = true; U.refreshFleetPanel(); U.refreshOrdular(); G.mapDirty = true; };
    for (const r of el.querySelectorAll('[data-ship]')) r.onclick = () => {
      const id = +r.dataset.ship;
      for (const x of [...U.shipSel]) if (!f.ships.some(sh => sh.id === x)) U.shipSel.delete(x);
      if (U.shipSel.has(id)) U.shipSel.delete(id); else U.shipSel.add(id);
      redo();
    };
    $('btn-fleet-home').onclick = () => {
      const err = N.orderHome(f);
      if (err) U.addLog(G.fmtDate(S.time, false), err, 'war');
      redo();
    };
    const un = $('btn-unload');
    if (un) un.onclick = () => { N.disembark(f, f.docked); redo(); };
    const sp = $('btn-fleet-split');
    if (sp) sp.onclick = () => {
      const nf = N.splitFleet(f, f.ships.filter(sh => U.shipSel.has(sh.id)).map(sh => sh.id));
      if (!nf) U.addLog(G.fmtDate(S.time, false), 'Filo ayrılamadı: filo durmalı ve en az bir gemi kalmalı.', 'war');
      else { U.shipSel.clear(); G.selectFleet(nf); }
      redo();
    };
    $('btn-fleet-navy').onclick = () => U.showNavy();
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
      const n = N.transferShips(o, f);
      if (!n) U.addLog(G.fmtDate(S.time, false), `${f.name} dolu: amirali en fazla ${N.maxShips(f)} gemi yönetebilir.`, 'war');
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
