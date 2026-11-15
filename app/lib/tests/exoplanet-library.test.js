import test from "node:test";
import assert from "node:assert/strict";
import { ExoplanetLibrary } from "../exoplanet-library.js";

const catalog = (id, updatedAt = "2026-11-15T10:00:00Z") => ({
    planets: [{ id, name: id, starId: "star", radius: 1, esi: { simple: 0.8, full: null } }],
    stars: [{ id: "star", name: "Star" }],
    updatedAt,
});
const response = data => ({ ok: true, json: async () => data });
const library = options => new ExoplanetLibrary({ maxAttempts: 1, retryDelay: 0, ...options });

// Управляем завершением запросов явно, без сети и ожиданий по таймеру.
function controlledFetch(t) {
    const requests = [];
    t.mock.method(globalThis, "fetch", (url, options) => new Promise((resolve, reject) => {
        requests.push({ mode: new URL(url).pathname.slice(1), options,
            succeed: data => resolve(response(data)), fail: reject });
    }));
    return requests;
}

test("Начальное состояние и защита чтения до загрузки", () => {
    const lib = library();
    assert.equal(lib.initialized, false);
    assert.equal(lib.fullReady, false);
    assert.equal(lib.lastUpdated, null);
    for (const read of [() => lib.getPlanets(), () => lib.getTopPlanets(),
        () => lib.getStars(), () => lib.getPlanet("x"), () => lib.getStar("x")]) {
        assert.throws(read, /Library is not initialized/);
    }
});

test("init запускает оба режима, объединяет вызовы и открывает preview", async t => {
    const requests = controlledFetch(t);
    const lib = library();
    const pending = lib.init();
    assert.strictEqual(lib.init(), pending);
    assert.deepEqual(requests.map(r => r.mode), ["preview", "full"]);
    requests[0].succeed(catalog("preview"));
    assert.equal(await pending, undefined);
    assert.equal(lib.initialized, true);
    assert.equal(lib.fullReady, false);
    assert.equal(lib.getPlanets()[0].id, "preview");
    await lib.init();
    assert.equal(requests.length, 2);
    const full = lib.whenFullReady();
    requests[1].succeed(catalog("full", "2026-11-15T11:00:00Z"));
    await full;
    assert.equal(lib.fullReady, true);
    assert.equal(lib.getPlanets()[0].id, "full");
    assert.equal(lib.lastUpdated.toISOString(), "2026-11-15T11:00:00.000Z");
});

test("Поздний preview не заменяет полный каталог", async t => {
    const requests = controlledFetch(t);
    const lib = library();
    const pending = lib.init();
    requests[1].succeed(catalog("full"));
    await pending;
    requests[0].succeed(catalog("preview"));
    // Дожидаемся цепочки fetch -> json -> setCatalog у preview.
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(lib.fullReady, true);
    assert.equal(lib.getPlanets()[0].id, "full");
});

for (const failedMode of ["preview", "full"]) {
    test(`Ошибка ${failedMode} не мешает init через другой каталог`, async t => {
        const requests = controlledFetch(t);
        const lib = library();
        const pending = lib.init();
        requests.find(r => r.mode === failedMode).fail(new Error(failedMode));
        requests.find(r => r.mode !== failedMode).succeed(catalog("available"));
        await pending;
        assert.equal(lib.initialized, true);
        assert.equal(lib.fullReady, failedMode === "preview");
        assert.equal(lib.getPlanets()[0].id, "available");
    });
}

test("После отказа обоих режимов init можно повторить", async t => {
    const requests = controlledFetch(t);
    const lib = library();
    const first = lib.init();
    const rejected = assert.rejects(first, error => error instanceof AggregateError && error.errors.length === 2);
    requests[0].fail(new Error("preview unavailable"));
    requests[1].fail(new Error("full unavailable"));
    await rejected;
    assert.equal(lib.initialized, false);
    assert.equal(lib.lastUpdated, null);
    const second = lib.init();
    assert.equal(requests.length, 4);
    requests[2].succeed(catalog("preview"));
    requests[3].succeed(catalog("full"));
    await second;
    await lib.whenFullReady();
    assert.equal(lib.fullReady, true);
});

test("Методы полного каталога используют один запрос и кэш", async t => {
    const requests = controlledFetch(t);
    const lib = library();
    const ready = lib.whenFullReady();
    assert.strictEqual(lib.whenFullReady(), ready);
    assert.strictEqual(lib.refresh(), ready);
    const planets = lib.getFullPlanets({ limit: 0 });
    const stars = lib.getFullStars();
    assert.equal(requests.length, 1);
    const data = catalog("full");
    requests[0].succeed(data);
    await ready;
    assert.deepEqual(await planets, []);
    assert.deepEqual(await stars, data.stars);
    assert.deepEqual(await lib.getFullPlanets(), data.planets);
    await lib.getFullStars();
    await lib.init();
    assert.equal(requests.length, 1);
});

test("refresh заменяет каталог и индексы; ошибка сохраняет предыдущие данные", async t => {
    const requests = controlledFetch(t);
    const lib = library();
    const first = lib.refresh();
    requests[0].succeed(catalog("old"));
    await first;
    const second = lib.refresh();
    assert.strictEqual(lib.refresh(), second);
    requests[1].succeed(catalog("new", "2026-11-15T12:00:00Z"));
    await second;
    assert.equal(lib.getPlanet("old"), null);
    assert.equal(lib.getPlanet("new").id, "new");
    const updatedAt = lib.lastUpdated.getTime();
    const failed = lib.refresh();
    const rejected = assert.rejects(failed, /offline/);
    requests[2].fail(new Error("offline"));
    await rejected;
    assert.equal(lib.getPlanet("new").id, "new");
    assert.equal(lib.lastUpdated.getTime(), updatedAt);
    assert.equal(lib.fullReady, true);
    const retry = lib.refresh();
    requests[3].succeed(catalog("recovered"));
    await retry;
    assert.equal(lib.getPlanet("recovered").id, "recovered");
});

test("Поиск планет, звёзд и связей; lastUpdated возвращает независимую дату", async t => {
    const data = catalog("planet");
    t.mock.method(globalThis, "fetch", async () => response(data));
    const lib = library();
    await lib.whenFullReady();
    assert.strictEqual(lib.getPlanet("planet"), data.planets[0]);
    assert.strictEqual(lib.getStar("star"), data.stars[0]);
    assert.strictEqual(lib.getPlanetStar(data.planets[0]), data.stars[0]);
    assert.equal(lib.getPlanet("missing"), null);
    assert.equal(lib.getStar("missing"), null);
    assert.equal(lib.getPlanetStar({ starId: "missing" }), null);
    const date = lib.lastUpdated;
    date.setFullYear(2000);
    assert.equal(lib.lastUpdated.getUTCFullYear(), 2026);
    const planets = lib.getPlanets();
    planets.pop();
    assert.equal(lib.getPlanets().length, 1);
});

test("Топ-50 использует simple ESI, разрешает равенства по id и не меняет каталог", async t => {
    const data = catalog("unused");
    data.planets = Array.from({ length: 55 }, (_, i) => ({
        id: `p${String(54 - i).padStart(2, "0")}`,
        esi: { simple: i < 2 ? 1 : 0.5, full: i / 100 },
    }));
    data.planets.push(...[null, undefined, NaN, Infinity, "1"].map((simple, i) => ({ id: `missing${i}`, esi: { simple } })), { id: "no-esi" });
    const original = [...data.planets];
    t.mock.method(globalThis, "fetch", async () => response(data));
    const lib = library();
    await lib.whenFullReady();
    const top = lib.getTopPlanets();
    assert.equal(top.length, 50);
    assert.deepEqual(top.slice(0, 3).map(p => p.id), ["p53", "p54", "p00"]);
    assert.equal(top.at(-1).id, "p47");
    assert.ok(top.every(p => Number.isFinite(p.esi.simple)));
    assert.deepEqual(lib.getPlanets(), original);
});

test("Повторы полного запроса ограничены maxAttempts", async t => {
    const error = new Error("offline");
    const fetch = t.mock.method(globalThis, "fetch", async () => { throw error; });
    const lib = library({ maxAttempts: 3 });
    await assert.rejects(lib.whenFullReady(), actual => actual === error);
    assert.equal(fetch.mock.callCount(), 3);
    assert.equal(lib.initialized, false);
});

test("Временная ошибка полного запроса исправляется повтором", async t => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
        if (++calls < 3) throw new Error("temporary");
        return response(catalog("recovered"));
    });
    const lib = library({ maxAttempts: 3 });
    await lib.whenFullReady();
    assert.equal(calls, 3);
    assert.equal(lib.fullReady, true);
});

test("Проверка параметров повторных попыток", () => {
    for (const maxAttempts of [0, -1, 1.5, Infinity, NaN, "2", null, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => library({ maxAttempts }), RangeError);
    }
    for (const retryDelay of [-1, Infinity, NaN, "0", null]) {
        assert.throws(() => library({ retryDelay }), RangeError);
    }
    assert.doesNotThrow(() => library({ maxAttempts: 1, retryDelay: 0 }));
});
