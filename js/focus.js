// Ulusal odak ağaçları (HOI4 tarzı)
'use strict';

G.focus = {};

const FOCUS_DAYS = 42;

// x: sütun, y: satır. req: hepsi tamamlanmalı. avail: ek koşul. ai: yapay zekâ bu odağı seçer mi
G.FOCUS_TREES = {
  ENG: [
    {
      id: 'eng_witan', x: 2, y: 0, name: 'Witenagemot\'u Topla',
      desc: 'Krallığın bilgeler meclisi toplanıyor. Saksonların sesi yeniden duyulacak.',
      effectText: '+4.000 insan gücü',
      effect: n => { n.manpower += 4000; },
    },
    {
      id: 'eng_godwin', x: 1, y: 1, req: ['eng_witan'], name: 'Kont Godwin ile Uzlaşma',
      desc: 'Wessex\'in güçlü kontu Godwin, Danimarka tacına sadakatini sorguluyor. Onu yanımıza çekelim.',
      effectText: 'Başkentte yeni bir ordu: Wessex Huscarlları',
      effect: n => { G.focus.spawnArmies(n, 1, 'Wessex Huscarlları'); },
    },
    {
      id: 'eng_danegeld', x: 2, y: 1, req: ['eng_witan'], name: 'Danegeld\'i Reddet',
      desc: 'Danimarkalılara ödenen haraç artık durdurulacak. Kopenhag bundan hoşlanmayacak.',
      effectText: 'Efendiye verilen haraç (%25 insan gücü) kalkar',
      effect: n => {
        n.tribute = 0;
        if (n.overlord) G.log(`${n.name} Danegeld haracını ödemeyi reddetti!`, 'war', [n.tag, n.overlord]);
      },
    },
    {
      id: 'eng_fyrd', x: 3, y: 1, req: ['eng_witan'], name: 'Fyrd\'i Yeniden Düzenle',
      desc: 'Her beş hide topraktan bir asker: Sakson köylü ordusu yeniden kuruluyor.',
      effectText: 'İki yeni ordu, aylık insan gücü +%10',
      effect: n => { G.focus.spawnArmies(n, 2, 'Fyrd'); n.mpMult += 0.1; },
    },
    {
      id: 'eng_edward', x: 1, y: 2, req: ['eng_godwin'], name: 'Edward\'ı Sürgünden Çağır',
      desc: 'Æthelred\'in oğlu Edward, Normandiya\'daki sürgününden dönüyor. Eski Wessex hanedanı yeniden tahtta.',
      effectText: 'Hükümdar: Günah Çıkaran Edward · +6.000 insan gücü',
      effect: n => { n.ruler = 'Günah Çıkaran Edward'; n.manpower += 6000; },
    },
    {
      id: 'eng_saxon', x: 2, y: 2, req: ['eng_danegeld'], name: 'Sakson Ruhunu Uyandır',
      desc: 'Alfred\'in mirası hatırlansın. Halk yabancı krala karşı birleşiyor.',
      effectText: 'Savunma +%10',
      effect: n => { n.defMult += 0.1; },
    },
    {
      id: 'eng_huscarl', x: 3, y: 2, req: ['eng_fyrd'], name: 'Huscarl Muhafızları',
      desc: 'İki elli baltalarıyla ünlü seçkin muhafızlar ordunun belkemiği olacak.',
      effectText: 'Saldırı +%10',
      effect: n => { n.atkMult += 0.1; },
    },
    {
      id: 'eng_burh', x: 4, y: 2, req: ['eng_fyrd'], name: 'Burh Kalelerini Onar',
      desc: 'Alfred\'in kurduğu müstahkem kasabalar yeniden tahkim ediliyor.',
      effectText: 'Savunma +%15',
      effect: n => { n.defMult += 0.15; },
    },
    {
      id: 'eng_indep', x: 2, y: 3, req: ['eng_edward', 'eng_saxon', 'eng_huscarl'], name: 'Bağımsızlık İlanı',
      desc: 'Artık hiçbir Danimarka kralı İngiltere\'ye hükmetmeyecek! Bu, Danimarka ile savaş demektir.',
      effectText: 'Danimarka\'ya karşı bağımsızlık savaşı başlar',
      avail: n => !!n.overlord,
      ai: n => G.focus.power(n.tag) > G.focus.power(n.overlord) * 0.6,
      effect: n => { G.declareIndependence(n.tag); },
    },
    {
      id: 'eng_crown', x: 2, y: 4, req: ['eng_indep'], name: 'Sakson Tacı',
      desc: 'Bağımsız İngiltere\'nin tacı Westminster\'da yeniden parlıyor.',
      effectText: 'Aylık insan gücü +%15 · Danimarka ile savaşta olmamalı',
      avail: n => !n.overlord && !n.rebelFrom,
      effect: n => { n.mpMult += 0.15; },
    },
    {
      id: 'eng_danelaw', x: 3, y: 4, req: ['eng_indep'], name: 'Danelaw\'ı Kucakla',
      desc: 'Kuzeydeki Danimarka kökenli halk da artık İngiliz. Onların savaşçıları ordumuza katılsın.',
      effectText: 'Bir yeni ordu, +5.000 insan gücü',
      effect: n => { G.focus.spawnArmies(n, 1, 'Danelaw Ordusu'); n.manpower += 5000; },
    },
    {
      id: 'eng_wales', x: 1, y: 5, req: ['eng_crown'], name: 'Galler Seferi',
      desc: 'Gruffydd ap Llywelyn sınırlarımızı yağmalıyor. Galler dağlarına yürüme zamanı.',
      effectText: 'Gwynedd\'e savaş ilan edilir',
      avail: n => G.focus.alive('GWY'),
      effect: n => { G.declareWar(n.tag, 'GWY'); },
    },
    {
      id: 'eng_scot', x: 2, y: 5, req: ['eng_crown'], name: 'İskoç Sınırı',
      desc: 'Kuzeydeki İskoç kralı Northumbria\'ya göz dikti. Sınırı güvenceye alalım.',
      effectText: 'İskoçya\'ya savaş ilan edilir',
      avail: n => G.focus.alive('SCO'),
      effect: n => { G.declareWar(n.tag, 'SCO'); },
    },
    {
      id: 'eng_north', x: 3, y: 5, req: ['eng_crown', 'eng_danelaw'], name: 'Kuzey Denizi\'nin Efendisi',
      desc: 'Rollar tersine döndü: artık İngiliz gemileri Danimarka kıyılarında.',
      effectText: 'Saldırı +%10, savunma +%5, +10.000 insan gücü',
      effect: n => { n.atkMult += 0.1; n.defMult += 0.05; n.manpower += 10000; },
    },
  ],
};

G.focus.power = tag => G.nationStats(tag).men + G.S.nations[tag].manpower * 0.4;
G.focus.alive = tag => !!(G.S.nations[tag] && G.S.nations[tag].alive);

G.focus.tree = tag => G.FOCUS_TREES[tag] || null;
G.focus.get = (tag, id) => (G.FOCUS_TREES[tag] || []).find(f => f.id === id);

G.focus.spawnArmies = function (n, count, name) {
  const spawn = G.spawnPoint(n.tag);
  if (spawn == null) { n.manpower += count * G.ARMY_MEN; return; }
  for (let i = 0; i < count; i++) {
    const a = G.createArmy(n.tag, spawn);
    if (name) a.name = count > 1 ? `${name} ${i + 1}` : name;
  }
};

// Durum: done | current | available | locked
G.focus.state = function (n, f) {
  if (n.focus.done.has(f.id)) return 'done';
  if (n.focus.cur === f.id) return 'current';
  return G.focus.canStart(n, f) ? 'available' : 'locked';
};

G.focus.canStart = function (n, f) {
  if (n.focus.done.has(f.id)) return false;
  if ((f.req || []).some(r => !n.focus.done.has(r))) return false;
  if (f.avail && !f.avail(n)) return false;
  return true;
};

G.focus.start = function (tag, id) {
  const n = G.S.nations[tag], f = G.focus.get(tag, id);
  if (!f || !G.focus.canStart(n, f)) return false;
  n.focus.cur = id; n.focus.prog = 0;
  return true;
};

G.focus.daily = function () {
  const S = G.S;
  for (const tag of Object.keys(G.FOCUS_TREES)) {
    const n = S.nations[tag];
    if (!n || !n.alive) continue;
    const fs = n.focus;
    if (!fs.cur && tag !== S.player) {
      // yapay zekâ: sıradaki uygun odağı seç
      const next = G.FOCUS_TREES[tag].find(f => G.focus.canStart(n, f) && (!f.ai || f.ai(n)));
      if (next) G.focus.start(tag, next.id);
    }
    if (!fs.cur) continue;
    const f = G.focus.get(tag, fs.cur);
    if (f.avail && !f.avail(n)) continue;   // koşul bozulduysa bekler
    fs.prog++;
    if (fs.prog >= FOCUS_DAYS) {
      fs.done.add(f.id);
      fs.cur = null; fs.prog = 0;
      f.effect(n);
      G.mapDirty = true;
      if (tag === S.player) {
        G.ui.showEvent(`Odak tamamlandı: ${f.name}`, `${f.desc} (${f.effectText})`, [{ text: 'Devam' }]);
      } else {
        G.log(`${n.name} "${f.name}" odağını tamamladı.`, 'info', [tag]);
      }
    }
  }
};

G.FOCUS_DAYS = FOCUS_DAYS;
