// Muharebe penceresi: haritadaki ⚔ işaretine tıklayınca açılır
'use strict';

(function () {
  const U = G.ui;
  const $ = id => document.getElementById(id);
  const DICE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const stars = k => '★'.repeat(Math.min(5, k)) + '☆'.repeat(Math.max(0, 5 - k));

  U.battleKey = null;

  U.showBattle = function (key) {
    U.battleKey = key;
    U.lastBattle = null;
    $('battlepanel').classList.remove('hidden');
    U.refreshBattle();
    G.mapDirty = true;
  };
  U.closeBattle = function () {
    U.battleKey = null;
    $('battlepanel').classList.add('hidden');
    G.mapDirty = true;
  };

  const side = (b, att, arr) => {
    const S = G.S, tag = att ? b.tag : b.defTag, n = S.nations[tag];
    const men = att ? b.menA : b.menD, eng = att ? b.engA : b.engD, cas = att ? b.casA : b.casD;
    const dice = att ? b.diceA : b.diceD, sk = att ? b.skA : b.skD;
    const org = arr.length ? arr.reduce((s, a) => s + a.org * a.men, 0) / Math.max(1, arr.reduce((s, a) => s + a.men, 0)) : 0;
    const best = arr.slice().sort((x, y) => y.general.skill - x.general.skill)[0];
    const cav = arr.reduce((s, a) => s + a.men * a.cav, 0), all = arr.reduce((s, a) => s + a.men, 0) || 1;
    const arch = (all - cav) * 0.3, inf = all - cav - arch;
    return `<div class="bt-side ${att ? 'att' : 'def'}">
      <div class="bt-nat">${U.flag(tag)} <b>${G.esc(n.name)}</b> <span class="muted">${att ? 'saldıran' : 'savunan'}</span></div>
      ${best ? `<div class="bt-gen">${G.portrait ? `<span class="bt-face">${G.portrait.leader(best.general, tag, 'general', { size: 34 })}</span>` : ''}${G.esc(best.general.name)}<br><span class="stars">${stars(sk)}</span></div>` : ''}
      <div class="bt-dice" title="Bu evrenin zarı">${DICE[dice] || ''}<small>${dice}</small></div>
      <table>
        <tr><td>Asker</td><td>${G.fmtNum(men || 0)}</td></tr>
        <tr><td>Ön safta</td><td>${G.fmtNum(eng || 0)}</td></tr>
        <tr><td>Yedekte</td><td>${G.fmtNum(Math.max(0, (men || 0) - (eng || 0)))}</td></tr>
        <tr><td>Kayıp</td><td class="neg">${G.fmtNum(cas)}</td></tr>
        <tr><td>Bileşim</td><td class="muted">${G.fmtK(inf)} piyade · ${G.fmtK(arch)} okçu · ${G.fmtK(cav)} süvari</td></tr>
      </table>
      <div class="bt-org" title="Örgütlenme (moral)"><div style="width:${org}%"></div></div>
      <div class="bt-armies">${arr.map(a => `<span>${G.esc(a.name)} ${G.fmtK(a.men)}</span>`).join('')}</div>
    </div>`;
  };

  U.refreshBattle = function () {
    const el = $('battlepanel');
    if (!G.S || el.classList.contains('hidden') || !U.battleKey) return;
    const S = G.S, P = S.provinces;
    let b = S.battles.get(U.battleKey);
    if (!b) b = (S.lastBattles || []).find(x => x.key === U.battleKey && x.start === (U.lastBattleStart ?? x.start));
    if (!b) { U.closeBattle(); return; }
    U.lastBattleStart = b.start;
    const atk = (b.atkIds || []).map(id => S.armies.find(a => a.id === id)).filter(Boolean);
    const def = (b.defIds || []).map(id => S.armies.find(a => a.id === id)).filter(Boolean);
    const ph = G.BATTLE.PHASES, cur = b.phase || 0;
    const r = b.ratio || 1, share = r / (1 + r) * 100;
    const fort = P[b.target].fort && G.econ.fortMod(P[b.target], b.defTag) > 1;
    const hrs = S.hour - b.start;
    el.innerHTML = `<div class="bt-head"><h2>⚔ ${G.esc(P[b.target].name)} Muharebesi</h2>
        <span class="muted">${Math.floor(hrs / 24)}. gün, ${hrs % 24}. saat</span><button class="x" id="bt-close">✕</button></div>
      ${b.over ? `<div class="bt-over">${b.winner ? `Muharebeyi <b>${G.esc(S.nations[b.winner].name)}</b> kazandı.` : 'Muharebe sona erdi.'}</div>` : ''}
      <div class="bt-phases">${ph.map((p, i) => `<span class="${i === cur && !b.over ? 'on' : ''}">${['🏹', '🐎', '⚔'][i]} ${p.name}</span>`).join('')}</div>
      <div class="bt-ratio"><div class="a" style="width:${share}%"></div></div>
      <div class="bt-notes muted">
        ${b.flank > 1 ? 'Saldıranın süvarisi kanatları sarıyor. ' : b.flank < 1 ? 'Savunanın süvarisi kanatları tutuyor. ' : ''}
        ${G.terrainOf(P[b.target]).def !== 1 ? `Arazi: ${G.terrainOf(P[b.target]).name} (savunma ${G.terrainOf(P[b.target]).def > 1 ? '+' : ''}%${Math.round((G.terrainOf(P[b.target]).def - 1) * 100)}${G.terrainOf(P[b.target]).noFlank ? ', süvari kanat saramaz' : ''}). ` : ''}
        ${fort ? `Savunan kale surlarının arkasında (+%${Math.round((G.econ.fortMod(P[b.target], b.defTag) - 1) * 100)}). ` : ''}
        Cephe genişliği: her taraftan en fazla ${G.fmtNum(G.BATTLE.WIDTH)} asker aynı anda çarpışır.</div>
      <div class="bt-cols">${side(b, true, atk)}${side(b, false, def)}</div>`;
    $('bt-close').onclick = U.closeBattle;
  };
})();
