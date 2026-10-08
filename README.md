# Strateji 1040

HOI4 tarzında, Orta Çağ'da geçen bir büyük strateji oyunu. Senaryo 1040'ta başlar ve yaklaşık 80 yıl sürer (1120'ye kadar).
Harita Avrasya ve Kuzey Afrika'yı kapsar: 140'tan fazla ülke ve 3.000'den fazla eyalet.

## Nasıl oynanır

Kurulum gerekmez. `index.html` dosyasını tarayıcıda açmanız yeterli.

| Kontrol | İşlev |
|---|---|
| Sol tık | Eyalet seç (aynı eyalete ikinci tık ülke panelini açar) / orduya tıkla |
| Sol tıkla sürükle, WASD, ok tuşları | Haritayı kaydır |
| Shift + sürükle | Kutu içindeki orduları seç |
| Sağ tık | Seçili orduları yürüt / saldır |
| Fare tekerleği | Yakınlaştır / uzaklaştır |
| Boşluk | Duraklat / devam |
| 1–5, + / - | Oyun hızı |
| Esc | Seçimi bırak |

## Şu an oyunda olanlar (1. sürüm)

- **Harita:** Gerçek kıyı şeritleri (Natural Earth). Her şehir bir eyalet, aralarda kırsal eyaletler, çöl ve tundralar geçilemez.
- **Ülkeler:** 10 büyük güç (Bizans, Büyük Selçuklu, Fâtımî, Kutsal Roma, Fransa, Kiev Rus'u, Danimarka-İngiltere,
  Gazneliler, Song, Liao) ve yaklaşık 130 küçük ülke. Hepsi oynanabilir.
- **Zaman:** HOI4 gibi saatlik takvim, duraklatma ve 5 hız kademesi.
- **Ordular:** Hareket, muharebe (örgütlenme ve mevcut), geri çekilme, kuşatılıp imha edilme. Kültüre göre süvari oranı
  (bozkır orduları hızlı ve saldırıda güçlü).
- **Kuşatma:** Kaleli şehirler ve başkentler hemen düşmez.
- **Savaş ve barış:** Savaş ilanı, savaş skoru, toprak devriyle barış veya beyaz barış, ateşkes ve teslimiyet.
- **İnsan gücü:** Eyaletlerden aylık asker gelir. Yeni ordu toplama (60 gün eğitim) ve takviye.
- **Yapay zekâ:** Savaş ilan eder, cephe kurar, kuşatır, barış yapar ve asker toplar.
- **Olaylar:** Macbeth'in tahta çıkışı (1040), Petar Delyan ayaklanması (1040), Normanların Melfi'yi alışı (1041),
  Büyük Ayrılık (1054).
- **Harita modları:** Siyasi ve din.

## Yol haritası

1. Ekonomi: atölyeler, teçhizat üretimi (kılıç, zırh, yay, at)
2. Odak ağaçları: büyük güçlere özel ağaçlar, diğerlerine standart ağaç
3. Araştırma: döneme uygun teknolojiler (üzengi, kompozit yay, zincir zırh, Rum ateşi...)
4. Din ve misyonerlik
5. Daha fazla tarihî ve kurgusal olay (Malazgirt, Viking akınları, Arapların Anadolu seferleri...)
6. Diplomasi: ittifaklar ve vasallık (vasalların ana ülkeden ayrılması)
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
js/ai.js              yapay zekâ
js/events.js          olaylar
js/map.js             harita çizimi
js/ui.js              paneller ve pencereler
js/main.js            başlatma, girdi ve oyun döngüsü
tools/scenario_1040.py  ülkeler ve şehirler (senaryo verisi)
tools/build_map.py      haritayı üretir
```

### Haritayı yeniden üretmek

Ülke veya şehir eklemek için `tools/scenario_1040.py` dosyasını düzenleyin, ardından:

```
pip install shapely scipy numpy
python3 tools/build_map.py
```

Kara verisi Natural Earth'ten (kamu malı) indirilir.
