import test from "node:test";
import assert from "node:assert/strict";

import { fetchPlanets } from "../nasa.js";
import { Planet } from "../planet.js";
import {
    calculateHabitableZone,
    calculateHabitableTimeFraction
} from "../habitable-zone.js";

function mockNASA(t, data, status = 200) {
    let requests = 0;
    let query = null;

    t.mock.method(globalThis, "fetch", async (url) => {
        requests++;

        const params = new URL(url).searchParams;
        query = params.get("query");

        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => data,
        };
    });

    return {
        getRequests: () => requests,
        getQuery: () => query,
    };
}

function makePlanet(overrides = {}) {
    return {
        pl_name: "Test Planet",
        pl_rade: 1,
        pl_bmasse: 1,
        pl_dens: 5.51,
        pl_eqt: 255,
        st_teff: 5780,
        st_lum: 0,
        pl_orbsmax: 1,
        pl_orbeccen: 0,
        pl_orbper: 365.25,
        ...overrides,
    };
}

test("Запрос содержит необходимые поля NASA", async (t) => {
    const mock = mockNASA(t, []);

    await fetchPlanets();

    const query = mock.getQuery();

    for (const field of [
        "pl_name",
        "pl_rade",
        "pl_bmasse",
        "pl_dens",
        "pl_eqt",
        "st_teff",
        "st_lum",
        "pl_orbsmax",
        "pl_orbeccen",
        "pl_orbper",
    ]) {
        assert.match(query, new RegExp(`\\b${field}\\b`));
    }

    assert.equal(mock.getRequests(), 1);
});

test("Данные NASA преобразуются в Planet", async (t) => {
    mockNASA(t, [makePlanet()]);

    const planets = await fetchPlanets();

    assert.equal(planets.length, 1);
    assert.ok(planets[0] instanceof Planet);

    const planet = planets[0];

    assert.equal(planet.name, "Test Planet");
    assert.equal(planet.radius, 1);
    assert.equal(planet.mass, 1);
    assert.equal(planet.density, 5.51);
    assert.equal(planet.eqt, 255);
    assert.ok(Math.abs(planet.vesc - 11.186) < 1e-10);
});

test("Название планеты очищается от пробелов", async (t) => {
    mockNASA(t, [makePlanet({
        pl_name: "  Kepler-22 b  ",
    })]);

    const [planet] = await fetchPlanets();

    assert.equal(planet.name, "Kepler-22 b");
});

test("Некорректное название преобразуется в null", async (t) => {
    mockNASA(t, [
        makePlanet({ pl_name: "unknown" }),
        makePlanet({ pl_name: "  " }),
        makePlanet({ pl_name: null }),
    ]);

    const planets = await fetchPlanets();

    assert.ok(planets.every(planet => planet.name === null));
});

test("Характеристики звезды заполняются", async (t) => {
    mockNASA(t, [makePlanet()]);

    const [planet] = await fetchPlanets();

    assert.equal(planet.star.temperature, 5780);
    assert.equal(planet.star.luminosity, 1);
});

test("Логарифмическая светимость преобразуется", async (t) => {
    mockNASA(t, [
        makePlanet({ st_lum: 1 }),
        makePlanet({ st_lum: -1 }),
        makePlanet({ st_lum: 0 }),
    ]);

    const planets = await fetchPlanets();

    assert.ok(Math.abs(planets[0].star.luminosity - 10) < 1e-10);
    assert.ok(Math.abs(planets[1].star.luminosity - 0.1) < 1e-10);
    assert.equal(planets[2].star.luminosity, 1);
});

test("Орбитальные характеристики заполняются", async (t) => {
    mockNASA(t, [makePlanet()]);

    const [planet] = await fetchPlanets();

    assert.equal(planet.orbit.semiMajorAxis, 1);
    assert.equal(planet.orbit.eccentricity, 0);
    assert.equal(planet.orbit.period, 365.25);
});

test("Некорректный эксцентриситет отклоняется", async (t) => {
    mockNASA(t, [
        makePlanet({ pl_orbeccen: -0.1 }),
        makePlanet({ pl_orbeccen: 1 }),
        makePlanet({ pl_orbeccen: 1.5 }),
        makePlanet({ pl_orbeccen: null }),
    ]);

    const planets = await fetchPlanets();

    for (const planet of planets) {
        assert.equal(planet.orbit.eccentricity, null);
        assert.equal(planet.habitableTimeFraction, null);
    }
});

test("Рассчитываются упрощённый и полный ESI", async (t) => {
    mockNASA(t, [makePlanet()]);

    const [planet] = await fetchPlanets();

    assert.ok(Number.isFinite(planet.esi.simple));
    assert.ok(Number.isFinite(planet.esi.full));
    assert.ok(planet.esi.simple >= 0 && planet.esi.simple <= 1);
    assert.ok(planet.esi.full >= 0 && planet.esi.full <= 1);
});

test("Рассчитываются границы зоны обитаемости", async (t) => {
    mockNASA(t, [makePlanet()]);

    const [planet] = await fetchPlanets();
    const expected = calculateHabitableZone(5780, 1);

    assert.deepEqual(planet.habitableZone, expected);

    assert.ok(
        planet.habitableZone.conservative.inner <
        planet.habitableZone.conservative.outer
    );

    assert.ok(
        planet.habitableZone.optimistic.inner <
        planet.habitableZone.optimistic.outer
    );
});

test("Круговая орбита внутри зоны даёт долю времени 1", async (t) => {
    mockNASA(t, [makePlanet()]);

    const [planet] = await fetchPlanets();

    assert.deepEqual(planet.habitableTimeFraction, {
        conservative: 1,
        optimistic: 1,
    });
});

test("Эллиптическая орбита рассчитывается корректно", async (t) => {
    mockNASA(t, [makePlanet({
        pl_orbsmax: 1.5,
        pl_orbeccen: 0.4,
    })]);

    const [planet] = await fetchPlanets();

    const expected = calculateHabitableTimeFraction(
        1.5,
        0.4,
        calculateHabitableZone(5780, 1)
    );

    assert.deepEqual(planet.habitableTimeFraction, expected);

    assert.ok(planet.habitableTimeFraction.conservative > 0);
    assert.ok(planet.habitableTimeFraction.conservative < 1);
});

test("Звезда вне диапазона модели не прерывает загрузку", async (t) => {
    mockNASA(t, [
        makePlanet({ st_teff: 8000 }),
        makePlanet({ st_teff: 5780 }),
        makePlanet({ st_teff: 2000 }),
    ]);

    const planets = await fetchPlanets();

    assert.equal(planets.length, 3);

    assert.equal(planets[0].habitableZone, null);
    assert.equal(planets[0].habitableTimeFraction, null);

    assert.ok(planets[1].habitableZone !== null);

    assert.equal(planets[2].habitableZone, null);
    assert.equal(planets[2].habitableTimeFraction, null);
});

test("Границы температурного диапазона допускаются", async (t) => {
    mockNASA(t, [
        makePlanet({ st_teff: 2600 }),
        makePlanet({ st_teff: 7200 }),
    ]);

    const planets = await fetchPlanets();

    for (const planet of planets) {
        assert.ok(planet.habitableZone !== null);
    }
});

test("Отсутствующие данные не заменяются выдуманными", async (t) => {
    mockNASA(t, [makePlanet({
        pl_rade: null,
        pl_bmasse: null,
        pl_dens: null,
        pl_eqt: null,
        st_teff: null,
        st_lum: null,
        pl_orbsmax: null,
        pl_orbeccen: null,
        pl_orbper: null,
    })]);

    const [planet] = await fetchPlanets();

    assert.equal(planet.radius, null);
    assert.equal(planet.mass, null);
    assert.equal(planet.density, null);
    assert.equal(planet.eqt, null);
    assert.equal(planet.vesc, null);

    assert.equal(planet.esi.simple, null);
    assert.equal(planet.esi.full, null);

    assert.equal(planet.star.temperature, null);
    assert.equal(planet.star.luminosity, null);

    assert.equal(planet.orbit.semiMajorAxis, null);
    assert.equal(planet.orbit.eccentricity, null);
    assert.equal(planet.orbit.period, null);

    assert.equal(planet.habitableZone, null);
    assert.equal(planet.habitableTimeFraction, null);
});

test("Отсутствующий эксцентриситет не считается нулевым", async (t) => {
    mockNASA(t, [makePlanet({
        pl_orbeccen: null,
    })]);

    const [planet] = await fetchPlanets();

    assert.ok(planet.habitableZone !== null);
    assert.equal(planet.orbit.eccentricity, null);
    assert.equal(planet.habitableTimeFraction, null);
});

test("Ошибка NASA API вызывает исключение", async (t) => {
    mockNASA(t, [], 503);

    await assert.rejects(
        fetchPlanets(),
        /NASA API error: 503/
    );
});

test("Пустой ответ возвращает пустой массив", async (t) => {
    mockNASA(t, []);

    assert.deepEqual(await fetchPlanets(), []);
});
