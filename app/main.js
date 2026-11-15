import.meta.glob("./sass/style.sass", {eager: true}) // импортируем основные стили самыми первыми для наименьшего приоритета

import { ExoplanetLibrary } from "./lib/index.js";
import { GetPlanets } from "./cmp/table/list.js";
import { createStarfield } from "./cmp/starfield/script.js";

import.meta.glob(
    [
        "./**/*.css",
        "./**/*.sass", "!/sass/style.sass",
        "!./sass/response.sass", // импортируем остальные стили для обычного приоритета (кроме основных стилей и адаптива)
        "!./**/tests/*.js",
        "./**/*.js", 
        "!./cmp/starfield/script.js",
        "!./cmp/table/list.js",
    ],
    {
        eager: true
    }
)
import.meta.glob("./sass/response.sass", {eager: true}) // импортируем адаптив последним для наивысшего приоритета

// такая последовательность импортов стилей нужна для контроля очерёдности импорта стилей и их правильного приоритета

// Настройки декоративного звёздного фона. Параметры описаны в app/README.md.
const starfieldOptions = {
    density: 3,              // Множитель плотности: 2 — примерно вдвое больше звёзд.
    brightness: 2,           // Общая яркость звёзд.
    twinkleFrequency: 0.15,  // Базовая частота мерцания, Гц.
    twinkleAmount: 0.34,     // Глубина мерцания, от 0 до 0.5.
    driftSpeed: 5,           // Множитель скорости движения; 0 — без движения.
    starSize: 1.2,             // Множитель размера звёзд.
    glow: 0.13,              // Яркость ореолов.
    nebulaIntensity: 1,      // Яркость сине-фиолетовой дымки.
    maxFps: 30,              // Максимальная частота отрисовки фона.
    maxPixelRatio: 1.25,     // Ограничение разрешения на экранах с высоким DPI.
};

const library = new ExoplanetLibrary({
    maxAttempts: 5,
    retryDelay: 1000,
});

let starfield;

$(document).ready(() => {
    $(".loader").append('<i class="fa-solid fa-spinner loader-symbol"></i>')

    starfield = createStarfield(starfieldOptions);
    void GetPlanets(library);
})

if (import.meta.hot) {
    import.meta.hot.dispose(() => starfield?.dispose());
}
