// Barış masası: hangi illerin alınacağını tek tek seç, vasallık ve tazminat iste; bedel savaş skorundan karşılanır
'use strict';

(function () {
  const U = G.ui;
  const $ = id => document.getElementById(id);
  U.peace = null;   // {tag, provs:Set (alınacak), vprovs:Set (vasal kurulacak), vassal, gold}
  const VPROV = 0.6;   // vasal bırakılan il, ilhak edilenin bu kadarına mal olur

  const VASSAL_COST = n => (n.major ? 85 : 55);
  const GOLD_COST = 10;

  // Yapay zekâ şartları kabul eder mi? [evet, sebep]
  G.ai.acceptTerms = function (tag, me, cost) {
    const S = G.S, n = S.nations[tag];
    const score = G.warScore(me, tag);
    const days = (S.hour - (S.nations[me].warStart[tag] || S.hour)) / 24;
    const prog = U.capProgress ? U.capProgress(tag) : 0;
    let limit = score + (days > 365 ? 10 : 0) + (days > 730 ? 10 : 0);
    if (prog >= 0.8) limit = Math.max(limit, 100);   // yıkılmak üzere: her şeye razı
    if (cost <= 0) {
      const ok = score > 0 || (days > 180 && score >= -10) || (days > 720 && score >= -25);
      return [ok, ok ? 'Kabul ederler.' : 'Henüz kazandıklarını düşünüyorlar; beyaz barışa yanaşmıyorlar.'];
    }
    return cost <= limit + 0.5 ? [true, 'Kabul ederler.'] : [false, `Talepler fazla: ${Math.round(cost)} puan istiyorsunuz, kabul edecekleri en fazla ${Math.max(0, Math.round(limit))}.`];
  };

  U.showPeace = function (tag) {
    const S = G.S, me = S.player;
    if (!S.nations[me].enemies.has(tag)) return;
    U.peace = { tag, provs: new Set(), vprovs: new Set(), vassal: false, gold: false };
    // başlangıçta işgal ettiğimiz bütün iller seçili
    const A = new Set(G.warSide(me, tag)), B = new Set(G.warSide(tag, me));
    for (const p of S.provinces) if (B.has(p.owner) && A.has(p.ctrl)) U.peace.provs.add(p.id);
    if (S && !S.paused) U.togglePause(true);
    $('peacewin').classList.remove('hidden');
    U.renderPeace();
  };
  U.closePeace = () => { U.peace = null; $('peacewin').classList.add('hidden'); };

  U.renderPeace = function () {
    const el = $('peacewin'), S = G.S, me = S.player, pc = U.peace;
    if (!pc) return;
    const tag = pc.tag, n = S.nations[tag];
    const A = new Set(G.warSide(me, tag)), B = new Set(G.warSide(tag, me));
    const cost = G.peaceCost(me, tag);
    const occ = S.provinces.filter(p => B.has(p.owner) && A.has(p.ctrl));
    const byOwner = {};
    for (const p of occ) (byOwner[p.owner] ||= []).push(p);
    let total = 0;
    for (const id of pc.provs) total += cost(S.provinces[id]);
    for (const id of pc.vprovs) total += cost(S.provinces[id]) * VPROV;
    if (pc.vassal) total += VASSAL_COST(n);
    if (pc.gold) total += GOLD_COST;
    const score = G.warScore(me, tag);
    const [ok, why] = G.ai.acceptTerms(tag, me, total);
    const lost = S.provinces.filter(p => A.has(p.owner) && B.has(p.ctrl)).length;
    const canVassal = !n.major || score >= 70;
    el.innerHTML = `<div class="focus-head"><h2>☮ Barış Masası · ${G.esc(n.name)}</h2><button class="pg-close">✕</button></div>
      <div class="pc-body">
        <div class="pc-left">
          <h3>İşgal ettiğimiz topraklar <span class="muted">· her il için: al, vasal yap ya da iade et</span></h3>
          <div class="pc-tools"><button data-all="al">Hepsini al</button><button data-all="vas">Hepsini vasal yap</button><button data-all="iade">Hepsini iade et</button></div>
          <div class="muted small" style="margin-bottom:6px">"Vasal" seçilen iller, her eski sahibin topraklarından ayrı bir vasal ülke olarak kurulur (tarihî bir düklük ya da eski sahibi varsa o yeniden doğar). İlhaktan %40 ucuzdur; halkı ayaklanmaz, ama ordusu ve haracı vasalındır.</div>
          ${occ.length ? Object.entries(byOwner).map(([o, list]) => `<div class="pc-grp"><div class="pc-own">${U.flag(o)} ${G.esc(S.nations[o].name)}</div>
            ${list.sort((x, y) => G.provinceWeight(y) - G.provinceWeight(x)).map(p => {
              const st = pc.provs.has(p.id) ? 'al' : pc.vprovs.has(p.id) ? 'vas' : 'iade';
              const c = st === 'al' ? cost(p) : st === 'vas' ? cost(p) * VPROV : 0;
              return `<div class="pc-prov pc3 ${st}">
              <span>${p.kind === 'capital' ? '★ ' : ''}${G.esc(p.name)}</span><small>${G.KIND_NAMES[p.kind]}${p.fort ? ' · ♜' + p.fort : ''}</small>
              <span class="pc-seg">${[['al', 'Al'], ['vas', 'Vasal'], ['iade', 'İade']].map(([k, l]) => `<button data-ps="${k}" data-p="${p.id}" class="${st === k ? 'on' : ''}">${l}</button>`).join('')}</span>
              <b>${c ? Math.round(c * 10) / 10 : '–'}</b></div>`;
            }).join('')}</div>`).join('')
            : '<p class="muted">Düşman topraklarından hiçbir yeri işgal etmiyoruz.</p>'}
        </div>
        <div class="pc-right">
          <h3>Diğer talepler</h3>
          <label class="pc-opt ${pc.vassal ? 'on' : ''} ${canVassal ? '' : 'off'}"><input type="checkbox" id="pc-vassal" ${pc.vassal ? 'checked' : ''} ${canVassal ? '' : 'disabled'}>
            <span>${G.esc(n.name)} vasalımız olsun</span><b>${VASSAL_COST(n)}</b></label>
          ${!canVassal ? '<div class="muted small">Büyük bir gücü vasal yapmak için savaş skoru en az +70 olmalı.</div>' : ''}
          <label class="pc-opt ${pc.gold ? 'on' : ''}"><input type="checkbox" id="pc-gold" ${pc.gold ? 'checked' : ''}>
            <span>Savaş tazminatı (hazinelerinin yarısı: ${G.fmtNum(Math.max(0, Math.floor(n.gold / 2)))} altın)</span><b>${GOLD_COST}</b></label>
          <h3>Hesap</h3>
          <div class="pc-score"><span>Savaş skoru</span><b class="${score >= 0 ? 'pos' : 'neg'}">${score > 0 ? '+' : ''}${score}</b></div>
          <div class="pc-score"><span>Taleplerimiz</span><b>${Math.round(total)}</b></div>
          <div class="pc-meter"><div class="lim" style="width:${Math.max(0, Math.min(100, score))}%"></div><div class="dem ${total > Math.max(0, score) ? 'over' : ''}" style="width:${Math.min(100, total)}%"></div></div>
          <div class="muted small">Düşmanın işgal ettiği ${lost} ilimiz barışla bize geri döner. Seçmediğiniz işgal altındaki iller sahiplerine iade edilir.</div>
          <div class="pc-verdict ${ok ? 'yes' : 'no'}">${ok ? '✔' : '✘'} ${G.esc(why)}</div>
          <div class="pc-btns">
            <button id="pc-send" class="big" ${ok ? '' : 'disabled'}>☮ Barışı teklif et</button>
            <button id="pc-white">Beyaz barış</button>
          </div>
        </div>
      </div>`;
    el.querySelector('.pg-close').onclick = U.closePeace;
    const setSt = (id, k) => { pc.provs.delete(id); pc.vprovs.delete(id); if (k === 'al') pc.provs.add(id); else if (k === 'vas') pc.vprovs.add(id); };
    el.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => { setSt(+b.dataset.p, b.dataset.ps); U.renderPeace(); });
    el.querySelectorAll('[data-all]').forEach(b => b.onclick = () => { for (const p of occ) setSt(p.id, b.dataset.all); U.renderPeace(); });
    const v = $('pc-vassal'); if (v) v.onchange = () => { pc.vassal = v.checked; U.renderPeace(); };
    $('pc-gold').onchange = e => { pc.gold = e.target.checked; U.renderPeace(); };
    $('pc-send').onclick = () => {
      const r = G.peaceTerms(me, tag, { provs: [...pc.provs], vassalProvs: [...pc.vprovs], vassal: pc.vassal, gold: pc.gold });
      U.closePeace();
      U.showEvent('Barış imzalandı', `${n.name} şartlarımızı kabul etti.${r.n ? ` ${r.n} il artık bizim.` : ''}${r.vassals.length ? ` ${r.vassals.map(v => v.name).join(', ')} vasalımız olarak kuruldu.` : ''}${pc.vassal ? ` ${n.name} vasalımız oldu.` : ''}${r.gold ? ` ${r.gold} altın tazminat aldık.` : ''}`, [{ text: 'Zafer bizimdir' }]);
      U.refreshDiplomacy(); U.refreshTop(); G.mapDirty = true;
    };
    $('pc-white').onclick = () => {
      const [wok, wwhy] = G.ai.acceptTerms(tag, me, 0);
      if (wok) { G.makePeace(me, tag, false); U.closePeace(); U.showEvent('Beyaz barış', `${n.name} ile beyaz barış imzalandı.`, [{ text: 'Tamam' }]); }
      else U.toast(wwhy, 'war');
      U.refreshDiplomacy(); U.refreshTop(); G.mapDirty = true;
    };
  };

  // ------------------------------------------------------------ yapay zekâ kazanıyorsa oyuncuya barış şartı gönderir
  const basePeaceTalks = G.ai.peaceTalks;
  G.ai.peaceTalks = function () {
    basePeaceTalks();
    const S = G.S, me = S.player;
    for (const w of (S.wars || []).slice()) {
      if (w.a !== me && w.b !== me) continue;
      const foe = w.a === me ? w.b : w.a;
      if (!S.nations[foe] || !S.nations[foe].alive || !G.atWar(me, foe)) continue;
      const score = G.warScore(foe, me), days = (S.hour - w.start) / 24;
      if (days < 90 || score < 30 || (w.lastOffer && S.hour - w.lastOffer < 24 * 120) || G.rng() > 0.03) continue;
      w.lastOffer = S.hour;
      const A = new Set(G.warSide(foe, me)), B = new Set(G.warSide(me, foe));
      const take = S.provinces.filter(p => B.has(p.owner) && A.has(p.ctrl));
      if (!take.length) continue;
      const nf = S.nations[foe];
      U.showEvent('Barış Şartları', `${nf.name} (${nf.ruler}) bir elçi gönderdi. Savaş onların lehine (skor ${score}). ` +
        `Barış için işgal ettikleri ${take.length} ilimizi istiyorlar: ${take.slice(0, 6).map(p => p.name).join(', ')}${take.length > 6 ? '…' : ''}.`,
        [{ text: 'Şartları kabul et', sub: `${take.length} il onlara geçer, savaş biter`, action: () => {
            for (const p of take) { if (A.has(p.ctrl)) { p.owner = p.ctrl; p.conquered = S.hour; } }
            G.makePeace(foe, me, false, `${nf.name} ile ${S.nations[me].name} barış imzaladı: ${take.length} il el değiştirdi.`);
          } },
         { text: 'Reddet, savaş sürsün' }]);
      break;
    }
  };
})();
