// Геометрия визуализации: фаза — доля времени от перицентра, не угол.
// Единицы: большая полуось в а.е., светимость относительно Солнца.
export function orbitPosition(phase, semiMajorAxis, eccentricity, luminosity) {
    if (![phase, semiMajorAxis, eccentricity, luminosity].every(Number.isFinite)
        || semiMajorAxis <= 0 || luminosity <= 0 || eccentricity < 0 || eccentricity >= 1) {
        throw new RangeError("Expected finite orbital parameters: a > 0, 0 <= e < 1, L > 0");
    }

    const meanAnomaly = ((phase % 1 + 1) % 1) * 2 * Math.PI;
    // Бисекция уравнения Кеплера E - e sin(E) = M, устойчива при 0 <= e < 1.
    let lower = 0;
    let upper = 2 * Math.PI;
    for (let i = 0; i < 48; i++) {
        const middle = (lower + upper) / 2;
        if (middle - eccentricity * Math.sin(middle) < meanAnomaly) lower = middle;
        else upper = middle;
    }
    const anomaly = (lower + upper) / 2;
    const x = semiMajorAxis * (Math.cos(anomaly) - eccentricity);
    const y = semiMajorAxis * Math.sqrt(1 - eccentricity ** 2) * Math.sin(anomaly);
    const radius = semiMajorAxis * (1 - eccentricity * Math.cos(anomaly));

    return { x, y, radius, flux: luminosity / radius ** 2 };
}
