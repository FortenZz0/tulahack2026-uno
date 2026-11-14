
import test from "node:test";
import assert from "node:assert/strict";

import { fetchPlanets } from "../nasa.js";
import { Planet } from "../planet.js";
import { calculateESI, calculateSimpleESI } from "../esi.js";

const baseRow = {
    pl_name: "Test Planet",
    pl_rade: 1,
    pl_bmasse: 1,
    pl_dens: 5.51,
    pl_eqt: 288,
    pl_insol: 1,
    st_teff: 5780,
    st_lum: 0,
    pl_orbsmax: 1,
    pl_orbeccen: 0,
    pl_orbper: 365.25,
};

const emptyZone = {
    conservative: { inner: null, outer: null },
    optimistic: { inner: null, outer: null },
};

const emptyFraction = {
    conservative: null,
    optimistic: null,
};

async function withMockFetch(rows, callback, status = 200) {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => rows,
    });

    try {
        return await callback();
    } finally {
        globalThis.fetch = originalFetch;
    }
}

test("Загружает планеты из NASA", async () => {
    await withMockFetch([baseRow], async () => {
        const planets = await fetchPlanets();

        assert.equal(planets.length, 1);
        assert.ok(planets[0] instanceof Planet);
        assert.equal(planets[0].name, "Test Planet");
    });
});

test("Пустой ответ возвращает пустой каталог", async () => {
    await withMockFetch([], async () => {
        assert.deepEqual(await fetchPlanets(), []);
    });
});

test("Запрос содержит pl_insol и таблицу pscomppars", async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl;

    globalThis.fetch = async url => {
        requestedUrl = new URL(url.toString());

        return {
            ok: true,
            status: 200,
            json: async () => [],
        };
    };

    try {
        await fetchPlanets();

        const query = requestedUrl.searchParams.get("query");

        assert.match(query, /FROM pscomppars/);
        assert.match(query, /pl_insol/);
        assert.match(query, /pl_name/);
        assert.match(query, /pl_orbeccen/);

        assert.equal(
            requestedUrl.searchParams.get("format"),
            "json"
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("Переносит основные характеристики", async () => {
    await withMockFetch([baseRow], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.mass, 1);
        assert.equal(planet.radius, 1);
        assert.equal(planet.density, 5.51);
        assert.equal(planet.eqt, 288);
        assert.equal(planet.flux, 1);

        assert.equal(planet.star.temperature, 5780);
        assert.equal(planet.star.luminosity, 1);

        assert.equal(planet.orbit.semiMajorAxis, 1);
        assert.equal(planet.orbit.eccentricity, 0);
        assert.equal(planet.orbit.period, 365.25);
    });
});

test("Вычисляет скорость убегания", async () => {
    await withMockFetch([baseRow], async () => {
        const [planet] = await fetchPlanets();

        assert.ok(Math.abs(planet.vesc - 11.186) < 1e-10);
    });
});

test("Преобразует логарифмическую светимость", async () => {
    await withMockFetch([
        { ...baseRow, st_lum: 1 },
        { ...baseRow, st_lum: -1 },
    ], async () => {
        const planets = await fetchPlanets();

        assert.equal(planets[0].star.luminosity, 10);
        assert.ok(
            Math.abs(planets[1].star.luminosity - 0.1) < 1e-12
        );
    });
});

test("Вычисляет полный ESI", async () => {
    await withMockFetch([baseRow], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(
            planet.esi.full,
            calculateESI(1, 5.51, 11.186, 288)
        );
    });
});

test("Вычисляет упрощённый ESI по радиусу и flux", async () => {
    await withMockFetch([
        { ...baseRow, pl_rade: 2, pl_insol: 2 },
    ], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.flux, 2);
        assert.equal(
            planet.esi.simple,
            calculateSimpleESI(2, 2)
        );
        assert.ok(
            Math.abs(planet.esi.simple - 2 / 3) < 1e-10
        );
    });
});

test("Без flux упрощённый ESI неизвестен", async () => {
    await withMockFetch([
        { ...baseRow, pl_insol: null },
    ], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.flux, null);
        assert.equal(planet.esi.simple, null);
        assert.ok(Number.isFinite(planet.esi.full));
    });
});

test("Нулевой flux допустим", async () => {
    await withMockFetch([
        { ...baseRow, pl_insol: 0 },
    ], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.flux, 0);
        assert.equal(
            planet.esi.simple,
            calculateSimpleESI(1, 0)
        );
    });
});

test("Отрицательный flux отклоняется", async () => {
    await withMockFetch([
        { ...baseRow, pl_insol: -2 },
    ], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.flux, null);
        assert.equal(planet.esi.simple, null);
    });
});

test("Flux не вычисляется из светимости и орбиты", async () => {
    await withMockFetch([
        {
            ...baseRow,
            pl_insol: null,
            st_lum: 0,
            pl_orbsmax: 1,
        },
    ], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.flux, null);
        assert.equal(planet.esi.simple, null);
    });
});

test("Без радиуса оба ESI неизвестны", async () => {
    await withMockFetch([
        { ...baseRow, pl_rade: null },
    ], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.esi.full, null);
        assert.equal(planet.esi.simple, null);
    });
});

test("Без плотности полный ESI неизвестен", async () => {
    await withMockFetch([
        { ...baseRow, pl_dens: null },
    ], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.esi.full, null);
        assert.equal(planet.esi.simple, 1);
    });
});

test("Вычисляет зону обитаемости", async () => {
    await withMockFetch([baseRow], async () => {
        const [planet] = await fetchPlanets();

        assert.ok(planet.habitableZone.conservative.inner > 0);
        assert.ok(
            planet.habitableZone.conservative.outer >
            planet.habitableZone.conservative.inner
        );

        assert.ok(planet.habitableZone.optimistic.inner > 0);
        assert.ok(
            planet.habitableZone.optimistic.outer >
            planet.habitableZone.optimistic.inner
        );
    });
});

test("Вычисляет долю времени в зоне обитаемости", async () => {
    await withMockFetch([baseRow], async () => {
        const [planet] = await fetchPlanets();

        for (const fraction of Object.values(
            planet.habitableTimeFraction
        )) {
            assert.ok(Number.isFinite(fraction));
            assert.ok(fraction >= 0 && fraction <= 1);
        }
    });
});

test("Круговая орбита имеет эксцентриситет ноль", async () => {
    await withMockFetch([baseRow], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.orbit.eccentricity, 0);
    });
});

test("Некорректный эксцентриситет отклоняется", async () => {
    for (const eccentricity of [-0.1, 1, 1.5, "invalid"]) {
        await withMockFetch([
            { ...baseRow, pl_orbeccen: eccentricity },
        ], async () => {
            const [planet] = await fetchPlanets();

            assert.equal(planet.orbit.eccentricity, null);
            assert.deepEqual(
                planet.habitableTimeFraction,
                emptyFraction
            );
        });
    }
});

test("Отсутствующий эксцентриситет не считается нулевым", async () => {
    await withMockFetch([
        { ...baseRow, pl_orbeccen: null },
    ], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.orbit.eccentricity, null);
        assert.deepEqual(
            planet.habitableTimeFraction,
            emptyFraction
        );
    });
});

test("Без большой полуоси доля времени неизвестна", async () => {
    await withMockFetch([
        { ...baseRow, pl_orbsmax: null },
    ], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.orbit.semiMajorAxis, null);
        assert.deepEqual(
            planet.habitableTimeFraction,
            emptyFraction
        );
    });
});

test("Звезда вне диапазона модели не прерывает загрузку", async () => {
    await withMockFetch([
        { ...baseRow, st_teff: 2500 },
        { ...baseRow, st_teff: 7300 },
        baseRow,
    ], async () => {
        const planets = await fetchPlanets();

        assert.equal(planets.length, 3);

        for (const planet of planets.slice(0, 2)) {
            assert.deepEqual(planet.habitableZone, emptyZone);
            assert.deepEqual(
                planet.habitableTimeFraction,
                emptyFraction
            );
        }

        assert.ok(
            planets[2].habitableZone.conservative.inner > 0
        );
    });
});

test("Границы температурной модели допустимы", async () => {
    await withMockFetch([
        { ...baseRow, st_teff: 2600 },
        { ...baseRow, st_teff: 7200 },
    ], async () => {
        const planets = await fetchPlanets();

        for (const planet of planets) {
            assert.ok(
                planet.habitableZone.conservative.inner > 0
            );
        }
    });
});

test("Отсутствующие данные остаются null", async () => {
    await withMockFetch([{
        pl_name: "Unknown Planet",
        pl_rade: null,
        pl_bmasse: null,
        pl_dens: null,
        pl_eqt: null,
        pl_insol: null,
        st_teff: null,
        st_lum: null,
        pl_orbsmax: null,
        pl_orbeccen: null,
        pl_orbper: null,
    }], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.name, "Unknown Planet");
        assert.equal(planet.mass, null);
        assert.equal(planet.radius, null);
        assert.equal(planet.density, null);
        assert.equal(planet.vesc, null);
        assert.equal(planet.eqt, null);
        assert.equal(planet.flux, null);

        assert.equal(planet.esi.full, null);
        assert.equal(planet.esi.simple, null);

        assert.equal(planet.star.temperature, null);
        assert.equal(planet.star.luminosity, null);

        assert.equal(planet.orbit.semiMajorAxis, null);
        assert.equal(planet.orbit.eccentricity, null);
        assert.equal(planet.orbit.period, null);

        assert.deepEqual(planet.habitableZone, emptyZone);
        assert.deepEqual(
            planet.habitableTimeFraction,
            emptyFraction
        );
    });
});

test("Некорректные числовые значения становятся null", async () => {
    await withMockFetch([{
        ...baseRow,
        pl_rade: -1,
        pl_bmasse: "invalid",
        pl_dens: 0,
        pl_eqt: -100,
        pl_insol: -5,
        pl_orbper: -5,
    }], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.radius, null);
        assert.equal(planet.mass, null);
        assert.equal(planet.density, null);
        assert.equal(planet.eqt, null);
        assert.equal(planet.flux, null);
        assert.equal(planet.orbit.period, null);
        assert.equal(planet.vesc, null);
        assert.equal(planet.esi.full, null);
        assert.equal(planet.esi.simple, null);
    });
});

test("Невозможная светимость не используется", async () => {
    await withMockFetch([
        { ...baseRow, st_lum: 1000 },
    ], async () => {
        const [planet] = await fetchPlanets();

        assert.equal(planet.star.luminosity, null);
        assert.deepEqual(planet.habitableZone, emptyZone);
        assert.deepEqual(
            planet.habitableTimeFraction,
            emptyFraction
        );
    });
});

test("Каждая планета имеет независимые вложенные объекты", async () => {
    await withMockFetch([baseRow, baseRow], async () => {
        const [first, second] = await fetchPlanets();

        assert.notStrictEqual(first, second);
        assert.notStrictEqual(first.star, second.star);
        assert.notStrictEqual(first.orbit, second.orbit);
        assert.notStrictEqual(first.esi, second.esi);
        assert.notStrictEqual(
            first.habitableZone,
            second.habitableZone
        );
        assert.notStrictEqual(
            first.habitableTimeFraction,
            second.habitableTimeFraction
        );
    });
});

test("Ошибка HTTP вызывает исключение", async () => {
    await withMockFetch([], async () => {
        await assert.rejects(
            fetchPlanets(),
            /NASA API request failed: 503/
        );
    }, 503);
});

test("Некорректный формат ответа вызывает исключение", async () => {
    await withMockFetch({ planets: [] }, async () => {
        await assert.rejects(fetchPlanets(), TypeError);
    });
});

test("Ошибка сети передаётся вызывающему коду", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => {
        throw new Error("Network unavailable");
    };

    try {
        await assert.rejects(
            fetchPlanets(),
            /Network unavailable/
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});
