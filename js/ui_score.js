// Sıralama ve senaryo sonu: ülkelerin gücü puanlanır; 1120'de oyun durur ve "tarihteki yeriniz" açıklanır.
'use strict';

G.score = {};
(function () {
  const SC = G.score, U = G.ui;
  const $ = id => document.getElementById(id);
  SC.END_YEAR = 1120;

  // Puan: toprak ağırlığı, vasal toprakları, ordu, hazine, teknoloji, odaklar, istikrar
  SC.parts = function (tag) {
    const S = G.S, n = S.nations[tag];
    let land = 0, vas = 0;
    const vassals = new Set(G.vassalsOf(tag));
    for (const p of S.provinces) {
      if (p.owner === tag) land += G.provinceWeight(p);
      else if (vassals.has(p.owner)) vas += G.provinceWeight(p);
    }
    const st = G.nationStats(tag);
    return {
      land: land * 3,
      vas: Math.round(vas * 1.5),
      army: Math.round(st.men / 4000),
      gold: Math.round(Math.max(0, Math.min(n.gold, 3000)) / 60),
      tech: (n.techs ? n.techs.size : 0) * 2,
      focus: (n.focus && n.focus.done ? n.focus.done.size : 0) * 2,
      stab: Math.round((n.stability ?? 60) / 5),
    };
  };
  SC.total = tag => Object.values(SC.parts(tag)).reduce((a, b) => a + b, 0);
  SC.LABELS = { land: 'Toprak', vas: 'Vasallar', army: 'Ordu', gold: 'Hazine', tech: 'Teknoloji', focus: 'Odaklar', stab: 'İstikrar' };

  // 1040'taki başlangıç puanları (karşılaştırma için)
  SC.snapshot = function () {
    const S = G.S;
    S.score0 ||= {};
    for (const n of Object.values(S.nations)) if (n.alive && S.score0[n.tag] == null) S.score0[n.tag] = SC.total(n.tag);
  };
  SC.ranking = () => Object.values(G.S.nations).filter(n => n.alive && !n.rebel).map(n => ({ tag: n.tag, n, s: SC.total(n.tag) })).sort((a, b) => b.s - a.s);

  SC.verdict = function (tag) {
    const r = SC.ranking(), i = r.findIndex(x => x.tag === tag), S = G.S;
    const s = SC.total(tag), s0 = (S.score0 && S.score0[tag]) || s, g = s / Math.max(1, s0);
    if (!S.nations[tag] || !S.nations[tag].alive) return ['Tarihe Karışan', 'Ülkeniz tarih sahnesinden silindi.'];
    if (i === 0) return ['Çağın Hâkimi', 'Bilinen dünyanın en güçlü devleti sizinki. Tarihçiler bu çağı sizin adınızla anacak.'];
    if (i < 5) return ['Büyük Güç', `Dünyanın en güçlü beş devletinden birisiniz (${i + 1}. sıra).`];
    if (g >= 1.6) return ['Yükselen Yıldız', `Gücünüz 1040'tan bu yana ${g.toFixed(1)} katına çıktı.`];
    if (g >= 0.95) return ['Ayakta Kalan', 'Fırtınalı bir yüzyılı toprak kaybetmeden atlattınız.'];
    return ['Gerileyen Devlet', `Gücünüz 1040'taki düzeyinin %${Math.round(g * 100)}'ine indi.`];
  };

  // ------------------------------------------------------------ sayfa
  U.PAGE_TITLES.siralama = 'Sıralama';
  U.PAGES.siralama = function () {
    const S = G.S, me = S.player;
    const r = SC.ranking(), myI = r.findIndex(x => x.tag === me);
    const [title, why] = SC.verdict(me);
    const mine = SC.parts(me), s0 = (S.score0 && S.score0[me]) || 0, sNow = SC.total(me);
    const ended = S.time.y >= SC.END_YEAR;
    const histN = S.nations[me].focus ? [...S.nations[me].focus.done].map(id => (G.FOCUS_TREES[me] || []).find(f => f.id === id)).filter(Boolean) : [];
    const alt = histN.filter(f => f.alt).length, hist = histN.filter(f => f.hist).length;
    const rows = r.slice(0, 15).map((x, i) => {
      const s0x = (S.score0 && S.score0[x.tag]) || x.s;
      const d = x.s - s0x;
      return `<tr class="${x.tag === me ? 'me' : ''}"><td class="num">${i + 1}</td><td>${U.flag(x.tag)} <span class="link" data-nation="${x.tag}">${G.esc(x.n.name)}</span>${x.n.overlord ? ' <span class="muted small">vasal</span>' : ''}</td>
        <td class="num">${G.nationStats(x.tag).provs}</td><td class="num">${G.vassalsOf(x.tag).length || ''}</td><td class="num"><b>${x.s}</b></td><td class="num ${d >= 0 ? 'good' : 'bad'}">${d >= 0 ? '+' : ''}${d}</td></tr>`;
    }).join('');
    const meRow = myI >= 15 ? `<tr class="me"><td class="num">${myI + 1}</td><td>${U.flag(me)} ${G.esc(S.nations[me].name)}</td><td class="num">${G.nationStats(me).provs}</td><td class="num">${G.vassalsOf(me).length || ''}</td><td class="num"><b>${sNow}</b></td><td class="num">${sNow - s0 >= 0 ? '+' : ''}${sNow - s0}</td></tr>` : '';
    const parts = Object.entries(mine).map(([k, v]) => `<div class="sc-part"><span>${SC.LABELS[k]}</span><b>${v}</b></div>`).join('');
    return `${ended ? `<div class="sc-end"><div class="sc-year">${SC.END_YEAR}</div><div><h2>Senaryonun Sonu</h2>
        <p>1040'ta başlayan yüzyıl kapandı. Haçlılar Kudüs'te, Selçuklular Anadolu'da, Normanlar Sicilya'da… Sizin hikâyeniz şöyle yazıldı:</p></div></div>` : ''}
      <div class="sc-top">
        <div class="sc-verdict"><div class="muted small">Tarihteki yeriniz${ended ? '' : ' (şimdilik)'}</div><div class="sc-title">${title}</div><p>${why}</p>
          <p class="muted small">Sıra ${myI + 1} / ${r.length} · puan ${sNow} (1040'ta ${s0}) · ${hist} tarihî, ${alt} alternatif odak</p></div>
        <div class="sc-parts">${parts}</div>
      </div>
      <div class="pg-card"><h3>Dünyanın en güçlü devletleri</h3>
        <table class="pg-tab sc-tab"><tr><th>#</th><th>Devlet</th><th>İl</th><th>Vasal</th><th>Puan</th><th>1040'tan beri</th></tr>${rows}${meRow}</table>
        <p class="muted small">Puan: toprak (il ağırlığı ×3), vasalların toprağı, ordu, hazine, teknoloji, tamamlanan odaklar ve istikrar. Senaryo ${SC.END_YEAR}'de biter; isterseniz oynamaya devam edebilirsiniz.</p></div>
      ${ended ? `<div class="sc-btns"><button id="sc-go" class="big">Oynamaya devam et</button><button id="sc-new">Yeni oyun</button></div>` : ''}`;
  };
  U.PAGE_BIND.siralama = function (el) {
    const go = el.querySelector('#sc-go'), nw = el.querySelector('#sc-new');
    if (go) go.onclick = () => U.closePage();
    if (nw) nw.onclick = () => location.reload();
  };

  // ------------------------------------------------------------ 1120: senaryo sonu
  const baseMonthly = G.monthly;
  G.monthly = function () {
    baseMonthly();
    const S = G.S;
    if (!S.score0) SC.snapshot();
    if (!S.endShown && S.time.y >= SC.END_YEAR) {
      S.endShown = true;
      if (!S.nations[S.player]) return;
      S.paused = true;
      G.log(`${SC.END_YEAR}: Senaryonun sonu. Tarihteki yeriniz: ${SC.verdict(S.player)[0]}.`, 'good', [S.player]);
      setTimeout(() => U.openPage('siralama'), 0);
    }
  };
  // yeni oyunda başlangıç puanları
  const baseInit = G.initState;
  G.initState = function (tag) { const r = baseInit.apply(this, arguments); SC.snapshot(); return r; };
})();
