const positive = value => Number.isFinite(value) && value > 0 ? value : null;

function zoneBounds(zone) {
    const inner = positive(zone?.inner);
    const outer = positive(zone?.outer);
    return inner !== null && outer !== null && inner < outer ? { inner, outer } : null;
}

// Читаем готовые а.е., дни и L☉ из каталога; научные показатели не пересчитываем.
export function getOrbitViewData(planet, star) {
    const semiMajorAxis = positive(planet?.orbit?.semiMajorAxis);
    const e = planet?.orbit?.eccentricity;
    const eccentricity = Number.isFinite(e) && e >= 0 && e < 1 ? e : null;
    const periodDays = positive(planet?.orbit?.period);
    const multipleStars = star?.system?.starCount > 1 || planet?.flags?.circumbinary === true;
    const zones = {
        conservative: zoneBounds(planet?.habitableZone?.conservative),
        optimistic: zoneBounds(planet?.habitableZone?.optimistic),
    };
    const hasOrbit = semiMajorAxis !== null && eccentricity !== null;
    const extent = Math.max(
        hasOrbit ? semiMajorAxis * (1 + eccentricity) : 0,
        zones.conservative?.outer ?? 0, zones.optimistic?.outer ?? 0
    );
    return {
        semiMajorAxis, eccentricity, periodDays, zones, hasOrbit, multipleStars,
        luminosity: multipleStars ? null : positive(star?.luminosity),
        // Одинаковый масштаб по X и Y, звезда в (0, 0), запас до краёв SVG.
        scale: extent > 0 ? 136 / extent : null,
    };
}
