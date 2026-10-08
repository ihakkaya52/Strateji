// Diplomasi: ilişkiler, elçiler, ittifaklar, garantiler, geçiş hakkı ve savaş gerekçeleri
'use strict';

G.dip = {};
const D = G.dip;

D.JUSTIFY_DAYS = 45;          // savaş gerekçesi hazırlama süresi
D.JUSTIFY_DAYS_HOLY = 25;     // farklı dinden komşuya karşı (kutsal savaş)
D.ENVOY_GAIN = 0.35;          // elçi başına günlük ilişki artışı
D.ENVOY_CAP = 90;

const key = (a, b) => (a < b ? a + '|' + b : b + '|' + a);

// ------------------------------------------------------------ ilişkiler
D.base = (a, b) => {
  const S = G.S, na = S.nations[a], nb = S.nations[b];
  if (!na || !nb) return 0;
  let v = na.religion === nb.religion ? 15 : -15;
  if (na.group === nb.group) v += 10;
  return v;
};
D.raw = (a, b) => G.S.rel.get(key(a, b)) || 0;
D.opinion = (a, b) => (a === b ? 200 : G.clamp(D.base(a, b) + D.raw(a, b), -200, 200));
D.add = (a, b, v) => {
  const k = key(a, b);
  G.S.rel.set(k, G.clamp((G.S.rel.get(k) || 0) + v, -220, 220));
};

D.modifiers = function (a, b) {
  const S = G.S, na = S.nations[a], nb = S.nations[b], out = [];
  out.push([na.religion === nb.religion ? 'Aynı din' : 'Farklı din', na.religion === nb.religion ? 15 : -15]);
  if (na.group === nb.group) out.push(['Aynı kültür grubu', 10]);
  const r = Math.round(D.raw(a, b));
  if (r) out.push(['Diplomatik geçmiş (elçiler, savaşlar, antlaşmalar)', r]);
  return out;
};

// ------------------------------------------------------------ antlaşmalar
D.allies = tag => [...(G.S.nations[tag].allies || [])].filter(t => G.S.nations[t] && G.S.nations[t].alive);
D.allied = (a, b) => !!(G.S.nations[a] && G.S.nations[a].allies.has(b));
D.guarantors = tag => Object.values(G.S.nations).filter(n => n.alive && n.guarantees.has(tag)).map(n => n.tag);
// Bir ülke saldırıya uğrarsa yanında savaşa girenler
D.defenders = tag => [...new Set([...D.allies(tag), ...D.guarantors(tag)])];
D.hasAccess = (tag, ctrl) => {
  const n = G.S.nations[ctrl];
  if (!n || !tag) return false;
  return n.accessGranted.has(tag) || n.allies.has(tag);
};

D.ally = function (a, b) {
  const S = G.S;
  S.nations[a].allies.add(b); S.nations[b].allies.add(a);
  D.add(a, b, 30);
  G.log(`${S.nations[a].name} ile ${S.nations[b].name} ittifak kurdu.`, 'info', [a, b]);
  G.labelsDirty = true;
};
D.breakAlliance = function (a, b) {
  const S = G.S;
  S.nations[a].allies.delete(b); S.nations[b].allies.delete(a);
  D.add(a, b, -60);
  G.log(`${S.nations[a].name}, ${S.nations[b].name} ile ittifakını bozdu.`, 'war', [a, b]);
};

// ------------------------------------------------------------ savaş gerekçesi
D.isNeighbor = function (a, b) {
  const P = G.S.provinces;
  for (const p of P) {
    if (p.owner !== a) continue;
    for (const n of p.nb) if (P[n].owner === b) return true;
  }
  return false;
};
D.justifyDays = (a, b) => {
  const S = G.S;
  return S.nations[a].religion !== S.nations[b].religion && D.isNeighbor(a, b) ? D.JUSTIFY_DAYS_HOLY : D.JUSTIFY_DAYS;
};
D.hasCB = (a, b) => G.S.nations[a].claims.has(b);

// Savaş ilan edilebilir mi? [evet/hayır, sebep]
D.canDeclare = function (a, b) {
  const S = G.S, na = S.nations[a], nb = S.nations[b];
  if (!nb || !nb.alive) return [false, 'Bu ülke artık yok.'];
  if (na.overlord) return [false, 'Vasallar kendi başına savaş ilan edemez.'];
  if (G.sameRealm(a, b)) return [false, 'Kendi diyarınıza savaş açamazsınız.'];
  if (na.enemies.has(b)) return [false, 'Zaten savaştasınız.'];
  if ((na.truces[b] || 0) > S.hour) return [false, `Ateşkes sürüyor (${Math.ceil((na.truces[b] - S.hour) / 24 / 30)} ay).`];
  if (D.allied(a, b)) return [false, 'Müttefikinize savaş açamazsınız. Önce ittifakı bozun.'];
  if (!D.hasCB(a, b)) return [false, 'Savaş gerekçeniz yok. Önce bir gerekçe hazırlayın.'];
  return [true, ''];
};

D.startJustify = function (a, b) {
  const S = G.S, na = S.nations[a];
  if (na.justify || D.hasCB(a, b) || na.overlord) return false;
  na.justify = { target: b, done: S.hour + D.justifyDays(a, b) * 24, start: S.hour };
  D.add(a, b, -40);
  G.log(`${na.name}, ${S.nations[b].name}'a karşı savaş gerekçesi hazırlıyor.`, 'war', [a, b]);
  return true;
};

D.declare = function (a, b) {
  const [ok, why] = D.canDeclare(a, b);
  if (!ok) return why;
  G.S.nations[a].claims.delete(b);
  G.declareWar(a, b);
  return null;
};

// Savaş ilanının ilişkilere etkisi
D.onWar = function (a, b, A, B) {
  D.add(a, b, -100);
  for (const t of B) if (t !== b) D.add(a, t, -30);
  for (const t of A) if (t !== a) D.add(t, b, -30);
};

// ------------------------------------------------------------ elçiler
D.sendEnvoy = function (a, b) {
  const n = G.S.nations[a];
  if (n.envoyTo.has(b) || n.envoyTo.size >= n.envoys) return false;
  n.envoyTo.add(b);
  return true;
};
D.recallEnvoy = (a, b) => G.S.nations[a].envoyTo.delete(b);

// ------------------------------------------------------------ yapay zekânın cevapları  [kabul, sebep]
D.power = tag => G.realm(tag).reduce((s, t) => s + G.nationStats(t).men + G.S.nations[t].manpower * 0.3, 0);

D.acceptAlliance = function (ai, from) {
  const op = D.opinion(ai, from);
  if (G.S.nations[ai].enemies.has(from)) return [false, 'Savaştayız.'];
  if (op < 50) return [false, `İlişki yetersiz (${Math.round(op)} / 50 gerekli).`];
  if (D.power(from) < D.power(ai) * 0.3) return [false, 'Sizi işe yarar bir müttefik olarak görmüyorlar.'];
  return [true, 'Kabul ederler.'];
};
D.acceptAccess = function (ai, from) {
  const op = D.opinion(ai, from);
  if (G.S.nations[ai].enemies.has(from)) return [false, 'Savaştayız.'];
  if (op < 20) return [false, `İlişki yetersiz (${Math.round(op)} / 20 gerekli).`];
  return [true, 'Kabul ederler.'];
};

// ------------------------------------------------------------ zamanlayıcılar
D.daily = function () {
  const S = G.S;
  for (const n of Object.values(S.nations)) {
    if (!n.alive) continue;
    for (const t of [...n.envoyTo]) {
      const nt = S.nations[t];
      if (!nt || !nt.alive || n.enemies.has(t)) { n.envoyTo.delete(t); continue; }
      if (D.raw(n.tag, t) < D.ENVOY_CAP) D.add(n.tag, t, D.ENVOY_GAIN);
    }
    if (n.justify && n.justify.done <= S.hour) {
      const t = n.justify.target;
      n.justify = null;
      if (S.nations[t] && S.nations[t].alive) {
        n.claims.add(t);
        if (n.tag === S.player) G.ui.notify(`${S.nations[t].name}'a karşı savaş gerekçemiz hazır. Artık savaş ilan edebiliriz.`);
        else G.log(`${n.name}, ${S.nations[t].name}'a karşı savaş gerekçesi kazandı.`, 'war', [n.tag, t]);
      }
    }
  }
};

D.monthly = function () {
  const S = G.S;
  // eski olaylar zamanla unutulur
  for (const [k, v] of S.rel) {
    const nv = v * 0.985;
    if (Math.abs(nv) < 0.5) S.rel.delete(k); else S.rel.set(k, nv);
  }
  // antlaşmaların bozulması: savaşa girilen ülkelerle ittifak / garanti / geçiş kalkar
  for (const n of Object.values(S.nations)) {
    if (!n.alive) continue;
    for (const t of [...n.allies]) if (!S.nations[t].alive || n.enemies.has(t)) n.allies.delete(t);
    for (const t of [...n.guarantees]) if (!S.nations[t].alive || n.enemies.has(t)) n.guarantees.delete(t);
    for (const t of [...n.accessGranted]) if (!S.nations[t].alive || n.enemies.has(t)) n.accessGranted.delete(t);
    for (const t of [...n.claims]) if (!S.nations[t] || !S.nations[t].alive) n.claims.delete(t);
  }
  D.aiMonthly();
};

// Yapay zekâ: elçi, ittifak, garanti ve savaş planı
D.aiMonthly = function () {
  const S = G.S;
  const nbs = G.ai.neighbors();
  for (const n of Object.values(S.nations)) {
    if (!n.alive || n.tag === S.player) continue;
    const near = [...(nbs[n.tag] || [])].filter(t => S.nations[t] && S.nations[t].alive && !G.sameRealm(t, n.tag));
    // elçiler: aynı dindeki ya da güçlü komşularla ilişki kur
    if (n.envoyTo.size < n.envoys && near.length) {
      const cand = near.filter(t => !n.envoyTo.has(t) && !n.enemies.has(t) && !(n.justify && n.justify.target === t))
        .sort((x, y) => (D.opinion(n.tag, y) + D.power(y) / 3000) - (D.opinion(n.tag, x) + D.power(x) / 3000));
      if (cand.length) D.sendEnvoy(n.tag, cand[0]);
    }
    // ittifak: yalnızca ortak bir tehdit varsa (ikisinin de komşusu olan daha güçlü bir ülke)
    if (n.allies.size < (n.major ? 2 : 1) && G.rng() < 0.05) {
      const myPow = D.power(n.tag);
      const threats = near.filter(t => D.power(t) > myPow * 1.5 && !n.allies.has(t));
      for (const t of near) {
        if (n.allies.has(t) || t === S.player || n.enemies.has(t)) continue;
        if (S.nations[t].allies.size >= (S.nations[t].major ? 2 : 1)) continue;
        const shared = threats.some(x => x !== t && (nbs[t] || new Set()).has(x));
        if (!shared) continue;
        if (D.acceptAlliance(t, n.tag)[0] && D.acceptAlliance(n.tag, t)[0]) { D.ally(n.tag, t); break; }
      }
    }
    // garanti: büyük güçler, aynı dindeki küçük komşuları korur
    if (n.major && n.guarantees.size < 3 && G.rng() < 0.1) {
      const small = near.filter(t => !S.nations[t].major && S.nations[t].religion === n.religion &&
        D.opinion(n.tag, t) > 30 && !n.guarantees.has(t));
      if (small.length) {
        n.guarantees.add(small[0]);
        D.add(n.tag, small[0], 25);
        G.log(`${n.name}, ${S.nations[small[0]].name}'ın bağımsızlığını garanti etti.`, 'info', [n.tag, small[0]]);
      }
    }
    // geçiş hakkı: müttefik olmayan ama dost komşulara
    if (G.rng() < 0.05) {
      for (const t of near) if (t !== S.player && !n.accessGranted.has(t) && D.opinion(n.tag, t) > 60) { n.accessGranted.add(t); break; }
    }
  }
};
