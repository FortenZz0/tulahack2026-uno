import { orbitPosition } from "./orbit-math.js";

const root = document.getElementById("orbit-view");

if (root) {
    const find = selector => root.querySelector(selector);
    const slider = find("#orbit-time");
    const mode = find("#orbit-mode");
    const play = find("[data-orbit-play]");
    const format = (value, digits = 3) => value.toLocaleString("ru-RU", {
        minimumFractionDigits: digits, maximumFractionDigits: digits,
    });
    const svgElement = (tag, attributes) => {
        const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
        for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
        return element;
    };

    // Только справочные границы для Солнца (Kopparapu 2014, табл. 1).
    // Не пересчитываем серверную модель HZ для экзопланет на клиенте.
    const zones = {
        conservative: { inner: 0.9504, outer: 1.6760 },
        optimistic: { inner: 0.7504, outer: 1.7678 },
    };
    const scale = 78;
    const point = phase => orbitPosition(phase, 1, mode.value === "example" ? 0.4 : 0.0167, 1);
    const mapX = value => 160 + value * scale;
    const mapY = value => 160 - value * scale;
    const chartX = phase => 40 + phase * 268;
    let chartY;
    let phase = 0;
    let playing = false;
    let frameId;
    let lastTime = null;
    let visible = false;

    for (const [name, zone] of Object.entries(zones).reverse()) {
        find("[data-orbit-zones]").append(svgElement("circle", {
            cx: 160, cy: 160,
            r: (zone.inner + zone.outer) / 2 * scale,
            "stroke-width": (zone.outer - zone.inner) * scale,
            class: `orbit-zone zone-${name}`,
        }));
    }

    function drawTracks() {
        const samples = Array.from({ length: 241 }, (_, i) => point(i / 240));
        const fluxes = samples.map(sample => sample.flux);
        const minimum = Math.min(...fluxes);
        const maximum = Math.max(...fluxes);
        const padding = Math.max((maximum - minimum) * 0.15, 0.01);
        const low = Math.max(0, minimum - padding);
        const high = maximum + padding;
        chartY = flux => 112 - (flux - low) / (high - low) * 96;

        find("[data-orbit-track]").setAttribute("d", samples.map((p, i) =>
            `${i ? "L" : "M"}${mapX(p.x)},${mapY(p.y)}`).join(" ") + " Z");
        find("[data-flux-line]").setAttribute("d", samples.map((p, i) =>
            `${i ? "L" : "M"}${chartX(i / 240)},${chartY(p.flux)}`).join(" "));

        const grid = find("[data-flux-grid]");
        grid.replaceChildren();
        for (const flux of [low, (low + high) / 2, high]) {
            const y = chartY(flux);
            grid.append(svgElement("line", { x1: 40, x2: 308, y1: y, y2: y, class: "orbit-grid-line" }));
            const label = svgElement("text", { x: 34, y: y + 3, "text-anchor": "end" });
            label.textContent = format(flux, 2);
            grid.append(label);
        }
    }

    function render() {
        const position = point(phase);
        for (const selector of ["[data-orbit-planet]", "[data-orbit-planet-halo]"]) {
            find(selector).setAttribute("cx", mapX(position.x));
            find(selector).setAttribute("cy", mapY(position.y));
        }
        const distance = find("[data-orbit-distance]");
        distance.setAttribute("x2", mapX(position.x));
        distance.setAttribute("y2", mapY(position.y));
        const x = chartX(phase);
        find("[data-flux-cursor]").setAttribute("x1", x);
        find("[data-flux-cursor]").setAttribute("x2", x);
        find("[data-flux-dot]").setAttribute("cx", x);
        find("[data-flux-dot]").setAttribute("cy", chartY(position.flux));
        find("[data-orbit-day]").textContent = `День ${format(phase * 365.26, 1)}`;
        find("[data-orbit-radius]").textContent = `${format(position.radius)} а.е.`;
        find("[data-orbit-flux]").textContent = `${format(position.flux)} S⊕`;
        const within = zone => position.radius >= zone.inner && position.radius <= zone.outer;
        const status = find("[data-orbit-status]");
        status.textContent = within(zones.conservative) ? "В консервативной зоне"
            : within(zones.optimistic) ? "Только в оптимистичной зоне" : "Вне обеих зон";
        status.dataset.zone = within(zones.conservative) ? "conservative"
            : within(zones.optimistic) ? "optimistic" : "outside";
        slider.value = Math.round(phase * 1000);
        slider.setAttribute("aria-valuetext", `${format(phase * 365.26, 1)} дня от перицентра`);
    }

    function animate(time) {
        if (!playing || !visible || document.hidden) return;
        if (lastTime !== null) phase = (phase + Math.min(time - lastTime, 100) / 16000) % 1;
        lastTime = time;
        render();
        frameId = requestAnimationFrame(animate);
    }

    function syncAnimation() {
        cancelAnimationFrame(frameId);
        lastTime = null;
        if (playing && visible && !document.hidden) frameId = requestAnimationFrame(animate);
    }

    function setPlaying(value) {
        playing = value;
        play.textContent = playing ? "Пауза" : "Воспроизвести";
        play.setAttribute("aria-pressed", String(playing));
        syncAnimation();
    }

    play.addEventListener("click", () => setPlaying(!playing));
    slider.addEventListener("input", () => {
        setPlaying(false);
        phase = Number(slider.value) / 1000;
        render();
    });
    mode.addEventListener("change", () => {
        find("#orbit-map-title").textContent = mode.value === "example"
            ? "Учебная орбита вокруг Солнца, эксцентриситет 0,4" : "Орбита Земли вокруг Солнца";
        find("[data-orbit-explanation]").textContent = mode.value === "example"
            ? "Учебный пример, не орбита Земли: a = 1 а.е., e = 0,4, период 365,26 дня. Меняется только эксцентриситет — орбита пересекает границы зон."
            : "Земля: a = 1 а.е., e = 0,0167. В этой модели весь оборот проходит в консервативной зоне. Поток S/S⊕ = (L/L☉) / r², r в а.е. Шкала графика увеличена, чтобы показать небольшое изменение потока.";
        drawTracks();
        render();
    });
    document.addEventListener("visibilitychange", syncAnimation);
    new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        syncAnimation();
    }).observe(root);

    mode.dispatchEvent(new Event("change"));
    // Автовоспроизведение отключено при предпочтении уменьшенного движения.
    setPlaying(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
