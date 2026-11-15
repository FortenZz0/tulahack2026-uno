import { orbitPosition } from './orbit-math.js';
import { getOrbitViewData } from './orbit-data.js';

const name = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim() : fallback;
const format = (value, digits = 3) => value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
// Постоянная точность и отсутствие разделителей тысяч сохраняют длину анимируемых показаний.
const formatAnimated = (value, digits = 3) => {
    if (Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < 10 ** -digits)) {
        return value.toExponential(digits).replace('.', ',');
    }
    return value.toLocaleString('ru-RU', {
        minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false,
    });
};

export function createOrbitView(root) {
    const find = selector => root.querySelector(selector);
    const slider = find('#orbit-time');
    const play = find('[data-orbit-play]');
    const controls = find('[data-orbit-time-controls]');
    const scrollbox = root.closest('.scrollbox');
    const visuals = [find('.orbit-map'), find('.orbit-flux-chart')];
    const visibleVisuals = new Set();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animationSeconds = 16;
    let data = getOrbitViewData(null, null);
    let phase = 0;
    let playing = false;
    let visible = false;
    let disposed = false;
    let frameId;
    let lastTime = null;
    let chartY = null;
    const mapX = value => 160 + value * data.scale;
    const mapY = value => 160 - value * data.scale;
    const chartX = fraction => 40 + fraction * 268;
    const point = fraction => orbitPosition(fraction, data.semiMajorAxis, data.eccentricity, data.luminosity);
    const svgElement = (tag, attributes) => {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
        return element;
    };

    function drawZones() {
        const layer = find('[data-orbit-zones]');
        const legend = find('[data-orbit-legend]');
        layer.replaceChildren();
        legend.replaceChildren();
        // Сначала широкое оптимистичное кольцо, поверх — консервативное.
        for (const type of ['optimistic', 'conservative']) {
            const zone = data.zones[type];
            const label = type === 'conservative' ? 'Консервативная зона' : 'Оптимистичная зона';
            const item = document.createElement('li');
            const swatch = document.createElement('i');
            swatch.className = `zone-${type}`;
            swatch.setAttribute('aria-hidden', 'true');
            item.append(swatch, document.createTextNode(zone
                ? `${label}: ${format(zone.inner)}–${format(zone.outer)} а.е.` : `${label}: нет данных`));
            legend.append(item);
            if (zone && data.hasOrbit) {
                layer.append(svgElement('circle', {
                    cx: 160, cy: 160, r: (zone.inner + zone.outer) / 2 * data.scale,
                    'stroke-width': (zone.outer - zone.inner) * data.scale, class: `orbit-zone zone-${type}`,
                }));
            }
        }
    }

    function drawFlux() {
        chartY = null;
        // На круговой орбите поток постоянен: отдельный график не нужен.
        const available = data.hasOrbit && data.luminosity !== null && data.eccentricity > 0;
        find('[data-orbit-flux-panel]').hidden = !available;
        find('[data-flux-grid]').replaceChildren();
        find('[data-flux-line]').removeAttribute('d');
        if (!available) return;
        const samples = Array.from({ length: 401 }, (_, i) => point(i / 400));
        const fluxes = samples.map(sample => sample.flux);
        if (!fluxes.every(Number.isFinite)) {
            find('[data-orbit-flux-panel]').hidden = true;
            return;
        }
        const minimum = Math.min(...fluxes);
        const maximum = Math.max(...fluxes);
        const padding = Math.max((maximum - minimum) * 0.15, maximum * 0.01, 1e-12);
        const low = Math.max(0, minimum - padding);
        const high = maximum + padding;
        chartY = flux => 112 - (flux - low) / (high - low) * 96;
        find('[data-flux-line]').setAttribute('d', samples.map((sample, i) =>
            `${i ? 'L' : 'M'}${chartX(i / 400)},${chartY(sample.flux)}`).join(' '));
        for (const flux of [low, (low + high) / 2, high]) {
            const y = chartY(flux);
            const label = svgElement('text', { x: 34, y: y + 3, 'text-anchor': 'end' });
            label.textContent = flux > 1e4 || (flux > 0 && flux < 0.001) ? flux.toExponential(1) : format(flux, 3);
            find('[data-flux-grid]').append(svgElement('line', {
                x1: 40, x2: 308, y1: y, y2: y, class: 'orbit-grid-line',
            }), label);
        }
    }

    function render() {
        if (!data.hasOrbit) return;
        const position = point(phase);
        for (const selector of ['[data-orbit-planet]', '[data-orbit-planet-halo]']) {
            find(selector).setAttribute('cx', mapX(position.x));
            find(selector).setAttribute('cy', mapY(position.y));
        }
        find('[data-orbit-distance]').setAttribute('x2', mapX(position.x));
        find('[data-orbit-distance]').setAttribute('y2', mapY(position.y));
        find('[data-orbit-radius]').textContent = `${formatAnimated(position.radius, 5)} а.е.`;
        find('[data-orbit-flux]').textContent = Number.isFinite(position.flux) ? `${formatAnimated(position.flux)} S⊕` : 'Нет данных';
        const time = data.periodDays !== null ? `День ${formatAnimated(phase * data.periodDays, 3)}` : `${formatAnimated(phase * 100, 1)}% оборота`;
        find('[data-orbit-day]').textContent = time;
        slider.value = Math.round(phase * 10000);
        slider.setAttribute('aria-valuetext', time);
        const within = zone => zone && position.radius >= zone.inner && position.radius <= zone.outer;
        const status = find('[data-orbit-status]');
        const statusText = find('[data-orbit-status-text]');
        if (within(data.zones.conservative)) {
            statusText.textContent = 'В консервативной зоне';
            status.dataset.zone = 'conservative';
        } else if (within(data.zones.optimistic)) {
            statusText.textContent = data.zones.conservative ? 'Только в оптимистичной зоне' : 'В оптимистичной зоне; консервативная неизвестна';
            status.dataset.zone = 'optimistic';
        } else {
            const complete = data.zones.conservative && data.zones.optimistic;
            statusText.textContent = complete ? 'Вне обеих зон' : 'Принадлежность зонам неизвестна: нет полных данных';
            status.dataset.zone = complete ? 'outside' : 'unknown';
        }
        if (chartY) {
            const x = chartX(phase);
            find('[data-flux-cursor]').setAttribute('x1', x);
            find('[data-flux-cursor]').setAttribute('x2', x);
            find('[data-flux-dot]').setAttribute('cx', x);
            find('[data-flux-dot]').setAttribute('cy', chartY(position.flux));
        }
    }

    function animate(time) {
        if (!playing || !visible || document.hidden || disposed) return;
        if (lastTime !== null) {
            // Время симуляции растёт равномерно; угол получает нелинейное решение Кеплера.
            const simulatedDaysPerSecond = data.periodDays / animationSeconds;
            phase = (phase + Math.min(time - lastTime, 100) / 1000 * simulatedDaysPerSecond / data.periodDays) % 1;
        }
        lastTime = time;
        render();
        frameId = requestAnimationFrame(animate);
    }

    function syncAnimation() {
        cancelAnimationFrame(frameId);
        lastTime = null;
        if (playing && visible && !document.hidden && !disposed) frameId = requestAnimationFrame(animate);
    }
    function syncControls() {
        // IntersectionObserver учитывает и прокрутку карточки, и границы окна.
        visible = visuals.some(element => visibleVisuals.has(element) && !element.closest('[hidden]'));
        const pinned = !disposed && visible && data.hasOrbit && data.periodDays !== null;
        controls.classList.toggle('is-pinned', pinned);
        scrollbox?.classList.toggle('orbit-controls-pinned', pinned);
        syncAnimation();
    }
    function setPlaying(value) {
        playing = Boolean(value && data.hasOrbit && data.periodDays !== null);
        play.textContent = playing ? 'Пауза' : 'Воспроизвести';
        play.setAttribute('aria-pressed', String(playing));
        syncAnimation();
    }
    const onPlay = () => setPlaying(!playing);
    const onInput = () => { setPlaying(false); phase = Number(slider.value) / 10000; render(); };
    const onReducedMotion = () => { if (reducedMotion.matches) setPlaying(false); };
    play.addEventListener('click', onPlay);
    slider.addEventListener('input', onInput);
    reducedMotion.addEventListener('change', onReducedMotion);
    document.addEventListener('visibilitychange', syncAnimation);
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRect.height > 0 && entry.intersectionRect.width > 0) {
                visibleVisuals.add(entry.target);
            } else {
                visibleVisuals.delete(entry.target);
            }
        }
        syncControls();
    });
    visuals.forEach(element => observer.observe(element));

    return {
        setPlanet(planet, star) {
            setPlaying(false);
            data = getOrbitViewData(planet, star);
            phase = 0;
            root.hidden = !data.hasOrbit;
            chartY = null;
            if (!data.hasOrbit) {
                find('[data-orbit-flux-panel]').hidden = true;
                controls.hidden = true;
                syncControls();
                return;
            }
            controls.hidden = data.periodDays === null;
            slider.value = 0;
            slider.disabled = !data.hasOrbit;
            play.disabled = !data.hasOrbit || data.periodDays === null;
            find('.orbit-map').toggleAttribute('hidden', !data.hasOrbit);
            find('[data-orbit-radius]').textContent = 'Нет данных';
            find('[data-orbit-flux]').textContent = 'Нет данных';
            find('[data-orbit-day]').textContent = '';
            find('[data-orbit-status-text]').textContent = '';
            const status = find('[data-orbit-status]');
            status.querySelectorAll('.orbit-status-reserve').forEach(element => element.remove());
            if (data.hasOrbit) {
                const messages = [data.zones.conservative && data.zones.optimistic
                    ? 'Вне обеих зон' : 'Принадлежность зонам неизвестна: нет полных данных'];
                if (data.zones.conservative) messages.push('В консервативной зоне');
                if (data.zones.optimistic) messages.push(data.zones.conservative
                    ? 'Только в оптимистичной зоне' : 'В оптимистичной зоне; консервативная неизвестна');
                for (const message of messages) {
                    const placeholder = document.createElement('span');
                    placeholder.className = 'orbit-status-reserve';
                    placeholder.setAttribute('aria-hidden', 'true');
                    placeholder.textContent = message;
                    status.append(placeholder);
                }
            }
            slider.removeAttribute('aria-valuetext');
            find('#orbit-map-title').textContent = `Орбита: ${name(planet?.name, 'планета')} — ${name(star?.name, 'звезда')}`;
            const starName = name(star?.name, 'Звезда');
            find('[data-orbit-star-name]').textContent = starName.length > 24 ? `${starName.slice(0, 23)}…` : starName;
            find('[data-orbit-period]').textContent = data.periodDays !== null ? `1 оборот · ${format(data.periodDays)} дня` : '1 оборот · период неизвестен';
            find('[data-orbit-availability]').textContent =
                `a = ${format(data.semiMajorAxis, 5)} а.е. · e = ${format(data.eccentricity, 5)} · вид сверху на плоскость орбиты`;
            if (data.hasOrbit) {
                const track = find('[data-orbit-track]');
                track.setAttribute('cx', mapX(-data.semiMajorAxis * data.eccentricity));
                track.setAttribute('cy', 160);
                track.setAttribute('rx', data.semiMajorAxis * data.scale);
                track.setAttribute('ry', data.semiMajorAxis * Math.sqrt(1 - data.eccentricity ** 2) * data.scale);
            }
            drawZones();
            drawFlux();
            find('[data-orbit-flux]').parentElement.hidden = data.luminosity === null;
            const explanation = [];
            if (data.hasOrbit && data.periodDays !== null) explanation.push(`Анимация ускорена: один оборот (${format(data.periodDays)} дня) за ${animationSeconds} секунд. Положение — по уравнению Кеплера.`);
            if (data.multipleStars) explanation.push('Схема идеализирует кеплеровскую орбиту; влияние других звёзд не учитывается.');
            find('[data-orbit-explanation]').textContent = explanation.join(' ');
            render();
            syncControls();
            // Автовоспроизведение отключено при предпочтении уменьшенного движения.
            setPlaying(!reducedMotion.matches);
        },
        dispose() {
            disposed = true;
            controls.classList.remove('is-pinned');
            scrollbox?.classList.remove('orbit-controls-pinned');
            cancelAnimationFrame(frameId);
            observer.disconnect();
            play.removeEventListener('click', onPlay);
            slider.removeEventListener('input', onInput);
            reducedMotion.removeEventListener('change', onReducedMotion);
            document.removeEventListener('visibilitychange', syncAnimation);
        },
    };
}
