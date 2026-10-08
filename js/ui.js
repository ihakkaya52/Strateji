// Arayüz: menü, üst çubuk, paneller, olay pencereleri
'use strict';

G.ui = {};
const U = G.ui;
const $ = id => document.getElementById(id);

U.flag = (tag, size = '') => {
  const n = G.S ? G.S.nations[tag] : window.WORLD.nations[tag];
  return `<span class="flag ${size}" style="background:${n ? n.color : '#555'}"></span>`;
};
U.nlink = tag => {
  const n = G.S.nations[tag];
  return `${U.flag(tag)} <span class="link" data-nation="${tag}">${G.esc(n.name)}</span>`;
};

// ------------------------------------------------------------ menü
U.initMenu = function (onStart) {
  const list = $('major-list');
  const majors = Object.entries(window.WORLD.nations).filter(([, n]) => n.major);
  list.innerHTML = majors.map(([tag, n]) => `
    <div class="major-card" data-tag="${tag}">
      <span class="flag" style="background:${n.color}"></span>
      <div><div class="nm">${G.esc(n.name)}</div><div class="rl">${G.esc(n.ruler)} · ${G.RELIGIONS[n.religion].name}</div></div>
    </div>`).join('');
  list.onclick = e => {
    const c = e.target.closest('.major-card');
    if (c) onStart(c.dataset.tag);
  };
  const eng = window.WORLD.nations.ENG;
  const sp = $('special-list');
  sp.innerHTML = eng ? `
    <div class="major-card" data-tag="ENG">
      <span class="flag" style="background:${eng.color}"></span>
      <div><div class="nm">${G.esc(eng.name)}</div>
      <div class="rl">Danimarka tacının vasalı · Bağımsızlık odak ağacı</div></div>
    </div>` : '';
  sp.onclick = list.onclick;
  $('btn-pick-map').onclick = () => {
    $('menu').classList.add('hidden');
    $('pickbar').classList.remove('hidden');
    U.picking = true;
  };
  $('btn-pick-cancel').onclick = () => {
    U.picking = false; U.pickTag = null; G.map.selNation = null; G.mapDirty = true;
    $('pickbar').classList.add('hidden');
    $('menu').classList.remove('hidden');
    $('btn-pick-ok').disabled = true;
    $('pick-text').textContent = 'Oynamak istediğin ülkeye tıkla.';
  };
  $('btn-pick-ok').onclick = () => {
    if (!U.pickTag) return;
    $('pickbar').classList.add('hidden');
    U.picking = false;
    onStart(U.pickTag);
  };
};

U.pickNation = function (tag) {
  const n = window.WORLD.nations[tag];
  U.pickTag = tag;
  G.map.selNation = tag; G.mapDirty = true;
  $('pick-text').innerHTML = `${U.flag(tag)} <b>${G.esc(n.name)}</b> — ${G.esc(n.ruler)}, ${G.RELIGIONS[n.religion].name}`;
  $('btn-pick-ok').disabled = false;
};

// ------------------------------------------------------------ oyun arayüzü
U.initGame = function () {
  $('menu').classList.add('hidden');
  for (const id of ['topbar', 'log', 'mapmodes', 'cmdbar']) $(id).classList.remove('hidden');
  const S = G.S, n = S.nations[S.player];
  $('tb-flag').style.background = n.color;
  $('tb-name').textContent = n.name;
  $('tb-nation').onclick = () => U.showNation(S.player);
  $('btn-pause').onclick = () => U.togglePause();
  if (G.focus.tree(S.player)) {
    $('tb-focus').classList.remove('hidden');
    $('tb-focus').onclick = () => U.showFocus();
  }
  $('focus-close').onclick = () => $('focuswin').classList.add('hidden');
  $('tb-ordular').onclick = () => U.toggleOrdular();
  $('tb-navy').onclick = () => U.showNavy();
  $('tb-prod').onclick = () => U.toggleProduction();
  $('tb-war').onclick = () => U.toggleWarPanel();
  $('tb-gold').onclick = () => U.toggleProduction();
  $('prod-close').onclick = () => $('prodwin').classList.add('hidden');
  $('navy-close').onclick = () => $('navywin').classList.add('hidden');
  const sp = $('tb-speed');
  sp.innerHTML = [1, 2, 3, 4, 5].map(i => `<span data-s="${i}"></span>`).join('');
  sp.onclick = e => { const s = e.target.dataset.s; if (s) U.setSpeed(+s); };
  $('mapmodes').onclick = e => {
    const bar = e.target.closest('[data-bar]');
    if (bar) { U.setBarMode(bar.dataset.bar); return; }
    const m = e.target.dataset.mode;
    if (!m) return;
    G.map.mode = m; G.mapDirty = true;
    for (const b of $('mapmodes').querySelectorAll('[data-mode]')) b.classList.toggle('active', b.dataset.mode === m);
  };
  document.body.addEventListener('click', e => {
    const t = e.target.closest('[data-nation]');
    if (t) U.showNation(t.dataset.nation);
    const pv = e.target.closest('[data-prov]');
    if (pv) { G.map.centerOn(+pv.dataset.prov); U.showProvince(+pv.dataset.prov); }
  });
  U.refreshTop();
};

U.setSpeed = function (s) {
  G.S.speed = G.clamp(s, 1, 5);
  U.refreshTop();
};
U.togglePause = function (force) {
  const S = G.S;
  if (S.over) return;
  S.paused = force !== undefined ? force : !S.paused;
  U.refreshTop();
};

U.refreshTop = function () {
  const S = G.S, n = S.nations[S.player];
  if (!n) return;
  $('tb-date').textContent = G.fmtDate(S.time);
  $('tb-manpower').textContent = G.fmtNum(n.manpower);
  const st = G.nationStats(S.player);
  $('tb-armies').textContent = `${G.command.of(S.player).length} mareşal · ${st.armies} ordu · ${G.fmtK(st.men)}`;
  {
    const b = n.lastBudget || G.econ.budget(n);
    $('tb-goldtxt').innerHTML = `${G.fmtNum(n.gold)} <span style="color:${b.net >= 0 ? '#9ad07a' : '#ff7a5a'}">(${b.net >= 0 ? '+' : ''}${b.net.toFixed(1)})</span>`;
  }
  {
    const avg = (() => { const ar = S.armies.filter(a => a.tag === S.player); return ar.length ? ar.reduce((t, a) => t + G.econ.ratio(a), 0) / ar.length : 1; })();
    $('tb-prodtxt').innerHTML = `${n.civTotal || 0} atölye · ${n.milTotal || 0} silahhane · <span style="color:${avg > 0.9 ? '#9ad07a' : avg > 0.6 ? '#e0c060' : '#ff7a5a'}">teçhizat %${Math.round(avg * 100)}</span>`;
  }
  $('tb-ships').textContent = `${G.navy.fleetsOf(S.player).reduce((t, f) => t + f.ships.length, 0)} gemi`;
  if (G.focus.tree(S.player)) {
    const f = n.focus.cur && G.focus.get(S.player, n.focus.cur);
    $('tb-focus-name').textContent = f ? f.name : 'Odak seç';
    $('tb-focus-bar').style.width = f ? `${n.focus.prog / G.FOCUS_DAYS * 100}%` : '0%';
    $('tb-focus').classList.toggle('pulse', !f);
  }
  const wars = [...n.enemies];
  $('tb-wars').innerHTML = wars.length ? wars.map(t => U.flag(t)).join(' ') + ` <span class="muted">${G.fmtK(n.dead || 0)} kayıp</span>` : 'Barış';
  $('tb-war').classList.toggle('atwar', wars.length > 0);
  $('topbar').classList.toggle('paused', S.paused);
  $('btn-pause').textContent = S.paused ? '▶' : '⏸';
  [...$('tb-speed').children].forEach((el, i) => el.classList.toggle('on', i < S.speed));
};

// ------------------------------------------------------------ paneller
U.closePanel = function () {
  $('panel').classList.add('hidden');
  if (U.closeProvPanel) U.closeProvPanel();
  U.panelKind = null;
  G.map.selProv = null; G.map.selNation = null; G.mapDirty = true;
};

U.showProvince = function (pid) {
  const S = G.S, p = S.provinces[pid];
  if (U.closeDiplomacy && U.dipTag) U.closeDiplomacy();
  U.panelKind = 'prov'; U.panelId = pid;
  G.map.selProv = pid; G.map.selNation = null; G.mapDirty = true;
  const el = $('panel');
  el.classList.remove('hidden');
  if (p.kind === 'waste') {
    el.innerHTML = `<button class="close">✕</button><h2>${G.esc(p.name)}</h2>
      <p class="muted">Issız, geçilemez topraklar. Burada ordu yürüyemez.</p>`;
  } else {
    const armies = G.armiesIn(pid);
    const siege = p.siege ? `<h3>Kuşatma</h3>${U.nlink(p.siege.by)} kuşatıyor${p.siege.stalled ? ' <span style="color:#ff8a6a">(garnizon çok güçlü, kuşatma ilerlemiyor)</span>' : ''}
      <div class="bar"><div style="width:${Math.min(100, p.siege.progress / p.siege.need * 100)}%"></div></div>` : '';
    el.innerHTML = `<button class="close">✕</button>
      <h2>${G.esc(p.name)}</h2>
      <div class="muted">${G.KIND_NAMES[p.kind]}${p.home ? ` · ${G.esc(p.home)} bölgesi` : ''}</div>
      <table>
        <tr><td>Sahibi</td><td>${U.nlink(p.owner)}</td></tr>
        ${p.ctrl !== p.owner ? `<tr><td>İşgalci</td><td>${U.nlink(p.ctrl)}</td></tr>` : ''}
        <tr><td>Alan</td><td>${G.fmtNum(p.area)} km²</td></tr>
        <tr><td>Aylık insan gücü</td><td>${p.kind === 'capital' ? 900 : p.kind === 'city' ? 380 : 140}</td></tr>
      </table>
      ${siege}
      ${U.buildingSection(p)}
      ${U.portSection(p)}
      ${armies.length ? `<h3>Ordular</h3>${armies.map(a => `<div>${U.flag(a.tag)} ${G.esc(a.name)} · ${G.esc(a.general.name)} · ${G.fmtK(a.men)}</div>`).join('')}` : ''}`;
    U.bindPortSection(p);
    U.bindBuildingSection(p);
  }
  el.querySelector('.close').onclick = U.closePanel;
};

U.showNation = function (tag) {
  const S = G.S, n = S.nations[tag], me = S.nations[S.player];
  if (tag !== S.player && U.showDiplomacy) { U.showDiplomacy(tag); return; }
  if (U.closeProvPanel) U.closeProvPanel();
  if (U.closeDiplomacy && U.dipTag) U.closeDiplomacy();
  U.panelKind = 'nation'; U.panelId = tag;
  G.map.selNation = tag; G.map.selProv = null; G.mapDirty = true;
  const st = G.nationStats(tag);
  const el = $('panel');
  el.classList.remove('hidden');
  const isMe = tag === S.player;
  let diplo = '';
  if (!n.alive) {
    diplo = '<p class="muted">Bu ülke artık yok.</p>';
  } else if (!isMe && G.sameRealm(tag, S.player)) {
    diplo = `<h3>Diplomasi</h3><div class="muted">${n.overlord === S.player ? 'Vasalınız.' : 'Efendiniz.'}
      Aynı diyarın ülkeleri birbirine savaş ilan edemez.</div>`;
  } else if (!isMe) {
    if (me.enemies.has(tag) && me.overlord) {
      diplo = `<h3>Savaş</h3><div class="muted">Barışa efendiniz ${G.esc(S.nations[me.overlord].name)} karar verir.</div>`;
    } else if (me.enemies.has(tag)) {
      const ws = G.warScore(S.player, tag);
      diplo = `<h3>Savaş</h3>
        <div>Savaş skoru: <b style="color:${ws >= 0 ? '#9ad07a' : '#ff8a6a'}">${ws > 0 ? '+' : ''}${ws}</b></div>
        <div class="muted">İşgal ettiğiniz topraklara göre hesaplanır.</div>
        <div class="row-btns">
          <button class="good" id="btn-peace-t">Barış: işgal edilen topraklar el değiştirsin</button>
          <button id="btn-peace-w">Beyaz barış teklif et</button>
        </div>`;
    } else {
      const truce = (me.truces[tag] || 0) > S.hour;
      if (me.overlord) diplo = `<h3>Diplomasi</h3><div class="muted">Vasallar kendi başlarına savaş ilan edemez.</div>`;
      else diplo = `<h3>Diplomasi</h3>
        ${truce ? `<div class="muted">Ateşkes: ${Math.ceil((me.truces[tag] - S.hour) / 24 / 30)} ay daha savaş ilan edilemez.</div>` : ''}
        <div class="row-btns"><button class="danger" id="btn-war" ${truce ? 'disabled' : ''}>Savaş ilan et</button></div>`;
    }
  }
  const queue = isMe ? `<h3>Ordu</h3>
      <div>Eğitimdeki ordular: ${n.queue.length}</div>
      ${n.queue.map(q => `<div class="queue-item"><span>Yeni ordu</span><span>${Math.ceil((q.done - S.hour) / 24)} gün</span></div>`).join('')}
      <div class="row-btns"><button id="btn-recruit" ${n.manpower < G.RECRUIT_COST || n.gold < G.econ.RECRUIT_GOLD ? 'disabled' : ''}>
        Yeni ordu topla (${G.fmtNum(G.RECRUIT_COST)} asker, ${G.econ.RECRUIT_GOLD} altın, ${G.RECRUIT_DAYS} gün)</button></div>` : '';
  const wars = [...n.enemies];
  el.innerHTML = `<button class="close">✕</button>
    <h2>${U.flag(tag)} ${G.esc(n.name)}</h2>
    <div class="muted">${n.major ? 'Büyük güç' : 'Küçük ülke'}${isMe ? ' · Sizin ülkeniz' : ''}</div>
    <table>
      <tr><td>Hükümdar</td><td>${G.esc(n.ruler)}</td></tr>
      ${n.overlord ? `<tr><td>Efendisi</td><td>${U.nlink(n.overlord)}</td></tr>
        <tr><td>Haraç</td><td>%${Math.round(n.tribute * 100)} insan gücü</td></tr>` : ''}
      ${G.vassalsOf(tag).length ? `<tr><td>Vasalları</td><td>${G.vassalsOf(tag).map(U.nlink).join('<br>')}</td></tr>` : ''}
      <tr><td>Din</td><td>${G.RELIGIONS[n.religion].name}</td></tr>
      <tr><td>Kültür</td><td>${G.GROUP_NAMES[n.group] || '-'}</td></tr>
      <tr><td>Başkent</td><td>${n.capital != null ? `<span class="link" data-prov="${n.capital}">${G.esc(S.provinces[n.capital].name)}</span>` : '-'}</td></tr>
      <tr><td>Eyaletler</td><td>${st.provs} (${st.cities} şehir)</td></tr>
      ${st.occupied ? `<tr><td>İşgal altında</td><td>${st.occupied}</td></tr>` : ''}
      <tr><td>Ordular</td><td>${st.armies} · ${G.fmtNum(st.men)} asker</td></tr>
      <tr><td>İnsan gücü</td><td>${G.fmtNum(n.manpower)}</td></tr>
      <tr><td>Süvari oranı</td><td>%${Math.round(n.cav * 100)}</td></tr>
    </table>
    ${wars.length ? `<h3>Savaşta olduğu ülkeler</h3>${wars.map(w => `<div>${U.nlink(w)}</div>`).join('')}` : ''}
    ${queue}
    ${diplo}`;
  el.querySelector('.close').onclick = U.closePanel;
  const bw = $('btn-war');
  if (bw) bw.onclick = () => {
    G.declareWar(S.player, tag);
    U.showNation(tag); U.refreshTop();
  };
  const br = $('btn-recruit');
  if (br) br.onclick = () => { G.recruit(S.player); U.showNation(tag); U.refreshTop(); };
  const pt = $('btn-peace-t'), pw = $('btn-peace-w');
  const offer = transfer => {
    if (G.ai.considerPeace(tag, S.player, transfer)) {
      G.makePeace(S.player, tag, transfer);
      U.showEvent('Barış Kabul Edildi', `${n.name} barış teklifimizi kabul etti.`, [{ text: 'Mükemmel' }]);
    } else {
      U.showEvent('Barış Reddedildi', `${n.name} elçimizi geri çevirdi. Savaş sürüyor.`, [{ text: 'Öyle olsun' }]);
    }
    U.showNation(tag); U.refreshTop();
  };
  if (pt) pt.onclick = () => offer(true);
  if (pw) pw.onclick = () => offer(false);
};

U.refreshPanel = function () {
  if (U.panelKind === 'prov') U.showProvince(U.panelId);
  else if (U.panelKind === 'nation') U.showNation(U.panelId);
  if (!$('focuswin').classList.contains('hidden')) U.showFocus();
  U.refreshOrdular && U.refreshOrdular();
  U.refreshProduction && U.refreshProduction();
  U.refreshNavy && U.refreshNavy();
};

// ------------------------------------------------------------ günlük, olaylar
U.addLog = function (date, text, cls) {
  const el = $('log');
  const row = document.createElement('div');
  row.className = cls;
  row.innerHTML = `<span class="date">${date}</span>${G.esc(text)}`;
  el.prepend(row);
  while (el.children.length > 80) el.lastChild.remove();
};

// Olay pencereleri sıraya girer: biri açıkken gelen diğeri kaybolmaz, ilki kapanınca açılır
U.eventQueue = [];
U.showEvent = function (title, text, options, onDone) {
  const S = G.S;
  if (!$('modal').classList.contains('hidden') && U.eventOpen) {
    U.eventQueue.push([title, text, options, onDone]);
    return;
  }
  const wasPaused = U.eventQueue.wasPaused ?? (S ? S.paused : true);
  if (S) U.togglePause(true);
  U.eventOpen = true;
  const box = $('modal').querySelector('.modal-box');
  box.innerHTML = `<h2>${G.esc(title)}</h2>
    <div class="ev-date">${S ? G.fmtDate(S.time, false) : ''}</div>
    <p>${G.esc(text)}</p>
    <div class="ev-opts">${options.map((o, i) => `<button data-i="${i}">${G.esc(o.text)}${o.sub ? `<small>${G.esc(o.sub)}</small>` : ''}</button>`).join('')}</div>`;
  $('modal').classList.remove('hidden');
  box.querySelector('.ev-opts').onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    $('modal').classList.add('hidden');
    U.eventOpen = false;
    const o = options[+b.dataset.i];
    if (o.action) o.action();
    if (onDone) onDone();
    U.refreshPanel(); U.refreshTop(); G.mapDirty = true;
    if (U.eventQueue.length) {
      U.eventQueue.wasPaused = wasPaused;   // kuyruktaki olay da bitince ilk duruma dönülür
      U.showEvent(...U.eventQueue.shift());
      if (!U.eventQueue.length) delete U.eventQueue.wasPaused;
      return;
    }
    delete U.eventQueue.wasPaused;
    if (S && !S.over) U.togglePause(wasPaused);
  };
};

U.notify = function (text) {
  U.showEvent('Haber', text, [{ text: 'Tamam' }]);
};

U.warDeclaredOnPlayer = function (tag) {
  const n = G.S.nations[tag];
  U.showEvent('Savaş!', `${n.name} (${n.ruler}) ülkemize savaş ilan etti! Ordularımızı sınıra sevk etmeliyiz.`,
    [{ text: 'Silah başına!' }]);
};

U.gameOver = function (win) {
  const S = G.S;
  S.over = true; S.paused = true;
  U.showEvent(win ? 'Zafer' : 'Yenilgi',
    win ? 'Ülkeniz tarihe adını altın harflerle yazdırdı.' : 'Ülkeniz düştü. Tarih, kaybedenleri hatırlamaz…',
    [{ text: 'Yeni oyun', action: () => location.reload() }]);
};

U.showWelcome = function () {
  const S = G.S, n = S.nations[S.player];
  const wars = [...n.enemies].map(t => S.nations[t].name);
  U.showEvent(`${n.name}`, `${n.ruler} adına hüküm sürüyorsunuz. Yıl 1040. ` +
    (wars.length ? `Ülkeniz şu anda ${wars.join(', ')} ile savaşta! ` : '') +
    (n.overlord ? `Ülkeniz ${S.nations[n.overlord].name} tacının vasalı ve insan gücünün dörtte birini haraç olarak ödüyor. ` +
      'Üst çubuktaki odak düğmesinden bağımsızlık yolunu seçebilirsiniz. ' : '') +
    'Ordularınızı seçip sağ tıkla yürütün. Başka bir ülkeye sağ tıklayınca diplomasi penceresi açılır: elçi, ittifak, ' +
    'garanti, geçiş hakkı ve savaş buradan yönetilir. Savaş ilan etmek için önce bir savaş gerekçesi hazırlamalısınız. ' +
    'Oyunu başlatmak için Boşluk tuşuna basın.', [{ text: 'Tarihi yazmaya başla' }]);
};

// ------------------------------------------------------------ odak ağacı
// Odak simgeleri (64x64 SVG yolları)
U.FOCUS_ICONS = {
  crown: '<path d="M12 44 L16 22 L26 34 L32 16 L38 34 L48 22 L52 44 Z" /><rect x="12" y="46" width="40" height="6" rx="1"/><circle cx="16" cy="20" r="3"/><circle cx="32" cy="14" r="3"/><circle cx="48" cy="20" r="3"/>',
  sword: '<path d="M32 6 L36 12 L35 40 L29 40 L28 12 Z"/><rect x="20" y="40" width="24" height="5" rx="2"/><rect x="29.5" y="45" width="5" height="9"/><circle cx="32" cy="57" r="3.5"/>',
  shield: '<path d="M32 8 L52 14 L50 36 Q46 50 32 58 Q18 50 14 36 L12 14 Z"/><path d="M32 14 L32 52 M18 26 L46 26" stroke="rgba(0,0,0,.45)" stroke-width="3" fill="none"/>',
  castle: '<path d="M10 54 L10 24 L16 24 L16 30 L22 30 L22 24 L28 24 L28 30 L36 30 L36 24 L42 24 L42 30 L48 30 L48 24 L54 24 L54 54 Z"/><path d="M27 54 L27 42 Q32 36 37 42 L37 54 Z" fill="rgba(0,0,0,.5)"/>',
  ship: '<path d="M8 40 L56 40 L48 52 L16 52 Z"/><path d="M31 8 L31 40 L34 40 L34 8 Z"/><path d="M35 10 L52 36 L35 36 Z"/><path d="M30 14 L16 36 L30 36 Z"/>',
  scroll: '<rect x="14" y="12" width="36" height="40" rx="3"/><circle cx="14" cy="16" r="5"/><circle cx="50" cy="48" r="5"/><path d="M20 22 H44 M20 30 H44 M20 38 H38" stroke="rgba(0,0,0,.45)" stroke-width="3"/>',
  axe: '<rect x="30" y="10" width="5" height="46" rx="2"/><path d="M34 12 Q54 14 54 30 Q44 26 34 28 Z"/><path d="M31 12 Q12 16 12 30 Q22 26 31 28 Z"/>',
  coin: '<circle cx="32" cy="32" r="20"/><circle cx="32" cy="32" r="14" fill="none" stroke="rgba(0,0,0,.4)" stroke-width="3"/><path d="M32 22 L32 42 M26 28 Q32 22 38 28 M26 36 Q32 42 38 36" stroke="rgba(0,0,0,.5)" stroke-width="3" fill="none"/>',
  spear: '<path d="M32 4 L37 18 L33.5 18 L33.5 60 L30.5 60 L30.5 18 L27 18 Z"/><path d="M24 24 L40 24" stroke-width="4" stroke="currentColor"/><path d="M14 58 L22 34 L26 36 Z M50 58 L42 34 L38 36 Z"/>',
  helm: '<path d="M14 40 Q14 12 32 10 Q50 12 50 40 L50 50 L40 50 L40 38 L24 38 L24 50 L14 50 Z"/><rect x="30" y="20" width="4" height="26" fill="rgba(0,0,0,.45)"/>',
  banner: '<rect x="14" y="6" width="4" height="52"/><path d="M18 8 L52 8 L44 20 L52 32 L18 32 Z"/><circle cx="16" cy="6" r="3.5"/>',
  dragon: '<path d="M10 44 Q20 30 30 34 Q28 22 40 16 Q38 24 46 24 Q56 22 54 32 Q48 30 44 34 Q52 40 46 50 Q42 42 34 44 Q26 54 10 44 Z"/><circle cx="46" cy="21" r="2" fill="rgba(0,0,0,.6)"/>',
};

U.showFocus = function () {
  const S = G.S, tag = S.player, n = S.nations[tag], tree = G.focus.tree(tag);
  if (!tree) return;
  $('focuswin').classList.remove('hidden');
  $('focus-title').textContent = `${n.name} · Ulusal Odak`;
  const cur = n.focus.cur && G.focus.get(tag, n.focus.cur);
  $('focus-sub').textContent = cur
    ? `Sürüyor: ${cur.name} (${G.FOCUS_DAYS - n.focus.prog} gün kaldı)`
    : 'Bir odak seçin. Her odak ' + G.FOCUS_DAYS + ' gün sürer.';
  const W = 180, H = 178, PX = 30, PY = 26, NW = 150;
  const pos = f => ({ x: PX + f.x * W, y: PY + f.y * H });
  const maxX = Math.max(...tree.map(f => f.x)), maxY = Math.max(...tree.map(f => f.y));
  const width = PX * 2 + maxX * W + NW, height = PY * 2 + (maxY + 1) * H;
  const cx = f => pos(f).x + NW / 2;
  let lines = '';
  for (const f of tree) {
    for (const r of f.req || []) {
      const a = G.focus.get(tag, r), done = n.focus.done.has(r);
      const x1 = cx(a), y1 = pos(a).y + 142, x2 = cx(f), y2 = pos(f).y + 4, my = y2 - 14;
      const d = `M${x1},${y1} L${x1},${my} L${x2},${my} L${x2},${y2}`;
      lines += `<path d="${d}" class="fl-under"/><path d="${d}" class="fl ${done ? 'done' : ''}"/>
        <rect x="${x1 - 3.5}" y="${my - 3.5}" width="7" height="7" transform="rotate(45 ${x1} ${my})" class="fl-gem ${done ? 'done' : ''}"/>`;
    }
  }
  const nodes = tree.map(f => {
    const st = G.focus.state(n, f), p = pos(f);
    const prog = st === 'current' ? n.focus.prog / G.FOCUS_DAYS : st === 'done' ? 1 : 0;
    const R = 31, C2 = 2 * Math.PI * R;
    return `<div class="fnode ${st}" data-f="${f.id}" style="left:${p.x}px;top:${p.y}px" title="${G.esc(f.desc)}">
      <svg class="medal" viewBox="0 0 84 84" width="84" height="84">
        <defs>
          <radialGradient id="mg-${f.id}" cx="50%" cy="40%" r="60%">
            <stop offset="0" style="stop-color:var(--m-in1)"/><stop offset="1" style="stop-color:var(--m-in2)"/></radialGradient>
        </defs>
        <polygon points="42,2 70,14 82,42 70,70 42,82 14,70 2,42 14,14" class="m-frame"/>
        <polygon points="42,8 66,18 76,42 66,66 42,76 18,66 8,42 18,18" fill="url(#mg-${f.id})" class="m-inner"/>
        <circle cx="42" cy="42" r="${R}" class="m-ring"/>
        ${prog > 0 && prog < 1 ? `<circle cx="42" cy="42" r="${R}" class="m-prog" stroke-dasharray="${C2 * prog} ${C2}" transform="rotate(-90 42 42)"/>` : ''}
        <g transform="translate(18 18) scale(0.75)" class="m-icon">${U.FOCUS_ICONS[f.icon] || U.FOCUS_ICONS.banner}</g>
      </svg>
      <div class="ribbon"><span>${G.esc(f.name)}</span></div>
      <div class="fn-eff">${G.esc(f.effectText)}</div>
    </div>`;
  }).join('');
  const el = $('focus-tree');
  el.innerHTML = `<div class="ftree" style="width:${width}px;height:${height}px">
    <svg class="flines" width="${width}" height="${height}">${lines}</svg>${nodes}</div>`;
  el.onclick = e => {
    const node = e.target.closest('.fnode.available');
    if (!node) return;
    const f = G.focus.get(tag, node.dataset.f);
    const go = () => { G.focus.start(tag, f.id); U.showFocus(); U.refreshTop(); };
    if (cur) {
      U.showEvent('Odağı değiştir', `"${cur.name}" odağındaki ilerleme kaybolacak. "${f.name}" odağına geçilsin mi?`,
        [{ text: 'Evet, değiştir', action: go }, { text: 'Vazgeç' }]);
    } else go();
  };
};

// ------------------------------------------------------------ ipucu
U.tooltip = function (sx, sy, html) {
  const el = $('tooltip');
  if (!html) { el.classList.add('hidden'); return; }
  el.innerHTML = html;
  el.classList.remove('hidden');
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = Math.min(sx + 14, window.innerWidth - w - 4) + 'px';
  el.style.top = Math.min(sy + 14, window.innerHeight - h - 4) + 'px';
};
