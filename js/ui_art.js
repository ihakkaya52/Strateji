// Görsellik ve ses: hükümdar portreleri, müzik denetimi ve ses efektleri arayüze bağlanır
'use strict';

(function () {
  const U = G.ui;
  const $ = id => document.getElementById(id);
  const P = () => G.portrait;
  const MU = () => G.music;

  // ------------------------------------------------------------ menü: hükümdar portreleri
  const baseMenu = U.initMenu;
  U.initMenu = function (onStart) {
    baseMenu(onStart);
    if (!P()) return;
    for (const c of document.querySelectorAll('.major-card')) {
      const tag = c.dataset.tag, fl = c.querySelector('.flag');
      if (!fl) continue;
      const d = document.createElement('div');
      d.className = 'menu-portrait portrait-svg';
      d.style.setProperty('--pc', window.WORLD.nations[tag].color);
      d.innerHTML = P().ruler(tag);
      fl.replaceWith(d);
    }
    // ilk tıklamada menü müziği başlar (tarayıcılar sesi ancak kullanıcı etkileşiminden sonra açar)
    const kick = () => {
      if (!MU()) return;
      MU().start();
      if (!G.S) MU().setMood('menu', 'bizans');
      window.removeEventListener('pointerdown', kick, true);
    };
    window.addEventListener('pointerdown', kick, true);
  };

  // ------------------------------------------------------------ oyun: üst çubuk portresi, müzik denetimi
  const baseInit = U.initGame;
  U.initGame = function () {
    baseInit();
    const S = G.S, n = S.nations[S.player];
    if (P()) {
      const fl = $('tb-flag');
      fl.classList.add('tb-portrait');
      fl.innerHTML = P().ruler(S.player);
      fl.title = n.ruler;
    }
    U.musicMood(true);
    U.bindMusic();
  };

  U.musicMood = function (force) {
    const S = G.S;
    if (!MU() || !S) return;
    const n = S.nations[S.player];
    const mood = n.enemies.size ? 'war' : 'peace';
    if (!force && U._mood === mood + n.group) return;
    U._mood = mood + n.group;
    MU().start();
    MU().setMood(mood, n.group);
  };

  U.bindMusic = function () {
    const m = MU();
    if (!m) { $('tb-music').classList.add('hidden'); return; }
    const pop = $('mus-pop');
    const sync = () => {
      $('mus-ico').textContent = m.isMuted() ? '🔇' : '♫';
      $('mus-mute').textContent = m.isMuted() ? 'Sesi aç' : 'Sessiz';
      $('mus-vol').value = Math.round(m.volume() * 100);
      $('mus-now').textContent = m.nowPlaying() || '—';
    };
    $('tb-music').onclick = e => {
      if (pop.contains(e.target)) return;
      pop.classList.toggle('hidden');
      sync();
    };
    $('mus-vol').oninput = e => { m.setVolume(e.target.value / 100); };
    $('mus-sfx').oninput = e => { m.setSfxVolume(e.target.value / 100); };
    $('mus-mute').onclick = () => { m.toggle(); sync(); };
    document.addEventListener('pointerdown', e => {
      if (!pop.classList.contains('hidden') && !$('tb-music').contains(e.target)) pop.classList.add('hidden');
    });
    sync();
    setInterval(() => { if (!pop.classList.contains('hidden')) $('mus-now').textContent = m.nowPlaying() || '—'; }, 2000);
  };

  // savaş / barış değişince müzik kipi değişir
  const baseTop = U.refreshTop;
  U.refreshTop = function () {
    baseTop();
    U.musicMood(false);
  };

  // ------------------------------------------------------------ ses efektleri
  const sfx = name => { try { if (MU()) MU().sfx(name); } catch (e) { /* ses yoksa sessiz geç */ } };
  U.sfx = sfx;
  let lastClick = 0;
  document.addEventListener('click', e => {
    if (!e.target.closest('button, .major-card, .gcard, .scard, .fcard, .fnode.available')) return;
    const t = performance.now();
    if (t - lastClick > 60) { lastClick = t; sfx('click'); }
  }, true);
  const baseEvent = U.showEvent;
  U.showEvent = function (title, text, options, onDone) {
    if (G.S && !U.eventOpen) sfx(/Zafer|zafer/.test(title + text) ? 'victory' : /Yenilgi|teslim oldu/.test(title) ? 'defeat' : 'event');
    return baseEvent(title, text, options, onDone);
  };
  // oyuncunun muharebeleri ve kuşatmaları
  const baseLog = G.log;
  G.log = function (text, cls, tags) {
    if (G.S && tags && tags.includes(G.S.player)) {
      if (/muharebesi başladı/.test(text)) sfx('battle');
      else if (/muharebesini .* kazandı/.test(text)) sfx(cls === 'good' ? 'victory' : 'defeat');
      else if (/kalesi kuşatıldı|hücum ediyor|gedik açıldı/.test(text)) sfx('siege');
      else if (/deniz muharebesi|çıkarma yapıyor|limanına saldırıyor/.test(text)) sfx('naval');
    }
    return baseLog(text, cls, tags);
  };
  if (G.econ && G.econ.queue) {
    const baseQueue = G.econ.queue;
    G.econ.queue = function (tag, ...rest) {
      const r = baseQueue(tag, ...rest);
      if (r && G.S && tag === G.S.player) sfx('build');
      return r;
    };
  }
})();
