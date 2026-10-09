# -*- coding: utf-8 -*-
"""Harita üreticisi.

Natural Earth kara verisini (kamu malı) ve scenario_1040.py içindeki şehirleri
kullanarak eyalet poligonlarını (Voronoi) üretir ve js/data/world.js dosyasını yazar.

Kullanım:
    pip install shapely scipy numpy
    python3 tools/build_map.py            # veriyi indirir (gerekirse) ve haritayı üretir
"""
import json
import math
import os
import random
import sys
import urllib.request

import numpy as np
from scipy.spatial import Voronoi, cKDTree
from shapely.geometry import Polygon, MultiPolygon, Point, box, shape, LineString, MultiLineString
from shapely.ops import unary_union
from shapely.prepared import prep

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from scenario_1040 import NATIONS, CITIES, WASTELAND_BOXES, STRAITS, VASSALS, SEA_ZONES  # noqa: E402

CACHE = os.path.join(HERE, ".cache")
NE_BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/"
NE_FILES = ["ne_50m_land.geojson", "ne_50m_lakes.geojson"]

# Harita sınırları (boylam/enlem)
LON0, LAT0, LON1, LAT1 = -26.0, -46.0, 150.0, 72.0
SEA_LAT0 = -46.0       # deniz bölgeleri bu enlemin kuzeyinde
# Amerika kıtası: haritada keşfedilmemiş kara olarak durur (henüz il yok)
AMERICAS_BOX = (-180.0, -56.0, -26.0, 72.0)
# Avustralya'nın doğusu, Yeni Gine'nin ucu ve Yeni Zelanda: o da keşfe kapalı kara
OCEANIA_BOX = (150.0, -56.0, 180.0, -0.5)
AFRICA_MIN_LAT = 10.0  # Afrika'nın bu enlemin güneyi keşfedilmemiş topraktır
# Keşfedilmemiş bölgeler (boylam/enlem kutuları): kara burada çizilir ama eyalet yoktur
UNEXPLORED_BOXES = [
    (-26, -60, 43.0, AFRICA_MIN_LAT),   # Sahraaltı Afrika
    (43.0, -60, 52, 1.0),               # Afrika Boynuzu güneyi ve Madagaskar
    (52, -90, 180, -11.0),              # Avustralya
]
# Keşfedilmemiş toprak yazıları
UNEXPLORED_LABELS = [
    ("Terra Incognita", 21.0, 1.0), ("Bilinmeyen Diyarlar", 24.0, -22.0),
    ("Terra Australis", 134.0, -24.0), ("Bilinmeyen Kıta", -100.0, 47.0), ("Terra Incognita", -60.0, -12.0),
]

# Keşfedilmemiş toprakların illeri: adları en yakın tarihî yer / bölgeden, yerli kültürü ile (boylam, enlem, ad, kültür)
WILD_STEP = 2.5
WILD_ANCHORS = [
    # Batı Afrika
    ("Sherbro", -12.5, 7.8, "mande"), ("Kong", -4.6, 8.9, "mande"), ("Begho", -2.4, 8.2, "akan"), ("Kumasi", -1.6, 6.7, "akan"),
    ("Elmina", -1.35, 5.1, "akan"), ("Kru Kıyısı", -8.5, 5.5, "mande"), ("Oyo", 4.4, 8.9, "yoruba"), ("İfe", 4.56, 7.48, "yoruba"),
    ("Benin", 5.6, 6.3, "edo"), ("Igbo-Ukwu", 7.0, 6.0, "igbo"), ("Nupe", 6.0, 9.4, "yoruba"), ("Jos", 8.9, 9.9, "hausa"),
    ("Adamava", 13.3, 7.5, "sara"), ("Ubangi", 19.0, 5.5, "sara"), ("Şari", 17.5, 8.8, "sara"), ("Duala", 9.7, 4.05, "fang"),
    ("Fang", 11.5, 2.5, "fang"), ("Ogowe", 11.0, -0.8, "fang"), ("Sanga", 16.0, 2.0, "mongo"),
    # Orta Afrika
    ("Mongo", 21.5, -1.0, "mongo"), ("İturi", 28.5, 1.5, "mongo"), ("Uele", 25.0, 3.5, "sara"), ("Loango", 11.85, -4.65, "kongo"),
    ("Mbanza Kongo", 14.25, -6.27, "kongo"), ("Teke", 15.3, -2.5, "kongo"), ("Kuba", 22.0, -5.0, "luba"), ("Luba", 25.5, -7.5, "luba"),
    ("Lunda", 22.5, -9.0, "luba"), ("Katanga", 27.0, -10.5, "luba"), ("Ndongo", 15.0, -9.3, "mbundu"), ("Benguela", 13.4, -12.6, "mbundu"),
    ("Ovambo", 16.0, -17.8, "mbundu"), ("Lozi", 23.0, -15.5, "luba"),
    # Doğu Afrika ve Habeş yaylası
    ("Şewa", 39.0, 9.0, "habes"), ("Damot", 37.0, 9.5, "habes"), ("Harar", 42.1, 9.3, "somali"), ("Oromo", 38.5, 7.0, "oromo"),
    ("Bale", 40.5, 6.8, "oromo"), ("Kaffa", 36.2, 7.3, "oromo"), ("Ogaden", 42.0, 6.5, "somali"), ("Kısmayu", 42.5, -0.4, "somali"),
    ("Sudd", 30.5, 7.5, "nilotik"), ("Dinka", 28.0, 8.5, "nilotik"), ("Nuer", 32.0, 8.5, "nilotik"), ("Turkana", 35.8, 3.5, "nilotik"),
    ("Masai", 36.5, -2.5, "nilotik"), ("Kitara", 31.3, 1.0, "kitara"), ("Ruanda", 29.9, -2.0, "kitara"), ("Kikuyu", 37.0, -0.5, "kitara"),
    ("Malindi", 40.1, -3.2, "svahili"), ("Mombasa", 39.67, -4.05, "svahili"), ("Unguja", 39.3, -6.1, "svahili"),
    ("Kilva", 39.5, -8.9, "svahili"), ("Mozambik", 40.7, -15.0, "svahili"), ("Sofala", 34.8, -20.2, "svahili"),
    ("Unyamvezi", 32.8, -5.0, "nyamwezi"), ("Tanganika", 30.5, -7.5, "nyamwezi"), ("Ugogo", 35.5, -6.2, "nyamwezi"),
    # Güney Afrika
    ("Maravi", 34.0, -13.5, "maravi"), ("Nyasa", 35.0, -11.0, "maravi"), ("Zambezi", 28.0, -16.0, "sona"),
    ("Büyük Zimbabve", 30.93, -20.27, "sona"), ("Mapungubwe", 29.4, -22.2, "sona"), ("Manyika", 32.7, -18.9, "sona"),
    ("Tsvana", 25.0, -24.5, "sotho"), ("Soto", 28.0, -29.5, "sotho"), ("Nguni", 30.5, -27.5, "nguni"), ("Natal", 31.0, -29.8, "nguni"),
    ("Kalahari", 21.5, -22.5, "khoisan"), ("Namib", 15.5, -22.5, "khoisan"), ("Nama", 18.0, -27.5, "khoisan"),
    ("Ümit Burnu", 18.6, -33.9, "khoisan"), ("Karoo", 22.5, -32.0, "khoisan"), ("Kei", 27.5, -32.5, "nguni"),
    # Madagaskar
    ("Mahajanga", 46.3, -15.7, "malgas"), ("Imerina", 47.5, -18.9, "malgas"), ("Toliara", 43.7, -23.4, "malgas"),
    ("Tamatave", 49.4, -18.1, "malgas"), ("Anosy", 46.9, -24.9, "malgas"), ("Antsiranana", 49.3, -12.3, "malgas"),
    # Avustralya
    ("Arnhem", 134.0, -12.5, "aborijin"), ("Kimberley", 126.0, -16.5, "aborijin"), ("Pilbara", 118.5, -21.5, "aborijin"),
    ("Uluru", 131.0, -25.3, "aborijin"), ("Tanami", 130.0, -19.5, "aborijin"), ("Gibson", 124.5, -24.5, "aborijin"),
    ("Nullarbor", 128.5, -30.5, "aborijin"), ("Kati Thanda", 137.3, -28.5, "aborijin"), ("Carpentaria", 140.5, -17.5, "aborijin"),
    ("York Burnu", 142.5, -13.5, "aborijin"), ("Mitchell", 144.5, -21.0, "aborijin"), ("Darling", 145.0, -31.0, "aborijin"),
    ("Murray", 141.0, -34.5, "aborijin"), ("Gadigal", 151.0, -33.8, "aborijin"), ("Turrbal", 153.0, -27.5, "aborijin"),
    ("Yidinji", 145.7, -17.0, "aborijin"), ("Noongar", 115.9, -31.9, "aborijin"), ("Gutharraguda", 113.8, -25.8, "aborijin"),
    ("Kaurna", 138.6, -34.9, "aborijin"), ("Simpson", 136.5, -24.5, "aborijin"), ("Barkly", 136.0, -19.0, "aborijin"),
]

FILLER_STEP = 1.9        # dolgu eyaletlerin ızgara aralığı (projeksiyon birimi)
FILLER_MIN_DIST = 1.45   # şehre bu mesafeden yakın dolgu noktası atılır
OWNER_MAX_DIST = 5.5     # dolgu eyalet en yakın şehre bundan uzaksa ıssız olur
SIMPLIFY = 0.02

# Sınırları doğal göstermek için düzgün bir bükme alanı: her nokta konumuna göre
# aynı miktarda kaydırıldığı için komşu eyaletlerin ortak sınırları birebir örtüşür.
# (genlik, dalga boyu) çiftleri; toplam eğim 1'in altında tutulur ki sınırlar kesişmesin.
WARP_OCTAVES = [(0.13, 2.6), (0.06, 1.25), (0.022, 0.55)]
WARP_SEGMENT = 0.07

DIRS = ["Doğusu", "Kuzeydoğusu", "Kuzeyi", "Kuzeybatısı", "Batısı", "Güneybatısı", "Güneyi", "Güneydoğusu"]


def proj(lon, lat):
    """Miller silindirik projeksiyonu (derece birimli). y aşağı doğru artar."""
    phi = math.radians(max(min(lat, 85), -85))
    y = 1.25 * math.log(math.tan(math.pi / 4 + 0.4 * phi))
    return lon, -math.degrees(y)


def unproj_lat(y):
    yr = math.radians(-y)
    return math.degrees((math.atan(math.exp(yr / 1.25)) - math.pi / 4) / 0.4)


def proj_geom(geom):
    import shapely
    return shapely.transform(geom, lambda c: np.column_stack(_tx(c[:, 0], c[:, 1])))


def _tx(xs, ys, zs=None):
    xs = np.asarray(xs, dtype=float)
    ys = np.asarray(ys, dtype=float)
    phi = np.radians(np.clip(ys, -85, 85))
    py = -np.degrees(1.25 * np.log(np.tan(np.pi / 4 + 0.4 * phi)))
    return xs, py


def fetch():
    os.makedirs(CACHE, exist_ok=True)
    for f in NE_FILES:
        path = os.path.join(CACHE, f)
        if not os.path.exists(path):
            print("indiriliyor:", f)
            urllib.request.urlretrieve(NE_BASE + f, path)


def load_land():
    clip = box(LON0, LAT0, LON1, LAT1)
    africa_south = box(-26, -60, 52, AFRICA_MIN_LAT)  # Afrika'nın güneyini kes
    lands = []
    with open(os.path.join(CACHE, "ne_50m_land.geojson")) as fh:
        for f in json.load(fh)["features"]:
            g = shape(f["geometry"])
            if g.intersects(clip):
                lands.append(g.intersection(clip))
    land = unary_union(lands)
    full = proj_geom(land)   # deniz bölgeleri için kesilmemiş kara
    lakes = []
    with open(os.path.join(CACHE, "ne_50m_lakes.geojson")) as fh:
        for f in json.load(fh)["features"]:
            p = f["properties"]
            if p.get("scalerank", 9) <= 1 and p.get("featurecla") != "Reservoir":
                g = shape(f["geometry"])
                if g.intersects(clip):
                    lakes.append(g)
    if lakes:
        land = land.difference(unary_union(lakes))
    # çok küçük adacıkları at
    parts = [p for p in getattr(land, "geoms", [land]) if p.area > 0.02]
    return proj_geom(MultiPolygon(parts)), full


def load_americas():
    """Amerika kıtası (ve Grönland): yalnızca keşfedilmemiş kara olarak çizilir."""
    clips = [box(*AMERICAS_BOX), box(*OCEANIA_BOX)]
    parts = []
    with open(os.path.join(CACHE, "ne_50m_land.geojson")) as fh:
        for f in json.load(fh)["features"]:
            g = shape(f["geometry"])
            for clip in clips:
                if g.intersects(clip):
                    parts.append(g.intersection(clip))
    g = proj_geom(unary_union(parts)).simplify(0.06, preserve_topology=True)
    return MultiPolygon(polys(g, 0.15))


def polys(g, min_area):
    return [p for p in getattr(g, "geoms", [g]) if isinstance(p, Polygon) and p.area > min_area]


def waste_box(lon, lat):
    for (a, b, c, d, name) in WASTELAND_BOXES:
        if a <= lon <= c and b <= lat <= d:
            return name
    return None


def direction_name(dx, dy):
    ang = math.degrees(math.atan2(-dy, dx)) % 360
    return DIRS[int(((ang + 22.5) % 360) // 45)]


def main():
    fetch()
    print("kara verisi yükleniyor...")
    all_land, full_land = load_land()
    import shapely
    wrng = np.random.RandomState(1040)
    waves = []
    for amp, lam in WARP_OCTAVES:
        for axis in (0, 1):
            ang = wrng.uniform(0, 2 * np.pi)
            k = 2 * np.pi / lam
            waves.append((axis, amp, k * np.cos(ang), k * np.sin(ang), wrng.uniform(0, 2 * np.pi)))

    def warp(c):
        c = np.round(c, 9)
        out = c.copy()
        for axis, amp, kx, ky, ph in waves:
            out[:, axis] += amp * np.sin(kx * c[:, 0] + ky * c[:, 1] + ph)
        return out

    # keşfedilmemiş bölgeler: sınırı da kıvrımlı olsun
    cut = unary_union([proj_geom(box(*b[:4])) for b in UNEXPLORED_BOXES])
    crng = np.random.RandomState(7)
    cwaves = [(amp, 2 * np.pi / lam, crng.uniform(0, 2 * np.pi), crng.uniform(0, 2 * np.pi))
              for amp, lam in [(1.1, 9.0), (0.5, 3.7), (0.2, 1.4)]]

    def wobble(c):
        c = warp(c)
        out = c.copy()
        for amp, k, p1, p2 in cwaves:
            out[:, 1] += amp * np.sin(k * c[:, 0] + p1)
            out[:, 0] += amp * np.sin(k * c[:, 1] + p2)
        return out
    cut = shapely.transform(shapely.segmentize(cut, WARP_SEGMENT), wobble).buffer(0)
    land = MultiPolygon(polys(all_land.difference(cut), 0.02))
    unexplored = MultiPolygon(polys(all_land.intersection(cut), 0.05))
    land_p = prep(land)
    minx, miny, maxx, maxy = land.bounds

    # --- şehirler ---
    seeds = []  # dict(name, owner, x, y, kind)
    seen_capital = set()
    names = set()
    for (name, lon, lat, tag) in CITIES:
        if tag not in NATIONS:
            raise SystemExit("bilinmeyen ülke etiketi: %s (%s)" % (tag, name))
        if name in names:
            raise SystemExit("tekrarlanan şehir adı: %s" % name)
        names.add(name)
        x, y = proj(lon, lat)
        kind = "city"
        if tag not in seen_capital:
            kind = "capital"
            seen_capital.add(tag)
        pt = Point(x, y)
        if not land_p.contains(pt):
            d = land.distance(pt)
            if d > 0.6:
                print("  uyarı: %s karadan %.2f uzakta" % (name, d))
        seeds.append(dict(name=name, owner=tag, x=x, y=y, kind=kind, lon=lon, lat=lat))
    missing = set(NATIONS) - seen_capital
    if missing:
        raise SystemExit("şehri olmayan ülkeler: %s" % sorted(missing))

    city_xy = np.array([[s["x"], s["y"]] for s in seeds])
    tree = cKDTree(city_xy)
    dd, ii = tree.query(city_xy, k=2)
    for k, (d, j) in enumerate(zip(dd[:, 1], ii[:, 1])):
        if d < 0.25:
            print("  uyarı: %s ile %s çok yakın (%.2f)" % (seeds[k]["name"], seeds[j]["name"], d))

    # --- dolgu eyaletler ---
    rng = random.Random(1040)
    fillers = []
    y = miny
    row = 0
    while y <= maxy:
        x = minx + (FILLER_STEP / 2 if row % 2 else 0)
        while x <= maxx:
            jx = x + rng.uniform(-0.35, 0.35) * FILLER_STEP
            jy = y + rng.uniform(-0.35, 0.35) * FILLER_STEP
            if land_p.contains(Point(jx, jy)):
                d, j = tree.query([jx, jy])
                if d > FILLER_MIN_DIST:
                    lat = unproj_lat(jy)
                    near = seeds[j]
                    wbox = waste_box(jx, lat)
                    waste = d > OWNER_MAX_DIST or (wbox is not None and d > 2.2)
                    fillers.append(dict(x=jx, y=jy, near=j, waste=waste, wname=wbox, lon=jx, lat=lat))
            x += FILLER_STEP
        y += FILLER_STEP * 0.87
        row += 1
    # dolgu noktalarının da birbirine yakınlarını ayıkla
    print("şehir: %d, dolgu: %d" % (len(seeds), len(fillers)))

    used_names = set(names)
    for f in fillers:
        near = seeds[f["near"]]
        if f["waste"]:
            f.update(name=f["wname"] or "Issız Topraklar", owner=None, kind="waste")
        else:
            base = "%s %s" % (near["name"], direction_name(f["x"] - near["x"], f["y"] - near["y"]))
            nm = base
            n = 2
            while nm in used_names:
                nm = "%s %d" % (base, n)
                n += 1
            used_names.add(nm)
            f.update(name=nm, owner=near["owner"], kind="rural", home=near["name"])
        seeds.append(f)

    pts = np.array([[s["x"], s["y"]] for s in seeds])
    # çerçeve noktaları: sonsuz Voronoi bölgelerini kapat
    pad = 30
    frame = []
    for t in np.linspace(minx - pad, maxx + pad, 40):
        frame += [[t, miny - pad], [t, maxy + pad]]
    for t in np.linspace(miny - pad, maxy + pad, 40):
        frame += [[minx - pad, t], [maxx + pad, t]]
    allpts = np.vstack([pts, np.array(frame)])
    vor = Voronoi(allpts)

    print("poligonlar kesiliyor...")
    geoms = []
    for i in range(len(seeds)):
        reg = vor.regions[vor.point_region[i]]
        if -1 in reg or not reg:
            geoms.append(None)
            continue
        poly = Polygon(vor.vertices[reg])
        poly = shapely.segmentize(poly, WARP_SEGMENT)
        poly = shapely.transform(poly, warp)
        if not poly.is_valid:
            poly = poly.buffer(0)
        g = poly.intersection(land)
        if g.is_empty:
            geoms.append(None)
            continue
        # yalnızca poligon parçalarını tut
        parts = [p for p in getattr(g, "geoms", [g]) if isinstance(p, Polygon) and p.area > 1e-4]
        if not parts:
            geoms.append(None)
            continue
        geoms.append(MultiPolygon(parts) if len(parts) > 1 else parts[0])

    # boş kalan eyaletleri at, yeni id ver
    keep = [i for i, g in enumerate(geoms) if g is not None]
    newid = {old: k for k, old in enumerate(keep)}
    print("eyalet sayısı:", len(keep))

    # --- komşuluk ve sınır çizgileri ---
    neighbors = {k: set() for k in range(len(keep))}
    edges = []
    for (a, b) in vor.ridge_points:
        if a in newid and b in newid:
            ga, gb = geoms[a], geoms[b]
            inter = ga.intersection(gb)
            if inter.is_empty:
                continue
            lines = []
            for part in getattr(inter, "geoms", [inter]):
                if isinstance(part, (LineString,)) and part.length > 0.005:
                    lines.append(part)
            if not lines:
                continue
            na, nb = newid[a], newid[b]
            neighbors[na].add(nb)
            neighbors[nb].add(na)
            ml = unary_union(lines)
            try:
                from shapely.ops import linemerge
                ml = linemerge(ml)
            except Exception:
                pass
            segs = []
            for ln in getattr(ml, "geoms", [ml]):
                ln = ln.simplify(SIMPLIFY)
                segs.append([round(v, 2) for xy in ln.coords for v in xy])
            edges.append([na, nb, segs])

    byname = {seeds[i]["name"]: newid[i] for i in keep if seeds[i]["kind"] != "waste"}
    for (a, b) in STRAITS:
        if a not in byname or b not in byname:
            print("  uyarı: boğaz bulunamadı", a, b)
            continue
        neighbors[byname[a]].add(byname[b])
        neighbors[byname[b]].add(byname[a])

    build_wild(unexplored, full_land, seeds, geoms, keep, newid, neighbors, edges, warp)

    # --- çıktı ---
    provinces = []
    for i in keep:
        s = seeds[i]
        g = geoms[i]
        rings = []
        for p in getattr(g, "geoms", [g]):
            p = p.simplify(SIMPLIFY, preserve_topology=True)
            if p.is_empty:
                continue
            rings.append([round(v, 2) for xy in list(p.exterior.coords)[:-1] for v in xy])
            for hole in p.interiors:
                rings.append([round(v, 2) for xy in list(hole.coords)[:-1] for v in xy])
        cx, cy = s["x"], s["y"]
        if not g.contains(Point(cx, cy)):
            big = max(getattr(g, "geoms", [g]), key=lambda p: p.area)
            rp = big.representative_point()
            if s["kind"] in ("rural", "waste", "wild"):
                cx, cy = rp.x, rp.y
        # ortalama alan (km²) - yaklaşık
        lat = s["lat"]
        area_km2 = g.area * (111.0 ** 2) * math.cos(math.radians(lat)) / max(0.6, 1 / math.cos(math.radians(min(abs(lat), 70))))
        provinces.append(dict(
            id=newid[i], name=s["name"], owner=s["owner"], kind=s["kind"],
            x=round(cx, 2), y=round(cy, 2), area=int(area_km2),
            nb=sorted(neighbors[newid[i]]), poly=rings,
        ))
        if s.get("home"):
            provinces[-1]["home"] = s["home"]
        if s["kind"] == "wild":
            provinces[-1]["cul"] = s["cul"]
            if s["coast"]:
                provinces[-1]["coast"] = 1

    nations = {}
    for tag, (name, color, major, ruler, religion, group) in NATIONS.items():
        nations[tag] = dict(name=name, color=color, major=major, ruler=ruler, religion=religion, group=group)

    americas = load_americas()
    ux0, uy0, ux1, uy1 = unary_union([unexplored, americas]).bounds
    unk = []
    drawn = unary_union([unexplored, americas])   # tek parça çizilsin: 150. boylamda dikiş kalmasın
    for p in getattr(drawn, "geoms", [drawn]):
        p = p.simplify(0.04, preserve_topology=True)
        unk.append([round(v, 2) for xy in list(p.exterior.coords)[:-1] for v in xy])
        for h in p.interiors:
            unk.append([round(v, 2) for xy in list(h.coords)[:-1] for v in xy])
    unk_labels = [dict(name=n, x=round(proj(lo, la)[0], 2), y=round(proj(lo, la)[1], 2)) for (n, lo, la) in UNEXPLORED_LABELS]
    world = dict(
        bounds=[round(min(minx, ux0), 2), round(min(miny, uy0), 2), round(max(maxx, ux1), 2), round(max(maxy, uy1), 2)],
        unexplored=unk, unexploredLabels=unk_labels,
        nations=nations, provinces=provinces, edges=edges, vassals=VASSALS,
        seas=build_seas(full_land, keep, newid, geoms, provinces),
        geo=build_geo(full_land, provinces, seeds, keep, newid, geoms),
    )
    world["seaEdges"] = SEA_EDGES
    out = os.path.join(ROOT, "js", "data", "world.js")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("// Bu dosya tools/build_map.py tarafından üretilir. Elle düzenlemeyin.\n")
        fh.write("window.WORLD = ")
        json.dump(world, fh, ensure_ascii=False, separators=(",", ":"))
        fh.write(";\n")
    print("yazıldı:", out, "%.1f KB" % (os.path.getsize(out) / 1024))
    counts = {}
    for p in provinces:
        counts[p["kind"]] = counts.get(p["kind"], 0) + 1
    print(counts)


def build_wild(unexplored, full_land, seeds, geoms, keep, newid, neighbors, edges, warp):
    """Keşfedilmemiş topraklara iller: oyunda kâşiflerle açılır, koloni kurulabilir."""
    import shapely
    from shapely.strtree import STRtree
    print("keşfedilmemiş iller...")
    land_p = prep(unexplored)
    full_p = prep(full_land)
    rng = random.Random(77)
    minx, miny, maxx, maxy = unexplored.bounds
    # ızgara eski haritadaki gibi aynı noktadan başlar: eski illerin sırası ve kimlikleri korunur;
    # sonradan eklenen güney toprakları (Avustralya'nın güneyi, Tazmanya) en sona eklenir
    minx, miny, OLD_MAXY = -14.613623, -11.811314274715086, 37.619367419566196
    pts = []
    later = []
    y = miny
    row = 0
    while y <= maxy:
        x = minx + (WILD_STEP / 2 if row % 2 else 0)
        while x <= maxx:
            jx = x + rng.uniform(-0.3, 0.3) * WILD_STEP
            jy = y + rng.uniform(-0.3, 0.3) * WILD_STEP
            if land_p.contains(Point(jx, jy)):
                (later if jy > OLD_MAXY else pts).append((jx, jy))
            x += WILD_STEP
        y += WILD_STEP * 0.87
        row += 1
    # küçük adalara da birer nokta
    for part in unexplored.geoms:
        if part.area > 0.6 and part.bounds[3] <= OLD_MAXY and not any(part.contains(Point(p)) for p in pts):
            rp = part.representative_point()
            pts.append((rp.x, rp.y))
    pts += later
    for part in unexplored.geoms:
        if part.area > 0.6 and part.bounds[3] > OLD_MAXY and not any(part.contains(Point(p)) for p in pts):
            rp = part.representative_point()
            pts.append((rp.x, rp.y))
    anc = [(proj(lo, la), nm, cul) for (nm, lo, la, cul) in WILD_ANCHORS]
    arr = np.array(pts)
    pad = 30
    frame = []
    for t in np.linspace(minx - pad, maxx + pad, 30):
        frame += [[t, miny - pad], [t, maxy + pad]]
    for t in np.linspace(miny - pad, maxy + pad, 30):
        frame += [[minx - pad, t], [maxx + pad, t]]
    vor = Voronoi(np.vstack([arr, np.array(frame)]))
    base = len(seeds)
    first_id = len(keep)
    wild_geoms = []
    for i, (x, y) in enumerate(pts):
        reg = vor.regions[vor.point_region[i]]
        if -1 in reg or not reg:
            wild_geoms.append(None)
            continue
        poly = shapely.transform(shapely.segmentize(Polygon(vor.vertices[reg]), WARP_SEGMENT), warp)
        if not poly.is_valid:
            poly = poly.buffer(0)
        g = poly.intersection(unexplored)
        parts = [p for p in getattr(g, "geoms", [g]) if isinstance(p, Polygon) and p.area > 1e-3]
        wild_geoms.append(MultiPolygon(parts) if len(parts) > 1 else parts[0] if parts else None)
    # adlar: en yakın tarihî yer; aynı yere düşen illere yön eklenir
    groups = {}
    for i, (x, y) in enumerate(pts):
        if wild_geoms[i] is None:
            continue
        d, k = min((math.hypot(x - a[0][0], y - a[0][1]), k) for k, a in enumerate(anc))
        groups.setdefault(k, []).append((d, i))
    names = {}
    for k, lst in groups.items():
        lst.sort()
        (ax, ay), nm, cul = anc[k]
        used = set()
        for j, (d, i) in enumerate(lst):
            if j == 0:
                n = nm
            else:
                n = "%s %s" % (nm, direction_name(pts[i][0] - ax, pts[i][1] - ay))
                c = 2
                base_n = n
                while n in used:
                    n = "%s %d" % (base_n, c)
                    c += 1
            used.add(n)
            names[i] = (n, cul)
    local = {}
    for i, (x, y) in enumerate(pts):
        g = wild_geoms[i]
        if g is None:
            continue
        n, cul = names[i]
        coast = not full_p.contains(g.buffer(0.12))
        seeds.append(dict(name=n, owner=None, kind="wild", x=x, y=y, lon=x, lat=unproj_lat(y), cul=cul, coast=coast))
        geoms.append(g)
        idx = len(seeds) - 1
        keep.append(idx)
        newid[idx] = len(keep) - 1
        neighbors[newid[idx]] = set()
        local[i] = newid[idx]

    def add_edge(a, b, shared):
        lines = [ln for ln in getattr(shared, "geoms", [shared]) if isinstance(ln, LineString) and ln.length > 0.005]
        if not lines or sum(l.length for l in lines) < 0.03:
            return
        neighbors[a].add(b)
        neighbors[b].add(a)
        ml = unary_union(lines)
        try:
            from shapely.ops import linemerge
            ml = linemerge(ml)
        except Exception:
            pass
        segs = []
        for ln in getattr(ml, "geoms", [ml]):
            ln = ln.simplify(SIMPLIFY)
            segs.append([round(v, 2) for xy in ln.coords for v in xy])
        edges.append([a, b, segs])
    # yabani iller arası komşuluk
    for (a, b) in vor.ridge_points:
        if a in local and b in local:
            ga, gb = wild_geoms[a], wild_geoms[b]
            add_edge(local[a], local[b], ga.boundary.intersection(gb.buffer(0.003)))
    # bilinen dünyayla sınır
    main_ids = [k for k in range(first_id)]
    main_geoms = [geoms[keep[k]] for k in main_ids]
    tree = STRtree(main_geoms)
    for i, wid in local.items():
        g = wild_geoms[i]
        for k in tree.query(g.buffer(0.01)):
            mg = main_geoms[k]
            if mg.distance(g) > 0.003:
                continue
            add_edge(main_ids[k], wid, mg.boundary.intersection(g.buffer(0.003)))
    print("yabani il:", len(local))


SEA_EDGES = []


def build_seas(full_land, keep, newid, geoms, provinces):
    """Deniz bölgelerini üretir; kıyı eyaletlerine komşu deniz bölgelerini yazar."""
    global SEA_EDGES
    import shapely
    from shapely.strtree import STRtree
    print("deniz bölgeleri...")
    x0, y0 = proj(LON0, LAT1)
    x1, y1 = proj(LON1, SEA_LAT0)
    sea = box(x0, y0, x1, y1).difference(full_land)
    seeds = [proj(lon, lat) for (_, lon, lat) in SEA_ZONES]
    pts = np.array(seeds)
    pad = 60
    frame = []
    for t in np.linspace(x0 - pad, x1 + pad, 30):
        frame += [[t, y0 - pad], [t, y1 + pad]]
    for t in np.linspace(y0 - pad, y1 + pad, 30):
        frame += [[x0 - pad, t], [x1 + pad, t]]
    vor = Voronoi(np.vstack([pts, np.array(frame)]))
    zones = []
    orphans = []
    # deniz sınırları düz Voronoi çizgileri yerine akıntı gibi kıvrılsın (aynı bükme her hücreye uygulanır)
    srng = np.random.RandomState(11)
    swaves = [(amp, 2 * np.pi / lam, srng.uniform(0, 2 * np.pi), srng.uniform(0, 2 * np.pi)) for amp, lam in [(0.9, 11.0), (0.45, 4.6), (0.15, 1.7)]]

    def seawarp(c):
        out = c.copy()
        for amp, k, p1, p2 in swaves:
            out[:, 1] += amp * np.sin(k * c[:, 0] + p1)
            out[:, 0] += amp * np.sin(k * c[:, 1] + p2)
        return out
    for i, (name, lon, lat) in enumerate(SEA_ZONES):
        reg = vor.regions[vor.point_region[i]]
        cell = Polygon(vor.vertices[reg]).buffer(0)
        cell = shapely.transform(shapely.segmentize(cell, 0.2), seawarp).buffer(0)
        g = cell.intersection(sea)
        parts = [p for p in getattr(g, "geoms", [g]) if isinstance(p, Polygon) and p.area > 0.01]
        if not parts:
            zones.append(None)
            print("  uyarı: deniz bölgesi boş:", name)
            continue
        sp = Point(seeds[i])
        main = min(parts, key=lambda p: p.distance(sp) - p.area * 1e-6)
        zones.append(main)
        orphans += [p for p in parts if p is not main]
    # ana parçasından kopuk parçaları sınır paylaştığı bölgeye kat
    for _ in range(6):
        left = []
        for o in orphans:
            best, bl = None, 0.0
            for k, z in enumerate(zones):
                if z is None or not z.intersects(o):
                    continue
                l = z.intersection(o).length
                if l > bl:
                    best, bl = k, l
            if best is None or bl < 1e-3:
                left.append(o)
            else:
                zones[best] = unary_union([zones[best], o])
        if len(left) == len(orphans):
            break
        orphans = left
    # komşuluk
    zid = [k for k, z in enumerate(zones) if z is not None]
    znew = {old: n for n, old in enumerate(zid)}
    zgeoms = [zones[k] for k in zid]
    zcent = []
    for k, z in zip(zid, zgeoms):
        sp = Point(seeds[k])
        c = sp if z.contains(sp) else z.representative_point()
        zcent.append((c.x, c.y))
    znb = {n: set() for n in range(len(zid))}
    for a in range(len(zgeoms)):
        for b in range(a + 1, len(zgeoms)):
            if zgeoms[a].distance(zgeoms[b]) < 1e-6:
                inter = zgeoms[a].intersection(zgeoms[b])
                if inter.length > 0.05:
                    znb[a].add(b); znb[b].add(a)
                    lines = [ln for ln in getattr(inter, "geoms", [inter]) if isinstance(ln, LineString)]
                    if lines:
                        from shapely.ops import linemerge
                        ml = linemerge(unary_union(lines)) if len(lines) > 1 else lines[0]
                        for ln in getattr(ml, "geoms", [ml]):
                            ln = ln.simplify(0.03)
                            if ln.length > 0.05:
                                SEA_EDGES.append([round(v, 2) for xy in ln.coords for v in xy])
    # kıyı eyaletleri
    tree = STRtree(zgeoms)
    coast = {}
    for i in keep:
        g = geoms[i]
        gb = g.buffer(0.03)
        for zi in tree.query(gb):
            if zgeoms[zi].intersects(gb) and zgeoms[zi].intersection(gb).area > 1e-4:
                coast.setdefault(newid[i], []).append(int(zi))
    for p in provinces:
        if p["id"] in coast:
            p["sea"] = sorted(coast[p["id"]])
    out = []
    for n, (k, z) in enumerate(zip(zid, zgeoms)):
        rings = []
        z = z.simplify(0.03, preserve_topology=True)
        for part in getattr(z, "geoms", [z]):
            rings.append([round(v, 2) for xy in list(part.exterior.coords)[:-1] for v in xy])
            for h in part.interiors:
                rings.append([round(v, 2) for xy in list(h.coords)[:-1] for v in xy])
        out.append(dict(id=n, name=SEA_ZONES[k][0], x=round(zcent[n][0], 2), y=round(zcent[n][1], 2),
                        nb=sorted(znb[n]), poly=rings))
    print("deniz bölgesi:", len(out), "kıyı eyaleti:", len(coast))
    return out


# ------------------------------------------------------------ coğrafya: dağlar, çöller, nehirler, arazi türleri
GEO_NAMES = {
    "ALPS": "Alpler", "CAUCASUS MTS.": "Kafkas Dağları", "Lesser Caucasus": "Küçük Kafkaslar", "URAL MOUNTAINS": "Ural Dağları",
    "TIAN SHAN": "Tanrı Dağları", "HIMALAYAS": "Himalaya", "ZAGROS MOUNTAINS": "Zagros Dağları", "ALTAY MOUNTAINS": "Altay Dağları",
    "PAMIRS": "Pamir", "HINDU KUSH": "Hindukuş", "KARAKORAM RA.": "Karakurum", "KUNLUN MOUNTAINS": "Kunlun Dağları",
    "ATLAS MOUNTAINS": "Atlas Dağları", "HAUT ATLAS": "Yüksek Atlas", "ATLAS SAHARIEN": "Sahra Atlası", "CARPATHIAN MOUNTAINS": "Karpatlar",
    "APPENNINI": "Apeninler", "PYRENEES": "Pireneler", "Balkan Mts.": "Balkan Dağları", "Dinaric Alps": "Dinar Alpleri",
    "ELBURZ MTS.": "Elburz Dağları", "PONTIC MOUNTAINS": "Karadeniz Dağları", "KJØLEN MOUNTAINS": "İskandinav Dağları",
    "ETHIOPIAN HIGHLANDS": "Habeş Yaylası", "HEJAZ MTS.": "Hicaz Dağları", "ASIR MTS.": "Asir Dağları", "Hadhramaut": "Hadramut",
    "Qinling Mountains": "Qinling Dağları", "Taihang Mts.": "Taihang Dağları", "Yin Mts.": "Yin Dağları",
    "GREATER KHINGAN RANGE": "Büyük Hingan", "Hangayn Mts.": "Hangay Dağları", "Cord. Cantábrica": "Kantabria Dağları",
    "Sierra Morena": "Sierra Morena", "KUH RUD MOUNTAINS": "Kuhrud Dağları", "TIBESTI MTS.": "Tibesti", "AHAGGAR MTS.": "Hoggar",
    "SAHARA": "Büyük Sahra", "GOBI DESERT": "Gobi Çölü", "RUB’ AL KHALI": "Rub'ülhâli", "TAKLIMAKAN DESERT": "Taklamakan Çölü",
    "GARAGUM DESERT": "Karakum Çölü", "QIZILQUM DESERT": "Kızılkum Çölü", "LUT DESERT": "Lut Çölü", "SYRIAN DESERT": "Suriye Çölü",
    "NUBIAN DESERT": "Nubya Çölü", "LIBYAN DESERT": "Libya Çölü", "WESTERN DESERT": "Batı Çölü", "THAR DESERT": "Thar Çölü",
    "PLATEAU OF TIBET": "Tibet Yaylası", "DECCAN PLATEAU": "Dekken Yaylası", "MONGOLIAN PLATEAU": "Moğol Yaylası",
    "PENÍNSULA IBÉRICA": "Meseta", "KAZAKH UPLAND": "Kazak Yaylası", "Ustyurt Plateau": "Üstyurt", "Loess Plateau": "Lös Yaylası",
    "CENTRAL RUSSIAN UPLAND": "Orta Rus Yaylası", "BETPAQDALA DESERT": "Betpakdala", "Mu Us Desert": "Ordos",
    "TOROS": "Toros Dağları",
}
EXTRA_MOUNTAINS = [("TOROS", [(29.5, 36.9), (33, 36.4), (36.5, 36.9), (38, 37.8), (36.5, 38.2), (33, 37.6), (30, 37.6)]),
                   ("", [(38.5, 38.4), (41, 38.2), (44, 38.6), (44.5, 40.2), (41.5, 40.6), (39, 39.8)])]
RIVER_NAMES = {
    "Danube": "Tuna", "Volga": "İdil", "Nile": "Nil", "Euphrates": "Fırat", "Tigris": "Dicle", "Dnieper": "Özü", "Don": "Ten",
    "Amu Darya": "Ceyhun", "Syr Darya": "Seyhun", "Indus": "Sind", "Ganges": "Ganj", "Huang": "Sarı Irmak", "Yangtze": "Yangzi",
    "Rhine": "Ren", "Rhône": "Ron", "Loire": "Loire", "Seine": "Sen", "Elbe": "Elbe", "Vistula": "Vistül", "Oder": "Oder",
    "Dniester": "Turla", "Ural": "Yayık", "Kura": "Kür", "Ob": "Ob", "Irtysh": "İrtiş", "Kama": "Kama", "Po": "Po",
    "Ebro": "Ebro", "Tagus": "Tejo", "Kızılırmak": "Kızılırmak", "Sakarya": "Sakarya", "Western Dvina": "Düna", "Neva": "Neva",
    "Amur": "Amur", "Brahmaputra": "Brahmaputra", "Mekong": "Mekong", "Ili": "İli", "Tarim": "Tarım", "Helmand": "Hilmend",
}


def wild_terrain(lon, lat, share, near_river, rnd):
    """Keşfedilmemiş toprakların arazisi: tropik ormanlar, savanlar, çöller."""
    if share.get("dag", 0) > 0.3:
        return "dag"
    if share.get("bataklik", 0) > 0.3:
        return "bataklik"
    if lon > 100:   # Avustralya
        if lat > -16:
            return "orman" if rnd.random() < 0.45 else "ova"
        if lon > 147.5 or (lon < 118 and lat < -30):
            return "orman" if rnd.random() < 0.5 else "ova"
        if share.get("col", 0) > 0.2 or (122 < lon < 142 and -31 < lat < -19):
            return "col"
        return "bozkir"
    if lon > 43 and lat < -11:   # Madagaskar
        return "orman" if lon > 47.5 else "ova"
    if share.get("col", 0) > 0.3 and not near_river:
        return "col"
    if share.get("yayla", 0) > 0.4 or share.get("dag", 0) > 0.12:
        return "tepe"
    if (13 < lon < 28 and -29 < lat < -18) or (lon < 16 and lat < -16):
        return "col"
    if -5 < lat < 5 and 8 < lon < 31:
        return "orman"
    if lat > 3 and lon < 10:
        return "orman" if lat < 7.5 else "ova"
    if lat > 5:
        return "ova" if rnd.random() < 0.6 else "bozkir"
    return "ova" if rnd.random() < 0.55 else "bozkir"


def build_geo(full_land, provinces, seeds, keep, newid, geoms):
    """Dağlar, çöller, yaylalar ve nehirler; eyaletlere arazi türü."""
    import random
    print("coğrafya...")
    clip = box(LON0, LAT0, LON1, LAT1)
    cls_map = {"Range/mtn": "dag", "Desert": "col", "Plateau": "yayla", "Wetlands": "bataklik", "Delta": "bataklik", "Tundra": "tundra"}
    regions = []
    with open(os.path.join(CACHE, "ne_50m_geography_regions_polys.geojson")) as fh:
        for f in json.load(fh)["features"]:
            pr = f["properties"]
            c = cls_map.get(pr.get("FEATURECLA"))
            if not c:
                continue
            g = shape(f["geometry"])
            if not g.intersects(clip):
                continue
            regions.append((c, pr.get("NAME"), g.intersection(clip)))
    for name, pts in EXTRA_MOUNTAINS:
        regions.append(("dag", name, Polygon(pts).buffer(0.25)))
    out_regions = []
    proj_regions = []
    for c, name, g in regions:
        pg = proj_geom(g).intersection(full_land)
        if pg.is_empty:
            continue
        proj_regions.append((c, pg))
        rings = []
        for part in getattr(pg, "geoms", [pg]):
            if not isinstance(part, Polygon) or part.area < 0.05:
                continue
            part = part.simplify(0.06, preserve_topology=True)
            rings.append([round(v, 2) for xy in list(part.exterior.coords)[:-1] for v in xy])
        if not rings:
            continue
        lp = pg.representative_point() if not isinstance(pg, Polygon) else pg.representative_point()
        big = max(getattr(pg, "geoms", [pg]), key=lambda p: p.area)
        lp = big.representative_point()
        tr = GEO_NAMES.get(name)
        out_regions.append(dict(c=c, name=tr or "", x=round(lp.x, 2), y=round(lp.y, 2), poly=rings,
                                area=round(big.area, 1)))
    # nehirler
    rivers = []
    river_proj = []
    with open(os.path.join(CACHE, "ne_50m_rivers_lake_centerlines.geojson")) as fh:
        for f in json.load(fh)["features"]:
            pr = f["properties"]
            if pr.get("featurecla") != "River" or (pr.get("scalerank") or 9) > 7:
                continue
            g = shape(f["geometry"])
            if not g.intersects(clip):
                continue
            g = proj_geom(g.intersection(clip))
            river_proj.append(g)
            lines = []
            for ln in getattr(g, "geoms", [g]):
                if not isinstance(ln, LineString) or ln.length < 0.3:
                    continue
                ln = ln.simplify(0.04)
                lines.append([round(v, 2) for xy in ln.coords for v in xy])
            if not lines:
                continue
            nm = pr.get("name_en") or pr.get("name") or ""
            rivers.append(dict(name=RIVER_NAMES.get(nm, ""), w=int(pr.get("scalerank") or 6), lines=lines))
    # eyalet arazi türü
    from shapely.strtree import STRtree
    rgeoms = [g for _, g in proj_regions]
    rtree = STRtree(rgeoms)
    rivers_u = unary_union(river_proj) if river_proj else None
    rnd = random.Random(1040)
    counts = {}
    for p in provinces:
        g = geoms[keep[p["id"]]]
        lon = p["x"]
        lat = unproj_lat(p["y"])
        share = {}
        for k in rtree.query(g):
            c = proj_regions[k][0]
            a = rgeoms[k].intersection(g).area
            if a > 0:
                share[c] = share.get(c, 0) + a / g.area
        near_river = rivers_u is not None and rivers_u.distance(Point(p["x"], p["y"])) < 0.45
        if share.get("dag", 0) > 0.35:
            t = "dag"
        elif share.get("col", 0) > 0.45 and not near_river:
            t = "col"
        elif share.get("bataklik", 0) > 0.3:
            t = "bataklik"
        elif lat > 64 or share.get("tundra", 0) > 0.3:
            t = "tundra"
        elif share.get("dag", 0) > 0.12 or share.get("yayla", 0) > 0.4:
            t = "tepe"
        elif lat > 56 and lon > 22:
            t = "tayga"
        elif lat < 24 and lon > 72:
            t = "orman" if rnd.random() < 0.6 else "ova"
        elif 44 <= lat < 50.5 and 27 < lon < 60:
            t = "bozkir"
        elif 44 <= lat <= 57 and lon < 42:
            t = "orman" if rnd.random() < 0.5 else "ova"
        elif 38 <= lat <= 53 and 30 <= lon <= 125:
            t = "bozkir"
        elif lat < 31 and (lon < 60 or share.get("col", 0) > 0.2) and not near_river:
            t = "col"
        else:
            t = "ova"
        if p["kind"] == "wild":
            t = wild_terrain(lon, lat, share, near_river, rnd)
        if p["kind"] == "waste":
            nm = p["name"]
            t = "tundra" if any(k in nm for k in ("Sibirya", "Tundra", "Laponya")) else "orman" if "Orman" in nm or "Ezo" in nm \
                else "dag" if "Yayla" in nm or "Çangtang" in nm else "tayga" if lat > 56 else "col"
        p["terrain"] = t
        counts[t] = counts.get(t, 0) + 1
    print("arazi:", counts, "bölge:", len(out_regions), "nehir:", len(rivers))
    return dict(regions=out_regions, rivers=rivers)


if __name__ == "__main__":
    main()
