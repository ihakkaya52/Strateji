// Ticaret yolları: İpek Yolu, Baharat Yolu, Sahra altın yolu, Varegler'den Rumlara…
// Her yolun aylık bir değeri vardır; değer, yol üzerindeki illeri elinde tutan ve tüccar gönderen ülkeler arasında paylaşılır.
// Savaş, kuşatma ve deniz muharebeleri yolu keser, değeri düşer.
'use strict';

G.trade = {};
(function () {
  const TR = G.trade;
  TR.MERCHANT_SHARE = 0.3;     // bir tüccarın ağırlığı: yolun toplam il ağırlığının bu kadarı
  TR.SEA_WEIGHT = 0.6;         // bir deniz bölgesinin ağırlığı (en güçlü filosu olan ülkenin)

  // [boylam, enlem, sonraki ayak: 'l' kara / 's' deniz]
  const R = (id, name, icon, color, value, pts, desc) => ({ id, name, icon, color, value, pts, desc });
  TR.ROUTES = [
    R('ipek', 'İpek Yolu', '🐫', '#e6bd4f', 34, [[114.3, 34.8, 'l'], [108.9, 34.3, 'l'], [103.8, 36.06, 'l'], [94.66, 40.14, 'l'], [89.19, 42.95, 'l'],
      [75.99, 39.47, 'l'], [66.96, 39.65, 'l'], [64.42, 39.77, 'l'], [61.83, 37.6, 'l'], [58.8, 36.2, 'l'], [51.43, 35.6, 'l'], [48.5, 34.8, 'l'],
      [44.36, 33.31, 'l'], [37.16, 36.2, 'l'], [32.49, 37.87, 'l'], [29.72, 40.43, 'l'], [28.97, 41.01, 'l']],
      'Çin ipeği ve porseleni Semerkant, Bağdat ve Halep üzerinden Konstantinopolis\'e taşınır.'),
    R('bozkir', 'Bozkır Yolu', '🐎', '#c99a62', 14, [[89.19, 42.95, 'l'], [75.2, 42.75, 'l'], [72.24, 42.52, 'l'], [68.3, 42.85, 'l'], [59.15, 42.33, 'l'],
      [47.9, 46.4, 'l'], [49.1, 54.98, 'l']], 'Kürk, köle ve at: bozkırın kuzey kervan yolu İdil Bulgar\'a uzanır.'),
    R('baharat', 'Baharat Yolu', '🌶', '#e06a3c', 36, [[113.26, 23.13, 's'], [104.75, -2.99, 's'], [79.84, 10.77, 's'], [75.78, 11.25, 's'],
      [45.03, 12.8, 's'], [32.55, 29.97, 'l'], [31.24, 30.04, 'l'], [29.92, 31.2, 's'], [12.33, 45.44, 'l']],
      'Biber, karanfil ve tarçın; Kanton\'dan Srivijaya, Chola kıyıları ve Aden üzerinden Kahire ile Venedik\'e.'),
    R('korfez', 'Basra Körfezi Yolu', '⛵', '#47a6bc', 16, [[44.36, 33.31, 'l'], [47.8, 30.5, 's'], [52.2, 27.6, 's'], [56.45, 27.1, 's'],
      [67.5, 24.75, 's'], [72.6, 22.3, 'l']], 'Bağdat ve Basra\'dan Siraf, Hürmüz ve Sind kıyılarına, Gücerat\'a.'),
    R('altin', 'Sahra Altın Yolu', '🪙', '#f0cd48', 18, [[-7.97, 15.77, 'l'], [-7.0, 17.0, 'l'], [-4.27, 31.28, 'l'], [-5.0, 34.03, 'l'],
      [-5.3, 35.89, 's'], [-5.98, 37.39, 'l'], [-4.78, 37.88, 'l']], 'Gana altını ve Sahra tuzu Sicilmase ve Fas üzerinden Endülüs\'e.'),
    R('kanem', 'Kanem-Fizan Yolu', '🐪', '#c8a86a', 9, [[14.5, 14.1, 'l'], [12.9, 18.7, 'l'], [15.1, 26.17, 'l'], [13.19, 32.89, 'l']],
      'Kanem\'den Fizan ve Trablus\'a: köle, fildişi ve tuz kervanları.'),
    R('gao', 'Gao-Kayrevan Yolu', '🐪', '#d6b070', 9, [[-0.04, 16.27, 'l'], [1.5, 18.9, 'l'], [5.33, 31.95, 'l'], [10.1, 35.68, 'l']],
      'Gao ve Tadmekka\'dan Vergle üzerinden İfrikiye\'ye.'),
    R('vareg', 'Varegler\'den Rumlara', '🛶', '#8eb4d6', 14, [[31.27, 58.52, 'l'], [32.04, 54.78, 'l'], [30.52, 50.45, 'l'], [33.5, 44.6, 's'], [28.97, 41.01, 'l']],
      'Novgorod, Smolensk ve Kiev\'den Özü nehri ve Karadeniz yoluyla Konstantinopolis\'e.'),
    R('idil', 'İdil Yolu', '🛶', '#76b0a0', 12, [[49.1, 54.98, 'l'], [47.9, 46.4, 's'], [53.9, 36.9, 'l'], [51.43, 35.6, 'l']],
      'İdil Bulgar ve Hazar\'ın kuzeyinden Gürgan ve Rey\'e: kürk ve gümüş.'),
    R('kehribar', 'Kehribar Yolu', '🟠', '#e3a648', 8, [[19.4, 54.2, 'l'], [19.94, 50.06, 'l'], [17.25, 49.6, 'l'], [16.37, 48.2, 'l'], [12.33, 45.44, 'l']],
      'Baltık kehribarı Krakov ve Moravya üzerinden Adriyatik\'e.'),
    R('baltik', 'Baltık Yolu', '⚓', '#7d9fd6', 12, [[31.27, 58.52, 'l'], [29.9, 59.9, 's'], [18.3, 57.6, 's'], [17.7, 59.6, 's'], [9.57, 54.49, 'l']],
      'Novgorod, Gotland ve Sigtuna\'dan Hedeby\'ye: Viking tüccarlarının denizi.'),
    R('kuzey', 'Kuzey Denizi Yolu', '⚓', '#6a8ec4', 10, [[9.57, 54.49, 's'], [-0.1, 51.5, 's'], [3.22, 51.21, 'l']],
      'Hedeby, Londra ve Brugge: yün, kalay ve kılıç ticareti.'),
    R('sampanya', 'Şampanya Yolu', '🎪', '#c87ab0', 10, [[3.22, 51.21, 'l'], [4.07, 48.3, 'l'], [4.83, 45.76, 'l'], [5.37, 43.3, 's'], [8.93, 44.41, 'l']],
      'Flandre kumaşı Şampanya panayırları ve Ron vadisi boyunca Cenova\'ya.'),
    R('akdeniz', 'Akdeniz Yolu', '⛵', '#48b2a2', 16, [[8.93, 44.41, 's'], [13.36, 38.12, 's'], [11.06, 35.5, 's'], [29.92, 31.2, 's'], [35.07, 32.93, 's'], [28.97, 41.01, 'l']],
      'Cenova ve Pisa\'dan Palermo, Mehdiye, İskenderiye ve Akka\'ya, oradan Konstantinopolis\'e.'),
    R('tutsu', 'Tütsü Yolu', '🕯', '#c6a882', 8, [[45.03, 12.8, 'l'], [44.2, 15.35, 'l'], [39.83, 21.42, 'l'], [39.6, 24.47, 'l'], [35.0, 29.5, 'l'], [34.47, 31.5, 'l'], [36.29, 33.51, 'l']],
      'Yemen tütsüsü ve mür Mekke, Medine ve Akabe üzerinden Şam\'a.'),
    R('cay', 'Çay ve At Yolu', '🍵', '#6fa45e', 8, [[104.07, 30.67, 'l'], [100.23, 25.6, 'l'], [91.1, 29.65, 'l'], [88.1, 24.9, 'l']],
      'Sichuan çayı karşılığında Tibet atı; Dali ve Lhasa\'dan Bengal\'e.'),
    R('hindukus', 'Hindukuş Yolu', '🐫', '#b9925a', 10, [[74.35, 31.55, 'l'], [71.57, 34.0, 'l'], [69.17, 34.53, 'l'], [66.9, 36.76, 'l'], [66.96, 39.65, 'l']],
      'Lahor ve Kâbil\'den Belh ve Semerkant\'a: Hint kumaşı ve çivit.'),
    R('dogu', 'Doğu Denizi Yolu', '⛵', '#d27896', 10, [[130.4, 33.6, 's'], [126.6, 37.4, 's'], [121.55, 29.87, 's'], [118.6, 24.9, 's'], [113.26, 23.13, 'l']],
      'Japonya, Goryeo ve Song limanları arasında ipek, bakır ve kitap ticareti.'),
  ];
  TR.BY = {};
  for (const r of TR.ROUTES) TR.BY[r.id] = r;

  // ------------------------------------------------------------ yolların haritaya oturtulması (bir kez)
  const passable = p => p.kind !== 'wild';
  const nearestProv = (lon, lat, coast) => {
    const y = -1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * Math.PI / 180)) * 180 / Math.PI;
    let best = null, bd = Infinity;
    for (const p of G.S.provinces) {
      if (!passable(p) || p.kind === 'waste' || (coast && !(p.sea && p.sea.length))) continue;
      const d = (p.x - lon) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  // Dijkstra: illerden (kara) ya da deniz bölgelerinden geçen en kısa yol
  const dijkstra = (start, goal, list, ok) => {
    const dist = new Map([[start, 0]]), prev = new Map(), done = new Set();
    const open = [start];
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (dist.get(open[i]) < dist.get(open[bi])) bi = i;
      const u = open.splice(bi, 1)[0];
      if (u === goal) break;
      if (done.has(u)) continue;
      done.add(u);
      const nu = list[u];
      nu.nb.forEach((v, k) => {
        if (done.has(v) || !ok(list[v])) return;
        const nd = dist.get(u) + (nu.nbDist ? nu.nbDist[k] : G.distKm(nu, list[v]));
        if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); open.push(v); }
      });
    }
    if (!dist.has(goal)) return null;
    const path = [goal];
    while (path[0] !== start) path.unshift(prev.get(path[0]));
    return path;
  };

  TR.build = function () {
    const S = G.S, P = S.provinces, Z = S.seas;
    TR.paths = {};
    for (const r of TR.ROUTES) {
      const nodes = [];   // {p: id} ya da {z: id}
      const wp = r.pts.map((w, i) => {
        const seaNear = w[2] === 's' || (i > 0 && r.pts[i - 1][2] === 's');
        return nearestProv(w[0], w[1], seaNear);
      });
      nodes.push({ p: wp[0].id });
      for (let i = 1; i < wp.length; i++) {
        const a = wp[i - 1], b = wp[i];
        if (r.pts[i - 1][2] === 's' && a.sea && b.sea) {
          let best = null;
          for (const za of a.sea) for (const zb of b.sea) {
            const path = za === zb ? [za] : dijkstra(za, zb, Z, () => true);
            if (path && (!best || path.length < best.length)) best = path;
          }
          if (best) for (const z of best) nodes.push({ z });
        } else {
          const path = dijkstra(a.id, b.id, P, passable);
          if (path) for (const id of path.slice(1, -1)) nodes.push({ p: id });
        }
        nodes.push({ p: b.id });
      }
      // ardışık tekrarları ayıkla
      TR.paths[r.id] = nodes.filter((n, i) => !i || n.p !== nodes[i - 1].p || n.z !== nodes[i - 1].z);
    }
  };

  // ------------------------------------------------------------ paylaşım
  const provW = p => (p.kind === 'capital' ? 4 : p.kind === 'city' ? 2 : 1);
  const fleetHolder = z => {
    const S = G.S, pw = {};
    for (const f of S.fleets || []) {
      if (f.zone !== z || f.docked != null) continue;
      pw[f.tag] = (pw[f.tag] || 0) + f.ships.reduce((s, sh) => s + (G.SHIP_TYPES[sh.type].atk || 0) + 1, 0);
    }
    let best = null;
    for (const [t, v] of Object.entries(pw)) if (!best || v > pw[best]) best = t;
    return best;
  };

  TR.init = function () {
    const S = G.S;
    S.trade ||= {};
    for (const n of Object.values(S.nations)) {
      n.merchants ??= n.major ? 2 : 1;
      n.tradeAt ||= [];       // tüccar gönderilen yollar (tekrar edebilir)
    }
    if (!TR.paths) TR.build();
  };

  // Bir yolun bu ayki durumu
  TR.evaluate = function (r) {
    const S = G.S, P = S.provinces, nodes = TR.paths[r.id];
    const pow = {};
    let base = 0, blocked = 0;
    for (const nd of nodes) {
      if (nd.p != null) {
        const p = P[nd.p], w = provW(p);
        base += w;
        if (p.ctrl && S.nations[p.ctrl]) pow[p.ctrl] = (pow[p.ctrl] || 0) + w;
        if (p.siege || (p.owner && p.ctrl !== p.owner)) blocked++;
      } else {
        base += TR.SEA_WEIGHT;
        const t = fleetHolder(nd.z);
        if (t) pow[t] = (pow[t] || 0) + TR.SEA_WEIGHT;
        if (S.navalBattles && S.navalBattles.has(nd.z)) blocked++;
      }
    }
    let total = base;
    const merch = {};
    for (const n of Object.values(S.nations)) {
      if (!n.alive || !n.tradeAt) continue;
      const k = n.tradeAt.filter(x => x === r.id).length;
      if (!k || !pow[n.tag]) continue;
      const m = k * TR.MERCHANT_SHARE * base;
      merch[n.tag] = k; pow[n.tag] += m; total += m;
    }
    const health = Math.max(0.3, 1 - 0.1 * blocked);
    const value = r.value * health * (1 + 0.004 * Math.max(0, S.time.y - 1040));
    const shares = {};
    for (const [t, v] of Object.entries(pow)) shares[t] = { pow: v / total, gold: value * v / total };
    return { value, health, blocked, shares, merch };
  };

  TR.update = function () {
    const S = G.S;
    TR.init();
    for (const n of Object.values(S.nations)) n.routeIncome = 0;
    for (const r of TR.ROUTES) {
      const e = TR.evaluate(r);
      S.trade[r.id] = e;
      for (const [t, s] of Object.entries(e.shares)) {
        const n = S.nations[t];
        if (n) n.routeIncome += s.gold * (n.tradeMult ?? 1);
      }
    }
  };

  // ------------------------------------------------------------ tüccarlar
  TR.canSend = function (tag, id) {
    const n = G.S.nations[tag], e = G.S.trade[id];
    if (n.tradeAt.length >= n.merchants) return [false, `Bütün tüccarlarımız görevde (${n.tradeAt.length} / ${n.merchants}).`];
    if (!e || !e.shares[tag]) return [false, 'Bu yol üzerinde hiç ilimiz ya da filomuz yok: tüccarımız iş tutamaz.'];
    return [true, ''];
  };
  TR.send = function (tag, id) {
    const [ok] = TR.canSend(tag, id);
    if (!ok) return false;
    G.S.nations[tag].tradeAt.push(id);
    TR.update();
    return true;
  };
  TR.recall = function (tag, id) {
    const n = G.S.nations[tag], i = n.tradeAt.indexOf(id);
    if (i >= 0) n.tradeAt.splice(i, 1);
    TR.update();
  };

  TR.monthly = function () {
    const S = G.S;
    TR.update();
    // yapay zekâ: boş tüccarını en çok pay aldığı yola gönderir; payı kalmayan yoldan çeker
    for (const n of Object.values(S.nations)) {
      if (!n.alive || n.tag === S.player) continue;
      n.tradeAt = n.tradeAt.filter(id => S.trade[id] && S.trade[id].shares[n.tag]);
      if (n.tradeAt.length >= n.merchants || G.rng() > 0.3) continue;
      let best = null;
      for (const r of TR.ROUTES) {
        const s = S.trade[r.id].shares[n.tag];
        if (s && (!best || s.gold > best.g)) best = { id: r.id, g: s.gold };
      }
      if (best) n.tradeAt.push(best.id);
    }
    // oyuncunun payı kalmayan yollardaki tüccarları döner
    const me = S.nations[S.player];
    if (me) {
      const lost = me.tradeAt.filter(id => !S.trade[id] || !S.trade[id].shares[me.tag]);
      if (lost.length) {
        me.tradeAt = me.tradeAt.filter(id => !lost.includes(id));
        G.log(`Tüccarlarımız geri döndü: ${[...new Set(lost)].map(id => TR.BY[id].name).join(', ')} üzerinde artık elimizde il ya da filo yok.`, 'war', [me.tag]);
      }
    }
  };

  // Haritada yolun noktaları
  TR.points = function (id) {
    const S = G.S;
    return TR.paths[id].map(nd => (nd.p != null ? S.provinces[nd.p] : S.seas[nd.z]));
  };
})();
