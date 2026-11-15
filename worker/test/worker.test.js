import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { after, test } from "node:test";

const hooks = registerHooks({
    load(url, context, nextLoad) {
        if (url.endsWith(".prompt.md")) {
            return {
                format: "module",
                source: `export default ${JSON.stringify(readFileSync(new URL(url), "utf8"))};`,
                shortCircuit: true
            };
        }
        return nextLoad(url, context);
    }
});
const { default: worker, DescriptionGenerator } = await import("../src/index.js");
const originalFetch = globalThis.fetch;
after(() => { globalThis.fetch = originalFetch; hooks.deregister(); });

function createEnv(count = 2) {
    const updatedAt = "2026-11-15T00:00:00.000Z";
    const planets = Array.from({ length: count }, (_, index) => ({
        id: `planet:test ${index}`, name: `Test ${index}`, starId: "star:test",
        esi: { simple: index / count, full: null }, measurements: {}, flags: {}
    }));
    const stars = [{ id: "star:test", name: "Test", planets: planets.map(p => p.id), measurements: {}, flags: {} }];
    const values = new Map([
        ["planets.json", JSON.stringify({ updatedAt, planets })],
        ["stars.json", JSON.stringify({ updatedAt, stars })]
    ]);
    const objects = new Map();
    const stores = new Map();
    const env = {
        AI_TOKEN: "test-token",
        PLANETS_KV: {
            async get(key) { return JSON.parse(values.get(key) ?? "null"); },
            async put(key, value) { values.set(key, value); }
        },
        DESCRIPTION_GENERATOR: {
            idFromName(id) { return id; },
            get(id) {
                if (!objects.has(id)) {
                    if (!stores.has(id)) stores.set(id, new Map());
                    const store = stores.get(id);
                    objects.set(id, new DescriptionGenerator({ storage: {
                        async get(key) { return structuredClone(store.get(key)); },
                        async put(key, value) { store.set(key, structuredClone(value)); }
                    } }, env));
                }
                return { fetch: (url, options) => objects.get(id).fetch(new Request(url, options)) };
            }
        }
    };
    return { env, values, planets, objects };
}

function mockAI(handler) {
    const calls = [];
    globalThis.fetch = async (url, options) => {
        assert.equal(String(url), "https://api.aitunnel.ru/v1/chat/completions");
        assert.equal(options.headers.Authorization, "Bearer test-token");
        const body = JSON.parse(options.body);
        assert.equal(body.model, "deepseek-v4.1-flash-1017");
        calls.push(body);
        if (handler) return handler(body, calls.length);
        return Response.json({ choices: [{ message: { content: `Описание ${calls.length}` }, finish_reason: "stop" }] });
    };
    return calls;
}

function request(env, id = "planet:test 0") {
    return worker.fetch(new Request(`https://worker.test/desc?id=${encodeURIComponent(id)}`), env);
}

test("preview returns the top 50 by ESI and only their stars without AI calls", async () => {
    const { env, values } = createEnv(65);
    const planets = JSON.parse(values.get("planets.json"));
    planets.planets.push({ ...planets.planets[0], id: "planet:unknown esi", esi: { full: null, simple: null } });
    values.set("planets.json", JSON.stringify(planets));
    const stars = JSON.parse(values.get("stars.json"));
    stars.stars.push({ ...stars.stars[0], id: "star:unrelated", planets: [] });
    values.set("stars.json", JSON.stringify(stars));
    const calls = mockAI();
    const response = await worker.fetch(new Request("https://worker.test/preview"), env);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.planets.length, 50);
    assert.equal(result.planets[0].id, "planet:test 64");
    assert.equal(result.planets.at(-1).id, "planet:test 15");
    assert.deepEqual(result.stars.map(s => s.id), ["star:test"]);
    assert.equal(calls.length, 0);
});

test("desc generates planet and star in separate KV records and reuses their descriptions", async () => {
    const { env, values } = createEnv();
    const calls = mockAI();
    const first = await request(env);
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { id: "planet:test 0", description: "Описание 2" });
    assert.equal(calls.length, 2);
    assert.match(calls[0].messages[1].content, /"Star"/);
    assert.match(calls[1].messages[1].content, /"Planet"/);
    assert.ok(values.has("descriptions:planet:test 0"));
    assert.ok(values.has("descriptions:star:test"));
    await request(env);
    assert.equal(calls.length, 2);
    await request(env, "planet:test 1");
    assert.equal(calls.length, 3, "another planet around the same star must reuse the star description");
});

test("cached desc works without the NASA catalog, AI token or generator", async () => {
    const { env, values } = createEnv();
    values.clear();
    values.set("descriptions:planet:test 0", JSON.stringify({ id: "planet:test 0", description: "Сохранённое описание" }));
    delete env.AI_TOKEN;
    delete env.DESCRIPTION_GENERATOR;
    const calls = mockAI();
    const response = await request(env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).description, "Сохранённое описание");
    assert.equal(calls.length, 0);
});

test("concurrent requests share generation and survive stale KV after a Durable Object restart", async () => {
    const { env, objects, values } = createEnv();
    const calls = mockAI();
    const responses = await Promise.all(Array.from({ length: 8 }, () => request(env)));
    for (const response of responses) assert.equal(response.status, 200);
    assert.equal(calls.length, 2);
    objects.clear();
    values.delete("descriptions:planet:test 0");
    values.delete("descriptions:star:test");
    assert.equal((await request(env)).status, 200);
    assert.equal(calls.length, 2);
});

test("a failed KV write retries publication without paying for generation again", async () => {
    const { env, objects } = createEnv();
    const calls = mockAI();
    const put = env.PLANETS_KV.put;
    let fail = true;
    env.PLANETS_KV.put = async (key, value) => {
        if (key === "descriptions:planet:test 0" && fail) {
            fail = false;
            throw new Error("KV unavailable");
        }
        return put(key, value);
    };
    assert.equal((await request(env)).status, 503);
    assert.equal(calls.length, 2);
    objects.clear();
    assert.equal((await request(env)).status, 200);
    assert.equal(calls.length, 2);
});

test("empty and truncated AI results are not cached and a retry can recover", async () => {
    for (const choice of [
        { message: { content: " " }, finish_reason: "stop" },
        { message: { content: "Оборванное описание" }, finish_reason: "length" }
    ]) {
        const { env, values } = createEnv();
        mockAI(() => Response.json({ choices: [choice] }));
        assert.equal((await request(env)).status, 503);
        assert.equal(values.has("descriptions:star:test"), false);
        const calls = mockAI();
        assert.equal((await request(env)).status, 200);
        assert.equal(calls.length, 2);
    }
});

test("desc validates id, unknown planets and HTTP method without calling AI", async () => {
    const { env } = createEnv();
    const calls = mockAI();
    for (const path of ["/desc", "/desc?id=", "/desc?id=%20"]) {
        const response = await worker.fetch(new Request(`https://worker.test${path}`), env);
        assert.equal(response.status, 400);
        assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
    }
    assert.equal((await request(env, "planet:missing")).status, 404);
    const post = await worker.fetch(new Request("https://worker.test/desc?id=planet:test", { method: "POST" }), env);
    assert.equal(post.status, 405);
    assert.equal(post.headers.get("Allow"), "GET");
    assert.equal(calls.length, 0);
});

test("scheduled NASA refresh updates the catalogs without touching descriptions", async () => {
    const { env, values } = createEnv();
    const saved = JSON.stringify({ id: "planet:test 0", description: "Не перегенерировать" });
    values.set("descriptions:planet:test 0", saved);
    let nasaCalls = 0;
    globalThis.fetch = async url => {
        assert.equal(url.hostname, "exoplanetarchive.ipac.caltech.edu");
        nasaCalls++;
        return Response.json([{ pl_name: "Test 0", hostname: "Test", pl_rade: 1, pl_insol: 1 }]);
    };
    let pending;
    await worker.scheduled({}, env, { waitUntil(promise) { pending = promise; } });
    await pending;
    assert.equal(nasaCalls, 1);
    assert.equal(values.get("descriptions:planet:test 0"), saved);
    assert.equal(JSON.parse(values.get("planets.json")).planets.length, 1);
});
