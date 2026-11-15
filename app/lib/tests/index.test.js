import test from "node:test";
import assert from "node:assert/strict";
import * as api from "../index.js";
import { ExoplanetLibrary } from "../exoplanet-library.js";
import { queryPlanets } from "../planet-query.js";

test("Публичный API экспортирует библиотеку и запросы", () => {
    assert.strictEqual(api.ExoplanetLibrary, ExoplanetLibrary);
    assert.strictEqual(api.queryPlanets, queryPlanets);
});
