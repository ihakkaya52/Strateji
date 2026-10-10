// İttifaklar (faction): adı olan, bir lideri ve birden çok üyesi olan savunma birlikleri.
// Üyeler birbirinin müttefiki sayılır: biri saldırıya uğrarsa hepsi savaşa girer; liderin açtığı savaşa üyeler katılır.
'use strict';

G.faction = {};
(function () {
  const F = G.faction, D = G.dip;
  F.MAX = 8;          // bir ittifakta en fazla üye
  const YEAR = 24 * 365;

  F.list = () => (G.S.factions ||= []).filter(f => f.members.size);
  F.of = tag => F.list().find(f => f.members.has(tag)) || null;
  F.power = f => [...f.members].reduce((s, t) => s + D.power(t), 0);
  const nm = t => (G.S.nations[t] ? G.S.nations[t].name : t);

  // ------------------------------------------------------------ ittifak = karşılıklı müttefiklik
  const baseAllies = D.allies, baseAllied = D.allied, baseAccess = D.hasAccess;
  D.allies = tag => {
    const f = F.of(tag), out = new Set(baseAllies(tag));
    if (f) for (const t of f.members) if (t !== tag && G.S.nations[t] && G.S.nations[t].alive) out.add(t);
    return [...out];
  };
  D.allied = (a, b) => baseAllied(a, b) || (a !== b && !!F.of(a) && F.of(a) === F.of(b));
  D.hasAccess = (tag, ctrl) => baseAccess(tag, ctrl) || (!!F.of(tag) && F.of(tag) === F.of(ctrl));

  // liderin açtığı savaşa üyeler katılır
  const baseDeclare = G.declareWar;
  G.declareWar = function (a, b, silent) {
    baseDeclare(a, b, silent);
    const f = F.of(a), war = G.findWar(a, b);
    if (!f || f.leader !== a || !war) return;
    for (const t of f.members) {
      if (t === a || war.att.has(t) || war.def.has(t) || G.sameRealm(t, b)) continue;
      const n = G.S.nations[t];
      if (!n || !n.alive || (n.truces[b] || 0) > G.S.hour) continue;
      G.joinWar(war, t, true);
    }
  };

  // ------------------------------------------------------------ kurma, davet, ayrılma
  F.canCreate = function (tag) {
    const n = G.S.nations[tag];
    if (F.of(tag)) return [false, 'Zaten bir ittifaktayız.'];
    if (n.overlord) return [false, 'Vasallar ittifak kuramaz; efendimizin diyarındayız.'];
    return [true, ''];
  };
  F.create = function (tag, name) {
    if (!F.canCreate(tag)[0]) return null;
    const S = G.S;
    S.nextFactionId = (S.nextFactionId || 0) + 1;
    const f = { id: S.nextFactionId, name: (name || '').trim() || `${S.nations[tag].name} İttifakı`, leader: tag, members: new Set([tag]), since: S.hour };
    (S.factions ||= []).push(f);
    G.log(`${f.name} kuruldu (lider: ${nm(tag)}).`, 'info', [tag]);
    return f;
  };
  // t ittifaka katılmayı kabul eder mi? [evet, sebep]
  F.accepts = function (t, f) {
    const S = G.S, n = S.nations[t], L = S.nations[f.leader];
    if (!n || !n.alive) return [false, 'Bu ülke yok.'];
    if (f.members.has(t)) return [false, 'Zaten üye.'];
    if (F.of(t)) return [false, `${F.of(t).name} üyesi.`];
    if (n.overlord) return [false, `${nm(n.overlord)} vasalı; efendisinin diyarında.`];
    if (f.members.size >= F.MAX) return [false, `İttifak dolu (en fazla ${F.MAX} üye).`];
    if ([...f.members].some(m => G.atWar(m, t))) return [false, 'Üyelerden biriyle savaşta.'];
    const op = D.opinion(t, f.leader);
    let score = op;
    const why = [];
    if (op < 10) return [false, `İlişki yetersiz (${Math.round(op)} / 10).`];
    if (G.rel.sameFamily(n.religion, L.religion)) { score += 15; why.push('aynı din'); } else { score -= 30; why.push('başka din'); }
    // ortak tehdit: t'nin komşusu, t'den çok güçlü, t'ye düşmanca (başka dinden ya da ilişkisi kötü) ve üyelerden birine de komşu
    const nbs = G.ai.neighbors(), mine = D.power(t);
    const hostile = x => !G.rel.sameFamily(S.nations[x].religion, n.religion) || D.opinion(t, x) < -20;
    const threat = [...(nbs[t] || [])].some(x => S.nations[x] && !f.members.has(x) && D.power(x) > mine * 1.5 && hostile(x) && [...f.members].some(m => (nbs[m] || new Set()).has(x)));
    if (threat) { score += 20; why.push('ortak tehdit'); }
    if (F.power(f) > mine * 2) { score += 8; why.push('güçlü bir birlik'); }
    if (n.major) { score -= 20; why.push('büyük güç bağımsız kalmak ister'); }
    if (f.members.size > 3) { score -= (f.members.size - 3) * 6; why.push('kalabalık birlik'); }
    if (D.allied(t, f.leader)) score += 15;
    const ok = score >= 50;
    return [ok, `${ok ? 'Kabul ederler' : 'Reddederler'} (${Math.round(score)} / 50 · ${why.join(', ') || 'ilişki'}).`];
  };
  F.join = function (f, t) {
    if (f.members.has(t)) return;
    f.members.add(t);
    for (const m of f.members) if (m !== t) D.add(m, t, 20);
    G.log(`${nm(t)}, ${f.name}'na katıldı.`, 'good', [t, f.leader]);
  };
  F.invite = function (f, t) {
    const [ok] = F.accepts(t, f);
    if (ok) F.join(f, t);
    else D.add(f.leader, t, -5);
    return ok;
  };
  // oyuncunun bir yapay zekâ ittifakına katılma isteği: lider de aynı ölçüyle bakar
  F.request = function (tag, f) { return F.invite(f, tag); };
  F.leave = function (tag) {
    const f = F.of(tag);
    if (!f) return;
    f.members.delete(tag);
    for (const m of f.members) D.add(m, tag, -30);
    if (f.leader === tag && f.members.size) f.leader = [...f.members].sort((a, b) => D.power(b) - D.power(a))[0];
    G.log(`${nm(tag)}, ${f.name}'ndan ayrıldı.`, 'war', [tag]);
    F.cleanup();
  };
  F.kick = function (f, t) {
    if (!f.members.has(t) || t === f.leader) return;
    f.members.delete(t);
    D.add(f.leader, t, -40);
    G.log(`${nm(t)} ${f.name}'ndan çıkarıldı.`, 'war', [t, f.leader]);
    F.cleanup();
  };
  F.rename = (f, name) => { if (name && name.trim()) f.name = name.trim().slice(0, 40); };
  F.cleanup = function () {
    const S = G.S;
    for (const f of S.factions || []) {
      for (const t of [...f.members]) if (!S.nations[t] || !S.nations[t].alive || S.nations[t].overlord) f.members.delete(t);
      if (!f.members.has(f.leader) && f.members.size) f.leader = [...f.members][0];
    }
    S.factions = (S.factions || []).filter(f => f.members.size >= 2 || (f.members.size === 1 && S.hour - f.since < YEAR));
  };

  // savaşa çağırma: üye, liderin ya da bir üyenin savaşına katılır
  F.canCall = function (tag, t) {
    const f = F.of(tag), war = (G.S.wars || []).find(w => w.att.has(tag) || w.def.has(tag));
    if (!f || !f.members.has(t)) return [false, 'İttifak üyesi değil.'];
    if (!war) return [false, 'Savaşta değiliz.'];
    if (war.att.has(t) || war.def.has(t)) return [false, 'Zaten savaşta yanımızda.'];
    const foes = war.att.has(tag) ? war.def : war.att;
    if ([...foes].some(x => G.sameRealm(x, t))) return [false, 'Düşmanla aynı diyarda.'];
    const op = D.opinion(t, tag);
    return op >= 20 ? [true, 'Çağrıya uyarlar.'] : [false, `İlişki yetersiz (${Math.round(op)} / 20).`];
  };
  F.callToArms = function (tag, t) {
    const [ok] = F.canCall(tag, t);
    const war = (G.S.wars || []).find(w => w.att.has(tag) || w.def.has(tag));
    if (!ok || !war) { D.add(t, tag, -5); return false; }
    G.joinWar(war, t, war.att.has(tag));
    G.log(`${nm(t)}, ${nm(tag)}'ın çağrısıyla savaşa katıldı.`, 'good', [t, tag]);
    return true;
  };

  // ------------------------------------------------------------ yapay zekâ
  F.monthly = function () {
    const S = G.S;
    F.cleanup();
    // birbirine savaş açan üyeler ittifaktan düşer
    for (const f of F.list()) for (const t of [...f.members]) if ([...f.members].some(m => m !== t && G.atWar(m, t))) f.members.delete(t);
    if (G.rng() > 0.25) return;
    const nbs = G.ai.neighbors();
    for (const n of Object.values(S.nations)) {
      if (!n.alive || n.tag === S.player || n.overlord) continue;
      const f = F.of(n.tag);
      if (!f && n.major && G.rng() < 0.02) {
        // büyük güç, kendine yakın komşularla bir birlik kurar
        const cands = [...(nbs[n.tag] || [])].filter(t => S.nations[t] && S.nations[t].alive && t !== S.player && !F.of(t) && !S.nations[t].overlord);
        const nf = F.create(n.tag);
        if (!nf) continue;
        for (const t of cands.sort((a, b) => D.opinion(b, n.tag) - D.opinion(a, n.tag)).slice(0, 4)) F.invite(nf, t);
        if (nf.members.size < 2) { S.factions = S.factions.filter(x => x !== nf); continue; }
      } else if (f && f.leader === n.tag && f.members.size < 5 && G.rng() < 0.05) {
        const cands = [...(nbs[n.tag] || [])].filter(t => t !== S.player && !F.of(t));
        for (const t of cands) if (F.accepts(t, f)[0]) { F.join(f, t); break; }
      }
    }
  };
  const baseDip = D.monthly;
  D.monthly = function () { baseDip(); F.monthly(); };
})();
