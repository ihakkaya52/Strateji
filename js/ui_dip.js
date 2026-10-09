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

  const pips = (v, icon, label) => `<div class="dy-sk" title="${label}: ${v} / 6"><i>${icon}</i>${'<b></b>'.repeat(v)}${'<s></s>'.repeat(6 - v)}</div>`;
  const opWord = v => (v >= 100 ? 'Sadık dost' : v >= 50 ? 'Dostane' : v >= 10 ? 'Ilımlı' : v > -10 ? 'Tarafsız' : v > -50 ? 'Soğuk' : v > -100 ? 'Düşmanca' : 'Kan davası');
  U.rulerBlock = function (tag) {
    const S = G.S, n = S.nations[tag];
    if (!n.rulerSk) return '';
    const age = G.dyn.age(n), sk = n.rulerSk;
    const heir = n.heir ? `${G.esc(n.heir.name)} <span class="muted">(${S.time.y - n.heir.born} yaşında)</span>` : '<span class="bad">Varis yok!</span>';
    return `<div class="dy-block">
      <div class="dy-row"><span class="dy-k">Hükümdar</span><b>${G.esc(n.ruler)}</b><span class="muted">${age} yaşında${n.regency > S.hour ? ' · naiplik' : ''}</span></div>
      <div class="dy-skills">${pips(sk.adm, '⚖', 'Yönetim')}${pips(sk.dip, '🕊', 'Diplomasi')}${pips(sk.mil, '⚔', 'Askerlik')}</div>
      <div class="dy-row"><span class="dy-k">Hanedan</span><span>${G.esc(n.dynasty || '—')}</span></div>
      <div class="dy-row"><span class="dy-k">Veliaht</span><span>${heir}</span></div>
      ${n.marriages && n.marriages.size ? `<div class="dy-row"><span class="dy-k">Akrabalar</span><span>${[...n.marriages].filter(t => S.nations[t]).map(t => `<span class="link" data-dip="${t}">${U.flag(t)} ${G.esc(S.nations[t].name)}</span>`).join(', ')}</span></div>` : ''}
    </div>`;
  };

  U.refreshDiplomacy = function () {
    const win = $('dipwin');
    if (win.classList.contains('hidden') || !U.dipTag) return;
    const body = win.querySelector('.dip-body');
    const scroll = body.scrollTop;
    const S = G.S, me = S.player, mn = S.nations[me], tag = U.dipTag, n = S.nations[tag];
    const st = G.nationStats(tag);
    const op = Math.round(D.opinion(tag, me));
    const fleets = G.navy.fleetsOf(tag);
    const ships = fleets.reduce((t, f) => t + f.ships.length, 0);
    const focus = n.focus.cur ? G.focus.get(tag, n.focus.cur) : null;
    const list = arr => arr.length ? arr.map(t => `<span class="link" data-dip="${t}">${U.flag(t)} ${G.esc(S.nations[t].name)}</span>`).join(', ') : '<span class="muted">—</span>';

    // ---- eylemler: kısa düğmeler, sebep altında küçük yazı
    const acts = [];
    const btn = (id, icon, label, ok, why, cls = '') => acts.push({ id, icon, label, ok, why, cls });
    const extra = [];
    if (n.alive) {
      if (mn.envoyTo.has(tag)) btn('recall', '✉', 'Elçiyi çağır', true, `Elçi ilişkiyi günde +${(D.ENVOY_GAIN * G.rulerMod(me, 'dip')).toFixed(2)} geliştiriyor.`);
      else {
        const free = mn.envoys - mn.envoyTo.size;
        btn('envoy', '✉', 'Elçi gönder', free > 0 && !mn.enemies.has(tag), mn.enemies.has(tag) ? 'Savaştayken elçi gönderilemez.' : `Boştaki elçiler: ${free} / ${mn.envoys}`);
      }
      if (D.allied(me, tag)) btn('unally', '✂', 'İttifakı boz', true, 'İlişki ciddi şekilde bozulur.', 'danger');
      else { const [ok, why] = D.acceptAlliance(tag, me); btn('ally', '🤝', 'İttifak teklif et', ok && !mn.overlord, mn.overlord ? 'Vasallar ittifak kuramaz.' : why); }
      if (mn.marriages && mn.marriages.has(tag)) btn('nomarry', '💍', 'Akrabalık sürüyor', false, 'Hanedanlarımız evlilikle bağlı.');
      else { const [ok, why] = G.dyn.canMarry(me, tag); btn('marry', '💍', 'Hanedan evliliği', ok, why); }
      if (n.accessGranted.has(me)) btn('noaccess', '➜', 'Geçiş hakkını bırak', true, 'Ordularımız onların topraklarından geçebiliyor.');
      else { const [ok, why] = D.acceptAccess(tag, me); btn('access', '➜', 'Geçiş hakkı iste', ok, why); }
      if (mn.accessGranted.has(tag)) btn('revoke', '⛔', 'Geçişi geri al', true, 'Onların orduları topraklarımızdan geçebiliyor.');
      else btn('grant', '↩', 'Geçiş hakkı ver', !mn.enemies.has(tag), 'Orduları topraklarımızdan geçebilir. İlişki +15.');
      if (mn.guarantees.has(tag)) btn('ungarantee', '🛡', 'Garantiyi kaldır', true, 'Saldırıya uğrarlarsa artık yardıma gitmeyiz.');
      else btn('guarantee', '🛡', 'Bağımsızlığını garanti et', !mn.enemies.has(tag) && !G.sameRealm(tag, me) && !mn.overlord, 'Saldırıya uğrarlarsa yanlarında savaşırız. İlişki +25.');
      if (mn.enemies.has(tag)) {
        const w = G.findWar(me, tag), ws = G.warScore(me, tag);
        const leader = w && (w.a === me || w.b === me);
        const can = leader && !mn.overlord;
        extra.push(`<div class="dip-war"><div>Savaş skoru <b style="color:${ws >= 0 ? '#9ad07a' : '#ff8a6a'}">${ws > 0 ? '+' : ''}${ws}</b></div>
          ${w ? `<div class="muted small">${list([...(w.att.has(me) ? w.att : w.def)])} ⚔ ${list([...(w.att.has(me) ? w.def : w.att)])}</div>` : ''}</div>`);
        btn('peace_table', '☮', 'Barış masası', can, can ? 'Hangi illeri alacağınızı seçin; vasallık ve tazminat isteyin.' : 'Barışa koalisyonun lideri karar verir.', 'good wide');
      } else {
        if (mn.justify && mn.justify.target === tag) {
          const f = (S.hour - mn.justify.start) / (mn.justify.done - mn.justify.start);
          extra.push(`<div class="dip-war"><div>Savaş gerekçesi hazırlanıyor: ${Math.ceil((mn.justify.done - S.hour) / 24)} gün</div><div class="bar"><div style="width:${f * 100}%"></div></div></div>`);
        } else if (!D.hasCB(me, tag)) {
          const busy = mn.justify ? `Şu an ${S.nations[mn.justify.target].name}'a karşı gerekçe hazırlanıyor.` : '';
          const ok = !mn.justify && !mn.overlord && !G.sameRealm(tag, me) && !D.allied(me, tag);
          btn('justify', '📜', `Savaş gerekçesi (${D.justifyDays(me, tag)} gün)`, ok,
            ok ? (n.religion !== mn.religion && D.isNeighbor(me, tag) ? 'Kutsal savaş: daha kısa sürer. İlişki −40.' : 'İlişki −40. Hedef ülke bunu öğrenir.')
              : busy || (mn.overlord ? 'Vasallar savaş hazırlığı yapamaz.' : D.allied(me, tag) ? 'Müttefikimiz.' : 'Kendi diyarınız.'));
        } else extra.push('<div class="dip-war ok">✔ Savaş gerekçemiz hazır.</div>');
        const [ok, why] = D.canDeclare(me, tag);
        const helpers = D.defenders(tag).filter(t => !G.sameRealm(t, me));
        btn('war', '⚔', 'Savaş ilan et', ok, ok ? (helpers.length ? `Yanında savaşacaklar: ${helpers.map(t => S.nations[t].name).join(', ')}` : 'Yalnız kalacaklar.') : why, 'danger wide');
      }
    }

    const mods = D.modifiers(tag, me).map(([t, v]) => `<span class="dip-chip ${v >= 0 ? 'pos' : 'neg'}">${G.esc(t)} <b>${v > 0 ? '+' : ''}${v}</b></span>`).join('');
    const treaties = [];
    if (D.allied(me, tag)) treaties.push('🤝 Müttefikimiz');
    if (mn.marriages && mn.marriages.has(tag)) treaties.push('💍 Hanedan akrabamız');
    if (mn.guarantees.has(tag)) treaties.push('🛡 Onları koruyoruz');
    if (n.guarantees.has(me)) treaties.push('🛡 Bizi koruyor');
    if (n.accessGranted.has(me)) treaties.push('➜ Bize geçiş hakkı');
    if (mn.accessGranted.has(tag)) treaties.push('← Onlara geçiş hakkı');
    if (mn.envoyTo.has(tag)) treaties.push('✉ Elçimiz orada');
    if (n.envoyTo.has(me)) treaties.push('✉ Elçisi bizde');
    if (n.justify && n.justify.target === me) treaties.push('<span class="bad">⚠ Bize karşı gerekçe hazırlıyor</span>');
    if (n.claims.has(me)) treaties.push('<span class="bad">⚠ Bize karşı savaş gerekçesi var</span>');
    if (mn.enemies.has(tag)) treaties.push('<span class="bad">⚔ Savaştayız</span>');
    if ((mn.truces[tag] || 0) > S.hour) treaties.push(`☮ Ateşkes: ${Math.ceil((mn.truces[tag] - S.hour) / 24 / 30)} ay`);

    const pos = (op + 200) / 400 * 100;
    body.innerHTML = `
      <div class="dip-head" style="--nc:${n.color}">
        ${G.portrait ? `<div class="dip-portrait" title="${G.esc(n.ruler)}">${G.portrait.ruler(tag)}</div>` : ''}
        <div class="dip-title">
          <h2>${G.esc(n.name)}</h2>
          <div class="dip-sub">${n.major ? 'Büyük güç' : n.rebel ? 'İsyancılar' : 'Küçük ülke'} · ${G.RELIGIONS[n.religion] ? G.RELIGIONS[n.religion].name : ''} · ${G.GROUP_NAMES[n.group] || ''}</div>
          <div class="dip-sub">${G.esc(n.ruler)}${n.rulerBorn != null ? `, ${G.dyn.age(n)} yaşında` : ''}</div>
        </div>
        <button class="dip-close" title="Kapat (Esc)">✕</button>
      </div>
      <div class="dip-rel">
        <div class="dip-relnum" style="color:${opColor(op)}">${op > 0 ? '+' : ''}${op}<small>${opWord(op)}</small></div>
        <div class="dip-relbar"><div class="opbar"><div class="opmark" style="left:${pos}%"></div></div>
          <div class="opscale"><span>−200</span><span>Bize karşı tutumu</span><span>+200</span></div></div>
      </div>
      <div class="dip-chips">${mods}</div>
      ${treaties.length ? `<div class="dip-treaties">${treaties.map(t => `<span>${t}</span>`).join('')}</div>` : ''}
      ${extra.join('')}
      <h3>Diplomatik eylemler</h3>
      <div class="dip-acts">${n.alive ? acts.map(a => `<button data-act="${a.id}" class="${a.cls}" ${a.ok ? '' : 'disabled'} title="${G.esc(a.why)}">
          <i>${a.icon}</i><span>${G.esc(a.label)}</span><small class="${a.ok ? '' : 'no'}">${G.esc(a.why)}</small></button>`).join('') : '<p class="muted">Bu ülke tarih sahnesinden silindi.</p>'}</div>
      <h3>Hükümdar ve hanedan</h3>
      ${U.rulerBlock(tag)}
      <h3>Ülke</h3>
      <table class="dip-info">
        <tr><td>Başkent</td><td>${n.capital != null ? `<span class="link" data-prov="${n.capital}">${G.esc(S.provinces[n.capital].name)}</span>` : '—'}</td></tr>
        <tr><td>İller</td><td>${st.provs} (${st.cities} şehir)${st.occupied ? ` · <span class="bad">${st.occupied} işgalde</span>` : ''}</td></tr>
        <tr><td>Ordu</td><td>${st.armies} ordu · ${G.fmtNum(st.men)} asker · ♟ ${G.fmtNum(n.manpower)}</td></tr>
        <tr><td>Donanma</td><td>${fleets.length} filo · ${ships} gemi</td></tr>
        <tr><td>İstikrar</td><td>${Math.round(n.stability ?? 60)} / 100</td></tr>
        <tr><td>Odak</td><td>${focus ? G.esc(focus.name) : '<span class="muted">—</span>'}</td></tr>
        ${n.overlord ? `<tr><td>Efendisi</td><td>${list([n.overlord])}</td></tr>` : ''}
        <tr><td>Vasalları</td><td>${list(G.vassalsOf(tag))}</td></tr>
        <tr><td>Müttefikleri</td><td>${list(D.allies(tag))}</td></tr>
        <tr><td>Garantörleri</td><td>${list(D.guarantors(tag))}</td></tr>
        <tr><td>Savaşta</td><td>${list([...n.enemies])}</td></tr>
      </table>`;
    body.scrollTop = scroll;

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
      case 'peace_table': U.showPeace(tag); return;
      case 'marry': {
        const [ok, why] = G.dyn.canMarry(me, tag);
        if (ok) { G.dyn.marry(me, tag); U.showEvent('Hanedan Evliliği', `${n.name} sarayıyla evlilik bağı kuruldu. Artık akrabayız; varissiz kalırsak tahtımız akrabalarımıza geçebilir, onlarınki de bize.`, [{ text: 'Mutluluklar dileriz' }]); }
        else log(why, 'war');
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
