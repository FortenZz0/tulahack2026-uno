import test from "node:test";
import assert from "node:assert/strict";

import { ExoplanetLibrary } from "../exoplanet-library.js";

function mockNASA(t, responses) {
    let calls = 0;

    t.mock.method(globalThis, "fetch", async () => {
        const response = responses[Math.min(calls++, responses.length - 1)];

        if (response instanceof Error) {
            throw response;
        }

        return {
            ok: response.ok ?? true,
            status: response.status ?? 200,
            json: async () => response.data ?? [],
        };
    });

    return () => calls;
}

test("Начальное состояние библиотеки", () => {
    const library = new ExoplanetLibrary();

    assert.equal(library.status, "idle");
    assert.equal(library.lastUpdated, null);
    assert.equal(library.error, null);
    assert.deepEqual(library.getPlanets(), []);
});

test("Успешная загрузка каталога", async (t) => {
    mockNASA(t, [{
        data: [{ pl_name: "Kepler-22 b", pl_rade: 2.4 }],
    }]);

    const library = new ExoplanetLibrary();

    const result = await library.refresh();

    assert.equal(library.status, "ready");
    assert.equal(result.length, 1);
    assert.equal(library.getPlanets()[0].name, "Kepler-22 b");
    assert.ok(library.lastUpdated instanceof Date);
    assert.equal(library.error, null);
});

test("Возвращается копия массива каталога", async (t) => {
    mockNASA(t, [{
        data: [{ pl_name: "Kepler-22 b" }],
    }]);

    const library = new ExoplanetLibrary();

    await library.refresh();

    const planets = library.getPlanets();
    planets.pop();

    assert.equal(library.getPlanets().length, 1);
});

test("События loading и updated вызываются в правильном порядке", async (t) => {
    mockNASA(t, [{ data: [] }]);

    const library = new ExoplanetLibrary();
    const events = [];

    library.subscribe("loading", () => {
        events.push("loading");
        assert.equal(library.status, "loading");
    });

    library.subscribe("updated", () => {
        events.push("updated");
        assert.equal(library.status, "ready");
    });

    await library.refresh();

    assert.deepEqual(events, ["loading", "updated"]);
});

test("Отписка от событий", async (t) => {
    mockNASA(t, [{ data: [] }]);

    const library = new ExoplanetLibrary();
    let updated = 0;

    const unsubscribe = library.subscribe("updated", () => {
        updated++;
    });

    await library.refresh();
    unsubscribe();
    await library.refresh();

    assert.equal(updated, 1);
});

test("Повторная попытка после сетевой ошибки", async (t) => {
    const getCalls = mockNASA(t, [
        new Error("Network error"),
        { data: [{ pl_name: "Earth-like" }] },
    ]);

    const library = new ExoplanetLibrary({
        maxAttempts: 5,
        retryDelay: 0,
    });

    await library.refresh();

    assert.equal(getCalls(), 2);
    assert.equal(library.status, "ready");
    assert.equal(library.getPlanets()[0].name, "Earth-like");
});

test("По умолчанию выполняется максимум 5 попыток", async (t) => {
    const getCalls = mockNASA(t, [
        new Error("Network error"),
    ]);

    const library = new ExoplanetLibrary({
        retryDelay: 0,
    });

    await assert.rejects(library.refresh(), /Network error/);

    assert.equal(getCalls(), 5);
    assert.equal(library.status, "error");
});

test("Настраиваемое количество попыток", async (t) => {
    const getCalls = mockNASA(t, [
        new Error("Network error"),
    ]);

    const library = new ExoplanetLibrary({
        maxAttempts: 3,
        retryDelay: 0,
    });

    await assert.rejects(library.refresh(), /Network error/);

    assert.equal(getCalls(), 3);
});

test("Промежуточная ошибка не вызывает событие error", async (t) => {
    mockNASA(t, [
        new Error("Temporary error"),
        { data: [] },
    ]);

    const library = new ExoplanetLibrary({
        retryDelay: 0,
    });

    let errors = 0;
    let updates = 0;

    library.subscribe("error", () => errors++);
    library.subscribe("updated", () => updates++);

    await library.refresh();

    assert.equal(errors, 0);
    assert.equal(updates, 1);
    assert.equal(library.error, null);
});

test("Ошибка возникает после исчерпания всех попыток", async (t) => {
    mockNASA(t, [new Error("NASA unavailable")]);

    const library = new ExoplanetLibrary({
        maxAttempts: 2,
        retryDelay: 0,
    });

    let errors = 0;

    library.subscribe("error", () => {
        errors++;
    });

    await assert.rejects(library.refresh(), /NASA unavailable/);

    assert.equal(errors, 1);
    assert.equal(library.status, "error");
    assert.match(library.error.message, /NASA unavailable/);
});

test("Старый каталог сохраняется после неудачного обновления", async (t) => {
    const getCalls = mockNASA(t, [
        { data: [{ pl_name: "Kepler-22 b" }] },
        new Error("NASA unavailable"),
    ]);

    const library = new ExoplanetLibrary({
        maxAttempts: 2,
        retryDelay: 0,
    });

    await library.refresh();

    const lastUpdated = library.lastUpdated;

    await assert.rejects(library.refresh(), /NASA unavailable/);

    assert.equal(getCalls(), 3);
    assert.equal(library.status, "error");
    assert.equal(library.getPlanets()[0].name, "Kepler-22 b");
    assert.equal(library.lastUpdated, lastUpdated);
});

test("Параллельные вызовы refresh используют один запрос", async (t) => {
    const getCalls = mockNASA(t, [{
        data: [{ pl_name: "Kepler-22 b" }],
    }]);

    const library = new ExoplanetLibrary();

    const [first, second, third] = await Promise.all([
        library.refresh(),
        library.refresh(),
        library.refresh(),
    ]);

    assert.equal(getCalls(), 1);
    assert.deepEqual(first, second);
    assert.deepEqual(second, third);
});

test("Повторный refresh из loading не создаёт второй запрос", async (t) => {
    const getCalls = mockNASA(t, [{ data: [] }]);

    const library = new ExoplanetLibrary();
    let secondRefresh;

    library.subscribe("loading", () => {
        secondRefresh = library.refresh();
    });

    const firstRefresh = library.refresh();

    assert.strictEqual(firstRefresh, secondRefresh);

    await firstRefresh;

    assert.equal(getCalls(), 1);
});

test("Некорректные параметры отклоняются", () => {
    assert.throws(
        () => new ExoplanetLibrary({ maxAttempts: 0 }),
        RangeError,
    );

    assert.throws(
        () => new ExoplanetLibrary({ maxAttempts: 2.5 }),
        RangeError,
    );

    assert.throws(
        () => new ExoplanetLibrary({ retryDelay: -100 }),
        RangeError,
    );
});

test("Некорректная подписка отклоняется", () => {
    const library = new ExoplanetLibrary();

    assert.throws(
        () => library.subscribe("unknown", () => {}),
        RangeError,
    );

    assert.throws(
        () => library.subscribe("updated", null),
        TypeError,
    );
});
