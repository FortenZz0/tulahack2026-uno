import { setScenePlanets } from '../canvas/script.js';
import { createComparisonState, getPlanetRadius } from '../canvas/comparison.js';
import { createRelatedPlanetLinks } from './related-planets.js';
import { earth, sun } from './earth.js';

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
    const relatedPlanets = createRelatedPlanetLinks(document.getElementById('related-planets'), library, planet => {
        state.cancel();
        selectPlanet(planet);
        const heading = document.getElementById('vizual-planet-name');
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
    });

    function fillValues(sectionId, rows) {
        const list = details.querySelector(`#${sectionId}`).parentElement.querySelector('dl');
        list.replaceChildren(...rows.map(([label, value, note]) => {
            const row = document.createElement('div');
            const term = document.createElement('dt');
            const definition = document.createElement('dd');
            term.textContent = label;
            definition.textContent = value;
            if (note) {
                const marker = document.createElement('sup');
                marker.className = 'parameter-footnote-mark';
                marker.textContent = note.marker;
                marker.setAttribute('aria-hidden', 'true');
                term.append(marker);
                definition.setAttribute('aria-describedby', note.id);
            }
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

        const physicsNotes = [];
        const physical = (label, field, unit) => {
            const messages = [];
            if (Number.isFinite(planet[field])) {
                if (field === 'mass' && planet.flags?.massIsEstimated) messages.push('Модельная оценка.');
                if (field === 'mass' && planet.flags?.massIsMinimum) messages.push('Указана минимальная масса.');
                if (field === 'eqt') messages.push(planet.id === earth.id
                    ? 'Оценка при альбедо 0,3 и равномерном перераспределении тепла, без парникового эффекта.'
                    : 'Равновесная температура не является температурой поверхности.');
                if (planet.measurements?.[field]?.lim) messages.push('Значение является пределом измерения.');
            }
            let note;
            if (messages.length) {
                note = { id: `physics-note-${physicsNotes.length + 1}`, marker: '*'.repeat(physicsNotes.length + 1),
                    label, text: messages.join(' ') };
                physicsNotes.push(note);
            }
            return [label, format(planet[field], unit), note];
        };
        fillValues('physics-title', [
            physical('Масса', 'mass', 'M⊕'), physical('Радиус', 'radius', 'R⊕'),
            physical('Средняя плотность', 'density', 'г/см³'), physical('Гравитация', 'gravity', 'м/с²'),
            physical('Скорость убегания', 'vesc', 'км/с'), physical('Равновесная температура', 'eqt', 'K'),
            physical('Поток излучения', 'flux', 'S⊕'),
        ]);
        const notes = document.getElementById('physics-notes');
        notes.replaceChildren(...physicsNotes.map(note => {
            const paragraph = document.createElement('p');
            paragraph.id = note.id;
            paragraph.textContent = `${note.marker} ${note.label} — ${note.text}`;
            return paragraph;
        }));
        notes.hidden = physicsNotes.length === 0;
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
        relatedPlanets.setPlanet(planet, star);
        details.closest('.scrollbox').scrollTop = 0;
    }

    function formatFraction(value) {
        return Number.isFinite(value) && value >= 0 && value <= 1 ? format(value * 100, '%', 1) : 'Нет данных';
    }

    function selectPlanet(planet) {
        if (!state.choose(planet)) return;
        if (!state.active) renderDetails(planet, planet.id === earth.id ? sun : library.getPlanetStar(planet));
        render();
    }

    document.getElementById('earth-shortcut')?.addEventListener('click', () => {
        state.cancel();
        selectPlanet(earth);
        const heading = document.getElementById('vizual-planet-name');
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
    });

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
        onSelect: selectPlanet,
    };
}
