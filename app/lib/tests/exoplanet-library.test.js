import test from "node:test";
import assert from "node:assert/strict";
import { ExoplanetLibrary } from "../exoplanet-library.js";

function mockNASA(t, responses) {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
        const response = responses[Math.min(calls++, responses.length - 1)];
        if (response instanceof Error) throw response;
        return {
            ok: response.ok ?? true,
            status: response.status ?? 200,
            json: async () => response.data ?? [],
        };
    });
    return () => calls;
}

test("Начальное состояние и отсутствие событий", () => {
    const library = new ExoplanetLibrary();
    assert.equal(library.lastUpdated, null);
    assert.equal(library.status, undefined);
    assert.equal(library.error, undefined);
    assert.equal(library.subscribe, undefined);
    assert.throws(() => library.getPlanets(), /not initialized/);
});

test("init загружает каталог и возвращает undefined", async t => {
    const calls = mockNASA(t, [{ data: [{ pl_name: "Kepler-22 b", pl_rade: 2.4 }] }]);
    const library = new ExoplanetLibrary();
    assert.equal(await library.init(), undefined);
    assert.equal(calls(), 1);
    assert.equal(library.getPlanets()[0].name, "Kepler-22 b");
    assert.ok(library.lastUpdated instanceof Date);
});

test("Повторный init не загружает данные", async t => {
    const calls = mockNASA(t, [{ data: [{ pl_name: "Alpha" }] }]);
    const library = new ExoplanetLibrary();
    await library.init();
    const updated = library.lastUpdated;
    assert.equal(await library.init(), undefined);
    assert.equal(calls(), 1);
    assert.strictEqual(library.lastUpdated, updated);
});

test("getPlanets возвращает копию массива", async t => {
    mockNASA(t, [{ data: [{ pl_name: "Alpha" }] }]);
    const library = new ExoplanetLibrary();
    await library.init();
    library.getPlanets().pop();
    assert.equal(library.getPlanets().length, 1);
});

test("refresh обновляет каталог и возвращает undefined", async t => {
    const calls = mockNASA(t, [
        { data: [{ pl_name: "Alpha" }] },
        { data: [{ pl_name: "Beta" }] },
    ]);
    const library = new ExoplanetLibrary();
    await library.init();
    assert.equal(await library.refresh(), undefined);
    assert.equal(calls(), 2);
    assert.equal(library.getPlanets()[0].name, "Beta");
});

test("refresh до init также загружает каталог", async t => {
    const calls = mockNASA(t, [{ data: [{ pl_name: "Alpha" }] }]);
    const library = new ExoplanetLibrary();
    assert.equal(await library.refresh(), undefined);
    assert.equal(await library.init(), undefined);
    assert.equal(calls(), 1);
});

test("Повтор после временной ошибки", async t => {
    const calls = mockNASA(t, [new Error("Network error"), { data: [{ pl_name: "Alpha" }] }]);
    const library = new ExoplanetLibrary({ retryDelay: 0 });
    await library.init();
    assert.equal(calls(), 2);
    assert.equal(library.getPlanets()[0].name, "Alpha");
});

test("По умолчанию выполняется максимум пять попыток", async t => {
    const calls = mockNASA(t, [new Error("Network error")]);
    const library = new ExoplanetLibrary({ retryDelay: 0 });
    await assert.rejects(library.init(), /Network error/);
    assert.equal(calls(), 5);
    assert.equal(library.lastUpdated, null);
});

test("Настраиваемое количество попыток", async t => {
    const calls = mockNASA(t, [new Error("Network error")]);
    const library = new ExoplanetLibrary({ maxAttempts: 3, retryDelay: 0 });
    await assert.rejects(library.init(), /Network error/);
    assert.equal(calls(), 3);
});

test("После неудачного init можно повторить загрузку", async t => {
    const calls = mockNASA(t, [new Error("Temporary"), { data: [{ pl_name: "Alpha" }] }]);
    const library = new ExoplanetLibrary({ maxAttempts: 1 });
    await assert.rejects(library.init(), /Temporary/);
    assert.equal(await library.init(), undefined);
    assert.equal(calls(), 2);
});

test("После неудачного refresh сохраняется старый каталог", async t => {
    const calls = mockNASA(t, [
        { data: [{ pl_name: "Alpha" }] },
        new Error("NASA unavailable"),
    ]);
    const library = new ExoplanetLibrary({ maxAttempts: 2, retryDelay: 0 });
    await library.init();
    const updated = library.lastUpdated;
    await assert.rejects(library.refresh(), /NASA unavailable/);
    assert.equal(calls(), 3);
    assert.equal(library.getPlanets()[0].name, "Alpha");
    assert.strictEqual(library.lastUpdated, updated);
});

test("Параллельные init используют одну загрузку", async t => {
    const calls = mockNASA(t, [{ data: [{ pl_name: "Alpha" }] }]);
    const library = new ExoplanetLibrary();
    const first = library.init();
    assert.strictEqual(first, library.init());
    assert.deepEqual(await Promise.all([first, library.init()]), [undefined, undefined]);
    assert.equal(calls(), 1);
});

test("Параллельные refresh используют одну загрузку", async t => {
    const calls = mockNASA(t, [{ data: [] }]);
    const library = new ExoplanetLibrary();
    const first = library.refresh();
    assert.strictEqual(first, library.refresh());
    assert.deepEqual(await Promise.all([first, library.refresh()]), [undefined, undefined]);
    assert.equal(calls(), 1);
});

test("init и refresh во время загрузки используют один Promise", async t => {
    const calls = mockNASA(t, [{ data: [] }]);
    const library = new ExoplanetLibrary();
    const first = library.init();
    assert.strictEqual(first, library.refresh());
    await first;
    assert.equal(calls(), 1);
});

test("Некорректные параметры отклоняются", () => {
    assert.throws(() => new ExoplanetLibrary({ maxAttempts: 0 }), RangeError);
    assert.throws(() => new ExoplanetLibrary({ maxAttempts: 2.5 }), RangeError);
    assert.throws(() => new ExoplanetLibrary({ retryDelay: -100 }), RangeError);
});
