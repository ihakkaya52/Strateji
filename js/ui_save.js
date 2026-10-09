// Oyun menüsü (kaydet / yükle / dosya) ve ana menüdeki kayıtlı oyunlar
'use strict';

(function () {
  const U = G.ui, SV = G.save;
  const $ = id => document.getElementById(id);
  const kb = n => n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;

  const slotsHtml = (inGame) => {
    const list = SV.list();
    if (!list.length) return '<p class="muted">Henüz kayıtlı oyun yok.</p>';
    return `<div class="sv-list">${list.map(e => `<div class="sv-row">
        <div class="sv-main"><b>${G.esc(e.label)}</b><span>${G.esc(e.nation)} · ${G.esc(e.date)}</span><small>${G.esc(e.real)} · ${kb(e.size || 0)}</small></div>
        <button data-load="${G.esc(e.slot)}">Yükle</button>
        ${inGame ? `<button data-over="${G.esc(e.slot)}" title="Bu kaydın üzerine yaz">Üzerine kaydet</button>` : ''}
        <button data-del="${G.esc(e.slot)}" title="Sil">✕</button></div>`).join('')}</div>`;
  };

  const loadAndClose = async slot => {
    const err = await SV.loadSlot(slot);
    if (err) U.toast(err, 'war'); else $('gamemenu').classList.add('hidden');
  };

  // ------------------------------------------------------------ oyun içi menü
  U.showGameMenu = function () {
    const el = $('gamemenu');
    if (!el.classList.contains('hidden')) { el.classList.add('hidden'); return; }
    if (G.S && !G.S.paused) U.togglePause(true);
    U.renderGameMenu();
    el.classList.remove('hidden');
  };
  U.renderGameMenu = function () {
    const el = $('gamemenu'), S = G.S;
    const n = S.nations[S.player];
    el.innerHTML = `<div class="focus-head"><h2>Oyun Menüsü</h2><button class="pg-close">✕</button></div>
      <div class="sv-body">
        <h3>Kaydet</h3>
        <div class="sv-save"><input id="sv-name" maxlength="40" value="${G.esc(`${n.name} · ${G.fmtDate(S.time, false)}`)}">
          <button id="sv-do">Yeni kayıt</button></div>
        <div class="sv-btns"><button id="sv-quick">⚡ Hızlı kayıt (Ctrl+S)</button><button id="sv-file">⬇ Dosyaya indir</button><button id="sv-open">⬆ Dosyadan yükle</button></div>
        <h3>Kayıtlı oyunlar</h3>
        ${slotsHtml(true)}
        <div class="sv-btns" style="margin-top:12px"><button id="sv-main">Ana menüye dön</button></div>
        <p class="muted small">Oyun her üç ayda bir "Otomatik kayıt" yuvasına kendiliğinden kaydedilir. Kayıtlar bu tarayıcıda durur; başka bilgisayara taşımak için dosyaya indirin.</p>
      </div>`;
    el.querySelector('.pg-close').onclick = () => el.classList.add('hidden');
    $('sv-do').onclick = async () => {
      const label = $('sv-name').value.trim() || 'Kayıt';
      const err = await SV.saveSlot('k' + Date.now(), label);
      U.toast(err || `Kaydedildi: ${label}`, err ? 'war' : 'good');
      U.renderGameMenu();
    };
    $('sv-quick').onclick = async () => { await U.quickSave(); U.renderGameMenu(); };
    $('sv-file').onclick = () => SV.download();
    $('sv-open').onclick = () => $('load-file').click();
    $('sv-main').onclick = () => {
      U.showEvent('Ana menü', 'Kaydedilmemiş ilerleme kaybolacak. Ana menüye dönülsün mü?',
        [{ text: 'Önce hızlı kaydet, sonra dön', action: async () => { await U.quickSave(); location.reload(); } },
         { text: 'Kaydetmeden dön', action: () => location.reload() }, { text: 'Vazgeç' }]);
    };
    bindSlots(el, true);
  };

  const bindSlots = (el, inGame) => {
    el.querySelectorAll('[data-load]').forEach(b => b.onclick = () => loadAndClose(b.dataset.load));
    el.querySelectorAll('[data-over]').forEach(b => b.onclick = async () => {
      const e = SV.list().find(x => x.slot === b.dataset.over);
      const err = await SV.saveSlot(b.dataset.over, e ? e.label : 'Kayıt');
      U.toast(err || 'Kaydedildi.', err ? 'war' : 'good');
      U.renderGameMenu();
    });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      SV.deleteSlot(b.dataset.del);
      if (inGame) U.renderGameMenu(); else U.renderMenuSaves();
    });
  };

  U.quickSave = async function () {
    if (!G.S) return;
    const err = await SV.saveSlot('hizli', 'Hızlı kayıt');
    U.toast(err || 'Hızlı kayıt alındı.', err ? 'war' : 'good');
  };

  $('load-file').onchange = async e => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const err = await SV.fromFile(f);
    if (err) U.toast(err, 'war'); else $('gamemenu').classList.add('hidden');
  };

  // ------------------------------------------------------------ ana menü
  U.renderMenuSaves = function () {
    const el = $('menu-saves');
    if (!el) return;
    const list = SV.list();
    el.innerHTML = `<h3>Kayıtlı oyunlar</h3>
      ${list.length ? `${list[0] ? `<div class="menu-other"><button id="mn-continue" class="big">▶ Devam et: ${G.esc(list[0].nation)} · ${G.esc(list[0].date)}</button></div>` : ''}${slotsHtml(false)}` : '<p class="muted" style="text-align:center">Henüz kayıtlı oyun yok.</p>'}
      <div class="menu-other"><button id="mn-file">⬆ Dosyadan yükle</button></div>`;
    const c = $('mn-continue');
    if (c) c.onclick = () => loadAndClose(list[0].slot);
    $('mn-file').onclick = () => $('load-file').click();
    bindSlots(el, false);
  };

  const baseMenu = U.initMenu;
  U.initMenu = function (onStart) { baseMenu(onStart); U.renderMenuSaves(); };

  const baseInit = U.initGame;
  U.initGame = function () {
    baseInit();
    $('tb-menu').onclick = () => U.showGameMenu();
  };

  // otomatik kayıt ve Ctrl+S
  const baseTop = U.refreshTop;
  U.refreshTop = function () { baseTop(); SV.tick(); };
  window.addEventListener('keydown', e => {
    if (!G.S) return;
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); U.quickSave(); }
  });
})();
