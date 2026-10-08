// Savaş: kayıplar, ikmal ve kuşatılmış (cep) ordular, bozgun yolları, savaş geçmişi, teslimiyet teklifleri
'use strict';

G.war = {};
const WF = G.war;

WF.ENCIRCLED_LOSS = 0.03;     // kuşatılmış ordunun günlük kaybı (açlık, salgın, firar)
WF.ENCIRCLED_DAYS = 45;       // bu kadar gün kuşatılmış kalan ordu teslim olur
WF.HIST_MAX = 240;            // savaş grafiğindeki en fazla nokta
WF.trapped = [];
WF.reach = {};                // ülke -> ikmal ağına bağlı eyaletler

// ------------------------------------------------------------ kayıplar
// Bir ülkenin kaybını, ilgili savaşın kayıt defterine işler
WF.record = function (tag, amount, byTag) {
  const S = G.S, n = S.nations[tag];
  if (!n || !(amount > 0)) return;
  n.dead = (n.dead || 0) + amount;
  let w = byTag ? G.findWar(tag, byTag) : null;
  if (!w) w = (S.wars || []).find(x => x.att.has(tag) || x.def.has(tag));
  if (!w) return;
  w.cas ||= {};
  w.cas[tag] = (w.cas[tag] || 0) + amount;
};

// Ordudan asker öldürür ve kaydeder
WF.kill = function (a, amount, byTag) {
  amount = Math.min(a.men, Math.max(0, amount));
  if (!amount) return;
  a.men -= amount;
  WF.record(a.tag, amount, byTag);
};

// Savaştaki iki tarafın kayıpları
WF.sideCas = (w, side) => [...side].reduce((s, t) => s + ((w.cas || {})[t] || 0), 0);

// ------------------------------------------------------------ ikmal ve kuşatma
// Ordu bu eyalette dost topraktadır (kendi diyarı, geçiş hakkı ya da savaştaki müttefik)
WF.friendly = (tag, p) => p.kind !== 'waste' && p.ctrl != null && !G.atWar(tag, p.ctrl) && G.canEnter(tag, p);

// Başkentten dost topraklar üzerinden ulaşılabilen eyaletler
WF.supplyNet = function (tag) {
  const S = G.S, P = S.provinces, n = S.nations[tag];
  const seen = new Set(), q = [];
  const cap = n.capital != null ? P[n.capital] : null;
  if (cap && WF.friendly(tag, cap)) { seen.add(cap.id); q.push(cap.id); }
  else {
    // başkent düştüyse elde kalan her kendi eyaleti ikmal kaynağıdır
    for (const p of P) if (p.owner === tag && p.ctrl === tag) { seen.add(p.id); q.push(p.id); }
  }
  // müttefiklerin başkentleri de ikmal kaynağıdır
  for (const t of G.realm(tag)) {
    const c = S.nations[t].capital;
    if (c != null && !seen.has(c) && WF.friendly(tag, P[c])) { seen.add(c); q.push(c); }
  }
  for (let i = 0; i < q.length; i++) {
    for (const nb of P[q[i]].nb) {
      if (seen.has(nb)) continue;
      if (WF.friendly(tag, P[nb])) { seen.add(nb); q.push(nb); }
    }
  }
  return seen;
};

WF.supplied = function (a, net) {
  const S = G.S, P = S.provinces, p = P[a.prov];
  if (net.has(p.id)) return true;
  for (const nb of p.nb) if (net.has(nb)) return true;
  // kıyıdaysa ve donanması varsa denizden ikmal alır
  if (p.sea && S.fleets.some(f => f.tag === a.tag && f.ships.length)) return true;
  return false;
};

// Bozguna uğrayan ordu için kaçış yolu: düşman ordusu olmayan dost topraklar üzerinden,
// tercihen ikmal ağına bağlı bir eyalete. Bulunamazsa null.
WF.escapePath = function (a) {
  const S = G.S, P = S.provinces, tag = a.tag;
  const net = WF.reach[tag];
  const blocked = id => S.armies.some(e => e.prov === id && !e.retreating && G.atWar(tag, e.tag));
  const prev = new Map([[a.prov, -1]]), q = [[a.prov, 0]];
  let fallback = null;
  for (let i = 0; i < q.length; i++) {
    const [id, d] = q[i];
    if (id !== a.prov) {
      if (!net || net.has(id)) return G.pathFromPrev(prev, a.prov, id);
      if (fallback == null) fallback = id;
    }
    if (d >= 6) continue;
    for (const nb of P[id].nb) {
      if (prev.has(nb)) continue;
      const np = P[nb];
      if (!WF.friendly(tag, np) || blocked(nb)) continue;
      prev.set(nb, id);
      q.push([nb, d + 1]);
    }
  }
  return fallback != null ? G.pathFromPrev(prev, a.prov, fallback) : null;
};

// Ordu, içinde bozgundaki düşman ordusu bulunan eyalete girerse onları ezer
WF.overrun = function (a) {
  const S = G.S;
  for (const e of S.armies.slice()) {
    if (e.prov !== a.prov || !e.retreating || !G.atWar(a.tag, e.tag)) continue;
    if (e.men < a.men * 0.6) {
      G.destroyArmy(e, `${e.name} (${S.nations[e.tag].name}) bozgun sırasında yakalandı ve kılıçtan geçirildi: ${G.fmtNum(e.men)} ölü.`, a.tag);
      G.command.gainXp(a, 3);
    }
  }
};

WF.daily = function () {
  const S = G.S;
  const atWar = new Set(Object.values(S.nations).filter(n => n.alive && n.enemies.size).map(n => n.tag));
  WF.reach = {};
  for (const tag of atWar) WF.reach[tag] = WF.supplyNet(tag);
  for (const a of S.armies.slice()) {
    if (a.fleet != null) { a.encircled = false; continue; }
    const net = WF.reach[a.tag];
    const enc = !!net && !WF.supplied(a, net);
    if (enc && !a.encircled) {
      a.encircledSince = S.hour;
      if (a.tag === S.player) G.log(`${a.name} kuşatıldı! İkmal yolu kesildi; ordu her gün eriyor.`, 'war', [a.tag]);
    }
    a.encircled = enc;
    if (!enc) continue;
    WF.kill(a, a.men * WF.ENCIRCLED_LOSS, null);
    a.org = Math.max(0, a.org - 4);
    const days = (S.hour - a.encircledSince) / 24;
    if (a.men < 500 || days >= WF.ENCIRCLED_DAYS) {
      G.destroyArmy(a, `${a.name} (${S.nations[a.tag].name}) kuşatmada açlıktan teslim oldu: ${G.fmtNum(a.men)} asker esir düştü.`, null);
    }
  }
  WF.sample();
  // oyuncuyla savaşta olmayanların teslimiyet bayrakları temizlenir
  for (const n of Object.values(S.nations)) {
    if ((n.surrenderAsked || n.surrenderRefused) && !n.enemies.has(S.player)) { n.surrenderAsked = false; n.surrenderRefused = false; }
  }
};

// ------------------------------------------------------------ savaş geçmişi (grafik için)
WF.sample = function () {
  const S = G.S;
  if (!S.wars || !S.wars.length) return;
  const men = {};
  for (const a of S.armies) men[a.tag] = (men[a.tag] || 0) + a.men;
  const day = Math.floor(S.hour / 24);
  for (const w of S.wars) {
    w.hist ||= []; w.step ||= 1;
    if (w.hist.length && day - w.hist[w.hist.length - 1][0] < w.step) continue;
    const sum = side => [...side].reduce((s, t) => s + (men[t] || 0), 0);
    w.hist.push([day, sum(w.att), sum(w.def), WF.sideCas(w, w.att), WF.sideCas(w, w.def)]);
    if (w.hist.length > WF.HIST_MAX) {
      w.hist = w.hist.filter((_, i) => i % 2 === 0 || i === w.hist.length - 1);
      w.step *= 2;
    }
  }
};

// ------------------------------------------------------------ teslimiyet
// Oyuncuya karşı savaşan ülke teslim olmak ister: oyuncu kabul ederse işgal edilen topraklar alınır,
// reddederse savaş, ülkenin bütün toprakları işgal edilene kadar sürer.
WF.offerSurrender = function (tag) {
  const S = G.S, n = S.nations[tag];
  n.surrenderAsked = true;
  let occ = 0, tot = 0;
  for (const p of S.provinces) if (p.owner === tag) { tot++; if (n.enemies.has(p.ctrl)) occ++; }
  G.ui.showEvent('Teslimiyet Teklifi',
    `${n.name} (${n.ruler}) direnecek gücü kalmadığını bildiren bir elçi gönderdi ve teslim olmayı teklif ediyor. ` +
    `${tot} eyaletinin ${occ} tanesi işgalimiz altında. Kabul edersek işgal ettiğimiz topraklar bizim olur ve savaş biter. ` +
    `Reddedersek savaş sürer; bütün topraklarını işgal ettiğimizde ${n.name} tamamen bizim olur.`,
    [
      { text: 'Teslimiyeti kabul et', sub: `İşgal edilen ${occ} eyalet bize geçer`, action: () => { if (n.alive && n.enemies.has(S.player)) G.capitulate(tag); } },
      { text: 'Reddet: hepsini alacağız', sub: 'Savaş, bütün toprakları işgal edilene kadar sürer', action: () => {
        n.surrenderRefused = true;
        G.log(`${n.name}'ın teslimiyet teklifini reddettik. Savaş bütün toprakları alınana kadar sürecek.`, 'war', [tag, S.player]);
      } },
    ]);
};
