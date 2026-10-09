// Kayıt ve yükleme: oyun durumu sıkıştırılıp tarayıcıya (yuvalar) ya da dosyaya kaydedilir
'use strict';

G.save = {};
(function () {
  const SV = G.save;
  const PREFIX = 'strateji_kayit_';
  const INDEX = 'strateji_kayitlar';
  const VERSION = 1;
  // Haritadan gelen, oyunda hiç değişmeyen il alanları kayda yazılmaz
  const STATIC_PROV = ['name', 'x', 'y', 'area', 'nb', 'poly', 'sea', 'terrain', 'nbDist', 'home'];

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* yok say */ } },
  };

  // Map ve Set'ler JSON'a işaretli biçimde yazılır
  const replacer = (k, v) => {
    if (v instanceof Map) return { __map: [...v] };
    if (v instanceof Set) return { __set: [...v] };
    return v;
  };
  const reviver = (k, v) => {
    if (v && typeof v === 'object') {
      if (v.__map) return new Map(v.__map);
      if (v.__set) return new Set(v.__set);
    }
    return v;
  };

  SV.snapshot = function () {
    const S = G.S;
    const st = { ...S };
    st.provinces = S.provinces.map(p => {
      const o = {};
      for (const k of Object.keys(p)) if (!STATIC_PROV.includes(k)) o[k] = p[k];
      return o;
    });
    delete st.seas;
    for (const a of S.armies) a.sel = false;
    const usedNames = {};
    for (const [t, set] of Object.entries(G.usedNames || {})) usedNames[t] = set instanceof Set ? [...set] : set;
    return JSON.stringify({ v: VERSION, player: S.player, S: st, usedNames, cam: { ...G.map.cam } }, replacer);
  };

  // ------------------------------------------------------------ sıkıştırma (destek yoksa düz metin)
  const b64 = {
    enc(buf) { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
    dec(str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; },
  };
  SV.pack = async function (text) {
    if (typeof CompressionStream === 'undefined') return 'J' + text;
    const cs = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return 'Z' + b64.enc(await new Response(cs).arrayBuffer());
  };
  SV.unpack = async function (data) {
    if (data[0] === 'J') return data.slice(1);
    if (data[0] === 'Z') {
      const ds = new Blob([b64.dec(data.slice(1))]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(ds).text();
    }
    return data;   // eski / düz JSON dosyası
  };

  // ------------------------------------------------------------ yuvalar
  SV.list = function () {
    try { return JSON.parse(store.get(INDEX) || '[]'); } catch (e) { return []; }
  };
  const writeIndex = list => store.set(INDEX, JSON.stringify(list));

  SV.saveSlot = async function (slot, label) {
    const S = G.S;
    if (!S) return 'Oyun yok.';
    const data = await SV.pack(SV.snapshot());
    if (!store.set(PREFIX + slot, data)) return 'Tarayıcı belleği dolu ya da kapalı. Dosyaya kaydetmeyi deneyin.';
    const n = S.nations[S.player];
    const list = SV.list().filter(e => e.slot !== slot);
    list.unshift({ slot, label: label || slot, tag: S.player, nation: n.name, ruler: n.ruler, date: G.fmtDate(S.time, false),
      real: new Date().toLocaleString('tr-TR'), size: data.length });
    writeIndex(list);
    return null;
  };
  SV.loadSlot = async function (slot) {
    const data = store.get(PREFIX + slot);
    if (!data) return 'Kayıt bulunamadı.';
    return SV.apply(await SV.unpack(data));
  };
  SV.deleteSlot = function (slot) {
    store.del(PREFIX + slot);
    writeIndex(SV.list().filter(e => e.slot !== slot));
  };

  // ------------------------------------------------------------ dosya
  SV.download = async function () {
    const S = G.S;
    const data = await SV.pack(SV.snapshot());
    const n = S.nations[S.player];
    const name = `strateji_${n.name.replace(/\s+/g, '_')}_${S.time.y}-${String(S.time.m + 1).padStart(2, '0')}.kayit`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  SV.fromFile = function (file) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = async () => {
        try { res(SV.apply(await SV.unpack(String(r.result).trim()))); } catch (e) { res('Dosya okunamadı: ' + e.message); }
      };
      r.onerror = () => res('Dosya okunamadı.');
      r.readAsText(file);
    });
  };

  // ------------------------------------------------------------ geri yükleme
  SV.apply = function (text) {
    let obj;
    try { obj = JSON.parse(text, reviver); } catch (e) { return 'Kayıt bozuk.'; }
    if (!obj || !obj.S || obj.v > VERSION) return 'Bu kayıt bu oyun sürümüyle açılamıyor.';
    const W = window.WORLD, st = obj.S;
    st.provinces = st.provinces.map((p, i) => {
      const w = W.provinces[i];
      return { ...w, nbDist: w.nb.map(n => G.distKm(w, W.provinces[n])), ...p };
    });
    // eski kayıtlarda sonradan eklenen (keşfedilmemiş) iller yoktur: haritadan tamamlanır
    for (let i = st.provinces.length; i < W.provinces.length; i++) {
      const w = W.provinces[i];
      st.provinces.push({ ...w, ctrl: w.owner, siege: null, nbDist: w.nb.map(n => G.distKm(w, W.provinces[n])),
        civ: 0, mil: 0, fort: 0, garrison: 0, garTarget: 1, mine: 0, farm: 0, res: null,
        milLines: G.econ.blank(), milEff: { kilic: 0.6, yay: 0.6, zirh: 0.6, at: 0.6 }, civLines: { insaat: 0 } });
    }
    st.seas = W.seas.map(z => ({ ...z, nbDist: z.nb.map(n => G.distKm(z, W.seas[n])) }));
    st.battles ||= new Map(); st.navalBattles ||= new Map(); st.rel ||= new Map(); st.firedEvents ||= new Set();
    st.paused = true;
    G.S = st;
    G.usedNames = {};
    for (const [t, arr] of Object.entries(obj.usedNames || {})) G.usedNames[t] = new Set(arr);
    G.rng = G.makeRng((Date.now() % 100000) + 7);
    G.stab.init();   // eski kayıtlarda iç düzen alanları yoksa doldur
    G.dyn.init();
    G.rel.init();
    G.cul.init();
    G.explore.init();
    G.explore.invalidate();
    G.tech.init();
    G.vassal.init();
    G.trade.paths = null;
    G.trade.init();
    G.trade.update();
    // arayüz durumunu sıfırla
    const U = G.ui;
    G.selected = new Set(); G.selFleet = null;
    U.provId = null; U.dipTag = null; U.page = null; U.battleKey = null; U.panelKind = null; U.focusView = null;
    if (G.map.frontCache) G.map.frontCache.clear();
    G.map.selProv = null; G.map.selNation = null;
    for (const id of ['menu', 'pickbar', 'modal', 'dipwin', 'prodwin', 'navywin', 'focuswin', 'warpanel', 'battlepanel', 'pagewin', 'provpanel', 'panel', 'armypanel', 'gamemenu', 'peacewin']) {
      const e = document.getElementById(id); if (e) e.classList.add('hidden');
    }
    U.picking = false;
    G.labelsDirty = true; G.mapDirty = true;
    U.initGame();
    if (obj.cam) { G.map.cam = { ...obj.cam }; G.map.clampCam(); }
    U.refreshTop(); U.refreshOrdular();
    U.addLog(G.fmtDate(st.time, false), 'Kayıtlı oyun yüklendi.', 'good');
    return null;
  };

  // ------------------------------------------------------------ otomatik kayıt: üç ayda bir
  SV.lastAuto = null;
  SV.tick = function () {
    const S = G.S;
    if (!S || S.over) return;
    const key = S.time.y * 12 + S.time.m;
    if (S.time.m % 3 !== 0 || S.time.d !== 1 || SV.lastAuto === key) return;
    SV.lastAuto = key;
    SV.saveSlot('oto', 'Otomatik kayıt').then(err => { if (err) console.warn(err); });
  };
})();
