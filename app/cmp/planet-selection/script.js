import { setScenePlanets } from '../canvas/script.js';
import { createComparisonState, getPlanetRadius } from '../canvas/comparison.js';

const earth = { id: 'earth-reference', name: 'Земля', radius: 1 };
const text = (value, fallback = 'Нет данных') => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const format = (value, unit = '', digits = 2) => Number.isFinite(value)
    ? `${value.toLocaleString('ru-RU', { maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}` : 'Нет данных';

export function createPlanetSelection(library, {
    comparisonEnabled = false, onStarChange = () => {}, onPlanetChange = () => {}, onRankingChange = () => {},
} = {}) {
    const state = createComparisonState(earth);
    const details = document.getElementById('planet-details');
    const notice = document.getElementById('scene-notice');
    const caption = document.getElementById('comparison-caption');
    const toggle = document.getElementById('comparison-toggle');
    toggle.hidden = !comparisonEnabled;
    toggle.closest('.planet-info').classList.toggle('comparison-enabled', comparisonEnabled);
    let listedPlanets = new Map();

    function fillValues(sectionId, rows) {
        const list = details.querySelector(`#${sectionId}`).parentElement.querySelector('dl');
        list.replaceChildren(...rows.map(([label, value]) => {
            const row = document.createElement('div');
            const term = document.createElement('dt');
            const definition = document.createElement('dd');
            term.textContent = label;
            definition.textContent = value;
            if (value === 'Нет данных') definition.className = 'unavailable';
            row.append(term, definition);
            return row;
        }));
    }

    function renderDetails(planet, star) {
        onStarChange(star);
        document.getElementById('vizual-planet-name').textContent = text(planet.name, 'Нет названия');
        document.querySelector('.planet-class').textContent = text(planet.classification?.sizeClass, 'Тип неизвестен');
        const starName = document.getElementById('vizual-sun-name');
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-star';
        icon.setAttribute('aria-hidden', 'true');
        starName.replaceChildren(icon, document.createTextNode(` ${text(star?.name, 'Звезда неизвестна')}`));

        const summary = document.querySelector('.planet-highlights');
        summary.setAttribute('aria-label', `Основные характеристики: ${text(planet.name, 'планета')}`);
        const values = [format(planet.radius, 'R⊕'), format(planet.orbit?.period, 'дня'),
            format(planet.flux, 'S⊕'), format(planet.orbit?.semiMajorAxis, 'а.е.', 3)];
        summary.querySelectorAll('dd').forEach((item, i) => { item.textContent = values[i]; });
        summary.querySelectorAll('dt')[3].textContent = 'Большая полуось';
        details.setAttribute('aria-label', `Характеристики и описание: ${text(planet.name, 'планета')}`);
        details.querySelector(':scope > .scientific-note').textContent =
            `${text(planet.name, 'Планета')} · данные NASA Exoplanet Archive`;

        const physical = (field, unit, digits = 2) => {
            const value = format(planet[field], unit, digits);
            return value !== 'Нет данных' && planet.measurements?.[field]?.lim
                ? `${value} (предел измерения)` : value;
        };
        fillValues('physics-title', [
            ['Масса', physical('mass', 'M⊕')], ['Радиус', physical('radius', 'R⊕')],
            ['Средняя плотность', physical('density', 'г/см³')], ['Гравитация', physical('gravity', 'м/с²')],
            ['Скорость убегания', physical('vesc', 'км/с')], ['Равновесная температура', physical('eqt', 'K')],
            ['Поток излучения', physical('flux', 'S⊕')],
        ]);
        document.getElementById('physics-title').parentElement.querySelector('.scientific-note').textContent =
            'Равновесная температура не является температурой поверхности.'
            + (planet.flags?.massIsEstimated ? ' Масса — модельная оценка.' : '')
            + (planet.flags?.massIsMinimum ? ' Указана минимальная масса.' : '');
        fillValues('orbit-title', [
            ['Орбитальный период', format(planet.orbit?.period, 'дня')],
            ['Большая полуось', format(planet.orbit?.semiMajorAxis, 'а.е.', 3)],
            ['Эксцентриситет', format(planet.orbit?.eccentricity, '', 4)],
            ['В консервативной зоне', formatFraction(planet.habitableTimeFraction?.conservative)],
            ['В оптимистичной зоне', formatFraction(planet.habitableTimeFraction?.optimistic)],
        ]);
        // Схема Земли не должна выдавать её орбиту за орбиту выбранной экзопланеты.
        onPlanetChange(planet, star);
        document.getElementById('star-title').textContent = text(star?.name, 'Звезда');
        fillValues('star-title', [
            ['Спектральный класс', text(star?.spectralType)], ['Эффективная температура', format(star?.temperature, 'K')],
            ['Масса', format(star?.mass, 'M☉')], ['Радиус', format(star?.radius, 'R☉')],
            ['Светимость', format(star?.luminosity, 'L☉')], ['Возраст', format(star?.age, 'млрд лет')],
            ['Звёзд в системе', format(star?.system?.starCount)],
        ]);
        const otherNames = star?.planets?.filter(id => id !== planet.id)
            .map(id => library.getPlanet(id)?.name).filter(name => typeof name === 'string' && name.trim()) ?? [];
        document.getElementById('star-title').parentElement.querySelector('.scientific-note').textContent =
            otherNames.length ? `Другие планеты: ${otherNames.join(', ')}.` : 'Другие планеты: нет данных в загруженном каталоге.';
        details.closest('.scrollbox').scrollTop = 0;
    }

    function formatFraction(value) {
        return Number.isFinite(value) && value >= 0 && value <= 1 ? format(value * 100, '%', 1) : 'Нет данных';
    }

    function render() {
        const { selected, comparison } = state;
        setScenePlanets(selected, comparison);
        toggle.setAttribute('aria-pressed', String(state.active));
        toggle.disabled = !comparisonEnabled || getPlanetRadius(selected) === null;
        toggle.title = toggle.disabled ? 'Для сравнения нужен измеренный радиус выбранной планеты'
            : state.active ? 'Выберите вторую планету в списке. Клик вне списка отменяет сравнение.' : 'Сравнить размеры планет';
        toggle.lastChild.textContent = state.active ? ' Отменить сравнение' : ' Сравнить';
        caption.hidden = !comparison;
        if (comparison) {
            document.getElementById('comparison-description').textContent =
                `${text(selected.name, 'Планета')}: ${format(getPlanetRadius(selected), 'R⊕', 3)} ↔ `
                + `${text(comparison.name, 'Планета')}: ${format(getPlanetRadius(comparison), 'R⊕', 3)}. `
                + (getPlanetRadius(selected) !== null && getPlanetRadius(comparison) !== null
                    ? 'Единый масштаб радиусов.' : 'Недостаточно данных для сравнения размеров.');
        }
        const missing = [selected, ...(comparison ? [comparison] : [])]
            .filter(planet => getPlanetRadius(planet) === null);
        notice.hidden = missing.length === 0;
        notice.textContent = missing.length
            ? `Нет измеренного радиуса: ${missing.map(planet => text(planet.name, 'Планета')).join(', ')}. Сравнение размеров недоступно.` : '';
        document.querySelectorAll('.planet-card[data-planet-id]').forEach(card => {
            const isSelected = card.dataset.planetId === selected.id;
            const isCompared = card.dataset.planetId === comparison?.id;
            card.classList.toggle('selected', isSelected);
            card.classList.toggle('compared', isCompared);
            const planet = library.initialized ? library.getPlanet(card.dataset.planetId) ?? listedPlanets.get(card.dataset.planetId) : null;
            const unavailable = state.active && getPlanetRadius(planet) === null;
            card.classList.toggle('comparison-unavailable', unavailable);
            const select = card.querySelector('.planet-select');
            select.setAttribute('aria-pressed', String(isSelected));
            select.disabled = unavailable || (state.active && isSelected);
            card.title = unavailable ? 'Нет измеренного радиуса — сравнение недоступно'
                : isCompared ? 'Планета добавлена в сравнение' : '';
        });
    }

    toggle.addEventListener('click', () => {
        if (!comparisonEnabled) return;
        state.toggleMode();
        render();
    });
    document.addEventListener('click', event => {
        if (state.active && !event.target.closest('.planet-card, #comparison-toggle')) {
            state.cancel();
            render();
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && state.active) {
            state.cancel();
            render();
            toggle.focus();
        }
    });
    render();
    return {
        onReady(planets) {
            listedPlanets = new Map(planets.map(planet => [planet.id, planet]));
            onRankingChange(planets);
            render();
        },
        onSelect(planet) {
            if (!state.choose(planet)) return;
            if (!state.active) renderDetails(planet, library.getPlanetStar(planet));
            render();
        },
    };
}
