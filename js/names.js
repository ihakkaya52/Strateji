// Kültürlere göre komutan, kaptan ve gemi adları
'use strict';

G.NAMES = {
  turk_bozkir: ['Çağrı', 'İbrahim Yinal', 'Kutalmış', 'Arslan', 'Musa Yabgu', 'Artuk', 'Afşin', 'Sav Tekin', 'Bozan',
    'Tutak', 'Karatekin', 'Gümüştekin', 'Atsız', 'Toğan', 'Alp Kara', 'Yağı Basan', 'Kılıç', 'Böri'],
  turk_yerlesik: ['Altuntaş', 'Begtoğdı', 'Sübaşı', 'Ali Daya', 'Tuğrul Bey', 'Ayaz', 'Arslan Câzib', 'Böri Tegin',
    'Nuştekin', 'Kutlu', 'Bilge Tegin', 'Yınal'],
  iran: ['Ferruhzâd', 'Kâvus', 'Behram', 'Şehriyâr', 'Rüstem', 'Mihrân', 'Ferîdun', 'Bahtiyâr', 'Merzbân', 'Hüsrev'],
  arap: ['Ebû Mansûr', 'Anuştekin ed-Dizberî', 'Bedr el-Cemâlî', 'Nâsırüddevle', 'Hamdân', 'Ukayl', 'Sâlih', 'Hassân',
    'Yahyâ', 'Kays', 'Câfer', 'Mûsâ', 'Zübeyr', 'Ammâr'],
  berberi: ['Bulukkin', 'Temîm', 'Yûsuf', 'Ebû Bekir', 'Hammâd', 'Mansûr', 'Zîrî', 'Yahyâ', 'Tâşfîn', 'Lukmân'],
  bizans: ['Georgios Maniakes', 'Katakalon Kekaumenos', 'Nikephoros Bryennios', 'Konstantinos Diogenes',
    'Ioannes Doukas', 'Romanos Diogenes', 'Isaakios Komnenos', 'Mikhael Dokeianos', 'Basileios Theodorokanos',
    'Leon Tornikios', 'Nikephoros Botaneiates', 'Andronikos Doukas'],
  latin: ['Guillaume', 'Robert', 'Raoul', 'Gottfried', 'Otto', 'Bonifacio', 'Eudes', 'Hugues', 'Geoffroy', 'Baudouin',
    'Konrad', 'Welf', 'Rainulf', 'Drogo', 'Humfrid', 'Ramiro', 'Rodrigo', 'Sancho', 'Berengar', 'Gerard'],
  iskandinav: ['Harald', 'Sven', 'Ulf', 'Thorkell', 'Einar', 'Kalf Arnesson', 'Erling', 'Haakon', 'Bjørn', 'Eirik',
    'Thorfinn', 'Olaf', 'Ragnvald', 'Ketil', 'Gunnar', 'Asbjørn'],
  anglosakson: ['Godwin', 'Harold', 'Leofric', 'Siward', 'Tostig', 'Ælfgar', 'Odda', 'Ralph', 'Gyrth', 'Leofwine',
    'Beorn', 'Swein', 'Eadric', 'Byrhtnoth'],
  kelt: ['Macbeth', 'Thorfinn', 'Gruffydd', 'Rhys', 'Cadwgan', 'Donnchad', 'Conchobar', 'Toirdelbach', 'Diarmait',
    'Murchad', 'Máel Coluim', 'Siward', 'Owain'],
  slav: ['Vyşata', 'İvan Tvorimiriç', 'Putyata', 'Sudislav', 'Mstislav', 'Bolesław', 'Mieszko', 'Vratislav', 'Spytihněv',
    'Dobrinya', 'Ratibor', 'Vladimir', 'Stjepan', 'Petar'],
  kafkas: ['Liparit Orbeli', 'Vahram Pahlavuni', 'Grigor Pahlavuni', 'Ivane', 'Kakhaber', 'Sargis', 'Smbat', 'Gagik',
    'Abul-Aswar', 'Fadl', 'Ashot'],
  hint: ['Rajadhiraja', 'Rajendra', 'Vikramaditya', 'Someshvara', 'Kulachandra', 'Kirtivarman', 'Jayasimha', 'Bhoja',
    'Gangeyadeva', 'Vigraha', 'Karna', 'Udayaditya'],
  cin: ['Fan Zhongyan', 'Han Qi', 'Di Qing', 'Ren Fu', 'Zhong Shiheng', 'Liu Ping', 'Ge Huaimin', 'Pang Ji', 'Wang Gui',
    'Yang Wenguang', 'Zhang Kang', 'Sun Mian'],
  dogu_asya: ['Minamoto no Yoriyoshi', 'Taira no Tadatsune', 'Abe no Sadato', 'Kang Kam-chan', 'Yun Gwan', 'Seo Hui',
    'Fujiwara no Yorimichi', 'Duan Siliang', 'Gao Zhisheng', 'Kiyohara no Takenori'],
  gdasya: ['Lý Thường Kiệt', 'Anawrahta', 'Kyansittha', 'Jaya Indravarman', 'Harshavarman', 'Udayadityavarman',
    'Airlangga', 'Narasara', 'Rudravarman'],
  afrika: ['Basil', 'Giorgios', 'Salomon', 'Dunama', 'Tunka', 'Mansa', 'Kossoi', 'Hume', 'Zakaria'],
};

G.SHIP_NAMES = {
  iskandinav: ['Ormen', 'Trana', 'Visund', 'Gullbringa', 'Sjøhest', 'Ravnen', 'Dreki', 'Bølgeulv', 'Haukr'],
  anglosakson: ['Sæhengest', 'Wægflota', 'Brimhengest', 'Ýþlida', 'Sæwudu', 'Merehus'],
  kelt: ['Dubhlinn', 'Fiadh', 'Ronan', 'Brigid'],
  bizans: ['Agios Georgios', 'Theotokos', 'Pyrphoros', 'Nike', 'Megas Basileios', 'Hagia Eirene', 'Archangelos'],
  latin: ['San Marco', 'Santa Maria', 'San Pietro', 'Sant\'Andrea', 'San Nicola', 'Leone', 'Aquila', 'Falco'],
  arap: ['el-Mansûr', 'en-Nasr', 'el-Fâtih', 'es-Sâik', 'el-Bahr', 'ez-Zafer', 'el-Kâhir', 'er-Ra\'d'],
  berberi: ['el-Mehdiyye', 'el-Muiz', 'en-Nasr', 'el-Kayrevân'],
  cin: ['Fu Hai', 'Qing Long', 'Wan Li', 'Hai Ying', 'Jin Bao', 'Ping Bo'],
  dogu_asya: ['Hayate', 'Tatsu', 'Umikaze', 'Haeryong', 'Cheongma'],
  hint: ['Ganga', 'Garuda', 'Varuna', 'Samudra', 'Nandi'],
  gdasya: ['Naga', 'Makara', 'Jalanidhi', 'Rajasa'],
};

G.TRAITS = {
  saldirgan: { name: 'Saldırgan', desc: 'Saldırı +%10', atk: 0.1 },
  savunmaci: { name: 'Savunma Ustası', desc: 'Savunma +%12', def: 0.12 },
  suvari: { name: 'Süvari Ustası', desc: 'Hız +%15', speed: 0.15 },
  kusatmaci: { name: 'Kuşatmacı', desc: 'Kuşatma +%30', siege: 0.3 },
  lojistik: { name: 'Lojistikçi', desc: 'Örgütlenme yenilenmesi +%30', org: 0.3 },
  denizci: { name: 'Usta Denizci', desc: 'Deniz saldırısı +%15', navalAtk: 0.15 },
  korsan: { name: 'Akıncı Reis', desc: 'Filo hızı +%15', navalSpeed: 0.15 },
};

G.nameFor = function (tag, kind = 'person') {
  const n = G.S.nations[tag];
  const group = (n && n.group) || 'latin';
  if (kind === 'ship') {
    const list = G.SHIP_NAMES[group] || G.SHIP_NAMES[{ turk_bozkir: 'arap', turk_yerlesik: 'arap', iran: 'arap',
      slav: 'latin', kafkas: 'bizans', afrika: 'arap' }[group]] || G.SHIP_NAMES.latin;
    return G.pick(list);
  }
  return G.pick(G.NAMES[group] || G.NAMES.latin);
};

// Rastgele bir komutan (kara) veya kaptan (deniz)
G.makeLeader = function (tag, naval) {
  const skill = 1 + Math.floor(G.rng() * G.rng() * 5);   // 1-5, düşük değerler daha sık
  const pool = naval ? ['denizci', 'korsan'] : ['saldirgan', 'savunmaci', 'suvari', 'kusatmaci', 'lojistik'];
  const trait = G.rng() < 0.6 ? G.pick(pool) : null;
  // aynı ülkede aynı adı iki kez kullanma
  G.usedNames ||= {};
  const used = (G.usedNames[tag] ||= new Set());
  let name = G.nameFor(tag);
  for (let i = 0; i < 12 && used.has(name); i++) name = G.nameFor(tag);
  if (used.has(name)) name = `${name} ${['II', 'III', 'IV', 'V'][Math.floor(G.rng() * 4)]}`;
  used.add(name);
  return { name, skill: G.clamp(skill, 1, 5), trait };
};
