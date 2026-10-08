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
LON0, LAT0, LON1, LAT1 = -26.0, -11.0, 150.0, 72.0
AFRICA_MIN_LAT = 10.0  # Afrika'nın bu enlemin güneyi haritaya dahil edilmez

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
    # Arabistan'ı koru: Afrika kesimi yalnızca Kızıldeniz'in batısında
    land = land.difference(box(-26, -60, 43.0, AFRICA_MIN_LAT))
    land = land.difference(box(43.0, -60, 52, 1.0))  # Afrika Boynuzu güneyi
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
    land, full_land = load_land()
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
            if s["kind"] in ("rural", "waste"):
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

    nations = {}
    for tag, (name, color, major, ruler, religion, group) in NATIONS.items():
        nations[tag] = dict(name=name, color=color, major=major, ruler=ruler, religion=religion, group=group)

    world = dict(
        bounds=[round(minx, 2), round(miny, 2), round(maxx, 2), round(maxy, 2)],
        nations=nations, provinces=provinces, edges=edges, vassals=VASSALS,
        seas=build_seas(full_land, keep, newid, geoms, provinces),
    )
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


def build_seas(full_land, keep, newid, geoms, provinces):
    """Deniz bölgelerini üretir; kıyı eyaletlerine komşu deniz bölgelerini yazar."""
    from shapely.strtree import STRtree
    print("deniz bölgeleri...")
    x0, y0 = proj(LON0, LAT1)
    x1, y1 = proj(LON1, LAT0)
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
    for i, (name, lon, lat) in enumerate(SEA_ZONES):
        reg = vor.regions[vor.point_region[i]]
        cell = Polygon(vor.vertices[reg]).buffer(0)
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


if __name__ == "__main__":
    main()
