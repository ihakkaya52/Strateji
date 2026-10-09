// Vasallar sayfası: sadakat, haraç, hediye, ayrıcalık, ilhak, azat; kendi topraklarımızdan yeni vasal kurmak.
// İl panelinde "Vasal kur" ve "Vasala ver" düğmeleri.
'use strict';

(function () {
  const U = G.ui, V = G.vassal;
  const $ = id => document.getElementById(id);
  const sg = v => (v > 0 ? '+' : '') + Math.round(v);
  const loyCls = v => (v >= 60 ? 'good' : v >= 35 ? 'mid' : 'bad');
  const loyWord = v => (v >= 80 ? 'Sadık' : v >= 60 ? 'Bağlı' : v >= 35 ? 'Kararsız' : v >= 20 ? 'Huzursuz' : 'Ayaklanmaya hazır');

  U.PAGE_TITLES.vasallar = 'Vasallar';
  U.PAGES.vasallar = function () {
    const S = G.S, me = S.player, n = S.nations[me];
    const list = V.list(me).sort((a, b) => G.nationStats(b.tag).provs - G.nationStats(a.tag).provs);
    let gold = 0, mp = 0, provs = 0, men = 0;
    for (const v of list) {
      gold += v.paidGold || 0;
      mp += G.monthlyManpower(v.tag) * (v.tribute || 0);
      const st = G.nationStats(v.tag); provs += st.provs; men += st.men;
    }
    const top = n.overlord ? `<div class="pg-card vs-lord">${U.flag(n.overlord)} Ülkemiz <b>${U.nlink(n.overlord)}</b> tacının vasalı.
        Sadakatimiz <b class="${loyCls(n.loyalty ?? 60)}">${Math.round(n.loyalty ?? 60)}</b> · haraç ${V.TRIB[n.tribLevel || 'orta'].name.toLowerCase()}
        (insan gücünün %${Math.round((n.tribute || 0) * 100)}'i). Sadakat 20'nin altına düşerse bağımsızlık savaşı açabiliriz.</div>` : '';
    const cards = list.map(v => card(v)).join('');
    const cands = V.candidates(me);
    const candHtml = cands.length ? cands.map(c => `<div class="vs-cand">
        <div><b>${G.esc(c.name)}</b> <span class="muted small">· ${G.esc(c.why)}</span>
          <div class="muted small">${c.provs.length} il: ${c.provs.slice(0, 8).map(p => `<span class="link" data-prov="${p.id}">${G.esc(p.name)}</span>`).join(', ')}${c.provs.length > 8 ? '…' : ''}</div></div>
        <button data-vcreate="${G.esc(c.key)}">♛ Vasal olarak kur</button></div>`).join('')
      : '<p class="muted">Ayrı bir vasal olarak kurulabilecek toprağımız yok. Tek bir ili vasala dönüştürmek için ilin paneline bakın.</p>';
    return `${top}
      <div class="vs-sum">
        <div><span class="muted">Vasal</span><b>${list.length}</b></div>
        <div><span class="muted">Vasal illeri</span><b>${provs}</b></div>
        <div><span class="muted">Vasal orduları</span><b>${G.fmtK(men)}</b></div>
        <div><span class="muted">Aylık haraç</span><b>◉ ${Math.round(gold * 10) / 10} · ♟ ${G.fmtNum(Math.round(mp))}</b></div>
      </div>
      ${list.length ? `<div class="vs-grid">${cards}</div>` : '<p class="muted" style="margin:10px 0">Hiç vasalımız yok. Savaş sonunda barış masasında işgal ettiğiniz illeri "Vasal" seçerek ya da aşağıdan kendi topraklarınızdan vasal kurabilirsiniz.</p>'}
      <h3 class="pg-h">Yeni vasal kur</h3>
      <div class="muted small" style="margin-bottom:6px">Bir bölgeyi vasala bırakmak doğrudan geliri ve askeri azaltır; karşılığında halk huzursuzluğu biter, vasal kendi ordusunu besler ve haraç öder.</div>
      ${candHtml}
      <h3 class="pg-h">Vasallık nasıl işler?</h3>
      <div class="muted small vs-help">
        <p><b>Sadakat</b> her ay hedefine doğru kayar. Hedefi din, halk, efendinin gücü, haraç, ayrıcalıklar, hanedan evliliği, aforoz ve naiplik belirler.
        Sadakat 30'un altındayken vasal haracın yarısını öder; 20'nin altında ayaklanabilir ve sadakatsiz diğer vasallar <b>prens birliği</b> kurup ona katılır.</p>
        <p><b>Haraç:</b> hafif (insan gücü %10, gelir %5, sadakat +12) · orta (%25, %12) · ağır (%40, %25, sadakat −18). Vasal orduları savaşlarımıza kendiliğinden katılır.</p>
        <p><b>Tımarı geri almak</b> (ilhak) için sadakat en az 50 olmalı ve vasallığın üzerinden 10 yıl geçmeli; diğer vasallar tedirgin olur.</p>
      </div>`;
  };

  function card(v) {
    const S = G.S, me = S.player, st = G.nationStats(v.tag), loy = v.loyalty ?? 60, tgt = V.target(v.tag);
    const fac = V.factors(v.tag).map(([l, x]) => `<div class="vs-f"><span>${G.esc(l)}</span><b class="${x > 0 ? 'good' : x < 0 ? 'bad' : ''}">${sg(x)}</b></div>`).join('');
    const btn = (act, label, chk, extra = '') => {
      const [ok, why] = chk;
      return `<button data-vact="${act}" data-tag="${v.tag}" ${ok ? '' : 'disabled'} title="${G.esc(why)}" ${extra}>${label}</button>`;
    };
    const trib = Object.entries(V.TRIB).map(([k, t]) => `<button data-vtrib="${k}" data-tag="${v.tag}" class="${(v.tribLevel || 'orta') === k ? 'on' : ''}">${t.name}</button>`).join('');
    const atWar = v.enemies.size ? `<span class="bad small">⚔ savaşta</span>` : '';
    return `<div class="vs-card">
      <div class="vs-head">${U.flag(v.tag, 'big')}
        <div class="vs-title"><span class="link" data-nation="${v.tag}">${G.esc(v.name)}</span>
          <div class="muted small">${G.esc(V.KIND_NAMES[V.kind(v)])} · ${G.esc(G.rulerName ? G.rulerName(v) : v.ruler)} ${atWar}</div></div>
        <span class="link small" data-prov="${v.capital}">⌖</span></div>
      <div class="vs-stats"><span>${st.provs} il</span><span>${G.fmtK(st.men)} asker</span><span>◉ ${Math.round(v.gold)}</span><span>${(v.privileges || 0)} ayrıcalık</span></div>
      <div class="vs-loy"><div class="vs-loyrow"><span>Sadakat <b class="${loyCls(loy)}">${Math.round(loy)}</b> <span class="muted small">· ${loyWord(loy)} · hedef ${Math.round(tgt)} ${tgt > loy + 1 ? '▲' : tgt < loy - 1 ? '▼' : ''}</span></span></div>
        <div class="vs-bar"><div class="${loyCls(loy)}" style="width:${loy}%"></div><i style="left:${tgt}%"></i><u style="left:20%"></u></div>
        <details class="vs-fac"><summary>Sadakat etkenleri</summary>${fac}</details></div>
      <div class="vs-row"><span class="muted small">Haraç</span><span class="pc-seg">${trib}</span><span class="muted small">♟ %${Math.round((v.tribute || 0) * 100)} · ◉ ${Math.round((v.paidGold || 0) * 10) / 10}/ay</span></div>
      <div class="vs-acts">
        ${btn('gift', '🎁 Hediye', V.canGift(me, v.tag))}
        ${btn('priv', '📜 Ayrıcalık', V.canPrivilege(me, v.tag))}
        ${btn('annex', '👑 Tımarı geri al', V.canAnnex(me, v.tag))}
        ${btn('free', '🕊 Azat et', [!v.enemies.size, v.enemies.size ? 'Savaş sırasında olmaz.' : 'Vasallıktan çıkar; ilişki +50'])}
      </div></div>`;
  }

  U.PAGE_BIND.vasallar = function (el) {
    const S = G.S, me = S.player;
    el.querySelectorAll('[data-vtrib]').forEach(b => b.onclick = () => { V.setTribute(me, b.dataset.tag, b.dataset.vtrib); U.renderPage(); });
    el.querySelectorAll('[data-vact]').forEach(b => b.onclick = () => {
      const tag = b.dataset.tag, v = S.nations[tag], act = b.dataset.vact;
      if (act === 'gift') V.gift(me, tag);
      else if (act === 'priv') V.privilege(me, tag);
      else if (act === 'annex') {
        U.showEvent('Tımarı Geri Al', `${v.name} ilhak edilecek: bütün toprakları doğrudan tacımıza geçer, orduları dağıtılıp insan gücümüze katılır. Bedeli ${V.annexCost(tag)} altın; diğer vasallarımız tedirgin olur (sadakat −15).`,
          [{ text: 'İlhak et', action: () => { V.annex(me, tag); U.renderPage(); U.refreshTop(); } }, { text: 'Vazgeç' }]);
        return;
      } else if (act === 'free') {
        U.showEvent('Vasalı Azat Et', `${v.name} artık vasalımız olmayacak: haraç ödemez, savaşlarımıza katılmaz. İlişkimiz +50.`,
          [{ text: 'Azat et', action: () => { V.free(me, tag); U.renderPage(); } }, { text: 'Vazgeç' }]);
        return;
      }
      U.renderPage(); U.refreshTop();
    });
    el.querySelectorAll('[data-vcreate]').forEach(b => b.onclick = () => {
      const c = V.candidates(me).find(x => x.key === b.dataset.vcreate);
      if (!c) return;
      U.showEvent('Vasal Kur', `${c.provs.length} il (${c.provs.slice(0, 6).map(p => p.name).join(', ')}${c.provs.length > 6 ? '…' : ''}) tacımızdan ayrılıp vasalımız olacak. ` +
        'Bu illerin vergisi ve insan gücü artık vasalın; biz haracını alırız. Halkın huzursuzluğu biter.',
        [{ text: 'Vasal olarak kur', action: () => { const v = V.create(me, c.provs.map(p => p.id)); if (v) U.toast(`${v.name} vasalımız olarak kuruldu.`, 'good'); U.renderPage(); U.refreshTop(); } }, { text: 'Vazgeç' }]);
    });
    el.querySelectorAll('[data-nation]').forEach(b => b.onclick = () => U.showDiplomacy && U.showDiplomacy(b.dataset.nation));
  };

  // ------------------------------------------------------------ üst çubuk düğmesi
  const baseInit = U.initGame;
  U.initGame = function () {
    baseInit();
    $('tb-vassal').onclick = () => U.openPage('vasallar');
  };
  const baseTop = U.refreshTop;
  U.refreshTop = function () {
    baseTop();
    const S = G.S;
    if (!S) return;
    const list = V.list(S.player), t = $('tb-vassaltxt');
    if (!t) return;
    const low = list.filter(v => (v.loyalty ?? 60) < 35).length;
    t.textContent = list.length;
    $('tb-vassal').classList.toggle('warn', low > 0);
    $('tb-vassal').title = `Vasallar: ${list.length}${low ? ` · ${low} vasal huzursuz!` : ''} (V)`;
  };
  window.addEventListener('keydown', e => {
    if (!G.S || e.ctrlKey || e.target.tagName === 'INPUT') return;
    if (!$('modal').classList.contains('hidden')) return;
    if (e.key === 'v' || e.key === 'V') U.openPage('vasallar');
  });

  // ------------------------------------------------------------ il paneli: vasal kur / vasala ver
  U.vassalProvHtml = function (p) {
    const S = G.S, me = S.player;
    if (!S || p.owner !== me || p.ctrl !== me || G.econ.isCapital(p)) return '';
    const nbV = [...new Set(p.nb.map(id => S.provinces[id].owner))].filter(t => t && S.nations[t] && S.nations[t].overlord === me);
    return `<div class="pv-vas"><div class="pv-dk">Vasallık</div>
      <div class="pv-drow"><button data-vprov="new" title="Bu il (ve kırsalı) tacımızdan ayrılıp yeni bir vasal ülke olur">♛ Bu ilden vasal kur</button>
      ${nbV.map(t => `<button data-vprov="${t}" title="${G.esc(V.canGrant(me, t, p.id)[1])}">↦ ${G.esc(S.nations[t].name)}'a ver</button>`).join('')}</div></div>`;
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-vprov]');
    if (!b || !G.S || U.provId == null) return;
    const S = G.S, me = S.player, p = S.provinces[U.provId];
    if (!p || p.owner !== me) return;
    if (b.dataset.vprov === 'new') {
      const ids = S.provinces.filter(q => q.owner === me && (q.id === p.id || (q.home && q.home === p.name))).map(q => q.id);
      U.showEvent('Vasal Kur', `${p.name}${ids.length > 1 ? ` ve kırsalı (${ids.length} il)` : ''} tacımızdan ayrılıp vasalımız olacak.`,
        [{ text: 'Vasal olarak kur', action: () => { const v = V.create(me, ids); if (v) U.toast(`${v.name} vasalımız olarak kuruldu.`, 'good'); U.showProvince(p.id); U.refreshTop(); } }, { text: 'Vazgeç' }]);
    } else if (V.grant(me, b.dataset.vprov, p.id)) {
      U.toast(`${p.name} ${S.nations[b.dataset.vprov].name}'a verildi.`, 'good');
      U.showProvince(p.id);
    }
  });
})();
