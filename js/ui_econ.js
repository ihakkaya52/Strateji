// Üretim arayüzü (HOI4 tarzı): inşaat, üretim hatları, teçhizat deposu; eyalet binaları ve kale
'use strict';

(function () {
  const U = G.ui, EC = G.econ;
  const $ = id => document.getElementById(id);
  const pctTxt = v => `%${Math.round(v * 100)}`;

  U.showProduction = function () {
    $('prodwin').classList.remove('hidden');
    U.refreshProduction();
  };
  U.toggleProduction = function () {
    const w = $('prodwin');
    if (w.classList.contains('hidden')) U.showProduction(); else w.classList.add('hidden');
  };

  U.refreshProduction = function () {
    const win = $('prodwin');
    if (!win || win.classList.contains('hidden') || !G.S) return;
    const S = G.S, tag = S.player, n = S.nations[tag], P = S.provinces;
    EC.totals(n);
    const need = EC.nationNeed(tag), def = EC.deficit(tag);
    const armies = S.armies.filter(a => a.tag === tag);
    const avg = armies.length ? armies.reduce((t, a) => t + EC.ratio(a), 0) / armies.length : 1;
    const points = n.civTotal * EC.CIV_POINTS;
    $('prod-sub').textContent = `${n.civTotal} atölye · ${n.milTotal} silahhane · ordunun teçhizat oranı ${pctTxt(avg)}`;

    // inşaat
    let budget = points;
    const rows = n.build.map((b, i) => {
      const p = P[b.prov], B = EC.BUILD[b.kind];
      const occ = p.ctrl !== tag;
      const rate = occ ? 0 : Math.min(budget, EC.MAX_PER_PROJECT * EC.CIV_POINTS);
      budget -= rate;
      const days = rate ? Math.ceil((b.cost - b.progress) / rate) : '—';
      return `<div class="build-row">
        <span class="bi">${B.icon}</span>
        <div class="bmain"><div><b>${G.esc(B.name)}</b> · <span class="link" data-prov="${p.id}">${G.esc(p.name)}</span>
          <span class="muted">${occ ? ' · işgal altında' : rate ? ` · ${days} gün` : ' · sırada bekliyor'}</span></div>
          <div class="bar"><div style="width:${b.progress / b.cost * 100}%"></div></div></div>
        <button data-cancel="${i}" title="İptal">✕</button></div>`;
    }).join('');
    const quick = Object.entries(EC.BUILD).map(([k, B]) => `<button data-quick="${k}">${B.icon} ${B.name} (${G.fmtNum(B.cost)})</button>`).join('');

    // üretim hatları
    const lines = EC.TYPES.map(t => {
      const E = G.EQUIP[t], L = n.lines[t];
      const daily = L.f * EC.MIL_OUTPUT * L.eff / E.cost;
      return `<div class="line-row">
        <div class="li">${E.icon}</div>
        <div class="lmain">
          <div class="lname">${G.esc(E.name)}</div>
          <div class="muted">Depo ${G.fmtNum(n.stock[t])} · ordulardaki eksik ${G.fmtNum(def[t])} · günde +${G.fmtNum(daily)}</div>
          <div class="bar eff" title="Üretim verimi"><div style="width:${L.eff * 100}%"></div></div>
        </div>
        <div class="lctl"><button data-line="${t}" data-d="-1">−</button><b>${L.f}</b><button data-line="${t}" data-d="1" ${n.milFree > 0 ? '' : 'disabled'}>+</button></div>
      </div>`;
    }).join('');

    // depo ve ordu
    const stock = EC.TYPES.map(t => {
      const E = G.EQUIP[t];
      const have = need[t] - def[t];
      const r = need[t] ? have / need[t] : 1;
      return `<div class="stock-row"><span>${E.icon} ${G.esc(E.short)}</span>
        <div class="bar"><div style="width:${r * 100}%;background:${r > 0.9 ? '#7ab04a' : r > 0.6 ? '#d0a040' : '#c0443a'}"></div></div>
        <span class="muted">${G.fmtNum(have)} / ${G.fmtNum(need[t])}</span></div>`;
    }).join('');
    const worst = armies.slice().sort((a, b) => EC.ratio(a) - EC.ratio(b)).slice(0, 5)
      .map(a => `<div class="mod"><span>${G.esc(a.name)} (${G.esc(a.general.name)})</span><b>${pctTxt(EC.ratio(a))}</b></div>`).join('');

    win.querySelector('.prod-body').innerHTML = `
      <div class="prod-col">
        <h3>İnşaat <span class="muted">· günde ${G.fmtNum(points)} puan</span></h3>
        <div class="muted small">Her atölye günde ${EC.CIV_POINTS} puan üretir; bir inşaatta en fazla ${EC.MAX_PER_PROJECT} atölye çalışır.
          Belirli bir ilde inşaat için ile tıklayın ya da hızlı inşaatı kullanın.</div>
        <div class="row-btns">${quick}</div>
        ${rows || '<p class="muted">İnşaat kuyruğu boş.</p>'}
      </div>
      <div class="prod-col">
        <h3>Üretim hatları <span class="muted">· boşta ${n.milFree} silahhane</span></h3>
        <div class="muted small">Her silahhane %100 verimde günde ${EC.MIL_OUTPUT} üretim puanı verir. Yeni açılan hatların verimi zamanla artar.</div>
        ${lines}
        <div class="row-btns"><button data-auto="1">İhtiyaca göre otomatik dağıt</button></div>
      </div>
      <div class="prod-col">
        <h3>Ordunun teçhizatı</h3>
        ${stock}
        <div class="muted small" style="margin-top:6px">Eksik teçhizat savaş gücünü düşürür (teçhizatsız ordu %40 güçle savaşır).
          Kayıpları yerine koyan yeni askerler de depodan teçhizat çeker.</div>
        <h3 style="margin-top:12px">En eksik ordular</h3>
        ${worst || '<p class="muted">Ordunuz yok.</p>'}
      </div>`;

    win.querySelector('.prod-body').onclick = e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.line) EC.setLine(n, b.dataset.line, +b.dataset.d);
      else if (b.dataset.auto) EC.autoLines(n);
      else if (b.dataset.cancel != null) n.build.splice(+b.dataset.cancel, 1);
      else if (b.dataset.quick) {
        const kind = b.dataset.quick;
        const mine = P.filter(p => p.owner === tag && p.ctrl === tag && p.kind !== 'waste');
        let cand;
        if (kind === 'fort') {
          cand = mine.filter(p => p.kind !== 'rural' && p.nb.some(id => P[id].owner && P[id].owner !== tag && !G.sameRealm(P[id].owner, tag)))
            .sort((x, y) => x.fort - y.fort);
        } else cand = mine.filter(p => p.kind !== 'rural').sort((x, y) => EC.isCapital(y) - EC.isCapital(x));
        const p = cand.find(q => EC.canBuild(tag, q, kind)[0]) || mine.find(q => EC.canBuild(tag, q, kind)[0]);
        if (p) EC.queue(tag, p.id, kind);
        else U.addLog(G.fmtDate(S.time, false), 'Uygun yer bulunamadı.', 'war');
      }
      U.refreshProduction(); U.refreshTop();
    };
  };

  // ------------------------------------------------------------ eyalet paneli: binalar ve kale
  U.buildingSection = function (p) {
    const S = G.S;
    if (p.kind === 'waste' || p.civ == null) return '';
    const maxG = EC.maxGarrison(p);
    const mine = p.owner === S.player && p.ctrl === S.player;
    const n = S.nations[S.player];
    const q = mine ? n.build.filter(b => b.prov === p.id) : [];
    const btns = mine ? Object.entries(EC.BUILD).map(([k, B]) => {
      const [ok, why] = EC.canBuild(S.player, p, k);
      return `<button data-build="${k}" ${ok ? '' : 'disabled'} title="${G.esc(why || `${G.fmtNum(B.cost)} inşaat puanı`)}">${B.icon} ${B.name}</button>`;
    }).join('') : '';
    return `<h3>Binalar ve kale</h3>
      <table>
        <tr><td>Atölye</td><td>${p.civ} <span class="muted">(${p.civ + p.mil} / ${EC.slots(p)} yer)</span></td></tr>
        <tr><td>Silahhane</td><td>${p.mil}</td></tr>
        <tr><td>Kale</td><td>${p.fort ? '♜'.repeat(p.fort) + ` <span class="muted">seviye ${p.fort}</span>` : '<span class="muted">Yok</span>'}</td></tr>
        ${p.fort ? `<tr><td>Garnizon</td><td>${G.fmtNum(p.garrison)} / ${G.fmtNum(maxG)}</td></tr>` : ''}
        ${p.fort ? `<tr><td>Savunma</td><td>+%${p.fort * 12} · kuşatma ${G.fmtNum(EC.siegeNeed(p))} ordu-saat</td></tr>` : ''}
      </table>
      ${q.length ? `<div class="muted">İnşaatta: ${q.map(b => EC.BUILD[b.kind].name).join(', ')}</div>` : ''}
      ${btns ? `<div class="row-btns">${btns}</div>` : ''}`;
  };
  U.bindBuildingSection = function (p) {
    for (const b of document.querySelectorAll('#panel [data-build]')) {
      b.onclick = () => { EC.queue(G.S.player, p.id, b.dataset.build); U.showProvince(p.id); U.refreshProduction(); };
    }
  };
})();
