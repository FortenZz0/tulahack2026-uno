import { strict as assert } from "node:assert";
import { test } from "node:test";
import { classifyPlanet } from "../nasa.js";


test("Правильность классификации по размеру", () => {
    assert.equal(classifyPlanet(0.8), "terrestrial");
    assert.equal(classifyPlanet(1.5), "super-earth");
    assert.equal(classifyPlanet(2.5), "sub-neptune");
    assert.equal(classifyPlanet(4.5), "neptune");
    assert.equal(classifyPlanet(10), "jupiter");

    assert.equal(classifyPlanet(null), null);
    assert.equal(classifyPlanet(20), 'MEGA');
    assert.equal(classifyPlanet(0.01), 'MINI');
});

test("Граничные значения классификации", () => {
    assert.equal(classifyPlanet(0.5), "terrestrial");
    assert.equal(classifyPlanet(1.0), "super-earth");
    assert.equal(classifyPlanet(1.75), "sub-neptune");
    assert.equal(classifyPlanet(3.5), "neptune");
    assert.equal(classifyPlanet(6.0), "jupiter");
    assert.equal(classifyPlanet(14.3), "jupiter");
});

test("Некорректные и отсутствующие значения", () => {
    assert.equal(classifyPlanet(null), null);
    assert.equal(classifyPlanet(undefined), null);
    assert.equal(classifyPlanet(NaN), null);
    assert.equal(classifyPlanet(Infinity), null);
    assert.equal(classifyPlanet(-1), null);
});