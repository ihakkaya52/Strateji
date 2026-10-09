# Strateji 1040

HOI4 tarzında, Orta Çağ'da geçen bir büyük strateji oyunu. Senaryo 1040'ta başlar ve yaklaşık 80 yıl sürer (1120'ye kadar).
Harita Avrasya ve Kuzey Afrika'yı kapsar: 140'tan fazla ülke ve 3.000'den fazla eyalet.

## Nasıl oynanır

Kurulum gerekmez. `index.html` dosyasını tarayıcıda açmanız yeterli.

| Kontrol | İşlev |
|---|---|
| Sol tık | İl seç (sol altta il yönetimi: Genel, Kale, Silahhane, Atölye, Maden, Tarım) / orduya tıkla |
| Sol tıkla sürükle, WASD, ok tuşları | Haritayı kaydır (Shift ile hızlı, ekran kenarı da kaydırır) |
| Shift + sürükle | Kutu içindeki orduları seç |
| Sağ tık | Seçili orduları yürüt / saldır; seçili filoyu denize, limana veya çıkarmaya gönder. Seçim yokken: ülkenin diplomasi sayfası |
| Seçili ordu / filoyla kendi başka ordu / filona sağ tık | Hedefi komutanının (amiralinin) yönetebileceği en fazla askere (gemiye) kadar doldur; kalanlar kaynakta kalır. Uzaktaysa kaynak hedefe gider ve varınca aktarır |
| Ctrl + sağ tık | Seçili ordular gemiyle gider: limana yürür, filoya biner, hedef kıyıya çıkarma yapar (karadan yol yoksa sağ tık yeterli) |
| O | Alt ortadaki komuta çubuğunu küçült / büyüt |
| Odak ağacı | Tekerlek: yakınlaştır / uzaklaştır · sol tıkla basılı tutup sürükle |
| Üst çubuk | ❖ odak · ◉ hazine ve ekonomi · ♟ / ⚑ bütün ordular · ⚒ atölyeler ve silahhaneler · ⚓ donanma · ☠ savaş · ✉ olaylar · sağ üstte saat |
| Donanma çubuğu | Sol tık: filoyu seç · gemi kartına tık: ayırmak için işaretle · sağ tık: kamera filoya kayar |
| Komuta çubuğu | Sol tık: orduyu seç (kamera kıpırdamaz) · sağ tık: kamera yumuşakça orduya kayar · mareşal adına tık: üç ordusunu seç |
| N | Donanma arayüzü |
| P | Üretim ve inşaat |
| K | Savaş durumu paneli (kayıplar, tahmini düşman gücü, grafik) |
| Fare tekerleği, Q / E | Yakınlaştır / uzaklaştır |
| Boşluk | Duraklat / devam |
| 1–5, + / - | Oyun hızı |
| Esc | Her şeyi kapat, ana siyasi haritaya dön |
| L | Olaylar sayfası |

## Şu an oyunda olanlar (1. sürüm)

- **Harita:** Gerçek kıyı şeritleri (Natural Earth). Her şehir bir eyalet, aralarda kırsal eyaletler, çöl ve tundralar geçilemez.
  Afrika'nın tamamı ve Avustralya'nın kuzeyi görünür ama keşfedilmemiş topraktır (Terra Incognita); keşif ileride gelecek.
- **Ülkeler:** 10 büyük güç (Bizans, Büyük Selçuklu, Fâtımî, Kutsal Roma, Fransa, Kiev Rus'u, Danimarka,
  Gazneliler, Song, Liao) ve yaklaşık 130 küçük ülke. Hepsi oynanabilir.
- **Vasallık:** İngiltere, Danimarka tacının vasalı olarak başlar. Vasallar efendilerinin savaşlarına katılır,
  insan gücünün %25'ini haraç olarak öder ve kendi başına savaş ilan edemez. Aynı diyardaki ordular birbirinin
  topraklarından geçebilir.
- **Odak ağaçları:** Madalyonlu, simgeli HOI4 tarzı görünüm. 10 büyük gücün her birine özel 56 odaklı ağaç
  (saray / siyaset, diplomasi / din, ekonomi, askerî / teknoloji ve ülkeye özel kol; birbirini dışlayan tarihî
  seçimler, büyük final odağı), İngiltere'ye özel bağımsızlık ağacı, diğer bütün
  ülkelere ortak ağaç. Odaklar insan gücü, saldırı, savunma, kuşatma, hız, deniz gücü, ordu kapasitesi, tersane,
  elçi, yeni ordular ve savaş gerekçeleri verir. Yapay zekâ da odak seçer.
- **Diplomasi:** Bir ülkeye sağ tıklayınca HOI4 / EU4 tarzı diplomasi sayfası açılır: ilişki puanı ve sebepleri,
  antlaşmalar, elçi gönderme, ittifak, askerî geçiş hakkı, bağımsızlık garantisi, savaş gerekçesi, savaş ve barış.
- **Savaş gerekçesi:** Savaş ilan etmek için önce gerekçe hazırlanır (45 gün; farklı dinden komşuya 25 gün) ya da
  odaklardan kazanılır. Yapay zekâ da rastgele savaş açmaz, önce gerekçe hazırlar.
- **Koalisyonlar:** Saldırıya uğrayan ülkenin müttefikleri ve garantörleri savaşa girer. Teslim olan ülke yalnızca
  işgal edilen topraklarını kaybeder.
- **Zaman:** HOI4 gibi saatlik takvim, duraklatma ve 5 hız kademesi.
- **Komuta zinciri:** Mareşal → en fazla 3 ordu komutanı → her komutanın ordusu. Ordu komutanının yıldızı ordusunun
  büyüklüğünü belirler: 1 yıldız 8B, 5 yıldız 15B asker. Komutanlar savaştıkça tecrübe kazanır ve terfi eder.
  Ordular 1.000 kişilik bölüklerden oluşur; her bölüğün komutanı ve türü (piyade, okçu, süvari) vardır.
- **Komuta çubuğu:** Ekranın alt ortasında HOI4 gibi mareşaller ve ordu komutanları portreleriyle görünür.
  Ordular bölünebilir ve komutan kapasitesi kadar birleştirilebilir.
- **Cephe ve taarruz (HOI4 tarzı):** Mareşale bir ülkeye karşı cephe atanır, orduları cephe boyunca kendiliğinden
  dağılır. "Taarruz" emriyle aynı cepheyi tutan mareşaller birlikte saldırır, "taarruz oku" ile hedef gösterilir.
  Ordular elle de yönetilebilir.
- **Muharebe:** Örgütlenme ve mevcut, geri çekilme, kuşatılıp imha edilme. Kültüre göre süvari oranı
  (bozkır orduları hızlı ve saldırıda güçlü).
- **Donanma:** 116 deniz bölgesi, limanlar ve tersaneler. On gemi türü: Çektiri, Nakliye Gemisi, Drakkar, Knarr, Koga,
  Kadırga, Dromon, Şînî, Sambuk, Cünk. Her türün sağlamlığı, saldırısı, hızı, taşıma kapasitesi, mürettebatı ve
  menzili (limandan uzaklaşabileceği deniz bölgesi sayısı) farklı. Filoların kendi kaptanı ve denizcileri var.
- **Çıkarma ve deniz savaşı:** Limanda ordular gemilere bindirilir. Düşman limanına gönderilen filo önce liman
  muharebesi verir (surlar ve limandaki gemiler); liman düşünce ordu doğrudan karaya çıkar. Limansız kıyılara
  çıkarma daha yavaş ve zayıftır. Aynı deniz bölgesine
  giren düşman filolar çarpışır; batan nakliye gemileriyle askerler de boğulur. Yapay zekâ da çıkarma planlar.
- **Kaleler ve garnizonlar:** Başkentlerde ve bazı şehirlerde 1–5 seviye kale ve garnizon vardır. Kale savunmayı
  artırır, kuşatmayı uzatır; garnizonun iki katından az askerle kuşatma ilerlemez. Garnizon kayıpları insan gücünden
  yenilenir. Kaleler inşa edilerek güçlendirilebilir.
- **Ekonomi ve üretim (HOI4 tarzı):** Her ilde atölyelerin inşaat mı yoksa hangi ticari ürünü (kumaş, şarap, cam,
  deri, ipekli, baharat) yapacağı, silahhanelerin hangi teçhizatı (kılıç ve mızrak, yay ve ok, zırh ve kalkan,
  savaş atı) üreteceği seçilir. Yeni hatların verimi zamanla artar. Ordular teçhizatı depodan çeker; teçhizatı eksik
  ordu daha zayıf savaşır.
- **Hazine:** Vergi, ticari ürünler, madenler ve tarımdan altın gelir; ordu maaşı ve garnizonlar gider yazar. Altın
  inşaat, yeni ordu ve gemi için harcanır. Hazine eksiye düşerse ordunun morali bozulur.
- **Madencilik ve tarım:** Her ilin bir doğal kaynağı vardır. Demir madenleri silah üretimini artırır; gümüş, altın
  ve tuz madenleri altın getirir. Çiftlikler insan gücünü artırır (tahıl bölgelerinde daha çok).
- **Garnizon yönetimi:** Kale sekmesinden garnizonun büyüklüğü (%0–100) seçilir, ordudan garnizona asker aktarılır.
- **Savaş ve barış:** Savaş skoru, toprak devriyle barış veya beyaz barış, ateşkes ve teslimiyet.
- **Deniz çıkarması:** İki yol var.
  1. Savaş gemilerinin kendi deniz piyadeleri vardır (Dromon 300, Şînî 280, Kadırga 250, Drakkar 150...).
     Filoyu seçip düşman kıyısına sağ tıklayın: filo gider, gerekirse liman muharebesi yapar, deniz piyadeleri karaya çıkar.
     Deniz piyadeleri dost limanda insan gücünden yeniden tamamlanır.
  2. Orduyu seçip deniz aşırı bir düşman kıyısına sağ tıklayın (ya da Ctrl + sağ tık): ordu en uygun limana yürür,
     boştaki bir filo oraya gelir, ordu biner ve filo çıkarma yapar. Ordu panelindeki "Gemiye bindir" yalnızca bindirir;
     sonra filoyu seçip kıyıya sağ tıklarsınız.
- **Muharebe:** Cephe genişliği (her taraftan en fazla 14.000 asker aynı anda çarpışır, gerisi yedekte),
  8 saatlik evreler (🏹 ok yağmuru → 🐎 süvari hücumu → ⚔ göğüs göğüse), her evrede zar ve komutan becerisi.
  Okçular ok evresinde, süvari hücum evresinde (üstün süvari kanat sarar), piyade göğüs göğüse evresinde güçlüdür.
  Haritadaki ⚔ işaretine tıklayınca muharebe penceresi açılır.
- **Kale kuşatması:** Kaleler ablukaya alınır (garnizonun 1,5 katı asker gerekir), mancınıklar surları döver,
  erzak biter ve garnizon açlıktan erir. Surlar yıkılınca kale düşer. İstenirse hücum edilir: hızlıdır ama surlar
  sağlamken çok kanlıdır. Kuşatma kalkınca surlar yavaşça onarılır.
- **Alt çubuk kipleri (sağ alt):** ⚔ Kara (mareşaller ve ordular), ⚓ Donanma (amiraller, her gemi ve kaptanı,
  deniz piyadeleri, gemideki ordular; gemileri seçip yeni filo kurma, limana dönme, asker indirme),
  ♜ Garnizon (harita kararır, kaleler parlar, garnizon sayıları görünür; kale listesi ve toplu garnizon ayarı).
- **Kayıt / yükleme:** Üstteki ☰ Menü: yeni kayıt, hızlı kayıt (Ctrl+S), kayıtlar listesi, dosyaya indirme ve dosyadan
  yükleme. Oyun üç ayda bir kendiliğinden kaydedilir; ana menüde "Devam et" ile kalınan yerden sürülür.
- **Barış masası:** Diplomasi sayfasındaki "☮ Barış masası": işgal edilen illerden hangilerinin alınacağı tek tek
  seçilir, vasallık ve savaş tazminatı istenebilir. Her talebin bir bedeli vardır; toplam bedel savaş skorunu
  aşarsa düşman kabul etmez. Yapay zekâ kazanırken oyuncuya kendi şartlarını gönderir.
- **İstikrar ve isyanlar:** Her ülkenin bir istikrarı (hazine, işgal, uzayan savaşlar, yabancı topraklar), her ilin
  bir huzursuzluğu vardır (yabancı toprak, farklı din ve kültür, yeni fetih; garnizon, ordu ve başkent yatıştırır).
  Huzursuz il daha az vergi ve asker verir; %100'e ulaşınca isyan çıkar: komşu huzursuz illerle birlikte ayaklanır,
  yok olmuş eski sahibi varsa o ülke yeniden doğar. 25 yıl elde tutulan il asıl toprak olur.
- **Kayıplar:** Muharebe, kuşatma, bozgun ve batan gemilerde askerler ölür. Bozguna uğrayan ordu dost toprağa
  yürüyerek çekilir; yolda yakalanırsa kılıçtan geçirilir, kaçacak yeri yoksa imha olur.
- **Kuşatma (cep):** İkmal yolu başkente bağlanamayan ordu kuşatılmış sayılır: her gün %3 erir, toparlanamaz,
  takviye alamaz, yenilirse imha olur, 45 günde açlıktan teslim olur.
- **Savaş durumu paneli:** Üst çubuktaki ☠ simgesi (K): savaş skoru, iki tarafın sahadaki askeri (düşmanınki tahmini),
  bölük sayıları, kayıplar, teslimiyet ilerlemesi ve zaman içindeki güç / kayıp grafiği.
- **Teslimiyet teklifi:** Size karşı savaşan ülke teslim olmak istediğinde bildirim gelir. Kabul ederseniz işgal
  ettiğiniz topraklar sizin olur; reddederseniz savaş sürer ve bütün topraklarını işgal ettiğinizde hepsi size geçer.
- **İnsan gücü:** Eyaletlerden aylık asker gelir. Yeni ordu toplama (8B asker, 60 gün, yeni komutanla) ve takviye.
- **Yapay zekâ:** Savaş ilan eder, cephe kurar, kuşatır, barış yapar ve asker toplar.
- **Olaylar:** Macbeth'in tahta çıkışı (1040), Petar Delyan ayaklanması (1040), Normanların Melfi'yi alışı (1041),
  Büyük Ayrılık (1054).
- **Harita modları:** Siyasi, din ve coğrafi. Coğrafi kip eski atlaslar gibi çizilir: boyalı arazi zemini, dağ, tepe,
  orman, tayga, çöl kumulu, bozkır otu ve bataklık simgeleri, nehirler ve Türkçe dağ / çöl / nehir adları
  (Natural Earth verisinden).
- **Arazi:** Her eyaletin bir arazisi var (ova, orman, tayga, bozkır, çöl, tepe, dağ, bataklık, tundra). Dağ, orman ve
  bataklık savunanı güçlendirir, süvarinin kanat sarmasını engeller ve orduları yavaşlatır.
- **Portreler:** Bütün hükümdarlara ve komutanlara yordamsal minyatür portreler: Bizans ikonası gibi yaldızlı zemin,
  kültüre göre taç, sarık, börk, miğfer ve giysiler; yaşa göre ak saç; dinlere göre hale ve süsler.
- **Müzik:** Web Audio ile yordamsal ortaçağ müziği (ses dosyası yok): Latin estampie, Bizans ilahisi, makam / dastgah,
  bozkır türküsü, kuzey ezgileri, Çin pentatoniği; barış ve savaş kipleri, menü teması ve ses efektleri.
  Üst çubuktaki ♫ simgesinden ses düzeyi ve sessiz.
- **Görünüm:** Parşömen dokulu eski harita görünümü, doğal kıvrımlı sınırlar, Cinzel ve EB Garamond fontları.
  Ülke adları yalnızca kendi topraklarına sığacak boyutta yazılır.

## Yol haritası

2. Odak ağaçları: büyük güçlere özel ağaçlar, diğerlerine standart ağaç (İngiltere'ninki hazır)
3. Araştırma: döneme uygun teknolojiler (üzengi, kompozit yay, zincir zırh, Rum ateşi...)
4. Din ve misyonerlik
5. Daha fazla tarihî ve kurgusal olay (Malazgirt, Viking akınları, Arapların Anadolu seferleri...)
6. Diplomasi: ittifaklar, diğer vasallar (Fransa ve Kutsal Roma dükalıkları), deniz geçişleri
7. Kayıt / yükleme
8. Amerika ve Avustralya

## Proje yapısı

```
index.html            oyun sayfası
css/style.css         arayüz stilleri
js/data/world.js      üretilmiş harita verisi (elle düzenlenmez)
js/util.js            sabitler ve yardımcılar
js/state.js           oyun durumu, ülkeler, ordular, savaş / barış
js/sim.js             zaman, hareket, muharebe, kuşatma, insan gücü
js/stability.js       istikrar, huzursuzluk, asimilasyon ve isyanlar
js/save.js            kayıt / yükleme
js/ui_save.js         oyun menüsü ve kayıtlı oyunlar
js/ui_peace.js        barış masası
js/warfare.js         kayıplar, ikmal ve kuşatılmış ordular, bozgun, teslimiyet teklifleri
js/ui_war.js          savaş durumu paneli ve grafiği
js/ui_battle.js       muharebe penceresi
js/ui_bars.js         alt çubuk kipleri: kara, donanma, garnizon
js/geo.js             coğrafi harita, arazi türleri
js/portraits.js       yordamsal hükümdar ve komutan portreleri
js/music.js           yordamsal müzik ve ses efektleri
js/ui_art.js          portreleri, müziği ve ses efektlerini arayüze bağlar
js/ui_pages.js        üst çubuk sayfaları (ekonomi, ordular, atölyeler, olaylar), bildirimler, Esc
css/ornate.css        süslemeler
js/ai.js              yapay zekâ
js/diplomacy.js       ilişkiler, elçiler, ittifak, garanti, geçiş hakkı, savaş gerekçesi
js/focus_trees.js     büyük güçlerin ve ortak odak ağaçları
js/ui_dip.js          diplomasi penceresi
js/economy.js         atölyeler, silahhaneler, teçhizat, kale ve garnizon
js/ui_econ.js         üretim penceresi ve eyalet binaları
js/command.js         ordular, komutanlar, cepheler
js/navy.js            gemiler, tersaneler, deniz savaşı, çıkarma
js/names.js           komutan, kaptan ve gemi adları
js/ui_mil.js          ordu ve donanma arayüzleri
js/focus.js           odak ağaçları
js/events.js          olaylar
js/map.js             harita çizimi
js/ui.js              paneller ve pencereler
js/main.js            başlatma, girdi ve oyun döngüsü
tools/scenario_1040.py  ülkeler ve şehirler (senaryo verisi)
tools/build_map.py      haritayı üretir
fonts/                  Cinzel ve EB Garamond (SIL Open Font License)
```

### Haritayı yeniden üretmek

Ülke veya şehir eklemek için `tools/scenario_1040.py` dosyasını düzenleyin, ardından:

```
pip install shapely scipy numpy
python3 tools/build_map.py
```

Kara verisi Natural Earth'ten (kamu malı) indirilir.
