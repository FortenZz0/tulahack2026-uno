import test from "node:test";
import assert from "node:assert/strict";

import {
    Planet,
    ExoplanetLibrary,
    queryPlanets,
} from "../index.js";

const rows = [
    {
        pl_name: "Alpha",
        pl_rade: 1,
        pl_bmasse: 1,
        pl_dens: 5.51,
        pl_eqt: 255,
        st_teff: 5780,
        st_lum: 0,
        pl_orbsmax: 1,
        pl_orbeccen: 0,
        pl_orbper: 365,
    },
    {
        pl_name: "Beta",
        pl_rade: 2,
        pl_bmasse: 3,
        pl_dens: 2,
        pl_eqt: 300,
        st_teff: 5780,
        st_lum: 0,
        pl_orbsmax: 1.5,
        pl_orbeccen: 0.1,
        pl_orbper: 500,
    },
    {
        pl_name: "Gamma",
        pl_rade: 3,
        pl_bmasse: 5,
        pl_dens: 1,
        pl_eqt: 400,
        st_teff: 5780,
        st_lum: 0,
        pl_orbsmax: 2,
        pl_orbeccen: 0.2,
        pl_orbper: 700,
    },
];

async function withMockFetch(callback) {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => rows,
    });

    try {
        await callback();
    } finally {
        globalThis.fetch = originalFetch;
    }
}

test("Публичный API экспортирует необходимые функции", () => {
    assert.equal(typeof Planet, "function");
    assert.equal(typeof ExoplanetLibrary, "function");
    assert.equal(typeof queryPlanets, "function");
});

test("Planet доступен через публичный API", () => {
    const planet = new Planet();

    assert.equal(planet.name, null);
    assert.equal(planet.esi.full, null);
    assert.equal(planet.habitableTimeFraction.conservative, null);
});

test("queryPlanets доступен через публичный API", () => {
    const planets = [
        Object.assign(new Planet(), { name: "Alpha", radius: 1 }),
        Object.assign(new Planet(), { name: "Beta", radius: 2 }),
    ];

    const result = queryPlanets(planets, {
        filters: {
            radius: { min: 1.5 },
        },
    });

    assert.deepEqual(result.map(planet => planet.name), ["Beta"]);
});

test("Каталог загружается через публичный API", async () => {
    await withMockFetch(async () => {
        const library = new ExoplanetLibrary({
            maxAttempts: 1,
        });

        await library.refresh();

        assert.equal(library.status, "ready");
        assert.equal(library.getPlanets().length, 3);
        assert.ok(library.lastUpdated instanceof Date);
    });
});

test("getPlanets поддерживает фильтрацию", async () => {
    await withMockFetch(async () => {
        const library = new ExoplanetLibrary({
            maxAttempts: 1,
        });

        await library.refresh();

        const result = library.getPlanets({
            filters: {
                radius: { min: 1.5, max: 2.5 },
            },
        });

        assert.deepEqual(
            result.map(planet => planet.name),
            ["Beta"]
        );
    });
});

test("getPlanets поддерживает сортировку", async () => {
    await withMockFetch(async () => {
        const library = new ExoplanetLibrary({
            maxAttempts: 1,
        });

        await library.refresh();

        const result = library.getPlanets({
            sort: {
                by: "radius",
                order: "desc",
            },
        });

        assert.deepEqual(
            result.map(planet => planet.name),
            ["Gamma", "Beta", "Alpha"]
        );
    });
});

test("getPlanets поддерживает пагинацию", async () => {
    await withMockFetch(async () => {
        const library = new ExoplanetLibrary({
            maxAttempts: 1,
        });

        await library.refresh();

        const result = library.getPlanets({
            sort: {
                by: "radius",
                order: "asc",
            },
            offset: 1,
            limit: 1,
        });

        assert.deepEqual(
            result.map(planet => planet.name),
            ["Beta"]
        );
    });
});

test("getPlanets объединяет фильтрацию и сортировку", async () => {
    await withMockFetch(async () => {
        const library = new ExoplanetLibrary({
            maxAttempts: 1,
        });

        await library.refresh();

        const result = library.getPlanets({
            filters: {
                radius: { min: 2 },
            },
            sort: {
                by: "radius",
                order: "desc",
            },
        });

        assert.deepEqual(
            result.map(planet => planet.name),
            ["Gamma", "Beta"]
        );
    });
});

test("getPlanets не изменяет исходный каталог", async () => {
    await withMockFetch(async () => {
        const library = new ExoplanetLibrary({
            maxAttempts: 1,
        });

        await library.refresh();

        const original = library.getPlanets();

        library.getPlanets({
            sort: {
                by: "radius",
                order: "desc",
            },
        });

        assert.deepEqual(library.getPlanets(), original);
    });
});

test("Подписка на updated работает через публичный API", async () => {
    await withMockFetch(async () => {
        const library = new ExoplanetLibrary({
            maxAttempts: 1,
        });

        let updates = 0;

        const unsubscribe = library.subscribe("updated", () => {
            updates++;
        });

        await library.refresh();
        assert.equal(updates, 1);

        unsubscribe();

        await library.refresh();
        assert.equal(updates, 1);
    });
});

test("Повторное обновление заменяет каталог", async () => {
    await withMockFetch(async () => {
        const library = new ExoplanetLibrary({
            maxAttempts: 1,
        });

        await library.refresh();

        const first = library.getPlanets();

        await library.refresh();

        const second = library.getPlanets();

        assert.equal(second.length, first.length);
        assert.notStrictEqual(second[0], first[0]);
    });
});

test("Некорректный запрос отклоняется через публичный API", async () => {
    await withMockFetch(async () => {
        const library = new ExoplanetLibrary({
            maxAttempts: 1,
        });

        await library.refresh();

        assert.throws(() => {
            library.getPlanets({
                sort: {
                    by: "unknownField",
                    order: "asc",
                },
            });
        }, RangeError);
    });
});
