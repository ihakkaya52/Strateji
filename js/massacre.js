// Katliam: bir ilin bütün halkı kılıçtan geçirilir ve yerine kendi halkımız yerleştirilir.
// Çok nadir kullanılabilir, bedeli ağırdır ve emri veren hükümdar kötü bir unvanla anılır.
'use strict';

G.massacre = {};
(function () {
  const MS = G.massacre;
  const YEAR = 24 * 365;
  MS.COOLDOWN = 15;          // yıl: aynı ülke bu kadar süre yeni bir katliam emri veremez
  MS.RUIN_YEARS = 30;        // il bu kadar yıl ıssız kalır (vergi ve insan gücü çok düşük)
  MS.STAB = 25;              // istikrar kaybı
  const TITLES = ['Kanlı', 'Kasap', 'Merhametsiz', 'Kılıç Kral', 'Şehir Yakan'];

  // Hangi illerde emir verilebilir: halkı bizden olmayan (başka din ya da başka kültür grubu), başkent olmayan, elimizdeki iller
  MS.can = function (tag, p) {
    const S = G.S, n = S.nations[tag];
    if (!n || p.owner !== tag || p.ctrl !== tag) return [false, 'İl elimizde olmalı.'];
    if (G.econ.isCapital(p)) return [false, 'Başkentte olmaz.'];
    const otherFaith = p.relig && !G.rel.sameFamily(p.relig, n.religion);
    const otherFolk = p.cul && !G.cul.accepted(tag, p.cul);
    if (!otherFaith && !otherFolk) return [false, 'Bu ilin halkı dinimizden ve kültür grubumuzdan.'];
    if (n.lastMassacre != null && S.hour - n.lastMassacre < MS.COOLDOWN * YEAR) {
      const left = Math.ceil((n.lastMassacre + MS.COOLDOWN * YEAR - S.hour) / YEAR);
      return [false, `Son katliamın üzerinden ${MS.COOLDOWN} yıl geçmeli (${left} yıl kaldı).`];
    }
    if ((n.stability ?? 60) < 35) return [false, 'İstikrar en az 35 olmalı: ülke böyle bir emri kaldıramaz.'];
    if (n.gold < 50) return [false, '50 altın gerekir.'];
    return [true, ''];
  };

  // Bedelin açıklaması (onay penceresinde)
  MS.costText = function (tag, p) {
    const n = G.S.nations[tag];
    const fam = G.rel.familyName(p.relig), sameFaith = G.rel.sameFamily(p.relig, n.religion);
    const g = G.cul.get(p.cul).group, grp = g !== G.cul.get(n.culture).group ? G.cul.GROUPS[g] : null;
    return `${p.name} ilinin bütün halkı öldürülecek ve yerine kendi halkımız yerleştirilecek.\n\n` +
      `Bedeli:\n• İstikrar −${MS.STAB}\n` +
      (sameFaith ? '' : `• ${fam} dinindeki bütün ülkelerle ilişki −60\n`) +
      (grp ? `• ${grp.name} kültür grubundaki ülkelerle ilişki −40\n` : '') +
      `• Diğer bütün ülkelerle ilişki −15\n` +
      `• İl ${MS.RUIN_YEARS} yıl ıssız kalır: vergi ve insan gücü onda bire düşer, binalar yıkılır\n` +
      `• Bütün illerimizde huzursuzluk +15 (korku ve öfke)\n` +
      `• Hükümdarınız ölene dek kötü bir unvanla anılır: bütün ülkelerle ilişki −25, istikrar −8\n` +
      `• ${MS.COOLDOWN} yıl boyunca yeni bir katliam emri verilemez`;
  };

  MS.order = function (tag, pid) {
    const S = G.S, n = S.nations[tag], p = S.provinces[pid];
    if (!MS.can(tag, p)[0]) return false;
    const victimRelig = p.relig, victimCul = p.cul;
    n.gold -= 50;
    n.lastMassacre = S.hour;
    n.stability = Math.max(0, (n.stability ?? 60) - MS.STAB);
    // il: halkı yok edilir, kendi halkımız yerleşir; uzun süre ıssız
    p.cul = n.culture; p.relig = n.religion; p.core = tag;
    p.unrest = 0; p.massacred = S.hour;
    p.civ = 0; p.mil = 0; p.farm = 0; p.mine = 0;
    p.civLines = { insaat: 0 }; p.milLines = G.econ.blank();
    // dünyanın tepkisi
    for (const o of Object.values(S.nations)) {
      if (!o.alive || o.tag === tag) continue;
      let v = -15;
      if (!G.rel.sameFamily(n.religion, victimRelig) && G.rel.sameFamily(o.religion, victimRelig)) v -= 45;
      const vg = G.cul.get(victimCul).group;
      if (vg !== G.cul.get(n.culture).group && o.culture && G.cul.get(o.culture).group === vg) v -= 25;
      G.dip.add(tag, o.tag, v);
    }
    for (const q of S.provinces) if (q.owner === tag && q.id !== pid) q.unrest = Math.min(100, (q.unrest || 0) + 15);
    // kötü unvan
    if (!n.rulerTitle) n.rulerTitle = G.pick(TITLES);
    G.labelsDirty = true; G.mapDirty = true;
    G.log(`${n.name}: ${p.name} halkı kılıçtan geçirildi. Hükümdar artık "${n.rulerTitle}" diye anılıyor.`, 'war', [tag]);
    return true;
  };

  // Katliamdan sonra il uzun süre ıssız: vergi ve insan gücü çok düşük
  const baseMult = G.unrestMult;
  G.unrestMult = p => (p.massacred && G.S && G.S.hour - p.massacred < MS.RUIN_YEARS * YEAR ? 0.1 : baseMult(p));

  // Kötü unvanlı hükümdar istikrarı da düşürür
  const baseStab = G.stab.stabFactors;
  G.stab.stabFactors = function (n) {
    const f = baseStab(n);
    if (n.rulerTitle) f.push([`Hükümdar "${n.rulerTitle}" diye anılıyor`, -8]);
    return f;
  };

  // Hükümdarın adı unvanıyla birlikte
  G.rulerName = n => (n ? (n.rulerTitle ? `${n.ruler} "${n.rulerTitle}"` : n.ruler) : '');
})();
