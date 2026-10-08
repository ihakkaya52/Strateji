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
    U.refreshArmyPanel(); U.refreshOrdular();
    G.mapDirty = true;
  };
  G.selectFleet = function (f) {
    for (const a of G.selected) a.sel = false;
    G.selected.clear();
    G.selFleet = f;
    U.refreshArmyPanel(); U.refreshNavy();
    G.mapDirty = true;
  };
  G.selectArmies = function (arr, add) {
    if (!add || G.selFleet) G.clearSelection();
    for (const a of arr) { if (a.fleet != null) continue; a.sel = true; G.selected.add(a); }
    U.refreshOrdular();
    U.refreshArmyPanel();
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
    let html = `<b>${G.esc(p.name)}</b>`;
    if (p.owner) {
      html += `<br>${U.flag(p.owner)} ${G.esc(nations[p.owner].name)}`;
      if (nations[p.owner].overlord) html += `<br><span class="muted">${G.esc(nations[nations[p.owner].overlord].name)} vasalı</span>`;
      if (G.S && p.ctrl !== p.owner) html += `<br><span style="color:#ff8a6a">İşgal: ${G.esc(nations[p.ctrl].name)}</span>`;
      if (M.mode === 'religion') html += `<br>${G.RELIGIONS[nations[p.owner].religion].name}`;
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
    const pid = M.provinceAt(e.clientX, e.clientY);
    if (pid == null) return;
    let ok = 0, fail = 0;
    for (const a of G.selected) { if (G.orderMove(a, pid)) ok++; else fail++; }
    if (fail && !ok) {
      const p = G.S.provinces[pid];
      const why = p.kind === 'waste' ? 'Issız topraklardan geçilemez.'
        : !G.canEnter(G.S.player, p) ? `${G.S.nations[p.owner].name} topraklarına girmek için savaşta olmalısınız.`
        : 'Oraya ulaşan bir yol yok.';
      U.addLog(G.fmtDate(G.S.time, false), why, 'war');
    }
    U.refreshArmyPanel();
    G.mapDirty = true;
  });

  function fleetOrder(x, y) {
    const S = G.S, N = G.navy, f = G.selFleet;
    const pid = M.provinceAt(x, y);
    let err = null;
    if (pid != null) {
      const p = S.provinces[pid];
      if (N.friendlyPort(f.tag, p) && (!f.cargo.length || G.sameRealm(p.ctrl, f.tag))) err = N.orderDock(f, pid);
      else if (p.sea && p.sea.length) err = N.orderLand(f, pid);
      else err = 'Gemiler yalnızca kıyı eyaletlerine gidebilir.';
    } else {
      const z = M.seaAt(x, y);
      if (z == null) return;
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
      else if (!document.getElementById('dipwin').classList.contains('hidden')) U.closeDiplomacy();
      else if (!document.getElementById('prodwin').classList.contains('hidden')) document.getElementById('prodwin').classList.add('hidden');
      else if (!document.getElementById('navywin').classList.contains('hidden')) document.getElementById('navywin').classList.add('hidden');
      else { G.clearSelection(); U.closePanel(); }
    }
    else if (e.key === 'o' || e.key === 'O') U.toggleOrdular();
    else if (e.key === 'p' || e.key === 'P') U.toggleProduction();
    else if (e.key === 'n' || e.key === 'N') {
      const w = document.getElementById('navywin');
      if (w.classList.contains('hidden')) U.showNavy(); else w.classList.add('hidden');
    }
    keys.add(e.code);
  });
  window.addEventListener('keyup', e => keys.delete(e.code));

  // ---------------------------------------------------------- döngü
  let last = performance.now(), acc = 0, lastUi = 0;
  function frame(now) {
    const dt = Math.min(250, now - last);
    last = now;
    // klavyeyle kaydırma
    const pan = 600 * dt / 1000 / M.cam.scale;
    if (keys.size && G.S) {
      if (keys.has('KeyW') || keys.has('ArrowUp')) { M.cam.y -= pan; G.mapDirty = true; }
      if (keys.has('KeyS') || keys.has('ArrowDown')) { M.cam.y += pan; G.mapDirty = true; }
      if (keys.has('KeyA') || keys.has('ArrowLeft')) { M.cam.x -= pan; G.mapDirty = true; }
      if (keys.has('KeyD') || keys.has('ArrowRight')) { M.cam.x += pan; G.mapDirty = true; }
      M.clampCam();
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
          if (U.panelKind === 'prov') U.showProvince(U.panelId);
          if (now - (U.lastNavy || 0) > 1000) { U.lastNavy = now; U.refreshNavy(); U.refreshDiplomacy(); U.refreshProduction(); }
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
