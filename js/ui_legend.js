// Din ve kültür haritalarının renk lejantı: haritada yazı yok, renklerin anlamı sağ alttaki oktan açılan listede
'use strict';

(function () {
  const U = G.ui, M = G.map;
  const $ = id => document.getElementById(id);
  U.legendOpen = false;

  const place = () => {
    const mm = $('mapmodes').getBoundingClientRect();
    const bottom = Math.max(8, window.innerHeight - mm.top + 6);
    $('legend-tab').style.bottom = bottom + 'px';
    $('legend').style.bottom = (bottom + 34) + 'px';
  };

  // haritada görünen illerdeki dinler / kültürler ve il sayıları
  const counts = mode => {
    const S = G.S, c = {};
    if (!S) return c;
    for (const p of S.provinces) {
      if (M.hidden(p) || (p.kind === 'waste' && !p.owner)) continue;
      const k = mode === 'religion' ? (p.relig || (p.owner && S.nations[p.owner] && S.nations[p.owner].religion)) : p.cul;
      if (k) c[k] = (c[k] || 0) + 1;
    }
    return c;
  };

  U.renderLegend = function () {
    const el = $('legend'), mode = M.mode, c = counts(mode);
    const groups = {};
    if (mode === 'religion') {
      for (const k of Object.keys(c)) {
        const fam = G.rel.familyName(k);
        (groups[fam] ||= []).push({ key: k, name: (G.RELIGIONS[k] || { name: k }).name, color: M.mute((G.RELIGIONS[k] || { color: '#888888' }).color), n: c[k] });
      }
    } else {
      for (const k of Object.keys(c)) {
        const C = G.cul.get(k), g = (G.cul.GROUPS[C.group] || { name: 'Diğer' }).name;
        (groups[g] ||= []).push({ key: k, name: C.name, color: M.mute(C.color), n: c[k], flag: G.cul.flagSvg(k, 18, 12) });
      }
    }
    const tot = list => list.reduce((a, x) => a + x.n, 0);
    const ordered = Object.entries(groups).sort((a, b) => tot(b[1]) - tot(a[1]));
    el.innerHTML = `<div class="lg-head"><b>${mode === 'religion' ? 'Dinler ve mezhepler' : 'Halklar ve kültürler'}</b><span class="muted small">üzerine gelin: haritada vurgulanır</span><button class="lg-x" title="Kapat">✕</button></div>
      <div class="lg-body">${ordered.map(([g, list]) => `<div class="lg-grp"><div class="lg-gn">${G.esc(g)}</div>
        ${list.sort((a, b) => b.n - a.n).map(x => `<div class="lg-row" data-lg="${x.key}"><i style="background:${x.color}"></i>${x.flag ? `<span class="lg-flag">${x.flag}</span>` : ''}<span>${G.esc(x.name)}</span><small>${x.n} il</small></div>`).join('')}</div>`).join('')}</div>`;
    el.querySelector('.lg-x').onclick = () => { U.legendOpen = false; U.refreshLegend(); };
    el.querySelectorAll('[data-lg]').forEach(r => {
      r.onmouseenter = () => { M.legendHi = { mode, key: r.dataset.lg }; G.mapDirty = true; };
      r.onmouseleave = () => { M.legendHi = null; G.mapDirty = true; };
    });
  };

  U.refreshLegend = function () {
    const on = G.S && (M.mode === 'religion' || M.mode === 'culture');
    $('legend-tab').classList.toggle('hidden', !on);
    $('legend').classList.toggle('hidden', !on || !U.legendOpen);
    $('legend-tab').textContent = U.legendOpen ? '▾ Renkler' : '▴ Renkler';
    M.legendHi = null; G.mapDirty = true;
    if (!on) return;
    place();
    if (U.legendOpen) U.renderLegend();
  };
  $('legend-tab').onclick = () => { U.legendOpen = !U.legendOpen; U.refreshLegend(); };
  window.addEventListener('resize', () => { if (!$('legend-tab').classList.contains('hidden')) place(); });
})();
