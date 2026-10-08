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
  for (const id of ['topbar', 'log', 'mapmodes']) $(id).classList.remove('hidden');
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
  $('navy-close').onclick = () => $('navywin').classList.add('hidden');
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
  $('tb-armies').textContent = `${G.command.of(S.player).length} ordu · ${st.armies} bölük · ${G.fmtK(st.men)}`;
  $('tb-ships').textContent = `${G.navy.fleetsOf(S.player).reduce((t, f) => t + f.ships.length, 0)} gemi`;
  if (G.focus.tree(S.player)) {
    const f = n.focus.cur && G.focus.get(S.player, n.focus.cur);
    $('tb-focus-name').textContent = f ? f.name : 'Odak seç';
    $('tb-focus-bar').style.width = f ? `${n.focus.prog / G.FOCUS_DAYS * 100}%` : '0%';
    $('tb-focus').classList.toggle('pulse', !f);
  }
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
      ${U.portSection(p)}
      ${armies.length ? `<h3>Bölükler</h3>${armies.map(a => `<div>${U.flag(a.tag)} ${G.esc(a.name)} · ${G.esc(a.cmdr)} · ${G.fmtK(a.men)}</div>`).join('')}` : ''}`;
    U.bindPortSection(p);
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
      <div class="row-btns"><button id="btn-recruit" ${n.manpower < G.RECRUIT_COST ? 'disabled' : ''}>
        Yeni ordu topla (${G.fmtNum(G.RECRUIT_COST)} asker, ${G.RECRUIT_DAYS} gün)</button></div>` : '';
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
    (n.overlord ? `Ülkeniz ${S.nations[n.overlord].name} tacının vasalı ve insan gücünün dörtte birini haraç olarak ödüyor. ` +
      'Üst çubuktaki odak düğmesinden bağımsızlık yolunu seçebilirsiniz. ' : '') +
    'Ordularınızı seçip sağ tıkla yürütün, düşman şehirlerini kuşatın. Başka bir ülkeye tıklayarak savaş ilan edebilirsiniz. ' +
    'Oyunu başlatmak için Boşluk tuşuna basın.', [{ text: 'Tarihi yazmaya başla' }]);
};

// ------------------------------------------------------------ odak ağacı
U.showFocus = function () {
  const S = G.S, tag = S.player, n = S.nations[tag], tree = G.focus.tree(tag);
  if (!tree) return;
  $('focuswin').classList.remove('hidden');
  $('focus-title').textContent = `${n.name} · Ulusal Odak`;
  const cur = n.focus.cur && G.focus.get(tag, n.focus.cur);
  $('focus-sub').textContent = cur
    ? `Sürüyor: ${cur.name} (${G.FOCUS_DAYS - n.focus.prog} gün kaldı)`
    : 'Bir odak seçin. Her odak ' + G.FOCUS_DAYS + ' gün sürer.';
  const W = 190, H = 112, PX = 24, PY = 20;
  const pos = f => ({ x: PX + f.x * W, y: PY + f.y * H });
  const maxX = Math.max(...tree.map(f => f.x)), maxY = Math.max(...tree.map(f => f.y));
  const width = PX * 2 + (maxX + 1) * W, height = PY * 2 + (maxY + 1) * H;
  let lines = '';
  for (const f of tree) {
    for (const r of f.req || []) {
      const a = pos(G.focus.get(tag, r)), b = pos(f);
      const done = n.focus.done.has(r);
      lines += `<path d="M${a.x + 84},${a.y + 64} C${a.x + 84},${a.y + 88} ${b.x + 84},${b.y - 24} ${b.x + 84},${b.y}"
        stroke="${done ? '#d6b36a' : '#5a4b30'}" stroke-width="2" fill="none"/>`;
    }
  }
  const nodes = tree.map(f => {
    const st = G.focus.state(n, f), p = pos(f);
    const prog = st === 'current' ? `<div class="bar"><div style="width:${n.focus.prog / G.FOCUS_DAYS * 100}%"></div></div>` : '';
    return `<div class="fnode ${st}" data-f="${f.id}" style="left:${p.x}px;top:${p.y}px" title="${G.esc(f.desc)}">
      <div class="fn-icon">${st === 'done' ? '✦' : '❖'}</div>
      <div class="fn-name">${G.esc(f.name)}</div>
      <div class="fn-eff">${G.esc(f.effectText)}</div>${prog}</div>`;
  }).join('');
  const el = $('focus-tree');
  el.innerHTML = `<div style="position:relative;width:${width}px;height:${height}px;margin:0 auto">
    <svg width="${width}" height="${height}">${lines}</svg>${nodes}</div>`;
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
