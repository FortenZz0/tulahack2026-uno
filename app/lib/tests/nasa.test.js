import test from "node:test";
import assert from "node:assert/strict";
import { fetchPlanets, nasaToPlanet, Planet } from "../index.js";

test("NASA: единицы и вычисление скорости убегания из плотности и радиуса", () => {
    const planet = nasaToPlanet({ pl_rade: 1, pl_dens: 5.51, pl_eqt: 255 });
    assert.ok(planet instanceof Planet);
    assert.equal(planet.radius, 1);
    assert.equal(planet.density, 5.51);
    assert.equal(planet.eqt, 255);
    assert.ok(Math.abs(planet.vesc - 11.18) < 0.02);
});

test("NASA: пропуски, некорректные числа и пределы не становятся измерениями", () => {
    for (const value of [undefined, null, "1", "", NaN, Infinity, -1, 0]) {
        const planet = nasaToPlanet({ pl_rade: value, pl_dens: value, pl_eqt: value });
        assert.deepEqual(planet, new Planet());
    }
    const planet = nasaToPlanet({ pl_rade: 1, pl_radelim: 1, pl_dens: 5, pl_eqt: 200, pl_eqtlim: -1 });
    assert.equal(planet.radius, null);
    assert.equal(planet.vesc, null);
    assert.equal(planet.eqt, null);
    assert.equal(nasaToPlanet({ pl_rade: 1 }).vesc, null);
});

test("NASA: загрузка использует TAP, default-строки и передаёт отмену", async () => {
    const signal = new AbortController().signal;
    const planets = await fetchPlanets({ signal, fetchImpl: async (url, options) => {
        assert.equal(url.origin, "https://exoplanetarchive.ipac.caltech.edu");
        assert.match(url.searchParams.get("query"), /from ps where default_flag = 1/);
        assert.equal(url.searchParams.get("format"), "json");
        assert.equal(options.signal, signal);
        return { ok: true, json: async () => [{ pl_rade: 2 }] };
    } });
    assert.equal(planets.length, 1);
    assert.ok(planets[0] instanceof Planet);
    assert.equal(planets[0].radius, 2);
});

test("NASA: ошибки загрузки и повреждённый JSON не скрываются", async () => {
    await assert.rejects(fetchPlanets({ fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
    await assert.rejects(fetchPlanets({ fetchImpl: async () => { throw new Error("offline"); } }), /offline/);
    for (const data of [{ error: "query failed" }, [null], [[]]]) {
        await assert.rejects(fetchPlanets({ fetchImpl: async () => ({ ok: true, json: async () => data }) }), TypeError);
    }
    await assert.rejects(fetchPlanets({ fetchImpl: async () => ({ ok: true, json: async () => { throw new SyntaxError("JSON"); } }) }), SyntaxError);
});
