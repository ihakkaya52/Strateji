// Başlatma, girdi ve oyun döngüsü
'use strict';

(function () {
  const M = G.map, U = G.ui;
  const canvas = document.getElementById('map');
  const MS_PER_HOUR = [0, 260, 110, 45, 16, 4];

  G.selected = new Set();
  G.mapDirty = true;
  G.labelsDirty = true;

  G.selFleet = null;
  G.clearSelection = function () {
    for (const a of G.selected) a.sel = false;
    G.selected.clear();
    G.selFleet = null;
    U.refreshArmyPanel(true); U.refreshOrdular();
    G.mapDirty = true;
  };
  G.selectFleet = function (f) {
    for (const a of G.selected) a.sel = false;
    G.selected.clear();
    G.selFleet = f;
    if (U.closeLeftPanels) U.closeLeftPanels();
    U.refreshArmyPanel(true); U.refreshNavy();
    G.mapDirty = true;
  };
  G.selectArmies = function (arr, add) {
    if (!add || G.selFleet) G.clearSelection();
    for (const a of arr) { if (a.fleet != null) continue; a.sel = true; G.selected.add(a); }
    if (G.selected.size && U.closeLeftPanels) U.closeLeftPanels();
    U.refreshOrdular();
    U.refreshArmyPanel(true);
    G.mapDirty = true;
  };

  M.init(canvas);
  // fontlar yüklenince haritayı yeniden çiz
  if (document.fonts) {
    Promise.all([document.fonts.load(`600 20px ${G.FONT_TITLE}`), document.fonts.load(`14px ${G.FONT_BODY}`),
      document.fonts.load(`italic 14px ${G.FONT_BODY}`)]).then(() => { G.labelsDirty = true; G.mapDirty = true; }).catch(() => {});
  }
  // menü arka planı: Akdeniz
  M.cam = { x: 28, y: -46, scale: Math.max(9, window.innerWidth / 70) };
  M.clampCam();

  U.initMenu(startGame);

  function startGame(tag) {
    G.initState(tag);
    G.map.selNation = null;
    G.labelsDirty = true;
    U.initGame();
    const cap = G.S.nations[tag].capital;
    M.centerOn(cap, Math.max(28, window.innerWidth / 45));
    U.showWelcome();
  }

  // ---------------------------------------------------------- fare
  let drag = null;
  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) {
      drag = { x: e.clientX, y: e.clientY, cx: M.cam.x, cy: M.cam.y, moved: false, box: e.shiftKey && !!G.S };
    } else if (e.button === 1) {
      drag = { x: e.clientX, y: e.clientY, cx: M.cam.x, cy: M.cam.y, moved: true, box: false };
      e.preventDefault();
    }
  });

  window.addEventListener('mousemove', e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 4) drag.moved = true;
      if (drag.moved) {
        if (drag.box) {
          M.dragBox = { x0: Math.min(drag.x, e.clientX), y0: Math.min(drag.y, e.clientY),
            x1: Math.max(drag.x, e.clientX), y1: Math.max(drag.y, e.clientY) };
        } else {
          M.cam.x = drag.cx - dx / M.cam.scale;
          M.cam.y = drag.cy - dy / M.cam.scale;
          M.clampCam();
        }
        G.mapDirty = true;
      }
      U.tooltip(0, 0, null);
      return;
    }
    if (e.target !== canvas) { U.tooltip(0, 0, null); return; }
    hover(e.clientX, e.clientY);
  });

  let lastHover = 0;
  function hover(x, y) {
    const now = performance.now();
    if (now - lastHover < 40) return;
    lastHover = now;
    const fl = G.S && M.fleetAt(x, y);
    if (fl) {
      const N = G.navy;
      U.tooltip(x, y, `${U.flag(fl.tag)} <b>${G.esc(fl.name)}</b><br>${fl.ships.length} gemi · ${G.fmtNum(N.crew(fl))} denizci` +
        (fl.cargo.length ? `<br>Gemide ${G.fmtNum(N.cargoMen(fl))} asker` : '') + `<br>Kaptan: ${G.esc(fl.admiral.name)}`);
      return;
    }
    const c = G.S && M.counterAt(x, y);
    if (c) {
      const men = c.armies.reduce((s, a) => s + a.men, 0);
      const a0 = c.armies[0], mm = a0.marshal != null ? G.command.marshal(a0.marshal) : null;
      U.tooltip(x, y, `${U.flag(c.tag)} <b>${G.esc(a0.name)}</b> · ${G.esc(G.S.nations[c.tag].name)}<br>Komutan: ${G.esc(a0.general.name)} ${'★'.repeat(a0.general.skill)}` +
        (mm ? `<br>Mareşal: ${G.esc(mm.leader.name)}` : '') + `<br>${G.fmtNum(men)} / ${G.fmtNum(a0.maxMen)} asker`);
      return;
    }
    const pid = M.provinceAt(x, y);
    if (pid !== M.hoverProv) { M.hoverProv = pid; G.mapDirty = true; }
    if (pid == null) { U.tooltip(0, 0, null); return; }
    const P = G.S ? G.S.provinces : window.WORLD.provinces;
    const p = P[pid];
    const nations = G.S ? G.S.nations : window.WORLD.nations;
    if (G.S && M.hidden(p)) { U.tooltip(x, y, '<b>Bilinmeyen Topraklar</b><br><span class="muted">Keşfetmek için tıklayın</span>'); return; }
    let html = `<b>${G.esc(p.name)}</b>`;
    if (p.kind === 'wild' && !p.owner) {
      html += `<br>${G.cul.flagHtml(p.cul)} ${G.esc(G.cul.get(p.cul).name)} yerlileri` + (p.colony ? `<br>⚑ ${G.esc(G.S.nations[p.colony.tag].name)} yerleşimi · %${Math.round(p.colony.settlers / G.explore.SETTLERS * 100)}` : '');
      U.tooltip(x, y, html); return;
    }
    if (p.owner) {
      html += `<br>${U.flag(p.owner)} ${G.esc(nations[p.owner].name)}`;
      if (nations[p.owner].overlord) html += `<br><span class="muted">${G.esc(nations[nations[p.owner].overlord].name)} vasalı</span>`;
      if (G.S && p.ctrl !== p.owner) html += `<br><span style="color:#ff8a6a">İşgal: ${G.esc(nations[p.ctrl].name)}</span>`;
      if (M.mode === 'religion') html += `<br>${G.RELIGIONS[p.relig || nations[p.owner].religion].name}`;
      if (M.mode === 'culture' && p.cul) html += `<br>${G.cul.flagHtml(p.cul)} ${G.esc(G.cul.get(p.cul).name)}${G.S && G.cul.assimilated(p) ? '' : G.S && !G.cul.accepted(p.owner, p.cul) ? ' <span style="color:#ff8a6a">(yabancı halk)</span>' : ''}`;
    } else html += '<br><span class="muted">Geçilemez</span>';
    U.tooltip(x, y, html);
  }

  window.addEventListener('mouseup', e => {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.box && d.moved && M.dragBox) {
      const b = M.dragBox;
      M.dragBox = null;
      const sel = [];
      for (const r of M.counterRects) {
        if (r.tag !== G.S.player) continue;
        if (r.x + r.w >= b.x0 && r.x <= b.x1 && r.y + r.h >= b.y0 && r.y <= b.y1) sel.push(...r.armies);
      }
      G.selectArmies(sel, false);
      return;
    }
    if (d.moved || e.button !== 0 || e.target !== canvas) return;
    click(e.clientX, e.clientY, e.shiftKey);
  });

  function click(x, y, shift) {
    if (U.picking) {
      const pid = M.provinceAt(x, y);
      if (pid != null && window.WORLD.provinces[pid].owner) U.pickNation(window.WORLD.provinces[pid].owner);
      return;
    }
    if (!G.S) return;
    if (U.targetOrdu) {
      const pid = M.provinceAt(x, y);
      if (pid != null) U.setTarget(pid); else U.endTargetMode();
      return;
    }
    const bt = M.battleAt(x, y);
    if (bt) { U.showBattle(bt.key); return; }
    const fl = M.fleetAt(x, y);
    if (fl) {
      if (fl.tag === G.S.player) G.selectFleet(fl); else U.showNation(fl.tag);
      return;
    }
    const c = M.counterAt(x, y);
    if (c) {
      if (c.tag === G.S.player) { G.selectArmies(c.armies, shift); return; }
      U.showNation(c.tag);
      return;
    }
    const pid = M.provinceAt(x, y);
    if (!shift) G.clearSelection();
    if (pid == null) { U.closePanel(); return; }
    U.showProvince(pid);
  }

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (G.S && G.selFleet) { fleetOrder(e.clientX, e.clientY); return; }
    if (G.S && !G.selected.size) {
      // seçili birlik yokken sağ tık: ülkenin diplomasi / bilgi sayfası
      const pid = M.provinceAt(e.clientX, e.clientY);
      if (pid == null) return;
      const p = G.S.provinces[pid];
      if (p.owner) U.showDiplomacy(p.owner);
      return;
    }
    if (!G.S || !G.selected.size) return;
    const S = G.S;
    const sel = [...G.selected].filter(a => a.tag === S.player);
    // kendi başka bir ordumuza sağ tık: seçili ordular onu komutanının kapasitesine kadar doldurur
    const ctr = M.counterAt(e.clientX, e.clientY);
    const dst = ctr && ctr.tag === S.player ? ctr.armies.find(a => !G.selected.has(a)) : null;
    if (dst && sel.length) { joinOrder(sel, dst); return; }
    const pid = M.provinceAt(e.clientX, e.clientY);
    if (pid == null) return;
    const p = S.provinces[pid];
    // Ctrl + sağ tık ya da karadan ulaşılamayan kıyı: gemiyle çıkarma
    const bySea = e.ctrlKey || (p.sea && p.sea.length && G.canEnter(S.player, p) && sel.every(a => !G.findPath(a.tag, a.prov, pid)));
    if (bySea && sel.length) {
      seaOrder(sel, pid);
      U.refreshArmyPanel(); G.mapDirty = true;
      return;
    }
    let ok = 0, fail = 0;
    for (const a of sel) {
      const old = a.transport;
      a.transport = null; a.joinId = null;
      if (G.orderMove(a, pid)) ok++; else { fail++; a.transport = old; }
    }
    if (fail && !ok) {
      const why = p.kind === 'waste' ? 'Issız topraklardan geçilemez.'
        : p.kind === 'wild' && !p.owner ? 'Ordular keşfedilmemiş ya da sahipsiz topraklara giremez; önce yerleşim kurun.'
        : !G.canEnter(S.player, p) ? `${S.nations[p.owner].name} topraklarına girmek için savaşta olmalısınız.`
        : 'Oraya ulaşan bir yol yok.';
      U.addLog(G.fmtDate(S.time, false), why, 'war');
    }
    U.refreshArmyPanel();
    G.mapDirty = true;
  });

  // Ordu takviyesi: hedef ordu dolana kadar seçili ordulardan asker aktarılır
  function joinOrder(sel, dst) {
    const S = G.S, C = G.command, log = (t, c) => U.addLog(G.fmtDate(S.time, false), t, c);
    let moved = 0, going = 0;
    for (const a of sel) {
      if (dst.men >= dst.maxMen) break;
      a.transport = null;
      const before = dst.men;
      const r = C.orderJoin(a, dst);
      if (r === 'done') moved += dst.men - before;
      else if (r === 'moving') going++;
    }
    if (moved) log(`${dst.name} ${G.fmtNum(moved)} askerle dolduruldu (${G.fmtNum(dst.men)} / ${G.fmtNum(dst.maxMen)}).`, 'good');
    if (going) log(`${going} ordu ${dst.name}'ya katılmak için yola çıktı.`, 'good');
    if (!moved && !going) log(`${dst.name} zaten dolu ya da ulaşılamıyor (${G.fmtNum(dst.men)} / ${G.fmtNum(dst.maxMen)}).`, 'war');
    G.selectArmies(sel.filter(a => S.armies.includes(a)), false);
    U.refreshOrdular(); G.mapDirty = true;
  }
  G.joinOrder = joinOrder;

  // Ordulara deniz yoluyla çıkarma emri: limana yürü, gemiye bin, hedefe çık
  function seaOrder(sel, pid) {
    const S = G.S, P = S.provinces;
    for (const a of sel) a.transport = null;
    const r = G.navy.planTransport(sel, pid);
    if (typeof r === 'string') { U.addLog(G.fmtDate(S.time, false), r, 'war'); return; }
    U.addLog(G.fmtDate(S.time, false), `${r.n} ordu ${P[r.port].name} limanında ${r.fleet.name} gemilerine binecek, ardından ${P[pid].name} kıyısına çıkarma yapılacak.` +
      (r.left ? ` (${r.left} ordu gemilere sığmadı.)` : ''), 'good');
  }
  G.seaOrder = seaOrder;

  function fleetOrder(x, y) {
    const S = G.S, N = G.navy, f = G.selFleet;
    // kendi başka bir filomuza sağ tık: seçili filo onu amiralinin yönetebileceği kadar gemiyle doldurur
    const other = M.fleetAt(x, y);
    if (other && other !== f && other.tag === S.player) {
      f.joinId = null;
      const before = other.ships.length, r = N.orderJoin(f, other);
      const log = (t, c) => U.addLog(G.fmtDate(S.time, false), t, c);
      if (r === 'done') log(`${other.name} filosuna ${other.ships.length - before} gemi katıldı (${other.ships.length} / ${N.maxShips(other)}).`, 'good');
      else if (r === 'moving') log(`${f.name}, ${other.name} filosuna katılmak için yola çıktı.`, 'good');
      else if (r === 'full') log(`${other.name} dolu: amirali en fazla ${N.maxShips(other)} gemi yönetebilir.`, 'war');
      else log(r, 'war');
      U.refreshArmyPanel(true); U.refreshOrdular(); G.mapDirty = true;
      return;
    }
    f.joinId = null;
    const pid = M.provinceAt(x, y);
    let err = null;
    if (pid != null) {
      const p = S.provinces[pid];
      if (f.plan) N.endPlan(f, false);
      if (N.friendlyPort(f.tag, p) && (!f.cargo.length || G.sameRealm(p.ctrl, f.tag))) err = N.orderDock(f, pid);
      else if (p.sea && p.sea.length) err = N.orderLand(f, pid);
      else err = 'Gemiler yalnızca kıyı eyaletlerine gidebilir.';
    } else {
      const z = M.seaAt(x, y);
      if (z == null) return;
      if (f.plan) N.endPlan(f, false);
      err = N.orderZone(f, z);
    }
    if (err) U.addLog(G.fmtDate(S.time, false), err, 'war');
    U.refreshArmyPanel();
    G.mapDirty = true;
  }

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    M.zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  // ---------------------------------------------------------- dokunmatik
  let touch = null;
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      touch = { x: t.clientX, y: t.clientY, cx: M.cam.x, cy: M.cam.y, moved: false, t0: performance.now() };
    } else if (e.touches.length === 2) {
      const [a, b] = e.touches;
      touch = { pinch: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), scale: M.cam.scale,
        mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2, moved: true };
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!touch) return;
    if (touch.pinch && e.touches.length === 2) {
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      M.zoomAt(touch.mx, touch.my, touch.scale * d / touch.pinch / M.cam.scale);
    } else if (!touch.pinch && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - touch.x, dy = t.clientY - touch.y;
      if (Math.hypot(dx, dy) > 8) touch.moved = true;
      if (touch.moved) {
        M.cam.x = touch.cx - dx / M.cam.scale; M.cam.y = touch.cy - dy / M.cam.scale;
        M.clampCam(); G.mapDirty = true;
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    e.preventDefault();
    if (touch && !touch.moved && !touch.pinch) {
      // dokunmatikte: ordu seçiliyse dokunulan yere yürüt
      const long = performance.now() - touch.t0 > 450;
      if (G.S && G.selFleet && !long && !M.fleetAt(touch.x, touch.y)) fleetOrder(touch.x, touch.y);
      else if (G.S && G.selected.size && !M.counterAt(touch.x, touch.y)) {
        const pid = M.provinceAt(touch.x, touch.y);
        if (pid != null && !long) {
          for (const a of G.selected) G.orderMove(a, pid);
          U.refreshArmyPanel(); G.mapDirty = true;
        } else G.clearSelection();
      } else click(touch.x, touch.y, false);
    }
    touch = null;
  }, { passive: false });

  // ---------------------------------------------------------- klavye
  const keys = new Set();
  window.addEventListener('keydown', e => {
    if (!G.S) return;
    if (!document.getElementById('modal').classList.contains('hidden')) return;
    if (e.code === 'Space') { U.togglePause(); e.preventDefault(); }
    else if (e.key >= '1' && e.key <= '5') U.setSpeed(+e.key);
    else if (e.key === '+' || e.code === 'NumpadAdd') U.setSpeed(G.S.speed + 1);
    else if (e.key === '-' || e.code === 'NumpadSubtract') U.setSpeed(G.S.speed - 1);
    else if (e.key === 'Escape') {
      if (U.targetOrdu) U.endTargetMode();
      else if (U.battleKey) U.closeBattle();
      else if (!document.getElementById('dipwin').classList.contains('hidden')) U.closeDiplomacy();
      else if (!document.getElementById('prodwin').classList.contains('hidden')) document.getElementById('prodwin').classList.add('hidden');
      else if (!document.getElementById('navywin').classList.contains('hidden')) document.getElementById('navywin').classList.add('hidden');
      else { G.clearSelection(); U.closePanel(); }
    }
    else if (e.key === 'o' || e.key === 'O') U.toggleOrdular();
    else if (e.key === 'p' || e.key === 'P') U.toggleProduction();
    else if (e.key === 'k' || e.key === 'K') U.toggleWarPanel();
    else if (e.key === 'n' || e.key === 'N') {
      const w = document.getElementById('navywin');
      if (w.classList.contains('hidden')) U.showNavy(); else w.classList.add('hidden');
    }
    keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'PageUp' || e.code === 'PageDown') e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.code));

  // ekran kenarına gelen fare haritayı kaydırır
  const panV = { x: 0, y: 0 };
  let panHold = 0;
  const edge = { on: false, dx: 0, dy: 0 };
  window.addEventListener('mousemove', e => {
    const m = 6;
    edge.dx = e.clientX <= m ? -1 : e.clientX >= window.innerWidth - m ? 1 : 0;
    edge.dy = e.clientY <= m ? -1 : e.clientY >= window.innerHeight - m ? 1 : 0;
    edge.on = !!(edge.dx || edge.dy) && e.target === canvas;
  });
  document.addEventListener('mouseleave', () => { edge.on = false; });
  window.addEventListener('blur', () => { edge.on = false; keys.clear(); });

  // ---------------------------------------------------------- döngü
  let last = performance.now(), acc = 0, lastUi = 0;
  function frame(now) {
    const dt = Math.min(250, now - last);
    last = now;
    // klavye / ekran kenarı ile kaydırma: yumuşak hızlanma, Shift ile iki kat hız
    if (G.S) {
      let dx = 0, dy = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
      if (edge.on && !drag) { dx += edge.dx; dy += edge.dy; }
      const len = Math.hypot(dx, dy) || 1;
      const held = dx || dy ? (panHold += dt) : (panHold = 0);
      const speed = (1100 + Math.min(1, held / 700) * 900) * (keys.has('ShiftLeft') || keys.has('ShiftRight') ? 2 : 1);
      const k = 1 - Math.exp(-dt / 70);   // hız yumuşatma
      panV.x += (dx / len * speed - panV.x) * k;
      panV.y += (dy / len * speed - panV.y) * k;
      if (Math.abs(panV.x) > 2 || Math.abs(panV.y) > 2) {
        M.cam.x += panV.x * dt / 1000 / M.cam.scale;
        M.cam.y += panV.y * dt / 1000 / M.cam.scale;
        M.clampCam(); G.mapDirty = true;
      } else { panV.x = 0; panV.y = 0; }
      // Q / E ya da Page Up / Down ile yakınlaştırma
      let z = 0;
      if (keys.has('KeyE') || keys.has('PageUp')) z += 1;
      if (keys.has('KeyQ') || keys.has('PageDown')) z -= 1;
      if (z) M.zoomAt(M.w / 2, M.h / 2, Math.exp(z * dt / 380));
      // yumuşak kamera kayması (komuta çubuğunda orduya sağ tık)
      if (M.glide) {
        if (dx || dy || drag) M.glide = null;
        else {
          const g = M.glide, f = 1 - Math.exp(-dt / 160);
          M.cam.x += (g.x - M.cam.x) * f; M.cam.y += (g.y - M.cam.y) * f;
          if (g.scale) M.cam.scale *= Math.pow(g.scale / M.cam.scale, f);
          M.clampCam(); G.mapDirty = true;
          if (Math.hypot(g.x - M.cam.x, g.y - M.cam.y) * M.cam.scale < 0.5 && (!g.scale || Math.abs(g.scale / M.cam.scale - 1) < 0.01)) M.glide = null;
        }
      }
    }
    const S = G.S;
    if (S && !S.paused && !S.over) {
      acc += dt;
      const ms = MS_PER_HOUR[S.speed];
      let n = 0;
      while (acc >= ms && n < 240 && !S.paused) { G.tick(); acc -= ms; n++; }
      if (n >= 240) acc = 0;
      if (n) {
        G.mapDirty = true;
        U.refreshTop();
        for (const a of [...G.selected]) if (!S.armies.includes(a)) G.selected.delete(a);
        if (G.selFleet && !S.fleets.includes(G.selFleet)) G.selFleet = null;
        if (now - lastUi > 400) {
          lastUi = now; U.refreshArmyPanel(); U.refreshOrdular();
          if (U.provId != null) U.refreshProvince();
          if (now - (U.lastNavy || 0) > 1000) { U.lastNavy = now; U.refreshNavy(); U.refreshDiplomacy(); U.refreshProduction(); U.refreshWarPanel(); }
          U.refreshBattle();
        }
      }
    } else acc = 0;
    if (G.mapDirty) { G.mapDirty = false; M.draw(); }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // test ve hata ayıklama için
  window.__startGame = startGame;
})();
