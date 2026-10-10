// İttifaklar sayfası: ittifak kur, adını değiştir, üyeleri davet et, savaşa çağır, çıkar ya da ayrıl; dünyadaki ittifaklar.
'use strict';

(function () {
  const U = G.ui, F = G.faction, D = G.dip;

  U.PAGE_TITLES.ittifak = 'İttifaklar';
  U.PAGES.ittifak = function () {
    const S = G.S, me = S.player, n = S.nations[me], f = F.of(me);
    const atWar = n.enemies.size > 0;
    const world = F.list().filter(x => x !== f).sort((a, b) => F.power(b) - F.power(a));
    const memberCard = t => {
      const o = S.nations[t], st = G.nationStats(t), lead = f.leader === t;
      const [cok, cwhy] = t !== me && atWar ? F.canCall(me, t) : [false, ''];
      return `<div class="fc-mem ${lead ? 'lead' : ''}">${U.flag(t, 'big')}
        <div class="fc-mi"><span class="link" data-nation="${t}">${G.esc(o.name)}</span>${lead ? ' <span class="fc-badge">lider</span>' : ''}
          <div class="muted small">${G.esc(G.rulerName ? G.rulerName(o) : o.ruler)} · ${st.provs} il · ${G.fmtK(st.men)} asker${t !== me ? ` · ilişki ${Math.round(D.opinion(t, me))}` : ''}</div></div>
        <div class="fc-act">${t !== me && atWar ? `<button data-fcall="${t}" ${cok ? '' : 'disabled'} title="${G.esc(cwhy)}">⚔ Savaşa çağır</button>` : ''}
          ${t !== me && f.leader === me ? `<button data-fkick="${t}">Çıkar</button>` : ''}</div></div>`;
    };
    let mine;
    if (f) {
      // davet edilebilecekler: komşular, müttefikler ve aynı dinden ülkeler
      const nbs = G.ai.neighbors();
      const pool = new Set(D.allies(me));
      for (const t of G.realm(me)) for (const x of nbs[t] || []) pool.add(x);   // vasallarımızın komşuları da
      for (const m of f.members) for (const x of nbs[m] || []) pool.add(x);
      const cands = [...pool].filter(t => S.nations[t] && S.nations[t].alive && !f.members.has(t) && !S.nations[t].overlord && t !== me)
        .map(t => ({ t, a: F.accepts(t, f) })).sort((x, y) => (y.a[0] - x.a[0]) || (D.opinion(y.t, me) - D.opinion(x.t, me))).slice(0, 18);
      mine = `<div class="pg-card fc-mine">
          <div class="fc-head"><input id="fc-name" value="${G.esc(f.name)}" maxlength="40" ${f.leader === me ? '' : 'disabled'}>
            ${f.leader === me ? '<button id="fc-rename">Adı değiştir</button>' : ''}<span class="muted small">${f.members.size} / ${F.MAX} üye · toplam güç ${G.fmtK(F.power(f))}</span>
            <button id="fc-leave" class="danger">İttifaktan ayrıl</button></div>
          <div class="fc-mems">${[f.leader, ...[...f.members].filter(t => t !== f.leader)].map(memberCard).join('')}</div>
          <p class="muted small">Üyeler birbirinin müttefikidir: biri saldırıya uğrarsa hepsi savaşa girer. Liderin açtığı savaşa üyeler kendiliğinden katılır; diğer savaşlarda üyeleri "Savaşa çağır" ile çağırabilirsiniz.</p>
        </div>
        ${f.members.size < F.MAX ? `<h3 class="pg-h">Davet et</h3><div class="fc-cands">${cands.map(({ t, a }) => `<div class="fc-cand">${U.flag(t)} <span class="link" data-nation="${t}">${G.esc(S.nations[t].name)}</span>
            <span class="muted small">${G.esc(a[1])}</span><button data-finv="${t}" ${a[0] ? '' : 'disabled'}>Davet et</button></div>`).join('') || '<p class="muted">Davet edilebilecek kimse yok.</p>'}</div>` : ''}`;
    } else {
      const [ok, why] = F.canCreate(me);
      mine = `<div class="pg-card fc-new"><h3>İttifak kur</h3>
        <p>Komşularınızla ve dindaşlarınızla adı olan bir savunma birliği kurun. Üyeler birbirinin müttefikidir; saldırıya uğrayanın yanında savaşa girerler.</p>
        <div class="fc-head"><input id="fc-newname" value="${G.esc(n.name)} İttifakı" maxlength="40"><button id="fc-create" ${ok ? '' : 'disabled'} title="${G.esc(why)}">🤝 İttifakı kur</button>${ok ? '' : `<span class="muted small">${G.esc(why)}</span>`}</div></div>`;
    }
    const others = world.length ? world.map(x => {
      const [ok, why] = !f ? F.accepts(me, x) : [false, ''];
      return `<div class="fc-world"><div><b>${G.esc(x.name)}</b> <span class="muted small">· lider ${G.esc(S.nations[x.leader].name)} · ${x.members.size} üye · güç ${G.fmtK(F.power(x))}</span></div>
        <div class="fc-flags">${[...x.members].map(t => `<span title="${G.esc(S.nations[t].name)}" data-nation="${t}" class="link">${U.flag(t)}</span>`).join('')}</div>
        ${!f ? `<button data-freq="${x.id}" ${ok ? '' : 'disabled'} title="${G.esc(why)}">Katılmak iste</button>` : ''}</div>`;
    }).join('') : '<p class="muted">Dünyada başka ittifak yok.</p>';
    return `${mine}<h3 class="pg-h">Dünyadaki ittifaklar</h3><div class="fc-worlds">${others}</div>`;
  };
  U.PAGE_BIND.ittifak = function (el) {
    const S = G.S, me = S.player, f = F.of(me);
    const q = s => el.querySelector(s);
    if (q('#fc-create')) q('#fc-create').onclick = () => { F.create(me, q('#fc-newname').value); U.renderPage(); };
    if (q('#fc-rename')) q('#fc-rename').onclick = () => { F.rename(f, q('#fc-name').value); U.renderPage(); };
    if (q('#fc-leave')) q('#fc-leave').onclick = () => U.showEvent('İttifaktan ayrıl', `${f.name}'ndan ayrılırsak üyelerle ilişkimiz −30 olur ve artık bizi savunmazlar.`,
      [{ text: 'Ayrıl', action: () => { F.leave(me); U.renderPage(); } }, { text: 'Vazgeç' }]);
    el.querySelectorAll('[data-finv]').forEach(b => b.onclick = () => {
      const t = b.dataset.finv, ok = F.invite(f, t);
      U.toast(ok ? `${S.nations[t].name} ittifaka katıldı.` : `${S.nations[t].name} davetimizi reddetti.`, ok ? 'good' : 'war');
      U.renderPage();
    });
    el.querySelectorAll('[data-fkick]').forEach(b => b.onclick = () => { F.kick(f, b.dataset.fkick); U.renderPage(); });
    el.querySelectorAll('[data-fcall]').forEach(b => b.onclick = () => {
      const t = b.dataset.fcall, ok = F.callToArms(me, t);
      U.toast(ok ? `${S.nations[t].name} savaşa katıldı!` : `${S.nations[t].name} çağrıya uymadı.`, ok ? 'good' : 'war');
      U.renderPage(); U.refreshTop();
    });
    el.querySelectorAll('[data-freq]').forEach(b => b.onclick = () => {
      const x = F.list().find(y => y.id === +b.dataset.freq), ok = x && F.request(me, x);
      U.toast(ok ? `${x.name}'na katıldık.` : 'İsteğimiz reddedildi.', ok ? 'good' : 'war');
      U.renderPage();
    });
    el.querySelectorAll('[data-nation]').forEach(b => b.onclick = () => { U.closePage(); U.showDiplomacy && U.showDiplomacy(b.dataset.nation); });
  };
})();
