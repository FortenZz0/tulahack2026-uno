import { getEsiExplanation } from './model.js';

export function createEsiExplanation(root) {
    let selected = null;
    let ranking = null;
    const fills = new Map();
    const format = (value, digits = 2) => value.toLocaleString('ru-RU', {
        minimumFractionDigits: digits, maximumFractionDigits: digits,
    });

    function render() {
        const data = getEsiExplanation(selected, ranking);
        root.querySelector('[data-esi-total]').textContent = data.esi === null ? 'Недостаточно данных' : format(data.esi);
        root.querySelector('[data-esi-rank]').textContent = data.rankText;
        root.querySelector('[data-esi-explanation]').textContent = data.explanation;
        for (const [field, unit] of [['radius', 'R⊕'], ['flux', 'S⊕']]) {
            const coefficient = data[`${field}Similarity`];
            const row = root.querySelector(`[data-similarity="${field}"]`);
            const meter = row.querySelector('[role="meter"]');
            const fill = row.querySelector('.esi-meter-fill');
            row.querySelector('[data-similarity-score]').textContent = coefficient === null
                ? 'Недостаточно данных' : `${format(coefficient)} из 1`;
            row.querySelector('[data-similarity-value]').textContent = data[field] === null
                ? 'Недостаточно данных' : `${format(data[field], 3)} ${unit} · Земля: 1 ${unit}`;
            if (coefficient === null) {
                meter.removeAttribute('aria-valuenow');
                meter.setAttribute('aria-valuetext', 'Недостаточно данных');
            } else {
                meter.setAttribute('aria-valuenow', String(coefficient));
                meter.setAttribute('aria-valuetext', `${format(coefficient)} из 1`);
            }
            // CSS-переход идёт от текущего заполнения; быстрые переключения не сбрасывают шкалу.
            if (fills.get(field) !== coefficient) {
                fill.style.transform = `scaleX(${coefficient ?? 0})`;
                fills.set(field, coefficient);
            }
            row.classList.toggle('is-unavailable', coefficient === null);
        }
    }

    return {
        setPlanet(planet) { selected = planet; render(); },
        setRanking(planets) { ranking = planets; render(); },
    };
}
