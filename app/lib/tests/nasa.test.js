import test from "node:test";
import assert from "node:assert/strict";

import { fetchPlanets } from "../nasa.js";
import { Planet } from "../types.js";


function mockFetch(t, data, status = 200) {
    const requests = [];

    t.mock.method(globalThis, "fetch", async (url) => {
        requests.push(new URL(url));

        return {
            ok: status >= 200 && status < 300,
            status,
            json: async () => data,
        };
    });

    return requests;
}

function createPlanetData(overrides = {}) {
    return {
        pl_name: "Earth",
        pl_rade: 1,
        pl_bmasse: 1,
        pl_dens: 5.51,
        pl_eqt: 288,
        ...overrides,
    };
}

test("Отправка запроса к NASA API", async (t) => {
    const requests = mockFetch(t, []);

    await fetchPlanets();

    assert.equal(requests.length, 1);

    const url = requests[0];

    assert.equal(
        url.origin,
        "https://exoplanetarchive.ipac.caltech.edu"
    );

    assert.equal(url.pathname, "/TAP/sync");
    assert.equal(url.searchParams.get("format"), "json");

    const query = url.searchParams.get("query");

    assert.match(query, /FROM\s+pscomppars/i);

    for (const field of [
        "pl_name",
        "pl_rade",
        "pl_bmasse",
        "pl_dens",
        "pl_eqt",
    ]) {
        assert.ok(query.includes(field));
    }
});

test("Пустой ответ NASA", async (t) => {
    mockFetch(t, []);

    const planets = await fetchPlanets();

    assert.deepEqual(planets, []);
});

test("Создание экземпляров Planet", async (t) => {
    mockFetch(t, [
        createPlanetData({ pl_name: "Earth" }),
        createPlanetData({ pl_name: "Mars" }),
    ]);

    const planets = await fetchPlanets();

    assert.equal(planets.length, 2);

    assert.ok(planets[0] instanceof Planet);
    assert.ok(planets[1] instanceof Planet);

    assert.equal(planets[0].name, "Earth");
    assert.equal(planets[1].name, "Mars");
});

test("Преобразование корректных данных планеты", async (t) => {
    mockFetch(t, [
        createPlanetData({
            pl_name: "  Kepler-22 b  ",
            pl_rade: 2.4,
            pl_bmasse: 5.2,
            pl_dens: 3.1,
            pl_eqt: 262,
        }),
    ]);

    const [planet] = await fetchPlanets();

    assert.equal(planet.name, "Kepler-22 b");
    assert.equal(planet.radius, 2.4);
    assert.equal(planet.mass, 5.2);
    assert.equal(planet.density, 3.1);
    assert.equal(planet.eqt, 262);
});

test("Некорректные названия преобразуются в null", async (t) => {
    const invalidNames = [
        null,
        undefined,
        "",
        "   ",
        "unknown",
        " UNKNOWN ",
        "null",
        "N/A",
        "none",
        123,
        true,
    ];

    mockFetch(
        t,
        invalidNames.map(name =>
            createPlanetData({ pl_name: name })
        )
    );

    const planets = await fetchPlanets();

    assert.equal(planets.length, invalidNames.length);

    for (const planet of planets) {
        assert.equal(planet.name, null);
    }
});

test("Некорректные числовые значения преобразуются в null", async (t) => {
    const invalidValues = [
        null,
        undefined,
        0,
        -1,
        NaN,
        Infinity,
        -Infinity,
        "1.5",
        "",
        true,
    ];

    const fields = [
        ["pl_rade", "radius"],
        ["pl_bmasse", "mass"],
        ["pl_dens", "density"],
        ["pl_eqt", "eqt"],
    ];

    for (const [source, target] of fields) {
        const data = invalidValues.map(value =>
            createPlanetData({ [source]: value })
        );

        // Для каждого поля отдельно подменяем ответ API
        const fetchMock = t.mock.method(
            globalThis,
            "fetch",
            async () => ({
                ok: true,
                status: 200,
                json: async () => data,
            })
        );

        const planets = await fetchPlanets();

        for (const planet of planets) {
            assert.equal(planet[target], null);
        }

        fetchMock.mock.restore();
    }
});

test("Расчёт второй космической скорости", async (t) => {
    mockFetch(t, [
        createPlanetData({
            pl_rade: 1,
            pl_bmasse: 1,
        }),
        createPlanetData({
            pl_rade: 2,
            pl_bmasse: 4,
        }),
    ]);

    const planets = await fetchPlanets();

    assert.ok(
        Math.abs(planets[0].vesc - 11.186) < 1e-10
    );

    assert.ok(
        Math.abs(
            planets[1].vesc - 11.186 * Math.sqrt(2)
        ) < 1e-10
    );
});

test("Вторая космическая скорость не рассчитывается без массы или радиуса", async (t) => {
    mockFetch(t, [
        createPlanetData({ pl_bmasse: null }),
        createPlanetData({ pl_rade: null }),
    ]);

    const planets = await fetchPlanets();

    for (const planet of planets) {
        assert.ok(planet.vesc == null);
    }
});

test("Расчёт ESI для планеты с полными данными", async (t) => {
    mockFetch(t, [createPlanetData()]);

    const [planet] = await fetchPlanets();

    assert.equal(typeof planet.esi.simple, "number");
    assert.equal(typeof planet.esi.full, "number");

    assert.ok(Number.isFinite(planet.esi.simple));
    assert.ok(Number.isFinite(planet.esi.full));

    assert.ok(planet.esi.simple >= 0);
    assert.ok(planet.esi.simple <= 1);

    assert.ok(planet.esi.full >= 0);
    assert.ok(planet.esi.full <= 1);
});

test("Полный ESI не рассчитывается без плотности", async (t) => {
    mockFetch(t, [
        createPlanetData({ pl_dens: null }),
    ]);

    const [planet] = await fetchPlanets();

    assert.equal(typeof planet.esi.simple, "number");
    assert.ok(planet.esi.full == null);
});

test("ESI не рассчитывается без температуры", async (t) => {
    mockFetch(t, [
        createPlanetData({ pl_eqt: null }),
    ]);

    const [planet] = await fetchPlanets();

    assert.ok(planet.esi.simple == null);
    assert.ok(planet.esi.full == null);
});

test("Ошибка HTTP от NASA API", async (t) => {
    mockFetch(t, [], 500);

    await assert.rejects(
        fetchPlanets(),
        {
            message: "NASA API error: 500",
        }
    );
});

test("Ошибка 429 при ограничении запросов", async (t) => {
    mockFetch(t, [], 429);

    await assert.rejects(
        fetchPlanets(),
        {
            message: "NASA API error: 429",
        }
    );
});

test("Сетевая ошибка передаётся вызывающему коду", async (t) => {
    t.mock.method(globalThis, "fetch", async () => {
        throw new TypeError("Network error");
    });

    await assert.rejects(
        fetchPlanets(),
        {
            name: "TypeError",
            message: "Network error",
        }
    );
});

test("Ошибка разбора JSON передаётся вызывающему коду", async (t) => {
    t.mock.method(globalThis, "fetch", async () => ({
        ok: true,
        status: 200,
        json: async () => {
            throw new SyntaxError("Invalid JSON");
        },
    }));

    await assert.rejects(
        fetchPlanets(),
        {
            name: "SyntaxError",
            message: "Invalid JSON",
        }
    );
});
