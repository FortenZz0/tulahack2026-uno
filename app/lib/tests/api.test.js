import test from "node:test";
import assert from "node:assert/strict";
import { fetchCatalog } from "../api.js";

const catalog = () => ({ planets: [], stars: [], updatedAt: "2026-11-15T10:00:00Z" });

for (const [mode, priority] of [["preview", "high"], ["full", "low"]]) {
    test(`${mode}: URL, приоритет и готовый каталог`, async t => {
        const data = catalog();
        const fetch = t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => data }));
        assert.strictEqual(await fetchCatalog(mode), data);
        assert.equal(fetch.mock.callCount(), 1);
        const [url, options] = fetch.mock.calls[0].arguments;
        assert.equal(new URL(url).pathname, `/${mode}`);
        assert.equal(new URL(url).protocol, "https:");
        assert.deepEqual(options, { priority });
    });
}

test("Неизвестный режим отклоняется до запроса", async t => {
    const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("Unexpected fetch"); });
    for (const mode of [undefined, null, "", "FULL", "other", 1]) {
        await assert.rejects(fetchCatalog(mode), RangeError);
    }
    assert.equal(fetch.mock.callCount(), 0);
});

test("HTTP ошибка содержит статус и не читает JSON", async t => {
    const json = t.mock.fn();
    t.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 503, json }));
    await assert.rejects(fetchCatalog("full"), /Worker API request failed: 503/);
    assert.equal(json.mock.callCount(), 0);
});

for (const [label, data] of [
    ["null", null], ["массив", []], ["нет полей", {}],
    ["planets не массив", { ...catalog(), planets: {} }],
    ["stars не массив", { ...catalog(), stars: null }],
    ["нет даты", { planets: [], stars: [] }],
    ["дата числом", { ...catalog(), updatedAt: 0 }],
    ["невалидная дата", { ...catalog(), updatedAt: "invalid" }],
]) {
    test(`Некорректный ответ: ${label}`, async t => {
        t.mock.method(globalThis, "fetch", async () => ({ ok: true, json: async () => data }));
        await assert.rejects(fetchCatalog("preview"), { name: "TypeError", message: "Worker API returned invalid data" });
    });
}

for (const stage of ["fetch", "json"]) {
    test(`Ошибка ${stage} передаётся вызывающему коду`, async t => {
        const error = new Error(stage);
        t.mock.method(globalThis, "fetch", async () => {
            if (stage === "fetch") throw error;
            return { ok: true, json: async () => { throw error; } };
        });
        await assert.rejects(fetchCatalog("full"), actual => actual === error);
    });
}
