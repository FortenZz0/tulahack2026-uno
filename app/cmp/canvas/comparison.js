// Радиусы в R⊕. Общий масштаб сохраняет исходное отношение диаметров.
export function getPlanetRadius(planet) {
    const limit = planet?.measurements?.radius?.lim;
    const radius = planet?.radius;
    return Number.isFinite(radius) && radius > 0 && (limit == null || limit === 0) ? radius : null;
}

export function comparisonLayout(firstRadius, secondRadius) {
    if (![firstRadius, secondRadius].every(value => Number.isFinite(value) && value > 0)) return null;
    const maximum = Math.max(firstRadius, secondRadius);
    const firstScale = firstRadius / maximum;
    const secondScale = secondRadius / maximum;
    const gap = 0.3;
    const halfWidth = firstScale + secondScale + gap / 2;
    return {
        firstScale, secondScale,
        firstX: -halfWidth + firstScale,
        secondX: halfWidth - secondScale,
        halfExtent: Math.max(halfWidth + 0.18, 1.2),
    };
}

export function createComparisonState(initialPlanet) {
    let selected = initialPlanet;
    let comparison = null;
    let active = false;
    return {
        get selected() { return selected; },
        get comparison() { return comparison; },
        get active() { return active; },
        choose(planet) {
            if (active) {
                if (planet.id === selected.id || getPlanetRadius(planet) === null) return false;
                comparison = planet;
                return true;
            }
            selected = planet;
            comparison = null;
            return true;
        },
        toggleMode() {
            active = !active && getPlanetRadius(selected) !== null;
            if (!active) comparison = null;
        },
        cancel() { active = false; comparison = null; },
    };
}
