// Ekonomi arayüzü: üretim penceresi (HOI4 tarzı) ve sol alttaki il yönetimi paneli
// (Genel · Kale · Silahhane · Atölye · Maden · Tarım)
'use strict';

(function () {
  const U = G.ui, EC = G.econ;
  const $ = id => document.getElementById(id);
  const pctTxt = v => `%${Math.round(v * 100)}`;
  const g1 = v => (Math.round(v * 10) / 10).toLocaleString('tr-TR');

  // ================================================================ üretim penceresi
  U.showProduction = function () { $('prodwin').classList.remove('hidden'); U.refreshProduction(); };
  U.toggleProduction = function () {
    const w = $('prodwin');
    if (w.classList.contains('hidden')) U.showProduction(); else w.classList.add('hidden');
  };

  // ulusal +/- : bir ilde fabrikayı başka hattan bu hatta (ya da boşa) kaydır
  const shiftLine = (n, t, d) => {
    const provs = G.S.provinces.filter(p => p.owner === n.tag && p.ctrl === n.tag && p.mil > 0);
    if (d > 0) {
      const p = provs.find(q => EC.milFreeIn(q) > 0) ||
        provs.filter(q => EC.TYPES.some(x => x !== t && q.milLines[x] > 0))
          .sort((a, b) => Math.max(...EC.TYPES.filter(x => x !== t).map(x => b.milLines[x])) - Math.max(...EC.TYPES.filter(x => x !== t).map(x => a.milLines[x])))[0];
      if (p) EC.setMil(p, t, 1);
    } else {
      const p = provs.filter(q => q.milLines[t] > 0).sort((a, b) => b.milLines[t] - a.milLines[t])[0];
      if (p) EC.setMil(p, t, -1);
    }
  };

  U.refreshProduction = function () {
    const win = $('prodwin');
    if (!win || win.classList.contains('hidden') || !G.S) return;
    const S = G.S, tag = S.player, n = S.nations[tag], P = S.provinces;
    EC.totals(n);
    const need = EC.nationNeed(tag), def = EC.deficit(tag);
    const armies = S.armies.filter(a => a.tag === tag);
    const avg = armies.length ? armies.reduce((t, a) => t + EC.ratio(a), 0) / armies.length : 1;
    const points = n.buildCiv * EC.CIV_POINTS;
    const b = EC.budget(n);
    $('prod-sub').textContent = `${n.civTotal} atölye (${n.buildCiv} inşaatta) · ${n.milTotal} silahhane · hazine ${G.fmtNum(n.gold)} altın · teçhizat ${pctTxt(avg)}`;

    let budget = points;
    const rows = n.build.map((bd, i) => {
      const p = P[bd.prov], B = EC.BUILD[bd.kind];
      const occ = p.ctrl !== tag;
      const rate = occ ? 0 : Math.min(budget, EC.MAX_PER_PROJECT * EC.CIV_POINTS);
      budget -= rate;
      const days = rate ? Math.ceil((bd.cost - bd.progress) / rate) : '—';
      return `<div class="build-row"><span class="bi">${B.icon}</span>
        <div class="bmain"><div><b>${G.esc(B.name)}</b> · <span class="link" data-prov="${p.id}">${G.esc(p.name)}</span>
          <span class="muted">${occ ? ' · işgal altında' : rate ? ` · ${days} gün` : ' · sırada'}</span></div>
          <div class="bar"><div style="width:${bd.progress / bd.cost * 100}%"></div></div></div>
        <button data-cancel="${i}" title="İptal (altın geri verilmez)">✕</button></div>`;
    }).join('');
    const quick = Object.entries(EC.BUILD).map(([k, B]) =>
      `<button data-quick="${k}" ${n.gold < B.gold ? 'disabled' : ''} title="${G.fmtNum(B.cost)} puan, ${B.gold} altın">${B.icon} ${B.name}</button>`).join('');

    const lines = EC.TYPES.map(t => {
      const E = G.EQUIP[t], k = n.lineTotals[t];
      const daily = P.reduce((s, p) => s + (p.owner === tag && p.ctrl === tag ? (p.milLines[t] || 0) * EC.MIL_OUTPUT * p.milEff[t] : 0), 0) * (1 + n.ironBonus) / E.cost;
      return `<div class="line-row"><div class="li">${E.icon}</div>
        <div class="lmain"><div class="lname">${G.esc(E.name)}</div>
          <div class="muted">Depo ${G.fmtNum(n.stock[t])} · eksik ${G.fmtNum(def[t])} · günde +${G.fmtNum(daily)}</div></div>
        <div class="lctl"><button data-line="${t}" data-d="-1">−</button><b>${k}</b><button data-line="${t}" data-d="1">+</button></div></div>`;
    }).join('');

    const stock = EC.TYPES.map(t => {
      const E = G.EQUIP[t], have = need[t] - def[t], r = need[t] ? have / need[t] : 1;
      return `<div class="stock-row"><span>${E.icon} ${G.esc(E.short)}</span>
        <div class="bar"><div style="width:${r * 100}%;background:${r > 0.9 ? '#7ab04a' : r > 0.6 ? '#d0a040' : '#c0443a'}"></div></div>
        <span class="muted">${G.fmtNum(have)} / ${G.fmtNum(need[t])}</span></div>`;
    }).join('');
    const brow = (label, v, neg) => `<div class="mod"><span>${label}</span><b style="color:${neg ? '#ff8a6a' : '#9ad07a'}">${neg ? '−' : '+'}${g1(v)}</b></div>`;

    win.querySelector('.prod-body').innerHTML = `
      <div class="prod-col">
        <h3>İnşaat <span class="muted">· günde ${G.fmtNum(points)} puan</span></h3>
        <div class="muted small">İnşaata ayrılmış her atölye günde ${EC.CIV_POINTS} puan üretir. Bir ile tıklayıp
          sol alttaki panelden o ile özel inşaat ve üretim seçebilirsiniz.</div>
        <div class="row-btns">${quick}</div>
        ${rows || '<p class="muted">İnşaat kuyruğu boş.</p>'}
      </div>
      <div class="prod-col">
        <h3>Silahhaneler <span class="muted">· boşta ${n.milFree}${n.ironBonus ? ` · demir madenleri +${pctTxt(n.ironBonus)}` : ''}</span></h3>
        <div class="muted small">Her silahhane %100 verimde günde ${EC.MIL_OUTPUT} puan üretir. + / − bir ildeki silahhaneyi bu
          teçhizata çevirir; il il ayar için ilin Silahhane sekmesini kullanın.</div>
        ${lines}
        <div class="row-btns"><button data-auto="1">İhtiyaca göre otomatik dağıt</button></div>
        <h3 style="margin-top:12px">Ordunun teçhizatı</h3>
        ${stock}
      </div>
      <div class="prod-col">
        <h3>Hazine <span class="muted">· ${G.fmtNum(n.gold)} altın</span></h3>
        ${brow('Vergiler', b.tax)}${brow('Ticari ürünler', b.trade)}${brow('Ticaret yolları', b.routes || 0)}${brow('Madenler', b.mines)}${brow('Tarım', b.farms)}
        ${brow('Ordunun maaşı', b.army, true)}${brow('Garnizonlar', b.garrison, true)}
        <div class="mod" style="border-top:1px solid #4a3f2b;margin-top:4px;padding-top:4px"><span><b>Aylık net</b></span>
          <b style="color:${b.net >= 0 ? '#9ad07a' : '#ff8a6a'}">${b.net >= 0 ? '+' : ''}${g1(b.net)}</b></div>
        <div class="muted small" style="margin-top:6px">Altın; inşaat, yeni ordu (${EC.RECRUIT_GOLD} altın) ve gemi için harcanır.
          Hazine eksiye düşerse ordunun morali bozulur. Gelir için atölyeleri ticari ürüne ayırın, maden ve çiftlik kurun.</div>
      </div>`;

    win.querySelector('.prod-body').onclick = e => {
      const bt = e.target.closest('button');
      if (!bt) return;
      if (bt.dataset.line) shiftLine(n, bt.dataset.line, +bt.dataset.d);
      else if (bt.dataset.auto) EC.autoLines(n);
      else if (bt.dataset.cancel != null) n.build.splice(+bt.dataset.cancel, 1);
      else if (bt.dataset.quick) {
        const kind = bt.dataset.quick;
        const mine = P.filter(p => p.owner === tag && p.ctrl === tag && p.kind !== 'waste');
        let cand = mine;
        if (kind === 'fort') cand = mine.filter(p => p.kind !== 'rural' && p.nb.some(id => P[id].owner && !G.sameRealm(P[id].owner, tag))).sort((x, y) => x.fort - y.fort);
        else if (kind === 'civ' || kind === 'mil') cand = mine.filter(p => p.kind !== 'rural').sort((x, y) => EC.isCapital(y) - EC.isCapital(x));
        else if (kind === 'mine') cand = mine.filter(p => EC.MINEABLE.includes(p.res)).sort((x, y) => (G.RESOURCES[y.res].mine || 2) - (G.RESOURCES[x.res].mine || 2));
        else if (kind === 'farm') cand = mine.filter(p => p.res === 'tahil').concat(mine.filter(p => p.kind !== 'rural'));
        const p = cand.find(q => EC.canBuild(tag, q, kind)[0]) || mine.find(q => EC.canBuild(tag, q, kind)[0]);
        if (!p || !EC.queue(tag, p.id, kind)) U.addLog(G.fmtDate(S.time, false), 'Uygun yer ya da yeterli altın yok.', 'war');
      }
      U.refreshProduction(); U.refreshTop(); U.refreshProvince();
    };
  };

  // ================================================================ il yönetimi paneli (sol alt)
  U.provTab = 'genel';
  U.provId = null;

  U.showProvince = function (pid) {
    const S = G.S, p = S.provinces[pid];
    if (U.closeDiplomacy && U.dipTag) U.closeDiplomacy();
    $('panel').classList.add('hidden');
    U.panelKind = null;
    if (U.provId !== pid) U.provTab = p.fort ? 'kale' : 'genel';
    U.provId = pid;
    G.map.selProv = pid; G.map.selNation = null; G.mapDirty = true;
    $('provpanel').classList.remove('hidden');
    $('log').classList.add('hidden');
    U.refreshProvince();
  };
  U.closeProvPanel = function () {
    if (U.provId == null) return;
    U.provId = null;
    $('provpanel').classList.add('hidden');
    $('log').classList.remove('hidden');
    G.map.selProv = null; G.mapDirty = true;
  };

  const buildBtn = (p, kind, label) => {
    const S = G.S, B = EC.BUILD[kind];
    const [ok, why] = EC.canBuild(S.player, p, kind);
    const poor = S.nations[S.player].gold < B.gold;
    return `<button data-build="${kind}" ${ok && !poor ? '' : 'disabled'}
      title="${G.esc(!ok ? why : poor ? 'Yeterli altın yok' : `${G.fmtNum(B.cost)} inşaat puanı · ${B.gold} altın`)}">${B.icon} ${label || B.name + ' inşa et'} <span class="muted">(${B.gold} altın)</span></button>`;
  };

  U.refreshProvince = function () {
    const el = $('provpanel');
    if (U.provId == null || el.classList.contains('hidden')) return;
    const S = G.S, p = S.provinces[U.provId], me = S.player;
    const mine = p.owner === me && p.ctrl === me;
    const queued = mine ? S.nations[me].build.filter(b => b.prov === p.id) : [];
    if ((p.kind === 'wild' || p.kind === 'waste') && !p.owner) { U.refreshWild(p); return; }
    if (mine) EC.fixProvince(p);
    const tabs = [['genel', '◈ Genel'], ['kale', '♜ Kale'], ['silah', '⚔ Silah'], ['atolye', '⚒ Atölye'], ['maden', '⛏ Maden'], ['tarim', '🌾 Tarım']];
    const res = p.res ? G.RESOURCES[p.res] : null;
    let body = '';
    const tab = U.provTab;

    if (tab === 'genel') {
      const armies = G.armiesIn(p.id);
      const own = S.nations[p.owner];
      const tr = p.owner && p.unrest != null ? G.stab.trend(p) : 0;
      const tax = own ? (EC.isCapital(p) ? 3 : p.kind === 'city' ? 1 : 0.3) * G.unrestMult(p) * G.rulerMod(p.owner, 'adm') * (own.taxMult ?? 1) : 0;
      const mpw = (p.kind === 'capital' ? 900 : p.kind === 'city' ? 380 : 140) * (1 + p.farm * 0.25 * (p.res === 'tahil' ? 1.5 : 1)) * G.unrestMult(p);
      const T = G.terrainOf(p);
      const unrestTip = p.unrest != null ? G.stab.factors(p).map(f => `${f[0]}: ${f[1] > 0 ? '+' : ''}${Math.round(f[1] * 10) / 10}`).join('\n') : '';
      const uCls = p.unrest > 60 ? 'bad' : p.unrest > 30 ? 'warn' : 'ok';
      body = `<div class="pv-stats">
          <div class="pv-tile ${uCls}" title="${G.esc(unrestTip)}"><span class="pv-k">Huzursuzluk</span>
            <b>%${Math.round(p.unrest || 0)}</b><div class="bar unrest"><div style="width:${p.unrest || 0}%"></div></div>
            <span class="pv-s">ayda ${tr >= 0 ? '+' : ''}${Math.round(tr * 10) / 10}</span></div>
          <div class="pv-tile"><span class="pv-k">Vergi</span><b>${g1(tax)}</b><span class="pv-s">altın / ay</span></div>
          <div class="pv-tile"><span class="pv-k">İnsan gücü</span><b>${G.fmtNum(Math.round(mpw))}</b><span class="pv-s">asker / ay</span></div>
          <div class="pv-tile"><span class="pv-k">Kale</span><b>${p.fort ? '♜'.repeat(p.fort) : '—'}</b><span class="pv-s">${p.fort ? `${G.fmtK(p.garrison)} garnizon` : 'kalesiz'}</span></div>
        </div>
        <div class="pv-id">${U.cultureHtml(p)}${U.religionHtml(p)}</div>
        <div class="pv-facts">
          <div><span>Asıl sahibi</span><b>${p.core === p.owner ? 'bu ülke' : U.nlink(p.core)}</b></div>
          <div><span>Kaynak</span><b>${res ? `${res.icon} ${G.esc(res.name)}` : '—'}</b></div>
          <div title="Savunma ${T.def >= 1 ? '+' : ''}%${Math.round((T.def - 1) * 100)} · hareket %${Math.round(T.move * 100)}"><span>Arazi</span><b>${G.esc(T.name)} <i>${T.def >= 1 ? '+' : ''}%${Math.round((T.def - 1) * 100)} savunma</i></b></div>
          <div><span>Alan</span><b>${G.fmtNum(p.area)} km²</b></div>
          <div class="wide"><span>Binalar</span><b class="pv-bld"><i title="Atölye">⚒ ${p.civ}</i><i title="Silahhane">⚔ ${p.mil}</i><i title="Kale">♜ ${p.fort}</i><i title="Maden">⛏ ${p.mine}</i><i title="Çiftlik">🌾 ${p.farm}</i></b></div>
        </div>
        ${U.siegeHtml(p)}
        ${U.portSection(p)}
        ${armies.length ? `<h3>Ordular</h3><div class="pv-armies">${armies.map(a => `<div>${U.flag(a.tag)} <b>${G.esc(a.name)}</b><span class="muted">${G.esc(a.general.name)}</span><span>${G.fmtK(a.men)}</span></div>`).join('')}</div>` : ''}
        ${queued.length ? `<h3>İnşaatta</h3><div class="muted">${queued.map(b => EC.BUILD[b.kind].name).join(', ')}</div>` : ''}
        ${U.massacreHtml(p)}`;
    } else if (tab === 'kale') {
      const max = EC.maxGarrison(p), target = EC.garrisonTarget(p);
      const myArmy = mine ? G.armiesIn(p.id).find(a => a.tag === me && a.attacking == null && a.men > 2000) : null;
      body = p.fort ? `
        <div class="fort-big">${'♜'.repeat(p.fort)}<span class="muted">${'♜'.repeat(EC.MAX_FORT - p.fort)}</span></div>
        <table>
          <tr><td>Kale seviyesi</td><td>${p.fort} / ${EC.MAX_FORT}</td></tr>
          <tr><td>Savunma</td><td>+%${p.fort * 12}</td></tr>
          <tr><td>Surlar</td><td>%${Math.round(p.walls ?? 100)}</td></tr>
          <tr><td>Erzak</td><td>${G.fmtNum(G.SIEGE.FOOD_BASE + G.SIEGE.FOOD_PER_LEVEL * p.fort)} gün</td></tr>
          <tr><td>Garnizon</td><td><b>${G.fmtNum(p.garrison)}</b> / ${G.fmtNum(max)} asker</td></tr>
          <tr><td>Hedef garnizon</td><td>${G.fmtNum(target)} (${pctTxt(p.garTarget ?? 1)})</td></tr>
          <tr><td>Aylık gider</td><td>${g1(p.garrison / 1000 * 0.3)} altın</td></tr>
        </table>
        <div class="bar gar"><div style="width:${max ? p.garrison / max * 100 : 0}%"></div></div>
        ${U.siegeHtml(p)}
        ${p.ctrl === me ? `<h3>Garnizon büyüklüğü</h3>
          <div class="muted small">Garnizon insan gücünden doldurulur; küçültülen garnizonun askerleri insan gücüne döner.
            Kaleyi kuşatmak için garnizonun en az bir buçuk katı asker gerekir.</div>
          <div class="seg">${[0, 0.25, 0.5, 0.75, 1].map(v => `<button data-gar="${v}" class="${Math.abs((p.garTarget ?? 1) - v) < 0.01 ? 'on' : ''}">${pctTxt(v)}</button>`).join('')}</div>
          ${myArmy ? `<div class="row-btns"><button data-transfer="1000">${G.esc(myArmy.name)} ordusundan 1.000 asker aktar</button></div>` : ''}` : ''}
        ${mine ? `<div class="row-btns">${buildBtn(p, 'fort', 'Kaleyi güçlendir')}</div>` : ''}`
        : `<p class="muted">Bu ilde kale yok.</p>${mine ? `<div class="row-btns">${buildBtn(p, 'fort', 'Kale inşa et')}</div>` : ''}`;
    } else if (tab === 'silah') {
      const n = S.nations[p.owner];
      body = `<table><tr><td>Silahhane</td><td>${p.mil} <span class="muted">(boşta ${EC.milFreeIn(p)})</span></td></tr>
        <tr><td>Yer</td><td>${p.civ + p.mil} / ${EC.slots(p)}</td></tr>
        ${n && n.ironBonus ? `<tr><td>Demir</td><td>+${pctTxt(n.ironBonus)} üretim</td></tr>` : ''}</table>
        ${p.mil ? `<h3>Bu ilde ne üretilsin?</h3>` + EC.TYPES.map(t => {
          const E = G.EQUIP[t], k = p.milLines[t] || 0;
          const daily = k * EC.MIL_OUTPUT * p.milEff[t] * (1 + (n ? n.ironBonus : 0)) / E.cost;
          return `<div class="line-row"><div class="li">${E.icon}</div>
            <div class="lmain"><div class="lname">${G.esc(E.name)}</div>
              <div class="muted">günde +${G.fmtNum(daily)} · verim ${pctTxt(p.milEff[t])}</div></div>
            ${mine ? `<div class="lctl"><button data-mil="${t}" data-d="-1">−</button><b>${k}</b><button data-mil="${t}" data-d="1">+</button></div>` : `<b>${k}</b>`}</div>`;
        }).join('') : '<p class="muted">Bu ilde silahhane yok.</p>'}
        ${mine ? `<div class="row-btns">${buildBtn(p, 'mil')}</div>` : ''}`;
    } else if (tab === 'atolye') {
      body = `<table><tr><td>Atölye</td><td>${p.civ}</td></tr><tr><td>Yer</td><td>${p.civ + p.mil} / ${EC.slots(p)}</td></tr>
        <tr><td>Kaynak</td><td>${res ? `${res.icon} ${G.esc(res.name)}` : '—'}</td></tr></table>
        ${p.civ ? `<h3>Atölyeler ne yapsın?</h3>` + EC.GOOD_KEYS.map(g => {
          const D = G.GOODS[g], k = p.civLines[g] || 0, bonus = D.res && D.res === p.res;
          const info = g === 'insaat' ? `günde ${k * EC.CIV_POINTS} inşaat puanı` : `ayda +${g1(k * D.gold * (bonus ? 1.5 : 1))} altın${bonus ? ' · yerel kaynak +%50' : ''}`;
          return `<div class="line-row"><div class="li">${D.icon}</div>
            <div class="lmain"><div class="lname">${G.esc(D.name)}</div><div class="muted">${info}</div></div>
            ${mine ? `<div class="lctl"><button data-civ="${g}" data-d="-1">−</button><b>${k}</b><button data-civ="${g}" data-d="1">+</button></div>` : `<b>${k}</b>`}</div>`;
        }).join('') : '<p class="muted">Bu ilde atölye yok.</p>'}
        ${mine ? `<div class="row-btns">${buildBtn(p, 'civ')}</div>` : ''}`;
    } else if (tab === 'maden') {
      const ok = EC.MINEABLE.includes(p.res);
      const out = !ok ? '' : p.res === 'demir' ? `Her seviye silah üretimine +%6 (ülke geneli, en fazla +%50)` : `Her seviye ayda +${g1(res.mine)} altın`;
      body = `<table><tr><td>Kaynak</td><td>${res ? `${res.icon} ${G.esc(res.name)}` : '—'}</td></tr>
        <tr><td>Maden</td><td>${ok ? `${p.mine} / ${EC.MAX_MINE}` : 'İşletilebilir maden yok'}</td></tr>
        ${ok ? `<tr><td>Getirisi</td><td>${out}</td></tr>` : ''}</table>
        <div class="muted small">İşletilebilir madenler: demir, gümüş, altın ve tuz.</div>
        ${mine && ok ? `<div class="row-btns">${buildBtn(p, 'mine', p.mine ? 'Madeni genişlet' : 'Maden aç')}</div>` : ''}`;
    } else if (tab === 'tarim') {
      const mult = p.res === 'tahil' ? 1.5 : 1;
      body = `<table><tr><td>Kaynak</td><td>${res ? `${res.icon} ${G.esc(res.name)}` : '—'}</td></tr>
        <tr><td>Çiftlik</td><td>${p.farm} / ${EC.MAX_FARM}</td></tr>
        <tr><td>İnsan gücü</td><td>+%${Math.round(p.farm * 25 * mult)}</td></tr>
        <tr><td>Gelir</td><td>ayda +${g1(p.farm * 0.5)} altın</td></tr></table>
        <div class="muted small">Her çiftlik ilin insan gücünü %25 ${mult > 1 ? '(tahıl bölgesinde %37,5) ' : ''}artırır ve ayda 0,5 altın getirir.</div>
        ${mine ? `<div class="row-btns">${buildBtn(p, 'farm', p.farm ? 'Çiftlikleri genişlet' : 'Çiftlik kur')}</div>` : ''}`;
    }

    const ownN = S.nations[p.owner];
    el.innerHTML = `<div class="pv-head">
        <div class="pv-title"><h2>${EC.isCapital(p) ? '<span class="pv-star">★</span>' : ''}${G.esc(p.name)}</h2>
          <div class="pv-sub">${G.KIND_NAMES[p.kind]}${EC.isCapital(p) ? ' · başkent' : ''}${p.home ? ` · ${G.esc(p.home)} bölgesi` : ''}</div></div>
        <div class="pv-owner">${ownN ? U.nlink(p.owner) : ''}${p.ctrl !== p.owner && S.nations[p.ctrl] ? `<span class="pv-occ">İşgal: ${G.esc(S.nations[p.ctrl].name)}</span>` : ''}</div>
        <button class="pp-close" title="Kapat">✕</button></div>
      <div class="pp-tabs pv-tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="pp-body">${body}</div>`;
    el.querySelector('.pp-close').onclick = U.closePanel;
    U.bindPortSection(p);
    el.onclick = e => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const n = S.nations[me];
      if (b.dataset.tab) U.provTab = b.dataset.tab;
      else if (b.dataset.build) { if (!EC.queue(me, p.id, b.dataset.build)) U.addLog(G.fmtDate(S.time, false), 'İnşaat başlatılamadı.', 'war'); }
      else if (b.dataset.gar != null) p.garTarget = +b.dataset.gar;
      else if (b.dataset.mission) {
        if (b.dataset.mission === 'go') { if (!G.rel.sendMission(me, p.id)) U.addLog(G.fmtDate(S.time, false), G.rel.canMission(me, p)[1], 'war'); }
        else G.rel.recall(me, p.id);
      }
      else if (b.dataset.massacre) {
        U.showEvent('Katliam emri', G.massacre.costText(me, p), [
          { text: '☠ Emri ver', action: () => { G.massacre.order(me, p.id); U.refreshProvince(); U.refreshTop(); G.mapDirty = true; } },
          { text: 'Vazgeç' }]);
        return;
      }
      else if (b.dataset.assim) {
        if (b.dataset.assim === 'go') { if (!G.cul.sendAssim(me, p.id)) U.addLog(G.fmtDate(S.time, false), G.cul.canAssim(me, p)[1], 'war'); }
        else G.cul.recall(me, p.id);
      }
      else if (b.dataset.assault) { if (!G.startAssault(p)) U.addLog(G.fmtDate(S.time, false), 'Hücum için ordularınızın örgütlenmesi en az %30 olmalı.', 'war'); }
      else if (b.dataset.transfer) {
        const a = G.armiesIn(p.id).find(x => x.tag === me && x.attacking == null && x.men > 2000);
        if (a) EC.reinforceGarrison(p, a, +b.dataset.transfer);
      }
      else if (b.dataset.mil) EC.setMil(p, b.dataset.mil, +b.dataset.d);
      else if (b.dataset.civ) EC.setCiv(p, b.dataset.civ, +b.dataset.d);
      else return;
      EC.totals(n);
      U.refreshProvince(); U.refreshProduction(); U.refreshTop(); G.mapDirty = true;
    };
  };

  // İlin halkı: kültür, bayrak ve asimilasyon
  U.cultureHtml = function (p) {
    const S = G.S, me = S.player, n = S.nations[me], C = G.cul;
    if (!p.owner || !p.cul) return '';
    const own = S.nations[p.owner], mine = p.owner === me;
    const [chip, cls] = !own ? ['', ''] : p.cul === own.culture ? ['asimile · isyan çıkmaz', 'ok']
      : C.accepted(p.owner, p.cul) ? ['akraba halk', 'mid'] : ['yabancı halk', 'bad'];
    let act = '';
    if (mine && p.cul !== n.culture) {
      const m = n.assims.find(x => x.prov === p.id);
      if (m) act = `<div class="pv-prog"><div class="bar"><div style="width:${m.prog / C.ASSIM_NEED * 100}%"></div></div><button data-assim="stop" title="Durdur">✕</button></div><div class="pv-note">Asimilasyon sürüyor</div>`;
      else {
        const [ok, why] = C.canAssim(me, p);
        act = `<button class="pv-act" data-assim="go" ${ok ? '' : 'disabled'} title="${G.esc(why)}">⚖ Asimile et</button><div class="pv-note">${G.esc(why)}</div>`;
      }
    }
    return `<div class="pv-card"><div class="pv-ck">Halk</div>
      <div class="pv-cv">${C.flagHtml(p.cul)}<b>${G.esc(C.get(p.cul).name)}</b></div>
      <div class="pv-cg">${G.esc(C.GROUPS[C.get(p.cul).group] ? C.GROUPS[C.get(p.cul).group].name : '')} kültür grubu</div>
      ${chip ? `<span class="pv-chip ${cls}">${chip}</span>` : ''}${p.massacred ? '<span class="pv-chip bad">katliamdan sonra ıssız</span>' : ''}
      ${act}</div>`;
  };

  // Ağır kararlar: panelin en altında, ayrı bir bölüm
  U.massacreHtml = function (p) {
    const S = G.S, me = S.player, n = S.nations[me];
    if (!G.massacre || p.owner !== me || p.ctrl !== me) return '';
    if (p.cul === n.culture && G.rel.sameFamily(p.relig, n.religion)) return '';
    const [ok, why] = G.massacre.can(me, p);
    return `<div class="pv-danger"><div class="pv-dk">Ağır kararlar</div>
      <div class="pv-drow"><button class="danger" data-massacre="1" ${ok ? '' : 'disabled'} title="${G.esc(ok ? 'Bütün halkı kılıçtan geçir. Bedeli çok ağır.' : why)}">☠ Katliam</button>
      <span class="muted small">${G.esc(ok ? 'Bütün halk öldürülür, yerine kendi halkımız yerleşir. Bedeli çok ağırdır.' : why)}</span></div></div>`;
  };

  // Keşfedilmemiş / sahipsiz topraklar: kâşif ve yerleşim
  U.refreshWild = function (p) {
    const el = $('provpanel'), S = G.S, me = S.player, X = G.explore, C = G.cul;
    const known = X.known(p);
    let body;
    if (!known) {
      const exp = S.expeditions.find(e => e.tag === me && e.to === p.id);
      const [ok, why] = X.canExplore(me, p);
      body = `<p class="muted">Haritacılarımız bu toprakları bilmiyor. Orada kimlerin yaşadığını, nasıl bir ülke olduğunu ancak bir kâşif öğrenebilir.</p>
        ${exp ? `<div class="rl-prog"><span>🧭 Kâşifimiz yolda · ${Math.ceil((exp.arrive - S.hour) / 24)} gün</span>
            <div class="bar"><div style="width:${G.clamp((S.hour - exp.start) / (exp.arrive - exp.start), 0, 1) * 100}%"></div></div></div>`
          : `<div class="row-btns"><button data-x="explore" ${ok ? '' : 'disabled'} title="${G.esc(why)}">🧭 Kâşif gönder</button></div><div class="muted small">${G.esc(why)}</div>`}`;
    } else {
      const K = C.get(p.cul), T = G.terrainOf(p);
      const c = p.colony;
      let act;
      if (c) {
        const cn = S.nations[c.tag];
        act = `<h3>Yerleşim</h3><div>${U.nlink(c.tag)} yerleşim kuruyor</div>
          <div class="bar"><div style="width:${G.clamp(c.settlers / X.SETTLERS, 0, 1) * 100}%"></div></div>
          <div class="muted small">${G.fmtNum(c.settlers)} / ${G.fmtNum(X.SETTLERS)} yerleşimci · ayda yaklaşık +${Math.round(X.growth(c.tag, p))}</div>
          ${c.tag === me ? '<div class="row-btns"><button data-x="abandon">Yerleşimden vazgeç</button></div>' : ''}`;
        void cn;
      } else {
        const [ok, why] = X.canColonize(me, p);
        act = `<div class="row-btns"><button data-x="colony" ${ok ? '' : 'disabled'} title="${G.esc(why)}">⚑ Yerleşim kur</button></div><div class="muted small">${G.esc(why)}</div>`;
      }
      body = `<table>
          <tr><td>Durum</td><td>${p.kind === 'waste' ? 'Issız topraklar · göçebe ve dağınık obalar' : 'Sahipsiz · yerlilerin toprağı'}</td></tr>
          <tr><td>Yerliler</td><td>${C.flagHtml(p.cul)} ${G.esc(K.name)} · ${G.fmtNum(p.natives || 0)} kişi</td></tr>
          <tr><td>İnanç</td><td>${G.esc((G.RELIGIONS[p.relig] || { name: '—' }).name)}</td></tr>
          <tr><td>Arazi</td><td>${G.esc(T.name)}</td></tr>
          <tr><td>Alan</td><td>${G.fmtNum(p.area)} km²</td></tr>
        </table>
        <div class="muted small">${(p.natives || 0) >= 1100 ? 'Yerliler kalabalık: il katıldığında kendi kültürünü ve inancını korur; yerleşime baskın yapabilirler.' : 'Yerliler az: yerleşimciler kendi kültürümüzü ve dinimizi getirir.'}</div>
        ${act}`;
    }
    el.innerHTML = `<div class="pp-head"><h2>${known ? G.esc(p.name) : 'Bilinmeyen Topraklar'}</h2>
        <span class="muted">${known ? 'Keşfedildi' : 'Terra incognita'}</span><button class="pp-close">✕</button></div>
      <div class="pp-body">${body}</div>`;
    el.querySelector('.pp-close').onclick = U.closePanel;
    el.onclick = e => {
      const b = e.target.closest('button[data-x]');
      if (!b || b.disabled) return;
      const k = b.dataset.x;
      if (k === 'explore') { if (!X.sendExplorer(me, p.id)) U.addLog(G.fmtDate(S.time, false), X.canExplore(me, p)[1], 'war'); }
      else if (k === 'colony') { if (!X.colonize(me, p.id)) U.addLog(G.fmtDate(S.time, false), X.canColonize(me, p)[1], 'war'); }
      else if (k === 'abandon') X.abandon(p.id);
      X.invalidate();
      U.refreshProvince(); U.refreshTop(); U.refreshOrdular(); G.mapDirty = true;
    };
  };

  // İlin dini ve misyoner
  U.religionHtml = function (p) {
    const S = G.S, me = S.player, n = S.nations[me];
    if (!p.owner || !p.relig) return '';
    const R = G.RELIGIONS[p.relig] || { name: p.relig, color: '#888' };
    const own = S.nations[p.owner], mine = p.owner === me;
    const [chip, cls] = !own ? ['', ''] : p.relig === own.religion ? ['devletin dini', 'ok']
      : G.rel.sameFamily(p.relig, own.religion) ? ['başka mezhep · sorun çıkarmaz', 'mid'] : ['başka din · isyan edebilir', 'bad'];
    let act = '';
    if (mine && p.relig !== n.religion) {
      const teach = G.rel.sameFamily(p.relig, n.religion);
      const m = (n.missions || []).find(x => x.prov === p.id);
      if (m) act = `<div class="pv-prog"><div class="bar"><div style="width:${m.prog / G.rel.CONVERT_NEED * 100}%"></div></div><button data-mission="stop" title="Geri çağır">✕</button></div><div class="pv-note">${teach ? 'Öğreticilerimiz çalışıyor' : 'Misyonerimiz çalışıyor'}</div>`;
      else {
        const [ok, why] = G.rel.canMission(me, p);
        act = `<button class="pv-act" data-mission="go" ${ok ? '' : 'disabled'} title="${G.esc(why)}">${teach ? '📜 Mezhep öğretisi' : '✝ Misyoner gönder'}</button><div class="pv-note">${G.esc(why)}</div>`;
      }
    }
    return `<div class="pv-card"><div class="pv-ck">İnanç</div>
      <div class="pv-cv"><span class="rl-dot" style="background:${R.color}"></span><b>${G.esc(R.name)}</b></div>
      <div class="pv-cg">${G.esc(G.rel.familyName(p.relig))}</div>
      ${chip ? `<span class="pv-chip ${cls}">${chip}</span>` : ''}
      ${act}</div>`;
  };

  // Kuşatma durumu: kalesiz yerde ilerleme çubuğu, kalede surlar / erzak / garnizon ve hücum
  U.siegeHtml = function (p) {
    const S = G.S, sg = p.siege;
    if (!sg) return '';
    const mine = sg.by === S.player;
    if (!sg.fort) {
      return `<h3>Kuşatma</h3>${U.nlink(sg.by)} kuşatıyor
        <div class="bar"><div style="width:${Math.min(100, sg.progress / sg.need * 100)}%"></div></div>`;
    }
    const days = Math.floor((S.hour - sg.start) / 24);
    const est = mine && !sg.assault ? G.assaultEstimate(p) : null;
    return `<h3>Kale kuşatması</h3>
      <div>${U.nlink(sg.by)} · ${days} gündür${sg.stalled ? ' · <span class="bad">abluka yok: garnizonun 1,5 katı asker gerekir</span>' : ''}</div>
      <table class="siege-tab">
        <tr><td>Surlar</td><td><div class="bar walls"><div style="width:${p.walls}%"></div></div></td><td>%${Math.round(p.walls)}</td></tr>
        <tr><td>Erzak</td><td><div class="bar food"><div style="width:${sg.food / sg.foodMax * 100}%"></div></div></td><td>${Math.ceil(sg.food)} gün</td></tr>
        <tr><td>Garnizon</td><td><div class="bar gar"><div style="width:${Math.min(100, p.garrison / Math.max(1, G.econ.maxGarrison(p)) * 100)}%"></div></div></td><td>${G.fmtNum(p.garrison)}</td></tr>
      </table>
      ${sg.assault ? `<div class="assault">⚔ HÜCUM sürüyor: ${sg.assault.hours} saat · kaybımız ${G.fmtNum(sg.cas)} · garnizon kaybı ${G.fmtNum(sg.gcas)}</div>`
        : `<div class="muted small">Surlar yıkılınca kale düşer; erzak bitince garnizon açlıktan erir. Hücum hızlıdır ama kanlıdır: surlar ne kadar sağlamsa kayıp o kadar büyük.</div>`}
      ${est ? `<div class="row-btns"><button data-assault="1" class="danger">⚔ Hücum et</button>
        <span class="muted small">tahmini ${Math.ceil(est.hours / 24)} gün, ~${G.fmtK(est.loss)} kayıp</span></div>` : ''}`;
  };

  // eski bina bölümü artık il panelinde
  U.buildingSection = () => '';
  U.bindBuildingSection = () => {};
})();
