// Genel yardımcılar ve sabitler
'use strict';

const G = window.G = {};

G.MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz',
  'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

// Jülyen takvimi: her 4 yılda bir artık yıl
G.daysInMonth = (y, m) => [31, (y % 4 === 0 ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m];

G.fmtDate = (t, withHour = true) => {
  const s = `${t.d} ${G.MONTHS[t.m]} ${t.y}`;
  return withHour ? `${s}, ${String(t.h).padStart(2, '0')}:00` : s;
};

G.fmtNum = n => Math.round(n).toLocaleString('tr-TR');
G.fmtK = n => n >= 10000 ? `${Math.round(n / 1000)}B` : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.', ',')}B` : `${Math.round(n)}`;
G.clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Tekrarlanabilir rastgele sayı üreteci
G.makeRng = seed => () => {
  seed |= 0; seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
G.rng = G.makeRng(1040);
G.rand = (a = 0, b = 1) => a + (b - a) * G.rng();
G.pick = arr => arr[Math.floor(G.rng() * arr.length)];

// Miller projeksiyonunun tersi (y -> enlem)
G.unprojLat = y => {
  const yr = -y * Math.PI / 180;
  return (Math.atan(Math.exp(yr / 1.25)) - Math.PI / 4) / 0.4 * 180 / Math.PI;
};

// İki nokta arası yaklaşık km
G.distKm = (a, b) => {
  const la = G.unprojLat(a.y), lb = G.unprojLat(b.y);
  const dx = (a.x - b.x) * 111.32 * Math.cos((la + lb) / 2 * Math.PI / 180);
  const dy = (la - lb) * 110.57;
  return Math.hypot(dx, dy);
};

G.RELIGIONS = {
  katolik: { name: 'Katolik', color: '#e2c14a' },
  ortodoks: { name: 'Ortodoks', color: '#8a5cc2' },
  miafizit: { name: 'Miafizit', color: '#c27a5c' },
  sunni: { name: 'Sünnî', color: '#2f9a4a' },
  sii: { name: 'Şiî', color: '#1d6b5c' },
  ibadi: { name: 'İbâdî', color: '#86c07a' },
  nesturi: { name: 'Nestûrî', color: '#b07ac0' },
  budist: { name: 'Budist', color: '#e08a3a' },
  hindu: { name: 'Hindu', color: '#d0503a' },
  konfucyus: { name: 'Konfüçyüsçü', color: '#c9a77a' },
  tengri: { name: 'Tengricilik', color: '#5a8ad0' },
  pagan_slav: { name: 'Slav Paganizmi', color: '#8a6a4a' },
  pagan_baltik: { name: 'Baltık Paganizmi', color: '#6a8a3a' },
  pagan_fin: { name: 'Fin Paganizmi', color: '#4a8a8a' },
  pagan_afrika: { name: 'Afrika Yerli İnançları', color: '#9a7a3a' },
  bergvata: { name: 'Bergvâta İnancı', color: '#7a3a4a' },
  ruya: { name: 'Rüya Zamanı', color: '#b0603a' },
};

// Kültür grubuna göre ordu yapısı: süvari oranı
G.GROUP_CAV = {
  turk_bozkir: 0.75, turk_yerlesik: 0.5, iran: 0.4, arap: 0.4, berberi: 0.45,
  bizans: 0.35, latin: 0.25, iskandinav: 0.08, kelt: 0.05, anglosakson: 0.06, slav: 0.2,
  kafkas: 0.3, hint: 0.25, cin: 0.2, dogu_asya: 0.2, gdasya: 0.12, afrika: 0.25,
};

G.GROUP_NAMES = {
  turk_bozkir: 'Bozkır Türkleri', turk_yerlesik: 'Yerleşik Türkler', iran: 'İranî', arap: 'Arap',
  berberi: 'Berberi', bizans: 'Rum', latin: 'Latin', iskandinav: 'İskandinav', kelt: 'Kelt', anglosakson: 'Anglo-Sakson',
  slav: 'Slav / Baltık', kafkas: 'Kafkas', hint: 'Hint', cin: 'Çin', dogu_asya: 'Doğu Asya',
  gdasya: 'Güneydoğu Asya', afrika: 'Afrika',
};

G.FONT_TITLE = "'Cinzel', Georgia, serif";
G.FONT_BODY = "'EB Garamond', Georgia, serif";

G.KIND_NAMES = { capital: 'Başkent', city: 'Şehir', rural: 'Kırsal', waste: 'Issız bölge' };

// En küçük ikili yığın (Dijkstra için)
G.Heap = class {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(k, v) {
    const a = this.a; a.push([k, v]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top;
  }
};

G.esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
