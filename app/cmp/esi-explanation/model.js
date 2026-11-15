const missing = 'Недостаточно данных';
const format = value => value.toLocaleString('ru-RU', { maximumFractionDigits: 3 });

function inputValue(planet, field) {
    const value = planet?.[field];
    const limit = planet?.measurements?.[field]?.lim;
    if (!Number.isFinite(value) || (field === 'radius' ? value <= 0 : value < 0)
        || (limit != null && limit !== 0)) return null;
    return value;
}

// Проверено по calculateSimpleESI в Worker:
// https://github.com/dfilirini/tulahack2026-uno-exoworker/blob/main/src/esi.js
// dr = (R - 1)/(R + 1), ds = (S - 1)/(S + 1).
// Шкалы — 1 - |dr| и 1 - |ds|. Итоговое среднеквадратичное отклонение НЕ вычисляем.
function similarity(value) {
    return value === null ? null : 1 - Math.abs((value - 1) / (value + 1));
}

export function getEsiExplanation(planet, topPlanets = null) {
    const radius = inputValue(planet, 'radius');
    const flux = inputValue(planet, 'flux');
    const radiusSimilarity = similarity(radius);
    const fluxSimilarity = similarity(flux);
    const serverEsi = planet?.esi?.simple;
    const esi = Number.isFinite(serverEsi) && serverEsi >= 0 && serverEsi <= 1 ? serverEsi : null;
    const position = Array.isArray(topPlanets)
        ? topPlanets.slice(0, 50).findIndex(item => item.id === planet?.id) : -1;
    const earth = planet?.id === 'earth-reference';
    const rankText = earth ? 'Земля — эталон' : !Array.isArray(topPlanets) ? missing
        : position >= 0 ? `${position + 1} из ${topPlanets.slice(0, 50).length}` : 'Вне топ-50';
    let explanation = missing;
    if (radius !== null && flux !== null) {
        const comparison = value => value === 1 ? 'совпадает с земным' : value > 1 ? 'выше земного' : 'ниже земного';
        explanation = `Радиус ${format(radius)} R⊕ — ${comparison(radius)}. Поток ${format(flux)} S⊕ — ${comparison(flux)}.`;
        if (!earth) {
            explanation += Math.abs(radiusSimilarity - fluxSimilarity) < 1e-12
                ? ' По обоим параметрам сходство одинаково.'
                : radiusSimilarity > fluxSimilarity
                    ? ' По радиусу планета ближе к Земле, чем по излучению.'
                    : ' По излучению планета ближе к Земле, чем по радиусу.';
        }
        if (esi === null) explanation += ' Итоговый ESI: недостаточно данных.';
    }
    return { esi, radius, flux, radiusSimilarity, fluxSimilarity, rankText, explanation };
}
