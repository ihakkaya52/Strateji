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
  for (const id of ['topbar', 'log', 'mapmodes']) $(id).classList.remove('hidden');
  const S = G.S, n = S.nations[S.player];
  $('tb-flag').style.background = n.color;
  $('tb-name').textContent = n.name;
  $('tb-nation').onclick = () => U.showNation(S.player);
  $('btn-pause').onclick = () => U.togglePause();
  const sp = $('tb-speed');
  sp.innerHTML = [1, 2, 3, 4, 5].map(i => `<span data-s="${i}"></span>`).join('');
  sp.onclick = e => { const s = e.target.dataset.s; if (s) U.setSpeed(+s); };
  $('mapmodes').onclick = e => {
    const m = e.target.dataset.mode;
    if (!m) return;
    G.map.mode = m; G.mapDirty = true;
    for (const b of $('mapmodes').children) b.classList.toggle('active', b.dataset.mode === m);
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
  $('tb-armies').textContent = `${st.armies} / ${G.fmtK(st.men)}`;
  const wars = [...n.enemies];
  $('tb-wars').innerHTML = wars.length ? wars.map(t => U.flag(t)).join(' ') : 'Barış';
  $('topbar').classList.toggle('paused', S.paused);
  $('btn-pause').textContent = S.paused ? '▶' : '⏸';
  [...$('tb-speed').children].forEach((el, i) => el.classList.toggle('on', i < S.speed));
};

// ------------------------------------------------------------ paneller
U.closePanel = function () {
  $('panel').classList.add('hidden');
  U.panelKind = null;
  G.map.selProv = null; G.map.selNation = null; G.mapDirty = true;
};

U.showProvince = function (pid) {
  const S = G.S, p = S.provinces[pid];
  U.panelKind = 'prov'; U.panelId = pid;
  G.map.selProv = pid; G.map.selNation = null; G.mapDirty = true;
  const el = $('panel');
  el.classList.remove('hidden');
  if (p.kind === 'waste') {
    el.innerHTML = `<button class="close">✕</button><h2>${G.esc(p.name)}</h2>
      <p class="muted">Issız, geçilemez topraklar. Burada ordu yürüyemez.</p>`;
  } else {
    const armies = G.armiesIn(pid);
    const siege = p.siege ? `<h3>Kuşatma</h3>${U.nlink(p.siege.by)} kuşatıyor
      <div class="bar"><div style="width:${Math.min(100, p.siege.progress / p.siege.need * 100)}%"></div></div>` : '';
    el.innerHTML = `<button class="close">✕</button>
      <h2>${G.esc(p.name)}</h2>
      <div class="muted">${G.KIND_NAMES[p.kind]}${p.home ? ` · ${G.esc(p.home)} bölgesi` : ''}</div>
      <table>
        <tr><td>Sahibi</td><td>${U.nlink(p.owner)}</td></tr>
        ${p.ctrl !== p.owner ? `<tr><td>İşgalci</td><td>${U.nlink(p.ctrl)}</td></tr>` : ''}
        <tr><td>Alan</td><td>${G.fmtNum(p.area)} km²</td></tr>
        <tr><td>Kale</td><td>${p.kind === 'capital' ? 'Büyük sur' : p.kind === 'city' ? 'Sur' : 'Yok'}</td></tr>
        <tr><td>Aylık insan gücü</td><td>${p.kind === 'capital' ? 900 : p.kind === 'city' ? 380 : 140}</td></tr>
      </table>
      ${siege}
      ${armies.length ? `<h3>Ordular</h3>${armies.map(a => `<div>${U.flag(a.tag)} ${G.esc(a.name)} · ${G.fmtK(a.men)}</div>`).join('')}` : ''}`;
  }
  el.querySelector('.close').onclick = U.closePanel;
};

U.showNation = function (tag) {
  const S = G.S, n = S.nations[tag], me = S.nations[S.player];
  U.panelKind = 'nation'; U.panelId = tag;
  G.map.selNation = tag; G.map.selProv = null; G.mapDirty = true;
  const st = G.nationStats(tag);
  const el = $('panel');
  el.classList.remove('hidden');
  const isMe = tag === S.player;
  let diplo = '';
  if (!n.alive) {
    diplo = '<p class="muted">Bu ülke artık yok.</p>';
  } else if (!isMe) {
    if (me.enemies.has(tag)) {
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
      diplo = `<h3>Diplomasi</h3>
        ${truce ? `<div class="muted">Ateşkes: ${Math.ceil((me.truces[tag] - S.hour) / 24 / 30)} ay daha savaş ilan edilemez.</div>` : ''}
        <div class="row-btns"><button class="danger" id="btn-war" ${truce ? 'disabled' : ''}>Savaş ilan et</button></div>`;
    }
  }
  const queue = isMe ? `<h3>Ordu</h3>
      <div>Eğitimdeki ordular: ${n.queue.length}</div>
      ${n.queue.map(q => `<div class="queue-item"><span>Yeni ordu</span><span>${Math.ceil((q.done - S.hour) / 24)} gün</span></div>`).join('')}
      <div class="row-btns"><button id="btn-recruit" ${n.manpower < G.RECRUIT_COST ? 'disabled' : ''}>
        Yeni ordu topla (${G.fmtNum(G.RECRUIT_COST)} asker, ${G.RECRUIT_DAYS} gün)</button></div>` : '';
  const wars = [...n.enemies];
  el.innerHTML = `<button class="close">✕</button>
    <h2>${U.flag(tag)} ${G.esc(n.name)}</h2>
    <div class="muted">${n.major ? 'Büyük güç' : 'Küçük ülke'}${isMe ? ' · Sizin ülkeniz' : ''}</div>
    <table>
      <tr><td>Hükümdar</td><td>${G.esc(n.ruler)}</td></tr>
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
};

// ------------------------------------------------------------ ordu paneli
U.refreshArmyPanel = function () {
  const el = $('armypanel');
  const sel = [...G.selected];
  if (!sel.length) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  const S = G.S, P = S.provinces;
  const total = sel.reduce((s, a) => s + a.men, 0);
  el.innerHTML = `<h3>${sel.length} ordu · ${G.fmtNum(total)} asker</h3>
    <div class="muted" style="font-size:12px;margin-bottom:6px">Sağ tıkla hedef seç.</div>
    ${sel.map(a => {
      const status = a.attacking != null ? `Saldırıyor: ${G.esc(P[a.attacking].name)}`
        : a.besieging && G.atWar(a.tag, P[a.prov].ctrl) ? `Kuşatıyor: ${G.esc(P[a.prov].name)}`
        : a.path.length ? `Yürüyor: ${G.esc(P[a.path[a.path.length - 1]].name)}`
        : `Bekliyor: ${G.esc(P[a.prov].name)}`;
      return `<div class="army-row">
        <span class="nm">${G.esc(a.name)}</span><span>${G.fmtNum(a.men)}</span>
        <span class="muted" style="grid-column:1/3">${status}</span>
        <div class="bars">
          <div title="Örgütlenme"><div class="bar org"><div style="width:${a.org}%"></div></div></div>
          <div title="Mevcut"><div class="bar str"><div style="width:${a.men / a.maxMen * 100}%"></div></div></div>
        </div></div>`;
    }).join('')}
    <div class="row-btns" style="margin-top:8px">
      <button id="btn-army-stop">Dur</button>
      <button id="btn-army-desel">Seçimi bırak</button>
    </div>`;
  $('btn-army-stop').onclick = () => {
    for (const a of G.selected) { a.path = []; a.attacking = null; a.besieging = false; }
    U.refreshArmyPanel(); G.mapDirty = true;
  };
  $('btn-army-desel').onclick = () => G.clearSelection();
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

U.showEvent = function (title, text, options, onDone) {
  const S = G.S;
  const wasPaused = S ? S.paused : true;
  if (S) U.togglePause(true);
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
    const o = options[+b.dataset.i];
    if (o.action) o.action();
    if (onDone) onDone();
    if (S && !S.over) U.togglePause(wasPaused);
    U.refreshPanel(); U.refreshTop(); G.mapDirty = true;
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
    'Ordularınızı seçip sağ tıkla yürütün, düşman şehirlerini kuşatın. Başka bir ülkeye tıklayarak savaş ilan edebilirsiniz. ' +
    'Oyunu başlatmak için Boşluk tuşuna basın.', [{ text: 'Tarihi yazmaya başla' }]);
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
