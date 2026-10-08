// Diplomasi penceresi (HOI4 / EU4 tarzı): bir ülkeye sağ tıklayınca açılır
'use strict';

(function () {
  const U = G.ui, D = G.dip;
  const $ = id => document.getElementById(id);

  const opColor = v => (v >= 50 ? '#9ad07a' : v >= 0 ? '#e0d090' : v >= -50 ? '#e0a060' : '#ff7a5a');
  const yesNo = (ok, why) => `<span class="${ok ? 'ok' : 'no'}">${ok ? '✔' : '✘'} ${G.esc(why)}</span>`;

  U.showDiplomacy = function (tag) {
    const S = G.S;
    if (!S || !S.nations[tag]) return;
    if (tag === S.player) { U.showNation(tag); return; }
    U.dipTag = tag;
    U.panelKind = null;
    if (U.closeProvPanel) U.closeProvPanel();
    $('panel').classList.add('hidden');
    $('dipwin').classList.remove('hidden');
    U.refreshDiplomacy();
  };

  U.closeDiplomacy = function () {
    $('dipwin').classList.add('hidden');
    U.dipTag = null;
  };

  U.refreshDiplomacy = function () {
    const win = $('dipwin');
    if (win.classList.contains('hidden') || !U.dipTag) return;
    const S = G.S, me = S.player, mn = S.nations[me], tag = U.dipTag, n = S.nations[tag];
    const st = G.nationStats(tag);
    const op = Math.round(D.opinion(tag, me));
    const fleets = G.navy.fleetsOf(tag);
    const ships = fleets.reduce((t, f) => t + f.ships.length, 0);
    const focus = n.focus.cur ? G.focus.get(tag, n.focus.cur) : null;
    const list = arr => arr.length ? arr.map(t => `<span class="link" data-dip="${t}">${U.flag(t)} ${G.esc(S.nations[t].name)}</span>`).join(', ') : '<span class="muted">—</span>';

    // ---- eylemler
    const acts = [];
    const btn = (id, label, ok, why, cls = '') =>
      acts.push(`<div class="dip-act"><button data-act="${id}" class="${cls}" ${ok ? '' : 'disabled'}>${label}</button>
        <div class="why">${why}</div></div>`);
    const alive = n.alive;
    if (!alive) {
      acts.push('<p class="muted">Bu ülke tarih sahnesinden silindi.</p>');
    } else {
      // elçi
      if (mn.envoyTo.has(tag)) btn('recall', 'Elçiyi geri çağır', true, `Elçi ilişkileri günde +${D.ENVOY_GAIN} geliştiriyor.`);
      else {
        const free = mn.envoys - mn.envoyTo.size;
        btn('envoy', 'Elçi gönder (ilişkileri geliştir)', free > 0 && !mn.enemies.has(tag),
          mn.enemies.has(tag) ? yesNo(false, 'Savaştayken elçi gönderilemez.') : yesNo(free > 0, `Boştaki elçiler: ${free} / ${mn.envoys}`));
      }
      // ittifak
      if (D.allied(me, tag)) btn('unally', 'İttifakı boz', true, yesNo(true, 'İlişki ciddi şekilde bozulur.'), 'danger');
      else {
        const [ok, why] = D.acceptAlliance(tag, me);
        btn('ally', 'İttifak teklif et', ok && !mn.overlord, mn.overlord ? yesNo(false, 'Vasallar ittifak kuramaz.') : yesNo(ok, why));
      }
      // askerî geçiş
      if (n.accessGranted.has(me)) btn('noaccess', 'Geçiş hakkından vazgeç', true, 'Ordularımız onların topraklarından geçebiliyor.');
      else {
        const [ok, why] = D.acceptAccess(tag, me);
        btn('access', 'Askerî geçiş hakkı iste', ok, yesNo(ok, why));
      }
      if (mn.accessGranted.has(tag)) btn('revoke', 'Verdiğimiz geçiş hakkını geri al', true, 'Onların orduları topraklarımızdan geçebiliyor.');
      else btn('grant', 'Geçiş hakkı ver', !mn.enemies.has(tag), 'Orduları topraklarımızdan geçebilir. İlişki +15.');
      // garanti
      if (mn.guarantees.has(tag)) btn('ungarantee', 'Garantiyi kaldır', true, 'Saldırıya uğrarlarsa artık yardıma gitmeyiz.');
      else btn('guarantee', 'Bağımsızlığını garanti et', !mn.enemies.has(tag) && !G.sameRealm(tag, me) && !mn.overlord,
        'Saldırıya uğrarlarsa onların yanında savaşa gireriz. İlişki +25.');
      // savaş gerekçesi ve savaş
      if (mn.enemies.has(tag)) {
        const w = G.findWar(me, tag);
        const ws = G.warScore(me, tag);
        const leader = w && (w.a === me || w.b === me);
        acts.push(`<div class="dip-war">Savaş skoru: <b style="color:${ws >= 0 ? '#9ad07a' : '#ff8a6a'}">${ws > 0 ? '+' : ''}${ws}</b>
          ${w ? `<div class="muted">Taraflar: ${list([...(w.att.has(me) ? w.att : w.def)])} ⚔ ${list([...(w.att.has(me) ? w.def : w.att)])}</div>` : ''}</div>`);
        const can = leader && !mn.overlord;
        const why = !can ? yesNo(false, 'Barışa koalisyonun lideri karar verir.') : '';
        btn('peace_t', 'Barış: işgal edilen topraklar bizim olsun', can, why || yesNo(G.ai.considerPeace(tag, me, true), G.ai.considerPeace(tag, me, true) ? 'Kabul ederler.' : 'Savaş skoru yetersiz.'), 'good');
        btn('peace_w', 'Beyaz barış teklif et', can, why || yesNo(G.ai.considerPeace(tag, me, false), G.ai.considerPeace(tag, me, false) ? 'Kabul ederler.' : 'Henüz kazandıklarını düşünüyorlar.'));
      } else {
        if (mn.justify && mn.justify.target === tag) {
          const f = (S.hour - mn.justify.start) / (mn.justify.done - mn.justify.start);
          acts.push(`<div class="dip-act"><div>Savaş gerekçesi hazırlanıyor: ${Math.ceil((mn.justify.done - S.hour) / 24)} gün</div>
            <div class="bar"><div style="width:${f * 100}%"></div></div></div>`);
        } else if (!D.hasCB(me, tag)) {
          const busy = mn.justify ? `Şu an ${S.nations[mn.justify.target].name}'a karşı gerekçe hazırlanıyor.` : '';
          const ok = !mn.justify && !mn.overlord && !G.sameRealm(tag, me) && !D.allied(me, tag);
          btn('justify', `Savaş gerekçesi hazırla (${D.justifyDays(me, tag)} gün)`, ok,
            ok ? yesNo(true, n.religion !== mn.religion && D.isNeighbor(me, tag) ? 'Kutsal savaş: farklı dinden komşu, daha kısa sürer. İlişki −40.' : 'İlişki −40. Hedef ülke bunu öğrenir.')
              : yesNo(false, busy || (mn.overlord ? 'Vasallar savaş hazırlığı yapamaz.' : D.allied(me, tag) ? 'Müttefikimiz.' : 'Kendi diyarınız.')));
        } else acts.push('<div class="dip-act ok">✔ Savaş gerekçemiz hazır.</div>');
        const [ok, why] = D.canDeclare(me, tag);
        const helpers = D.defenders(tag).filter(t => !G.sameRealm(t, me));
        btn('war', 'Savaş ilan et', ok, yesNo(ok, ok ? (helpers.length ? `Yanında savaşa girecekler: ${helpers.map(t => S.nations[t].name).join(', ')}` : 'Yalnız kalacaklar.') : why), 'danger');
      }
    }

    const mods = D.modifiers(tag, me).map(([t, v]) => `<div class="mod"><span>${G.esc(t)}</span><b style="color:${v >= 0 ? '#9ad07a' : '#ff8a6a'}">${v > 0 ? '+' : ''}${v}</b></div>`).join('');
    const treaties = [];
    if (D.allied(me, tag)) treaties.push('🤝 Müttefikimiz');
    if (mn.guarantees.has(tag)) treaties.push('🛡 Bağımsızlığını garanti ediyoruz');
    if (n.guarantees.has(me)) treaties.push('🛡 Bağımsızlığımızı garanti ediyor');
    if (n.accessGranted.has(me)) treaties.push('➜ Bize geçiş hakkı veriyor');
    if (mn.accessGranted.has(tag)) treaties.push('← Onlara geçiş hakkı veriyoruz');
    if (mn.envoyTo.has(tag)) treaties.push('✉ Elçimiz sarayında');
    if (n.envoyTo.has(me)) treaties.push('✉ Elçisi sarayımızda');
    if (n.justify && n.justify.target === me) treaties.push('⚠ Bize karşı savaş gerekçesi hazırlıyor!');
    if (n.claims.has(me)) treaties.push('⚠ Bize karşı savaş gerekçesi var!');
    if ((mn.truces[tag] || 0) > S.hour) treaties.push(`☮ Ateşkes: ${Math.ceil((mn.truces[tag] - S.hour) / 24 / 30)} ay`);

    const pos = (op + 200) / 400 * 100;
    win.querySelector('.dip-body').innerHTML = `
      <div class="dip-head">
        ${G.portrait ? `<div class="dip-portrait" title="${G.esc(n.ruler)}">${G.portrait.ruler(tag)}</div>`
          : `<div class="dip-shield" style="--nc:${n.color}"><span>${G.esc(n.name.split(' ')[0].slice(0, 2).toUpperCase())}</span></div>`}
        <div class="dip-title">
          <h2>${G.esc(n.name)}</h2>
          <div class="muted">${n.major ? 'Büyük güç' : 'Küçük ülke'} · ${G.esc(n.ruler)} · ${G.RELIGIONS[n.religion].name} · ${G.GROUP_NAMES[n.group] || ''}</div>
        </div>
        <div class="dip-op" title="Bize karşı tutumları">
          <div class="muted">İlişki</div><b style="color:${opColor(op)}">${op > 0 ? '+' : ''}${op}</b>
        </div>
        <button class="dip-close">✕</button>
      </div>
      <div class="dip-cols">
        <div class="dip-col">
          <h3>Ülke</h3>
          <table>
            <tr><td>Başkent</td><td>${n.capital != null ? `<span class="link" data-prov="${n.capital}">${G.esc(S.provinces[n.capital].name)}</span>` : '—'}</td></tr>
            <tr><td>Eyaletler</td><td>${st.provs} (${st.cities} şehir)${st.occupied ? ` · ${st.occupied} işgalde` : ''}</td></tr>
            <tr><td>Ordular</td><td>${st.armies} · ${G.fmtNum(st.men)} asker</td></tr>
            <tr><td>İnsan gücü</td><td>${G.fmtNum(n.manpower)}</td></tr>
            <tr><td>Donanma</td><td>${fleets.length} filo · ${ships} gemi</td></tr>
            <tr><td>Odak</td><td>${focus ? G.esc(focus.name) : '<span class="muted">—</span>'}</td></tr>
            ${n.overlord ? `<tr><td>Efendisi</td><td>${list([n.overlord])}</td></tr>` : ''}
            <tr><td>Vasalları</td><td>${list(G.vassalsOf(tag))}</td></tr>
            <tr><td>Müttefikleri</td><td>${list(D.allies(tag))}</td></tr>
            <tr><td>Garantörleri</td><td>${list(D.guarantors(tag))}</td></tr>
            <tr><td>Savaşta</td><td>${list([...n.enemies])}</td></tr>
          </table>
        </div>
        <div class="dip-col">
          <h3>Bize karşı tutumu</h3>
          <div class="opbar"><div class="opmark" style="left:${pos}%"></div></div>
          <div class="opscale"><span>−200</span><span>0</span><span>+200</span></div>
          ${mods}
          <h3>Antlaşmalar</h3>
          ${treaties.length ? treaties.map(t => `<div class="treaty">${t}</div>`).join('') : '<div class="muted">Aramızda bir antlaşma yok.</div>'}
        </div>
        <div class="dip-col acts">
          <h3>Diplomatik eylemler</h3>
          ${acts.join('')}
        </div>
      </div>`;

    win.querySelector('.dip-close').onclick = U.closeDiplomacy;
    win.onclick = e => {
      const l = e.target.closest('[data-dip]');
      if (l) { U.showDiplomacy(l.dataset.dip); return; }
      const b = e.target.closest('button[data-act]');
      if (!b || b.disabled) return;
      U.dipAction(b.dataset.act, tag);
    };
  };

  U.dipAction = function (act, tag) {
    const S = G.S, me = S.player, mn = S.nations[me], n = S.nations[tag];
    const log = (t, c = 'info') => U.addLog(G.fmtDate(S.time, false), t, c);
    switch (act) {
      case 'envoy': D.sendEnvoy(me, tag); log(`${n.name} sarayına elçi gönderildi.`); break;
      case 'recall': D.recallEnvoy(me, tag); break;
      case 'ally': {
        const [ok, why] = D.acceptAlliance(tag, me);
        if (ok) D.ally(me, tag);
        else U.showEvent('İttifak reddedildi', `${n.name} teklifimizi geri çevirdi: ${why}`, [{ text: 'Anlaşıldı' }]);
        break;
      }
      case 'unally': D.breakAlliance(me, tag); break;
      case 'access': {
        const [ok, why] = D.acceptAccess(tag, me);
        if (ok) { n.accessGranted.add(me); log(`${n.name} ordularımıza geçiş hakkı verdi.`, 'good'); }
        else U.showEvent('Geçiş hakkı reddedildi', `${n.name}: ${why}`, [{ text: 'Anlaşıldı' }]);
        break;
      }
      case 'noaccess': n.accessGranted.delete(me); break;
      case 'grant': mn.accessGranted.add(tag); D.add(me, tag, 15); break;
      case 'revoke': mn.accessGranted.delete(tag); D.add(me, tag, -15); G.evacuateArmies(); break;
      case 'guarantee': mn.guarantees.add(tag); D.add(me, tag, 25); log(`${n.name}'ın bağımsızlığını garanti ettik.`, 'good'); break;
      case 'ungarantee': mn.guarantees.delete(tag); D.add(me, tag, -20); break;
      case 'justify': D.startJustify(me, tag); break;
      case 'war': {
        const err = D.declare(me, tag);
        if (err) log(err, 'war');
        break;
      }
      case 'peace_t':
      case 'peace_w': {
        const transfer = act === 'peace_t';
        if (G.ai.considerPeace(tag, me, transfer)) {
          G.makePeace(me, tag, transfer);
          U.showEvent('Barış imzalandı', `${n.name} barış teklifimizi kabul etti.`, [{ text: 'Mükemmel' }]);
        } else U.showEvent('Barış reddedildi', `${n.name} elçimizi geri çevirdi. Savaş sürüyor.`, [{ text: 'Öyle olsun' }]);
        break;
      }
    }
    U.refreshDiplomacy(); U.refreshTop(); G.mapDirty = true;
  };
})();
